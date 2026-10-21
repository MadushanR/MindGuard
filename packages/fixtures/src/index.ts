import chat from "../chat.json";
import voice from "../voice.json";
import recommendations from "../recommendations.json";
import conversations from "../conversations.json";
import emotions from "../emotions.json";
import memories from "../remembered-details.json";
import scenarios from "../scenarios.json";
import copy from "../screen-copy.json";
import wearable from "../wellness/wearable.json";
import resources from "../wellness/resources.json";
import { validateBundle } from "../validate.cjs";
import type {
  ChatScript,
  ConsentState,
  Conversation,
  Observation,
  Preferences,
  Recommendation,
  RememberedDetail,
  Scenario,
  TextProvider,
  VoiceProvider,
  VoiceScript,
} from "@mindguard/contracts";

export const rawFixtures = {
  chat,
  voice,
  recommendations,
  conversations,
  emotions,
  "remembered-details": memories,
  scenarios,
  "screen-copy": copy,
  "wellness/wearable": wearable,
  "wellness/resources": resources,
};
export const fixtureErrors = validateBundle(rawFixtures);
export const screenCopy = copy;
export const wellnessRecords = wearable;
export const wellnessResources = resources;
export const chatContent = chat;
export const voiceContent = voice;
export const demoScenarios = fixtureErrors.length
  ? []
  : (scenarios.scenarios as Scenario[]);
export const defaults: { preferences: Preferences; consent: ConsentState } =
  fixtureErrors.length
    ? {
        preferences: {
          saveHistory: false,
          retentionDays: null,
          saveVoiceTranscripts: false,
          reducedMotion: true,
          largerText: false,
        },
        consent: { voice: false, tone: false, chatObservations: false },
      }
    : (scenarios.defaults as {
        preferences: Preferences;
        consent: ConsentState;
      });
export const defaultScenarioId = scenarios.defaultScenarioId;
export const recommendationCards = recommendations.cards as Recommendation[];
export const textProvider: TextProvider = {
  reply(scriptId, index) {
    const script = (chat.scripts as ChatScript[]).find(
      (s) => s.id === scriptId,
    );
    if (!script) throw new Error(`chat.json: unknown script '${scriptId}'`);
    return script.replies[index] ?? script.fallback;
  },
};
export const voiceProvider: VoiceProvider = {
  steps(scriptId) {
    const script = (voice.scripts as VoiceScript[]).find(
      (s) => s.id === scriptId,
    );
    if (!script) throw new Error(`voice.json: unknown script '${scriptId}'`);
    return script.steps;
  },
};
export function materializeScenario(scenario: Scenario, now: number) {
  const stamp = (days: number) => now - days * 86400000;
  const records: Conversation[] = conversations.records
    .filter((c) => scenario.conversationIds.includes(c.id))
    .map((c) => ({
      id: c.id,
      title: c.title,
      createdAt: stamp(c.ageDays),
      updatedAt: stamp(c.ageDays),
      messages: c.messages.map((m, i) => ({
        ...m,
        role: m.role as "user" | "assistant",
        mode: m.mode as "text" | "voice",
        createdAt: stamp(c.ageDays) + i,
      })),
    }));
  const observations = emotions.records
    .filter((o) => scenario.observationIds.includes(o.id))
    .map(({ ageDays, ...o }) => ({
      ...o,
      createdAt: stamp(ageDays),
    })) as Observation[];
  const details = memories.records
    .filter((m) => scenario.memoryIds.includes(m.id))
    .map(({ ageDays, ...m }) => ({
      ...m,
      createdAt: stamp(ageDays),
    })) as RememberedDetail[];
  return { records, observations, memories: details };
}
