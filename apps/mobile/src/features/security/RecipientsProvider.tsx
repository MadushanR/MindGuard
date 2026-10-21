import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext, useCallback, useContext, useEffect, useReducer, useRef,
  type PropsWithChildren,
} from "react";
import {
  initialRecipientsState, normalizeRecipient, parseRecipients,
  RECIPIENT_STORAGE_KEY, recipientsReducer,
  type RecipientInput, type RecipientsState, type TrustedRecipient,
} from "./recipients";

export interface RecipientsContextValue extends RecipientsState {
  /** Resolves only after saving locally; adding never grants sharing permission. */
  addRecipient(input: RecipientInput): Promise<TrustedRecipient>;
  restoreRecipients(): Promise<void>;
}
const RecipientsContext = createContext<RecipientsContextValue | null>(null);

export function RecipientsProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(recipientsReducer, initialRecipientsState);
  const current = useRef(state);
  const alive = useRef(true);
  const tail = useRef<Promise<unknown>>(Promise.resolve());
  const commit = useCallback((action: Parameters<typeof recipientsReducer>[1]) => {
    current.current = recipientsReducer(current.current, action);
    if (alive.current) dispatch(action);
  }, []);
  // Serialize reads and writes so consecutive additions cannot overwrite one another.
  const enqueue = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const next = tail.current.catch(() => {}).then(task);
    tail.current = next;
    return next;
  }, []);
  const restoreRecipients = useCallback(() => enqueue(async () => {
    commit({ type: "loading" });
    try {
      const raw = await AsyncStorage.getItem(RECIPIENT_STORAGE_KEY);
      commit({ type: "restored", recipients: raw === null ? [] : parseRecipients(raw) });
    } catch {
      // Never reseed or overwrite unreadable saved records.
      commit({ type: "readFailed" });
    }
  }), [commit, enqueue]);

  const addRecipient = useCallback((input: RecipientInput) => {
    // Capture only permitted fields before queueing; callers may mutate their draft.
    let normalized: RecipientInput;
    try { normalized = normalizeRecipient(input); }
    catch (error) { return Promise.reject(error); }
    return enqueue(async () => {
      if (!current.current.ready)
        throw new Error("Open saved contacts successfully before adding a recipient.");
      const existing = current.current.recipients;
      let id: string;
      do { id = `recipient-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
      while (existing.some((recipient) => recipient.id === id));
      const recipient = { id, ...normalized };
      commit({ type: "saving" });
      try {
        await AsyncStorage.setItem(RECIPIENT_STORAGE_KEY, JSON.stringify({
          version: 1, recipients: [...existing, recipient],
        }));
        commit({ type: "added", recipient });
        return recipient;
      } catch {
        commit({ type: "writeFailed" });
        throw new Error("The contact could not be saved. Please try again.");
      }
    });
  }, [commit, enqueue]);

  useEffect(() => {
    alive.current = true;
    void restoreRecipients();
    return () => { alive.current = false; };
  }, [restoreRecipients]);

  return (
    <RecipientsContext.Provider value={{ ...state, addRecipient, restoreRecipients }}>
      {children}
    </RecipientsContext.Provider>
  );
}

export function useRecipients(): RecipientsContextValue {
  const value = useContext(RecipientsContext);
  if (!value) throw new Error("useRecipients requires RecipientsProvider.");
  return value;
}
