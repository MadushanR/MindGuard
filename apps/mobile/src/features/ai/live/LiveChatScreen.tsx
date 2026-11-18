import { useCallback, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Platform, View } from "react-native";
import { chatContent } from "@mindguard/fixtures";
import { Page } from "../../../shared/Page";
import { Button, Card, Copy, Dialog, Field, Notice, ZenOrb } from "../../../shared/ui";
import { route } from "../../../shared/navigation";
import { styles } from "../../../shared/theme";
import { LiveAccountForm } from "./LiveAccountForm";
import { useLiveVoice } from "./LiveVoiceProvider";

type ChatSession = { sessionId: string; expiresAt: number };
type ChatReply = { sessionId: string; text: string } | { route: "FIXED_RESOURCES" | "BLOCKED" };
type Exchange = { question: string; reply: string };

const textErrors: Record<string, string> = {
  AUTH_EXPIRED: "Your sign-in expired. Sign in again to continue.",
  AUTH_REQUIRED: "Sign out and sign in again to continue.",
  ALLOWANCE_EXHAUSTED: "You reached today's chat-session limit.",
  CONSENT_REQUIRED: "Allow text processing before sending a message.",
  SESSION_EXPIRED: "This chat session expired. Send again to start a new conversation.",
  CHAT_TURN_LIMIT: "This conversation reached its message limit. Send again to start a new conversation.",
  RESPONSE_NOT_PERMITTED: "Zen couldn't provide a reply to that message. You can rephrase it or open Resources.",
  CONSENT_UPDATE_FAILED: "Your permission change could not be confirmed. Check your permission to try again.",
  SERVICE_NOT_CONFIGURED: "Live chat is unavailable. Try again later.",
};
const closedSessions = ["SESSION_EXPIRED", "SESSION_UNAVAILABLE", "SESSION_INACTIVE", "CHAT_TURN_LIMIT"];
const errorCode = (error: unknown) => error instanceof Error ? error.message : "TEXT_REPLY_UNAVAILABLE";
const sessionPath = (id: string) => `/sessions/${encodeURIComponent(id)}`;

export function LiveChatScreen() {
  const voice = useLiveVoice();
  return (
    <Page wide>
      <View style={styles.row}>
        <ZenOrb compact />
        <Copy kind="heading">Chat with Zen</Copy>
      </View>
      <Copy kind="caption">Live chat · MindGuard does not save this conversation to history.</Copy>
      <View style={styles.row}>
        <Button label="Voice" icon="mic" kind="text" onPress={() => router.push(route(7))} />
        {Platform.OS !== "web" ? (
          <Button label="Demo chat" kind="text" onPress={() => router.push({ pathname: "/chat", params: { mode: "demo" } })} />
        ) : null}
      </View>
      {!voice.signedIn ? (
        <LiveAccountForm conversation="chat" />
      ) : <ChatConversation requestChat={voice.requestChat} signOut={voice.logout} />}
    </Page>
  );
}

