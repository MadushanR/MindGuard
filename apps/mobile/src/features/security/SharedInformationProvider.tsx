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
  type RevokeServiceResult, type ShareErrorCode, type ShareServiceResult, type SharingService,
} from "./sharingService";

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
}
const Context = createContext<SharedInformationContextValue | null>(null);

const TIMED_OUT = Symbol("timed out");
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
  const inFlight = useRef(new Map<string, Promise<ShareServiceResult>>());
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
    const existing = latest.current.find((record) => record.requestId === input.requestId);
    if (existing) return { status: "complete", record: existing };
    const session = generation.current;
    let request = inFlight.current.get(input.requestId);
    if (!request) {
      request = sharing.createShare({ ...snapshot, requestId: input.requestId });
      inFlight.current.set(input.requestId, request);
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
      return generation.current === session ? { status: "failed", error: "UNAVAILABLE" } : { status: "stale" };
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
    const request = sharing.revokeShare(serviceIds.current.get(id) ?? id, requestId);
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
      result = { status: "failed", error: "UNAVAILABLE" };
    } finally {
      revoking.current.delete(id);
    }
    if (generation.current !== session) return { status: "stale" };
    if (result === TIMED_OUT) {
      dispatch({ type: "revocation", id, state: "failed" });
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
    simulated: !service, simulateFailure, setSimulateFailure,
  }), [records, recordShare, submitShare, revokeShare, clearShareSession, service, simulateFailure, setSimulateFailure]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useSharedInformation(): SharedInformationContextValue {
  const value = useContext(Context);
  if (!value) throw new Error("useSharedInformation requires SharedInformationProvider.");
  return value;
}
