import { useEffect, useState, type PropsWithChildren } from "react";
import {
  AccessibilityInfo,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { SvgXml } from "react-native-svg";
import type { Emotion } from "@mindguard/contracts";
import { useAI } from "../features/ai/AIProvider";
import { colors, emotionColors, styles } from "./theme";
import icons from "./icons.json";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBrowserLayout } from "./responsive";
export type IconName = keyof typeof icons;
export function Icon({
  name,
  color = colors.teal,
  size = 21,
}: {
  name: IconName;
  color?: string;
  size?: number;
}) {
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <SvgXml xml={icons[name]} width={size} height={size} color={color} />
    </View>
  );
}
export function Copy({
  children,
  kind = "body",
  center = false,
}: PropsWithChildren<{
  kind?: "body" | "muted" | "caption" | "eyebrow" | "heading" | "title";
  center?: boolean;
}>) {
  const { model } = useAI();
  return (
    <Text
      accessibilityRole={
        kind === "title" || kind === "heading" ? "header" : undefined
      }
      style={[
        styles[kind],
        center && { textAlign: "center" },
        model.saved.preferences.largerText && {
          fontSize: styles[kind].fontSize * 1.25,
          lineHeight: styles[kind].lineHeight * 1.25,
        },
      ]}
    >
      {children}
    </Text>
  );
}
export function Button({
  label,
  accessibilityLabel,
  onPress,
  kind = "secondary",
  icon,
  disabled = false,
  selected,
}: {
  label: string;
  accessibilityLabel?: string;
  onPress(): void;
  kind?: "primary" | "secondary" | "danger" | "text";
  icon?: IconName;
  disabled?: boolean;
  selected?: boolean;
}) {
  const [focus, setFocus] = useState(false),
    { model } = useAI();
  const foreground =
    kind === "primary"
      ? colors["on-primary"]
      : kind === "danger"
        ? colors["danger-text"]
        : colors.teal;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      onPress={onPress}
      style={({ pressed }) => [
        local.button,
        kind === "primary" && {
          backgroundColor: colors.teal,
          borderColor: colors.teal,
        },
        kind === "danger" && {
          backgroundColor: colors["danger-background"],
          borderColor: colors["danger-border"],
        },
        kind === "text" && {
          backgroundColor: "transparent",
          borderColor: "transparent",
          paddingHorizontal: 0,
        },
        pressed && { opacity: 0.75 },
        disabled && { opacity: 0.5 },
        focus && {
          outlineColor: colors.focus,
          outlineWidth: 2,
          outlineOffset: 3,
        },
      ]}
    >
      {icon ? <Icon name={icon} color={foreground} /> : null}
      <Text
        style={{
          color: foreground,
          fontSize: model.saved.preferences.largerText ? 17 : 13,
          lineHeight: 20,
          fontWeight: "600",
          flexShrink: 1,
          textAlign: "center",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function Card({
  children,
  soft = false,
}: PropsWithChildren<{ soft?: boolean }>) {
  return <View style={[styles.card, soft && styles.soft]}>{children}</View>;
}
export function Intro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <View style={{ gap: 12, marginBottom: 8 }}>
      <Copy kind="eyebrow">{eyebrow}</Copy>
      <Copy kind="title">{title}</Copy>
      <Copy kind="muted">{description}</Copy>
    </View>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <Copy>{label}</Copy>
      <TextInput
        {...props}
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          styles.field,
          props.multiline && { minHeight: 110, textAlignVertical: "top" },
          focused && { borderColor: colors.focus, borderWidth: 2 },
          props.style,
        ]}
      />
    </View>
  );
}
export function Toggle({
  label,
  description,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange(value: boolean): void;
  disabled?: boolean;
}) {
  return (
    <View style={local.toggle}>
      <View style={{ flex: 1, gap: 4 }}>
        <Copy>{label}</Copy>
        {description ? <Copy kind="caption">{description}</Copy> : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: colors["field-border"], true: colors.teal }}
        thumbColor={colors.card}
      />
    </View>
  );
}
export function Notice({
  children,
  error = false,
}: PropsWithChildren<{ error?: boolean }>) {
  return (
    <View
      accessibilityLiveRegion={error ? "assertive" : "polite"}
      style={[
        local.notice,
        error && { backgroundColor: "#FFF2E9", borderColor: "#E6C4B1" },
      ]}
    >
      <Icon name={error ? "alert" : "leaf"} />
      <View style={{ flex: 1, gap: 8 }}>
        <Copy kind="muted">{children}</Copy>
      </View>
    </View>
  );
}
export function MenuRow({
  label,
  description,
  onPress,
  icon = "arrow",
  selected,
}: {
  label: string;
  description?: string;
  onPress(): void;
  icon?: IconName;
  selected?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={selected === undefined ? undefined : { selected }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={onPress}
      style={({ pressed }) => [
        local.menu,
        pressed && { backgroundColor: colors.sage },
        focused && { outlineColor: colors.focus, outlineWidth: 2 },
      ]}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <Copy>{label}</Copy>
        {description ? <Copy kind="caption">{description}</Copy> : null}
      </View>
      <Icon name={icon} />
    </Pressable>
  );
}
export function Dialog({
  title,
  children,
  onClose,
  visible = true,
}: PropsWithChildren<{ title: string; onClose(): void; visible?: boolean }>) {
  const insets = useSafeAreaInsets();
  const { desktop } = useBrowserLayout();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      accessibilityLabel={title}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={local.mask}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : Platform.OS === "android"
              ? "height"
              : undefined
        }
        keyboardVerticalOffset={Platform.OS === "web" ? 0 : insets.top}
      >
        <View
          accessibilityViewIsModal
          style={[local.dialog, desktop && { maxWidth: 620 }]}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 25, gap: 16 }}
          >
            <Copy kind="heading">{title}</Copy>
            {children}
            <Button label="Cancel" onPress={onClose} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
