import type {
  ActiveConversation,
  ConsentState,
  Conversation,
  Emotion,
  Message,
  Observation,
  Preferences,
  Retention,
  SavedData,
  SimulationEstimate,
  VoiceState,
} from "@mindguard/contracts";

export const makeId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
export const effectiveEmotion = (o: Observation) =>
  o.correctedLabel ?? o.predictedLabel;
export function expiredIds(
  saved: SavedData,
  days: Retention = saved.preferences.retentionDays,
  now = Date.now(),
) {
  return days === null || days === "manual"
    ? []
    : saved.conversations
        .filter((c) => c.createdAt <= now - days * 86400000)
        .map((c) => c.id);
}
export function removeRecords(
  saved: SavedData,
  ids: string[],
  observations = true,
  memories = true,
): SavedData {
  if (!ids.length) return saved;
  return {
    ...saved,
    conversations: saved.conversations.filter((c) => !ids.includes(c.id)),
    observations: observations
      ? saved.observations.filter(
          (o) => !o.conversationId || !ids.includes(o.conversationId),
        )
      : saved.observations,
    memories: memories
      ? saved.memories.filter(
          (m) => !m.conversationId || !ids.includes(m.conversationId),
        )
      : saved.memories,
  };
}
export function prune(saved: SavedData, now = Date.now()) {
  return removeRecords(
    saved,
    expiredIds(saved, saved.preferences.retentionDays, now),
  );
}
export function weeklyPattern(observations: Observation[], now = Date.now()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const current = observations.filter(
    (o) => !o.dismissed && o.createdAt >= start.getTime() && o.createdAt <= now,
  );
  const counts = new Map<
    Emotion,
    { label: Emotion; count: number; latest: number }
  >();
  current.forEach((o) => {
    const label = effectiveEmotion(o),
      previous = counts.get(label);
    counts.set(label, {
      label,
      count: (previous?.count ?? 0) + 1,
      latest: Math.max(previous?.latest ?? 0, o.createdAt),
    });
  });
  return {
    total: current.length,
    estimated: current.some((o) => o.status === "Estimated"),
    ranked: [...counts.values()].sort(
      (a, b) =>
        b.count - a.count ||
        b.latest - a.latest ||
        a.label.localeCompare(b.label),
    ),
  };
}
export interface AppModel {
  saved: SavedData;
  active: ActiveConversation | null;
  scenarioId: string;
  chatStatus: "idle" | "processing" | "error";
  pending: { text: string; requestId: string } | null;
  voiceState: VoiceState;
  voiceGeneration: number;
}
export type Action =
  | { type: "restore"; saved: SavedData }
  | { type: "scenario"; saved: SavedData; id: string }
  | { type: "new"; temporary: boolean }
  | { type: "open"; id: string }
  | { type: "leave" }
  | { type: "send"; text: string; requestId: string }
  | { type: "pending"; requestId: string }
  | {
      type: "reply";
      requestId: string;
      text: string;
      observation?: SimulationEstimate;
    }
  | { type: "failed"; requestId: string }
  | { type: "voice"; state: VoiceState; index?: number }
  | {
      type: "voiceTurn";
      user?: string;
      assistant?: string;
      observation?: SimulationEstimate;
    }
  | { type: "preferences"; preferences: Preferences }
  | { type: "consent"; key: keyof ConsentState; allowed: boolean }
  | { type: "delete"; ids: string[]; observations: boolean; memories: boolean }
  | { type: "memory"; text: string }
  | { type: "removeMemory"; id: string }
  | {
      type: "observation";
      id: string;
      status?: "Confirmed";
      label?: Emotion;
      dismiss?: boolean;
    }
  | { type: "expire"; now: number };
