import { useEffect, type PropsWithChildren } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { useAI } from "../../ai";
import { ShareScreen } from "../screens";
import { useWellness, WellnessProvider, type Recipient } from "../state";
import { buildSharePreview } from "../sharing";
import {
  createSimulatedSharingService, readSharingConsent, SharedInformationProvider, useSharedInformation,
  type ShareServiceRequest, type ShareServiceResult, type SharingService,
} from "../../security";
import { PRIVACY_STORAGE_KEY } from "../../security/privacy";

const mockAI = {
  observations: [], consent: { chatObservations: true, tone: true, voice: true },
  model: { saved: { preferences: { largerText: false, reducedMotion: true } } },
} as unknown as ReturnType<typeof useAI>;
jest.mock("../../ai", () => ({ useAI: () => mockAI, ObservationCard: () => null }));
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), canGoBack: () => false },
  useFocusEffect: jest.fn(),
  useLocalSearchParams: () => ({}),
}));
jest.mock("../../../shared/Page", () => ({ Page: ({ children }: PropsWithChildren) => children }));
jest.mock("../../../shared/ui", () => {
  const { Text, Pressable, Switch } = jest.requireActual<typeof import("react-native")>("react-native");
  const Part = ({ children }: PropsWithChildren) => <Text>{children}</Text>;
  return {
    Card: Part, Copy: Part, Notice: Part, Intro: () => null, Icon: () => null, ZenOrb: () => null, Field: () => null,
    Button: ({ label, onPress, disabled }: { label: string; onPress(): void; disabled?: boolean }) =>
      <Pressable accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}><Text>{label}</Text></Pressable>,
    MenuRow: ({ label, onPress }: { label: string; onPress(): void }) => <Pressable accessibilityLabel={label} onPress={onPress}><Text>{label}</Text></Pressable>,
    Toggle: ({ label, value, onChange }: { label: string; value: boolean; onChange(value: boolean): void }) =>
      <Switch accessibilityLabel={label} value={value} onValueChange={onChange} />,
    Dialog: ({ title, children, onClose }: PropsWithChildren<{ title: string; onClose(): void }>) =>
      <><Text>{title}</Text>{children}<Pressable accessibilityLabel="Cancel" onPress={onClose}><Text>Cancel</Text></Pressable></>,
  };
});

const alex: Recipient = { id: "alex", name: "Alex Demo", email: "alex@example.test", relationship: "Friend" };
const setSharing = (sharing: boolean) => AsyncStorage.setItem(PRIVACY_STORAGE_KEY, JSON.stringify({
  version: 1, preferences: { wellnessData: false, saveSummaries: false, sharing, contactNotifications: false },
}));
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}
/** Controllable stand-in for the sharing service boundary. */
function fakeService(results: (() => Promise<ShareServiceResult>)[] = []) {
  const calls: ShareServiceRequest[] = [];
  const service: SharingService = {
    createShare: jest.fn((request: ShareServiceRequest) => {
      calls.push(request);
      const next = results.shift();
      return next ? next() : Promise.resolve({ status: "complete", shareId: `s-${calls.length}`, executionMode: "simulated" } as const);
    }),
    revokeShare: jest.fn(() => Promise.resolve({ status: "complete", executionMode: "simulated" } as const)),
  };
  return { service, calls };
}

let wellness: ReturnType<typeof useWellness>;
let shares: ReturnType<typeof useSharedInformation>;
function Capture({ children }: PropsWithChildren) {
  const w = useWellness(), s = useSharedInformation();
  useEffect(() => { wellness = w; shares = s; }, [w, s]);
  return children;
}
async function renderShare(service?: SharingService, timeoutMs?: number) {
  const view = await render(<ShareScreen />, {
    wrapper: ({ children }: PropsWithChildren) => (
      <WellnessProvider><SharedInformationProvider service={service} timeoutMs={timeoutMs}>
        <Capture>{children}</Capture>
      </SharedInformationProvider></WellnessProvider>
    ),
  });
  await act(() => {
    wellness.setWatch("connected");
    wellness.setPermissions({ steps: true, sleep: false, heart: false });
    wellness.setSynced(true);
    wellness.setRecipients([alex]);
    wellness.setDestination("alex");
    wellness.setSelected(["steps"]);
  });
  return view;
}
const press = (label: string) => fireEvent.press(screen.getByLabelText(label));
async function openPreview() {
  await press("Preview selected content");
  await screen.findByLabelText("Confirm simulated action");
}

beforeEach(async () => { jest.clearAllMocks(); await AsyncStorage.removeItem(PRIVACY_STORAGE_KEY); });
afterEach(async () => { await cleanup(); jest.useRealTimers(); });

