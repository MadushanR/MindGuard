import { router } from "expo-router";
import { screenCopy } from "@mindguard/fixtures";
import { useAI } from "../AIProvider";
import { Page } from "../../../shared/Page";
import { Button, Card, Copy, Intro, Toggle } from "../../../shared/ui";
import { route } from "../../../shared/navigation";
export function ToneScreen() {
  const ai = useAI(),
    copy = screenCopy.tone;
  return (
    <Page>
      <Intro {...copy} />
      <Card soft>
        <Copy kind="heading">You know yourself best.</Copy>
        <Copy kind="muted">{copy.note}</Copy>
      </Card>
      <Toggle
        label="Allow optional tone analysis"
        value={ai.consent.tone}
        disabled={!ai.consent.voice}
        onChange={(v) => ai.setConsent("tone", v)}
        description="Separate from voice permission. You can confirm, correct, or dismiss observations."
      />
      {!ai.consent.voice ? (
        <Copy kind="caption">
          Start a voice simulation and grant its separate permission before
          enabling tone feedback.
        </Copy>
      ) : null}
      <Copy kind="caption">
        Changes save locally. Temporary conversations never create tone
        observations.
      </Copy>
      <Button
        label="Return to voice"
        kind="primary"
        onPress={() => router.push(route(7))}
      />
      <Button
        label="View emotion trends"
        onPress={() => router.push(route(9))}
      />
    </Page>
  );
}
