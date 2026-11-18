import tokens from "../../../../docs/design/tokens.json";
import { createContext, useContext } from "react";
import { StyleSheet } from "react-native";

export type ThemeMode = "light" | "dark";

const lightColors = {
  ...tokens.colors,
  stage: "#e6e9df",
  "brand-mark": tokens.colors.card,
  "switch-thumb": tokens.colors.card,
  "orb-middle": "#b5c9a4",
  "orb-border": "#d7e2c9",
  "orb-center": "#ccdbbb",
  "art-overlay": "rgba(255,254,250,0.9)",
  "art-border": "#a6bc95",
  scrim: "rgba(26,48,39,0.35)",
};

const darkColors: typeof lightColors = {
  paper: "#182420",
  card: "#202f29",
  ink: "#edf3e9",
  muted: "#b6c6bb",
  teal: "#a4d4bf",
  "teal-dark": "#8bbda9",
  sage: "#2b4238",
  line: "#3c5147",
  clay: "#e0a38a",
  focus: "#edb38c",
  "button-border": "#61796c",
  "field-border": "#718b7e",
  "soft-card": "#263a31",
  "nav-active": "#344f42",
  "danger-text": "#ffc1af",
  "danger-background": "#432c28",
  "danger-border": "#976b5d",
  "error-text": "#f5c3a9",
  "error-background": "#402d25",
  "error-border": "#916957",
  "form-error": "#f1a18a",
  "on-primary": "#142820",
  stage: "#121c18",
  "brand-mark": "#142820",
  "switch-thumb": "#182420",
  "orb-middle": "#3d5a46",
  "orb-border": "#4b6653",
  "orb-center": "#314d3d",
  "art-overlay": "rgba(32,47,41,0.95)",
  "art-border": "#667f6d",
  scrim: "rgba(0,0,0,0.55)",
};

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
});

function createSharedStyles(colors: typeof lightColors) {
  return StyleSheet.create({
    ...styles,
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
}

export const themes = {
  light: {
    colors: lightColors,
    emotionColors: tokens.emotionColors,
    styles: createSharedStyles(lightColors),
  },
  dark: {
    colors: darkColors,
    emotionColors: {
      calm: { chart: "#a0bc8a", labelBackground: "#354936", labelText: "#d2e8c5" },
      tense: { chart: "#d4a58b", labelBackground: "#4e382f", labelText: "#f6cab3" },
      low: { chart: "#aab7d6", labelBackground: "#343c53", labelText: "#d2dcfa" },
      hopeful: { chart: "#d6c48c", labelBackground: "#483f2d", labelText: "#f1dfaa" },
    },
    styles: createSharedStyles(darkColors),
  },
};

export function createThemedStyles<T>(
  create: (theme: (typeof themes)[ThemeMode]) => T,
) {
  return {
    light: create(themes.light),
    dark: create(themes.dark),
  };
}

export const ThemeContext = createContext<{
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}>({
  mode: "light",
  setMode: () => {},
});

export function useTheme() {
  const { mode, setMode } = useContext(ThemeContext);
  return { ...themes[mode], mode, setMode };
}
