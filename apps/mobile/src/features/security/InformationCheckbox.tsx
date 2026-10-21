import { useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { Copy, Icon } from "../../shared/ui";
import { colors } from "../../shared/theme";

export function InformationCheckbox({ label, description, checked, disabled, onChange }: {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange(): void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable accessibilityRole="checkbox" accessibilityLabel={label}
      accessibilityHint={description} accessibilityState={{ checked, disabled }}
      aria-checked={checked} aria-disabled={disabled}
      onKeyDownCapture={Platform.OS === "web" ? (event) => {
        if (event.nativeEvent.key === " ") {
          event.preventDefault();
          event.stopPropagation();
        }
      } : undefined}
      onKeyUpCapture={Platform.OS === "web" ? (event) => {
        if (event.nativeEvent.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          if (!disabled) onChange();
        }
      } : undefined}
      disabled={disabled} onPress={onChange}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        local.row, disabled && { opacity: 0.6 }, pressed && { opacity: 0.75 },
        focused && { outlineColor: colors.focus, outlineWidth: 2, outlineOffset: 3 },
      ]}>
      <View style={[local.box, checked && { backgroundColor: colors.teal }]}>
        {checked ? <Icon name="check" color={colors["on-primary"]} size={18} /> : null}
      </View>
      <View style={local.text}>
        <Copy>{label}</Copy>
        <Copy kind="caption">{description}</Copy>
      </View>
    </Pressable>
  );
}
const local = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 60, paddingVertical: 10, borderRadius: 8 },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colors.teal, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, minWidth: 0, gap: 4 },
});
