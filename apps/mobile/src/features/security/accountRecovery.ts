import copy from "../../../../../packages/fixtures/security/account-recovery.json";

export function validateRecoveryEmail(email: string): string | undefined {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ? undefined
    : copy.emailError;
}

interface RecoveryState {
  email: string;
  submitted: boolean;
  confirming: boolean;
}
type RecoveryAction =
  | { type: "edit"; value: string }
  | { type: "submit" }
  | { type: "close" }
  | { type: "leave" };

export const initialRecoveryState: RecoveryState = {
  email: "",
  submitted: false,
  confirming: false,
};

export function recoveryReducer(
  state: RecoveryState,
  action: RecoveryAction,
): RecoveryState {
  switch (action.type) {
    case "edit":
      return { ...state, email: action.value, confirming: false };
    case "submit":
      return {
        ...state,
        submitted: true,
        confirming: !validateRecoveryEmail(state.email),
      };
    case "close":
      return { ...state, confirming: false };
    case "leave":
      return initialRecoveryState;
  }
}
