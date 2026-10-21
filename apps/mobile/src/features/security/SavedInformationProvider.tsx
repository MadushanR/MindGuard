import { createContext, useCallback, useContext, useReducer, type PropsWithChildren } from "react";
import {
  initialSavedInformation, savedInformationReducer,
  type SavedCategoryId, type SavedInformationCategory,
} from "./savedInformation";

export interface SavedInformationContextValue {
  readonly records: readonly SavedInformationCategory[];
  /** Call only after a dialog confirms the exact category IDs. No persistent data is touched. */
  deleteCategories(ids: readonly SavedCategoryId[]): void;
}
const Context = createContext<SavedInformationContextValue | null>(null);
export function SavedInformationProvider({ children }: PropsWithChildren) {
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
