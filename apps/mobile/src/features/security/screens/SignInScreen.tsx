import { useCallback, useReducer } from "react";
import { router, useFocusEffect } from "expo-router";
import { Keyboard, StyleSheet, View } from "react-native";
import copy from "../../../../../../packages/fixtures/security/sign-in.json";
import { useAI } from "../../ai";
import { Page } from "../../../shared/Page";
import {
  Button,
  Card,
  Copy,
  Field,
  Intro,
  Notice,
  Toggle,
  ZenOrb,
} from "../../../shared/ui";
import { route } from "../../../shared/navigation";
import { useBrowserLayout } from "../../../shared/responsive";
import { colors } from "../../../shared/theme";
import {
  initialSignInState,
  signInReducer,
  validateSignIn,
  type SignInFields,
} from "../signIn";

export function SignInScreen() {
  const [state, dispatch] = useReducer(signInReducer, initialSignInState);
  const { desktop } = useBrowserLayout();
  const { model } = useAI();
  const fieldStyle = model.saved.preferences.largerText
    ? local.largerField
    : undefined;
  const errors = state.submitted ? validateSignIn(state.fields) : {};
  const edit = (field: keyof SignInFields) => (value: string) =>
    dispatch({ type: "edit", field, value });
  const submit = () => {
    Keyboard.dismiss();
    const valid = Object.keys(validateSignIn(state.fields)).length === 0;
    dispatch({ type: "submit" });
    // A local UI simulation only; no account session or stored identity is created.
    if (valid) router.replace(route(5));
  };

  useFocusEffect(
    useCallback(() => {
      return () => dispatch({ type: "leave" });
    }, []),
  );

  return (
    <Page wide={desktop}>
      <View style={[local.layout, desktop && local.desktop]}>
        <View style={[local.introduction, desktop && local.desktopIntroduction]}>
          <Intro {...copy} />
          <ZenOrb />
        </View>
        <View style={[local.form, desktop && local.desktopForm]}>
          <Card>
            {Object.keys(errors).length ? (
              <Notice error>{copy.errors.summary}</Notice>
            ) : null}
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
              returnKeyType="done"
              onSubmitEditing={submit}
              style={[fieldStyle, errors.password ? local.invalid : null]}
              accessibilityHint={errors.password ?? copy.passwordHint}
              aria-invalid={!!errors.password}
            />
            {errors.password ? <Notice error>{errors.password}</Notice> : null}
            <Toggle
              label="Show password"
              value={state.showPassword}
              onChange={(value) => dispatch({ type: "visibility", value })}
            />
            <Button
              label="Forgot password?"
              kind="text"
              onPress={() => router.push(route(4))}
            />
          </Card>
          <Copy kind="muted">{copy.passwordHint}</Copy>
          <Notice>{copy.demoNotice}</Notice>
          <Button label="Sign in" kind="primary" onPress={submit} />
          <Copy center kind="muted">
            {copy.createAccountPrompt}
          </Copy>
          <Button
            label="Create an account"
            kind="text"
            onPress={() => router.push(route(2))}
          />
        </View>
      </View>
    </Page>
  );
}

const local = StyleSheet.create({
  layout: { gap: 24 },
  desktop: { flexDirection: "row", alignItems: "flex-start", gap: 48 },
  introduction: { gap: 18 },
  desktopIntroduction: { flex: 1, minWidth: 0, paddingTop: 12 },
  form: { minWidth: 0, gap: 18 },
  desktopForm: { flex: 1 },
  largerField: { fontSize: 17.5, lineHeight: 26.25 },
  invalid: { borderColor: colors["form-error"] },
});
