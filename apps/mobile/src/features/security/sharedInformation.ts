export interface ShareInput {
  readonly destination?: import("@mindguard/contracts").ShareDestination;
  readonly recipientName: string;
  readonly content: readonly string[];
}
/**
 * Revocation in progress, last attempt failed (access unchanged), or no answer arrived
 * (outcome unknown: access may or may not have ended). Absent means access is active.
 */
export type RevocationState = "pending" | "failed" | "unknown";
export interface SharedInformationRecord extends ShareInput {
  readonly id: string;
  readonly createdAt: number;
  /** Request that created this record through the sharing service, when one was used. */
  readonly requestId?: string;
  readonly revocation?: RevocationState;
}
type ShareAction =
  | { type: "record"; record: SharedInformationRecord }
  | { type: "revocation"; id: string; state: RevocationState | undefined }
  | { type: "revoke"; id: string }
  | { type: "clear" };

export function normalizeShare(input: ShareInput): ShareInput {
  if (
    !input || typeof input.recipientName !== "string" || !input.recipientName.trim() ||
    !Array.isArray(input.content) || input.content.length === 0 ||
    input.content.some((line) => typeof line !== "string" || !line.trim())
  ) throw new Error("A demo share requires a recipient name and confirmed content.");
  // Copy only permitted fields so later edits never change a confirmed snapshot.
  return {
    recipientName: input.recipientName.trim(),
    content: input.content.map((line) => line.trim()),
    ...(input.destination ? { destination: { ...input.destination } } : {}),
  };
}

export function sharedInformationReducer(
  records: readonly SharedInformationRecord[],
  action: ShareAction,
): readonly SharedInformationRecord[] {
  switch (action.type) {
    case "record":
      return records.some((record) => record.id === action.record.id ||
        (!!action.record.requestId && record.requestId === action.record.requestId))
        ? records
        : [action.record, ...records];
    case "revocation":
      return records.map((record) => record.id === action.id
        ? { ...record, revocation: action.state }
        : record);
    case "revoke":
      return records.filter((record) => record.id !== action.id);
    case "clear":
      return [];
  }
}
