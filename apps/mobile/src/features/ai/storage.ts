import type { SavedData } from "@mindguard/contracts";
export const STORAGE_KEY = "mindguard.synthetic.v1";
const emotions = ["Calm", "Tense", "Low", "Hopeful"];
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const time = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && v >= 0;
const array = (
  v: unknown,
  validate: (r: Record<string, unknown>) => boolean,
): boolean =>
  Array.isArray(v) &&
  v.every((r) => object(r) && text(r.id) && validate(r)) &&
  new Set(v.map((r) => r.id)).size === v.length;
export function parseSaved(raw: string): SavedData {
  const v: unknown = JSON.parse(raw);
  if (
    !object(v) ||
    v.version !== 1 ||
    !object(v.preferences) ||
    !object(v.consent)
  )
    throw new Error("Saved data has an unsupported version or structure.");
  const p = v.preferences,
    c = v.consent;
  const valid =
    [
      "saveHistory",
      "saveVoiceTranscripts",
      "reducedMotion",
      "largerText",
    ].every((k) => typeof p[k] === "boolean") &&
    [null, 7, 30, 90, "manual"].includes(p.retentionDays as null) &&
    (!p.saveHistory || p.retentionDays !== null) &&
    ["voice", "tone", "chatObservations"].every(
      (k) => typeof c[k] === "boolean",
    ) &&
    (!c.tone || c.voice);
  if (
    !valid ||
    !array(
      v.conversations,
      (r) =>
        text(r.title) &&
        time(r.createdAt) &&
        time(r.updatedAt) &&
        array(
          r.messages,
          (m) =>
            text(m.text) &&
            ["user", "assistant"].includes(m.role as string) &&
            ["text", "voice"].includes(m.mode as string) &&
            time(m.createdAt),
        ),
    ) ||
    !array(
      v.observations,
      (r) =>
        time(r.createdAt) &&
        ["Chat", "Voice tone"].includes(r.source as string) &&
        emotions.includes(r.predictedLabel as string) &&
        (r.correctedLabel === undefined ||
          emotions.includes(r.correctedLabel as string)) &&
        (r.status === "Corrected") === (r.correctedLabel !== undefined) &&
        ["Estimated", "Confirmed", "Corrected"].includes(r.status as string) &&
        typeof r.dismissed === "boolean" &&
        typeof r.confidence === "number" &&
        r.confidence >= 0 &&
        r.confidence <= 1 &&
        (r.conversationId === undefined || text(r.conversationId)),
    ) ||
    !array(
      v.memories,
      (r) =>
        text(r.text) &&
        time(r.createdAt) &&
        (r.conversationId === undefined || text(r.conversationId)),
    )
  )
    throw new Error("Saved data contains invalid preferences or records.");
  // Reconstruct the allowed persisted fields so unknown/session-only fields never propagate.
  return {
    version: 1,
    preferences: p,
    consent: c,
    conversations: v.conversations,
    observations: v.observations,
    memories: v.memories,
  } as unknown as SavedData;
}
export class StorageQueue {
  private tail: Promise<void> = Promise.resolve();
  private revision = 0;
  constructor(private write: (key: string, value: string) => Promise<void>) {}
  save(data: SavedData, result: (error: string | null) => void) {
    const revision = ++this.revision,
      serialized = JSON.stringify(data);
    this.tail = this.tail
      .catch(() => {})
      .then(() => this.write(STORAGE_KEY, serialized))
      .then(
        () => {
          if (revision === this.revision) result(null);
        },
        (error) => {
          if (revision === this.revision)
            result(
              error instanceof Error ? error.message : "Storage unavailable",
            );
        },
      );
    return this.tail;
  }
  flush() {
    return this.tail;
  }
}
