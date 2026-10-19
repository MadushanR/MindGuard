import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import type {
  ConsentState,
  Emotion,
  Preferences,
  SavedData,
} from "@mindguard/contracts";
import {
  defaultScenarioId,
  defaults,
  demoScenarios,
  materializeScenario,
  textProvider,
  voiceProvider,
  chatContent,
  fixtureErrors,
} from "@mindguard/fixtures";
import { makeId, reducer, type Action, type AppModel } from "./domain";
import { parseSaved, STORAGE_KEY, StorageQueue } from "./storage";

export function initialSaved(): SavedData {
  return {
    version: 1,
    preferences: { ...defaults.preferences },
    consent: { ...defaults.consent },
    conversations: [],
    observations: [],
    memories: [],
  };
}
const initialModel = (): AppModel => ({
  saved: initialSaved(),
  active: null,
  scenarioId: defaultScenarioId,
  chatStatus: "idle",
  pending: null,
  voiceState: "ready",
  voiceGeneration: 0,
});
function useController() {
  const [model, dispatch] = useReducer(
    (_previous: AppModel, next: AppModel) => next,
    undefined,
    initialModel,
  );
  const current = useRef(model);
  const [ready, setReady] = useState(false),
    [readError, setReadError] = useState<string | null>(null),
    [writeError, setWriteError] = useState<string | null>(null),
    [saving, setSaving] = useState(false);
  const chatTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    voiceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failed = useRef(new Set<string>());
  const queue = useRef<StorageQueue | null>(null);
  if (!queue.current)
    queue.current = new StorageQueue((key, value) =>
      AsyncStorage.setItem(key, value),
    );
  const commit = useCallback((action: Action) => {
    current.current = reducer(current.current, action);
    dispatch(current.current);
  }, []);
  const cancelChat = useCallback(() => {
    if (chatTimer.current) clearTimeout(chatTimer.current);
    chatTimer.current = null;
  }, []);
  const cancelVoice = useCallback(() => {
    if (voiceTimer.current) clearTimeout(voiceTimer.current);
    voiceTimer.current = null;
  }, []);
  const restore = useCallback(async () => {
    setReadError(null);
    setReady(false);
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      commit({
        type: "restore",
        saved: raw ? parseSaved(raw) : initialSaved(),
      });
      setReady(true);
    } catch (error) {
      setReadError(
        error instanceof Error ? error.message : "Storage unavailable",
      );
    }
  }, [commit]);
  useEffect(() => {
    void restore();
    return () => {
      cancelChat();
      cancelVoice();
    };
  }, [restore, cancelChat, cancelVoice]);
  const persist = useCallback((saved: SavedData) => {
    setSaving(true);
    void queue.current!.save(saved, (error) => {
      setWriteError(error);
      setSaving(false);
    });
  }, []);
  useEffect(() => {
    if (ready && !fixtureErrors.length) persist(model.saved);
  }, [model.saved, ready, persist]);
  useEffect(() => {
    if (!ready) return;
    const expire = () => commit({ type: "expire", now: Date.now() });
    const interval = setInterval(expire, 30000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") expire();
      else {
        cancelVoice();
        commit({ type: "voice", state: "stopped" });
      }
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [ready, commit, cancelVoice]);
  const scheduleReply = useCallback(
    (requestId: string) => {
      cancelChat();
      const state = current.current,
        scenario = demoScenarios.find((s) => s.id === state.scenarioId)!;
      const reply = textProvider.reply(
        scenario.chatScriptId,
        state.active?.replyIndex ?? 0,
      );
      const attemptId = `${state.active?.id}:${state.active?.replyIndex}`;
      chatTimer.current = setTimeout(() => {
        if (reply.failOnce && !failed.current.has(attemptId)) {
          failed.current.add(attemptId);
          commit({ type: "failed", requestId });
        } else
          commit({
            type: "reply",
            requestId,
            text: reply.text,
            observation: reply.observation,
          });
      }, reply.delayMs);
    },
    [cancelChat, commit],
  );
  const send = useCallback(
    (text: string) => {
      if (!ready || !text.trim() || current.current.chatStatus === "processing")
        return;
      const requestId = makeId("request");
      commit({ type: "send", text, requestId });
      scheduleReply(requestId);
    },
    [ready, commit, scheduleReply],
  );
  const retry = useCallback(() => {
    if (!current.current.pending || current.current.chatStatus !== "error")
      return;
    const requestId = makeId("request");
    commit({ type: "pending", requestId });
    scheduleReply(requestId);
  }, [commit, scheduleReply]);
  const newConversation = useCallback(
    (temporary = false) => {
      cancelChat();
      cancelVoice();
      failed.current.clear();
      commit({ type: "new", temporary });
    },
    [cancelChat, cancelVoice, commit],
  );
  const leave = useCallback(() => {
    cancelChat();
    cancelVoice();
    commit({ type: "leave" });
  }, [cancelChat, cancelVoice, commit]);
  const stopVoice = useCallback(() => {
    cancelVoice();
    commit({ type: "voice", state: "stopped" });
  }, [cancelVoice, commit]);
  const beginVoiceStep = useCallback(
    function step(index: number) {
      cancelVoice();
      const state = current.current;
      if (!state.saved.consent.voice) return;
      const scenario = demoScenarios.find((s) => s.id === state.scenarioId)!;
      const steps = voiceProvider.steps(scenario.voiceScriptId),
        selected = steps[index] ?? steps[0];
      const resolvedIndex = steps[index] ? index : 0;
      commit({ type: "voice", state: selected.state, index: resolvedIndex });
      if (["error", "stopped", "reconnecting"].includes(selected.state)) return;
      const generation = current.current.voiceGeneration,
        activeId = current.current.active?.id;
      voiceTimer.current = setTimeout(() => {
        if (
          current.current.voiceGeneration !== generation ||
          current.current.active?.id !== activeId ||
          !current.current.saved.consent.voice
        )
          return;
        if (selected.state === "speaking") {
          commit({
            type: "voiceTurn",
            ...selected.transcript,
            observation: selected.observation,
          });
        }
        step(resolvedIndex + 1);
      }, selected.durationMs);
    },
    [cancelVoice, commit],
  );
  const startVoice = useCallback(() => {
    if (!current.current.saved.consent.voice) return;
    if (!current.current.active) commit({ type: "new", temporary: false });
    beginVoiceStep(0);
  }, [beginVoiceStep, commit]);
  const setConsent = useCallback(
    (key: keyof ConsentState, allowed: boolean) => {
      if (key === "voice" && !allowed) cancelVoice();
      commit({ type: "consent", key, allowed });
    },
    [commit, cancelVoice],
  );
  const loadScenario = useCallback(
    (id: string) => {
      const scenario = demoScenarios.find((s) => s.id === id);
      if (!scenario) return;
      cancelChat();
      cancelVoice();
      failed.current.clear();
      const materialized = materializeScenario(scenario, Date.now());
      commit({
        type: "scenario",
        id,
        saved: {
          version: 1,
          preferences: { ...scenario.preferences },
          consent: { ...scenario.consent },
          conversations: materialized.records,
          observations: materialized.observations,
          memories: materialized.memories,
        },
      });
      if (scenario.initialChatState !== "idle") {
        commit({ type: "new", temporary: false });
        const requestId = makeId("preview");
        commit({
          type: "send",
          requestId,
          text: chatContent.suggestedPrompts[0] ?? chatContent.introduction,
        });
        if (scenario.initialChatState === "error") {
          failed.current.add(`${current.current.active?.id}:0`);
          commit({ type: "failed", requestId });
        } else scheduleReply(requestId);
      }
    },
    [cancelChat, cancelVoice, commit, scheduleReply],
  );
  const resetLocalData = useCallback(async () => {
    cancelChat();
    cancelVoice();
    try {
      await queue.current!.flush();
      await AsyncStorage.removeItem(STORAGE_KEY);
      commit({
        type: "scenario",
        id: defaultScenarioId,
        saved: initialSaved(),
      });
      setReadError(null);
      setWriteError(null);
      setReady(true);
    } catch (error) {
      setReadError(error instanceof Error ? error.message : "Reset failed");
    }
  }, [cancelChat, cancelVoice, commit]);
  return {
    model,
    ready,
    readError,
    writeError,
    saving,
    send,
    retry,
    newConversation,
    leave,
    startVoice,
    stopVoice,
    setConsent,
    loadScenario,
    resetLocalData,
    restore,
    retryStorage: () => persist(current.current.saved),
    openConversation: (id: string) => {
      cancelChat();
      cancelVoice();
      commit({ type: "open", id });
    },
    muteVoice: () => {
      if (current.current.voiceState === "muted") beginVoiceStep(0);
      else {
        cancelVoice();
        commit({ type: "voice", state: "muted" });
      }
    },
    interruptVoice: () => {
      if (current.current.voiceState === "speaking") beginVoiceStep(0);
    },
    reconnectVoice: () => {
      if (["reconnecting", "error"].includes(current.current.voiceState))
        beginVoiceStep(
          current.current.voiceState === "error"
            ? 0
            : (current.current.active?.voiceIndex ?? 0) + 1,
        );
    },
    savePreferences: (preferences: Preferences) =>
      commit({ type: "preferences", preferences }),
    deleteConversations: (
      ids: string[],
      observations: boolean,
      memories: boolean,
    ) => {
      cancelChat();
      cancelVoice();
      commit({ type: "delete", ids, observations, memories });
    },
    remember: (text: string) => commit({ type: "memory", text }),
    removeMemory: (id: string) => commit({ type: "removeMemory", id }),
    confirmObservation: (id: string) =>
      commit({ type: "observation", id, status: "Confirmed" }),
    correctObservation: (id: string, label: Emotion) =>
      commit({ type: "observation", id, label }),
    dismissObservation: (id: string) =>
      commit({ type: "observation", id, dismiss: true }),
    observations: model.saved.observations,
    consent: model.saved.consent,
  };
}
type Controller = ReturnType<typeof useController>;
const Context = createContext<Controller | null>(null);
export function AIProvider({ children }: PropsWithChildren) {
  const value = useController();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAI() {
  const value = useContext(Context);
  if (!value) throw new Error("Mount AIProvider in the root layout.");
  return value;
}
