import copy from "../../../../../packages/fixtures/security/sign-in.json";

export interface SignInFields {
  email: string;
  password: string;
}
export type SignInErrors = Partial<Record<keyof SignInFields, string>>;

export function validateSignIn(fields: SignInFields): SignInErrors {
  const errors: SignInErrors = {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim()))
    errors.email = copy.errors.email;
  if (Array.from(fields.password).length < 8)
    errors.password = copy.errors.password;
  return errors;
}

interface SignInState {
  fields: SignInFields;
  showPassword: boolean;
  submitted: boolean;
}
type SignInAction =
  | { type: "edit"; field: keyof SignInFields; value: string }
  | { type: "visibility"; value: boolean }
  | { type: "submit" }
  | { type: "leave" };

export const initialSignInState: SignInState = {
  fields: { email: "", password: "" },
  showPassword: false,
  submitted: false,
};

export function signInReducer(
  state: SignInState,
  action: SignInAction,
): SignInState {
  switch (action.type) {
    case "edit":
      return {
        ...state,
        fields: { ...state.fields, [action.field]: action.value },
      };
    case "visibility":
      return { ...state, showPassword: action.value };
    case "submit":
      return Object.keys(validateSignIn(state.fields)).length
        ? { ...state, submitted: true }
        : initialSignInState;
    case "leave":
      return {
        ...state,
        fields: { ...state.fields, password: "" },
        showPassword: false,
        submitted: false,
      };
  }
}
