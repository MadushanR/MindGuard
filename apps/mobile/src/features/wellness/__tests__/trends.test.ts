import type { Observation } from "@mindguard/contracts";
import { rawFixtures } from "@mindguard/fixtures";
import { validateBundle } from "../../../../../../packages/fixtures/validate.cjs";
import { emotionCounts, visibleObservations, weekDays } from "../trends";

const consent = { chatObservations: true, voice: true, tone: true };
const now = new Date(2026, 9, 20, 12).getTime();
const observation = (extra: Partial<Observation> = {}): Observation => ({
  id: "obs", createdAt: now, source: "Chat", predictedLabel: "Tense",
  confidence: 0.6, status: "Estimated", dismissed: false, ...extra,
});
test("week boundaries use local calendar days and roll to the following Monday", () => {
  const boundaries = weekDays(new Date(2026, 10, 1, 12).getTime(), "This week");
  expect(new Date(boundaries[0]).getDay()).toBe(1);
  boundaries.forEach((stamp) => expect(new Date(stamp).getHours()).toBe(0));
  expect(new Date(boundaries[7]).getDate()).toBe(2);
  const monday = new Date(2026, 9, 26, 0, 1).getTime();
  expect(weekDays(monday, "Last week")[0]).toBe(weekDays(now, "This week")[0]);
});
test("period and consent filters exclude future, dismissed, and revoked-source observations", () => {
  const records = [observation(), observation({ id: "future", createdAt: now + 1 }), observation({ id: "dismissed", dismissed: true }), observation({ id: "voice", source: "Voice tone" })];
  expect(visibleObservations(records, consent, now, "This week", "All").map(o => o.id)).toEqual(["obs", "voice"]);
  expect(visibleObservations(records, { ...consent, voice: false }, now, "This week", "All").map(o => o.id)).toEqual(["obs"]);
  expect(visibleObservations(records, consent, now, "Last week", "All")).toEqual([]);
});
test("emotion counts use corrections and preserve the original prediction", () => {
  const corrected = observation({ correctedLabel: "Hopeful", status: "Corrected" });
  const counts = emotionCounts([corrected, observation({ predictedLabel: "Hopeful" })]);
  expect(counts.find(item => item.label === "Hopeful")?.count).toBe(2);
  expect(counts.find(item => item.label === "Tense")?.count).toBe(0);
  expect(corrected.predictedLabel).toBe("Tense");
});
test("wellness validation rejects incomplete weeks, out-of-range measurements and unsafe links", () => {
  const bundle = JSON.parse(JSON.stringify(rawFixtures));
  bundle["wellness/wearable"].steps.values.pop();
  bundle["wellness/wearable"].sleep.values[0] = 25;
  bundle["wellness/resources"].items[0].actions[0].url = "javascript:alert(1)";
  expect(validateBundle(bundle).some(message => message.includes("values"))).toBe(true);
  bundle["wellness/wearable"] = rawFixtures["wellness/wearable"];
  expect(validateBundle(bundle).some(message => message.includes("unsupported URL"))).toBe(true);
});
