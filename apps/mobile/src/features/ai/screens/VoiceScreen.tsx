import { useState } from "react";
import { router } from "expo-router";
import { View } from "react-native";
import { screenCopy, voiceContent } from "@mindguard/fixtures";
import { useAI } from "../AIProvider";
import { ObservationCard } from "../ObservationCard";
import { Page } from "../../../shared/Page";
import { Button, Copy, Dialog, Notice, ZenOrb } from "../../../shared/ui";
import { route } from "../../../shared/navigation";
import { styles } from "../../../shared/theme";
export function VoiceScreen() {
  const ai = useAI(),
    [consenting, setConsenting] = useState(false),
    state = ai.model.voiceState,
    copy = screenCopy.voice;
  const active = !["ready", "stopped", "error"].includes(state),
    temporary = ai.model.active?.temporary;
  const observations = ai.observations
    .filter(
      (o) =>
        o.source === "Voice tone" &&
        o.conversationId === ai.model.active?.id &&
        !o.dismissed,
    )
    .slice(-1);
  const start = () => {
    if (!ai.consent.voice) setConsenting(true);
    else ai.startVoice();
  };
  return (
    <Page>
      <Copy kind="caption">
        {temporary
          ? "Temporary conversation · no saved history, observations, or memories"
          : `Audio is not captured · transcript saving ${ai.model.active?.saveVoiceTranscripts ? "on" : "off"}`}
      </Copy>
      <Copy kind="eyebrow" center>
        {copy.eyebrow}
      </Copy>
      <ZenOrb state={state} />
      <View style={{ gap: 12 }}>
        <Copy kind="title" center>
          {state === "ready" ? copy.title : voiceContent.statusText[state]}
        </Copy>
        <Copy kind="muted" center>
          {copy.description}
        </Copy>
        <View accessibilityLiveRegion="polite">
          <Copy kind="muted" center>
            {state.toUpperCase()} · microphone off
          </Copy>
        </View>
      </View>
      <Notice>{copy.simulation}</Notice>
      {active && !["reconnecting"].includes(state) ? (
        <>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Button
                label={state === "muted" ? "Unmute" : "Mute"}
                icon={state === "muted" ? "mic" : "muted"}
                onPress={ai.muteVoice}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Stop" icon="stop" onPress={ai.stopVoice} />
            </View>
          </View>
          {state === "speaking" ? (
            <Button label="Interrupt Zen" onPress={ai.interruptVoice} />
          ) : null}
        </>
      ) : state === "reconnecting" || state === "error" ? (
        <Button
          label={state === "error" ? "Try voice again" : "Reconnect"}
          kind="primary"
          onPress={ai.reconnectVoice}
        />
      ) : (
        <Button
          label="Start voice conversation"
          icon="mic"
          kind="primary"
          onPress={start}
        />
      )}
      {state !== "ready" ? (
        <Button
          label="End conversation"
          kind="text"
          onPress={() => {
            ai.stopVoice();
            ai.leave();
            router.push(route(22));
          }}
        />
      ) : null}
      <Button
        label="Switch to text"
        icon="chat"
        onPress={() => {
          ai.stopVoice();
          router.replace(route(6));
        }}
      />
      <Copy kind="caption">
        Tone feedback{" "}
        {temporary
          ? "off in temporary conversations"
          : ai.consent.tone
            ? "on"
            : "off"}
      </Copy>
      <Button
        label="Tone settings"
        kind="text"
        onPress={() => router.push(route(8))}
      />
      {observations.map((o) => (
        <ObservationCard key={o.id} observation={o} />
      ))}
      {consenting ? (
        <Dialog
          title="Simulate voice processing?"
          onClose={() => setConsenting(false)}
        >
          <Copy>
            This frontend simulates a voice conversation. It never requests your
            microphone or records audio. Tone feedback is a separate choice.
          </Copy>
          <Button
            label="Allow voice simulation"
            kind="primary"
            onPress={() => {
              ai.setConsent("voice", true);
              setConsenting(false);
              ai.startVoice();
            }}
          />
        </Dialog>
      ) : null}
    </Page>
  );
}
