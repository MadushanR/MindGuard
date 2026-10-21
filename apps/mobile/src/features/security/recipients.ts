import copy from "../../../../../packages/fixtures/security/trusted-contacts.json";

export const RECIPIENT_STORAGE_KEY = "mindguard.synthetic.recipients.v1";
// Screen 20 uses a free-text relationship. Preserve that text without guessing a category.
export type RecipientRelationship = string;
export interface RecipientInput {
  readonly name: string;
  readonly relationship: RecipientRelationship;
}
export interface TrustedRecipient extends RecipientInput {
  readonly id: string;
}

const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export function normalizeRecipient(value: unknown): RecipientInput {
  if (
    !object(value) ||
    !text(value.name) ||
    !text(value.relationship)
  ) throw new Error("Enter a name and relationship.");
  return {
    name: value.name.trim(),
    relationship: value.relationship.trim(),
  };
}

export function recipientRelationshipLabel(relationship: string): string {
  return Object.hasOwn(copy.relationships, relationship)
    ? copy.relationships[relationship as keyof typeof copy.relationships]
    : relationship;
}

export function parseRecipients(raw: string): readonly TrustedRecipient[] {
  const value: unknown = JSON.parse(raw);
  if (!object(value) || value.version !== 1 || !Array.isArray(value.recipients))
    throw new Error("Saved contacts have an unsupported version or structure.");
  const recipients = value.recipients.map((item: unknown) => {
    if (!object(item) || !text(item.id))
      throw new Error("Saved contacts contain an invalid record.");
    return { id: item.id, ...normalizeRecipient(item) };
  });
  if (new Set(recipients.map((item) => item.id)).size !== recipients.length)
    throw new Error("Saved contacts contain duplicate IDs.");
  return recipients;
}

export interface RecipientsState {
  readonly recipients: readonly TrustedRecipient[];
  readonly ready: boolean;
  readonly readError: boolean;
  readonly writeError: boolean;
  readonly saving: boolean;
}
type RecipientsAction =
  | { type: "loading" }
  | { type: "restored"; recipients: readonly TrustedRecipient[] }
  | { type: "readFailed" }
  | { type: "saving" }
  | { type: "added"; recipient: TrustedRecipient }
  | { type: "writeFailed" };
export const initialRecipientsState: RecipientsState = {
  recipients: [], ready: false, readError: false, writeError: false, saving: false,
};
export function recipientsReducer(
  state: RecipientsState,
  action: RecipientsAction,
): RecipientsState {
  switch (action.type) {
    case "loading":
      return { ...state, ready: false, readError: false };
    case "restored":
      return { ...initialRecipientsState, recipients: action.recipients, ready: true };
    case "readFailed":
      return { ...state, ready: false, readError: true };
    case "saving":
      return { ...state, saving: true, writeError: false };
    case "added":
      return { ...state, recipients: [...state.recipients, action.recipient], saving: false, writeError: false };
    case "writeFailed":
      return { ...state, saving: false, writeError: true };
  }
}
