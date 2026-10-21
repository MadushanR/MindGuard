import {
  createContext, useCallback, useContext, useReducer, useRef,
  type PropsWithChildren,
} from "react";
import {
  normalizeShare, sharedInformationReducer,
  type ShareInput, type SharedInformationRecord,
} from "./sharedInformation";

export interface SharedInformationContextValue {
  records: readonly SharedInformationRecord[];
  /** Call only after an explicit recipient-sharing confirmation; never for export. */
  recordShare(input: ShareInput): SharedInformationRecord;
  revokeShare(id: string): void;
  clearShareSession(): void;
}
const Context = createContext<SharedInformationContextValue | null>(null);

export function SharedInformationProvider({ children }: PropsWithChildren) {
  const [records, dispatch] = useReducer(sharedInformationReducer, []);
  const sequence = useRef(0);
  const recordShare = useCallback((input: ShareInput) => {
    const snapshot = normalizeShare(input);
    const createdAt = Date.now();
    const record = {
      ...snapshot,
      id: `share-${createdAt}-${++sequence.current}`,
      createdAt,
    };
    dispatch({ type: "record", record });
    return record;
  }, []);
  const revokeShare = useCallback((id: string) => dispatch({ type: "revoke", id }), []);
  const clearShareSession = useCallback(() => dispatch({ type: "clear" }), []);
  return (
    <Context.Provider value={{ records, recordShare, revokeShare, clearShareSession }}>
      {children}
    </Context.Provider>
  );
}
export function useSharedInformation(): SharedInformationContextValue {
  const value = useContext(Context);
  if (!value) throw new Error("useSharedInformation requires SharedInformationProvider.");
  return value;
}
