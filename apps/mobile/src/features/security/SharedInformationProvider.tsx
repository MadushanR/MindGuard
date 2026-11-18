import {
  createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState,
  type PropsWithChildren,
} from "react";
import {
  normalizeShare, sharedInformationReducer,
  type ShareInput, type SharedInformationRecord,
} from "./sharedInformation";
import {
  createSimulatedSharingService,
  createLiveSharingService,
  type LiveSharingService,
  type RevokeServiceResult, type ShareErrorCode, type ShareServiceResult, type SharingService,
} from "./sharingService";
import { SecurityRequestError, useSecuritySessionOptional, type SecuritySession } from "./SecuritySessionProvider";
import type { AccountShare } from "@mindguard/contracts";

export type ShareSubmitResult =
  | { readonly status: "complete"; readonly record: SharedInformationRecord }
  | { readonly status: "failed"; readonly error: ShareErrorCode }
  /** No answer before the wait limit. A retry with the same requestId cannot duplicate. */
  | { readonly status: "unknown" }
  /** The share session was cleared while waiting; the caller must discard this result. */
  | { readonly status: "stale" };
export type RevokeResult =
  | { readonly status: "complete" }
  | { readonly status: "failed"; readonly error: ShareErrorCode | "NOT_FOUND" }
  | { readonly status: "unknown" }
  | { readonly status: "pending" }
  | { readonly status: "stale" };

export interface SharedInformationContextValue {
  records: readonly SharedInformationRecord[];
  /** Call only after an explicit recipient-sharing confirmation; never for export. */
  recordShare(input: ShareInput): SharedInformationRecord;
  /**
   * Sends an explicitly confirmed recipient share through the sharing service and records
   * the confirmed snapshot only after the service completes. Reuse requestId to retry.
   */
  submitShare(input: ShareInput & { readonly requestId: string }): Promise<ShareSubmitResult>;
  /** Keeps the record until the service confirms revocation. Repeats while pending are ignored. */
  revokeShare(id: string): Promise<RevokeResult>;
  clearShareSession(): void;
  /** True while the default adapter is the simulated, session-only service. */
  simulated: boolean;
  simulateFailure: boolean;
  setSimulateFailure(value: boolean): void;
  incoming?: readonly (AccountShare & { sender: string })[];
  refresh?: () => Promise<unknown>;
  error?: string | null;
}
const Context = createContext<SharedInformationContextValue | null>(null);

const TIMED_OUT = Symbol("timed out");
/** Fingerprint of everything a share discloses, used to detect a reused requestId. */
const sharePayload = (share: ShareInput) => JSON.stringify([share.recipientName, share.content, share.destination ?
  [share.destination.id, share.destination.name, share.destination.email, share.destination.relationship] : null]);
function within<T>(promise: Promise<T>, ms: number): Promise<T | typeof TIMED_OUT> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(TIMED_OUT), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

