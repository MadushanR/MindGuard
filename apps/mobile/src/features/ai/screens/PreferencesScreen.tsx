import { useState } from "react";
import { router } from "expo-router";
import { View } from "react-native";
import type { Retention } from "@mindguard/contracts";
import { screenCopy } from "@mindguard/fixtures";
import { useAI } from "../AIProvider";
import { expiredIds } from "../domain";
import { Page } from "../../../shared/Page";
import {
  Button,
  Card,
  Copy,
  Dialog,
  Intro,
  MenuRow,
  Notice,
  Toggle,
} from "../../../shared/ui";
import { route } from "../../../shared/navigation";
import { styles } from "../../../shared/theme";
export function PreferencesScreen() {
  const ai = useAI(),
    [draft, setDraft] = useState(ai.model.saved.preferences),
    [error, setError] = useState(""),
    [confirming, setConfirming] = useState(false),
    [saved, setSaved] = useState(false);
  const commit = () => {
    ai.savePreferences(draft);
    setConfirming(false);
    setError("");
    setSaved(true);
  };
  const save = () => {
    setSaved(false);
    if (draft.saveHistory && draft.retentionDays === null) {
      setError("Choose when saved conversations should be deleted.");
      return;
    }
    if (expiredIds(ai.model.saved, draft.retentionDays).length)
      setConfirming(true);
    else commit();
  };
  return (
    <Page>
      <Intro {...screenCopy.preferences} />
      <Card>
        <Toggle
          label="Save conversation history"
          value={draft.saveHistory}
          onChange={(v) => {
            setDraft({ ...draft, saveHistory: v });
            setSaved(false);
          }}
          description="Keep new conversations so you can return to them."
        />
        <Copy kind="heading">Auto-delete</Copy>
        <View style={styles.stack}>
          {(
            [
              [7, "After 7 days"],
              [30, "After 30 days"],
              [90, "After 90 days"],
              ["manual", "Until I delete them"],
            ] as [Retention, string][]
          ).map(([value, label]) => (
            <Toggle
              key={String(value)}
              label={label}
              value={draft.retentionDays === value}
              onChange={() => {
                setDraft({ ...draft, retentionDays: value });
                setSaved(false);
              }}
            />
          ))}
        </View>
        <Copy kind="caption">{screenCopy.preferences.note}</Copy>
      </Card>
      <Card>
        <Copy kind="heading">Voice, on your terms.</Copy>
        <Copy kind="muted">Audio recordings are never captured or saved.</Copy>
        <Toggle
          label="Include voice transcripts in saved history"
          disabled={!draft.saveHistory}
          value={draft.saveVoiceTranscripts}
          onChange={(v) => {
            setDraft({ ...draft, saveVoiceTranscripts: v });
            setSaved(false);
          }}
          description="Requires saved history. Temporary conversations never save transcripts."
        />
      </Card>
      {error ? <Notice error>{error}</Notice> : null}
      {saved ? (
        <Notice>
          {ai.writeError
            ? "Preferences changed, but could not be saved. Use Retry saving above."
            : ai.saving
              ? "Saving your preferences…"
              : "Conversation preferences saved on this device."}
        </Notice>
      ) : null}
      <Copy kind="caption">
        Changes apply to new conversations. Turning saving off keeps existing
        history until you delete it or it expires.
      </Copy>
      <Button
        label="Save conversation preferences"
        kind="primary"
        onPress={save}
      />
      <Card soft>
        <Copy kind="heading">A conversation just for now.</Copy>
        <Copy kind="muted">
          Temporary chats leave no saved conversation, observations, or
          remembered details.
        </Copy>
        <Button
          label="Start temporary chat"
          onPress={() => {
            ai.newConversation(true);
            router.push(route(6));
          }}
        />
      </Card>
      <MenuRow
        label="Conversation history"
        onPress={() => router.push(route(22))}
      />
      <MenuRow
        label="What Zen remembers"
        onPress={() => router.push(route(24))}
      />
      <MenuRow
        label="Emotion observation permissions"
        onPress={() => router.push(route(16))}
      />
      {confirming ? (
        <Dialog
          title="Apply this auto-delete period?"
          onClose={() => setConfirming(false)}
        >
          <Copy>
            {expiredIds(ai.model.saved, draft.retentionDays).length} existing
            conversation(s) will be removed now, together with linked
            observations and remembered details.
          </Copy>
          <Button label="Apply and delete" kind="danger" onPress={commit} />
        </Dialog>
      ) : null}
    </Page>
  );
}
