import { cleanup, fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AIProvider } from "../../ai";
import { CreateAccountScreen } from "../screens/CreateAccountScreen";
import {
  accountReducer,
  initialAccountState,
  validateAccount,
  type AccountFields,
} from "../createAccount";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useFocusEffect: jest.fn(),
}));

const valid: AccountFields = {
  fullName: "Alex Demo",
  email: "alex@example.com",
  password: "demo1234",
  confirmPassword: "demo1234",
};

afterEach(async () => {
  await cleanup();
  jest.clearAllMocks();
});

test("validation accepts a single name and trimmed email without extra password rules", () => {
  expect(
    validateAccount({ ...valid, fullName: "Alex", email: " alex@example.com " }),
  ).toEqual({});
  expect(validateAccount({ ...valid, password: "1234567" }).password).toBeTruthy();
  expect(validateAccount({
    ...valid,
    fullName: "  ",
    email: "alex@",
    confirmPassword: "different",
  })).toMatchObject({
    fullName: expect.any(String),
    email: expect.any(String),
    confirmPassword: expect.any(String),
  });
  expect(
    validateAccount({ ...valid, confirmPassword: "" }).confirmPassword,
  ).toBeTruthy();
});

test("success clears all entries and leaving clears passwords and visibility", () => {
  const filled = { ...initialAccountState, fields: valid, showPassword: true };
  expect(accountReducer(filled, { type: "submit" })).toEqual({
    ...initialAccountState,
    success: true,
  });
  const left = accountReducer(filled, { type: "leave" });
  expect(left.fields).toEqual({ ...valid, password: "", confirmPassword: "" });
  expect(left.showPassword).toBe(false);
  expect(accountReducer(initialAccountState, { type: "submit" }).success).toBe(false);
});

async function openForm() {
  await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <AIProvider>
        <CreateAccountScreen />
      </AIProvider>
    </SafeAreaProvider>,
  );
}

test("the form reports errors, reveals both passwords, and offers simulated success", async () => {
  await openForm();
  await fireEvent.press(screen.getByLabelText("Create account"));
  expect(screen.getByText("Enter your full name.")).toBeTruthy();
  expect(screen.queryByText("Demo form complete")).toBeNull();
  for (const [label, value] of [
    ["Full name", valid.fullName],
    ["Email address", valid.email],
    ["Password", valid.password],
    ["Confirm password", valid.confirmPassword],
  ]) {
    await fireEvent.changeText(screen.getByLabelText(label), value);
  }
  expect(screen.getByLabelText("Password").props.secureTextEntry).toBe(true);
  await fireEvent(screen.getByLabelText("Show passwords"), "valueChange", true);
  expect(screen.getByLabelText("Password").props.secureTextEntry).toBe(false);
  expect(screen.getByLabelText("Confirm password").props.secureTextEntry).toBe(
    false,
  );
  await fireEvent.press(screen.getByLabelText("Create account"));
  expect(screen.getByText("Demo form complete")).toBeTruthy();
  expect(screen.getByLabelText("Password").props.value).toBe("");
  await fireEvent.press(screen.getByLabelText("Continue to Sign In"));
  expect(router.replace).toHaveBeenCalledWith("/sign-in");
});

test("privacy and sign-in actions use the registered routes", async () => {
  await openForm();
  await fireEvent.press(screen.getByLabelText("Privacy and Consent"));
  expect(router.push).toHaveBeenCalledWith("/privacy");
  await fireEvent.press(screen.getByLabelText("Sign in"));
  expect(router.push).toHaveBeenCalledWith("/sign-in");
});
