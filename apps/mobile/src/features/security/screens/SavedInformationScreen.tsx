import { useCallback, useRef, useState, type ComponentRef } from "react";
import { router, useFocusEffect } from "expo-router";
import { StyleSheet, View } from "react-native";
import copy from "../../../../../../packages/fixtures/security/saved-information.json";
import { Page } from "../../../shared/Page";
import { Button, Card, Copy, Dialog, MenuRow, Notice } from "../../../shared/ui";
import { route } from "../../../shared/navigation";
import { useBrowserLayout } from "../../../shared/responsive";
import { styles } from "../../../shared/theme";
import { InformationCheckbox } from "../InformationCheckbox";
import { useSavedInformation } from "../SavedInformationProvider";
import { savedCategoryIds, savedCategoryLabels, type SavedCategoryId } from "../savedInformation";

export function SavedInformationScreen() {
  const { records, deleteCategories } = useSavedInformation();
  const { desktop } = useBrowserLayout();
  const [selected, setSelected] = useState<readonly SavedCategoryId[]>(() => records.map((r) => r.id));
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
                  checked={exists && selected.includes(id)} disabled={!exists}
                  onChange={() => {
                    setSelected((previous) => previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id]);
                    setDeleted(false);
                  }} />
              </View>;
            })}
          </Card>
          <Copy kind="caption">{copy.sessionNotice}</Copy>
          {!available.length ? <Notice>{records.length ? copy.noSelection : copy.empty}</Notice> : null}
          <Button label="Export selected information" kind="primary" disabled={!available.length}
            onPress={() => {
              if (!available.length) return;
              router.push({ pathname: route(13) as "/export-share", params: {
                origin: "saved-information", categories: available.join(","),
              } });
            }} />
          <Button label="Delete selected information" kind="danger" disabled={!available.length}
            onPress={() => { if (available.length) setDeleting([...available]); }} />
          {deleted ? <View ref={result} tabIndex={-1} accessibilityLiveRegion="polite">
            <Notice>{copy.deleted}</Notice>
          </View> : null}
          <MenuRow label="Retention and privacy choices" onPress={() => router.push(route(16))} />
        </View>
      </View>
      {deleting ? <Dialog title={copy.deleteTitle} onClose={() => setDeleting(null)}>
        <Copy>{copy.deleteDescription}</Copy>
        {deleting.map((id) => <Copy key={id}>{savedCategoryLabels[id]}</Copy>)}
        <Copy kind="caption">{copy.deleteScope}</Copy>
        <Button label="Confirm delete selected information" kind="danger" onPress={() => {
          deleteCategories(deleting);
          setSelected((previous) => previous.filter((id) => !deleting.includes(id)));
          setDeleting(null);
          setDeleted(true);
          requestAnimationFrame(() => result.current?.focus());
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
