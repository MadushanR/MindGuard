import copy from "../../../../../packages/fixtures/security/saved-information.json";
import demo from "../../../../../packages/fixtures/security/saved-information-records.json";

export const savedCategoryIds = ["weekly-summary", "wellness-records"] as const;
export type SavedCategoryId = typeof savedCategoryIds[number];
export interface SavedInformationCategory {
  readonly id: SavedCategoryId;
  readonly label: string;
  readonly weekLabel: string;
  readonly content: readonly string[];
}
export const savedCategoryLabels: Record<SavedCategoryId, string> = {
  "weekly-summary": copy.summaryLabel,
  "wellness-records": copy.recordsLabel,
};
export function initialSavedInformation(): readonly SavedInformationCategory[] {
  const content = {
    "weekly-summary": demo.weeklySummary,
    "wellness-records": demo.wellnessRecords,
  };
  return savedCategoryIds.filter((id) => content[id].length > 0).map((id) => ({
    id, label: savedCategoryLabels[id], weekLabel: demo.weekLabel,
    content: [...content[id]],
  }));
}
export function savedInformationReducer(
  records: readonly SavedInformationCategory[],
  action: { type: "delete"; ids: readonly SavedCategoryId[] },
): readonly SavedInformationCategory[] {
  return records.filter((record) => !action.ids.includes(record.id));
}
/** Unknown, repeated, empty, and array-valued query parameters fail closed. */
export function parseSavedCategories(value: unknown): readonly SavedCategoryId[] {
  if (typeof value !== "string") return [];
  const ids = value.split(",");
  if (!ids.length || new Set(ids).size !== ids.length ||
      ids.some((id) => !savedCategoryIds.includes(id as SavedCategoryId))) return [];
  return ids as SavedCategoryId[];
}
export function selectedSavedInformation(
  records: readonly SavedInformationCategory[], ids: readonly SavedCategoryId[],
): readonly SavedInformationCategory[] {
  if (!ids.length || ids.some((id) => !records.some((record) => record.id === id))) return [];
  return ids.map((id) => records.find((record) => record.id === id)!);
}