export function SharedInformationProvider({
  children, service, timeoutMs = 15000,
}: PropsWithChildren<{ service?: SharingService; timeoutMs?: number }>) {
  const session = useSecuritySessionOptional();
  if (service?.executionMode === "live") {
    if (!session || !("getStatus" in service) || !("history" in service)) throw new Error("Live sharing requires the shared session and status/history adapter.");
    return <LiveSharedInformationProvider session={session} service={service as LiveSharingService}>{children}</LiveSharedInformationProvider>;
  }
  if (session && !service) return <LiveSharedInformationProvider session={session}>{children}</LiveSharedInformationProvider>;
  return <SimulatedSharedInformationProvider service={service} timeoutMs={timeoutMs}>{children}</SimulatedSharedInformationProvider>;
}
function SimulatedSharedInformationProvider({ children, service, timeoutMs = 15000 }: PropsWithChildren<{ service?: SharingService; timeoutMs?: number }>) {
  const [records, dispatch] = useReducer(sharedInformationReducer, []);
  const [simulateFailure, setSimulateFailureState] = useState(false);
  const [defaultService] = useState(() => createSimulatedSharingService());
  const sharing = service ?? defaultService;
  const latest = useRef(records);
  useEffect(() => { latest.current = records; }, [records]);
  const sequence = useRef(0);
  // Incremented on clear so late responses from an ended session never change new state.
  const generation = useRef(0);
  const serviceIds = useRef(new Map<string, string>());
  // Keep the binding after a transport rejection: the operation may have executed.
  const requestPayloads = useRef(new Map<string, string>());
  const inFlight = useRef(new Map<string, { payload: string; request: Promise<ShareServiceResult> }>());
  const revokeRequests = useRef(new Map<string, string>());
  const revoking = useRef(new Set<string>());

  const add = useCallback((input: ShareInput, requestId?: string) => {
    const snapshot = normalizeShare(input);
    const createdAt = Date.now();
    const record: SharedInformationRecord = {
      ...snapshot,
      id: `share-${createdAt}-${++sequence.current}`,
      createdAt,
      ...(requestId ? { requestId } : {}),
    };
    dispatch({ type: "record", record });
    return record;
  }, []);
  const recordShare = useCallback((input: ShareInput) => add(input), [add]);

  const submitShare = useCallback(async (
    input: ShareInput & { readonly requestId: string },
  ): Promise<ShareSubmitResult> => {
    const snapshot = normalizeShare(input);
    const payload = sharePayload(snapshot);
    const previousPayload = requestPayloads.current.get(input.requestId);
    if (previousPayload !== undefined && previousPayload !== payload) return { status: "failed", error: "CONFLICT" };
    requestPayloads.current.set(input.requestId, payload);
    // A reused requestId is only a safe retry when its payload is identical; otherwise it
    // is a conflict and must never return or create a share for different content.
    const existing = latest.current.find((record) => record.requestId === input.requestId);
    if (existing) {
      return sharePayload(existing) === payload
        ? { status: "complete", record: existing }
        : { status: "failed", error: "CONFLICT" };
    }
    const session = generation.current;
    const pending = inFlight.current.get(input.requestId);
    if (pending && pending.payload !== payload) return { status: "failed", error: "CONFLICT" };
    let request = pending?.request;
    if (!request) {
      request = (async () => sharing.createShare({ ...snapshot, requestId: input.requestId }))();
      inFlight.current.set(input.requestId, { payload, request });
      // Record a completed share even if the caller stopped waiting: it was accepted.
      void request.then((result) => {
        if (generation.current !== session || result.status !== "complete") return;
        if (latest.current.some((record) => record.requestId === input.requestId)) return;
        const record = add(snapshot, input.requestId);
        serviceIds.current.set(record.id, result.shareId);
        latest.current = [record, ...latest.current];
      }, () => undefined).finally(() => inFlight.current.delete(input.requestId));
    }
    let result: ShareServiceResult | typeof TIMED_OUT;
    try {
      result = await within(request, timeoutMs);
    } catch {
      // A rejected connection does not prove the server rejected the operation.
      return generation.current === session ? { status: "unknown" } : { status: "stale" };
    }
    if (generation.current !== session) return { status: "stale" };
    if (result === TIMED_OUT) return { status: "unknown" };
    if (result.status === "failed") return { status: "failed", error: result.error };
    // The completion handler above runs first because it was attached first.
    const record = latest.current.find((item) => item.requestId === input.requestId);
    return record ? { status: "complete", record } : { status: "failed", error: "UNAVAILABLE" };
  }, [add, sharing, timeoutMs]);

  const revokeShare = useCallback(async (id: string): Promise<RevokeResult> => {
    const record = latest.current.find((item) => item.id === id);
    if (!record) return { status: "failed", error: "NOT_FOUND" };
    if (revoking.current.has(id)) return { status: "pending" };
    revoking.current.add(id);
    const session = generation.current;
    let requestId = revokeRequests.current.get(id);
    if (!requestId) {
      requestId = `revoke-${id}-${Date.now()}`;
      revokeRequests.current.set(id, requestId);
    }
    dispatch({ type: "revocation", id, state: "pending" });
    const serviceId = serviceIds.current.get(id) ?? id;
    const request = (async () => sharing.revokeShare(serviceId, requestId))();
    // A late confirmation still completes revocation for the current session.
    void request.then((result) => {
      if (generation.current === session && result.status === "complete") {
        dispatch({ type: "revoke", id });
        revokeRequests.current.delete(id);
      }
    }, () => undefined);
    let result: RevokeServiceResult | typeof TIMED_OUT;
    try {
      result = await within(request, timeoutMs);
    } catch {
      // Preserve uncertainty if the server response was lost after revocation.
      result = TIMED_OUT;
    } finally {
      revoking.current.delete(id);
    }
    if (generation.current !== session) return { status: "stale" };
    if (result === TIMED_OUT) {
      // Not "failed": the service may have revoked access without answering in time.
      dispatch({ type: "revocation", id, state: "unknown" });
      return { status: "unknown" };
    }
    if (result.status === "failed") {
      dispatch({ type: "revocation", id, state: "failed" });
      return { status: "failed", error: result.error };
    }
    return { status: "complete" };
  }, [sharing, timeoutMs]);

  const clearShareSession = useCallback(() => {
    generation.current += 1;
    serviceIds.current.clear();
    requestPayloads.current.clear();
    inFlight.current.clear();
    revokeRequests.current.clear();
    revoking.current.clear();
    defaultService.setUnavailable(false);
    setSimulateFailureState(false);
    dispatch({ type: "clear" });
  }, [defaultService]);
  const setSimulateFailure = useCallback((value: boolean) => {
    defaultService.setUnavailable(value);
    setSimulateFailureState(value);
  }, [defaultService]);
  const value = useMemo(() => ({
    records, recordShare, submitShare, revokeShare, clearShareSession,
    simulated: true, simulateFailure, setSimulateFailure,
  }), [records, recordShare, submitShare, revokeShare, clearShareSession, simulateFailure, setSimulateFailure]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
function shareError(error: unknown): ShareErrorCode {
  if (!(error instanceof SecurityRequestError)) return "UNAVAILABLE";
  if (error.status === 401 || error.code === "SESSION_CHANGED") return "AUTH_REQUIRED";
  if (error.code === "CONSENT_REQUIRED") return "CONSENT_REQUIRED";
  if (error.code === "RECIPIENT_UNAVAILABLE") return "RECIPIENT_UNAVAILABLE";
  if (error.code === "CONFLICT") return "CONFLICT";
  if (error.code === "ACCOUNT_CAPACITY_REACHED") return "CAPACITY";
  return error.status === 400 ? "INVALID" : "UNAVAILABLE";
}
function LiveSharedInformationProvider({ children, session, service }: PropsWithChildren<{ session: SecuritySession; service?: LiveSharingService }>) {
  const adapter = useMemo(() => service ?? createLiveSharingService(session), [session, service]);
  const bindings = useRef(new Map<string, string>());
  const pending = useRef(new Map<string, Promise<ShareSubmitResult>>());
  const revoking = useRef(new Set<string>());
  const [revocations, setRevocations] = useState<Record<string, "pending" | "failed" | "unknown">>({});
  const generation = useRef(0);
  const clearShareSession = useCallback(() => { generation.current++; bindings.current.clear(); pending.current.clear(); setRevocations({}); }, []);
  const subscribe = session.subscribe;
  useEffect(() => subscribe(clearShareSession), [subscribe, clearShareSession]);
  const records = (session.snapshot?.outgoing ?? []).filter(s => !s.revoked).map(s => ({ ...s, revocation: revocations[s.id] }));
  const submitShare = useCallback(async (input: ShareInput & { requestId: string }): Promise<ShareSubmitResult> => {
    if (!input.destination) return { status: "failed", error: "INVALID" };
    const payload = sharePayload(input), previous = bindings.current.get(input.requestId);
    if (previous && previous !== payload) return { status: "failed", error: "CONFLICT" };
    bindings.current.set(input.requestId, payload);
    const inFlight = pending.current.get(input.requestId);
    if (inFlight) return inFlight;
    const epoch = generation.current;
    const task = (async (): Promise<ShareSubmitResult> => {
      try {
        // A repeat first reconciles the authoritative status, then safely reuses the ID.
        const prior = previous ? await adapter.getStatus(input.requestId) : null;
        const result = prior ? null : await adapter.createShare(input);
        if (result?.status === "failed") return result;
        const record = prior ?? (result?.status === "complete" ? result.record : null);
        if (!record) return { status: "unknown" };
        if (epoch !== generation.current) return { status: "stale" };
        if (record.revoked) return { status: "failed", error: "CONFLICT" };
        session.applyShareResult(record, session.identity?.session);
        // The operation is confirmed even if the following history refresh fails.
        await adapter.history().catch(() => {});
        if (epoch !== generation.current) return { status: "stale" };
        return { status: "complete", record };
      } catch (e) {
        if (epoch !== generation.current || (e instanceof SecurityRequestError && e.code === "SESSION_CHANGED")) return { status: "stale" };
        if (!(e instanceof SecurityRequestError) || !e.status || e.status >= 500) return { status: "unknown" };
        return { status: "failed", error: shareError(e) };
      }
    })();
    pending.current.set(input.requestId, task);
    void task.finally(() => { if (pending.current.get(input.requestId) === task) pending.current.delete(input.requestId); });
    return task;
  }, [adapter, session]);
  const revokeShare = useCallback(async (id: string): Promise<RevokeResult> => {
    if (revoking.current.has(id)) return { status: "pending" };
    revoking.current.add(id); const epoch = generation.current;
    setRevocations(v => ({ ...v, [id]: "pending" }));
    try {
      await adapter.revokeShare(id, `revoke-${id}`);
      if (epoch !== generation.current) return { status: "stale" };
      const record = session.snapshot?.outgoing.find(s => s.id === id);
      if (record) session.applyShareResult({ ...record, revoked: true }, session.identity?.session);
      await adapter.history().catch(() => {});
      if (epoch !== generation.current) return { status: "stale" };
      return { status: "complete" };
    } catch (e) {
      if (epoch !== generation.current || (e instanceof SecurityRequestError && e.code === "SESSION_CHANGED")) return { status: "stale" };
      const unknown = !(e instanceof SecurityRequestError) || !e.status || e.status >= 500;
      setRevocations(v => ({ ...v, [id]: unknown ? "unknown" : "failed" }));
      return unknown ? { status: "unknown" } : { status: "failed", error: shareError(e) };
    } finally { revoking.current.delete(id); }
  }, [adapter, session]);
  return <Context.Provider value={{ records, submitShare, revokeShare, clearShareSession,
    recordShare: () => { throw new Error("Live shares require authenticated explicit confirmation."); },
    simulated: false, simulateFailure: false, setSimulateFailure: () => {},
    incoming: session.snapshot?.incoming ?? [], refresh: session.refresh, error: session.error,
  }}>{children}</Context.Provider>;
}
export function useSharedInformation(): SharedInformationContextValue {
  const value = useContext(Context);
  if (!value) throw new Error("useSharedInformation requires SharedInformationProvider.");
  return value;
}
