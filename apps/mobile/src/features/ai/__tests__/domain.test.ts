import { initialSaved } from "../AIProvider";
import type { SavedData } from "@mindguard/contracts";
import {
  expiredIds,
  prune,
  reducer,
  weeklyPattern,
  type AppModel,
} from "../domain";
import { parseSaved, StorageQueue } from "../storage";
import {
  defaults,
  demoScenarios,
  materializeScenario,
  rawFixtures,
  textProvider,
} from "@mindguard/fixtures";
import { validateBundle } from "../../../../../../packages/fixtures/validate.cjs";
const now = new Date(2026, 9, 18, 12).getTime();
const model = (): AppModel => ({
  saved: initialSaved(),
  active: null,
  scenarioId: "normal",
  chatStatus: "idle",
  pending: null,
  voiceState: "ready",
  voiceGeneration: 0,
});
const send = (state: AppModel, requestId = "request") =>
  reducer(
    state,
    { type: "send", text: "A synthetic reflection.", requestId },
    now,
  );
const reply = (state: AppModel, requestId = "request") =>
  reducer(
    state,
    {
      type: "reply",
      requestId,
      text: "An editable reply.",
      observation: { label: "Calm", confidence: 0.6 },
    },
    now + 1,
  );
function seeded(): SavedData {
  const scenario = demoScenarios.find((s) => s.id === "expired-history")!;
  const m = materializeScenario(scenario, now);
  return {
    ...initialSaved(),
    preferences: {
      ...defaults.preferences,
      saveHistory: true,
      retentionDays: 30,
    },
    conversations: m.records,
    observations: m.observations,
    memories: m.memories,
  };
}

