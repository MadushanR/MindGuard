import { cleanup, fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AIProvider } from "../../ai";
import demo from "../../../../../../packages/fixtures/security/contact-alert.json";
import { ContactAlertScreen } from "../screens/ContactAlertScreen";
import {
  contactAlertReducer, initialContactAlertState, validateAlert,
} from "../contactAlert";

jest.mock("expo-router", () => ({
  router: { canGoBack: jest.fn(() => false), back: jest.fn(), replace: jest.fn() },
  useFocusEffect: jest.fn(),
}));
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(router.canGoBack).mockReturnValue(false);
});
afterEach(async () => { await cleanup(); });

test("demo JSON has unique fictional recipients and an enabled default", () => {
  expect(new Set(demo.recipients.map((r) => r.id)).size).toBe(demo.recipients.length);
  expect(demo.recipients.find((r) => r.id === demo.defaultRecipientId)?.alertsEnabled).toBe(true);
  expect(demo.recipients.filter((r) => r.alertsEnabled).length).toBeGreaterThan(1);
  expect(demo.recipients.some((r) => !r.alertsEnabled)).toBe(true);
  for (const recipient of demo.recipients) {
    expect(recipient.name.trim()).toBeTruthy();
    expect(typeof recipient.alertsEnabled).toBe("boolean");
  }
  expect(demo.defaultMessage).toBe("Hi, I would appreciate a check-in when you have a moment.");
});

test("review validates recipient, permission, and nonblank message", () => {
  expect(validateAlert(initialContactAlertState)).toEqual({});
  expect(validateAlert({ recipientId: "unknown", message: " " })).toEqual({
    recipient: demo.recipientError, message: demo.messageError,
  });
  const disabled = demo.recipients.find((r) => !r.alertsEnabled)!;
  const blocked = contactAlertReducer({ ...initialContactAlertState, recipientId: disabled.id }, { type: "review" });
  expect(blocked.phase).toBe("editing");
  expect(blocked.snapshot).toBeNull();
  expect(validateAlert(blocked).recipient).toBe(demo.disabledNotice);
});

test("send requires an unchanged reviewed snapshot and ignores repeated sends", () => {
  expect(contactAlertReducer(initialContactAlertState, { type: "send" }).phase).toBe("editing");
  const reviewed = contactAlertReducer(initialContactAlertState, { type: "review" });
  expect(reviewed.snapshot?.message).toBe(demo.defaultMessage);
  expect(contactAlertReducer({ ...reviewed, message: "Changed draft" }, { type: "send" }).phase).not.toBe("sent");
  const edited = contactAlertReducer(reviewed, { type: "editMessage", message: "A new fictional message" });
  expect(contactAlertReducer(edited, { type: "send" }).phase).toBe("editing");
  const sent = contactAlertReducer(reviewed, { type: "send" });
  expect(sent.phase).toBe("sent");
  expect(contactAlertReducer(sent, { type: "send" })).toBe(sent);
  expect(contactAlertReducer(sent, { type: "leave" })).toEqual(initialContactAlertState);
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});

test("send rechecks the recipient's permission after review", () => {
  const reviewed = contactAlertReducer(initialContactAlertState, { type: "review" });
  const recipient = demo.recipients.find((r) => r.id === reviewed.recipientId)!;
  recipient.alertsEnabled = false;
  try {
    expect(contactAlertReducer(reviewed, { type: "send" }).phase).toBe("reviewing");
  } finally { recipient.alertsEnabled = true; }
});

async function openScreen() {
  await render(
    <SafeAreaProvider initialMetrics={{
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets: { top: 0, left: 0, right: 0, bottom: 0 },
    }}>
      <AIProvider><ContactAlertScreen /></AIProvider>
    </SafeAreaProvider>,
  );
}

test("enabled main flow reviews the edited message and explicitly simulates completion", async () => {
  await openScreen();
  expect(screen.getByText(demo.title)).toBeTruthy();
  expect(screen.getByLabelText("Your message").props.value).toBe(demo.defaultMessage);
  expect(screen.queryByText(demo.disabledNotice)).toBeNull();
  await fireEvent.changeText(screen.getByLabelText("Your message"), "A fictional check-in message.");
  await fireEvent.press(screen.getByLabelText("Review alert"));
  expect(screen.getByText("A fictional check-in message.")).toBeTruthy();
  expect(screen.getByText(demo.reviewNotice)).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Send alert"));
  expect(screen.getByText("Review sent")).toBeTruthy();
  expect(screen.getByText(demo.sentDescription)).toBeTruthy();
});

test("recipient selector exposes disabled notice only for the selected disabled recipient", async () => {
  await openScreen();
  await fireEvent.press(screen.getByLabelText("Recipient: Alex Demo"));
  await fireEvent.press(screen.getByLabelText("Morgan Sample"));
  expect(screen.getByText(demo.disabledNotice)).toBeTruthy();
  expect(screen.getByLabelText("Review alert").props.accessibilityState.disabled).toBe(true);
  expect(screen.queryByLabelText("Send alert")).toBeNull();
  await fireEvent.press(screen.getByLabelText("Recipient: Morgan Sample"));
  await fireEvent.press(screen.getByLabelText("Sam Example"));
  expect(screen.queryByText(demo.disabledNotice)).toBeNull();
  expect(screen.getByLabelText("Review alert").props.accessibilityState.disabled).toBe(false);
});

test("blank message is rejected and cancelling review preserves the draft", async () => {
  await openScreen();
  await fireEvent.changeText(screen.getByLabelText("Your message"), "  ");
  await fireEvent.press(screen.getByLabelText("Review alert"));
  expect(screen.getByText(demo.messageError)).toBeTruthy();
  expect(screen.queryByLabelText("Send alert")).toBeNull();
  await fireEvent.changeText(screen.getByLabelText("Your message"), demo.defaultMessage);
  await fireEvent.press(screen.getByLabelText("Review alert"));
  await fireEvent.press(screen.getAllByLabelText("Cancel").at(-1)!);
  expect(screen.queryByText(demo.sentTitle)).toBeNull();
  expect(screen.getByLabelText("Your message").props.value).toBe(demo.defaultMessage);
});

test("screen Cancel uses previous navigation, with Trusted Contacts as direct-entry fallback", async () => {
  await openScreen();
  await fireEvent.press(screen.getByLabelText("Cancel"));
  expect(router.replace).toHaveBeenCalledWith("/trusted-contacts");
  jest.mocked(router.canGoBack).mockReturnValue(true);
  await fireEvent.press(screen.getByLabelText("Cancel"));
  expect(router.back).toHaveBeenCalled();
});
