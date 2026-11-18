# Munsif security and UC-10 integration assessment

Assessment date: November 17, 2026. This records the inspected baseline and open
requirements; it does not establish completion of the backend increment.

## Baseline and ownership

After fetching origin, `feat/munsif-security-integration` and `origin/main` both
pointed to `55550dd`. The existing branch already starts from the requested
baseline. Voice PR #6 (`faee40e`) and sharing PR #8 (`55550dd`) are merged ancestors;
the complete `origin/feature/zain-uc10-sharing` branch is included. No further
teammate branch merge is needed. The pre-existing untracked `.vs/` directory is
preserved and excluded from this work.

All eight security routes have implemented screens. Older placeholder wording in
team/security documents does not describe the current route implementations.

## Existing behavior and documented criteria

Screen numbers below are navigation IDs, not capstone use-case IDs. The repository
identifies UC-10 sharing and the voice UC-04/UC-13 increment, but does not establish
Munsif's selected backend use-case list or submission acceptance criteria.

| Screen or workflow | Inspected behavior | Existing documented/tested boundary |
| --- | --- | --- |
| 02 Create Account | Form validation and simulated completion | No account is created; live voice separately supports Cognito signup and confirmation. |
| 03 Sign In | Validated prototype navigation to Home | No authenticated identity is established by this screen. |
| 04 Account Recovery | Email validation and simulated confirmation | No recovery code is requested or applied. |
| 12 Trusted Contacts | Persistent local name/relationship records through the public recipients provider | Serialized writes, failed-save handling, and unreadable-data preservation; contacts confer no sharing or alert eligibility. See `RECIPIENTS.md`. |
| 14 Shared Information / UC-10 | Exact confirmed snapshots, session history and simulated revoke | Explicit confirmation, same-operation retry IDs, conflict detection, pending/failed/unknown states, late-result invalidation. See `SHARED-INFORMATION.md` and wellness `README.md`. |
| 15 Contact Alert Review | Fixture recipients, eligibility checks and exact message review | Explicit simulation, no notification delivery, no automatic contact promotion. See `CONTACT-ALERT.md`. |
| 16 Privacy and Consent | Draft/save choices; AI consent plus four persistent demo preferences | Missing sharing consent denies; unreadable consent fails closed; voice-off stops live voice through the current bridge. Sharing consent is not authenticated server authorization. See `PRIVACY-CONSENT.md`. |
| 17 Saved Information and Deletion | Independent fictional summary/records, selection, export preview and category deletion | Explicit session-only scope, stale selection rejection, no account deletion or unrelated-store removal. See `SAVED-INFORMATION.md`. |
| Voice | Real Cognito identity, authenticated DynamoDB voice consent, relay/provider processing | Existing voice verification is recorded in `VOICE-VERIFICATION.md`; broader security/sharing integration is absent. Native iOS remains unverified. |

## Integration boundaries

- `features/ai/live/identity.ts` supplies the replaceable Cognito identity port;
  `LiveVoiceProvider.tsx` currently owns its in-memory token, expiry and logout.
  A shared identity must feed voice and security without a second sign-in. Preserve
  immediate audio stop, handoff cancellation and rejection of stale results.
- `apps/voice-relay/src/access.ts` verifies Cognito signature, issuer, client,
  access-token purpose and expiry, and reads voice consent consistently from
  DynamoDB under `USER#<subject>`. Reuse this foundation and CloudFormation
  ownership; new processing requires its own applicable server-side consent.
- The root currently mounts `SharedInformationProvider` without a service prop,
  selecting the simulated adapter. The provisional contract has create/revoke
  only, accepts name/content without the reviewed destination, and permits only
  simulated success. It lacks authoritative status/history operations.
- Zain's preview already includes recipient ID, name, email and relationship;
  submission currently passes only name/content. A final contract must preserve
  the exact confirmed destination, enforce ownership/consent, and support status
  reconciliation. A live failure must never fall back to simulated success.
- PR #8 already corrected revocation timeout handling and cached/in-flight payload
  conflicts. Follow-up provider changes classify rejected calls as unknown and
  retain request-ID payload bindings after ambiguous failures. A real status
  lookup still depends on the final sharing model and backend contract.

## Storage and deletion assessment

| Data | Current location and scope | Integration requirement |
| --- | --- | --- |
| AI history, observations, memories, preferences and AI consent | `mindguard.synthetic.v1`; one device-local synthetic profile | Preserve existing contents. Do not silently assign legacy data to the next signed-in account or expose it as account-owned data. |
| Four privacy demo preferences | `mindguard.synthetic.privacy-preferences.v1`; device-local | Do not use this as server consent or automatically migrate its grants. |
| Trusted contacts | `mindguard.synthetic.recipients.v1`; device-local | Preserve records and malformed data; define account association before migrating. |
| Wellness recipients, selections and watch simulation | In-memory wellness provider | Keep separate from trusted contacts and isolate session state on real account changes. |
| Share snapshots | In-memory shared-information provider | Replace with authenticated account-scoped reads for live mode; discard late results from old sessions. |
| Screen 17 examples | Independent in-memory saved-information provider | Existing deletion only removes selected examples until reload. It is not account deletion. |
| Live credentials, audio and transcripts | In-memory identity/voice path | Preserve non-persistence; never enable live transcript saving. |

No indiscriminate AsyncStorage clearing, implicit legacy-data migration, or expanded
account deletion is authorized by the existing prototype descriptions.

## Requirements awaiting Munsif/team confirmation

1. Identify the selected security capstone use cases and required submission
   outcomes. In particular, confirm recovery, trusted-contact persistence, alerts,
   and account deletion scope rather than assigning backend services to all eight
   screens.
2. Define UC-10's actual sharing mechanism. For controlled in-app access, specify
   recipient identity and access journey without inventing a new account model.
   For file export, downloaded copies cannot be remotely revoked. Also specify
   whether consent withdrawal revokes existing grants or only prevents new ones.

Implementation of the dependent backend, live adapter and lifecycle rules follows
those decisions. Local Docker remains the development target; EKS stays deferred
to April 2027. No new delivery service, subscription or infrastructure ownership
change is implied by this assessment.

## Verification of the preparatory changes

- `npm run check`: fixture validation, TypeScript, lint, and 141 tests across
  21 suites passed. Four added cases cover rejected promises/synchronous errors
  for create and revoke, unknown outcome presentation, stable retry IDs, and
  conflicting payload rejection after an ambiguous create.
- `npm run test:voice`: 7 voice-domain and 11 relay tests passed on this host.
- `node scripts/verify-wellness.cjs`, using installed Chrome through
  `PLAYWRIGHT_CHROMIUM_EXECUTABLE`: passed the simulated UC-10 journey and
  90 screen/viewport/text-size combinations, with no page errors or missing
  app responses. The initial attempt lacked Playwright's bundled browser;
  using installed Chrome required no dependency or configuration-file change.
- `git diff --check`: passed.

These checks do not establish live UC-10 processing, recipient access, shared
authentication, or account-scoped deletion. No live-account or recipient-delivery
test was performed. Android was not tested for these changes; native iOS remains
unverified. Browser artifacts remain ignored under `artifacts/`.
