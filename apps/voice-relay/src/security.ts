import { createHash, randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, TransactWriteCommand, DeleteCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import express, { type Request } from "express";
import type { AccountPreferences, AccountShare, SecuritySnapshot } from "../../../packages/contracts/src/security.js";

export class SecurityError extends Error {
  constructor(readonly code: string, readonly status = 400) { super(code); }
}
const defaults: AccountPreferences = { wellnessData: false, saveSummaries: false, sharing: false, contactNotifications: false };
type Reference = { owner: string; id: string };
export interface AccountDocument {
  rev: number;
  status: "active" | "deleting" | "deleted";
  email?: string;
  preferences: AccountPreferences;
  contacts: SecuritySnapshot["contacts"];
  saved: SecuritySnapshot["saved"];
  outgoing: AccountShare[];
  incoming: Reference[];
  alerts: (SecuritySnapshot["alerts"][number] & { fingerprint: string })[];
  alertSenders: string[];
  alertTargets: string[];
}
export const emptyAccount = (): AccountDocument => ({ rev: 0, status: "active", preferences: { ...defaults }, contacts: [], saved: [], outgoing: [], incoming: [], alerts: [], alertSenders: [], alertTargets: [] });
export interface SecurityStore {
  read(owner: string): Promise<AccountDocument>;
  write(changes: { owner: string; before: AccountDocument; after: AccountDocument }[]): Promise<void>;
  register(email: string, owner: string): Promise<void>;
  resolve(email: string): Promise<string | undefined>;
  forget(email: string): Promise<void>;
  eraseMetadata?(owner: string): Promise<void>;
}
const directoryKey = (email: string) => ({ pk: `SECURITY_EMAIL#${createHash("sha256").update(email).digest("hex")}`, sk: "DIRECTORY" });
export class DynamoSecurityStore implements SecurityStore {
  private db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  constructor(private table: string) {}
  async read(owner: string) {
    const result = await this.db.send(new GetCommand({ TableName: this.table, Key: { pk: `USER#${owner}`, sk: "SECURITY_V1" }, ConsistentRead: true }));
    return result.Item ? result.Item.document as AccountDocument : emptyAccount();
  }
  async write(changes: { owner: string; before: AccountDocument; after: AccountDocument }[]) {
    for (const change of changes) {
      if (Buffer.byteLength(JSON.stringify(change.after)) > 240000) throw new SecurityError("ACCOUNT_CAPACITY_REACHED", 409);
    }
    await this.db.send(new TransactWriteCommand({ TransactItems: changes.map(({ owner, before, after }) => ({ Put: {
      TableName: this.table,
      Item: { pk: `USER#${owner}`, sk: "SECURITY_V1", revision: before.rev + 1, document: { ...after, rev: before.rev + 1 } },
      ConditionExpression: before.rev ? "revision = :revision" : "attribute_not_exists(pk)",
      ...(before.rev ? { ExpressionAttributeValues: { ":revision": before.rev } } : {}),
    } })) }));
  }
  async register(email: string, owner: string) {
    await this.db.send(new PutCommand({ TableName: this.table, Item: { ...directoryKey(email), owner },
      ConditionExpression: "attribute_not_exists(pk) OR #owner = :owner",
      ExpressionAttributeNames: { "#owner": "owner" }, ExpressionAttributeValues: { ":owner": owner } }));
  }
  async resolve(email: string) {
    const r = await this.db.send(new GetCommand({ TableName: this.table, Key: directoryKey(email), ConsistentRead: true }));
    return r.Item?.owner as string | undefined;
  }
  async forget(email: string) { await this.db.send(new DeleteCommand({ TableName: this.table, Key: directoryKey(email) })); }
  async eraseMetadata(owner: string) {
    let cursor: Record<string, any> | undefined;
    do {
      const page = await this.db.send(new QueryCommand({ TableName: this.table,
        KeyConditionExpression: "pk = :owner", ExpressionAttributeValues: { ":owner": `USER#${owner}` },
        ProjectionExpression: "pk, sk", ConsistentRead: true, Limit: 100, ExclusiveStartKey: cursor }));
      for (const key of page.Items ?? []) if (key.sk !== "SECURITY_V1") await this.db.send(new DeleteCommand({ TableName: this.table, Key: key }));
      cursor = page.LastEvaluatedKey;
    } while (cursor);
  }
}
const emailAddress = (v: unknown) => {
  if (typeof v !== "string" || v.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new SecurityError("INVALID_EMAIL");
  return v.trim().toLowerCase();
};
const text = (v: unknown, max = 120) => {
  if (typeof v !== "string" || !v.trim() || v.length > max) throw new SecurityError("INVALID_PAYLOAD");
  return v.trim();
};
const active = (state: AccountDocument) => { if (state.status !== "active") throw new SecurityError("ACCOUNT_DELETING", 403); };
const capacity = (length: number) => { if (length >= 25) throw new SecurityError("ACCOUNT_CAPACITY_REACHED", 409); };
// DynamoDB maps do not preserve object-key insertion order. Compare semantic fields.
const shareFingerprint = (destination: AccountShare["destination"], content: readonly string[]) =>
  JSON.stringify([[destination.id, destination.name, destination.email, destination.relationship], content]);
function permittedContent(value: unknown): value is string[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > 4 ||
    typeof value[0] !== "string" || !/^Source: synthetic demo records from [^\r\n]{1,120} · Synthetic demo week · Monday–Sunday · not live measurements\.$/.test(value[0])) return false;
  const seen = new Set<string>();
  const units: Record<string, string> = { Steps: "steps", Sleep: "hours", "Resting heart rate": "bpm" };
  for (const line of value.slice(1)) {
    if (typeof line !== "string" || line.length > 1000) return false;
    const match = line.match(/^(Steps|Sleep|Resting heart rate): ([\d., ]+) (steps|hours|bpm) \(Mon–Sun\); daily average ([\d.]+) (steps|hours|bpm)\.$/);
    if (!match || seen.has(match[1]) || units[match[1]] !== match[3] || match[3] !== match[5]) return false;
    const values = match[2].split(", ").map(Number);
    if (values.length !== 7 || values.some(n => !Number.isFinite(n) || n < 0 || n > 10000000)) return false;
    if ((values.reduce((a, b) => a + b, 0) / 7).toFixed(match[1] === "Steps" ? 0 : 1) !== match[4]) return false;
    seen.add(match[1]);
  }
  return true;
}

/** Bounded account aggregates avoid scans, indexes, polling and new AWS resources. */
export class SecurityApplication {
  constructor(readonly store: SecurityStore) {}
  async mutate<T>(owners: string[], action: (docs: AccountDocument[]) => T): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt++) {
      const before = await Promise.all(owners.map(owner => this.store.read(owner)));
      const after = structuredClone(before);
      const result = action(after);
      try {
        await this.store.write(owners.map((owner, i) => ({ owner, before: before[i], after: after[i] })));
        return result;
      } catch (e) {
        if (!(e instanceof Error) || !["TransactionCanceledException", "ConditionalCheckFailedException"].includes(e.name)) throw e;
      }
    }
    throw new SecurityError("CONCURRENT_CHANGE", 409);
  }
  async register(owner: string, email: string) {
    email = emailAddress(email);
    await this.mutate([owner], ([s]) => { active(s); s.email = email; });
    await this.store.register(email, owner);
    return { owner, email };
  }
  async preferences(owner: string, input: unknown) {
    if (!input || typeof input !== "object") throw new SecurityError("INVALID_CONSENT");
    const value = input as Record<string, unknown>;
    if (Object.keys(value).length !== 4 || Object.keys(defaults).some(k => typeof value[k] !== "boolean")) throw new SecurityError("INVALID_CONSENT");
    return this.mutate([owner], ([s]) => { active(s); s.preferences = { ...value } as unknown as AccountPreferences; return s.preferences; });
  }
  async createShare(owner: string, input: any) {
    const requestId = text(input.requestId, 160);
    const d = input.destination;
    if (!d || Object.keys(d).sort().join() !== "email,id,name,relationship") throw new SecurityError("INVALID_DESTINATION");
    const destination = { id: text(d.id), name: text(d.name), email: emailAddress(d.email), relationship: text(d.relationship) };
    // The only approved payload is Zain's selected synthetic wearable summary.
    if (!permittedContent(input.content)) throw new SecurityError("INVALID_CONTENT");
    const content = [...input.content] as string[];
    const target = await this.store.resolve(destination.email);
    if (!target || target === owner) throw new SecurityError("RECIPIENT_UNAVAILABLE", 409);
    return this.mutate([owner, target], ([sender, recipient]) => {
      active(sender); active(recipient);
      if (recipient.email !== destination.email) throw new SecurityError("RECIPIENT_UNAVAILABLE", 409);
      const prior = sender.outgoing.find(s => s.requestId === requestId);
      if (prior) {
        if (shareFingerprint(prior.destination, prior.content) !== shareFingerprint(destination, content)) throw new SecurityError("CONFLICT", 409);
        return prior;
      }
      if (!sender.preferences.sharing || !sender.preferences.wellnessData) throw new SecurityError("CONSENT_REQUIRED", 403);
      capacity(sender.outgoing.length); capacity(recipient.incoming.length);
      const share: AccountShare = { id: randomUUID(), requestId, recipientName: destination.name, recipientAccountId: target, destination, content, createdAt: Date.now(), revoked: false, executionMode: "live" };
      sender.outgoing.unshift(share);
      recipient.incoming.unshift({ owner, id: share.id });
      return share;
    });
  }
  async revoke(owner: string, id: string) {
    return this.mutate([owner], ([s]) => {
      active(s);
      const share = s.outgoing.find(r => r.id === id);
      if (!share) throw new SecurityError("NOT_FOUND", 404);
      share.revoked = true;
      return { status: "complete", executionMode: "live" };
    });
  }
  async snapshot(owner: string): Promise<SecuritySnapshot> {
    const s = await this.store.read(owner); active(s);
    const incoming: SecuritySnapshot["incoming"] = [];
    for (const ref of s.incoming) {
      const sender = await this.store.read(ref.owner);
      const share = sender.outgoing.find(r => r.id === ref.id && r.recipientAccountId === owner && !r.revoked);
      if (sender.status === "active" && share) incoming.push({ ...share, sender: sender.email ?? ref.owner });
    }
    return { preferences: s.preferences, contacts: s.contacts, saved: s.saved, outgoing: s.outgoing,
      incoming, alerts: s.alerts.map(({ fingerprint: _, ...alert }) => alert), alertSenders: s.alertSenders };
  }
  async contact(owner: string, input: any) {
    const contact = { id: text(input.id, 160), name: text(input.name), relationship: text(input.relationship) };
    return this.mutate([owner], ([s]) => {
      active(s);
      const prior = s.contacts.find(r => r.id === contact.id);
      if (prior) { if (prior.name !== contact.name || prior.relationship !== contact.relationship) throw new SecurityError("CONFLICT", 409); return prior; }
      capacity(s.contacts.length); s.contacts.push(contact); return contact;
    });
  }
  async saved(owner: string, input: any, deleting = false) {
    if (!Array.isArray(input.categories) || !input.categories.length || input.categories.length > 2 ||
      input.categories.some((c: any) => !["weekly-summary", "wellness-records"].includes(deleting ? c : c?.id))) throw new SecurityError("INVALID_PAYLOAD");
    return this.mutate([owner], ([s]) => {
      active(s);
      if (deleting) s.saved = s.saved.filter(c => !input.categories.includes(c.id));
      else {
        if (!s.preferences.wellnessData || !s.preferences.saveSummaries) throw new SecurityError("CONSENT_REQUIRED", 403);
        s.saved = input.categories.map((c: any) => {
          if (!Array.isArray(c.content) || !c.content.length || c.content.length > 10) throw new SecurityError("INVALID_PAYLOAD");
          return { id: c.id, label: text(c.label), weekLabel: text(c.weekLabel), content: c.content.map((v: unknown) => text(v, 1800)) };
        });
      }
      return s.saved;
    });
  }
  async alertPermission(owner: string, input: any) {
    const email = emailAddress(input.email);
    if (typeof input.allowed !== "boolean") throw new SecurityError("INVALID_PAYLOAD");
    return this.mutate([owner], ([s]) => {
      active(s); s.alertSenders = s.alertSenders.filter(e => e !== email);
      if (input.allowed) { capacity(s.alertSenders.length); s.alertSenders.push(email); }
      return s.alertSenders;
    });
  }
  async alert(owner: string, input: any) {
    const email = emailAddress(input.email), id = text(input.requestId, 160), message = text(input.message, 1000);
    const target = await this.store.resolve(email);
    if (!target || target === owner) throw new SecurityError("RECIPIENT_UNAVAILABLE", 409);
    return this.mutate([owner, target], ([sender, recipient]) => {
      active(sender); active(recipient);
      const fingerprint = JSON.stringify([owner, message]);
      const prior = recipient.alerts.find(a => a.id === id);
      if (prior) { if (prior.fingerprint !== fingerprint) throw new SecurityError("CONFLICT", 409); return { status: "complete" }; }
      if (!sender.preferences.contactNotifications || !recipient.preferences.contactNotifications || !sender.email || !recipient.alertSenders.includes(sender.email)) throw new SecurityError("ALERT_PERMISSION_REQUIRED", 403);
      capacity(recipient.alerts.length);
      if (!sender.alertTargets.includes(target)) { capacity(sender.alertTargets.length); sender.alertTargets.push(target); }
      recipient.alerts.unshift({ id, message, sender: sender.email, createdAt: Date.now(), fingerprint });
      return { status: "complete" };
    });
  }
  async deleteData(owner: string) {
    await this.mutate([owner], ([s]) => { if (s.status !== "deleted") s.status = "deleting"; });
    const state = await this.store.read(owner);
    // Remove incoming references and owned shares involving this account. All lists are bounded.
    const peers = new Set([...state.incoming.map(r => r.owner), ...state.alertTargets]);
    for (const share of state.outgoing) if (share.recipientAccountId) peers.add(share.recipientAccountId);
    for (const peer of peers) if (peer !== owner) await this.mutate([peer], ([s]) => {
      s.incoming = s.incoming.filter(r => r.owner !== owner);
      s.outgoing = s.outgoing.filter(r => r.recipientAccountId !== owner);
      s.alertSenders = s.alertSenders.filter(e => e !== state.email);
      s.alerts = s.alerts.filter(a => a.sender !== state.email);
    });
    if (state.email) await this.store.forget(state.email);
    await this.store.eraseMetadata?.(owner);
    // Keep the deleting marker and peer metadata until Cognito confirms removal;
    // this lets the same authenticated deletion safely resume after a failure.
  }
}

