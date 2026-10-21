import { useEffect, type PropsWithChildren } from "react";
import type { Observation } from "@mindguard/contracts";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as Linking from "expo-linking";
import { useAI } from "../../ai";
import { ResourcesScreen, SettingsScreen, SourcesScreen, TrendsScreen } from "../screens";
import { useWellness, WellnessProvider } from "../state";
import { SharedInformationProvider } from "../../security";

const mockAI = {
  observations: [] as Observation[], consent: { chatObservations: true, tone: true, voice: true },
  model: { saved: { preferences: { largerText: false, reducedMotion: true } } },
  savePreferences: jest.fn(), setConsent: jest.fn(), leave: jest.fn(),
} as unknown as ReturnType<typeof useAI>;
jest.mock("../../ai", () => ({
  useAI: () => mockAI,
  effectiveEmotion: (o: Observation) => o.correctedLabel ?? o.predictedLabel,
  ObservationCard: ({ observation }: { observation: Observation }) => { const { Text } = jest.requireActual<typeof import("react-native")>("react-native"); return <Text>{observation.id}</Text>; },
}));
jest.mock("expo-linking", () => ({ openURL: jest.fn().mockResolvedValue(true) }));
jest.mock("../../../shared/Page", () => ({ Page: ({ children }: PropsWithChildren) => children }));
jest.mock("../../../shared/ui", () => {
  const { Text, Pressable, Switch } = jest.requireActual<typeof import("react-native")>("react-native");
  const Part = ({ children }: PropsWithChildren) => <Text>{children}</Text>;
  return {
    Card: Part, Copy: Part, Notice: Part, Intro: () => null, Icon: () => null,
    Button: ({ label, accessibilityLabel, onPress, disabled }: { label: string; accessibilityLabel?: string; onPress(): void; disabled?: boolean }) => <Pressable accessibilityLabel={accessibilityLabel ?? label} disabled={disabled} onPress={onPress}><Text>{label}</Text></Pressable>,
    MenuRow: () => null,
    Toggle: ({ label, value, onChange }: { label: string; value: boolean; onChange(value: boolean): void }) => <Switch accessibilityLabel={label} value={value} onValueChange={onChange} />,
    Dialog: ({ title, children, onClose }: PropsWithChildren<{ title: string; onClose(): void }>) => <><Text>{title}</Text>{children}<Pressable accessibilityLabel="Cancel" onPress={onClose}><Text>Cancel</Text></Pressable></>,
  };
});
let wellness: ReturnType<typeof useWellness>;
function Capture({ children }: PropsWithChildren) { const value = useWellness(); useEffect(() => { wellness = value; }, [value]); return children; }
function Wrapper({ children }: PropsWithChildren) { return <WellnessProvider><SharedInformationProvider><Capture>{children}</Capture></SharedInformationProvider></WellnessProvider>; }
afterEach(async () => { await cleanup(); jest.restoreAllMocks(); mockAI.observations = []; jest.useRealTimers(); jest.mocked(Linking.openURL).mockReset().mockResolvedValue(true); });
const observation = (id: string, createdAt: number): Observation => ({ id, createdAt, source: "Chat", predictedLabel: "Calm", confidence: 0.6, status: "Estimated", dismissed: false });

test("Trends includes new observations without remounting", async () => {
  const now = new Date(2026, 9, 20, 12).getTime();
  const clock = jest.spyOn(Date, "now").mockReturnValue(now);
  const view = await render(<TrendsScreen />, { wrapper: Wrapper });
  clock.mockReturnValue(now + 5000);
  mockAI.observations = [observation("new-observation", now + 5000)];
  await view.rerender(<TrendsScreen />);
  await waitFor(() => expect(screen.getByText("new-observation")).toBeTruthy());
});
test("Trends rolls over its week while open and day filtering keeps the weekly summary", async () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 9, 25, 23, 59, 30));
  mockAI.observations = [observation("sunday", Date.now())];
  await render(<TrendsScreen />, { wrapper: Wrapper });
  await fireEvent.press(screen.getByLabelText("Sun: 1 observations"));
  expect(screen.getByText("sunday")).toBeTruthy();
  expect(screen.getByText("1 total observations")).toBeTruthy();
  await act(() => jest.advanceTimersByTime(60_000));
  expect(screen.queryByText("sunday")).toBeNull();
  await fireEvent.press(screen.getByLabelText("Last week"));
  expect(screen.getByText("sunday")).toBeTruthy();
});
test("reset cancellation preserves recipients and confirmation clears session state", async () => {
  await render(<SettingsScreen />, { wrapper: Wrapper });
  await act(() => { wellness.setRecipients([{ id: "alex", name: "Alex", email: "alex@example.test", relationship: "Friend" }]); wellness.setWatch("connected"); });
  await fireEvent.press(screen.getByLabelText("Reset wellness session"));
  expect(wellness.recipients).toHaveLength(1);
  await fireEvent.press(screen.getByLabelText("Cancel"));
  expect(wellness.watch).toBe("connected");
  await fireEvent.press(screen.getByLabelText("Reset wellness session"));
  await fireEvent.press(screen.getByLabelText("Confirm reset wellness session"));
  expect(wellness.recipients).toEqual([]);
  expect(wellness.watch).toBe("disconnected");
});
test("a failed sync removes record eligibility and retry restores it", async () => {
  await render(<SourcesScreen />, { wrapper: Wrapper });
  await act(() => { wellness.setWatch("connected"); wellness.setPermissions({ steps: true, sleep: false, heart: false }); });
  await fireEvent.press(screen.getByLabelText("Sync demo records"));
  expect(wellness.available("steps")).toBe(true);
  await fireEvent(screen.getByLabelText("Simulate sync failure"), "valueChange", true);
  await fireEvent.press(screen.getByLabelText("Sync demo records"));
  expect(wellness.available("steps")).toBe(false);
  await fireEvent(screen.getByLabelText("Simulate sync failure"), "valueChange", false);
  await fireEvent.press(screen.getByLabelText("Retry sync"));
  expect(wellness.available("steps")).toBe(true);
});
test("resources require explicit confirmation before opening a contact app", async () => {
  await render(<ResourcesScreen />);
  expect(Linking.openURL).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByLabelText("Call 9-8-8"));
  await fireEvent.press(screen.getByLabelText("Cancel"));
  expect(Linking.openURL).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByLabelText("Text 9-8-8"));
  await fireEvent.press(screen.getByLabelText("Continue to phone or messaging app"));
  expect(Linking.openURL).toHaveBeenCalledWith("sms:988?oai_link_source=model_response_hotline");
});
test("resource links report failure while bundled contact information stays visible", async () => {
  jest.mocked(Linking.openURL).mockRejectedValueOnce(new Error("offline"));
  await render(<ResourcesScreen />);
  await fireEvent.press(screen.getByLabelText("Find Canadian mental health support"));
  expect(screen.getByText(/This device could not open that link/)).toBeTruthy();
  expect(screen.getByText(/These Canadian contact details are included/)).toBeTruthy();
});
