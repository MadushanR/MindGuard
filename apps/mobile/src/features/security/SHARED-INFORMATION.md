# Shared Information (Screen 14)

> The configured app now uses the authenticated live adapter and controlled
> account-based in-app access, including recipient reads, persistent history,
> status reconciliation and revocation. See `docs/SECURITY-INCREMENT.md` at the
> repository root for the final contract. The descriptions below document the
> preserved standalone simulation adapter, not the configured app's live mode.

`SharedInformationProvider` is mounted at the app root. Its public
`useSharedInformation` hook exports `records`, `recordShare`, `submitShare`,
`revokeShare`, `clearShareSession`, and the demo controls `simulated`,
`simulateFailure` and `setSimulateFailure`. The immutable snapshot model contains an
ID, recipient name, confirmation time, the exact confirmed content strings, the
originating `requestId` when one was used, and an optional `revocation` state
(`pending`, `failed` or `unknown`). It excludes recipient email, raw conversations/audio,
source records, and permissions. No AsyncStorage, account identity, backend, or real
sharing/revocation service is connected.

## Sharing service boundary (UC-10)

`sharingService.ts` defines the client `SharingService` port (`createShare`,
`revokeShare`) — the diagrams' proposed FA2 `ISharingApplication`. The only
implementation is `createSimulatedSharingService()`: session-only, owner-agnostic,
labelled `executionMode: "simulated"`, and it sends nothing. It is idempotent per
`requestId` (a changed payload under the same ID returns `CONFLICT`) and
`setUnavailable(true)` makes it report `UNAVAILABLE` for demos/tests. The provider
accepts an optional `service` prop so a live FA2 adapter can replace it without
changing screens; a live adapter must enforce authenticated identity, record
ownership and sharing consent on the server. No such endpoint exists yet.

`submitShare({recipientName, content, requestId})` records the snapshot only after
the service completes. Results are `complete`, `failed`, `unknown` (no answer within
`timeoutMs`, default 15 s, or a rejected service call with no authoritative result)
or `stale` (the share session was cleared while waiting).
Retrying with the same `requestId` and an identical recipient/content payload cannot
create a duplicate: an existing record is returned, an in-flight request is reused,
and a late completion is recorded once. Reusing a `requestId` with a different
payload — whether already recorded or still in flight — returns `CONFLICT` and
records nothing.
The request ID remains bound to its original payload after a rejected service call;
an unchanged retry reaches the service using the same ID, while changed content or
recipient returns `CONFLICT`. Only an explicit service failure is a definite failure.

`revokeShare(id)` marks the record `pending`, calls the service, and removes the
record only after the service confirms. A failure sets `failed` (access unchanged).
No answer within the wait limit or a rejected service call sets `unknown` (access may or may not have ended) —
it is never shown as failed or revoked. Both keep the record; retry reuses the same
revocation request ID; a late confirmation still removes the record; a repeat call
while pending is ignored. `recordShare` remains for existing callers/tests and records a
local snapshot directly.

`readSharingConsent()` (`sharingConsent.ts`) is a public, read-only view of the
existing Screen 16 Sharing demo preference. Missing storage reads as not granted;
unreadable or malformed storage rejects so callers fail closed. It is a local device
choice, not server consent.

## Screens

Screen 13 checks Sharing consent when preparing a recipient preview and again at
confirmation, then calls `submitShare`. Opening/cancelling preview, denied or
unreadable consent, invalid or unavailable content, adding a recipient, and
export-only confirmation do not create history. See
`../wellness/README.md`.

Screen 14 reviews snapshots, even after selections or recipients change. **Revoke
access** opens confirmation explaining that copies already downloaded, copied or
forwarded cannot be recalled; Cancel preserves the record. Confirm shows a pending
state until the simulated service confirms, then removes only that record and
returns keyboard focus to **Share information**. An explicit failed result keeps
the record and labels it "access unchanged"; a timeout or connection error keeps it
with an unknown outcome. Both offer **Try revoking again**. This
models demo access revocation only. Source wellness data, saved AI information, and
persistent trusted contacts are unaffected.

History survives navigation during the current app runtime. It clears on reload
or after confirmation of Settings' wellness reset, leave-demo action, or Explore's
demo reset; responses that arrive after a clear are discarded. Loading an AI
scenario does not silently clear share history. Nothing new is persisted and
existing storage keys are untouched. No recipient is silently converted into a
trusted contact.

`packages/fixtures/security/shared-information.json` holds editable copy.
`shared-information-records.json` holds synthetic examples for tests/previews only;
they are never seeded automatically. Security tests validate and use those files;
the existing fixture CLI continues to validate its AI/wellness bundles.
