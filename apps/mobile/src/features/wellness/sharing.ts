import { metricInfo, metrics, type Metric, type Recipient } from "./state";

/** UC-10 preview snapshot: exactly what the user reviews and what a confirmation may submit. */
export type ShareDestination =
  | { readonly kind: "export" }
  | { readonly kind: "recipient"; readonly recipient: Recipient };
export interface SharePreview {
  /** Fingerprint of destination and content; any difference requires a fresh review. */
  readonly key: string;
  readonly destination: ShareDestination;
  readonly metrics: readonly Metric[];
  readonly content: readonly string[];
}

export const sharePeriod = "Synthetic demo week · Monday–Sunday";

export function metricLine(metric: Metric) {
  const { label, unit, values } = metricInfo[metric];
  const average = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(metric === "steps" ? 0 : 1);
  return `${label}: ${values.join(", ")} ${unit} (Mon–Sun); daily average ${average} ${unit}.`;
}

export function destinationText(destination: ShareDestination) {
  return destination.kind === "export"
    ? "Demo export preview (no file download)"
    : `${destination.recipient.name} · ${destination.recipient.email} · ${destination.recipient.relationship}`;
}

/**
 * Builds the preview from currently permitted, synced records only. Returns null when there
 * is no eligible content or the chosen recipient no longer exists. Unavailable metrics are
 * omitted entirely, never shown as zero, and no fixture value replaces a failed source.
 */
export function buildSharePreview(input: {
  destinationId: string;
  recipients: readonly Recipient[];
  selected: readonly Metric[];
  available(metric: Metric): boolean;
  device: string;
}): SharePreview | null {
  // Keep a stable metric order so equivalent selections produce the same preview.
  const eligible = metrics.filter((m) => input.selected.includes(m) && input.available(m));
  if (!eligible.length) return null;
  let destination: ShareDestination;
  if (input.destinationId === "export") destination = { kind: "export" };
  else {
    const recipient = input.recipients.find((r) => r.id === input.destinationId);
    if (!recipient) return null;
    destination = { kind: "recipient", recipient: { ...recipient } };
  }
  const content = [
    `Source: synthetic demo records from ${input.device.trim() || "demo smartwatch"} · ${sharePeriod} · not live measurements.`,
    ...eligible.map(metricLine),
  ];
  const target = destination.kind === "export"
    ? ["export"]
    : ["recipient", destination.recipient.id, destination.recipient.name, destination.recipient.email, destination.recipient.relationship];
  return { key: JSON.stringify([target, content]), destination, metrics: eligible, content };
}
