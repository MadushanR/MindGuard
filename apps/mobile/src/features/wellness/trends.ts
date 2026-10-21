import type { ConsentState, Observation } from "@mindguard/contracts";
import { effectiveEmotion } from "../ai";

export const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const emotions = ["Calm", "Tense", "Low", "Hopeful"] as const;
export type Period = "This week" | "Last week";

// Calendar arithmetic keeps day/week boundaries correct across daylight-saving changes.
export function weekDays(clock: number, period: Period) {
  const monday = new Date(clock);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(
    monday.getDate() - ((monday.getDay() + 6) % 7) - (period === "Last week" ? 7 : 0),
  );
  return Array.from({ length: 8 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    return day.getTime();
  });
}
export function visibleObservations(
  observations: Observation[],
  consent: ConsentState,
  clock: number,
  period: Period,
  source: string,
) {
  const boundaries = weekDays(clock, period);
  return observations.filter(
    (o) => !o.dismissed &&
      o.createdAt >= boundaries[0] && o.createdAt < boundaries[7] &&
      o.createdAt <= clock &&
      (o.source === "Chat" ? consent.chatObservations : consent.tone && consent.voice) &&
      (source === "All" || o.source === source),
  );
}
export function emotionCounts(observations: Observation[]) {
  return emotions.map((label) => ({
    label,
    count: observations.filter((o) => effectiveEmotion(o) === label).length,
  }));
}
