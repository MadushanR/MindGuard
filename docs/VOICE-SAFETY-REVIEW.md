# Approved capstone voice safety policy

Status: **Approved by Madushan in this chat on November 15, 2026** with the reply “I approve” to the request to approve these rules and disable live transcript saving. Policy version: `voice-capstone-v1-2026-11-15`. This is user approval for the capstone controls, not clinical validation or production safety certification. Scope remains UC-04/UC-13; EKS provisioning is deferred.

## Approval scope

The exact phrase lists are now in `apps/voice-relay/policy.approved.json`. The approval covers those lists, transcript checks, resource routing, output blocking and the live transcript-retention behavior described below. Approval of this document does not mean its unimplemented requirements have passed verification. Future rule changes require another review and a new approved version.

## Transcript validity and authorization

1. Require a provider-completed transcript belonging to the active session and current turn/generation. Speech detection alone never authorizes a reply.
2. Reject incomplete, interrupted, cancelled, stale, missing, whitespace-only, or over-8,000-character transcripts. An 8,000-character limit already exists in the implementation; it is a proposed acceptance limit until approved here.
3. Do not invent a confidence score, language score, or evidence that the transcript accurately represents speech. Correlation and completion do not prove transcription accuracy. If transcription fails, present a retry/text option without generation.
4. Recheck authenticated access and server consent before generation and delivery. The client rechecks turn currency before playback. Missing policy, configuration, or authorization blocks processing.

## Deterministic input rules

Use the exact phrases in `fixedResourcePhrases`. The existing matcher normalizes Unicode with NFKC, lowercases in English, collapses whitespace, and then performs substring matching. It does not remove punctuation or expand contractions. For example, `I want to end my life` matches; `I don't want to end my life` does not match that phrase. Other quoted, fictional or negated sentences can still contain matching substrings.

A match routes to the existing Resources screen and stops the voice session without requesting a generated response. Proposed visible copy: “Voice has paused. You can open Resources or switch to text.” No generated or unreviewed spoken resource message is played. No contacts, notifications, wearable signals, tone analysis, or emergency dispatch are triggered.

These are a small, English phrase-based capstone control, not a complete crisis detector. Indirect language, spelling variants, punctuation, contractions and other languages can evade it; quotation and negation can also cause false positives. No match means only that these configured phrases were absent, not that a situation is safe. Broader language coverage requires a separate review rather than an implicit guarantee.

## Deterministic output rules

Buffer the complete candidate audio on the relay. Require its matching completed output transcript; reject missing or whitespace-only output or output longer than 8,000 characters. Apply the exact `blockedOutputPhrases` with the same normalization and substring matching before release. An output match discards the audio; proposed visible copy: “Zen could not provide that reply. You can try again or switch to text.” Never speak the blocked candidate.

The proposed phrases cover examples of encouragement of harm, diagnostic assertions, medication changes, and claims of contacting others. They cannot exclude every paraphrase or unsafe output. Existing provider instructions also prohibit diagnosis, prescribing, emergency monitoring claims, and claims of contacting anyone, but those instructions are not deterministic checks or a safety guarantee.

Cancellation, interruption, expiry, logout, consent revocation and navigation must invalidate pending playback immediately. Mute stops capture and transmission; unmute starts fresh capture after authorization. Context must exclude replies that were not completely played. Partial-playback context handling remains a documented limitation to verify rather than a claim of exact synchronization.

## Approved privacy behavior

For the first live increment, do not save raw audio or full voice transcripts to application storage or logs, including when the earlier simulation's transcript-saving preference is on. Make that preference visibly unavailable for live voice with an explanation; leave the separate text-chat behavior unchanged. Temporary voice conversations also remain unsaved. Keep only bounded in-memory context for the active voice session, and clear it on stop. This resolves the earlier preference conflict for live voice; it does not delete existing simulation records.

OpenAI still receives audio and text for processing. Application non-persistence is not a promise of zero provider retention. The consent disclosure must distinguish those facts.

## Required evidence after approval and implementation

Verify matching and nonmatching inputs, normalization, completion/correlation, blocked outputs, cancellation during generation and playback, consent revocation, mute/unmute, stop/navigation/background cleanup, and absence of conversation content in application logs. Use synthetic fixtures for automated checks. Run live device checks separately; tests with a fake provider do not establish live voice or native iOS support.

Local Compose now explicitly enables `VOICE_POLICY_APPROVED=true` and mounts the approved file. The relay rejects draft/test policy versions even if the approval flag is set. The `.env.example` default remains false for other deployments, where the approved file and approval flag must both be deliberately configured. `policy.example.json` remains test-only and unapproved.
