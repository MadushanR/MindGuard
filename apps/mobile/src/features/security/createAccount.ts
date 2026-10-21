import copy from "../../../../../packages/fixtures/security/create-account.json";

export interface AccountFields {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}
export type AccountErrors = Partial<Record<keyof AccountFields, string>>;

export function validateAccount(fields: AccountFields): AccountErrors {
  const errors: AccountErrors = {};
  if (!fields.fullName.trim()) errors.fullName = copy.errors.fullName;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim()))
    errors.email = copy.errors.email;
  if (Array.from(fields.password).length < 8)
    errors.password = copy.errors.password;
  if (!fields.confirmPassword)
    errors.confirmPassword = copy.errors.confirmRequired;
  else if (fields.password !== fields.confirmPassword)
    errors.confirmPassword = copy.errors.confirmMismatch;
  return errors;
}

interface AccountState {
  fields: AccountFields;
  showPassword: boolean;
  submitted: boolean;
  success: boolean;
}
type AccountAction =
  | { type: "edit"; field: keyof AccountFields; value: string }
  | { type: "visibility"; value: boolean }
  | { type: "submit" }
  | { type: "close" }
  | { type: "leave" };

export const initialAccountState: AccountState = {
  fields: { fullName: "", email: "", password: "", confirmPassword: "" },
  showPassword: false,
  submitted: false,
  success: false,
};

export function accountReducer(
  state: AccountState,
  action: AccountAction,
): AccountState {
  switch (action.type) {
    case "edit":
      return {
        ...state,
        fields: { ...state.fields, [action.field]: action.value },
      };
    case "visibility":
      return { ...state, showPassword: action.value };
    case "submit":
      if (Object.keys(validateAccount(state.fields)).length)
        return { ...state, submitted: true };
      return { ...initialAccountState, success: true };
    case "close":
      return { ...state, success: false };
    case "leave":
      return {
        ...state,
        fields: { ...state.fields, password: "", confirmPassword: "" },
        showPassword: false,
        submitted: false,
        success: false,
      };
  }
}
