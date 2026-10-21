import { useEffect, useState } from "react";
import { AppState, View } from "react-native";
import * as Linking from "expo-linking";
import { wellnessResources } from "@mindguard/fixtures";
import { router } from "expo-router";
import type { ScreenId } from "@mindguard/contracts";
import { Page } from "../../shared/Page";
import {
  Button,
  Card,
  Copy,
  Dialog,
  Field,
  Icon,
  Intro,
  MenuRow,
  Notice,
  Toggle,
  ZenOrb,
} from "../../shared/ui";
import { colors, styles } from "../../shared/theme";
import { destination, route } from "../../shared/navigation";
import { ObservationCard, useAI } from "../ai";
import { EmotionTrends } from "./EmotionTrends";
import { days, visibleObservations, weekDays, type Period } from "./trends";
import {
  metricInfo,
  metrics,
  recipientErrors,
  useWellness,
  type Metric,
} from "./state";

const go = (id: ScreenId) => router.push(route(id));
function Link({ id, label }: { id: ScreenId; label?: string }) {
  return (
    <MenuRow label={label ?? destination(id).title} onPress={() => go(id)} />
  );
}
function Summary() {
  const w = useWellness();
  return (
    <Card soft>
      <Copy kind="heading">Weekly wellness overview</Copy>
      <Copy kind="caption">
        Demo week · Monday–Sunday · synthetic wearable records
      </Copy>
      {metrics.map((m) => (
        <View key={m}>
          <Copy>{metricInfo[m].label}</Copy>
          <Copy kind="muted">
            {w.available(m)
              ? `${(metricInfo[m].values.reduce((a, b) => a + b, 0) / 7).toFixed(m === "steps" ? 0 : 1)} ${metricInfo[m].unit} daily average`
              : "Unavailable — connect, allow access, and sync to view demo records."}
          </Copy>
        </View>
      ))}
      <Link id={10} label="Manage data sources" />
    </Card>
  );
}
export function HomeScreen() {
  return (
    <Page>
      <Intro
        eyebrow="YOUR SPACE TO REFLECT"
        title="Hello there."
        description="Take a moment for yourself today."
      />
      <ZenOrb />
      <Copy kind="heading">How are you feeling?</Copy>
      <Copy kind="muted">
        Talk with Zen, reflect on your day, or explore your wellness patterns.
      </Copy>
      <Button
        label="Start text conversation"
        icon="chat"
        kind="primary"
        onPress={() => go(6)}
      />
      <Button
        label="Start voice conversation"
        icon="mic"
        onPress={() => go(7)}
      />
      <Link id={22} label="Conversation history" />
      <Summary />
      <Link id={9} label="View wellness trends" />
    </Page>
  );
}
export function TrendsScreen() {
  const ai = useAI();
  const w = useWellness();
  const [period, setPeriod] = useState<Period>("This week");
  const [filter, setFilter] = useState("All");
  const [day, setDay] = useState<number | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const update = () => setClock(Date.now());
    const pending = setTimeout(update, 0);
    const timer = setInterval(update, 60_000);
    const subscription = AppState.addEventListener("change", (state) => { if (state === "active") update(); });
    return () => { clearTimeout(pending); clearInterval(timer); subscription.remove(); };
  }, [ai.observations]);
  const boundaries = weekDays(clock, period);
  const observations = visibleObservations(ai.observations, ai.consent, clock, period, filter);
  const recent = day === null ? observations : observations.filter((o) => o.createdAt >= boundaries[day] && o.createdAt < boundaries[day + 1]);
  return (
    <Page>
      <Intro
        eyebrow="WELLNESS"
        title="Your trends"
        description="Wearable records and conversation observations, kept distinct."
      />
      <View style={styles.row}>
        {(["This week", "Last week"] as const).map((p) => (
          <Button
            key={p}
            label={p}
            kind={period === p ? "primary" : "secondary"}
            selected={period === p}
            onPress={() => { setPeriod(p); setDay(null); }}
          />
        ))}
      </View>
      {period === "This week" ? (
        <Summary />
      ) : (
        <Notice>No wearable records for last week.</Notice>
      )}
      <Card>
        <Copy kind="heading">Daily wearable records</Copy>
        <Copy kind="caption">
          Synthetic demo week; values are not live measurements.
        </Copy>
        {metrics.map((m) => (
          <View key={m} style={styles.stack}>
            <Copy>{metricInfo[m].label}</Copy>
            {period === "This week" && w.available(m) ? (
              metricInfo[m].values.map((v, i) => (
                <View key={i} style={{ gap: 4 }}>
                  <Copy kind="caption">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]} · {v}{" "}
                    {metricInfo[m].unit}
                  </Copy>
                  <View
                    accessible={false}
                    style={{
                      height: 7,
                      borderRadius: 4,
                      width: `${(v / Math.max(...metricInfo[m].values)) * 100}%`,
                      backgroundColor: colors.teal,
                    }}
                  />
                </View>
              ))
            ) : (
              <Copy kind="muted">No available records.</Copy>
            )}
          </View>
        ))}
      </Card>
      <Copy kind="heading">Emotional patterns</Copy>
      <Copy kind="muted">
        Inferred observations from conversations, not wearable measurements or
        diagnoses.
      </Copy>
      {!ai.consent.chatObservations || !ai.consent.tone ? (
        <Notice>
          Some observation sources are disabled. Existing saved observations
          remain governed by your conversation preferences.
        </Notice>
      ) : null}
      <View style={styles.row}>
        {["All", "Chat", "Voice tone"].map((f) => (
          <Button
            key={f}
            label={f}
            kind={filter === f ? "primary" : "secondary"}
            selected={filter === f}
            onPress={() => { setFilter(f); setDay(null); }}
          />
        ))}
      </View>
      <EmotionTrends observations={observations} boundaries={boundaries} day={day} onDay={setDay} />
      <Copy kind="heading">{day === null ? "Recent observations" : `${days[day]} observations`}</Copy>
      {recent.length ? (
        [...recent]
          .sort((a, b) => b.createdAt - a.createdAt)
          .map((o) => (
            <View key={o.id}>
              <Copy kind="caption">
                {new Date(o.createdAt).toLocaleString()}
              </Copy>
              <ObservationCard observation={o} />
            </View>
          ))
      ) : (
        <Notice>No observations available for this period and filter{day === null ? "." : " and day."}</Notice>
      )}
      <Link id={10} />
      <Link id={13} label="Export or share" />
    </Page>
  );
}
export function SourcesScreen() {
  const w = useWellness(),
    ai = useAI();
  return (
    <Page>
      <Intro
        eyebrow="YOUR DATA"
        title="Wellness data sources"
        description="Choose which demo records are available to your wellness screens."
      />
      <Card>
        <Icon name="activity" />
        <Copy kind="heading">Smartwatch · {w.watch}</Copy>
        <Copy>{w.device}</Copy>
        <Link
          id={19}
          label={
            w.watch === "connected" ? "Manage smartwatch" : "Connect smartwatch"
          }
        />
        <Toggle
          label="Pause wearable sync"
          value={w.paused}
          onChange={w.setPaused}
          disabled={w.watch !== "connected"}
        />
        {metrics.map((m) => (
          <Toggle
            key={m}
            label={`Allow ${metricInfo[m].label.toLowerCase()} records`}
            description="Demo access only; no device permission is requested."
            value={w.permissions[m]}
            onChange={(v) => {
              w.setPermissions({ ...w.permissions, [m]: v });
            }}
          />
        ))}
        <Toggle label="Simulate sync failure" value={w.simulateSyncFailure} onChange={w.setSimulateSyncFailure} />
        <Button
          label={w.syncFailed ? "Retry sync" : "Sync demo records"}
          disabled={
            w.watch !== "connected" ||
            w.paused ||
            !metrics.some((m) => w.permissions[m])
          }
          onPress={w.sync}
        />
        {w.syncFailed ? <Notice error>Demo sync failed. Turn off simulated sync failure, then retry. Records are unavailable until sync succeeds.</Notice> : null}
        <Copy kind="muted">
          {w.paused
            ? "Sync paused. Records are unavailable across wellness and sharing."
            : w.watch !== "connected"
              ? "Connect a demo watch before syncing."
              : w.syncFailed
                ? "No demo records available after the failed sync."
                : w.synced
                  ? "Demo records synced. Only permitted records are available."
                  : "No demo records synced yet."}
        </Copy>
      </Card>
      <Card>
        <Copy kind="heading">Conversation observations</Copy>
        <Toggle
          label="Chat emotion observations"
          value={ai.consent.chatObservations}
          onChange={(v) => ai.setConsent("chatObservations", v)}
        />
        <Copy kind="muted">
          Voice tone:{" "}
          {ai.consent.tone && ai.consent.voice ? "enabled" : "disabled"}
        </Copy>
        <Link id={8} />
        <Link id={16} />
      </Card>
      <Notice>
        Watch permissions and demo records stay in this session. Existing
        conversation preferences keep their current device storage behavior.
      </Notice>
    </Page>
  );
}
export function WatchScreen() {
  const w = useWellness();
  const { watch, setWatch } = w;
  const [name, setName] = useState(w.device),
    [fail, setFail] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (watch !== "connecting") return;
    const timer = setTimeout(
      () => setWatch(fail ? "failed" : "connected"),
      900,
    );
    return () => clearTimeout(timer);
  }, [watch, setWatch, fail]);
  // Leaving during connection cancels the simulation instead of leaving a stuck status.
  useEffect(
    () => () =>
      setWatch((current) =>
        current === "connecting" ? "disconnected" : current,
      ),
    [setWatch],
  );
  const connect = () => {
    if (!name.trim()) {
      setError("Enter a device name.");
      return;
    }
    setError("");
    w.setDevice(name.trim());
    w.setSynced(false);
    w.setWatch("connecting");
  };
  return (
    <Page>
      <Intro
        eyebrow="WEARABLES"
        title="Connect smartwatch"
        description="Explore a simulated wearable connection."
      />
      <Card soft>
        <View
          style={{
            alignSelf: "center",
            borderWidth: 5,
            borderColor: colors.teal,
            borderRadius: 24,
            padding: 24,
            marginVertical: 20,
          }}
        >
          <Icon name="activity" size={48} />
        </View>
        <Copy kind="heading">Your wellness, at a glance</Copy>
        <Copy kind="muted">
          No live devices or platforms are supported yet. This demo does not use
          Bluetooth, Apple Health, or Health Connect.
        </Copy>
      </Card>
      <Field
        label="Device name"
        value={name}
        onChangeText={setName}
        maxLength={100}
        editable={w.watch !== "connecting" && w.watch !== "connected"}
      />
      {error ? <Notice error>{error}</Notice> : null}
      <Notice error={w.watch === "failed"}>
        {w.watch === "connected"
          ? `Demo connected: ${w.device}. Allow records and sync in Data Sources.`
          : w.watch === "connecting"
            ? "Connecting demo watch…"
            : w.watch === "failed"
              ? "Demo connection failed. Turn off simulated failure and retry."
              : "No smartwatch connected."}
      </Notice>
      {w.watch === "connected" ? (
        <Button
          label="Disconnect smartwatch"
          onPress={() => {
            w.setWatch("disconnected");
            w.setSynced(false);
          }}
        />
      ) : (
        <>
          <Toggle
            label="Simulate connection failure"
            value={fail}
            onChange={setFail}
            disabled={w.watch === "connecting"}
          />
          <Button
            label={
              w.watch === "failed" ? "Retry connection" : "Connect demo watch"
            }
            kind="primary"
            disabled={w.watch === "connecting"}
            onPress={connect}
          />
        </>
      )}
      <Link id={10} label="Return to data sources" />
    </Page>
  );
}
export function ResourcesScreen() {
  const [pending, setPending] = useState<{ label: string; url: string } | null>(null);
  const [linkError, setLinkError] = useState("");
  const open = async (url: string) => {
    setLinkError("");
    try { await Linking.openURL(url); }
    catch { setLinkError("This device could not open that link. Use the contact details shown here on a phone, or try the website when internet access is available."); }
  };
  return (
    <Page>
      <Intro
        eyebrow="SUPPORT"
        title="Wellness and crisis resources"
        description="Canadian support information, available without starting a conversation."
      />
      <Copy kind="caption">Region: {wellnessResources.region} · Sources checked {wellnessResources.reviewedOn}</Copy>
      {wellnessResources.items.map((resource) => <Card key={resource.id} soft={resource.id === "crisis"}>
        <Copy kind="heading">{resource.title}</Copy>
        <Copy>{resource.description}</Copy>
        {resource.actions.map((action) => <Button key={action.url} label={action.label} onPress={() => {
          if (/^(tel|sms):/.test(action.url)) { setLinkError(""); setPending(action); }
          else void open(action.url);
        }} />)}
      </Card>)}
      <Notice>{wellnessResources.offline}</Notice>
      {linkError ? <Notice error>{linkError}</Notice> : null}
      <Card>
        <Copy kind="heading">Support contacts</Copy>
        <Copy kind="muted">
          Manage support contacts in Trusted Contacts. Adding a sharing
          recipient does not create a trusted
          contact.
        </Copy>
        <Link id={12} />
      </Card>
      <Card>
        <Copy kind="heading">Wellness suggestions</Copy>
        <Copy kind="muted">
          Existing illustrative guides and videos are separate from crisis
          resources. They are not reviewed crisis support.
        </Copy>
        <Link id={21} label="Explore wellness suggestions" />
      </Card>
      {pending ? <Dialog title="Open another app?" onClose={() => setPending(null)}>
        <Copy>{pending.label} opens your phone or messaging app. MindGuard does not place a call, send a message, or attach your records automatically.</Copy>
        <Button label="Continue to phone or messaging app" kind="primary" onPress={() => { const url = pending.url; setPending(null); void open(url); }} />
      </Dialog> : null}
    </Page>
  );
}
function selectedContent(selected: Metric[]) {
  return selected.map(
    (m) =>
      `${metricInfo[m].label}: ${metricInfo[m].values.join(", ")} ${metricInfo[m].unit} (Mon–Sun); daily average ${(metricInfo[m].values.reduce((a, b) => a + b, 0) / 7).toFixed(m === "steps" ? 0 : 1)} ${metricInfo[m].unit}.`,
  );
}
export function ShareScreen() {
  const w = useWellness();
  const [preview, setPreview] = useState(false),
    [done, setDone] = useState(false);
  const eligible = w.selected.filter(w.available);
  const recipient = w.recipients.find((r) => r.id === w.destination);
  const valid =
    eligible.length > 0 && (w.destination === "export" || !!recipient);
  const destinationText =
    w.destination === "export"
      ? "Demo export preview (no file download)"
      : recipient
        ? `${recipient.name} · ${recipient.email} · ${recipient.relationship}`
        : "Choose a destination";
  const add = () => {
    w.setRecipientOrigin("share");
    go(20);
  };
  return (
    <Page>
      <Intro
        eyebrow="YOU CHOOSE WHAT TO INCLUDE"
        title="Export and share"
        description="Build a demo preview, review its destination, then explicitly confirm the simulation."
      />
      <Notice>
        No sending or file export service is connected. Recipients and
        selections stay in this session.
      </Notice>
      <Card>
        <Copy kind="heading">Destination</Copy>
        <MenuRow
          label="Demo export preview"
          selected={w.destination === "export"}
          onPress={() => {
            w.setDestination("export");
            setDone(false);
          }}
        />
        {w.recipients.map((r) => (
          <MenuRow
            key={r.id}
            label={r.name}
            description={`${r.email} · ${r.relationship}`}
            selected={w.destination === r.id}
            onPress={() => {
              w.setDestination(r.id);
              setDone(false);
            }}
          />
        ))}
        <Button label="Add recipient" onPress={add} />
      </Card>
      <Card>
        <Copy kind="heading">Select wellness records</Copy>
        <Copy kind="caption">Synthetic demo week · Monday–Sunday</Copy>
        {metrics.map((m) => (
          <Toggle
            key={m}
            label={metricInfo[m].label}
            description={
              w.available(m)
                ? "Includes seven daily values and their average."
                : "Unavailable. Connect, allow access, and sync first."
            }
            disabled={!w.available(m)}
            value={w.available(m) && w.selected.includes(m)}
            onChange={(v) => {
              w.setSelected(
                v
                  ? [...w.selected.filter((x) => x !== m), m]
                  : w.selected.filter((x) => x !== m),
              );
              setDone(false);
            }}
          />
        ))}
        <Link id={10} label="Manage eligible data" />
      </Card>
      <Copy kind="muted">
        Excluded: full conversations, transcripts, raw audio, emotion
        observations, and remembered details. No trusted-contact status or
        notification eligibility is granted.
      </Copy>
      <Button
        label="Preview selected content"
        kind="primary"
        disabled={!valid}
        onPress={() => {
          setPreview(true);
          setDone(false);
        }}
      />
      {done ? (
        <Notice>
          Simulation complete. No information was sent and no file was
          downloaded.
        </Notice>
      ) : null}
      {preview ? (
        <Dialog
          title="Review exact demo content"
          onClose={() => setPreview(false)}
        >
          <Copy kind="heading">Destination</Copy>
          <Copy>{destinationText}</Copy>
          <Copy kind="heading">Content</Copy>
          <Copy>Synthetic demo week · Monday–Sunday</Copy>
          {eligible.map((m, i) => (
            <Copy key={m}>{selectedContent(eligible)[i]}</Copy>
          ))}
          {!valid ? (
            <Notice error>
              These records or destination are no longer available. Cancel and
              update your selection.
            </Notice>
          ) : null}
          <Notice>
            This confirms a demo action only. Real sharing requires the team’s
            security and consent integration.
          </Notice>
          <Button
            label="Confirm simulated action"
            disabled={!valid}
            kind="primary"
            onPress={() => {
              if (!valid) return;
              setPreview(false);
              setDone(true);
            }}
          />
        </Dialog>
      ) : null}
    </Page>
  );
}
export function RecipientScreen() {
  const w = useWellness();
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [relationship, setRelationship] = useState(""),
    [attempted, setAttempted] = useState(false);
  const errors = recipientErrors(name, email, relationship, w.recipients);
  const finish = () => {
    if (router.canGoBack()) router.back();
    else router.replace(route(w.recipientOrigin === "share" ? 13 : 18));
  };
  const save = () => {
    setAttempted(true);
    if (Object.values(errors).some(Boolean)) return;
    const id = `recipient-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    w.setRecipients([
      ...w.recipients,
      {
        id,
        name: name.trim(),
        email: email.trim(),
        relationship: relationship.trim(),
      },
    ]);
    if (w.recipientOrigin === "share") w.setDestination(id);
    finish();
  };
  return (
    <Page>
      <Intro
        eyebrow="SHARING DESTINATION"
        title="Add recipient"
        description="Saving a recipient does not send information."
      />
      <Card>
        <Field
          label="Full name"
          value={name}
          onChangeText={setName}
          autoComplete="name"
          maxLength={120}
        />
        {attempted && errors.name ? <Notice error>{errors.name}</Notice> : null}
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          maxLength={254}
        />
        {attempted && errors.email ? (
          <Notice error>{errors.email}</Notice>
        ) : null}
        <Field
          label="Relationship"
          value={relationship}
          onChangeText={setRelationship}
          placeholder="For example, friend"
          maxLength={120}
        />
        {attempted && errors.relationship ? (
          <Notice error>{errors.relationship}</Notice>
        ) : null}
      </Card>
      <Notice>
        A recipient is a demo sharing destination, not a trusted contact.
        Check-in eligibility and notifications are unavailable until the team’s
        security integration is implemented. Use invented details; this form
        stays in session memory.
      </Notice>
      <Button label="Save recipient" kind="primary" onPress={save} />
      <Button label="Cancel" onPress={finish} />
    </Page>
  );
}
export function SettingsScreen() {
  const ai = useAI(),
    w = useWellness();
  const [action, setAction] = useState<"signout" | "delete" | "reset" | null>(null);
  const settings: [ScreenId, string][] = [
    [19, "Smartwatch"],
    [12, "Trusted contacts"],
    [13, "Export and sharing"],
    [22, "Conversation history"],
    [23, "Retention and auto-delete"],
    [24, "Remembered details"],
    [16, "Privacy and consent"],
    [8, "Voice tone settings"],
    [10, "Wellness data sources"],
    [17, "Saved information and deletion"],
    [14, "Shared information"],
  ];
  return (
    <Page>
      <Intro
        eyebrow="YOUR PREFERENCES"
        title="Settings and account"
        description="Manage your experience, connected sources, and privacy preferences."
      />
      <Card>
        <Copy kind="heading">Accessibility</Copy>
        <Toggle
          label="Larger text"
          value={ai.model.saved.preferences.largerText}
          onChange={(v) =>
            ai.savePreferences({ ...ai.model.saved.preferences, largerText: v })
          }
        />
        <Toggle
          label="Reduced motion"
          value={ai.model.saved.preferences.reducedMotion}
          onChange={(v) =>
            ai.savePreferences({
              ...ai.model.saved.preferences,
              reducedMotion: v,
            })
          }
        />
      </Card>
      <Card>
        {settings.map(([id, label]) => (
          <Link key={id} id={id} label={label} />
        ))}
      </Card>
      <Button
        label="Add sharing recipient"
        onPress={() => {
          w.setRecipientOrigin("settings");
          go(20);
        }}
      />
      <Notice>
        Account authentication and deletion are not connected in this prototype.
      </Notice>
      <Button label="Sign out of demo" onPress={() => setAction("signout")} />
      <Button
        label="Account deletion information"
        kind="danger"
        onPress={() => setAction("delete")}
      />
      <Button
        label="Reset wellness session"
        onPress={() => setAction("reset")}
      />
      {action ? (
        <Dialog
          title={
            action === "signout"
              ? "Leave the demo?"
              : action === "reset" ? "Reset wellness session?"
                : "Account deletion unavailable"
          }
          onClose={() => setAction(null)}
        >
          <Copy>
            {action === "signout"
              ? "This clears the active conversation and wellness session, then returns to Welcome. Existing saved AI history and preferences remain on this device. No authenticated account is signed out."
              : action === "reset" ? "This removes all sharing recipients and selections in this session, disconnects the demo watch, and resets wearable permissions and sync state. Saved AI conversations and preferences stay on this device. This cannot be undone."
                : "No account deletion backend or security confirmation flow exists yet. Use the team's saved-information destination for future integration. This action does not delete local AI records."}
          </Copy>
          <Button
            label={
              action === "signout"
                ? "Confirm leave demo"
                : action === "reset" ? "Confirm reset wellness session"
                  : "Open saved information"
            }
            kind={action === "reset" ? "danger" : "secondary"}
            onPress={() => {
              setAction(null);
              if (action === "signout") {
                ai.leave();
                w.reset();
                router.replace(route(1));
              } else if (action === "reset") w.reset();
              else go(17);
            }}
          />
        </Dialog>
      ) : null}
    </Page>
  );
}
