import { useEffect, type PropsWithChildren } from "react";
import {
  act, cleanup, fireEvent, render, renderHook, screen, waitFor,
} from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AIProvider } from "../../ai";
import { WellnessProvider, WellnessScreen } from "../../wellness";
import {
  RecipientsProvider, SharedInformationProvider, useSharedInformation,
} from "..";
import { normalizeShare, sharedInformationReducer } from "../sharedInformation";
import { SharedInformationScreen } from "../screens/SharedInformationScreen";
import samples from "../../../../../../packages/fixtures/security/shared-information-records.json";
import copy from "../../../../../../packages/fixtures/security/shared-information.json";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), canGoBack: () => false },
  useFocusEffect: jest.fn(),
  useLocalSearchParams: () => ({}),
}));
beforeEach(() => jest.clearAllMocks());
afterEach(async () => { await cleanup(); jest.restoreAllMocks(); });

test("fixtures are valid; confirmed content is copied and excludes extra fields", () => {
  for (const input of samples.records) expect(normalizeShare(input)).toEqual(input);
  const content = ["Synthetic steps record"];
  const input = { recipientName: " Alex Demo ", content, email: "discard@example.com" };
  const snapshot = normalizeShare(input);
  content.push("Changed later");
  expect(snapshot).toEqual({ recipientName: "Alex Demo", content: ["Synthetic steps record"] });
  expect(() => normalizeShare({ recipientName: " ", content: [] })).toThrow();
});

test("reducer revokes only the selected record and ignores duplicate record IDs", () => {
  const first = { ...samples.records[0], id: "one", createdAt: 1 };
  const second = { ...samples.records[1], id: "two", createdAt: 2 };
  const added = sharedInformationReducer([first], { type: "record", record: second });
  expect(sharedInformationReducer(added, { type: "record", record: second })).toBe(added);
  expect(sharedInformationReducer(added, { type: "revoke", id: "one" })).toEqual([second]);
  expect(sharedInformationReducer(added, { type: "clear" })).toEqual([]);
});

test("the public share API remains session-only and starts empty after remount", async () => {
  const { result, unmount } = await renderHook(() => useSharedInformation(), { wrapper: SharedInformationProvider });
  await act(() => { samples.records.forEach(result.current.recordShare); });
  expect(result.current.records).toHaveLength(2);
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  await unmount();
  const fresh = await renderHook(() => useSharedInformation(), { wrapper: SharedInformationProvider });
  expect(fresh.result.current.records).toEqual([]);
});

let shares: ReturnType<typeof useSharedInformation>;
function Capture({ children }: PropsWithChildren) {
  const value = useSharedInformation();
  useEffect(() => { shares = value; }, [value]);
  return children;
}
function Wrapper({ children }: PropsWithChildren) {
  return (
    <SafeAreaProvider initialMetrics={{
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets: { top: 0, left: 0, right: 0, bottom: 0 },
    }}>
      <AIProvider><WellnessProvider><RecipientsProvider><SharedInformationProvider>
        <Capture>{children}</Capture>
      </SharedInformationProvider></RecipientsProvider></WellnessProvider></AIProvider>
    </SafeAreaProvider>
  );
}

test("empty screen has requested copy and Share information navigates to Screen 13", async () => {
  await render(<SharedInformationScreen />, { wrapper: Wrapper });
  expect(screen.getByText(copy.title)).toBeTruthy();
  expect(screen.getByText(copy.description)).toBeTruthy();
  expect(screen.getByText(copy.emptyTitle)).toBeTruthy();
  expect(screen.getByText(copy.emptyDescription)).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Share information"));
  expect(router.push).toHaveBeenCalledWith("/export-share");
});

test("review shows exact content; revocation requires confirmation and removes only that share", async () => {
  await render(<SharedInformationScreen />, { wrapper: Wrapper });
  await act(() => { samples.records.forEach(shares.recordShare); });
  expect(screen.queryByText(copy.emptyTitle)).toBeNull();
  await fireEvent.press(screen.getByLabelText("Review share with Alex Demo"));
  expect(screen.getByText(samples.records[0].content[0])).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Cancel"));
  await fireEvent.press(screen.getByLabelText("Revoke access for Alex Demo"));
  expect(shares.records).toHaveLength(2);
  await fireEvent.press(screen.getByLabelText("Cancel"));
  expect(shares.records).toHaveLength(2);
  await fireEvent.press(screen.getByLabelText("Revoke access for Alex Demo"));
  await fireEvent.press(screen.getByLabelText("Confirm revoke access"));
  expect(shares.records).toHaveLength(1);
  expect(screen.queryByText("Alex Demo")).toBeNull();
  expect(screen.getByText("Sam Example")).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Revoke access for Sam Example"));
  await fireEvent.press(screen.getByLabelText("Confirm revoke access"));
  expect(screen.getByText(copy.emptyTitle)).toBeTruthy();
});

test("Screen 13 records only confirmed recipient shares; export and cancel do not add records; reset confirms before clearing", async () => {
  const view = await render(<WellnessScreen id={19} />, { wrapper: Wrapper });
  await fireEvent.press(screen.getByLabelText("Connect demo watch"));
  await waitFor(() => expect(screen.getByText(/Demo connected:/)).toBeTruthy(), { timeout: 3000 });
  await view.rerender(<WellnessScreen id={10} />);
  await fireEvent(screen.getByLabelText("Allow steps records"), "valueChange", true);
  await fireEvent.press(screen.getByLabelText("Sync demo records"));
  await view.rerender(<WellnessScreen id={13} />);
  await fireEvent(screen.getByLabelText("Steps"), "valueChange", true);
  await fireEvent.press(screen.getByLabelText("Preview selected content"));
  await fireEvent.press(screen.getByLabelText("Confirm simulated action"));
  expect(shares.records).toHaveLength(0);
  await fireEvent.press(screen.getByLabelText("Add recipient"));
  await view.rerender(<WellnessScreen id={20} />);
  await fireEvent.changeText(screen.getByLabelText("Full name"), "Alex Demo");
  await fireEvent.changeText(screen.getByLabelText("Email"), "alex@example.com");
  await fireEvent.changeText(screen.getByLabelText("Relationship"), "Friend");
  await fireEvent.press(screen.getByLabelText("Save recipient"));
  await view.rerender(<WellnessScreen id={13} />);
  await fireEvent.press(screen.getByLabelText("Preview selected content"));
  await fireEvent.press(screen.getByLabelText("Cancel"));
  expect(shares.records).toHaveLength(0);
  await fireEvent.press(screen.getByLabelText("Preview selected content"));
  const previewText = screen.getByText(/Steps: 5200/).props.children;
  await fireEvent.press(screen.getByLabelText("Confirm simulated action"));
  expect(shares.records).toHaveLength(1);
  expect(shares.records[0].recipientName).toBe("Alex Demo");
  expect(shares.records[0].content).toEqual([previewText]);
  expect(JSON.stringify(shares.records)).not.toContain("alex@example.com");
  await view.rerender(<WellnessScreen id={18} />);
  await fireEvent.press(screen.getByLabelText("Reset wellness session"));
  await fireEvent.press(screen.getByLabelText("Cancel"));
  expect(shares.records).toHaveLength(1);
  await fireEvent.press(screen.getByLabelText("Reset wellness session"));
  await fireEvent.press(screen.getByLabelText("Confirm reset wellness session"));
  expect(shares.records).toHaveLength(0);
});