describe("preview snapshot", () => {
  const base = { destinationId: "alex", recipients: [alex], selected: ["steps", "heart"] as const, device: "Demo watch" };
  test("includes only available records with source, period and units; never zero placeholders", () => {
    const preview = buildSharePreview({ ...base, selected: [...base.selected], available: (m) => m === "steps" })!;
    expect(preview.metrics).toEqual(["steps"]);
    expect(preview.content[0]).toMatch(/synthetic demo records from Demo watch .*Monday–Sunday.*not live/);
    expect(preview.content[1]).toMatch(/^Steps: 5200, .* steps \(Mon–Sun\); daily average \d+ steps\.$/);
    expect(preview.content.join(" ")).not.toMatch(/heart|bpm|: 0/i);
  });
  test("is unavailable without eligible content or an existing recipient", () => {
    expect(buildSharePreview({ ...base, selected: [...base.selected], available: () => false })).toBeNull();
    expect(buildSharePreview({ ...base, selected: [], available: () => true })).toBeNull();
    expect(buildSharePreview({ ...base, selected: ["steps"], recipients: [], available: () => true })).toBeNull();
  });
  test("its key changes with the destination details", () => {
    const one = buildSharePreview({ ...base, selected: ["steps"], available: () => true })!;
    const two = buildSharePreview({ ...base, selected: ["steps"], available: () => true, recipients: [{ ...alex, email: "new@example.test" }] })!;
    expect(one.key).not.toBe(two.key);
  });
});

describe("sharing consent and the simulated service", () => {
  test("missing preference reads as not granted; malformed storage rejects", async () => {
    await expect(readSharingConsent()).resolves.toBe(false);
    await setSharing(true);
    await expect(readSharingConsent()).resolves.toBe(true);
    await AsyncStorage.setItem(PRIVACY_STORAGE_KEY, "{broken");
    await expect(readSharingConsent()).rejects.toThrow();
  });
  test("simulated service is idempotent per request, rejects changed payloads, and can be made unavailable", async () => {
    const service = createSimulatedSharingService({ delayMs: 0 });
    const request = { requestId: "r1", recipientName: "Alex", content: ["Steps"] };
    const first = await service.createShare(request);
    expect(await service.createShare(request)).toEqual(first);
    expect(await service.createShare({ ...request, content: ["Sleep"] })).toEqual({ status: "failed", error: "CONFLICT" });
    service.setUnavailable(true);
    expect(await service.createShare({ ...request, requestId: "r2" })).toEqual({ status: "failed", error: "UNAVAILABLE" });
    expect(await service.revokeShare("x", "y")).toEqual({ status: "failed", error: "UNAVAILABLE" });
  });
});

