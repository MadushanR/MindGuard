import { useState } from "react";
import { router } from "expo-router";
import { Page } from "../../../shared/Page";
import { Button, Card, Copy, Field, Notice } from "../../../shared/ui";
import { useLiveVoice } from "./LiveVoiceProvider";
import { voiceErrorCopy } from "./copy";

type Conversation = "chat" | "voice";
const accountErrors = new Set([
  "ACCOUNT_CONFIRMATION_REQUIRED",
  "ACCOUNT_CHALLENGE_REQUIRED",
  "CONFIRMATION_CODE_INVALID",
]);

export function LiveSignInPage({ conversation }: { conversation: Conversation }) {
  return (
    <Page>
      <LiveAccountForm conversation={conversation} />
    </Page>
  );
}

export function LiveAccountForm({ conversation }: { conversation: Conversation }) {
  const { signIn, confirm, busy } = useLiveVoice();
  const [confirming, setConfirming] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showConfirmation = (value: boolean) => {
    setConfirming(value);
    setPassword("");
    setCode("");
    setError(null);
  };
  const submit = async () => {
    setWorking(true);
    setError(null);
    try {
      if (confirming) {
        await confirm(email, code);
        showConfirmation(false);
      } else {
        await signIn(email, password, conversation);
      }
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : "";
      if (reason === "ACCOUNT_CONFIRMATION_REQUIRED") showConfirmation(true);
      const fallback = confirming
        ? "Email confirmation was unsuccessful. Check your details and try again."
        : voiceErrorCopy("VOICE_SIGN_IN_FAILED");
      setError(accountErrors.has(reason) ? voiceErrorCopy(reason) : fallback);
    } finally {
      setPassword("");
      setWorking(false);
    }
  };

  const disabled = working || busy;
  return (
    <Card>
      <Copy kind="heading">{confirming ? "Confirm your email" : "Sign in to MindGuard"}</Copy>
      <Copy>{confirming ? "Enter the confirmation code sent to your email." : "One account gives you access to live chat and voice."}</Copy>
      <Field label="Email address" value={email} onChangeText={setEmail} editable={!disabled} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" />
      {confirming ? (
        <Field label="Email confirmation code" value={code} onChangeText={setCode} editable={!disabled} keyboardType="number-pad" autoComplete="one-time-code" />
      ) : (
        <Field label="Password" value={password} onChangeText={setPassword} editable={!disabled} secureTextEntry autoCapitalize="none" autoComplete="current-password" />
      )}
      {error ? <Notice error>{error}</Notice> : null}
      <Button label={confirming ? "Confirm email" : "Sign in"} kind="primary" disabled={disabled || !email.trim() || !(confirming ? code.trim() : password)} onPress={() => void submit()} />
      {confirming ? (
        <Button label="Back to sign in" kind="text" disabled={disabled} onPress={() => showConfirmation(false)} />
      ) : (
        <>
          <Button label="I have a confirmation code" kind="text" disabled={disabled} onPress={() => showConfirmation(true)} />
          <Button label="Forgot password?" kind="text" disabled={disabled} onPress={() => router.push("/account-recovery")} />
          <Button label="Create account" kind="text" disabled={disabled} onPress={() => router.push({ pathname: "/create-account", params: { from: conversation } })} />
        </>
      )}
    </Card>
  );
}
