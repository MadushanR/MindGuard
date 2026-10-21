import type { PropsWithChildren } from "react";
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { router } from "expo-router";
import { AIProvider } from "../../ai";
import { WellnessProvider } from "../../wellness";
import { RecipientsProvider, SharedInformationProvider, SavedInformationProvider, useSavedInformation } from "..";
import { SavedInformationScreen } from "../screens/SavedInformationScreen";
import ExportRoute from "../../../app/export-share";
import {
  initialSavedInformation, parseSavedCategories, savedInformationReducer, selectedSavedInformation,
} from "../savedInformation";
import copy from "../../../../../../packages/fixtures/security/saved-information.json";

let mockParams: { origin?: string; categories?: string | string[] } = {};
jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (callback: () => void) => {
    const React = jest.requireActual<typeof import("react")>("react");
    React.useEffect(callback, [callback]);
  },
}));
beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockParams = {};
});
afterEach(async () => { await cleanup(); });
function Wrapper({ children }: PropsWithChildren) {
  return <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
    <AIProvider><WellnessProvider><RecipientsProvider><SharedInformationProvider><SavedInformationProvider>
      {children}
    </SavedInformationProvider></SharedInformationProvider></RecipientsProvider></WellnessProvider></AIProvider>
  </SafeAreaProvider>;
}
test("editable fictional fixtures contain two independent valid categories", () => {
  const records = initialSavedInformation();
  expect(records.map((record) => record.id)).toEqual(["weekly-summary", "wellness-records"]);
  expect(records[1].content).toHaveLength(7);
  for (const record of records) {
    expect(record.label.trim()).toBeTruthy();
    expect(record.weekLabel).toContain("Fictional");
    expect(record.content.length).toBeGreaterThan(0);
    for (const line of record.content) expect(line.trim()).toBeTruthy();
  }
  expect(initialSavedInformation()[0].content).not.toBe(records[0].content);
  expect(savedInformationReducer(records, { type: "delete", ids: ["wellness-records"] })).toEqual([records[0]]);
  expect(savedInformationReducer(records, { type: "delete", ids: ["weekly-summary"] })).toEqual([records[1]]);
});
test("export query accepts only exact category IDs and rejects stale selections", () => {
  expect(parseSavedCategories("wellness-records,weekly-summary")).toEqual(["wellness-records", "weekly-summary"]);
  for (const invalid of [undefined, [], ["weekly-summary"], "", "unknown", "weekly-summary,", "weekly-summary,weekly-summary"]) {
    expect(parseSavedCategories(invalid)).toEqual([]);
  }
  const records = initialSavedInformation();
  expect(selectedSavedInformation(records.slice(0, 1), ["weekly-summary", "wellness-records"])).toEqual([]);
  expect(selectedSavedInformation(records, ["weekly-summary"])).toEqual([records[0]]);
});
test("session provider deletes real local records without storage and does not reseed on navigation", async () => {
  const view = await renderHook(() => useSavedInformation(), { wrapper: SavedInformationProvider });
  await act(async () => view.result.current.deleteCategories(["wellness-records"]));
  expect(view.result.current.records.map((r) => r.id)).toEqual(["weekly-summary"]);
  await view.rerender(undefined);
  expect(view.result.current.records).toHaveLength(1);
  await act(async () => view.result.current.deleteCategories(["weekly-summary"]));
  expect(view.result.current.records).toEqual([]);
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  await view.unmount();
  const next = await renderHook(() => useSavedInformation(), { wrapper: SavedInformationProvider });
  expect(next.result.current.records).toHaveLength(2);
});
test("both available checkboxes default selected, work independently and gate both actions", async () => {
  await render(<SavedInformationScreen />, { wrapper: Wrapper });
  for (const label of [copy.summaryLabel, copy.recordsLabel]) {
    expect(screen.getByRole("checkbox", { name: label }).props.accessibilityState.checked).toBe(true);
  }
  await fireEvent.press(screen.getByRole("checkbox", { name: copy.summaryLabel }));
  expect(screen.getByRole("checkbox", { name: copy.recordsLabel }).props.accessibilityState.checked).toBe(true);
  await fireEvent.press(screen.getByLabelText("Export selected information"));
  expect(router.push).toHaveBeenLastCalledWith({ pathname: "/export-share", params: { origin: "saved-information", categories: "wellness-records" } });
  await fireEvent.press(screen.getByRole("checkbox", { name: copy.recordsLabel }));
  expect(screen.getByText(copy.noSelection)).toBeTruthy();
  for (const label of ["Export selected information", "Delete selected information"]) {
    expect(screen.getByLabelText(label).props.accessibilityState.disabled).toBe(true);
  }
  await fireEvent.press(screen.getByLabelText("Retention and privacy choices"));
  expect(router.push).toHaveBeenLastCalledWith("/privacy");
});
test("Cancel deletes nothing; confirmation names and removes only the selected category", async () => {
  await render(<SavedInformationScreen />, { wrapper: Wrapper });
  await fireEvent.press(screen.getByRole("checkbox", { name: copy.summaryLabel }));
  await fireEvent.press(screen.getByLabelText("Delete selected information"));
  expect(screen.getByText(copy.deleteTitle)).toBeTruthy();
  expect(screen.getAllByText(copy.recordsLabel)).toHaveLength(2);
  expect(screen.getAllByText(copy.summaryLabel)).toHaveLength(1);
  await fireEvent.press(screen.getByLabelText("Cancel"));
  expect(screen.getByRole("checkbox", { name: copy.recordsLabel }).props.accessibilityState.checked).toBe(true);
  const before = await AsyncStorage.getItem("mindguard.synthetic.v1");
  await fireEvent.press(screen.getByLabelText("Delete selected information"));
  await fireEvent.press(screen.getByLabelText("Confirm delete selected information"));
  expect(screen.getByText(copy.deleted)).toBeTruthy();
  expect(screen.getByRole("checkbox", { name: copy.recordsLabel }).props.accessibilityState).toEqual({ checked: false, disabled: true });
  expect(screen.getByRole("checkbox", { name: copy.summaryLabel }).props.accessibilityState.disabled).toBe(false);
  expect(await AsyncStorage.getItem("mindguard.synthetic.v1")).toBe(before);
  await fireEvent.press(screen.getByRole("checkbox", { name: copy.summaryLabel }));
  await fireEvent.press(screen.getByLabelText("Delete selected information"));
  await fireEvent.press(screen.getByLabelText("Confirm delete selected information"));
  expect(screen.getByText(copy.empty)).toBeTruthy();
  expect(screen.getByLabelText("Export selected information").props.accessibilityState.disabled).toBe(true);
});
test("Screen 13 previews exactly the selected category and confirms an export-only simulation", async () => {
  mockParams = { origin: "saved-information", categories: "weekly-summary" };
  await render(<ExportRoute />, { wrapper: Wrapper });
  expect(screen.getByText(copy.summaryLabel)).toBeTruthy();
  expect(screen.queryByText(copy.recordsLabel)).toBeNull();
  expect(screen.getByText(initialSavedInformation()[0].content[0])).toBeTruthy();
  expect(screen.queryByText(initialSavedInformation()[1].content[0])).toBeNull();
  await fireEvent.press(screen.getByLabelText("Preview selected content"));
  await fireEvent.press(screen.getByLabelText("Cancel"));
  expect(screen.queryByText(copy.exportDone)).toBeNull();
  await fireEvent.press(screen.getByLabelText("Preview selected content"));
  await fireEvent.press(screen.getByLabelText("Confirm simulated action"));
  expect(screen.getByText(copy.exportDone)).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Back to saved information"));
  expect(router.push).toHaveBeenLastCalledWith("/saved-information");
});
test("Screen 13 rejects invalid categories rather than exporting all available records", async () => {
  mockParams = { origin: "saved-information", categories: "unknown" };
  await render(<ExportRoute />, { wrapper: Wrapper });
  expect(screen.getByText(copy.invalidSelection)).toBeTruthy();
  expect(screen.getByLabelText("Preview selected content").props.accessibilityState.disabled).toBe(true);
});
test("Screen 13 normal entry retains the original wearable sharing controls", async () => {
  await render(<ExportRoute />, { wrapper: Wrapper });
  expect(screen.getByLabelText("Steps")).toBeTruthy();
  expect(screen.getByLabelText("Add recipient")).toBeTruthy();
  expect(screen.queryByText(copy.sessionNotice)).toBeNull();
});
