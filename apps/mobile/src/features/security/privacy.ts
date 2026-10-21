import type { ConsentState } from "@mindguard/contracts";

// Only the four additional choices live here. AI owns voice, tone and chat consent.
export const PRIVACY_STORAGE_KEY = "mindguard.synthetic.privacy-preferences.v1";
export const demoPreferenceKeys = [
  "wellnessData", "saveSummaries", "sharing", "contactNotifications",
] as const;
export type DemoPreferenceKey = typeof demoPreferenceKeys[number];
export type DemoPrivacyPreferences = Record<DemoPreferenceKey, boolean>;
export type PrivacyDraft = ConsentState & DemoPrivacyPreferences;
export const defaultDemoPreferences: DemoPrivacyPreferences = {
  wellnessData: false, saveSummaries: false, sharing: false, contactNotifications: false,
};
export function parseDemoPreferences(raw: string | null): DemoPrivacyPreferences {
  if (raw === null) return { ...defaultDemoPreferences };
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object" || !("version" in value) || value.version !== 1 ||
      !("preferences" in value) || !value.preferences || typeof value.preferences !== "object") {
    throw new Error("Invalid privacy preferences");
  }
  const preferences = value.preferences as Record<string, unknown>;
  if (demoPreferenceKeys.some((key) => typeof preferences[key] !== "boolean")) {
    throw new Error("Invalid privacy preference values");
  }
  return Object.fromEntries(demoPreferenceKeys.map((key) => [key, preferences[key]])) as DemoPrivacyPreferences;
}
export function serializeDemoPreferences(draft: PrivacyDraft): string {
  return JSON.stringify({
    version: 1,
    preferences: Object.fromEntries(demoPreferenceKeys.map((key) => [key, draft[key]])),
  });
}
export function changePrivacyDraft(
  draft: PrivacyDraft, key: keyof PrivacyDraft, value: boolean,
): PrivacyDraft {
  if (key === "tone" && value && !draft.voice) return draft;
  const next = { ...draft, [key]: value };
  if (!next.voice) next.tone = false;
  return next;
}
