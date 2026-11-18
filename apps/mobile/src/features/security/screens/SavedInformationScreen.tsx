import { useCallback, useRef, useState, type ComponentRef } from "react";
import { router, useFocusEffect } from "expo-router";
import { StyleSheet, View } from "react-native";
import copy from "../../../../../../packages/fixtures/security/saved-information.json";
import { Page } from "../../../shared/Page";
import { Button, Card, Copy, Dialog, MenuRow, Notice } from "../../../shared/ui";
import { route } from "../../../shared/navigation";
import { useBrowserLayout } from "../../../shared/responsive";
import { useTheme } from "../../../shared/theme";
import { InformationCheckbox } from "../InformationCheckbox";
import { useSavedInformation } from "../SavedInformationProvider";
import { savedCategoryIds, savedCategoryLabels, type SavedCategoryId } from "../savedInformation";

export function SavedInformationScreen() {
  const { styles } = useTheme();
  const { records, deleteCategories, live, saveExamples, error } = useSavedInformation();
  const [working, setWorking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const { desktop } = useBrowserLayout();
  const [selected, setSelected] = useState<readonly SavedCategoryId[]>(() => [...savedCategoryIds]);
  const [deleting, setDeleting] = useState<readonly SavedCategoryId[] | null>(null);
  const [deleted, setDeleted] = useState(false);
  const result = useRef<ComponentRef<typeof View>>(null);
  const available = selected.filter((id) => records.some((record) => record.id === id));
  useFocusEffect(useCallback(() => () => setDeleting(null), []));
  return (
    <Page wide={desktop}>
      <View style={[local.layout, desktop && local.desktop]}>
        <View style={[local.intro, desktop && local.column]}>
          <Copy kind="title">{copy.title}</Copy>
          <Copy kind="muted">{copy.description}</Copy>
        </View>
        <View style={[local.form, desktop && local.column]}>
          <Card>
            {savedCategoryIds.map((id, index) => {
              const exists = records.some((record) => record.id === id);
              return <View key={id}>
                {index ? <View style={styles.divider} /> : null}
                <InformationCheckbox label={savedCategoryLabels[id]}
                  description={exists ? copy.available : copy.unavailable}
                  checked={exists && selected.includes(id)} disabled={!exists || working}
                  onChange={() => {
                    setSelected((previous) => previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id]);
                    setDeleted(false);
                  }} />
              </View>;
            })}
          </Card>
          <Copy kind="caption">{live ? "Only information saved to your signed-in account is listed. Deletion removes these categories from AWS, and does not delete your account, AI history, contacts or existing shares. Legacy synthetic device data stays separate." : copy.sessionNotice}</Copy>
          {error || failure ? <Notice error>{failure ?? error}</Notice> : null}
          {live && saveExamples ? <Button label="Save fictional examples to my account" disabled={working} onPress={() => {
            setWorking(true); setFailure(null);
            void saveExamples().then(() => setSelected([...savedCategoryIds])).catch(e => setFailure(e instanceof Error ? e.message : "Save not confirmed."))
              .finally(() => setWorking(false));
          }} /> : null}
          {!available.length ? <Notice>{records.length ? copy.noSelection : copy.empty}</Notice> : null}
          <Button label="Export selected information" kind="primary" disabled={!available.length || working}
            onPress={() => {
              if (!available.length) return;
              router.push({ pathname: route(13) as "/export-share", params: {
                origin: "saved-information", categories: available.join(","),
              } });
            }} />
          <Button label="Delete selected information" kind="danger" disabled={!available.length || working}
            onPress={() => { if (available.length) setDeleting([...available]); }} />
          {deleted ? <View ref={result} tabIndex={-1} accessibilityLiveRegion="polite">
            <Notice>{live ? "Selected categories were deleted from your account." : copy.deleted}</Notice>
          </View> : null}
          <MenuRow label="Retention and privacy choices" onPress={() => router.push(route(16))} />
        </View>
      </View>
      {deleting ? <Dialog title={copy.deleteTitle} onClose={() => setDeleting(null)}>
        <Copy>{live ? "Delete exactly these saved categories from AWS? This cannot be undone. Other account records and existing shares remain unchanged." : copy.deleteDescription}</Copy>
        {deleting.map((id) => <Copy key={id}>{savedCategoryLabels[id]}</Copy>)}
        <Copy kind="caption">{live ? "This does not delete unrelated device storage or revoke existing shares." : copy.deleteScope}</Copy>
        {failure ? <Notice error>{failure}</Notice> : null}
        <Button label="Confirm delete selected information" kind="danger" disabled={working} onPress={() => {
          const ids = [...deleting];
          setWorking(true); setFailure(null);
          void Promise.resolve(deleteCategories(ids)).then(() => {
            setSelected((previous) => previous.filter((id) => !ids.includes(id)));
            setDeleting(null); setDeleted(true);
            requestAnimationFrame(() => result.current?.focus());
          }).catch(e => setFailure(e instanceof Error ? e.message : "Deletion outcome unknown. Refresh before retrying."))
            .finally(() => setWorking(false));
        }} />
      </Dialog> : null}
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
