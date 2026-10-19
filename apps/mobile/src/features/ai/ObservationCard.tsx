import { useState } from "react";
import { View } from "react-native";
import type { Emotion, Observation } from "@mindguard/contracts";
import { useAI } from "./AIProvider";
import { effectiveEmotion } from "./domain";
import { Button, Card, Copy, EmotionBadge } from "../../shared/ui";
import { styles } from "../../shared/theme";
export function ObservationCard({ observation }: { observation: Observation }) {
  const ai = useAI(),
    [correcting, setCorrecting] = useState(false);
  return (
    <Card>
      <Copy kind="caption">
        {observation.source} · estimated confidence{" "}
        {Math.round(observation.confidence * 100)}%
      </Copy>
      <EmotionBadge
        label={effectiveEmotion(observation)}
        status={observation.status}
      />
      <Copy kind="muted">
        Does this sound right? This is an uncertain estimate.
      </Copy>
      {observation.correctedLabel ? (
        <Copy kind="caption">
          Original estimate: {observation.predictedLabel}
        </Copy>
      ) : null}
      <View style={styles.row}>
        <Button
          label="Confirm"
          onPress={() => ai.confirmObservation(observation.id)}
          kind="text"
        />
        <Button
          label="Correct"
          onPress={() => setCorrecting(!correcting)}
          kind="text"
        />
        <Button
          label="Dismiss"
          onPress={() => ai.dismissObservation(observation.id)}
          kind="text"
        />
      </View>
      {correcting ? (
        <View style={styles.row}>
          {(["Calm", "Tense", "Low", "Hopeful"] as Emotion[]).map((label) => (
            <Button
              key={label}
              label={label}
              onPress={() => {
                ai.correctObservation(observation.id, label);
                setCorrecting(false);
              }}
            />
          ))}
        </View>
      ) : null}
    </Card>
  );
}