function ChatConversation({ requestChat, signOut }: Pick<ReturnType<typeof useLiveVoice>, "requestChat"> & { signOut: () => void }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [asking, setAsking] = useState(false);
  const [draft, setDraft] = useState("");
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resources, setResources] = useState(false);
  const session = useRef<ChatSession | null>(null);
  const pending = useRef<AbortController | null>(null);
  const focus = useRef<AbortController | null>(null);

  const close = useCallback(() => {
    pending.current?.abort();
    pending.current = null;
    const id = session.current?.sessionId;
    session.current = null;
    if (id) void requestChat(sessionPath(id), { method: "DELETE" }).catch(() => {});
  }, [requestChat]);

  const reset = () => {
    close();
    setBusy(false);
    setError(null);
    setResources(false);
    setExchanges([]);
    setDraft("");
  };

  const checkConsent = useCallback(async (signal: AbortSignal) => {
    setChecking(true);
    setError(null);
    try {
      const result = await requestChat<{ allowed: boolean }>("/chat/consent");
      if (typeof result?.allowed !== "boolean") throw new Error("TEXT_REPLY_UNAVAILABLE");
      if (!signal.aborted) setAllowed(result.allowed);
    } catch (error) {
      if (!signal.aborted) setError(errorCode(error));
    } finally {
      if (!signal.aborted) setChecking(false);
    }
  }, [requestChat]);

  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    focus.current = controller;
    void checkConsent(controller.signal);
    return () => {
      controller.abort();
      focus.current = null;
      close();
      setAllowed(null);
      setAsking(false);
      setBusy(false);
      setDraft("");
      setExchanges([]);
      setResources(false);
    };
  }, [checkConsent, close]));

  const changeConsent = async (value: boolean) => {
    const signal = focus.current?.signal;
    if (!signal || signal.aborted) return;
    if (!value) reset();
    setAllowed(null);
    setChecking(true);
    setError(null);
    try {
      const result = await requestChat<{ allowed: boolean }>("/chat/consent", {
        method: "PUT", body: JSON.stringify({ allowed: value, disclosure: "text-processing-v1" }),
      });
      if (result?.allowed !== value) throw new Error("CONSENT_UPDATE_FAILED");
      if (!signal.aborted) { setAllowed(value); setAsking(false); }
    } catch {
      if (!signal.aborted) setError("CONSENT_UPDATE_FAILED");
    } finally {
      if (!signal.aborted) setChecking(false);
    }
  };

  const send = async () => {
    const question = draft.trim();
    if (allowed !== true || !question || pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    const timeout = setTimeout(() => controller.abort(), 45000);
    setBusy(true);
    setError(null);
    setResources(false);
    try {
      if (!session.current) {
        const created = await requestChat<ChatSession>("/chat/sessions", { method: "POST", signal: controller.signal });
        if (typeof created?.sessionId !== "string" || !Number.isFinite(created.expiresAt)) throw new Error("TEXT_REPLY_UNAVAILABLE");
        if (controller.signal.aborted || pending.current !== controller) {
          void requestChat(sessionPath(created.sessionId), { method: "DELETE" }).catch(() => {});
          return;
        }
        session.current = created;
      }
      if (session.current.expiresAt <= Date.now()) throw new Error("SESSION_EXPIRED");
      const id = session.current.sessionId;
      const result = await requestChat<ChatReply>(`${sessionPath(id)}/text`, {
        method: "POST", body: JSON.stringify({ text: question }), signal: controller.signal,
      });
      if (pending.current !== controller) return;
      if (controller.signal.aborted) throw new Error("TEXT_REPLY_UNAVAILABLE");
      if (result && "route" in result && (result.route === "FIXED_RESOURCES" || result.route === "BLOCKED")) {
        session.current = null;
        setDraft("");
        setExchanges([]);
        if (result.route === "FIXED_RESOURCES") setResources(true);
        else setError("RESPONSE_NOT_PERMITTED");
        return;
      }
      if (!result || !("text" in result) || result.sessionId !== id ||
          typeof result.text !== "string" || !result.text.trim() || result.text.length > 8000)
        throw new Error("TEXT_REPLY_UNAVAILABLE");
      setExchanges((previous) => [...previous, { question, reply: result.text }]);
      setDraft("");
    } catch (cause) {
      if (pending.current !== controller) return;
      const code = controller.signal.aborted ? "TEXT_REPLY_UNAVAILABLE" : errorCode(cause);
      if (closedSessions.includes(code) || code === "CONSENT_REQUIRED") {
        const id = session.current?.sessionId;
        session.current = null;
        if (id) void requestChat(sessionPath(id), { method: "DELETE" }).catch(() => {});
        setExchanges([]);
        if (code === "CONSENT_REQUIRED") setAllowed(false);
      }
      setError(closedSessions.includes(code) && code !== "CHAT_TURN_LIMIT" ? "SESSION_EXPIRED" : code);
    } finally {
      clearTimeout(timeout);
      if (pending.current === controller) { pending.current = null; setBusy(false); }
    }
  };

  return (
    <>
      {!exchanges.length ? <Card soft><Copy>{chatContent.introduction}</Copy></Card> : null}
      <View style={styles.row}>
        <Button label="New chat" kind="text" onPress={reset} />
        {allowed ? <Button label="Revoke text permission" kind="text" disabled={checking} onPress={() => void changeConsent(false)} /> : null}
        <Button label="Sign out" kind="text" onPress={() => { reset(); signOut(); }} />
      </View>
      {checking ? <Copy kind="caption">Checking text permission…</Copy> : null}
      {!checking && allowed === null ? <Button label="Check text permission" onPress={() => { if (focus.current) void checkConsent(focus.current.signal); }} /> : null}
      {!checking && allowed === false ? <Button label="Allow text processing" kind="primary" onPress={() => setAsking(true)} /> : null}
      {asking ? (
        <Dialog title="Allow text processing?" onClose={() => setAsking(false)}>
          <Copy>MindGuard sends your message and up to three recent exchanges to OpenAI for a reply. MindGuard keeps this chat in memory during the session. OpenAI processes the text under its own data terms.</Copy>
          <Button label="Allow and continue" kind="primary" disabled={checking} onPress={() => void changeConsent(true)} />
        </Dialog>
      ) : null}
      {exchanges.map((exchange, index) => (
        <View key={index} style={styles.stack}>
          <Card><Copy kind="eyebrow">You</Copy><Copy>{exchange.question}</Copy></Card>
          <Card soft><Copy kind="eyebrow">Zen</Copy><Copy>{exchange.reply}</Copy></Card>
        </View>
      ))}
      {resources ? (
        <>
          <Notice>Zen paused this conversation. You can find support options in Resources.</Notice>
          <Button label="Open Resources" icon="book" onPress={() => router.push(route(11))} />
        </>
      ) : null}
      {error ? <Notice error>{textErrors[error] ?? "Zen couldn't complete the reply. Try again."}</Notice> : null}
      {busy ? <View accessibilityLiveRegion="polite"><Copy>Zen is thinking.</Copy></View> : null}
      {allowed ? (
        <>
          <Field label="Message Zen" value={draft} onChangeText={setDraft} multiline maxLength={8000} editable={!busy} />
          <Button label="Send" kind="primary" icon="send" disabled={busy || !draft.trim()} onPress={() => void send()} />
        </>
      ) : null}
    </>
  );
}
