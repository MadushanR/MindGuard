import { useCallback, useReducer, useState } from "react";
import { useSecuritySessionOptional } from "../SecuritySessionProvider";
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
  const session = useSecuritySessionOptional();
  const [confirmEmail, setConfirmEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [created, setCreated] = useState(false);
  const [state, dispatch] = useReducer(accountReducer, initialAccountState);
  const { desktop } = useBrowserLayout();
  const { model } = useAI();
  const largerText = model.saved.preferences.largerText;
  const errors = state.submitted ? validateAccount(state.fields) : {};
  const edit = (field: keyof AccountFields) => (value: string) =>
    dispatch({ type: "edit", field, value });
  const submit = async () => {
    Keyboard.dismiss();
    if (working) return;
    if (session) {
      if (Object.keys(validateAccount(state.fields)).length) { dispatch({ type: "submit" }); return; }
      setWorking(true); setError(null);
      try {
        await session.signUp(state.fields.email, state.fields.password, state.fields.fullName);
        setConfirmEmail(state.fields.email); dispatch({ type: "leave" });
      } catch (e) { setError(e instanceof Error ? e.message : "Account creation unavailable."); }
      finally { setWorking(false); }
      return;
    }
    dispatch({ type: "submit" });
  };

  useFocusEffect(
    useCallback(() => {
      return () => { dispatch({ type: "leave" }); setConfirmEmail(""); setCode(""); setError(null); };
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
          <Notice>{session ? "Create an account with the existing MindGuard Cognito service. Confirm the code sent to your email before signing in. Use at least 12 characters with uppercase, lowercase, a number and a symbol." : copy.demoNotice}</Notice>
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
          {error ? <Notice error>{error}</Notice> : null}
          {created ? <Notice>Email confirmed. You can sign in.</Notice> : null}
          <Button label="Create account" kind="primary" disabled={working} onPress={() => void submit()} />
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
      {confirmEmail && session ? <Dialog title="Confirm your account" onClose={() => { setConfirmEmail(""); setCode(""); }}>
        <Field label="Email confirmation code" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" />
        {error ? <Notice error>{error}</Notice> : null}
        <Button label="Confirm email" disabled={working || !code.trim()} kind="primary" onPress={() => {
          setWorking(true); setError(null);
          void session.confirm(confirmEmail, code).then(() => { setConfirmEmail(""); setCode(""); setCreated(true); })
            .catch(e => setError(e instanceof Error ? e.message : "Confirmation failed.")).finally(() => setWorking(false));
        }} />
      </Dialog> : null}
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
