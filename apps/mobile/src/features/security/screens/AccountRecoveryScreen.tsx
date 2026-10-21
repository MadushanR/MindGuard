import { useCallback, useReducer } from "react";
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
import { colors } from "../../../shared/theme";
import {
  initialRecoveryState,
  recoveryReducer,
  validateRecoveryEmail,
} from "../accountRecovery";

export function AccountRecoveryScreen() {
  const [state, dispatch] = useReducer(recoveryReducer, initialRecoveryState);
  const { desktop } = useBrowserLayout();
  const { model } = useAI();
  const error = state.submitted ? validateRecoveryEmail(state.email) : undefined;
  const submit = () => {
    Keyboard.dismiss();
    dispatch({ type: "submit" });
  };
  const signIn = () => {
    dispatch({ type: "leave" });
    router.replace(route(3));
  };

  useFocusEffect(
    useCallback(() => {
      return () => dispatch({ type: "leave" });
    }, []),
  );

  return (
    <Page wide={desktop}>
      <View style={[local.layout, desktop && local.desktop]}>
        <View style={[local.introduction, desktop && local.desktopColumn]}>
          <Intro {...copy} />
          <Notice>{copy.demoNotice}</Notice>
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
          <Button label="Send recovery code" kind="primary" onPress={submit} />
          <Button label="Back to sign in" kind="text" onPress={signIn} />
        </View>
      </View>
      {state.confirming ? (
        <Dialog
          title={copy.confirmationTitle}
          onClose={() => dispatch({ type: "close" })}
        >
          <Copy>{copy.confirmationDescription}</Copy>
          <Button label="Back to sign in" kind="primary" onPress={signIn} />
        </Dialog>
      ) : null}
    </Page>
  );
}

const local = StyleSheet.create({
  layout: { gap: 24 },
  desktop: { flexDirection: "row", alignItems: "flex-start", gap: 48 },
  introduction: { gap: 18, minWidth: 0 },
  form: { gap: 18, minWidth: 0 },
  desktopColumn: { flex: 1 },
  largerField: { fontSize: 17.5, lineHeight: 26.25 },
  invalid: { borderColor: colors["form-error"] },
});
