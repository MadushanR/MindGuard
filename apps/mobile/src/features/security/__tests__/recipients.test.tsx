import {
  act, cleanup, fireEvent, render, renderHook, screen, waitFor,
} from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { AIProvider } from "../../ai";
import { RecipientsProvider, useRecipients } from "..";
import { parseRecipients, recipientRelationshipLabel, RECIPIENT_STORAGE_KEY } from "../recipients";
import { TrustedContactsScreen } from "../screens/TrustedContactsScreen";
import samples from "../../../../../../packages/fixtures/security/trusted-recipients.json";
import copy from "../../../../../../packages/fixtures/security/trusted-contacts.json";

const encoded = JSON.stringify({ version: 1, recipients: samples.records });
beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});
afterEach(async () => {
  await cleanup();
  jest.restoreAllMocks();
});

test("synthetic fixtures use valid records and display labels for all relationships", () => {
  const recipients = parseRecipients(encoded);
  expect(recipients).toHaveLength(3);
  for (const recipient of recipients)
    expect(recipientRelationshipLabel(recipient.relationship)).toBeTruthy();
  expect(recipientRelationshipLabel("My neighbour")).toBe("My neighbour");
  expect(() => parseRecipients(JSON.stringify({ version: 2, recipients: [] }))).toThrow();
  expect(() => parseRecipients(JSON.stringify({ version: 1, recipients: [samples.records[0], samples.records[0]] }))).toThrow();
  expect(() => parseRecipients(JSON.stringify({ version: 1, recipients: [{ id: "bad", name: " ", relationship: "friend" }] }))).toThrow();
  const record = { ...samples.records[0], email: "discard@example.com", sharing: true };
  expect(parseRecipients(JSON.stringify({ version: 1, recipients: [record] }))[0]).toEqual(samples.records[0]);
});

test("a missing recipient key starts empty without writing or seeding samples", async () => {
  const { result } = await renderHook(() => useRecipients(), { wrapper: RecipientsProvider });
  await waitFor(() => expect(result.current.ready).toBe(true));
  expect(result.current.recipients).toEqual([]);
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});

test("public add API serializes simultaneous additions and restores them on remount", async () => {
  await AsyncStorage.setItem("mindguard.synthetic.v1", "existing AI demo data");
  const { result, unmount } = await renderHook(() => useRecipients(), { wrapper: RecipientsProvider });
  await waitFor(() => expect(result.current.ready).toBe(true));
  await act(async () => {
    await Promise.all([
      result.current.addRecipient({ name: " Alex Demo ", relationship: "friend" }),
      result.current.addRecipient({ name: "Sam Example", relationship: "family" }),
    ]);
  });
  expect(result.current.recipients.map((r) => r.name)).toEqual(["Alex Demo", "Sam Example"]);
  const raw = await AsyncStorage.getItem(RECIPIENT_STORAGE_KEY);
  expect(parseRecipients(raw!)).toEqual(result.current.recipients);
  expect(await AsyncStorage.getItem("mindguard.synthetic.v1")).toBe("existing AI demo data");
  await expect(result.current.addRecipient({ name: " ", relationship: "friend" })).rejects.toThrow();
  await unmount();
  const restored = await renderHook(() => useRecipients(), { wrapper: RecipientsProvider });
  await waitFor(() => expect(restored.result.current.ready).toBe(true));
  expect(restored.result.current.recipients).toEqual(parseRecipients(raw!));
});

test("unreadable records are preserved and cannot be overwritten by adding", async () => {
  await AsyncStorage.setItem(RECIPIENT_STORAGE_KEY, "invalid saved contacts");
  const writes = jest.mocked(AsyncStorage.setItem).mock.calls.length;
  const { result } = await renderHook(() => useRecipients(), { wrapper: RecipientsProvider });
  await waitFor(() => expect(result.current.readError).toBe(true));
  await expect(result.current.addRecipient({ name: "Alex Demo", relationship: "friend" })).rejects.toThrow();
  expect(await AsyncStorage.getItem(RECIPIENT_STORAGE_KEY)).toBe("invalid saved contacts");
  expect(jest.mocked(AsyncStorage.setItem).mock.calls).toHaveLength(writes);
});

