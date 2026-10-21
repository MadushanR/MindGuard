import { cleanup, fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AIProvider } from "../../ai";
import copy from "../../../../../../packages/fixtures/security/account-recovery.json";
import { AccountRecoveryScreen } from "../screens/AccountRecoveryScreen";
import {
  initialRecoveryState,
  recoveryReducer,
  validateRecoveryEmail,
} from "../accountRecovery";

jest.mock("expo-router", () => ({
  router: { replace: jest.fn() },
  useFocusEffect: jest.fn(),
}));

afterEach(async () => {
  await cleanup();
  jest.clearAllMocks();
});

test("recovery validates email format without checking account existence", () => {
  expect(validateRecoveryEmail(" alex@example.com ")).toBeUndefined();
  for (const value of ["", "  ", "alex@", "alex@example", "alex @example.com"])
    expect(validateRecoveryEmail(value)).toBe(copy.emailError);
});

test("confirmation requires valid input and clears when editing or leaving", () => {
  expect(recoveryReducer(initialRecoveryState, { type: "submit" })).toEqual({
    ...initialRecoveryState,
    submitted: true,
  });
  const confirmed = recoveryReducer(
    { ...initialRecoveryState, email: "alex@example.com" },
    { type: "submit" },
  );
  expect(confirmed.confirming).toBe(true);
  expect(recoveryReducer(confirmed, { type: "close" }).confirming).toBe(false);
  expect(recoveryReducer(confirmed, { type: "edit", value: "alex@" }).confirming).toBe(false);
  expect(recoveryReducer(confirmed, { type: "leave" })).toEqual(initialRecoveryState);
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
        <AccountRecoveryScreen />
      </AIProvider>
    </SafeAreaProvider>,
  );
}

test("invalid email shows an error without opening confirmation", async () => {
  await openForm();
  expect(screen.getByText("Let's get you back in.")).toBeTruthy();
  expect(screen.getByPlaceholderText("you@example.com")).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Send recovery code"));
  expect(screen.getByText(copy.emailError)).toBeTruthy();
  expect(screen.queryByText(copy.confirmationTitle)).toBeNull();
  expect(router.replace).not.toHaveBeenCalled();
});

test("keyboard submission shows the demo dialog; cancel allows another request", async () => {
  await openForm();
  await fireEvent.changeText(screen.getByLabelText("Email address"), "alex@example.com");
  await fireEvent(screen.getByLabelText("Email address"), "submitEditing");
  expect(screen.getByText(copy.confirmationDescription)).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Cancel"));
  expect(screen.queryByText(copy.confirmationTitle)).toBeNull();
  await fireEvent.press(screen.getByLabelText("Send recovery code"));
  expect(screen.getByText(copy.confirmationTitle)).toBeTruthy();
  await fireEvent.press(screen.getAllByLabelText("Back to sign in").at(-1)!);
  expect(router.replace).toHaveBeenCalledWith("/sign-in");
  expect(screen.getByLabelText("Email address").props.value).toBe("");
});

test("the form's Back to sign in action opens Screen 03", async () => {
  await openForm();
  await fireEvent.press(screen.getByLabelText("Back to sign in"));
  expect(router.replace).toHaveBeenCalledWith("/sign-in");
});
