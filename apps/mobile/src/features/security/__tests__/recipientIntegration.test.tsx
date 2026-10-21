import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AIProvider } from "../../ai";
import { WellnessProvider, WellnessScreen } from "../../wellness";
import { RecipientsProvider, SharedInformationProvider } from "..";
import { RECIPIENT_STORAGE_KEY, parseRecipients } from "../recipients";

let mockOrigin: string | undefined;
const originalWrite = jest.mocked(AsyncStorage.setItem).getMockImplementation()!;
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), canGoBack: () => false },
  useLocalSearchParams: () => ({ origin: mockOrigin }),
  useFocusEffect: jest.fn(),
}));

beforeEach(async () => {
  mockOrigin = undefined;
  jest.clearAllMocks();
  jest.mocked(AsyncStorage.setItem).mockImplementation(originalWrite);
  await AsyncStorage.clear();
});
afterEach(async () => {
  await cleanup();
  jest.restoreAllMocks();
});

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaProvider initialMetrics={{
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
    }}>
      <AIProvider><WellnessProvider><RecipientsProvider><SharedInformationProvider>
        {children}
      </SharedInformationProvider></RecipientsProvider></WellnessProvider></AIProvider>
    </SafeAreaProvider>
  );
}

async function fillName() {
  await fireEvent.changeText(screen.getByLabelText("Full name"), "Alex Demo");
  await fireEvent.changeText(screen.getByLabelText("Relationship"), "My neighbour");
}

test("Trusted Contacts entry saves only name and free-text relationship and returns to Screen 12", async () => {
  mockOrigin = "trusted-contacts";
  await render(<WellnessScreen id={20} />, { wrapper: Wrapper });
  await waitFor(() => expect(screen.getByLabelText("Save recipient").props.accessibilityState.disabled).toBe(false));
  expect(screen.queryByLabelText("Email")).toBeNull();
  await fireEvent.press(screen.getByLabelText("Save recipient"));
  expect(screen.getByText("Enter a full name.")).toBeTruthy();
  expect(router.replace).not.toHaveBeenCalled();
  await fillName();
  await fireEvent.press(screen.getByLabelText("Save recipient"));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/trusted-contacts"));
  const contacts = parseRecipients((await AsyncStorage.getItem(RECIPIENT_STORAGE_KEY))!);
  expect(contacts).toEqual([{ id: expect.any(String), name: "Alex Demo", relationship: "My neighbour" }]);
});

test("trusted save failure keeps the draft for retry without a duplicate", async () => {
  mockOrigin = "trusted-contacts";
  await render(<WellnessScreen id={20} />, { wrapper: Wrapper });
  await waitFor(() => expect(screen.getByLabelText("Save recipient").props.accessibilityState.disabled).toBe(false));
  await fillName();
  const failure = jest.mocked(AsyncStorage.setItem).mockImplementation((key, value) =>
    key === RECIPIENT_STORAGE_KEY ? Promise.reject(new Error("Full")) : originalWrite(key, value),
  );
  await fireEvent.press(screen.getByLabelText("Save recipient"));
  await waitFor(() => expect(screen.getByText(/Your entries are still here/)).toBeTruthy());
  expect(screen.getByLabelText("Full name").props.value).toBe("Alex Demo");
  expect(router.replace).not.toHaveBeenCalled();
  failure.mockImplementation(originalWrite);
  await fireEvent.press(screen.getByLabelText("Save recipient"));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/trusted-contacts"));
  expect(parseRecipients((await AsyncStorage.getItem(RECIPIENT_STORAGE_KEY))!)).toHaveLength(1);
});

test("cancel from Trusted Contacts adds no record", async () => {
  mockOrigin = "trusted-contacts";
  await render(<WellnessScreen id={20} />, { wrapper: Wrapper });
  await fillName();
  await fireEvent.press(screen.getByLabelText("Cancel"));
  expect(router.replace).toHaveBeenCalledWith("/trusted-contacts");
  expect(await AsyncStorage.getItem(RECIPIENT_STORAGE_KEY)).toBeNull();
});

test("Settings entry still requires email, stays session-only, and returns to Settings", async () => {
  await render(<WellnessScreen id={20} />, { wrapper: Wrapper });
  await fillName();
  await fireEvent.press(screen.getByLabelText("Save recipient"));
  expect(screen.getByText("Enter a valid email address.")).toBeTruthy();
  expect(router.replace).not.toHaveBeenCalled();
  await fireEvent.changeText(screen.getByLabelText("Email"), "alex@example.com");
  await fireEvent.press(screen.getByLabelText("Save recipient"));
  expect(router.replace).toHaveBeenCalledWith("/settings");
  expect(await AsyncStorage.getItem(RECIPIENT_STORAGE_KEY)).toBeNull();
});

test("Share entry keeps automatic destination selection and email duplicate validation", async () => {
  const view = await render(<WellnessScreen id={13} />, { wrapper: Wrapper });
  await fireEvent.press(screen.getByLabelText("Add recipient"));
  await view.rerender(<WellnessScreen id={20} />);
  await fillName();
  await fireEvent.changeText(screen.getByLabelText("Email"), "alex@example.com");
  await fireEvent.press(screen.getByLabelText("Save recipient"));
  expect(router.replace).toHaveBeenCalledWith("/export-share");
  await view.rerender(<WellnessScreen id={13} />);
  expect(screen.getByLabelText("Alex Demo").props.accessibilityState.selected).toBe(true);
  await fireEvent.press(screen.getByLabelText("Add recipient"));
  await view.rerender(<WellnessScreen id={20} />);
  await fillName();
  await fireEvent.changeText(screen.getByLabelText("Email"), "ALEX@example.com");
  await fireEvent.press(screen.getByLabelText("Save recipient"));
  expect(screen.getByText("This email is already a recipient.")).toBeTruthy();
  expect(await AsyncStorage.getItem(RECIPIENT_STORAGE_KEY)).toBeNull();
});