test("failed reads can be retried without replacing saved records", async () => {
  await AsyncStorage.setItem(RECIPIENT_STORAGE_KEY, encoded);
  jest.spyOn(AsyncStorage, "getItem").mockRejectedValueOnce(new Error("Read unavailable"));
  const { result } = await renderHook(() => useRecipients(), { wrapper: RecipientsProvider });
  await waitFor(() => expect(result.current.readError).toBe(true));
  await act(() => result.current.restoreRecipients());
  expect(result.current.ready).toBe(true);
  expect(result.current.recipients).toEqual(samples.records);
});

test("failed writes keep existing contacts; retry saves exactly one new contact", async () => {
  await AsyncStorage.setItem(RECIPIENT_STORAGE_KEY, encoded);
  const { result } = await renderHook(() => useRecipients(), { wrapper: RecipientsProvider });
  await waitFor(() => expect(result.current.ready).toBe(true));
  jest.spyOn(AsyncStorage, "setItem").mockRejectedValueOnce(new Error("Storage full"));
  await act(async () => {
    await expect(result.current.addRecipient({ name: "Taylor Demo", relationship: "friend" })).rejects.toThrow();
  });
  expect(result.current.writeError).toBe(true);
  expect(result.current.recipients).toEqual(samples.records);
  expect(await AsyncStorage.getItem(RECIPIENT_STORAGE_KEY)).toBe(encoded);
  await act(async () => {
    await result.current.addRecipient({ name: "Taylor Demo", relationship: "friend" });
  });
  expect(result.current.recipients).toHaveLength(4);
  expect(result.current.writeError).toBe(false);
});

async function openScreen() {
  await render(
    <AIProvider>
      <RecipientsProvider><TrustedContactsScreen /></RecipientsProvider>
    </AIProvider>,
  );
}

test("empty state uses requested copy and links to existing routes", async () => {
  await openScreen();
  await waitFor(() => expect(screen.getByText(copy.emptyTitle)).toBeTruthy());
  expect(screen.getByText(copy.eyebrow)).toBeTruthy();
  expect(screen.getByText(copy.title)).toBeTruthy();
  expect(screen.getByText(copy.emptyDescription)).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Add recipient"));
  expect(router.push).toHaveBeenCalledWith({
    pathname: "/add-recipient", params: { origin: "trusted-contacts" },
  });
  await fireEvent.press(screen.getByLabelText("Manage sharing permissions"));
  expect(router.push).toHaveBeenCalledWith("/shared-information");
});

test("saved recipients replace the empty card and show only names and relationships", async () => {
  await AsyncStorage.setItem(RECIPIENT_STORAGE_KEY, encoded);
  await openScreen();
  await waitFor(() => expect(screen.getByText("Alex Demo")).toBeTruthy());
  expect(screen.queryByText(copy.emptyTitle)).toBeNull();
  for (const label of Object.values(copy.relationships)) expect(screen.getByText(label)).toBeTruthy();
});

test("read failure shows Retry instead of incorrectly showing an empty circle", async () => {
  await AsyncStorage.setItem(RECIPIENT_STORAGE_KEY, "broken data");
  await openScreen();
  await waitFor(() => expect(screen.getByText(copy.readError)).toBeTruthy());
  expect(screen.queryByText(copy.emptyTitle)).toBeNull();
  await AsyncStorage.setItem(RECIPIENT_STORAGE_KEY, encoded);
  await fireEvent.press(screen.getByLabelText("Retry opening contacts"));
  await waitFor(() => expect(screen.getByText("Alex Demo")).toBeTruthy());
});
