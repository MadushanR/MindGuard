import { act, cleanup, renderHook, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PropsWithChildren } from "react";
import { AIProvider, useAI } from "../AIProvider";
import { LiveVoiceProvider, useLiveVoice } from "../live/LiveVoiceProvider";
import { STORAGE_KEY } from "../storage";

jest.mock("../live/VoiceAudio", () => ({ VoiceAudio: class { dispose() {} } }));
jest.mock("../live/config", () => ({ voiceRelayUrl: () => "https://relay.example.invalid" }));
jest.mock("../live/VoiceSessionController", () => ({
  VoiceSessionController: class {
    constructor(_url: string, _token: string, _audio: unknown, private mockUpdate: (value: unknown) => void) {}
    async start() { this.mockUpdate({ state: "listening", microphoneActive: true }); }
    stop() { this.mockUpdate({ state: "stopped", microphoneActive: false }); }
    async handoff() {
      return { sessionId: "synthetic-text-session", expiresAt: Date.now() + 100000,
        messages: [{ role: "user", content: "PRIVATE_LIVE_VOICE_MARKER" }, { role: "assistant", content: "PRIVATE_REPLY_MARKER" }] };
    }
  },
}));
const identity = {
  signIn: jest.fn(async () => ({ token: "synthetic-access-token", expiresAt: Date.now() + 60000 })),
  signUp: jest.fn(async () => {}), confirm: jest.fn(async () => {}), signOut: jest.fn(async () => {}),
};
function Wrapper({ children }: PropsWithChildren) {
  return <AIProvider><LiveVoiceProvider identityPort={identity}>{children}</LiveVoiceProvider></AIProvider>;
}
beforeEach(async () => {
  await AsyncStorage.clear();
  jest.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, json: async () => ({ allowed: true }) } as Response);
});
afterEach(async () => { await cleanup(); jest.restoreAllMocks(); });

test("a live text handoff stays out of storage even with the old transcript preference enabled", async () => {
  const { result } = await renderHook(() => ({ voice: useLiveVoice(), ai: useAI() }), { wrapper: Wrapper });
  await waitFor(() => expect(result.current.ai.ready).toBe(true));
  await act(() => result.current.ai.savePreferences({ ...result.current.ai.model.saved.preferences, saveHistory: true, retentionDays: 7, saveVoiceTranscripts: true }));
  await act(() => result.current.voice.signIn("synthetic@example.invalid", "synthetic password"));
  await act(() => result.current.voice.start());
  await act(() => result.current.voice.switchToText());
  expect(result.current.voice.handoff?.messages[0].content).toBe("PRIVATE_LIVE_VOICE_MARKER");
  await waitFor(async () => expect(await AsyncStorage.getItem(STORAGE_KEY)).not.toBeNull());
  const persisted = await AsyncStorage.getItem(STORAGE_KEY);
  expect(persisted).not.toContain("PRIVATE_LIVE_VOICE_MARKER");
  expect(persisted).not.toContain("PRIVATE_REPLY_MARKER");
  expect(persisted).not.toContain("synthetic-access-token");
  await act(() => result.current.voice.logout());
  expect(result.current.voice.handoff).toBeNull();
  expect(result.current.voice.update.microphoneActive).toBe(false);
});

test("a late sign-in cannot restore access after logout", async () => {
  let finish: (value: { token: string; expiresAt: number }) => void = () => {};
  identity.signIn.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const { result } = await renderHook(() => useLiveVoice(), { wrapper: Wrapper });
  let pending: Promise<void>;
  await act(() => { pending = result.current.signIn("synthetic@example.invalid", "synthetic password"); });
  await act(() => result.current.logout());
  await act(async () => { finish({ token: "obsolete-token", expiresAt: Date.now() + 60000 }); await pending; });
  expect(result.current.signedIn).toBe(false);
  expect(result.current.consent).toBeNull();
});
