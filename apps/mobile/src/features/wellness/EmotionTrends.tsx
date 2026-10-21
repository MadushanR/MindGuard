import { View } from "react-native";
import type { Observation } from "@mindguard/contracts";
import { Button, Card, Copy } from "../../shared/ui";
import { emotionColors, styles } from "../../shared/theme";
import { days, emotionCounts } from "./trends";

export function EmotionTrends({ observations, boundaries, day, onDay }: {
  observations: Observation[];
  boundaries: number[];
  day: number | null;
  onDay(day: number | null): void;
}) {
  const ranked = emotionCounts(observations).sort((a, b) => b.count - a.count);
  const leading = ranked.filter((item) => item.count > 0 && item.count === ranked[0].count);
  const daily = days.map((_, i) => observations.filter(
    (o) => o.createdAt >= boundaries[i] && o.createdAt < boundaries[i + 1],
  ));
  const maxCount = Math.max(1, ...daily.map((list) => list.length));
  return (
    <Card>
      <Copy kind="heading">Daily observation counts</Copy>
      <Copy>{observations.length} total observations</Copy>
      {leading.length ? (
        <Copy>
          Most frequent observation{leading.length > 1 ? "s" : ""}: {leading.map((item) => item.label).join(", ")} ({leading[0].count}{leading.length > 1 ? " each" : ""})
        </Copy>
      ) : null}
      <Copy kind="caption">
        Colors show emotion labels; bar size shows counts. Corrections replace
        estimates in this chart. Select a day to filter recent observations.
      </Copy>
      <View style={[styles.row, { alignItems: "flex-end", flexWrap: "nowrap", gap: 6 }]}>
        {daily.map((list, i) => {
          const counts = emotionCounts(list).filter((item) => item.count);
          return (
            <View key={days[i]} style={{ flex: 1, minWidth: 0, gap: 8 }}>
              <View accessible={false} style={{ height: 100, justifyContent: "flex-end" }}>
                {counts.map((item) => (
                  <View key={item.label} style={{
                    height: 100 * item.count / maxCount,
                    backgroundColor: emotionColors[item.label.toLowerCase() as keyof typeof emotionColors].chart,
                  }} />
                ))}
              </View>
              <View>
                <Copy kind="caption" center>{days[i][0]}</Copy>
                <Copy kind="caption" center>{list.length}</Copy>
              </View>
            </View>
          );
        })}
      </View>
      <Copy kind="caption">Filter recent observations by day</Copy>
      <View style={styles.row}>
        {days.map((label, i) => (
          <Button key={label} label={label} accessibilityLabel={`${label}: ${daily[i].length} observations`}
            selected={day === i} kind={day === i ? "primary" : "secondary"}
            onPress={() => onDay(day === i ? null : i)} />
        ))}
      </View>
      {daily.map((list, i) => list.length ? (
        <Copy key={days[i]} kind="caption">
          {days[i]}: {emotionCounts(list).filter((item) => item.count).map((item) => `${item.label} ${item.count}`).join(", ")}
        </Copy>
      ) : null)}
      <Button label="All days" kind={day === null ? "primary" : "secondary"} selected={day === null} onPress={() => onDay(null)} />
      <Copy kind="caption">
        Legend: Calm · Tense · Low · Hopeful. These observations are uncertain estimates, not diagnoses.
      </Copy>
    </Card>
  );
}
