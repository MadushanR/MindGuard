import { useCallback, useReducer, useState } from "react";
import { useSecuritySessionOptional } from "../SecuritySessionProvider";
import { router, useFocusEffect } from "expo-router";
import { Keyboard, StyleSheet, View } from "react-native";
import copy from "../../../../../../packages/fixtures/security/account-recovery.json";
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
} from "../../../shared/ui";
import { route } from "../../../shared/navigation";
import { useBrowserLayout } from "../../../shared/responsive";
import { createThemedStyles, useTheme } from "../../../shared/theme";
import {
  initialRecoveryState,
  recoveryReducer,
  validateRecoveryEmail,
} from "../accountRecovery";

export function AccountRecoveryScreen() {
  const { mode } = useTheme();
  const local = screenStyles[mode];
  const session = useSecuritySessionOptional();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [working, setWorking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [state, dispatch] = useReducer(recoveryReducer, initialRecoveryState);
  const { desktop } = useBrowserLayout();
  const { model } = useAI();
  const error = state.submitted ? validateRecoveryEmail(state.email) : undefined;
  const submit = async () => {
    Keyboard.dismiss();
    if (working) return;
    if (session && !validateRecoveryEmail(state.email)) {
      setWorking(true); setFailure(null);
      try { await session.recover(state.email); dispatch({ type: "submit" }); }
      catch (e) { setFailure(e instanceof Error ? e.message : "Recovery unavailable."); }
      finally { setWorking(false); }
      return;
    }
    dispatch({ type: "submit" });
  };
  const signIn = () => {
    dispatch({ type: "leave" });
    router.replace(route(3));
  };

  useFocusEffect(
    useCallback(() => {
      return () => { dispatch({ type: "leave" }); setCode(""); setPassword(""); setFailure(null); };
    }, []),
  );

  return (
    <Page wide={desktop}>
      <View style={[local.layout, desktop && local.desktop]}>
        <View style={[local.introduction, desktop && local.desktopColumn]}>
          <Intro {...copy} />
          <Notice>{session ? "Request a Cognito recovery code. If the account is eligible, a code is sent to its verified email. Use a new password of at least 12 characters with uppercase, lowercase, a number and a symbol." : copy.demoNotice}</Notice>
        </View>
        <View style={[local.form, desktop && local.desktopColumn]}>
          <Card>
            <Field
              label="Email address"
              placeholder={copy.emailPlaceholder}
              value={state.email}
              onChangeText={(value) => dispatch({ type: "edit", value })}
              keyboardType="email-address"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={submit}
              accessibilityHint={error}
              aria-invalid={!!error}
              style={[
                model.saved.preferences.largerText && local.largerField,
                error ? local.invalid : null,
              ]}
            />
            {error ? <Notice error>{error}</Notice> : null}
          </Card>
          {failure ? <Notice error>{failure}</Notice> : null}
          <Button label="Send recovery code" kind="primary" disabled={working} onPress={() => void submit()} />
          <Button label="Back to sign in" kind="text" onPress={signIn} />
        </View>
      </View>
      {state.confirming ? (
        <Dialog
          title={copy.confirmationTitle}
          onClose={() => { dispatch({ type: "close" }); setCode(""); setPassword(""); }}
        >
          <Copy>{session ? "If your account is eligible, check its verified email for the recovery code. Enter it with your new password." : copy.confirmationDescription}</Copy>
          {session ? <>
            <Field label="Recovery code" value={code} onChangeText={setCode} autoComplete="one-time-code" />
            <Field label="New password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
            {failure ? <Notice error>{failure}</Notice> : null}
            <Button label="Reset password" kind="primary" disabled={working || !code.trim() || !password} onPress={() => {
              setWorking(true); setFailure(null);
              void session.resetPassword(state.email, code, password).then(() => { setCode(""); setPassword(""); signIn(); })
                .catch(e => setFailure(e instanceof Error ? e.message : "Recovery failed.")).finally(() => setWorking(false));
            }} />
          </> : null}
          <Button label="Back to sign in" kind="primary" onPress={signIn} />
        </Dialog>
      ) : null}
    </Page>
  );
}

const screenStyles = createThemedStyles(({ colors }) => StyleSheet.create({
  layout: { gap: 24 },
  desktop: { flexDirection: "row", alignItems: "flex-start", gap: 48 },
  introduction: { gap: 18, minWidth: 0 },
  form: { gap: 18, minWidth: 0 },
  desktopColumn: { flex: 1 },
  largerField: { fontSize: 17.5, lineHeight: 26.25 },
  invalid: { borderColor: colors["form-error"] },
}));
