import { useState } from "react";
import { router } from "expo-router";
import { View } from "react-native";
import { LiveAccountForm } from "../live/LiveAccountForm";
import { useLiveVoice } from "../live/LiveVoiceProvider";
import { voiceErrorCopy } from "../live/copy";
import { Page } from "../../../shared/Page";
import { Button, Copy, Dialog, Notice, ZenOrb } from "../../../shared/ui";
import { route } from "../../../shared/navigation";
import { styles } from "../../../shared/theme";

const status = {
  ready: "Talk with Zen", connecting: "Connecting to Zen", listening: "I'm listening",
  processing: "Thinking about your words", speaking: "Zen is speaking", muted: "Microphone muted",
  reconnecting: "Reconnecting to Zen", stopped: "Voice has stopped", error: "Voice is paused",
};
export function VoiceScreen() {
  const voice = useLiveVoice();
  const [working, setWorking] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [consenting, setConsenting] = useState(false);
  const state = voice.update.state;
  const active = !["ready", "stopped", "error"].includes(state);
  const perform = async (action: () => Promise<unknown>) => {
    setWorking(true);
    setLocalError(null);
    try { await action(); }
    catch (error) { setLocalError(error instanceof Error ? error.message : "VOICE_FAILED"); }
    finally { setWorking(false); }
  };
  return (
    <Page>
      <Copy kind="caption">Live voice · audio and transcripts are not saved to your history</Copy>
      <Copy kind="eyebrow" center>A little room to breathe.</Copy>
      <ZenOrb state={state === "connecting" ? "reconnecting" : state} />
      <View style={{ gap: 12 }} accessibilityLiveRegion="polite">
        <Copy kind="title" center>{status[state]}</Copy>
        <Copy kind="muted" center>Speak naturally. Zen waits for your turn to finish. You can interrupt at any time.</Copy>
        <Copy kind="caption" center>{voice.update.microphoneActive ? "Microphone on" : "Microphone off"}</Copy>
      </View>
      {voice.update.recovered && active ? <Notice>Voice reconnected. Zen may need you to repeat earlier details.</Notice> : null}
      {!voice.signedIn ? (
        <LiveAccountForm conversation="voice" />
      ) : (
        <>
          {voice.consent === null ? <Button label="Check voice permission" onPress={() => void perform(voice.refreshConsent)} disabled={working} /> : null}
          {!active ? (
            <Button label={state === "error" ? "Try voice again" : "Start voice conversation"} icon="mic" kind="primary" disabled={working || voice.consent === null} onPress={() => { if (voice.consent) void voice.start(); else setConsenting(true); }} />
          ) : (
            <View style={styles.row}>
              <View style={{ flex: 1 }}><Button label={state === "muted" ? "Unmute" : "Mute"} icon={state === "muted" ? "mic" : "muted"} onPress={() => void perform(async () => voice.mute(state !== "muted"))} disabled={working || state === "reconnecting"} /></View>
              <View style={{ flex: 1 }}><Button label="Stop" icon="stop" onPress={voice.stop} /></View>
            </View>
          )}
          {["speaking", "processing"].includes(state) ? <Button label="Interrupt Zen" onPress={voice.interrupt} /> : null}
          {voice.consent !== false ? <Button label="Revoke voice permission" kind="text" onPress={() => void perform(() => voice.setVoiceConsent(false))} disabled={working} /> : null}
          <Button label="Sign out" kind="text" onPress={voice.logout} />
        </>
      )}
      {voice.update.resourceRoute ? (
        <Notice>Voice has paused. You can open Resources or switch to text.</Notice>
      ) : (localError || (voice.signedIn && voice.error) || voice.update.error) ? (
        <Notice error>{voiceErrorCopy(localError || voice.error || voice.update.error)}</Notice>
      ) : null}
      {voice.update.resourceRoute ? <Button label="Open Resources" icon="book" onPress={() => router.push(route(11))} /> : null}
      <Button label="Switch to text" icon="chat" disabled={working} onPress={() => void perform(async () => { await voice.switchToText(); router.replace(route(6)); })} />
      <Copy kind="caption">Tone feedback and wearable processing are off for this voice conversation. Zen is a wellness companion and does not provide emergency monitoring.</Copy>
      {consenting ? (
        <Dialog title="Allow voice processing?" onClose={() => setConsenting(false)}>
          <Copy>Your microphone audio is sent through the MindGuard relay to OpenAI for transcription and replies. MindGuard does not save recordings or live transcripts. OpenAI processing is subject to its own data-retention terms. Tone analysis and notifications are not enabled.</Copy>
          <Button label="Allow voice processing" kind="primary" disabled={working} onPress={() => void perform(async () => { await voice.setVoiceConsent(true); setConsenting(false); })} />
          <Copy kind="caption">After allowing, press Start voice conversation to enable your microphone.</Copy>
        </Dialog>
      ) : null}
    </Page>
  );
}