export function securityRouter(service: SecurityApplication, authenticate: (token: string) => Promise<{ owner: string; email: string }>, cognito: (operation: string, token: string) => Promise<void>, shutdown: (owner: string) => void, deletionEnabled = false) {
  const api = express.Router();
  type Auth = Request & { identity?: { owner: string; email: string }; token?: string };
  api.use(async (req: Auth, res, next) => {
    try {
      const token = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
      if (!token) throw new SecurityError("AUTH_REQUIRED", 401);
      req.identity = await authenticate(token); req.token = token;
      const state = await service.store.read(req.identity.owner);
      if (state.status !== "active" && !(req.method === "DELETE" && req.path === "/account")) throw new SecurityError("ACCOUNT_DELETING", 403);
      res.setHeader("Cache-Control", "no-store"); next();
    } catch (e) { next(e); }
  });
  const route = (method: "get" | "post" | "put" | "delete", path: string, action: (r: Auth) => Promise<unknown>) => api[method](path, async (req: Auth, res, next) => {
    try { res.json(await action(req)); } catch (e) { next(e); }
  });
  route("post", "/session", r => service.register(r.identity!.owner, r.identity!.email));
  route("get", "/snapshot", async r => ({ ...await service.snapshot(r.identity!.owner), accountDeletionAvailable: deletionEnabled }));
  route("put", "/consent", r => service.preferences(r.identity!.owner, r.body));
  route("post", "/contacts", r => service.contact(r.identity!.owner, r.body));
  route("put", "/saved", r => service.saved(r.identity!.owner, r.body));
  route("delete", "/saved", r => service.saved(r.identity!.owner, r.body, true));
  route("post", "/shares", r => service.createShare(r.identity!.owner, r.body));
  route("get", "/shares/status/:requestId", async r => {
    const s = await service.snapshot(r.identity!.owner);
    return { share: s.outgoing.find(v => v.requestId === r.params.requestId) ?? null };
  });
  route("delete", "/shares/:id", r => service.revoke(r.identity!.owner, String(r.params.id)));
  route("put", "/alerts/permission", r => service.alertPermission(r.identity!.owner, r.body));
  route("post", "/alerts", r => service.alert(r.identity!.owner, r.body));
  route("post", "/logout", async r => { shutdown(r.identity!.owner); await cognito("GlobalSignOut", r.token!); return { status: "complete" }; });
  route("delete", "/account", async r => {
    if (!deletionEnabled) throw new SecurityError("ACCOUNT_DELETION_DISABLED", 409);
    shutdown(r.identity!.owner);
    await service.deleteData(r.identity!.owner);
    await cognito("DeleteUser", r.token!);
    await service.mutate([r.identity!.owner], ([s]) => { Object.assign(s, emptyAccount(), { rev: s.rev, status: "deleted" }); });
    return { status: "complete" };
  });
  api.use((e: Error, _req: Request, res: express.Response, _next: express.NextFunction) => {
    res.status(e instanceof SecurityError ? e.status : 503).json({ code: e instanceof SecurityError ? e.code : "SERVICE_UNAVAILABLE" });
  });
  return api;
}