describe("Screen 13 share workflow", () => {
  test("denied consent shows a recoverable error and creates nothing", async () => {
    const { service } = fakeService();
    await renderShare(service);
    await press("Preview selected content");
    expect(await screen.findByText(/Sharing is turned off in Privacy and consent/)).toBeTruthy();
    expect(screen.queryByLabelText("Confirm simulated action")).toBeNull();
    expect(service.createShare).not.toHaveBeenCalled();
    expect(shares.records).toEqual([]);
  });
  test("an unreadable consent preference fails closed", async () => {
    await AsyncStorage.setItem(PRIVACY_STORAGE_KEY, "not json");
    const { service } = fakeService();
    await renderShare(service);
    await press("Preview selected content");
    expect(await screen.findByText(/could not be read, so nothing was shared/)).toBeTruthy();
    expect(service.createShare).not.toHaveBeenCalled();
  });
  test("consent withdrawn after preview is re-checked at confirmation", async () => {
    await setSharing(true);
    const { service } = fakeService();
    await renderShare(service);
    await openPreview();
    await setSharing(false);
    await press("Confirm simulated action");
    expect(await screen.findByText(/Sharing is turned off/)).toBeTruthy();
    expect(service.createShare).not.toHaveBeenCalled();
    expect(shares.records).toEqual([]);
  });
  test("changing the selection or source availability invalidates an open preview", async () => {
    await setSharing(true);
    const { service } = fakeService();
    await renderShare(service);
    await openPreview();
    await act(() => wellness.setPaused(true));
    expect(screen.getByText(/This preview is out of date/)).toBeTruthy();
    expect(screen.queryByLabelText("Confirm simulated action")).toBeNull();
    await act(() => { wellness.setPaused(false); wellness.setPermissions({ steps: true, sleep: true, heart: false }); wellness.setSelected(["steps", "sleep"]); });
    await press("Review updated content");
    expect(await screen.findByText(/^Sleep: /)).toBeTruthy();
    expect(service.createShare).not.toHaveBeenCalled();
  });
  test("cancel before confirmation creates no request or record", async () => {
    await setSharing(true);
    const { service } = fakeService();
    await renderShare(service);
    await openPreview();
    await press("Cancel");
    expect(service.createShare).not.toHaveBeenCalled();
    expect(shares.records).toEqual([]);
  });
  test("repeated confirmation submits once and records the exact confirmed snapshot without email", async () => {
    await setSharing(true);
    const pending = deferred<ShareServiceResult>();
    const { service, calls } = fakeService([() => pending.promise]);
    await renderShare(service);
    await openPreview();
    const content = buildSharePreview({ destinationId: "alex", recipients: [alex], selected: ["steps"], available: () => true, device: "My smartwatch" })!.content;
    const confirm = screen.getByLabelText("Confirm simulated action");
    // Two presses on the same element before any re-render: only the guard can stop the second.
    await act(async () => { void fireEvent.press(confirm); void fireEvent.press(confirm); });
    await screen.findByLabelText("Confirming…");
    await act(async () => pending.resolve({ status: "complete", shareId: "s1", executionMode: "simulated" }));
    expect(await screen.findByText(/Simulated share confirmed for/)).toBeTruthy();
    expect(calls).toHaveLength(1);
    expect(shares.records).toHaveLength(1);
    expect(shares.records[0]).toMatchObject({ recipientName: "Alex Demo", content, requestId: calls[0].requestId });
    expect(JSON.stringify(shares.records)).not.toContain(alex.email);
    await act(() => wellness.setSelected([]));
    expect(shares.records[0].content).toEqual(content);
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1); // only the test's own consent fixture
  });
  test("a failure keeps the draft, and retry reuses the same request", async () => {
    await setSharing(true);
    const { service, calls } = fakeService([() => Promise.resolve({ status: "failed", error: "UNAVAILABLE" })]);
    await renderShare(service);
    await openPreview();
    await press("Confirm simulated action");
    expect(await screen.findByText(/simulated sharing service is unavailable/)).toBeTruthy();
    expect(shares.records).toEqual([]);
    expect(wellness.selected).toEqual(["steps"]);
    await press("Try again");
    await screen.findByText(/Simulated share confirmed/);
    expect(calls).toHaveLength(2);
    expect(calls[1].requestId).toBe(calls[0].requestId);
    expect(shares.records).toHaveLength(1);
  });
  test("an unknown outcome is not shown as success, a late completion is recorded once, and retry cannot duplicate", async () => {
    await setSharing(true);
    const late = deferred<ShareServiceResult>();
    const { service, calls } = fakeService([() => late.promise]);
    await renderShare(service, 30);
    await openPreview();
    await press("Confirm simulated action");
    expect(await screen.findByText(/No response from the simulated sharing service/)).toBeTruthy();
    expect(shares.records).toEqual([]);
    await act(async () => late.resolve({ status: "complete", shareId: "s1", executionMode: "simulated" }));
    await waitFor(() => expect(shares.records).toHaveLength(1));
    await press("Try again");
    await screen.findByText(/Simulated share confirmed/);
    expect(calls).toHaveLength(1);
    expect(shares.records).toHaveLength(1);
  });
  test("stopping the local wait does not cancel an accepted request", async () => {
    await setSharing(true);
    const pending = deferred<ShareServiceResult>();
    const { service } = fakeService([() => pending.promise]);
    await renderShare(service);
    await openPreview();
    await press("Confirm simulated action");
    await screen.findByLabelText("Confirming…");
    await press("Cancel");
    expect(screen.getByText(/You stopped waiting/)).toBeTruthy();
    await act(async () => pending.resolve({ status: "complete", shareId: "s1", executionMode: "simulated" }));
    await waitFor(() => expect(shares.records).toHaveLength(1));
    expect(screen.queryByText(/Simulated share confirmed/)).toBeNull();
  });
  test("a late response after the share session is cleared is discarded", async () => {
    await setSharing(true);
    const pending = deferred<ShareServiceResult>();
    const { service } = fakeService([() => pending.promise]);
    await renderShare(service);
    await openPreview();
    await press("Confirm simulated action");
    await screen.findByLabelText("Confirming…");
    await act(() => shares.clearShareSession());
    await act(async () => pending.resolve({ status: "complete", shareId: "s1", executionMode: "simulated" }));
    await waitFor(() => expect(screen.queryByLabelText("Confirming…")).toBeNull());
    expect(shares.records).toEqual([]);
    expect(screen.queryByText(/Simulated share confirmed/)).toBeNull();
  });
  test("export preview confirms locally and never calls the sharing service or history", async () => {
    const { service } = fakeService();
    await renderShare(service);
    await act(() => wellness.setDestination("export"));
    await press("Preview selected content");
    expect(screen.getByText("Demo export preview (no file download)")).toBeTruthy();
    await press("Confirm simulated action");
    expect(screen.getByText(/no file was\s+downloaded/)).toBeTruthy();
    expect(service.createShare).not.toHaveBeenCalled();
    expect(shares.records).toEqual([]);
  });
});