export function freshActive(
  saved: SavedData,
  temporary: boolean,
  now: number,
): ActiveConversation {
  return {
    id: makeId("conversation"),
    createdAt: now,
    messages: [],
    temporary,
    saving: saved.preferences.saveHistory && !temporary,
    saveVoiceTranscripts:
      saved.preferences.saveHistory &&
      saved.preferences.saveVoiceTranscripts &&
      !temporary,
    replyIndex: 0,
    voiceIndex: 0,
  };
}
function sync(model: AppModel): AppModel {
  const active = model.active;
  if (!active?.saving || active.temporary) return model;
  const messages = active.messages.filter(
    (m) => m.mode === "text" || active.saveVoiceTranscripts,
  );
  if (!messages.length) return model;
  const record: Conversation = {
    id: active.id,
    title:
      messages.find((m) => m.role === "user")?.text.slice(0, 70) ??
      "A conversation with Zen",
    createdAt: active.createdAt,
    updatedAt: messages.at(-1)!.createdAt,
    messages,
  };
  const existing = model.saved.conversations.some((c) => c.id === active.id);
  return {
    ...model,
    saved: {
      ...model.saved,
      conversations: existing
        ? model.saved.conversations.map((c) =>
            c.id === active.id ? record : c,
          )
        : [record, ...model.saved.conversations],
    },
  };
}
function addEstimate(
  model: AppModel,
  estimate: SimulationEstimate | undefined,
  source: Observation["source"],
  now: number,
) {
  if (
    !estimate ||
    !model.active ||
    model.active.temporary ||
    !(source === "Chat"
      ? model.saved.consent.chatObservations
      : model.saved.consent.voice && model.saved.consent.tone)
  )
    return model;
  const observation: Observation = {
    id: makeId("observation"),
    conversationId: model.active.id,
    source,
    predictedLabel: estimate.label,
    confidence: estimate.confidence,
    status: "Estimated",
    dismissed: false,
    createdAt: now,
  };
  return {
    ...model,
    saved: {
      ...model.saved,
      observations: [...model.saved.observations, observation],
    },
  };
}
export function reducer(
  model: AppModel,
  action: Action,
  now = Date.now(),
): AppModel {
  const message = (
    role: Message["role"],
    text: string,
    mode: Message["mode"],
  ): Message => ({ id: makeId("message"), role, text, mode, createdAt: now });
  switch (action.type) {
    case "restore":
      return { ...model, saved: prune(action.saved, now) };
    case "scenario":
      return {
        saved: prune(action.saved, now),
        active: null,
        scenarioId: action.id,
        chatStatus: "idle",
        pending: null,
        voiceState: "ready",
        voiceGeneration: model.voiceGeneration + 1,
      };
    case "new":
      return {
        ...model,
        active: freshActive(model.saved, action.temporary, now),
        chatStatus: "idle",
        pending: null,
        voiceState: "ready",
        voiceGeneration: model.voiceGeneration + 1,
      };
    case "open": {
      const saved = prune(model.saved, now),
        record = saved.conversations.find((c) => c.id === action.id);
      if (!record) return { ...model, saved };
      return {
        ...model,
        saved,
        active: {
          ...freshActive(saved, false, now),
          ...record,
          saving: true,
          saveVoiceTranscripts: saved.preferences.saveVoiceTranscripts,
          replyIndex: record.messages.filter(
            (m) => m.role === "assistant" && m.mode === "text",
          ).length,
        },
        chatStatus: "idle",
        pending: null,
        voiceState: "ready",
        voiceGeneration: model.voiceGeneration + 1,
      };
    }
    case "leave":
      return {
        ...model,
        active: model.active?.temporary ? null : model.active,
        chatStatus: "idle",
        pending: null,
        voiceState: "stopped",
        voiceGeneration: model.voiceGeneration + 1,
      };
    case "send": {
      if (!action.text.trim() || model.chatStatus === "processing")
        return model;
      const active = model.active ?? freshActive(model.saved, false, now);
      return sync({
        ...model,
        active: {
          ...active,
          messages: [
            ...active.messages,
            message("user", action.text.trim(), "text"),
          ],
        },
        chatStatus: "processing",
        pending: { text: action.text, requestId: action.requestId },
      });
    }
    case "pending":
      return model.pending
        ? {
            ...model,
            pending: { ...model.pending, requestId: action.requestId },
            chatStatus: "processing",
          }
        : model;
    case "reply": {
      if (
        !model.active ||
        model.pending?.requestId !== action.requestId ||
        model.chatStatus !== "processing"
      )
        return model;
      return addEstimate(
        sync({
          ...model,
          active: {
            ...model.active,
            messages: [
              ...model.active.messages,
              message("assistant", action.text, "text"),
            ],
            replyIndex: model.active.replyIndex + 1,
          },
          chatStatus: "idle",
          pending: null,
        }),
        action.observation,
        "Chat",
        now,
      );
    }
    case "failed":
      return model.pending?.requestId === action.requestId
        ? { ...model, chatStatus: "error" }
        : model;
    case "voice":
      return {
        ...model,
        active:
          action.index !== undefined && model.active
            ? { ...model.active, voiceIndex: action.index }
            : model.active,
        voiceState: action.state,
        voiceGeneration: model.voiceGeneration + 1,
      };
    case "voiceTurn": {
      if (
        !model.active ||
        !model.saved.consent.voice ||
        model.voiceState !== "speaking"
      )
        return model;
      const active = model.active;
      const messages =
        action.user && action.assistant
          ? [
              ...active.messages,
              message("user", action.user, "voice"),
              message("assistant", action.assistant, "voice"),
            ]
          : active.messages;
      return addEstimate(
        sync({ ...model, active: { ...active, messages } }),
        action.observation,
        "Voice tone",
        now,
      );
    }
    case "preferences": {
      if (
        action.preferences.saveHistory &&
        action.preferences.retentionDays === null
      )
        return model;
      const saved = prune(
        { ...model.saved, preferences: action.preferences },
        now,
      );
      const expiredActive =
        model.active?.saving &&
        !saved.conversations.some((c) => c.id === model.active?.id) &&
        expiredIds(model.saved, action.preferences.retentionDays, now).includes(
          model.active.id,
        );
      return {
        ...model,
        saved,
        ...(expiredActive
          ? {
              active: null,
              pending: null,
              chatStatus: "idle" as const,
              voiceState: "stopped" as const,
              voiceGeneration: model.voiceGeneration + 1,
            }
          : {}),
      };
    }
    case "consent": {
      const consent = { ...model.saved.consent, [action.key]: action.allowed };
      if (!consent.voice) consent.tone = false;
      if (action.key === "tone" && action.allowed && !consent.voice)
        return model;
      return {
        ...model,
        saved: { ...model.saved, consent },
        ...(!consent.voice
          ? {
              voiceState: "stopped" as const,
              voiceGeneration: model.voiceGeneration + 1,
            }
          : {}),
      };
    }
    case "delete":
      return {
        ...model,
        saved: removeRecords(
          model.saved,
          action.ids,
          action.observations,
          action.memories,
        ),
        ...(model.active && action.ids.includes(model.active.id)
          ? {
              active: null,
              pending: null,
              chatStatus: "idle" as const,
              voiceState: "stopped" as const,
              voiceGeneration: model.voiceGeneration + 1,
            }
          : {}),
      };
    case "memory":
      return !model.active || model.active.temporary || !action.text.trim()
        ? model
        : {
            ...model,
            saved: {
              ...model.saved,
              memories: [
                ...model.saved.memories,
                {
                  id: makeId("memory"),
                  text: action.text.trim().slice(0, 300),
                  conversationId: model.active.id,
                  createdAt: now,
                },
              ],
            },
          };
    case "removeMemory":
      return {
        ...model,
        saved: {
          ...model.saved,
          memories: model.saved.memories.filter((m) => m.id !== action.id),
        },
      };
    case "observation":
      return {
        ...model,
        saved: {
          ...model.saved,
          observations: model.saved.observations.map((o) =>
            o.id === action.id
              ? {
                  ...o,
                  ...(action.dismiss
                    ? { dismissed: true }
                    : action.label
                      ? {
                          correctedLabel: action.label,
                          status: "Corrected" as const,
                        }
                      : {
                          status: o.correctedLabel
                            ? ("Corrected" as const)
                            : ("Confirmed" as const),
                        }),
                }
              : o,
          ),
        },
      };
    case "expire": {
      const ids = expiredIds(
        model.saved,
        model.saved.preferences.retentionDays,
        action.now,
      );
      if (!ids.length) return model;
      return reducer(
        model,
        { type: "delete", ids, observations: true, memories: true },
        action.now,
      );
    }
  }
}