describe("conversation privacy and lifecycle", () => {
  test("history is opt-in and enabling requires retention", () => {
    const state = reply(send(model()));
    expect(state.saved.conversations).toHaveLength(0);
    expect(state.saved.observations).toHaveLength(1);
    expect(
      reducer(
        state,
        {
          type: "preferences",
          preferences: { ...defaults.preferences, saveHistory: true },
        },
        now,
      ),
    ).toBe(state);
  });
  test("saved conversation continues and retry never duplicates the user message", () => {
    let state = model();
    state.saved.preferences = {
      ...defaults.preferences,
      saveHistory: true,
      retentionDays: 30,
    };
    state = send(state);
    state = reducer(state, { type: "failed", requestId: "request" }, now);
    state = reducer(state, { type: "pending", requestId: "retry" }, now);
    state = reply(state, "retry");
    expect(state.saved.conversations[0].messages).toHaveLength(2);
    expect(state.active?.replyIndex).toBe(1);
    state = reducer(
      state,
      { type: "open", id: state.saved.conversations[0].id },
      now,
    );
    expect(state.active?.messages).toHaveLength(2);
  });
  test("temporary chats never save records, observations, transcripts, or memories", () => {
    let state = model();
    state.saved.preferences = {
      ...defaults.preferences,
      saveHistory: true,
      retentionDays: 30,
      saveVoiceTranscripts: true,
    };
    state.saved.consent = { voice: true, tone: true, chatObservations: true };
    state = reducer(state, { type: "new", temporary: true }, now);
    state = reply(send(state));
    state = reducer(state, { type: "memory", text: "Do not save me" }, now);
    state = reducer(state, { type: "voice", state: "speaking" }, now);
    state = reducer(
      state,
      {
        type: "voiceTurn",
        user: "Temporary voice",
        assistant: "Temporary reply",
        observation: { label: "Calm", confidence: 0.6 },
      },
      now,
    );
    expect(state.saved.conversations).toHaveLength(0);
    expect(state.saved.observations).toHaveLength(0);
    expect(state.saved.memories).toHaveLength(0);
    state = reducer(state, { type: "leave" }, now);
    expect(state.active).toBeNull();
  });
  test("stale replies cannot write into a new or abandoned conversation", () => {
    let state = send(model());
    state = reducer(state, { type: "leave" }, now);
    expect(reply(state).active?.messages).toHaveLength(1);
    state = reducer(state, { type: "new", temporary: false }, now);
    expect(reply(state).active?.messages).toHaveLength(0);
  });
  test("saving preference changes apply to new conversations", () => {
    let state = send(model());
    state = reducer(
      state,
      {
        type: "preferences",
        preferences: {
          ...defaults.preferences,
          saveHistory: true,
          retentionDays: 30,
        },
      },
      now,
    );
    state = reply(state);
    expect(state.saved.conversations).toHaveLength(0);
    state = reducer(state, { type: "new", temporary: false }, now);
    state = reply(send(state));
    expect(state.saved.conversations).toHaveLength(1);
    state = reducer(
      state,
      {
        type: "preferences",
        preferences: { ...defaults.preferences, retentionDays: 30 },
      },
      now,
    );
    expect(state.saved.conversations).toHaveLength(1);
  });
  test("voice requires consent; transcripts and tone have separate gates", () => {
    let state = reducer(model(), { type: "new", temporary: false }, now);
    state = reducer(state, { type: "voice", state: "speaking" }, now);
    const turn = {
      type: "voiceTurn" as const,
      user: "A voice turn",
      assistant: "A response",
      observation: { label: "Calm" as const, confidence: 0.6 },
    };
    expect(reducer(state, turn, now)).toBe(state);
    state = reducer(
      state,
      { type: "consent", key: "voice", allowed: true },
      now,
    );
    state = reducer(state, turn, now);
    expect(state.saved.conversations).toHaveLength(0);
    expect(state.saved.observations).toHaveLength(0);
    state = reducer(
      state,
      { type: "consent", key: "tone", allowed: true },
      now,
    );
    state = reducer(state, turn, now);
    expect(state.saved.observations).toHaveLength(1);
    state = reducer(
      state,
      { type: "consent", key: "voice", allowed: false },
      now,
    );
    expect(state.saved.consent.tone).toBe(false);
    expect(state.voiceState).toBe("stopped");
  });
  test("opted-in transcripts persist without raw audio", () => {
    let state = model();
    state.saved.preferences = {
      ...defaults.preferences,
      saveHistory: true,
      retentionDays: 30,
      saveVoiceTranscripts: true,
    };
    state.saved.consent.voice = true;
    state = reducer(state, { type: "new", temporary: false }, now);
    state = reducer(state, { type: "voice", state: "speaking" }, now);
    state = reducer(
      state,
      {
        type: "voiceTurn",
        user: "A synthetic turn",
        assistant: "A synthetic reply",
      },
      now,
    );
    expect(state.saved.conversations[0].messages).toHaveLength(2);
    expect(JSON.stringify(state.saved)).not.toContain("audio");
  });
  test("manual deletion can retain linked observations and memories", () => {
    const state = { ...model(), saved: seeded() };
    const result = reducer(
      state,
      {
        type: "delete",
        ids: ["sample-chat"],
        observations: false,
        memories: false,
      },
      now,
    );
    expect(result.saved.conversations.map((c) => c.id)).not.toContain(
      "sample-chat",
    );
    expect(
      result.saved.memories.some((m) => m.conversationId === "sample-chat"),
    ).toBe(true);
  });
  test("retention removes records at the boundary, with linked data", () => {
    const saved = seeded();
    expect(expiredIds(saved, 7, now)).toEqual(["expired-chat"]);
    expect(expiredIds(saved, "manual", now)).toEqual([]);
    const result = prune(
      { ...saved, preferences: { ...saved.preferences, retentionDays: 7 } },
      now,
    );
    expect(result.conversations.map((c) => c.id)).toEqual(["sample-chat"]);
    expect(result.memories.map((m) => m.id)).toEqual(["sample-memory"]);
    expect(
      expiredIds(saved, 7, saved.conversations[0].createdAt + 7 * 86400000),
    ).toContain("sample-chat");
  });
  test("restoration prunes before rendering", () => {
    const saved = seeded();
    saved.preferences.retentionDays = 7;
    expect(
      reducer(model(), { type: "restore", saved }, now).saved.conversations.map(
        (c) => c.id,
      ),
    ).toEqual(["sample-chat"]);
  });
  test("corrections preserve original estimates; dismissal changes ranking", () => {
    let state = { ...model(), saved: seeded() };
    state = reducer(
      state,
      { type: "observation", id: "sample-tense", label: "Hopeful" },
      now,
    );
    const o = state.saved.observations.find((o) => o.id === "sample-tense")!;
    expect(o.predictedLabel).toBe("Tense");
    expect(o.correctedLabel).toBe("Hopeful");
    expect(weeklyPattern(state.saved.observations, now).ranked[0].label).toBe(
      "Hopeful",
    );
    state = reducer(
      state,
      { type: "observation", id: "sample-tense", dismiss: true },
      now,
    );
    expect(weeklyPattern(state.saved.observations, now).total).toBe(0);
  });
});
describe("fixture validation and editable output", () => {
  test("the supplied fixture set is valid", () =>
    expect(validateBundle(rawFixtures)).toEqual([]));
  test("edited reply content drives the provider and sequences fall back", () => {
    const original = rawFixtures.chat.scripts[0].replies[0].text;
    rawFixtures.chat.scripts[0].replies[0].text = "Edited through JSON";
    expect(textProvider.reply("normal", 0).text).toBe("Edited through JSON");
    rawFixtures.chat.scripts[0].replies[0].text = original;
    expect(textProvider.reply("normal", 999).text).toBe(
      rawFixtures.chat.scripts[0].fallback.text,
    );
  });
  test.each([
    "duplicate",
    "reference",
    "state",
    "duration",
    "consent",
    "transition",
  ])("rejects invalid fixture %s with a path", (kind) => {
    const bundle = JSON.parse(JSON.stringify(rawFixtures));
    if (kind === "duplicate")
      bundle.recommendations.cards.push(bundle.recommendations.cards[0]);
    if (kind === "reference")
      bundle.scenarios.scenarios[0].chatScriptId = "missing";
    if (kind === "state") bundle.voice.scripts[0].steps[0].state = "recording";
    if (kind === "duration") bundle.chat.scripts[0].replies[0].delayMs = -1;
    if (kind === "consent") bundle.scenarios.scenarios[0].consent.tone = true;
    if (kind === "transition")
      bundle.voice.scripts[0].steps[1].state = "listening";
    expect(validateBundle(bundle).length).toBeGreaterThan(0);
    expect(validateBundle(bundle).join(" ")).toContain(".json");
  });
});
describe("local storage boundaries", () => {
  test("valid saved data round trips and malformed data is rejected", () => {
    const saved = seeded();
    expect(parseSaved(JSON.stringify(saved))).toEqual(saved);
    expect(() => parseSaved("{")).toThrow();
    expect(() =>
      parseSaved(JSON.stringify({ ...saved, version: 2 })),
    ).toThrow();
    expect(() =>
      parseSaved(
        JSON.stringify({ ...saved, preferences: { saveHistory: true } }),
      ),
    ).toThrow();
  });
  test("writes serialize and a failed write can be retried", async () => {
    const writes: string[] = [];
    let attempt = 0;
    const queue = new StorageQueue(async (_key, raw) => {
      attempt++;
      if (attempt === 1) throw new Error("Disk unavailable");
      writes.push(raw);
    });
    const result = jest.fn();
    await queue.save(initialSaved(), result);
    expect(result).toHaveBeenLastCalledWith("Disk unavailable");
    const latest = {
      ...initialSaved(),
      consent: { voice: true, tone: false, chatObservations: false },
    };
    await queue.save(latest, result);
    expect(JSON.parse(writes[0])).toEqual(latest);
    expect(result).toHaveBeenLastCalledWith(null);
  });
});
