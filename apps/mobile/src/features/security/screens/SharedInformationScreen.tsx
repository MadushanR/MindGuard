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
  const { records, revokeShare, simulated, incoming, refresh, error } = useSharedInformation();
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
        <Copy kind="muted">{simulated ? copy.description : "Review information shared through signed-in accounts. Revoking stops future in-app access; copies already seen or copied cannot be recalled."}</Copy>
      </View>
      {records.length ? (
        <>
          <Notice>{simulated ? copy.sessionNotice : "Live account sharing. History is stored in AWS. Turning sharing consent off blocks new shares and keeps existing ones until you revoke them."}</Notice>
          <ResponsiveGrid>
            {records.map((record) => (
              <Card key={record.id}>
                <Copy kind="heading">{record.recipientName}</Copy>
                <Copy kind="muted">{new Date(record.createdAt).toLocaleString()}</Copy>
                <Copy kind="caption">{simulated ? copy.demoLabel : "Live in-app access · synthetic source records"}</Copy>
                {record.destination ? <Copy kind="caption">{record.destination.email} · {record.destination.relationship}</Copy> : null}
                {record.revocation ? (
                  <Copy kind="caption">
                    {record.revocation === "pending" ? simulated ? copy.revokePendingLabel : "Revocation pending · outcome not yet confirmed"
                      : record.revocation === "unknown" ? copy.revokeUnknownLabel : simulated ? copy.revokeFailedLabel : "Request rejected · refresh to check access"}
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
      {error ? <Notice error>{error}</Notice> : null}
      {refresh ? <Button label="Refresh shared information" onPress={() => void refresh().catch(() => {})} /> : null}
      {!simulated ? <Card>
        <Copy kind="heading">Shared with your account</Copy>
        <Copy kind="caption">Refresh to check current access. Recipient access is checked by the server each time information is loaded.</Copy>
        {incoming?.length ? incoming.map(record => <View key={record.id} style={{ gap: 8 }}>
          <Copy kind="heading">From {record.sender}</Copy>
          {record.content.map((line, index) => <Copy key={index}>{line}</Copy>)}
        </View>) : <Copy>No active information shared with you.</Copy>}
      </Card> : null}
      {revoked ? <Notice>{simulated ? copy.revokedNotice : "In-app access has been revoked."}</Notice> : null}
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
              <Notice>{simulated ? copy.sessionNotice : "This is the exact snapshot confirmed for this destination."}</Notice>
            </>
          ) : (
            <>
              <Copy>{simulated ? copy.revokeDescription : "End this recipient's future in-app access to this snapshot? Source records, saved categories and other shares stay unchanged. The record leaves this list only after the server confirms."}</Copy>
              <Copy kind="caption">{copy.copiesNotice}</Copy>
              {selected.revocation === "pending" ? <Notice>{simulated ? copy.revokePending : "Waiting for the server. Revocation may be in progress; access is not yet confirmed."}</Notice> : null}
              {/* Derived from the record so the state survives closing and reopening the dialog. */}
              {revokeError || selected.revocation === "failed" || selected.revocation === "unknown" ? (
                <Notice error>
                  {(revokeError ?? selected.revocation) === "unknown" ? simulated ? copy.revokeUnknown : "Revocation outcome unknown. Access may or may not have ended. Retry safely or refresh to reconcile." : simulated ? copy.revokeFailed : "The server rejected this revocation. Refresh your session and try again."}
                </Notice>
              ) : null}
              <Button
                label={selected.revocation === "pending" ? "Revoking…"
                  : revokeError || selected.revocation ? "Try revoking again" : "Confirm revoke access"}
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
