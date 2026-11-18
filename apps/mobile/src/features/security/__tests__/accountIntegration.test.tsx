import { act, cleanup, render, renderHook, waitFor } from "@testing-library/react-native";
import { useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PropsWithChildren } from "react";
import type { AccountShare, SecuritySnapshot } from "@mindguard/contracts";
import { SecuritySessionProvider, useSecuritySession } from "../SecuritySessionProvider";
import { SharedInformationProvider, useSharedInformation } from "../SharedInformationProvider";
import { LiveVoiceProvider, useLiveVoice } from "../../ai/live/LiveVoiceProvider";
import { AIProvider, useAI } from "../../ai/AIProvider";

jest.mock("expo-router", () => ({ usePathname: () => "/voice" }));
jest.mock("../../ai/live/config", () => ({ voiceRelayUrl: () => "https://relay.example.invalid" }));
const mockDispose = jest.fn();
jest.mock("../../ai/live/VoiceAudio", () => ({ VoiceAudio: class { dispose() { mockDispose(); } } }));
jest.mock("../../ai/live/VoiceSessionController", () => ({ VoiceSessionController: class {
  constructor(_url: string, _token: string, _audio: unknown, private mockUpdate: (value: unknown) => void) {}
  async start() { this.mockUpdate({ state: "listening", microphoneActive: true }); }
  stop() { this.mockUpdate({ state: "stopped", microphoneActive: false }); }
} }));
const blank = (): SecuritySnapshot => ({ preferences: { sharing: true, wellnessData: true, saveSummaries: false, contactNotifications: false }, contacts: [], saved: [], outgoing: [], incoming: [], alerts: [], alertSenders: [] });
const destination = { id: "recipient", name: "Demo recipient", email: "b@example.test", relationship: "Friend" };
const share = { requestId: "request", recipientName: destination.name, destination, content: ["Synthetic content"] };
let snapshots: Record<string, SecuritySnapshot>;
let deferredCreate: (() => Promise<unknown>) | undefined;
let loseResponse = false;
let calls: { path: string; method: string; owner: string; body: any }[];
function Wrapper({ children }: PropsWithChildren) {
  return <SecuritySessionProvider><AIProvider><LiveVoiceProvider><SharedInformationProvider>{children}</SharedInformationProvider></LiveVoiceProvider></AIProvider></SecuritySessionProvider>;
}
beforeEach(async () => {
  await AsyncStorage.clear(); // Jest's isolated mock store, never application deletion.
  snapshots = { a: blank(), b: blank() }; calls = []; deferredCreate = undefined; loseResponse = false;
  mockDispose.mockClear();
  jest.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
    const path = String(url), method = init?.method ?? "GET", body = init?.body ? JSON.parse(String(init.body)) : undefined;
    if (path.includes("cognito-idp")) {
      const operation = (init?.headers as Record<string, string>)["X-Amz-Target"];
      return { ok: true, json: async () => operation.endsWith("InitiateAuth") ? { AuthenticationResult: { AccessToken: body.AuthParameters.USERNAME[0], ExpiresIn: 900 } } : {} } as Response;
    }
    const owner = (init?.headers as Record<string, string>).Authorization.slice(7);
    calls.push({ path, method, owner, body });
    let value: unknown = {};
    if (path.endsWith("/session")) value = { owner, email: `${owner}@example.test` };
    if (path.endsWith("/snapshot")) value = snapshots[owner];
    if (path.endsWith("/api/voice/consent")) value = { allowed: method === "PUT" ? body.allowed : true };
    if (path.includes("/shares/status/")) value = { share: snapshots[owner].outgoing.find(s => s.requestId === "request") ?? null };
    if (path.endsWith("/shares") && method === "POST") {
      if (deferredCreate) value = await deferredCreate();
      else {
        const record: AccountShare = { ...body, id: "server-share", recipientName: body.destination.name, recipientAccountId: "b", createdAt: 1, revoked: false, executionMode: "live" };
        snapshots[owner].outgoing = [record]; value = record;
        if (loseResponse) { loseResponse = false; throw new Error("lost response after commit"); }
      }
    }
    return { ok: true, status: 200, json: async () => structuredClone(value) } as Response;
  });
});
afterEach(async () => { await cleanup(); jest.restoreAllMocks(); });
const hook = () => renderHook(() => ({ account: useSecuritySession(), shares: useSharedInformation(), voice: useLiveVoice(), ai: useAI() }), { wrapper: Wrapper });

