import { useState } from "react";
import { router } from "expo-router";
import { screenCopy } from "@mindguard/fixtures";
import { useAI } from "../AIProvider";
import { Page } from "../../../shared/Page";
import { Button, Card, Copy, Dialog, Intro, MenuRow } from "../../../shared/ui";
import { route } from "../../../shared/navigation";
import { ResponsiveGrid } from "../../../shared/responsive";
export function MemoriesScreen() {
  const ai = useAI(),
    copy = screenCopy.memories,
    [removing, setRemoving] = useState<string | null>(null);
  return (
    <Page wide>
      <Intro {...copy} />
      {ai.model.saved.memories.length ? (
        <ResponsiveGrid>
          {ai.model.saved.memories.map((m) => (
            <Card key={m.id}>
              <Copy>{m.text}</Copy>
              <Copy kind="caption">
                Added by you ·{" "}
                {m.conversationId
                  ? "Linked to a conversation"
                  : "Personal preference"}
              </Copy>
              <Button
                label="Remove detail"
                kind="danger"
                onPress={() => setRemoving(m.id)}
              />
            </Card>
          ))}
        </ResponsiveGrid>
      ) : (
        <Card>
          <Copy kind="heading">{copy.empty}</Copy>
          <Copy kind="muted">{copy.emptyDescription}</Copy>
        </Card>
      )}
      <MenuRow
        label="Review emotion observations"
        onPress={() => router.push(route(9))}
      />
      <MenuRow
        label="Conversation history"
        onPress={() => router.push(route(22))}
      />
      {removing ? (
        <Dialog
          title="Remove this remembered detail?"
          onClose={() => setRemoving(null)}
        >
          <Copy>{screenCopy.common.deleteMemory}</Copy>
          <Button
            label="Remove permanently"
            kind="danger"
            onPress={() => {
              ai.removeMemory(removing);
              setRemoving(null);
            }}
          />
        </Dialog>
      ) : null}
    </Page>
  );
}
