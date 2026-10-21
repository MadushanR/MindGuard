import { useCallback, useReducer } from "react";
import { router, useFocusEffect } from "expo-router";
import { Keyboard, StyleSheet, View } from "react-native";
import copy from "../../../../../../packages/fixtures/security/create-account.json";
import { useAI } from "../../ai";
import { Page } from "../../../shared/Page";
import {
  Button,
  Card,
  Copy,
  Dialog,
  Field,
  Intro,
  Notice,
  Toggle,
} from "../../../shared/ui";
import { route } from "../../../shared/navigation";
import { useBrowserLayout } from "../../../shared/responsive";
import { colors } from "../../../shared/theme";
import {
  accountReducer,
  initialAccountState,
  validateAccount,
  type AccountFields,
} from "../createAccount";

export function CreateAccountScreen() {
  const [state, dispatch] = useReducer(accountReducer, initialAccountState);
  const { desktop } = useBrowserLayout();
  const { model } = useAI();
  const largerText = model.saved.preferences.largerText;
  const errors = state.submitted ? validateAccount(state.fields) : {};
  const edit = (field: keyof AccountFields) => (value: string) =>
    dispatch({ type: "edit", field, value });
  const submit = () => {
    Keyboard.dismiss();
    dispatch({ type: "submit" });
  };

  useFocusEffect(
    useCallback(() => {
      return () => dispatch({ type: "leave" });
    }, []),
  );

  const fieldStyle = largerText ? local.largerField : undefined;
  const privacy = (
    <Card soft>
      <Copy kind="heading">{copy.privacyTitle}</Copy>
      <Copy kind="muted">{copy.privacyDescription}</Copy>
      <Button
        label={copy.privacyLink}
        icon="lock"
        kind="text"
        onPress={() => router.push(route(16))}
      />
    </Card>
  );

  return (
    <Page wide={desktop}>
      <View style={[local.layout, desktop && local.desktop]}>
        <View style={[local.introduction, desktop && local.desktopIntroduction]}>
          <Intro {...copy} />
          <Notice>{copy.demoNotice}</Notice>
          {desktop ? privacy : null}
        </View>
        <View style={local.form}>
          <Card>
            {Object.keys(errors).length ? (
              <Notice error>{copy.errors.summary}</Notice>
            ) : null}
            <Field
              label="Full name"
              value={state.fields.fullName}
              onChangeText={edit("fullName")}
              autoComplete="name"
              autoCapitalize="words"
              autoCorrect={false}
              style={[fieldStyle, errors.fullName ? local.invalid : null]}
              accessibilityHint={errors.fullName}
              aria-invalid={!!errors.fullName}
            />
            {errors.fullName ? <Notice error>{errors.fullName}</Notice> : null}
            <Field
              label="Email address"
              value={state.fields.email}
              onChangeText={edit("email")}
              keyboardType="email-address"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect={false}
              style={[fieldStyle, errors.email ? local.invalid : null]}
              accessibilityHint={errors.email}
              aria-invalid={!!errors.email}
            />
            {errors.email ? <Notice error>{errors.email}</Notice> : null}
            <Field
              label="Password"
              value={state.fields.password}
              onChangeText={edit("password")}
              secureTextEntry={!state.showPassword}
              autoComplete="off"
              textContentType="none"
              autoCapitalize="none"
              autoCorrect={false}
              style={[fieldStyle, errors.password ? local.invalid : null]}
              accessibilityHint={errors.password ?? copy.passwordHint}
              aria-invalid={!!errors.password}
            />
            <Copy kind="muted">{copy.passwordHint}</Copy>
            {errors.password ? <Notice error>{errors.password}</Notice> : null}
            <Toggle
              label="Show passwords"
              description="Show both password fields."
              value={state.showPassword}
              onChange={(value) => dispatch({ type: "visibility", value })}
            />
            <Field
              label="Confirm password"
              value={state.fields.confirmPassword}
              onChangeText={edit("confirmPassword")}
              secureTextEntry={!state.showPassword}
              autoComplete="off"
              textContentType="none"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={submit}
              style={[fieldStyle, errors.confirmPassword ? local.invalid : null]}
              accessibilityHint={errors.confirmPassword}
              aria-invalid={!!errors.confirmPassword}
            />
            {errors.confirmPassword ? (
              <Notice error>{errors.confirmPassword}</Notice>
            ) : null}
          </Card>
          {!desktop ? privacy : null}
          <Button label="Create account" kind="primary" onPress={submit} />
          <Copy center kind="muted">
            {copy.signInPrompt}
          </Copy>
          <Button
            label="Sign in"
            kind="text"
            onPress={() => router.push(route(3))}
          />
        </View>
      </View>
      {state.success ? (
        <Dialog
          title={copy.successTitle}
          onClose={() => dispatch({ type: "close" })}
        >
          <Copy>{copy.successDescription}</Copy>
          <Button
            label={copy.successAction}
            kind="primary"
            onPress={() => {
              dispatch({ type: "close" });
              router.replace(route(3));
            }}
          />
        </Dialog>
      ) : null}
    </Page>
  );
}

const local = StyleSheet.create({
  layout: { gap: 24 },
  desktop: { flexDirection: "row", alignItems: "flex-start", gap: 48 },
  introduction: { gap: 18 },
  desktopIntroduction: { flex: 1, minWidth: 0, paddingTop: 12 },
  form: { flex: 1, minWidth: 0, gap: 18 },
  largerField: { fontSize: 17.5, lineHeight: 26.25 },
  invalid: { borderColor: colors["form-error"] },
});
