import { useRef, useState, type ComponentRef } from "react";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import copy from "../../../../../../packages/fixtures/security/shared-information.json";
import { Page } from "../../../shared/Page";
import { Button, Card, Copy, Dialog, Notice } from "../../../shared/ui";
import { route } from "../../../shared/navigation";
import { ResponsiveGrid } from "../../../shared/responsive";
import { useSharedInformation } from "../SharedInformationProvider";

export function SharedInformationScreen() {
  const { records, revokeShare } = useSharedInformation();
  const [dialog, setDialog] = useState<{ id: string; kind: "review" | "revoke" } | null>(null);
  const [revoked, setRevoked] = useState(false);
  const shareButton = useRef<ComponentRef<typeof View>>(null);
  const selected = records.find((record) => record.id === dialog?.id);
  const close = () => setDialog(null);
  return (
    <Page wide>
      <View style={local.intro}>
        <Copy kind="title">{copy.title}</Copy>
        <Copy kind="muted">{copy.description}</Copy>
      </View>
      {records.length ? (
        <>
          <Notice>{copy.sessionNotice}</Notice>
          <ResponsiveGrid>
            {records.map((record) => (
              <Card key={record.id}>
                <Copy kind="heading">{record.recipientName}</Copy>
                <Copy kind="muted">{new Date(record.createdAt).toLocaleString()}</Copy>
                <Copy kind="caption">{copy.demoLabel}</Copy>
                <Button
                  label="Review"
                  accessibilityLabel={`Review share with ${record.recipientName}`}
                  onPress={() => setDialog({ id: record.id, kind: "review" })}
                />
                <Button
                  label="Revoke access"
                  accessibilityLabel={`Revoke access for ${record.recipientName}`}
                  kind="danger"
                  onPress={() => setDialog({ id: record.id, kind: "revoke" })}
                />
              </Card>
            ))}
          </ResponsiveGrid>
        </>
      ) : (
        <Card>
          <View style={local.empty}>
            <Copy kind="heading" center>{copy.emptyTitle}</Copy>
            <Copy kind="muted" center>{copy.emptyDescription}</Copy>
          </View>
        </Card>
      )}
      {revoked ? <Notice>{copy.revokedNotice}</Notice> : null}
      <Button
        ref={shareButton}
        label="Share information"
        kind="primary"
        onPress={() => router.push(route(13))}
      />
      {selected && dialog ? (
        <Dialog title={dialog.kind === "review" ? copy.reviewTitle : copy.revokeTitle} onClose={close}>
          <Copy kind="heading">{selected.recipientName}</Copy>
          <Copy kind="muted">{new Date(selected.createdAt).toLocaleString()}</Copy>
          {dialog.kind === "review" ? (
            <>
              {selected.content.map((line, index) => <Copy key={index}>{line}</Copy>)}
              <Notice>{copy.sessionNotice}</Notice>
            </>
          ) : (
            <>
              <Copy>{copy.revokeDescription}</Copy>
              <Button label="Confirm revoke access" kind="danger" onPress={() => {
                revokeShare(selected.id);
                close();
                setRevoked(true);
                requestAnimationFrame(() => shareButton.current?.focus());
              }} />
            </>
          )}
        </Dialog>
      ) : null}
    </Page>
  );
}
const local = StyleSheet.create({
  intro: { gap: 12, marginBottom: 8 },
  empty: { gap: 12, alignItems: "center", paddingVertical: 20 },
});