test("general sign-in authenticates voice once and sends the exact confirmed destination", async () => {
  const { result } = await hook();
  await waitFor(() => expect(result.current.ai.ready).toBe(true));
  await act(() => result.current.account.signIn("a@example.test", "synthetic password"));
  await waitFor(() => expect(result.current.voice.consent).toBe(true));
  expect(result.current.voice.signedIn).toBe(true);
  await act(async () => { expect((await result.current.shares.submitShare(share)).status).toBe("complete"); });
  expect(calls.find(c => c.path.endsWith("/shares"))?.body).toEqual({ requestId: share.requestId, destination, content: share.content });
  expect(result.current.shares.simulated).toBe(false);
});
test("lost response remains unknown; retry reconciles status without another create", async () => {
  const { result } = await hook();
  await act(() => result.current.account.signIn("a@example.test", "synthetic password"));
  loseResponse = true;
  await act(async () => { expect(await result.current.shares.submitShare(share)).toEqual({ status: "unknown" }); });
  await act(async () => {
    expect(await result.current.shares.submitShare({ ...share, destination: { ...destination, email: "c@example.test" } })).toEqual({ status: "failed", error: "CONFLICT" });
    expect((await result.current.shares.submitShare(share)).status).toBe("complete");
  });
  expect(calls.filter(c => c.path.endsWith("/shares") && c.method === "POST")).toHaveLength(1);
  expect(result.current.shares.records).toHaveLength(1);
});
test("account switching stops voice immediately and rejects in-flight results from the old account", async () => {
  const { result } = await hook();
  await waitFor(() => expect(result.current.ai.ready).toBe(true));
  await act(() => result.current.account.signIn("a@example.test", "synthetic password"));
  await waitFor(() => expect(result.current.voice.consent).toBe(true));
  await act(() => result.current.voice.start());
  expect(result.current.voice.update.microphoneActive).toBe(true);
  let finish!: (value: unknown) => void;
  deferredCreate = () => new Promise(resolve => { finish = resolve; });
  let pending!: Promise<unknown>;
  await act(() => { pending = result.current.shares.submitShare(share); });
  await act(() => result.current.account.signIn("b@example.test", "synthetic password"));
  expect(mockDispose).toHaveBeenCalled();
  expect(result.current.voice.update.microphoneActive).toBe(false);
  await act(async () => { finish({ ...share, id: "old-account-share", createdAt: 1, executionMode: "live" }); expect(await pending).toEqual({ status: "stale" }); });
  expect(result.current.account.identity?.owner).toBe("b");
  expect(result.current.shares.records).toEqual([]);
});
test("voice consent withdrawal and logout stop audio without waiting for a remote response", async () => {
  const { result } = await hook();
  await waitFor(() => expect(result.current.ai.ready).toBe(true));
  await act(() => result.current.account.signIn("a@example.test", "synthetic password"));
  await waitFor(() => expect(result.current.voice.consent).toBe(true));
  await act(() => result.current.voice.start());
  await act(() => result.current.voice.setVoiceConsent(false));
  expect(result.current.voice.update.microphoneActive).toBe(false);
  await act(() => result.current.account.logout());
  expect(result.current.account.identity).toBeNull();
  expect(result.current.shares.records).toEqual([]);
});
test("account cache deletion removes exactly its own key, preserving synthetic and other-account stores", async () => {
  const preserved = ["mindguard.synthetic.v1", "mindguard.synthetic.recipients.v1", "mindguard.synthetic.privacy-preferences.v1", "mindguard.account.b.ai.v1"];
  for (const key of preserved) await AsyncStorage.setItem(key, `preserve-${key}`);
  const { result, unmount } = await renderHook(() => useAI(), { wrapper: ({ children }: PropsWithChildren) => <AIProvider storageKey="mindguard.account.a.ai.v1">{children}</AIProvider> });
  await waitFor(() => expect(result.current.ready).toBe(true));
  const removeCache = result.current.removeAccountCache;
  await unmount(); await removeCache();
  expect(await AsyncStorage.getItem("mindguard.account.a.ai.v1")).toBeNull();
  for (const key of preserved) expect(await AsyncStorage.getItem(key)).toBe(`preserve-${key}`);
});

