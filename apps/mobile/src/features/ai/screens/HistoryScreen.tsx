import { useState } from "react";
import { router } from "expo-router";
import { View } from "react-native";
import { screenCopy } from "@mindguard/fixtures";
import { useAI } from "../AIProvider";
import { Page } from "../../../shared/Page";
import {
  Button,
  Card,
  Copy,
  Dialog,
  Intro,
  MenuRow,
  Toggle,
} from "../../../shared/ui";
import { route } from "../../../shared/navigation";
import { styles } from "../../../shared/theme";
export function HistoryScreen() {
  const ai = useAI(),
    copy = screenCopy.history,
    [deleting, setDeleting] = useState<string[] | null>(null),
    [emotions, setEmotions] = useState(true),
    [memories, setMemories] = useState(true);
  const requestDelete = (ids: string[]) => {
    setEmotions(true);
    setMemories(true);
    setDeleting(ids);
  };
  return (
    <Page>
      <Intro {...copy} />
      <View style={styles.stack}>
        <Button
          label="New conversation"
          kind="primary"
          onPress={() => {
            ai.newConversation();
            router.push(route(6));
          }}
        />
        <Button
          label="Temporary chat"
          icon="lock"
          onPress={() => {
            ai.newConversation(true);
            router.push(route(6));
          }}
        />
      </View>
      <MenuRow
        label="History and auto-delete"
        description={
          ai.model.saved.preferences.saveHistory
            ? "Saving is on"
            : "Saving is off"
        }
        onPress={() => router.push(route(23))}
      />
      {ai.model.saved.conversations.length ? (
        <>
          <Copy kind="heading">Saved conversations</Copy>
          {[...ai.model.saved.conversations]
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .map((c) => (
              <Card key={c.id}>
                <Copy kind="eyebrow">
                  {new Date(c.createdAt).toLocaleDateString("en-CA")} ·{" "}
                  {c.messages.length} messages
                </Copy>
                <Copy kind="heading">{c.title}</Copy>
                <Copy kind="muted">{c.messages.at(-1)?.text}</Copy>
                <Button
                  label={`Continue: ${c.title}`}
                  kind="text"
                  onPress={() => {
                    ai.openConversation(c.id);
                    router.push(route(6));
                  }}
                />
                <Button
                  label="Delete conversation"
                  kind="danger"
                  onPress={() => requestDelete([c.id])}
                />
              </Card>
            ))}
          <Button
            label="Delete all conversations"
            kind="danger"
            onPress={() =>
              requestDelete(ai.model.saved.conversations.map((c) => c.id))
            }
          />
        </>
      ) : (
        <Card>
          <Copy kind="heading">{copy.empty}</Copy>
          <Copy kind="muted">{copy.emptyDescription}</Copy>
        </Card>
      )}
      <MenuRow
        label="What Zen remembers"
        onPress={() => router.push(route(24))}
      />
      {deleting ? (
        <Dialog
          title={
            deleting.length === 1
              ? "Delete this conversation?"
              : "Delete all conversations?"
          }
          onClose={() => setDeleting(null)}
        >
          <Copy>{screenCopy.common.deleteConversation}</Copy>
          <Toggle
            label="Also delete linked emotion observations"
            value={emotions}
            onChange={setEmotions}
          />
          <Toggle
            label="Also delete linked remembered details"
            value={memories}
            onChange={setMemories}
          />
          <Copy kind="caption">
            Unchecked information stays in Trends or What Zen remembers.
          </Copy>
          <Button
            label="Delete permanently"
            kind="danger"
            onPress={() => {
              ai.deleteConversations(deleting, emotions, memories);
              setDeleting(null);
            }}
          />
        </Dialog>
      ) : null}
    </Page>
  );
}
