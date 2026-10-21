export interface ShareInput {
  readonly recipientName: string;
  readonly content: readonly string[];
}
export interface SharedInformationRecord extends ShareInput {
  readonly id: string;
  readonly createdAt: number;
}
type ShareAction =
  | { type: "record"; record: SharedInformationRecord }
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
  };
}

export function sharedInformationReducer(
  records: readonly SharedInformationRecord[],
  action: ShareAction,
): readonly SharedInformationRecord[] {
  switch (action.type) {
    case "record":
      return records.some((record) => record.id === action.record.id)
        ? records
        : [action.record, ...records];
    case "revoke":
      return records.filter((record) => record.id !== action.id);
    case "clear":
      return [];
  }
}
