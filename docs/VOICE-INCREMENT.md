# FA3 voice increment — UC-04 and UC-13

> Shared-account integration now reuses the Cognito adapter through
> `SecuritySessionProvider`; a second voice sign-in is not needed after general
> sign-in. Identity/consent remains independent of provider readiness. Voice
> processing still requires the reviewed policy and configured OpenAI key.
> See `SECURITY-INCREMENT.md`; the voice-only account description below records
> the original FA3 baseline.

Current work: November 16, 2026. The earlier implementation checkpoint is preserved in `archive/VOICE-CHECKPOINT-2026-11-15.md`.

## Scope and decisions

The existing Expo/React Native/Web app now has a live voice screen using the existing visual components. Client microphone audio passes through the NestJS relay to OpenAI Realtime. Provider credentials stay on the server. Tone inference, wearable processing, alerts and broader account/data-management changes remain outside this increment.

The user approved policy `voice-capstone-v1-2026-11-15` and disabling live transcript saving on November 15. The exact phrase lists, approval and limitations are in `VOICE-SAFETY-REVIEW.md`. These are reviewed capstone controls, not clinical validation or production safety certification.

The user subsequently selected local Docker first, with migration to a new EKS cluster in April 2027. Keep `mindguard-voice-foundation` under CloudFormation; future Terraform must reference it. No EKS resources have been provisioned by this work. AWS/OpenAI each have a flexible monthly budget of 100; currency and the exact April migration/teardown dates must be settled before cloud cost approval. No purchased domain is required for local development. Submission remains November 17, 2026.

The latest device correction is **iPhone only**, with Android Studio emulator testing requested. There is no Mac or paid Apple Developer membership. Native iOS source/configuration is included, but native iOS installation/build verification is unavailable under those constraints. Browser results do not establish native iOS correctness.

## Implemented flow

1. Sign in through the replaceable Cognito adapter on the voice screen. Tokens and passwords stay out of application storage. Minimal email signup/confirmation is available; Munsif's broader account screens remain separate.
2. Read and update authenticated voice consent on the relay/DynamoDB. Local microphone cleanup happens immediately on revocation; it never waits for the network.
3. Start actual capture through a browser audio worklet or the native raw-buffer adapter. Capture produces bounded mono PCM16 frames at 24 kHz without file recording.
4. Provider speech detection starts a correlated turn; automatic response creation stays disabled. Only a completed transcript for the current session/turn can authorize explicit generation.
5. The relay buffers candidate audio. Audio completion, final transcript completion, response ID, output item and content part must match before output checks and final access/currency checks release a candidate.
6. The client checks turn currency again before playback. Completed playback is acknowledged; only fully heard turns enter the bounded canonical context.
7. Capture remains active through playback for interruption. Turn-targeted cancellation cannot erase or cancel a newer utterance. Mute stops capture/transmission; unmute starts fresh capture after server acknowledgement.
8. Connection loss stops local audio first and allows at most two automatic recovery attempts. Recovery creates fresh context and tells the user earlier details may need repeating.
9. Switching to text stops local audio immediately and transfers at most three completed exchanges to a temporary server/client memory context. Checked replies continue through the existing provider boundary. Handoff text/audio is not written to saved history.
10. Stop, route changes, backgrounding, logout and consent revocation dispose capture/playback and invalidate obsolete work. Native audio interruptions and route loss also stop voice.

## Responsibility mapping

| Intended responsibility | Existing implementation used |
| --- | --- |
| IConversationApplication / ConversationApplicationService | `processVoiceTurn` in `packages/voice-core`, orchestrated by relay routes; `LiveVoiceProvider` and `VoiceSessionController` coordinate client lifecycle |
| IConversationProvider / OpenAIConversationAdapter | `ConversationProvider` port and `apps/voice-relay/src/realtime.ts` |
| ConversationSession / ConversationTurn | Existing lifecycle and turn contracts in `packages/voice-core/src/index.ts` |
| ConversationSafetyPolicy | Same domain policy, configured from `policy.approved.json` |
| IProcessingAccess | `ProcessingAccess` contract and replaceable Cognito/DynamoDB access adapter |

No second product app, provider bypass, or alternative backend framework was introduced. Native capture uses `react-native-audio-api` 1.0, which the current Expo audio documentation recommends for advanced audio and whose compatibility table includes React Native 0.88. Android native configuration is generated from Expo plugins.

## Privacy and operational bounds

- No application persistence or logging of raw microphone audio/full live transcripts. The existing simulation preference cannot enable live saving. Text-chat simulation behavior is preserved outside the voice handoff.
- Voice context contains at most six messages, populated only by completed playback; interrupted/unplayed replies are excluded. Partial spoken replies are not reconstructed word by word.
- The relay registry/context is process-local. One replica is the initial deployment model. Restart recovery starts fresh context; this is not high availability or restart continuity.
- Existing configurable proposals remain: 10 sessions/user/day, 10-minute sessions, 90-second inactivity, 20 concurrent sessions/process, 30-second provider response bound, 45-second transcript wait, 1,440,000 decoded output bytes. These are not measured latency/scale acceptance claims.
- Local Docker uses a read-only temporary credential file refreshed from the existing AWS login by a local helper. The runtime folder is ignored and excluded from images. It contains secrets and must never be shared. `Down` stops refreshing and removes the credential file. EKS should use workload IAM rather than this local helper.
- The application never claims zero provider retention. The consent disclosure distinguishes application non-persistence from OpenAI processing terms.

## Local operation and evidence

See `VOICE-LOCAL.md` for startup, credentials, emulator networking and verification commands. `VOICE-VERIFICATION.md` records the evidence and remaining platform limits. Test media, generated test-account credentials and reports live in ignored `artifacts/`; only synthetic test conversation content is used in captured evidence.

The confirmed browser story uses the real Cognito pool, DynamoDB table, relay and OpenAI services with a generated microphone fixture. It has verified two continuous turns, checked audio playback, automatic return to listening, interruption, mute/unmute, text handoff, storage non-persistence and consent/logout cleanup. A separate live browser test verifies stop, navigation, reload, recovery and the two-attempt limit. The Android release test app separately passed native capture and mute/background/revocation/logout cleanup on the emulator with host audio disabled. Native iOS remains unverified, as the owner chose to retain the no-subscription setup.
