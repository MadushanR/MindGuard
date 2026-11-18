import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { StyleSheet, View } from "react-native";
import copy from "../../../../../../packages/fixtures/security/privacy.json";
import { useAI } from "../../ai";
import { Page } from "../../../shared/Page";
import { Button, Copy, MenuRow, Notice, Toggle } from "../../../shared/ui";
import { route } from "../../../shared/navigation";
import { useBrowserLayout } from "../../../shared/responsive";
import { styles } from "../../../shared/theme";
import {
  changePrivacyDraft, parseDemoPreferences, PRIVACY_STORAGE_KEY,
  serializeDemoPreferences, type PrivacyDraft,
} from "../privacy";
import { useSecuritySessionOptional } from "../SecuritySessionProvider";
import { useLiveVoiceOptional } from "../../ai/live/LiveVoiceProvider";

export function PrivacyConsentScreen() {
  const ai = useAI();
  const session = useSecuritySessionOptional();
  const voice = useLiveVoiceOptional();
  const account = useRef(session);
  useEffect(() => { account.current = session; }, [session]);
  const currentAI = useRef(ai);
  useEffect(() => { currentAI.current = ai; }, [ai]);
  const { desktop } = useBrowserLayout();
  const [draft, setDraft] = useState<PrivacyDraft | null>(null);
  const [readError, setReadError] = useState(false);
  const [writeError, setWriteError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const busy = useRef(false);
  const focused = useRef(false);
  const readGeneration = useRef(0);

  const load = useCallback(() => {
    const generation = ++readGeneration.current;
    setDraft(null);
    setReadError(false);
    setWriteError(false);
    setSubmitted(false);
    setSaving(busy.current);
    if (ai.ready) {
      if (account.current) {
        void account.current.refresh().then(value => {
          if (focused.current && generation === readGeneration.current) setDraft({ ...currentAI.current.consent,
            voice: voice?.consent === true, ...value.preferences });
        }).catch(() => { if (focused.current && generation === readGeneration.current) setReadError(true); });
        return;
      }
      void AsyncStorage.getItem(PRIVACY_STORAGE_KEY).then((raw) => {
        const preferences = parseDemoPreferences(raw);
        if (focused.current && generation === readGeneration.current) {
          setDraft({ ...currentAI.current.consent, ...preferences });
        }
      }).catch(() => {
        if (focused.current && generation === readGeneration.current) setReadError(true);
      });
    }
  }, [ai.ready, voice?.consent]);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    load();
    return () => { focused.current = false; ++readGeneration.current; };
  }, [load]));

  const change = (key: keyof PrivacyDraft, value: boolean) => {
    setDraft((previous) => previous ? changePrivacyDraft(previous, key, value) : null);
    setSubmitted(false);
    setWriteError(false);
  };
  const save = async () => {
    if (!draft || busy.current || !ai.ready || readError) return;
    busy.current = true;
    setSaving(true);
    setSubmitted(false);
    setWriteError(false);
    try {
      // A failed local write leaves the existing AI permissions unchanged.
      if (session) {
        // Revocation stops capture/playback before any awaited storage/network work.
        if (!draft.voice) { voice?.stop(); voice?.clearHandoff(); }
        if (voice && voice.consent !== draft.voice) await voice.setVoiceConsent(draft.voice);
        await session.request("/consent", "PUT", { wellnessData: draft.wellnessData, saveSummaries: draft.saveSummaries,
          sharing: draft.sharing, contactNotifications: draft.contactNotifications });
        await session.refresh();
      } else await AsyncStorage.setItem(PRIVACY_STORAGE_KEY, serializeDemoPreferences(draft));
      const controller = currentAI.current;
      // Order matters: voice must be enabled before enabling tone.
      controller.setConsent("voice", draft.voice);
      controller.setConsent("tone", draft.voice && draft.tone);
      controller.setConsent("chatObservations", draft.chatObservations);
      if (focused.current) setSubmitted(true);
    } catch {
      if (focused.current) setWriteError(true);
    } finally {
      busy.current = false;
      if (focused.current) setSaving(false);
    }
  };
  const locked = saving || (submitted && ai.saving);
  return (
    <Page wide={desktop}>
      <View style={[local.layout, desktop && local.desktop]}>
        <View style={[local.intro, desktop && local.column]}>
          <Copy kind="title">{copy.title}</Copy>
          <Copy kind="muted">{copy.description}</Copy>
          <Copy kind="caption">{copy.draftNotice}</Copy>
        </View>
        <View style={[local.form, desktop && local.column]}>
          {!ai.ready ? <Notice>Loading existing AI permissions…</Notice> : null}
          {readError ? <>
            <Notice error>{copy.readError}</Notice>
            <Button label="Retry loading privacy preferences" onPress={load} />
          </> : null}
          {draft ? <>
            {(["voice", "chatObservations", "tone"] as const).map((key) => (
              <View key={key}>
                <Toggle {...copy[key]} value={draft[key]} disabled={locked || (key === "tone" && !draft.voice)}
                  onChange={(value) => change(key, value)} />
                <View style={styles.divider} />
              </View>
            ))}
            <Copy kind="caption">{copy.toneNotice}</Copy>
            <Notice>{session ? "These four choices are saved to your signed-in account. Sharing requires wellness-data consent too. Turning Sharing off prevents new shares; revoke existing shares in Shared information. In-app alerts also require the recipient's explicit sender permission. Tone and chat observations remain simulations. Voice sends microphone audio through the relay to OpenAI; application audio and transcripts are not saved, and provider processing terms still apply." : copy.demoNotice}</Notice>
            {(["wellnessData", "saveSummaries", "sharing", "contactNotifications"] as const).map((key) => (
              <View key={key}>
                <Toggle {...copy[key]} value={draft[key]} disabled={locked}
                  onChange={(value) => change(key, value)} />
                <View style={styles.divider} />
              </View>
            ))}
          </> : null}
          {writeError ? <Notice error>{session ? "Preferences could not be confirmed. Some changes may have reached the server. Voice stays stopped if you withdrew consent. Reload the preferences to reconcile before retrying." : copy.writeError}</Notice> : null}
          {submitted ? <Notice error={!!ai.writeError}>
            {ai.writeError ? copy.aiWriteError : ai.saving ? copy.saving : session ? "Privacy preferences saved to your account." : copy.saved}
          </Notice> : null}
          <Button label="Save preferences" kind="primary" disabled={!draft || locked || !ai.ready}
            onPress={() => { void save(); }} />
          <MenuRow label="Back to create account" onPress={() => router.push(route(2))} />
          <MenuRow label="Saved information" onPress={() => router.push(route(17))} />
          <MenuRow label="Conversation history and auto-delete" onPress={() => router.push(route(23))} />
        </View>
      </View>
    </Page>
  );
}
const local = StyleSheet.create({
  layout: { gap: 24 },
  desktop: { flexDirection: "row", alignItems: "flex-start", gap: 48 },
  column: { flex: 1, minWidth: 0 },
  intro: { gap: 12, marginBottom: 8 },
  form: { gap: 18, minWidth: 0 },
});
