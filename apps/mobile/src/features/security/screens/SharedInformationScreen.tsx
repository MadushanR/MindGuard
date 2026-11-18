import { useEffect, useRef, useState, type ComponentRef } from "react";
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
  const [revokeError, setRevokeError] = useState<"failed" | "unknown" | null>(null);
  const shareButton = useRef<ComponentRef<typeof View>>(null);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  const selected = records.find((record) => record.id === dialog?.id);
  const close = () => { setDialog(null); setRevokeError(null); };
  const confirmRevoke = async (id: string) => {
    setRevokeError(null);
    setRevoked(false);
    const result = await revokeShare(id);
    if (!mounted.current || result.status === "stale" || result.status === "pending") return;
    if (result.status === "complete") {
      setDialog(null);
      setRevoked(true);
      requestAnimationFrame(() => shareButton.current?.focus());
    } else setRevokeError(result.status === "unknown" ? "unknown" : "failed");
  };
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
                {record.revocation ? (
                  <Copy kind="caption">
                    {record.revocation === "pending" ? copy.revokePendingLabel : copy.revokeFailedLabel}
                  </Copy>
                ) : null}
                <Button
                  label="Review"
                  accessibilityLabel={`Review share with ${record.recipientName}`}
                  onPress={() => setDialog({ id: record.id, kind: "review" })}
                />
                <Button
                  label={record.revocation === "pending" ? "Revoking…" : "Revoke access"}
                  accessibilityLabel={`Revoke access for ${record.recipientName}`}
                  kind="danger"
                  disabled={record.revocation === "pending"}
                  onPress={() => { setRevokeError(null); setDialog({ id: record.id, kind: "revoke" }); }}
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
              <Copy kind="caption">{copy.copiesNotice}</Copy>
              {selected.revocation === "pending" ? <Notice>{copy.revokePending}</Notice> : null}
              {revokeError ? (
                <Notice error>{revokeError === "unknown" ? copy.revokeUnknown : copy.revokeFailed}</Notice>
              ) : null}
              <Button
                label={selected.revocation === "pending" ? "Revoking…" : revokeError ? "Try revoking again" : "Confirm revoke access"}
                kind="danger"
                disabled={selected.revocation === "pending"}
                onPress={() => { void confirmRevoke(selected.id); }}
              />
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
