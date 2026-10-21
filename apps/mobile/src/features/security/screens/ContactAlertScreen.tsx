import { useCallback, useReducer, useRef, useState, type ComponentRef } from "react";
import { router, useFocusEffect } from "expo-router";
import { Keyboard, Pressable, StyleSheet, View } from "react-native";
import demo from "../../../../../../packages/fixtures/security/contact-alert.json";
import { useAI } from "../../ai";
import { Page } from "../../../shared/Page";
import { Button, Card, Copy, Dialog, Field, Icon, MenuRow, Notice } from "../../../shared/ui";
import { route } from "../../../shared/navigation";
import { useBrowserLayout } from "../../../shared/responsive";
import { colors, styles } from "../../../shared/theme";
import {
  alertRecipient, contactAlertReducer, initialContactAlertState, validateAlert,
} from "../contactAlert";

export function ContactAlertScreen() {
  const [state, dispatch] = useReducer(contactAlertReducer, initialContactAlertState);
  const [focused, setFocused] = useState(false);
  const { desktop } = useBrowserLayout();
  const { model } = useAI();
  const result = useRef<ComponentRef<typeof View>>(null);
  const recipient = alertRecipient(state.recipientId);
  const errors = state.attempted ? validateAlert(state) : {};
  const disabled = recipient?.alertsEnabled === false;
  const cancel = () => {
    dispatch({ type: "leave" });
    if (router.canGoBack()) router.back();
    else router.replace(route(12));
  };
  useFocusEffect(useCallback(() => {
    return () => dispatch({ type: "leave" });
  }, []));

  return (
    <Page wide={desktop}>
      <View style={[local.layout, desktop && local.desktop]}>
        <View style={[local.intro, desktop && local.column]}>
          <Copy kind="title">{demo.title}</Copy>
          <Copy kind="muted">{demo.description}</Copy>
        </View>
        <View style={[local.form, desktop && local.column]}>
          <Card>
            <View style={local.fieldGroup}>
              <Copy>Recipient</Copy>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Recipient: ${recipient?.name ?? demo.recipientPlaceholder}`}
                accessibilityHint="Opens the fictional recipient choices."
                accessibilityState={{ expanded: state.pickerOpen }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onPress={() => {
                  Keyboard.dismiss();
                  dispatch({ type: "openPicker" });
                }}
                style={({ pressed }) => [
                  styles.field, local.select,
                  pressed && { backgroundColor: colors.sage },
                  focused && local.focus,
                ]}
              >
                <View style={local.selectedName}>
                  <Copy>{recipient?.name ?? demo.recipientPlaceholder}</Copy>
                </View>
                <View style={local.chevron}><Icon name="arrow" size={18} /></View>
              </Pressable>
            </View>
            {errors.recipient && !disabled ? <Notice error>{errors.recipient}</Notice> : null}
            <Field
              label="Your message"
              value={state.message}
              onChangeText={(message) => dispatch({ type: "editMessage", message })}
              multiline
              autoComplete="off"
              accessibilityHint={errors.message}
              aria-invalid={!!errors.message}
              style={[
                model.saved.preferences.largerText && local.largerField,
                errors.message ? local.invalid : null,
              ]}
            />
            {errors.message ? <Notice error>{errors.message}</Notice> : null}
            <Notice>{demo.privacyNotice}</Notice>
            {disabled ? <Notice>{demo.disabledNotice}</Notice> : null}
          </Card>
          <Button label="Review alert" kind="primary" disabled={disabled} onPress={() => {
            Keyboard.dismiss();
            dispatch({ type: "review" });
          }} />
          <Button label="Cancel" onPress={cancel} />
          {state.phase === "sent" ? (
            <View ref={result} tabIndex={-1} accessibilityLiveRegion="polite">
              <Card soft>
                <Copy kind="heading">{demo.sentTitle}</Copy>
                <Copy>{demo.sentDescription}</Copy>
              </Card>
            </View>
          ) : null}
        </View>
      </View>
      {state.pickerOpen ? (
        <Dialog title={demo.chooseTitle} onClose={() => dispatch({ type: "closePicker" })}>
          {demo.recipients.map((option) => (
            <MenuRow
              key={option.id}
              label={option.name}
              description={option.relationship}
              selected={option.id === state.recipientId}
              icon={option.id === state.recipientId ? "check" : "user"}
              onPress={() => dispatch({ type: "selectRecipient", id: option.id })}
            />
          ))}
        </Dialog>
      ) : null}
      {state.phase === "reviewing" && state.snapshot ? (
        <Dialog title={demo.reviewTitle} onClose={() => dispatch({ type: "cancelReview" })}>
          <Copy kind="heading">{state.snapshot.recipientName}</Copy>
          <Copy>{state.snapshot.message}</Copy>
          <Notice>{demo.privacyNotice}</Notice>
          <Notice>{demo.reviewNotice}</Notice>
          <Button label="Send alert" kind="primary" onPress={() => {
            dispatch({ type: "send" });
            requestAnimationFrame(() => result.current?.focus());
          }} />
        </Dialog>
      ) : null}
    </Page>
  );
}
const local = StyleSheet.create({
  layout: { gap: 24 },
  desktop: { flexDirection: "row", alignItems: "flex-start", gap: 48 },
  column: { flex: 1, minWidth: 0 },
  intro: { gap: 12, marginBottom: 8 },
  form: { gap: 18, minWidth: 0 },
  fieldGroup: { gap: 8 },
  select: { flexDirection: "row", alignItems: "center", gap: 12 },
  selectedName: { flex: 1, minWidth: 0 },
  chevron: { transform: [{ rotate: "90deg" }] },
  focus: { borderColor: colors.focus, outlineColor: colors.focus, outlineWidth: 2, outlineOffset: 3 },
  largerField: { fontSize: 17.5, lineHeight: 26.25 },
  invalid: { borderColor: colors["form-error"] },
});