export function EmotionBadge({
  label,
  status,
}: {
  label: Emotion;
  status: string;
}) {
  const c = emotionColors[label.toLowerCase() as keyof typeof emotionColors];
  return (
    <View
      style={{
        alignSelf: "flex-start",
        borderRadius: 20,
        backgroundColor: c.labelBackground,
        paddingHorizontal: 12,
        paddingVertical: 6,
      }}
    >
      <Text style={{ color: c.labelText, fontSize: 12, lineHeight: 19 }}>
        {label} · {status}
      </Text>
    </View>
  );
}
export function ZenOrb({
  state = "ready",
  compact = false,
}: {
  state?: string;
  compact?: boolean;
}) {
  const { model } = useAI(),
    [systemReduced, setSystemReduced] = useState(true),
    [phase] = useState(() => new Animated.Value(0));
  const reduced = systemReduced || model.saved.preferences.reducedMotion;
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setSystemReduced(value);
    });
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setSystemReduced,
    );
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  useEffect(() => {
    phase.setValue(0);
    if (
      reduced ||
      ["muted", "stopped", "reconnecting", "error"].includes(state)
    )
      return;
    const duration =
      state === "speaking"
        ? 750
        : state === "processing"
          ? 1200
          : state === "listening"
            ? 2000
            : 3000;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(phase, {
          toValue: 1,
          duration,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(phase, {
          toValue: 0,
          duration,
          useNativeDriver: Platform.OS !== "web",
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [reduced, state, phase]);
  const size = compact ? 48 : 178;
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={{
        height: size + (compact ? 0 : 54),
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Animated.View
        style={{
          width: size,
          height: size,
          borderRadius: size,
          backgroundColor: colors.sage,
          alignItems: "center",
          justifyContent: "center",
          transform: [
            {
              scale: phase.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.07],
              }),
            },
          ],
        }}
      >
        <View
          style={{
            width: size * 0.82,
            height: size * 0.82,
            borderRadius: size,
            backgroundColor: "#B5C9A4",
            alignItems: "center",
            justifyContent: "center",
            borderWidth: compact ? 0 : 8,
            borderColor: "#D7E2C9",
          }}
        >
          <View
            style={{
              width: size * 0.58,
              height: size * 0.58,
              borderRadius: size,
              backgroundColor: "#CCDBBB",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="leaf" size={compact ? 19 : 44} color={colors.teal} />
          </View>
        </View>
      </Animated.View>
    </View>
  );
}
const local = StyleSheet.create({
  button: {
    minHeight: 49,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors["button-border"],
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    minHeight: 60,
    paddingVertical: 6,
  },
  notice: {
    backgroundColor: colors.sage,
    borderRadius: 16,
    padding: 15,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  menu: {
    minHeight: 65,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  mask: {
    flex: 1,
    backgroundColor: "rgba(26,48,39,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  dialog: {
    width: "100%",
    maxWidth: 430,
    maxHeight: "90%",
    borderRadius: 28,
    backgroundColor: colors.card,
    overflow: "hidden",
  },
});
