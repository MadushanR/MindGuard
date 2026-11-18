import { useCallback, useReducer, useState } from "react";
import { useSecuritySessionOptional } from "../SecuritySessionProvider";
import { router, useFocusEffect, useRouter } from "expo-router";
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
  Dialog,
  Toggle,
  ZenOrb,
} from "../../../shared/ui";
import { route } from "../../../shared/navigation";
import { useBrowserLayout } from "../../../shared/responsive";
import { createThemedStyles, useTheme } from "../../../shared/theme";
import {
  initialSignInState,
  signInReducer,
  validateSignIn,
  type SignInFields,
} from "../signIn";

export function SignInScreen() {
  const { mode } = useTheme();
  const local = screenStyles[mode];
  const navigation = useRouter();
  const session = useSecuritySessionOptional();
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [confirmation, setConfirmation] = useState(false);
  const [code, setCode] = useState("");
  const [state, dispatch] = useReducer(signInReducer, initialSignInState);
  const { desktop } = useBrowserLayout();
  const { model } = useAI();
  const fieldStyle = model.saved.preferences.largerText
    ? local.largerField
    : undefined;
  const errors = state.submitted ? validateSignIn(state.fields) : {};
  const edit = (field: keyof SignInFields) => (value: string) =>
    dispatch({ type: "edit", field, value });
  const submit = async () => {
    if (working) return;
    Keyboard.dismiss();
    const valid = Object.keys(validateSignIn(state.fields)).length === 0;
    dispatch({ type: "submit" });
    if (valid) {
      setWorking(true); setError(null);
      try {
        if (session) await session.signIn(state.fields.email, state.fields.password);
        dispatch({ type: "leave" });
        navigation.replace(route(5));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Sign-in unavailable. Please retry.");
        if (e instanceof Error && e.message === "ACCOUNT_CONFIRMATION_REQUIRED") setConfirmation(true);
      }
      finally { setWorking(false); }
    }
  };

  useFocusEffect(
    useCallback(() => {
      return () => { dispatch({ type: "leave" }); setConfirmation(false); setCode(""); };
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
          <Notice>{session ? "Sign in once for your account, sharing, chat and voice. Credentials stay in memory for this session." : copy.demoNotice}</Notice>
          {error || session?.error ? <Notice error>{error ?? session?.error}</Notice> : null}
          <Button label="Sign in" kind="primary" disabled={working || session?.busy} onPress={() => void submit()} />
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
      {confirmation && session ? <Dialog title="Confirm your account email" onClose={() => { setConfirmation(false); setCode(""); }}>
        <Field label="Email confirmation code" value={code} onChangeText={setCode} autoComplete="one-time-code" keyboardType="number-pad" />
        {error ? <Notice error>{error}</Notice> : null}
        <Button label="Confirm email" disabled={working || !code.trim()} onPress={() => {
          setWorking(true); setError(null);
          void session.confirm(state.fields.email, code).then(() => { setConfirmation(false); setCode(""); })
            .catch(e => setError(e instanceof Error ? e.message : "Confirmation unavailable.")).finally(() => setWorking(false));
        }} />
      </Dialog> : null}
    </Page>
  );
}

const screenStyles = createThemedStyles(({ colors }) => StyleSheet.create({
  layout: { gap: 24 },
  desktop: { flexDirection: "row", alignItems: "flex-start", gap: 48 },
  introduction: { gap: 18 },
  desktopIntroduction: { flex: 1, minWidth: 0, paddingTop: 12 },
  form: { minWidth: 0, gap: 18 },
  desktopForm: { flex: 1 },
  largerField: { fontSize: 17.5, lineHeight: 26.25 },
  invalid: { borderColor: colors["form-error"] },
}));
