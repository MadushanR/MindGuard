# Voice increment: implementation checkpoint

> November 15, 2026 update: the user has changed delivery order to local Docker first, with EKS migration deferred to April 2027. Reuse the existing AWS Cognito/DynamoDB foundation. Madushan approved policy `voice-capstone-v1-2026-11-15` and disabling live transcript saving in this chat. See `VOICE-LOCAL.md` for current decisions and verification limits, and `VOICE-SAFETY-REVIEW.md` for the approved controls and limitations. Earlier references below to unresolved rules, AWS status and deployment order are historical checkpoint claims. The handoff reports foundation creation succeeded; this environment has not reverified it.

Scope: UC-04 continuous voice and mandatory UC-13 safety processing. This document records an **in-progress implementation**, not a completed or deployed use case.

## Implemented foundation

- Pure conversation session/turn lifecycle, owner checks, expiry, mute, cancellation and stale-turn rejection in `packages/voice-core`.
- Configurable deterministic input/resource and output decisions. Only synthetic test rules are included; the real reviewed rules still need to be supplied and approved.
- Application processing repeats access checks after candidate generation and before any playable candidate is returned.
- NestJS relay with Cognito access-token verification, strongly consistent DynamoDB voice consent and per-user daily session reservations.
- Authenticated session creation and single-use socket binding; provider credentials never go to the client or URL.
- OpenAI Realtime infrastructure adapter: 24 kHz mono PCM input, semantic turn detection, automatic responses disabled, transcript correlation, explicit response creation from canonical checked text and bounded accepted context.
- Candidate output audio and its matching text remain buffered until response completion and application checks. No candidate-audio deltas are forwarded to the client.
- Session expiry, input/frame/output bounds, periodic consent rechecks and shutdown hooks.
- Health/readiness distinction: configuration or policy missing -> readiness 503, protected processing blocked.
- Client session controller with an injected audio port: authenticated socket startup, permission gating, turn-currency checks, immediate stopping, mute/unmute acknowledgement and bounded recovery. The actual audio adapter and screen wiring remain pending.

## Not yet complete

- Real audio adapters, live client controller and consent/authentication UI integration.
- Text handoff with bounded context, complete reconnect behaviour and device/audio-focus verification.
- AWS provisioning, HTTPS endpoint, image build/push and live deployment verification.
- OpenAI model selection and a real microphone/provider integration test. Read-only API key validation succeeded (HTTP 200, model listing); this does not verify billing, Realtime access or live audio.
- Android and iPhone live tests. Existing simulation tests are not evidence of live audio.
- Zain/Munsif shared-contract agreement and reviewed deterministic safety/validity rules.

## Required external decisions

1. **Region confirmed: Canada Central (`ca-central-1`).** Target account verified as 950801850836, IAM user mindguard-deployer, named profile mindguard; no resources have been created for this increment.
2. **User approved minimal real Cognito/server-side voice consent.** Keep these integrations replaceable for Munsif's later implementation.
3. User has an iPhone and no Mac; paid Apple Developer membership is not authorized. Evaluate the compatible free Expo Go path, and distinguish deployed Safari/web testing from native iOS verification. Do not purchase a membership or claim native verification from a browser test.
4. Real API project/key and available Realtime/transcription model IDs.
5. Policy review and exact transcript-validity rules. Phrase matching is a limited deterministic mechanism, not a claim of clinical assessment or transcription accuracy.

## Development commands

Use the root lockfile; do not create a second product app. With dependencies installed:

```sh
npm run build:voice
npm run test:voice
npm run check
```

Copy `apps/voice-relay/.env.example` to `apps/voice-relay/.env` and fill it locally. Never commit keys. `VOICE_POLICY_APPROVED` remains false until real rules have been reviewed; `policy.example.json` is test-only. No API calls or paid AWS deployments are needed to run the automated tests.

Run the relay from the repository root using `npm start -w @mindguard/voice-relay`. Health is `/api/voice/health`; readiness is `/api/voice/ready`. Missing configuration will deliberately prevent live use.

Initial configurable bounds (proposals, not measured acceptance targets): 10 sessions/day/user, 10-minute session, 90-second inactivity, 20 concurrent sessions/process, 30-second provider response timeout, 45-second transcript wait and 1,440,000 decoded output bytes. Calibrate against approved requirements and actual device/provider measurements.

