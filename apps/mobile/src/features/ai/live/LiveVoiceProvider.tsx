import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from "react";
import { AppState, Platform } from "react-native";
import { usePathname } from "expo-router";
import { useAI } from "../AIProvider";
import { VoiceAudio } from "./VoiceAudio";
import { VoiceSessionController, type TextHandoff, type VoiceUpdate } from "./VoiceSessionController";
import { CognitoVoiceIdentity, type VoiceIdentity, type VoiceIdentityPort } from "./identity";
import { voiceRelayUrl } from "./config";

const initial: VoiceUpdate = { state: "ready", microphoneActive: false };
function useVoiceProduct(identityPort?: VoiceIdentityPort) {
  const { setConsent: saveLocalConsent, consent: { voice: localVoiceConsent } } = useAI();
  const path = usePathname();
  const previousPath = useRef(path);
  const access = useRef<VoiceIdentity | null>(null);
  const auth = useRef(identityPort ?? new CognitoVoiceIdentity());
  const revision = useRef(0);
  const handoffRevision = useRef(0);
  const controller = useRef<VoiceSessionController | null>(null);
  const audio = useRef<VoiceAudio | null>(null);
  const handoffRef = useRef<TextHandoff | null>(null);
  const textAbort = useRef<AbortController | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [expiresAt, setExpiresAt] = useState(0);
  const [update, setUpdate] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState<boolean | null>(null);
  const [handoff, setHandoff] = useState<TextHandoff | null>(null);
  const [textMode, setTextMode] = useState(false);

  const headers = useCallback(() => {
    if (!access.current || access.current.expiresAt <= Date.now()) throw new Error("AUTH_EXPIRED");
    return { Authorization: `Bearer ${access.current.token}`, "Content-Type": "application/json" };
  }, []);
  const stop = useCallback(() => {
    controller.current?.stop();
    controller.current = null;
    audio.current?.dispose();
    audio.current = null;
    setUpdate({ state: "stopped", microphoneActive: false });
  }, []);
  const clearHandoff = useCallback(() => {
    handoffRevision.current++;
    const pendingText = textAbort.current;
    pendingText?.abort();
    if (pendingText) setBusy(false);
    textAbort.current = null;
    const value = handoffRef.current;
    handoffRef.current = null;
    setHandoff(null);
    setTextMode(false);
    if (value && access.current) {
      try {
        void fetch(`${voiceRelayUrl()}/api/voice/sessions/${encodeURIComponent(value.sessionId)}`, {
          method: "DELETE", headers: headers(), signal: AbortSignal.timeout(3000),
        }).catch(() => {});
      } catch { /* Local deletion never depends on the remote endpoint. */ }
    }
  }, [headers]);
  const logout = useCallback(() => {
    revision.current++;
    stop();
    clearHandoff();
    const identity = access.current;
    access.current = null;
    setSignedIn(false);
    setConsent(null);
    setExpiresAt(0);
    setBusy(false);
    if (identity) void auth.current.signOut(identity.token).catch(() => {});
  }, [stop, clearHandoff]);
  const refreshConsent = useCallback(async () => {
    const identity = access.current;
    const response = await fetch(`${voiceRelayUrl()}/api/voice/consent`, { headers: headers(), signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error("CONSENT_UNAVAILABLE");
    const result = await response.json();
    if (identity !== access.current) return;
    if (typeof result.allowed !== "boolean") throw new Error("CONSENT_UNAVAILABLE");
    setConsent(result.allowed);
    saveLocalConsent("voice", result.allowed);
  }, [headers, saveLocalConsent]);
  const signIn = useCallback(async (email: string, password: string) => {
    const requestRevision = ++revision.current;
    setBusy(true);
    setError(null);
    try {
      const identity = await auth.current.signIn(email, password);
      if (requestRevision !== revision.current) return;
      access.current = identity;
      setSignedIn(true);
      setExpiresAt(identity.expiresAt);
      await refreshConsent();
    } catch (cause) {
      if (requestRevision !== revision.current) return;
      setError(cause instanceof Error ? cause.message : "VOICE_SIGN_IN_FAILED");
      throw cause;
    } finally { if (requestRevision === revision.current) setBusy(false); }
  }, [refreshConsent]);
  const setVoiceConsent = useCallback(async (allowed: boolean) => {
    const identity = access.current;
    if (!allowed) { stop(); clearHandoff(); setConsent(false); saveLocalConsent("voice", false); }
    const response = await fetch(`${voiceRelayUrl()}/api/voice/consent`, {
      method: "PUT", headers: headers(), body: JSON.stringify({ allowed, disclosure: "voice-processing-v1" }), signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("CONSENT_UNAVAILABLE");
    if (identity !== access.current) return;
    setConsent(allowed);
    saveLocalConsent("voice", allowed);
  }, [stop, clearHandoff, headers, saveLocalConsent]);
  const start = useCallback(async () => {
    stop();
    clearHandoff();
    setError(null);
    try {
      const token = access.current?.token;
      headers();
      if (!token || consent !== true) throw new Error("CONSENT_REQUIRED");
      const port = new VoiceAudio((code) => {
        stop();
        setUpdate({ state: "error", microphoneActive: false, error: code });
      });
      audio.current = port;
      const client = new VoiceSessionController(voiceRelayUrl(), token, port, (next) => {
        if (controller.current === client) setUpdate(next);
      });
      controller.current = client;
      await client.start();
    } catch (cause) {
      stop();
      setUpdate({ state: "error", microphoneActive: false, error: cause instanceof Error ? cause.message : "VOICE_FAILED" });
    }
  }, [stop, clearHandoff, headers, consent]);
  const switchToText = useCallback(async () => {
    setError(null);
    const client = controller.current;
    if (!client) { stop(); return; }
    const identity = access.current;
    const transfer = ++handoffRevision.current;
    setTextMode(true);
    try {
      const value = await client.handoff();
      if (!identity || identity !== access.current || transfer !== handoffRevision.current) return;
      if (!value || typeof value.sessionId !== "string" || !Array.isArray(value.messages) || value.messages.length > 6)
        throw new Error("TEXT_HANDOFF_UNAVAILABLE");
      handoffRef.current = value;
      setHandoff(value);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "TEXT_HANDOFF_UNAVAILABLE"); }
    finally { if (controller.current === client) stop(); }
  }, [stop]);
  const sendText = useCallback(async (text: string) => {
    const value = handoffRef.current;
    if (!value || textAbort.current || !text.trim()) return false;
    const abort = new AbortController();
    let timedOut = false;
    const deadline = setTimeout(() => { timedOut = true; abort.abort(); }, 45000);
    textAbort.current = abort;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${voiceRelayUrl()}/api/voice/sessions/${encodeURIComponent(value.sessionId)}/text`, {
        method: "POST", headers: headers(), body: JSON.stringify({ text }), signal: abort.signal,
      });
      if (!response.ok) throw new Error("TEXT_REPLY_UNAVAILABLE");
      const result = await response.json();
      if (handoffRef.current !== value || abort.signal.aborted) return false;
      if (result.route) {
        clearHandoff();
        setTextMode(true);
        setUpdate({ state: "error", microphoneActive: false, resourceRoute: result.route === "FIXED_RESOURCES", error: "RESPONSE_NOT_PERMITTED" });
        setError("RESPONSE_NOT_PERMITTED");
        throw new Error("RESPONSE_NOT_PERMITTED");
      }
      if (result.sessionId !== value.sessionId || typeof result.text !== "string" || result.text.length > 8000)
        throw new Error("TEXT_REPLY_UNAVAILABLE");
      const next: TextHandoff = { ...value, messages: [...value.messages, { role: "user", content: text }, { role: "assistant", content: result.text }].slice(-6) as TextHandoff["messages"] };
      handoffRef.current = next;
      setHandoff(next);
      return true;
    } catch (cause) {
      if (!abort.signal.aborted || timedOut) setError(cause instanceof Error && !timedOut ? cause.message : "TEXT_REPLY_UNAVAILABLE");
      return false;
    }
    finally {
      clearTimeout(deadline);
      if (textAbort.current === abort) { textAbort.current = null; setBusy(false); }
    }
  }, [headers, clearHandoff]);

  useEffect(() => {
    if (!signedIn) return;
    const timeout = setTimeout(logout, Math.max(0, expiresAt - Date.now()));
    return () => clearTimeout(timeout);
  }, [signedIn, expiresAt, logout]);
  // These effects tear down external microphone/socket resources on access or route changes.
  // Their status updates reflect that imperative cleanup; deferring it would leave audio active.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (consent === true && !localVoiceConsent) {
      void setVoiceConsent(false).catch(() => setError("CONSENT_REVOCATION_PENDING"));
    }
  }, [localVoiceConsent, consent, setVoiceConsent]);
  useEffect(() => {
    const previous = previousPath.current;
    previousPath.current = path;
    if (previous === "/voice" && path !== "/voice") stop();
    if (!["/voice", "/chat"].includes(path)) clearHandoff();
    if (["/sign-in", "/create-account", "/account-recovery", "/"].includes(path) && previous !== path) logout();
  }, [path, stop, clearHandoff, logout]);
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => {
    const cleanup = () => { stop(); clearHandoff(); };
    const subscription = AppState.addEventListener("change", (state) => { if (state !== "active") cleanup(); });
    if (Platform.OS === "web") {
      const hidden = () => { if (document.hidden) cleanup(); };
      document.addEventListener("visibilitychange", hidden);
      window.addEventListener("pagehide", cleanup);
      return () => { subscription.remove(); document.removeEventListener("visibilitychange", hidden); window.removeEventListener("pagehide", cleanup); cleanup(); };
    }
    return () => { subscription.remove(); cleanup(); };
  }, [stop, clearHandoff]);
  return { signedIn, busy, error, consent, update, handoff, textMode, start, stop, logout, signIn,
    signUp: (email: string, password: string) => auth.current.signUp(email, password),
    confirm: (email: string, code: string) => auth.current.confirm(email, code),
    refreshConsent, setVoiceConsent, switchToText, sendText, clearHandoff,
    mute: (muted: boolean) => controller.current?.setMuted(muted),
    interrupt: () => controller.current?.interrupt(),
  };
}
type VoiceProduct = ReturnType<typeof useVoiceProduct>;
const Context = createContext<VoiceProduct | null>(null);
export function LiveVoiceProvider({ children, identityPort }: PropsWithChildren<{ identityPort?: VoiceIdentityPort }>) {
  const value = useVoiceProduct(identityPort);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useLiveVoiceOptional() { return useContext(Context); }
export function useLiveVoice() {
  const value = useLiveVoiceOptional();
  if (!value) throw new Error("Mount LiveVoiceProvider in the root layout.");
  return value;
}