test("an expired account cannot read or submit, and expiry cleanup stops active voice", async () => {
  const { result } = await hook();
  await waitFor(() => expect(result.current.ai.ready).toBe(true));
  await act(() => result.current.account.signIn("a@example.test", "synthetic password"));
  await waitFor(() => expect(result.current.voice.consent).toBe(true));
  await act(() => result.current.voice.start());
  const expiry = result.current.account.identity!.expiresAt;
  jest.spyOn(Date, "now").mockReturnValue(expiry + 1);
  await act(async () => { await expect(result.current.account.request("/snapshot")).rejects.toMatchObject({ code: "AUTH_REQUIRED" }); });
  expect(result.current.account.identity).toBeNull();
  expect(result.current.voice.update.microphoneActive).toBe(false);
  expect(result.current.shares.records).toEqual([]);
});

test("changing an account storage key on the mounted provider isolates reads and queued writes", async () => {
  let ai!: ReturnType<typeof useAI>;
  function CaptureAI() { const value = useAI(); useEffect(() => { ai = value; }, [value]); return null; }
  const aKey = "mindguard.account.a.ai.v1", bKey = "mindguard.account.b.ai.v1";
  const view = await render(<AIProvider storageKey={aKey}><CaptureAI /></AIProvider>);
  await waitFor(() => expect(ai.ready).toBe(true));
  await act(() => { ai.newConversation(); ai.remember("ONLY_ACCOUNT_A"); });
  await view.rerender(<AIProvider storageKey={bKey}><CaptureAI /></AIProvider>);
  await waitFor(() => expect(ai.ready).toBe(true));
  expect(ai.model.saved.memories).toEqual([]);
  await act(() => { ai.newConversation(); ai.remember("ONLY_ACCOUNT_B"); });
  await waitFor(() => expect(ai.saving).toBe(false));
  expect(await AsyncStorage.getItem(aKey)).toContain("ONLY_ACCOUNT_A");
  expect(await AsyncStorage.getItem(aKey)).not.toContain("ONLY_ACCOUNT_B");
  expect(await AsyncStorage.getItem(bKey)).toContain("ONLY_ACCOUNT_B");
  expect(await AsyncStorage.getItem(bKey)).not.toContain("ONLY_ACCOUNT_A");
  await view.rerender(<AIProvider storageKey={aKey}><CaptureAI /></AIProvider>);
  await waitFor(() => expect(ai.model.saved.memories[0]?.text).toBe("ONLY_ACCOUNT_A"));
});

test("application identity survives a navigation provider remount and still clears on logout", async () => {
  const wrapper = ({ children }: PropsWithChildren) => <SecuritySessionProvider persistent>{children}</SecuritySessionProvider>;
  const first = await renderHook(() => useSecuritySession(), { wrapper });
  await act(() => first.result.current.signIn("a@example.test", "synthetic password"));
  await first.unmount();
  const next = await renderHook(() => useSecuritySession(), { wrapper });
  expect(next.result.current.identity?.owner).toBe("a");
  expect(next.result.current.snapshot?.preferences.sharing).toBe(true);
  await act(() => next.result.current.logout());
  expect(next.result.current.identity).toBeNull();
  expect(next.result.current.snapshot).toBeNull();
});
