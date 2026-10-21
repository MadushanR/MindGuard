import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { router } from "expo-router";
import { AIProvider } from "../../ai";
import { PrivacyConsentScreen } from "../screens/PrivacyConsentScreen";
import {
  changePrivacyDraft, defaultDemoPreferences, parseDemoPreferences,
  PRIVACY_STORAGE_KEY, serializeDemoPreferences,
} from "../privacy";
import copy from "../../../../../../packages/fixtures/security/privacy.json";

jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
  useFocusEffect: (callback: () => void) => {
    const React = jest.requireActual<typeof import("react")>("react");
    React.useEffect(callback, [callback]);
  },
}));
const aiKey = "mindguard.synthetic.v1";
const originalWrite = jest.mocked(AsyncStorage.setItem).getMockImplementation()!;
const baseline = {
  version: 1,
  preferences: { saveHistory: false, retentionDays: null, saveVoiceTranscripts: false, reducedMotion: true, largerText: false },
  consent: { voice: false, tone: false, chatObservations: false },
  conversations: [], observations: [],
  memories: [{ id: "privacy-demo-memory", text: "Synthetic saved detail", createdAt: Date.now() }],
};
beforeEach(async () => {
  jest.clearAllMocks();
  jest.mocked(AsyncStorage.setItem).mockImplementation(originalWrite);
  await AsyncStorage.clear();
  await AsyncStorage.setItem(aiKey, JSON.stringify(baseline));
});
afterEach(async () => { await cleanup(); });
async function openScreen() {
  const result = await render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <AIProvider><PrivacyConsentScreen /></AIProvider>
    </SafeAreaProvider>,
  );
  await screen.findByLabelText("Voice processing");
  return result;
}
const toggle = (label: string, value: boolean) => fireEvent(screen.getByLabelText(label), "valueChange", value);

