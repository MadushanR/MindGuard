import { useState } from "react";
import { router } from "expo-router";
import { View } from "react-native";
import { Page } from "../../../shared/Page";
import { Button, Card, Copy, Field, Notice } from "../../../shared/ui";
import { route } from "../../../shared/navigation";
import { useLiveVoice } from "./LiveVoiceProvider";
import { voiceErrorCopy } from "./copy";

export function VoiceTextScreen() {
  const voice = useLiveVoice();
  const [draft, setDraft] = useState("");
  return (
    <Page>
      <Copy kind="eyebrow">Continue with Zen</Copy>
      <Copy kind="title">A little space for your words.</Copy>
      <Notice>This text handoff is temporary. Only the last few completed turns are kept in memory. Nothing here is saved to history.</Notice>
      {voice.handoff?.messages.map((message, index) => (
        <Card key={`${index}-${message.role}`} soft={message.role === "assistant"}>
          <Copy kind="caption">{message.role === "user" ? "You" : "Zen"}</Copy>
          <Copy>{message.content}</Copy>
        </Card>
      ))}
      {voice.busy ? <View accessibilityLiveRegion="polite"><Copy>Zen is thinking…</Copy></View> : null}
      {voice.update.resourceRoute ? (
        <>
          <Notice>Voice has paused. You can open Resources.</Notice>
          <Button label="Open Resources" icon="book" onPress={() => router.push(route(11))} />
        </>
      ) : voice.error ? <Notice error>{voiceErrorCopy(voice.error)}</Notice> : null}
      {voice.handoff ? (
        <>
          <Field label="Message to Zen" value={draft} onChangeText={setDraft} multiline maxLength={8000} editable={!voice.busy} />
          <Button label="Send to Zen" kind="primary" disabled={voice.busy || !draft.trim()} onPress={() => {
            const text = draft;
            void voice.sendText(text).then((sent) => { if (sent) setDraft(""); });
          }} />
        </>
      ) : <Copy>This temporary session has ended. Return to voice to start again.</Copy>}
      <Button label="Return to voice" icon="mic" onPress={() => { voice.clearHandoff(); router.replace(route(7)); }} />
      <Button label="End temporary conversation" kind="text" onPress={() => { voice.clearHandoff(); router.replace(route(5)); }} />
    </Page>
  );
}
