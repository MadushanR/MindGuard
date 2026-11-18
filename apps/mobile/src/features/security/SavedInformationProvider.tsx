import { createContext, useCallback, useContext, useReducer, type PropsWithChildren } from "react";
import {
  initialSavedInformation, savedInformationReducer,
  type SavedCategoryId, type SavedInformationCategory,
} from "./savedInformation";
import { useSecuritySessionOptional, type SecuritySession } from "./SecuritySessionProvider";

export interface SavedInformationContextValue {
  readonly records: readonly SavedInformationCategory[];
  /** Call after confirming exact category IDs. Live mode deletes only those owned AWS categories. */
  deleteCategories(ids: readonly SavedCategoryId[]): void | Promise<void>;
  live?: boolean;
  ready?: boolean;
  error?: string | null;
  saveExamples?: () => Promise<void>;
}
const Context = createContext<SavedInformationContextValue | null>(null);
export function SavedInformationProvider({ children }: PropsWithChildren) {
  const session = useSecuritySessionOptional();
  if (session) return <LiveSavedProvider session={session}>{children}</LiveSavedProvider>;
  return <LocalSavedProvider>{children}</LocalSavedProvider>;
}
function LiveSavedProvider({ children, session }: PropsWithChildren<{ session: SecuritySession }>) {
  return <Context.Provider value={{ records: session.snapshot?.saved ?? [], live: true, ready: !!session.snapshot, error: session.error,
    deleteCategories: async ids => { await session.request("/saved", "DELETE", { categories: ids }); await session.refresh(); },
    saveExamples: async () => { await session.request("/saved", "PUT", { categories: initialSavedInformation() }); await session.refresh(); },
  }}>{children}</Context.Provider>;
}
function LocalSavedProvider({ children }: PropsWithChildren) {
  const [records, dispatch] = useReducer(savedInformationReducer, undefined, initialSavedInformation);
  const deleteCategories = useCallback((ids: readonly SavedCategoryId[]) => {
    dispatch({ type: "delete", ids: [...ids] });
  }, []);
  return <Context.Provider value={{ records, deleteCategories }}>{children}</Context.Provider>;
}
export function useSavedInformation(): SavedInformationContextValue {
  const value = useContext(Context);
  if (!value) throw new Error("useSavedInformation requires SavedInformationProvider.");
  return value;
}
