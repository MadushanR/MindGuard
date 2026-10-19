import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
  cleanup,
  renderHook,
} from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AccessibilityInfo } from "react-native";
import { router } from "expo-router";
import { AIProvider, useAI } from "../AIProvider";
import { screenCopy, textProvider } from "@mindguard/fixtures";
import { WelcomeScreen } from "../screens/WelcomeScreen";
import { PreferencesScreen } from "../screens/PreferencesScreen";
// Keep decorative native animation out of interaction tests; real rendering is covered in browser/device checks.
jest.mock("../../../shared/ui", () => ({
  ...jest.requireActual("../../../shared/ui"),
  ZenOrb: () => null,
}));
beforeEach(async () => {
  jest
    .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
    .mockResolvedValue(true);
  await AsyncStorage.clear();
});
afterEach(async () => {
  await cleanup();
  jest.restoreAllMocks();
});
test("Welcome renders editable copy and links to the account module", async () => {
  await render(
    <AIProvider>
      <WelcomeScreen />
    </AIProvider>,
  );
  expect(screen.getByText(screenCopy.welcome.title)).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Create account"));
  expect(router.push).toHaveBeenCalledWith("/create-account");
});
test("the provider delivers configured delayed output and clears processing", async () => {
  const { result } = await renderHook(() => useAI(), { wrapper: AIProvider });
  await waitFor(() => expect(result.current.ready).toBe(true));
  await act(() => result.current.send("A synthetic reflection"));
  expect(result.current.model.chatStatus).toBe("processing");
  await waitFor(() => expect(result.current.model.chatStatus).toBe("idle"), {
    timeout: 3000,
  });
  expect(result.current.model.active?.messages.at(-1)?.text).toBe(
    textProvider.reply("normal", 0).text,
  );
});
test("saving history asks for an explicit retention choice", async () => {
  await render(
    <AIProvider>
      <PreferencesScreen />
    </AIProvider>,
  );
  await act(async () => {});
  await fireEvent(
    screen.getByLabelText("Save conversation history"),
    "valueChange",
    true,
  );
  await fireEvent.press(screen.getByLabelText("Save conversation preferences"));
  await waitFor(() =>
    expect(
      screen.getByText("Choose when saved conversations should be deleted."),
    ).toBeTruthy(),
  );
});