## Current HTTP/socket contract

- `GET /api/voice/consent`: authenticated voice consent.
- `PUT /api/voice/consent`: bearer token and `{allowed, disclosure: "voice-processing-v1"}`. Revocation ends the user's local relay sessions.
- `POST /api/voice/sessions`: authenticated, consented, allowance-checked session creation.
- `DELETE /api/voice/sessions/:id`: owner-only cleanup; local stopping must not wait for it.
- `/api/voice/socket`: first message `{type:"authenticate",token,sessionId}`. Tokens are not query-string values.
- Client events: `audio` (base64 PCM16, mono, 24 kHz), `interrupt`, `mute`, `playback.completed`, `stop`.
- Server events: `session.ready`, `turn.started`, `state`, `reply.approved`, `route`, `error`.
- Every approved reply has server session/turn/generation correlation. The client must reject old generations and stop local playback immediately on interruption.
- Only successfully completed playback enters bounded server context. Cancelled or unplayed candidate text is excluded from later generation.

## AWS preparation

Target remains the approved **new EKS cluster in Canada Central (`ca-central-1`)**, with server-side credentials and HTTPS/WSS, alongside the team's primary REST backend. Target account and TLS configuration still need validation. No cloud resources have been created.

Build image, after the normal root install/build has been verified:

```sh
docker build -f apps/voice-relay/Dockerfile -t mindguard-voice-relay .
```

This Dockerfile is prepared but has not yet been built in this checkpoint. EKS deployment must include a real Cognito pool/client, DynamoDB consent/usage table with `pk`/`sk` and numeric TTL `expiresAt`, workload IAM for that table, a server-side OpenAI secret, reviewed policy configuration and valid HTTPS ingress.

The current session registry is process-local. Use one relay replica for the initial verified deployment; multi-replica routing/state needs a deliberate design before increasing it. Do not claim high availability or restart continuity from this checkpoint.

## Verification recorded in this checkpoint

- Existing repository baseline: fixture validation, type checking, lint and **36 existing tests passed** before changes.
- New domain suite: **6 tests passed** for lifecycle, invalid transcripts, deterministic resource routing, cancellation, revocation and unsafe output.
- New relay suite: **5 tests passed** for controlled VAD, buffered candidate completion, abort, missing output transcript and unconfigured HTTP access.
- Client controller suite: permission denial, authenticated startup, stale output, late-event cleanup, acknowledged unmute, stopped recovery and interrupted playback are covered independently of native audio. Actual microphone/playback/device integration is still pending.
- OpenAI read-only model listing returned HTTP 200. This does not verify credits, Realtime session access or live audio. AWS STS returned `InvalidClientTokenId`; local AWS credentials must be refreshed before deployment.
- New code compiled using the installed TypeScript compiler and an isolated backend dependency installation.
- Windows sandbox denied npm workspace symlink creation. An isolated backend install with `--workspaces=false --install-links --package-lock=false` allowed compilation/tests without modifying the original frontend dependency tree. This is a host workaround, not a change to the project's architecture.
- No live provider, new native audio, Docker or AWS deployment test has passed yet.

## Delivery order toward November 17

1. Finalize external configuration and shared access/policy decisions.
2. Prove real microphone input and interruptible playback on the target platforms.
3. Integrate live UI/controller and bounded text handoff; test race/failure paths.
4. Build/publish the relay image and deploy the reviewed AWS stack with HTTPS.
5. Exercise the actual deployed endpoint from Android and iPhone, record results, update diagrams/traceability and prepare the source archive.

The deadline does not change the meaning of verified: report any missing prerequisite, unexecuted device test or undeployed component explicitly.

## Reviewed deployment preparation

infra/voice-foundation.template.json prepares Cognito, the consent/usage DynamoDB table, ECR and an initially empty OpenAI-secret slot. infra/voice-foundation-deployer-policy.json scopes the first deployment stage to account 950801850836 in ca-central-1. The JSON files parse successfully; AWS service-side template/policy validation and deployment are pending permissions. This stage creates no EKS cluster or IAM roles. The identity pool, table, repository and secret have Retain policies: deleting the stack does not remove their data/resources.
