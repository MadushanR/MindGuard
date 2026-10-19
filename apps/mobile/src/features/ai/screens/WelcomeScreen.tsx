import { router } from "expo-router";
import { View } from "react-native";
import { screenCopy } from "@mindguard/fixtures";
import { Page } from "../../../shared/Page";
import { Button, Card, Copy, Intro, ZenOrb } from "../../../shared/ui";
import { route } from "../../../shared/navigation";
export function WelcomeScreen() {
  const copy = screenCopy.welcome;
  return (
    <Page>
      <View style={{ paddingTop: 14, gap: 24 }}>
        <Intro {...copy} />
        <ZenOrb />
        <Card soft>
          <Copy kind="heading">A thought. A feeling. A moment.</Copy>
          <Copy kind="muted">
            Talk with Zen, notice your everyday patterns, and choose what you
            keep.
          </Copy>
        </Card>
        <Button
          label="Create account"
          kind="primary"
          onPress={() => router.push(route(2))}
        />
        <Button label="Sign in" onPress={() => router.push(route(3))} />
        <Copy kind="caption">{copy.note}</Copy>
      </View>
    </Page>
  );
}
