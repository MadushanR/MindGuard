import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { route } from "./navigation";
import { colors, styles } from "./theme";
import { Copy, Icon, MenuRow } from "./ui";

const groups = [
  {
    title: "YOUR SPACE",
    items: [
      [5, "Home", "home"],
      [21, "For you", "spark"],
      [9, "Trends", "trend"],
    ],
  },
  {
    title: "CONVERSATIONS",
    items: [
      [6, "Talk with Zen", "chat"],
      [7, "Voice conversation", "mic"],
      [22, "Saved conversations", "book"],
      [24, "Remembered details", "leaf"],
    ],
  },
  {
    title: "YOUR CHOICES",
    items: [
      [8, "Voice tone settings", "volume"],
      [23, "Conversation preferences", "settings"],
    ],
  },
] as const;

export function DesktopNavigation({ path }: { path: string }) {
  return (
    <View
      role="navigation"
      accessibilityLabel="Main navigation"
      testID="desktop-navigation"
      style={local.sidebar}
    >
      <View style={local.brand}>
        <Icon name="leaf" size={28} />
        <Text style={[styles.heading, { letterSpacing: -0.6 }]}>MindGuard</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 30 }}>
        {groups.map((group) => (
          <View key={group.title} style={{ gap: 10 }}>
            <Copy kind="eyebrow">{group.title}</Copy>
            {group.items.map(([id, label, icon]) => (
              <View
                key={id}
                style={[
                  local.item,
                  path === route(id) && { backgroundColor: colors.sage },
                ]}
              >
                <MenuRow
                  label={label}
                  icon={icon}
                  selected={path === route(id)}
                  onPress={() => router.navigate(route(id))}
                />
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const local = StyleSheet.create({
  sidebar: {
    width: 240,
    borderRightWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  brand: {
    minHeight: 88,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  item: { borderRadius: 14, paddingHorizontal: 12 },
});
