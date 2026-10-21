import { act, cleanup, renderHook } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { recipientErrors, useWellness, WellnessProvider } from "../state";

afterEach(async () => { await cleanup(); jest.restoreAllMocks(); });

test("record eligibility follows connection, permission, sync, pause and reset", async () => {
  const persist = jest.spyOn(AsyncStorage, "setItem");
  const { result } = await renderHook(() => useWellness(), { wrapper: WellnessProvider });
  expect(result.current.available("steps")).toBe(false);
  await act(() => { result.current.setWatch("connected"); result.current.setPermissions({ steps: true, sleep: false, heart: false }); });
  expect(result.current.available("steps")).toBe(false);
  await act(() => result.current.setSynced(true));
  expect(result.current.available("steps")).toBe(true);
  expect(result.current.available("sleep")).toBe(false);
  await act(() => result.current.setPaused(true));
  expect(result.current.available("steps")).toBe(false);
  await act(() => { result.current.setPaused(false); result.current.setWatch("disconnected"); });
  expect(result.current.available("steps")).toBe(false);
  await act(() => { result.current.setRecipients([{ id: "demo", name: "Alex", email: "alex@example.test", relationship: "Friend" }]); result.current.setSelected(["steps"]); result.current.setDestination("demo"); });
  await act(() => result.current.reset());
  expect(result.current.recipients).toEqual([]);
  expect(result.current.selected).toEqual([]);
  expect(result.current.destination).toBe("export");
  expect(persist).not.toHaveBeenCalled();
});

test("recipient validation rejects blanks, invalid email and case-insensitive duplicates", () => {
  expect(Object.values(recipientErrors(" ", "bad", " ", [])).every(Boolean)).toBe(true);
  expect(recipientErrors("Alex", "alex@example.test", "Friend", [])).toEqual({ name: "", email: "", relationship: "" });
  expect(recipientErrors("Alex", " ALEX@example.test ", "Friend", [{ id: "1", name: "Alex", email: "alex@example.test", relationship: "Friend" }]).email).toBe("This email is already a recipient.");
});
