import { useState } from "react";
import { router } from "expo-router";
import { Page } from "../../../shared/Page";
import { Button, Card, Copy, Dialog, Field, Notice } from "../../../shared/ui";
import { route } from "../../../shared/navigation";
import { SecurityRequestError, type SecuritySession } from "../SecuritySessionProvider";

type Review = { email: string; message: string; requestId: string };
const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
export function AccountAlertReview({ account }: { account: SecuritySession }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sender, setSender] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const perform = async (action: () => Promise<unknown>) => {
    if (busy) return; setBusy(true); setError(null); setNotice(null);
    try { await action(); }
    catch (e) { setError(e instanceof SecurityRequestError && (!e.status || e.status >= 500)
      ? "Outcome unknown. The request may have completed. Retry the same reviewed alert safely, or refresh the inbox for permission changes."
      : e instanceof Error ? e.message : "Request unavailable."); }
    finally { setBusy(false); }
  };
  return <Page wide>
    <Copy kind="title">Contact alert review</Copy>
    <Notice>In-app alerts only. Both accounts must enable Contact notifications. The recipient must explicitly allow your signed-in email below. Adding a trusted contact or sharing recipient grants no alert permission. No SMS, email or push notification is sent.</Notice>
    {!account.identity ? <Button label="Sign in" onPress={() => router.push(route(3))} /> : null}
    <Card>
      <Copy kind="heading">Review an alert</Copy>
      <Field label="Recipient account email" value={email} autoCapitalize="none" keyboardType="email-address" onChangeText={v => { setEmail(v); setReview(null); setNotice(null); }} />
      <Field label="Your message" value={message} multiline onChangeText={v => { setMessage(v); setReview(null); setNotice(null); }} />
      <Button label="Review alert" kind="primary" disabled={busy || !account.identity} onPress={() => {
        if (!validEmail(email) || !message.trim() || message.length > 1000) { setError("Enter a valid recipient email and a message of 1–1000 characters."); return; }
        setError(null); setNotice(null);
        setReview({ email: email.trim().toLowerCase(), message: message.trim(), requestId: `alert-${Date.now()}-${Math.random().toString(36).slice(2)}` });
      }} />
      <Button label="Cancel" onPress={() => router.push(route(12))} />
    </Card>
    <Card>
      <Copy kind="heading">Who may send you in-app alerts?</Copy>
      <Copy kind="caption">This is separate from trusted contacts and sharing. Your Contact notifications consent must also be on.</Copy>
      <Field label="Allowed sender account email" value={sender} onChangeText={setSender} autoCapitalize="none" keyboardType="email-address" />
      <Button label="Allow this sender" disabled={busy || !validEmail(sender)} onPress={() => void perform(async () => {
        await account.request("/alerts/permission", "PUT", { email: sender.trim().toLowerCase(), allowed: true });
        await account.refresh(); setNotice("Sender permission saved.");
      })} />
      {(account.snapshot?.alertSenders ?? []).map(value => <Button key={value} label={`Remove alert permission for ${value}`} kind="danger" disabled={busy} onPress={() => void perform(async () => {
        await account.request("/alerts/permission", "PUT", { email: value, allowed: false }); await account.refresh();
      })} />)}
    </Card>
    <Card>
      <Copy kind="heading">Your received alerts</Copy>
      <Button label="Refresh alert inbox" disabled={busy} onPress={() => void perform(() => account.refresh())} />
      {account.snapshot?.alerts.length ? account.snapshot.alerts.map(alert => <Card key={alert.id} soft>
        <Copy kind="heading">{alert.sender}</Copy><Copy>{alert.message}</Copy>
        <Copy kind="caption">{new Date(alert.createdAt).toLocaleString()}</Copy>
      </Card>) : <Copy>No in-app alerts received.</Copy>}
    </Card>
    {notice ? <Notice>{notice}</Notice> : null}
    {error ? <Notice error>{error}</Notice> : null}
    {review ? <Dialog title="Review exact in-app alert" onClose={() => { if (!busy) setReview(null); }}>
      <Copy kind="heading">{review.email}</Copy><Copy>{review.message}</Copy>
      <Notice>Your signed-in email identifies the sender. Confirm only this message and recipient. Permission is checked again by the server.</Notice>
      {error ? <Notice error>{error}</Notice> : null}
      <Button label="Send alert" kind="primary" disabled={busy} onPress={() => void perform(async () => {
        await account.request("/alerts", "POST", review);
        setReview(null); setMessage(""); setNotice("In-app alert confirmed. The recipient can open their alert inbox.");
      })} />
    </Dialog> : null}
  </Page>;
}