test("storage validates its version and booleans, and never duplicates AI consent", () => {
  expect(parseDemoPreferences(null)).toEqual(defaultDemoPreferences);
  const draft = { ...defaultDemoPreferences, ...baseline.consent, sharing: true };
  const encoded = serializeDemoPreferences(draft);
  expect(parseDemoPreferences(encoded).sharing).toBe(true);
  expect(JSON.parse(encoded).preferences).not.toHaveProperty("voice");
  for (const value of ["broken", "null", '{"version":2}', '{"version":1,"preferences":{"sharing":"yes"}}']) {
    expect(() => parseDemoPreferences(value)).toThrow();
  }
});
test("draft rules block tone without voice and clear tone when voice is disabled", () => {
  const draft = { ...defaultDemoPreferences, ...baseline.consent };
  expect(changePrivacyDraft(draft, "tone", true)).toBe(draft);
  const enabled = changePrivacyDraft(changePrivacyDraft(draft, "voice", true), "tone", true);
  expect(enabled.tone).toBe(true);
  expect(changePrivacyDraft(enabled, "voice", false)).toMatchObject({ voice: false, tone: false });
});
test("draft changes do not apply before Save, persist after Save, and preserve other data", async () => {
  const view = await openScreen();
  expect(screen.getByText(copy.demoNotice)).toBeTruthy();
  expect(screen.getByLabelText("Optional tone analysis").props.disabled).toBe(true);
  await toggle("Voice processing", true);
  await toggle("Optional tone analysis", true);
  await toggle("Chat emotion observations", true);
  await toggle("Sharing", true);
  expect(JSON.parse((await AsyncStorage.getItem(aiKey))!).consent).toEqual(baseline.consent);
  expect(await AsyncStorage.getItem(PRIVACY_STORAGE_KEY)).toBeNull();
  await fireEvent.press(screen.getByLabelText("Save preferences"));
  await waitFor(async () => expect(JSON.parse((await AsyncStorage.getItem(aiKey))!).consent).toEqual({ voice: true, tone: true, chatObservations: true }));
  expect(parseDemoPreferences(await AsyncStorage.getItem(PRIVACY_STORAGE_KEY)).sharing).toBe(true);
  const saved = JSON.parse((await AsyncStorage.getItem(aiKey))!);
  expect(saved.preferences).toEqual(baseline.preferences);
  expect(saved.memories).toEqual(baseline.memories);
  await view.unmount();
  await openScreen();
  expect(screen.getByLabelText("Sharing").props.value).toBe(true);
  await toggle("Voice processing", false);
  expect(screen.getByLabelText("Optional tone analysis").props.value).toBe(false);
  await fireEvent.press(screen.getByLabelText("Save preferences"));
  await waitFor(async () => expect(JSON.parse((await AsyncStorage.getItem(aiKey))!).consent).toMatchObject({ voice: false, tone: false }));
});
test("leaving discards unsaved changes and links use existing screen routes", async () => {
  const view = await openScreen();
  await toggle("Save summaries", true);
  for (const [label, path] of [["Back to create account", "/create-account"], ["Saved information", "/saved-information"], ["Conversation history and auto-delete", "/conversation-preferences"]]) {
    await fireEvent.press(screen.getByLabelText(label));
    expect(router.push).toHaveBeenLastCalledWith(path);
  }
  await view.unmount();
  await openScreen();
  expect(screen.getByLabelText("Save summaries").props.value).toBe(false);
});
test("malformed saved preferences are preserved and saving is blocked until loading succeeds", async () => {
  await AsyncStorage.setItem(PRIVACY_STORAGE_KEY, "invalid saved value");
  await render(<AIProvider><PrivacyConsentScreen /></AIProvider>);
  await screen.findByText(copy.readError);
  expect(screen.getByLabelText("Save preferences").props.accessibilityState.disabled).toBe(true);
  expect(await AsyncStorage.getItem(PRIVACY_STORAGE_KEY)).toBe("invalid saved value");
  // Simulate storage recovery, without the screen deleting or resetting anything.
  await AsyncStorage.setItem(PRIVACY_STORAGE_KEY, serializeDemoPreferences({ ...defaultDemoPreferences, ...baseline.consent, wellnessData: true }));
  await fireEvent.press(screen.getByLabelText("Retry loading privacy preferences"));
  await screen.findByLabelText("Wellness data");
  expect(screen.getByLabelText("Wellness data").props.value).toBe(true);
});
test("failed demo-preference writes retain the draft and do not change AI consent", async () => {
  await openScreen();
  await toggle("Voice processing", true);
  jest.mocked(AsyncStorage.setItem).mockImplementation((key, value) => key === PRIVACY_STORAGE_KEY ? Promise.reject(new Error("Storage full")) : originalWrite(key, value));
  await fireEvent.press(screen.getByLabelText("Save preferences"));
  await screen.findByText(copy.writeError);
  expect(screen.getByLabelText("Voice processing").props.value).toBe(true);
  expect(JSON.parse((await AsyncStorage.getItem(aiKey))!).consent.voice).toBe(false);
  jest.mocked(AsyncStorage.setItem).mockImplementation(originalWrite);
  await fireEvent.press(screen.getByLabelText("Save preferences"));
  await waitFor(async () => expect(JSON.parse((await AsyncStorage.getItem(aiKey))!).consent.voice).toBe(true));
});
test("failed AI persistence is reported and Save can retry without discarding the choices", async () => {
  await openScreen();
  await toggle("Voice processing", true);
  jest.mocked(AsyncStorage.setItem).mockImplementation((key, value) => key === aiKey ? Promise.reject(new Error("Storage full")) : originalWrite(key, value));
  await fireEvent.press(screen.getByLabelText("Save preferences"));
  await screen.findByText(copy.aiWriteError);
  expect(JSON.parse((await AsyncStorage.getItem(aiKey))!).consent.voice).toBe(false);
  jest.mocked(AsyncStorage.setItem).mockImplementation(originalWrite);
  await fireEvent.press(screen.getByLabelText("Save preferences"));
  await waitFor(async () => expect(JSON.parse((await AsyncStorage.getItem(aiKey))!).consent.voice).toBe(true));
});
