import { useState } from "react";
import { router } from "expo-router";
import { Pressable, View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import type { Recommendation } from "@mindguard/contracts";
import { recommendationCards, screenCopy } from "@mindguard/fixtures";
import { useAI } from "../AIProvider";
import { weeklyPattern } from "../domain";
import { Page } from "../../../shared/Page";
import {
  Button,
  Card,
  Copy,
  Dialog,
  Icon,
  Intro,
  MenuRow,
} from "../../../shared/ui";
import { colors, styles } from "../../../shared/theme";
import { route } from "../../../shared/navigation";
import { ResponsiveGrid } from "../../../shared/responsive";
function ResourceArt({ card }: { card: Recommendation }) {
  const palettes = {
    meadow: ["#E7EDD7", "#C0CEA7", "#91AC7F"],
    leaves: ["#E3EAD7", "#B3C6A0", "#79996F"],
    dunes: ["#F0E2D1", "#D6B79A", "#B88F73"],
    steps: ["#E9E7DA", "#CCD1B4", "#A3B38C"],
    dusk: ["#E4E5EF", "#BBC0D3", "#939FB9"],
    sunrise: ["#F1EDD3", "#DCD4AA", "#B7BE8C"],
  };
  const palette = palettes[card.artwork];
  return (
    <View
      accessible={false}
      style={{
        height: 150,
        overflow: "hidden",
        backgroundColor: palette[0],
        borderTopLeftRadius: 23,
        borderTopRightRadius: 23,
      }}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 340 150"
        preserveAspectRatio="xMidYMid slice"
      >
        <Rect width={340} height={150} fill={palette[0]} />
        <Circle cx={240} cy={47} r={33} fill="#F7F2CC" />
        <Path d="M-30 80 Q95 25 235 105 L390 160 H-30Z" fill={palette[1]} />
        <Path d="M90 175 Q220 55 370 65 L380 180Z" fill={palette[2]} />
      </Svg>
      <View
        style={{
          position: "absolute",
          left: "44%",
          top: "33%",
          width: 47,
          height: 47,
          borderRadius: 30,
          backgroundColor: "rgba(255,254,250,0.9)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={card.format === "Videos" ? "play" : "book"} />
      </View>
      <View
        style={{
          position: "absolute",
          bottom: 12,
          right: 12,
          backgroundColor: colors.card,
          borderRadius: 7,
          paddingHorizontal: 8,
          paddingVertical: 3,
        }}
      >
        <Copy kind="caption">{card.duration}</Copy>
      </View>
    </View>
  );
}
export function RecommendationsScreen() {
  const ai = useAI(),
    [filter, setFilter] = useState<"All" | "Videos" | "Guides">("All"),
    [selected, setSelected] = useState<Recommendation | null>(null);
  const pattern = weeklyPattern(ai.observations),
    primary = pattern.ranked[0];
  const ranked = pattern.total
    ? pattern.ranked.flatMap((p) =>
        recommendationCards.filter((c) => c.emotion === p.label),
      )
    : recommendationCards.filter((c) => c.emotion === null);
  const cards = ranked.filter((c) => filter === "All" || c.format === filter);
  const reason = (card: Recommendation) =>
    card.emotion && pattern.total
      ? `${card.emotion} appeared in ${pattern.ranked.find((p) => p.label === card.emotion)?.count ?? 0} of your ${pattern.total} observations this week.`
      : screenCopy.recommendations.general;
  return (
    <Page wide>
      <Intro {...screenCopy.recommendations} />
      <Card soft>
        <View style={styles.row}>
          <Icon name="spark" />
          <Copy kind="heading">
            {primary
              ? `${primary.label} showed up most often.`
              : "Let us find your rhythm."}
          </Copy>
        </View>
        <Copy kind="muted">
          {pattern.total
            ? `Based on ${pattern.total} emotion observations this week.`
            : "Your weekly patterns will shape this space as you talk with Zen."}
        </Copy>
        <Button
          label="Review your patterns"
          kind="text"
          onPress={() => router.push(route(9))}
        />
      </Card>
      <View style={styles.row}>
        {(["All", "Videos", "Guides"] as const).map((value) => (
          <View key={value} style={{ flex: 1 }}>
            <Button
              label={value === "All" ? "All for you" : value}
              kind={filter === value ? "primary" : "secondary"}
              onPress={() => setFilter(value)}
            />
          </View>
        ))}
      </View>
      <View style={styles.spread}>
        <Copy kind="heading">
          {primary ? "A good place to begin" : "Something to explore"}
        </Copy>
        <Copy kind="caption">{cards.length} suggestions</Copy>
      </View>
      {cards.length ? (
        <ResponsiveGrid>
          {cards.map((card, i) => (
            <Pressable
              key={card.id}
              accessibilityRole="button"
              accessibilityLabel={`Explore ${card.title}`}
              onPress={() => setSelected(card)}
              style={({ pressed }) => [
                {
                  borderRadius: 24,
                  borderWidth: 1,
                  borderColor: "#A6BC95",
                  backgroundColor: colors.card,
                  opacity: pressed ? 0.8 : 1,
                  overflow: "hidden",
                },
              ]}
            >
              <ResourceArt card={card} />
              <View style={{ padding: 18, gap: 11 }}>
                <Copy kind="caption">
                  {card.format === "Videos" ? "Illustrative video" : "Guide"}
                </Copy>
                <Copy kind="heading">{card.title}</Copy>
                {i === 0 ? <Copy kind="muted">{card.description}</Copy> : null}
                <Copy kind="caption">{reason(card)}</Copy>
                <View style={styles.divider} />
                <View style={styles.spread}>
                  <Copy kind="caption">
                    Explore {card.format === "Videos" ? "video" : "guide"}
                  </Copy>
                  <Icon name="arrow" size={15} />
                </View>
              </View>
            </Pressable>
          ))}
        </ResponsiveGrid>
      ) : (
        <Copy kind="muted">{screenCopy.recommendations.empty}</Copy>
      )}
      <Copy kind="caption">
        {pattern.estimated
          ? "Suggestions include uncertain emotion estimates. You can correct or dismiss them in Trends."
          : "Suggestions follow your weekly observations. These are illustrative resources."}
      </Copy>
      {selected ? (
        <Dialog title={selected.title} onClose={() => setSelected(null)}>
          <ResourceArt card={selected} />
          <Copy>{selected.description}</Copy>
          <Card soft>
            <Copy kind="heading">Why this is here</Copy>
            <Copy kind="muted">{reason(selected)}</Copy>
          </Card>
          <Copy>{selected.detail}</Copy>
          <Button
            label="Back to recommendations"
            kind="primary"
            onPress={() => setSelected(null)}
          />
          <MenuRow
            label="Review emotion trends"
            onPress={() => {
              setSelected(null);
              router.push(route(9));
            }}
          />
        </Dialog>
      ) : null}
    </Page>
  );
}
