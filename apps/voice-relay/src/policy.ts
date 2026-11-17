import { readFileSync } from "node:fs";
import { ConversationSafetyPolicy, VoiceError, type VoicePolicyRules } from "@mindguard/voice-core";

/** Approval is recorded in docs/VOICE-SAFETY-REVIEW.md; test/draft policies cannot enable live processing. */
export function loadApprovedPolicy(path: string): ConversationSafetyPolicy {
  const rules = JSON.parse(readFileSync(path, "utf8")) as VoicePolicyRules;
  if (rules?.version !== "voice-capstone-v1-2026-11-15")
    throw new VoiceError("POLICY_NOT_APPROVED");
  return new ConversationSafetyPolicy(rules);
}
