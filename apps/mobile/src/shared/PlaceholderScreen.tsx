import { router } from "expo-router";
import type { ScreenId } from "@mindguard/contracts";
import { Page } from "./Page";
import { Button, Card, Copy, Intro } from "./ui";
import { destination, route } from "./navigation";
export function PlaceholderScreen({ id }: { id: ScreenId }) {
  const screen = destination(id);
  return (
    <Page>
      <Intro
        eyebrow={`SCREEN ${String(id).padStart(2, "0")} · TEAM PLACEHOLDER`}
        title={screen.title}
        description={`${screen.owner} owns this screen. Its implementation will replace this placeholder.`}
      />
      <Card soft>
        <Copy>
          This destination is registered so the team can build and combine pages
          independently.
        </Copy>
        <Copy kind="caption">
          No account, device, privacy, or sharing operation is performed here.
        </Copy>
      </Card>
      <Button
        label="Back to Welcome"
        onPress={() => router.replace(route(1))}
      />
      <Button
        label="Conversation history"
        onPress={() => router.push(route(22))}
      />
      <Button label="For you" onPress={() => router.push(route(21))} />
    </Page>
  );
}
