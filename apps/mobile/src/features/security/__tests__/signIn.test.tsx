import { cleanup, fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AIProvider } from "../../ai";
import { SignInScreen } from "../screens/SignInScreen";
import { initialSignInState, signInReducer, validateSignIn } from "../signIn";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useFocusEffect: jest.fn(),
}));
jest.mock("../../../shared/ui", () => ({
  ...jest.requireActual("../../../shared/ui"),
  ZenOrb: () => null,
}));

afterEach(async () => {
  await cleanup();
  jest.clearAllMocks();
});

test("sign-in accepts any valid email and eight-character demo password", () => {
  expect(validateSignIn({ email: " alex@example.com ", password: "12345678" })).toEqual({});
  expect(validateSignIn({ email: "alex@", password: "1234567" })).toEqual({
    email: expect.any(String),
    password: expect.any(String),
  });
  expect(validateSignIn({ email: "", password: "" })).toEqual({
    email: expect.any(String),
    password: expect.any(String),
  });
});

test("leaving clears the password and visibility; valid submission clears entries", () => {
  const filled = {
    ...initialSignInState,
    fields: { email: "alex@example.com", password: "demo1234" },
    showPassword: true,
  };
  expect(signInReducer(filled, { type: "leave" })).toEqual({
    ...initialSignInState,
    fields: { email: "alex@example.com", password: "" },
  });
  expect(signInReducer(filled, { type: "submit" })).toEqual(initialSignInState);
  expect(signInReducer(initialSignInState, { type: "submit" }).submitted).toBe(true);
});

async function openForm() {
  await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <AIProvider><SignInScreen /></AIProvider>
    </SafeAreaProvider>,
  );
}

test("invalid submission stays on the form and reports specific errors", async () => {
  await openForm();
  expect(screen.getByText("Welcome back.")).toBeTruthy();
  expect(screen.getByText("Pick up where you left off.")).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Sign in"));
  expect(router.replace).not.toHaveBeenCalled();
  expect(screen.getByText("Enter a valid email address, such as alex@example.com.")).toBeTruthy();
  expect(screen.getByText("Use a password with at least 8 characters.")).toBeTruthy();
});

test("visibility toggles and keyboard submission opens Home without a dialog", async () => {
  await openForm();
  await fireEvent.changeText(screen.getByLabelText("Email address"), "alex@example.com");
  await fireEvent.changeText(screen.getByLabelText("Password"), "demo1234");
  expect(screen.getByLabelText("Password").props.secureTextEntry).toBe(true);
  await fireEvent(screen.getByLabelText("Show password"), "valueChange", true);
  expect(screen.getByLabelText("Password").props.secureTextEntry).toBe(false);
  await fireEvent(screen.getByLabelText("Password"), "submitEditing");
  expect(router.replace).toHaveBeenCalledWith("/home");
  expect(screen.getByLabelText("Password").props.value).toBe("");
  expect(screen.getByLabelText("Email address").props.value).toBe("");
});

test("recovery and account creation use existing screen routes", async () => {
  await openForm();
  await fireEvent.press(screen.getByLabelText("Forgot password?"));
  expect(router.push).toHaveBeenCalledWith("/account-recovery");
  await fireEvent.press(screen.getByLabelText("Create an account"));
  expect(router.push).toHaveBeenCalledWith("/create-account");
});
