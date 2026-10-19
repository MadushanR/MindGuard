import { router } from "expo-router";
import { View } from "react-native";
import { screenCopy } from "@mindguard/fixtures";
import { Page } from "../../../shared/Page";
import { Button, Card, Copy, Intro, ZenOrb } from "../../../shared/ui";
import { route } from "../../../shared/navigation";
import { useBrowserLayout } from "../../../shared/responsive";
export function WelcomeScreen() {
  const { desktop } = useBrowserLayout();
  const copy = screenCopy.welcome;
  const reflection = (
    <Card soft>
      <Copy kind="heading">A thought. A feeling. A moment.</Copy>
      <Copy kind="muted">
        Talk with Zen, notice your everyday patterns, and choose what you keep.
      </Copy>
    </Card>
  );
  const actions = (
    <View style={{ gap: 24 }}>
      <Button
        label="Create account"
        kind="primary"
        onPress={() => router.push(route(2))}
      />
      <Button label="Sign in" onPress={() => router.push(route(3))} />
      <Copy kind="caption">{copy.note}</Copy>
    </View>
  );
  if (desktop)
    return (
      <Page wide>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 64,
            paddingVertical: 64,
          }}
        >
          <View style={{ flex: 1, gap: 32 }}>
            <Intro {...copy} />
            {actions}
          </View>
          <View style={{ flex: 1, gap: 32 }}>
            <ZenOrb />
            {reflection}
          </View>
        </View>
      </Page>
    );
  return (
    <Page>
      <View style={{ paddingTop: 14, gap: 24 }}>
        <Intro {...copy} />
        <ZenOrb />
        {reflection}
        {actions}
      </View>
    </Page>
  );
}
