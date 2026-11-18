import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type PropsWithChildren } from "react";
import type { AccountShare, SecuritySnapshot } from "@mindguard/contracts";
import { CognitoVoiceIdentity, type VoiceIdentity } from "../ai/live/identity";
import { voiceRelayUrl } from "../ai/live/config";

export class SecurityRequestError extends Error {
  constructor(readonly code: string, readonly status?: number) { super(code); }
}
export type AccountIdentity = VoiceIdentity & { owner: string; email: string; session: number };
type SessionView = { identity: AccountIdentity | null; snapshot: SecuritySnapshot | null; busy: boolean; error: string | null };
/** Volatile application identity: route replacement may remount React layouts.
 * This store survives those mounts, but never a page reload or process restart. */
class SessionMemory {
  current = { current: null as AccountIdentity | null };
  revision = { current: 0 };
  pendingLogout = { current: null as Promise<unknown> | null };
  invalidators = { current: new Set<() => void>() };
  private view: SessionView = { identity: null, snapshot: null, busy: false, error: null };
  private listeners = new Set<() => void>();
  get = () => this.view;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  patch = (value: Partial<SessionView>) => { this.view = { ...this.view, ...value }; for (const listener of this.listeners) listener(); };
  invalidate = () => {
    this.revision.current++;
    for (const stop of this.invalidators.current) stop();
    this.current.current = null;
    this.patch({ identity: null, snapshot: null, busy: false });
  };
  accept = (identity: AccountIdentity, snapshot: SecuritySnapshot) => {
    this.current.current = identity;
    this.patch({ identity, snapshot });
  };
  waitForLogout = (task: Promise<unknown>) => { this.pendingLogout.current = task; };
}
const applicationSession = new SessionMemory();
function useSession(memory: SessionMemory) {
  const adapter = useRef(new CognitoVoiceIdentity());
  const { current, revision, pendingLogout, invalidators } = memory;
  const { identity, snapshot, busy, error } = useSyncExternalStore(memory.subscribe, memory.get, memory.get);
  const setSnapshot = useCallback((value: SecuritySnapshot | null | ((previous: SecuritySnapshot | null) => SecuritySnapshot | null)) => {
    memory.patch({ snapshot: typeof value === "function" ? value(memory.get().snapshot) : value });
  }, [memory]);
  const setBusy = useCallback((value: boolean) => memory.patch({ busy: value }), [memory]);
  const setError = useCallback((value: string | null) => memory.patch({ error: value }), [memory]);
  const invalidate = useCallback(() => memory.invalidate(), [memory]);
  const subscribe = useCallback((stop: () => void) => { invalidators.current.add(stop); return () => { invalidators.current.delete(stop); }; }, [invalidators]);
  const requestWith = useCallback(async <T,>(token: string, path: string, method = "GET", body?: unknown): Promise<T> => {
    let response: Response;
    try {
      response = await fetch(`${voiceRelayUrl()}/api/security${path}`, { method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000) });
    } catch { throw new SecurityRequestError("OUTCOME_UNKNOWN"); }
    const result = await response.json().catch(() => { throw new SecurityRequestError("OUTCOME_UNKNOWN"); });
    if (!response.ok) throw new SecurityRequestError(result.code ?? "SERVICE_UNAVAILABLE", response.status);
    return result as T;
  }, []);
  const request = useCallback(async <T,>(path: string, method = "GET", body?: unknown): Promise<T> => {
    const account = current.current;
    if (!account || account.expiresAt <= Date.now()) { invalidate(); throw new SecurityRequestError("AUTH_REQUIRED", 401); }
    try {
      const value = await requestWith<T>(account.token, path, method, body);
      if (current.current !== account) throw new SecurityRequestError("SESSION_CHANGED");
      return value;
    } catch (cause) {
      if (current.current !== account) throw new SecurityRequestError("SESSION_CHANGED");
      if (cause instanceof SecurityRequestError && cause.status === 401) invalidate();
      throw cause;
    }
  }, [invalidate, requestWith, current]);
  const refresh = useCallback(async () => {
    const account = current.current;
    try { const value = await request<SecuritySnapshot>("/snapshot"); if (current.current === account) { setSnapshot(value); setError(null); } return value; }
    catch (e) { if (current.current === account) setError(e instanceof Error ? e.message : "SERVICE_UNAVAILABLE"); throw e; }
  }, [request, current, setError, setSnapshot]);
  const signIn = useCallback(async (email: string, password: string) => {
    invalidate(); const session = revision.current; setBusy(true); setError(null);
    let token: VoiceIdentity | undefined;
    try {
      await pendingLogout.current?.catch(() => {});
      if (session !== revision.current) return;
      token = await adapter.current.signIn(email, password);
      const profile = await requestWith<{ owner: string; email: string }>(token.token, "/session", "POST");
      const initialSnapshot = await requestWith<SecuritySnapshot>(token.token, "/snapshot");
      if (session !== revision.current) return;
      const account = { ...token, ...profile, session };
      memory.accept(account, initialSnapshot);
    } catch (e) {
      if (session !== revision.current) return;
      if (!current.current && token) memory.waitForLogout(adapter.current.signOut(token.token).catch(() => {}));
      setError(e instanceof Error ? e.message : "AUTH_REQUIRED"); throw e;
    } finally { if (session === revision.current) setBusy(false); }
  }, [invalidate, requestWith, current, memory, pendingLogout, revision, setBusy, setError]);
  const logout = useCallback(() => {
    const account = current.current;
    invalidate();
    if (account) memory.waitForLogout(requestWith(account.token, "/logout", "POST").catch(() => adapter.current.signOut(account.token).catch(() => {})));
  }, [invalidate, requestWith, current, memory]);
  useEffect(() => {
    if (!identity) return;
    const timer = setTimeout(logout, Math.max(0, identity.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [identity, logout]);
  return { identity, busy, snapshot, error, signIn, logout, request, refresh, subscribe,
    applyShareResult: (record: AccountShare, expectedSession: number | undefined) => {
      if (current.current?.session !== expectedSession) return;
      setSnapshot(previous => previous && current.current?.session === expectedSession ? {
        ...previous, outgoing: [record, ...previous.outgoing.filter(s => s.id !== record.id)],
      } : previous);
    },
    signUp: (email: string, password: string, name?: string) => adapter.current.signUp(email, password, name),
    confirm: (email: string, code: string) => adapter.current.confirm(email, code),
    recover: (email: string) => adapter.current.recover(email),
    resetPassword: (email: string, code: string, password: string) => adapter.current.resetPassword(email, code, password),
    deleteAccount: async () => {
      // Invalidate audio immediately; keep the token only in this request's closure.
      const account = current.current;
      if (!account) throw new SecurityRequestError("AUTH_REQUIRED", 401);
      for (const stop of invalidators.current) stop();
      setSnapshot(null);
      try {
        await request("/account", "DELETE");
        invalidate();
      } catch (e) { setError("Account deletion was not confirmed. Retry deletion; do not assume the account or data remains unchanged."); throw e; }
    },
  };
}
export type SecuritySession = ReturnType<typeof useSession>;
const Context = createContext<SecuritySession | null>(null);
export function SecuritySessionProvider({ children, persistent = false }: PropsWithChildren<{ persistent?: boolean }>) {
  // Standalone/test composition gets an isolated store. The app opts into the
  // single volatile store so Expo route remounts cannot erase its identity.
  const [memory] = useState(() => persistent ? applicationSession : new SessionMemory());
  const session = useSession(memory);
  return <Context.Provider value={session}>{children}</Context.Provider>;
}
export const useSecuritySessionOptional = () => useContext(Context);
export function useSecuritySession() {
  const value = useSecuritySessionOptional();
  if (!value) throw new Error("Mount SecuritySessionProvider.");
  return value;
}
