import tokens from "../../../../docs/design/tokens.json";
import { StyleSheet } from "react-native";
export const colors = tokens.colors;
export const emotionColors = tokens.emotionColors;
export const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  spread: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  stack: { gap: 12 },
  card: {
    padding: 20,
    borderRadius: 24,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 12,
  },
  soft: { backgroundColor: colors["soft-card"] },
  title: {
    color: colors.ink,
    fontSize: 31,
    fontWeight: "500",
    lineHeight: 38,
    letterSpacing: -0.7,
  },
  heading: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: "600",
    lineHeight: 27,
  },
  body: { color: colors.ink, fontSize: 14, lineHeight: 23 },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 21 },
  caption: { color: colors.muted, fontSize: 11, lineHeight: 18 },
  eyebrow: {
    color: colors.teal,
    fontSize: 10,
    lineHeight: 17,
    fontWeight: "600",
    letterSpacing: 1.7,
  },
  field: {
    minHeight: 49,
    borderWidth: 1,
    borderColor: colors["field-border"],
    borderRadius: 12,
    padding: 13,
    fontSize: 14,
    lineHeight: 21,
    color: colors.ink,
    backgroundColor: colors.card,
  },
  pill: {
    borderRadius: 20,
    backgroundColor: colors.sage,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: 8 },
});
