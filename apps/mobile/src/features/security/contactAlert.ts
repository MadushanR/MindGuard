import demo from "../../../../../packages/fixtures/security/contact-alert.json";

export interface AlertDraft {
  recipientId: string;
  message: string;
}
export interface AlertErrors {
  recipient?: string;
  message?: string;
}
interface AlertSnapshot extends AlertDraft {
  recipientName: string;
}
export interface ContactAlertState extends AlertDraft {
  phase: "editing" | "reviewing" | "sent";
  pickerOpen: boolean;
  attempted: boolean;
  snapshot: AlertSnapshot | null;
}
type AlertAction =
  | { type: "openPicker" }
  | { type: "closePicker" }
  | { type: "selectRecipient"; id: string }
  | { type: "editMessage"; message: string }
  | { type: "review" }
  | { type: "cancelReview" }
  | { type: "send" }
  | { type: "leave" };

export function alertRecipient(id: string) {
  return demo.recipients.find((recipient) => recipient.id === id);
}
export function validateAlert(draft: AlertDraft): AlertErrors {
  const errors: AlertErrors = {};
  const recipient = alertRecipient(draft.recipientId);
  if (!recipient) errors.recipient = demo.recipientError;
  else if (!recipient.alertsEnabled) errors.recipient = demo.disabledNotice;
  if (!draft.message.trim()) errors.message = demo.messageError;
  return errors;
}
export const initialContactAlertState: ContactAlertState = {
  recipientId: demo.defaultRecipientId,
  message: demo.defaultMessage,
  phase: "editing",
  pickerOpen: false,
  attempted: false,
  snapshot: null,
};

export function contactAlertReducer(
  state: ContactAlertState,
  action: AlertAction,
): ContactAlertState {
  switch (action.type) {
    case "openPicker":
      return { ...state, pickerOpen: true };
    case "closePicker":
      return { ...state, pickerOpen: false };
    case "selectRecipient":
      return {
        ...state, recipientId: action.id, pickerOpen: false,
        phase: "editing", snapshot: null,
      };
    case "editMessage":
      return { ...state, message: action.message, phase: "editing", snapshot: null };
    case "review": {
      if (Object.keys(validateAlert(state)).length)
        return { ...state, attempted: true, phase: "editing", snapshot: null };
      const recipient = alertRecipient(state.recipientId)!;
      return {
        ...state, attempted: true, phase: "reviewing", pickerOpen: false,
        snapshot: {
          recipientId: recipient.id,
          recipientName: recipient.name,
          message: state.message,
        },
      };
    }
    case "cancelReview":
      return { ...state, phase: "editing", snapshot: null };
    case "send":
      if (
        state.phase !== "reviewing" || !state.snapshot ||
        state.snapshot.recipientId !== state.recipientId ||
        state.snapshot.message !== state.message ||
        Object.keys(validateAlert(state.snapshot)).length
      ) return state;
      // Intentionally no network, storage, notification, or sharing side effect.
      return { ...state, phase: "sent", snapshot: null };
    case "leave":
      return initialContactAlertState;
  }
}
