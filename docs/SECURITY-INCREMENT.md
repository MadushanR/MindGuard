# Shared accounts, security data and UC-10

Munsif's security/backend increment builds on main `55550dd`, including Madushan's
merged voice PR #6 and Zain's merged sharing PR #8. The existing eight security
screens remain implemented screens, not placeholders. Screen numbers are not
capstone use-case IDs. The earlier inspection is in `SECURITY-INCREMENT-ASSESSMENT.md`.

## Confirmed scope

Munsif requested AWS-backed account creation/sign-in/recovery, contacts, privacy,
saved-category management, sharing and alerts. UC-10 grants **controlled in-app
access to a signed-in recipient account**. The reviewed recipient email must be
verified in Cognito and registered by signing in to this app. The server resolves
it to a stable Cognito subject; session-only recipient IDs never authorize access.
No public links, email delivery, downloaded files or new recipient account system
are introduced. Export remains an explicitly simulated local preview.

Withdrawing Sharing consent blocks **new** shares. It does not revoke existing
ones. Owners can revoke existing shares without granting new processing consent.
Recipients cannot revoke another account's outgoing share. Content already seen
or copied cannot be recalled.

Contact alerts use an in-app inbox. Both accounts need Contact notifications
consent, and the recipient must explicitly allow the sender's verified email.
Trusted-contact and sharing-recipient lists confer no alert eligibility. There is
no email/SMS/push service, automatic alert, background polling, or emergency
monitoring. These decisions were confirmed in the implementation conversation.

**Account deletion is deliberately disabled**, per Munsif's subsequent decision.
The AWS login lacks table `Query` and `DeleteItem` permissions. The server rejects
deletion before modifying any data, and Settings explains the limitation. This
does not prevent deleting selected saved categories. The future deletion path is
implemented and domain-tested, but is not live-verified or enabled.

## Identity, consent and voice lifecycle

`SecuritySessionProvider` wraps the root app. Its single volatile application
store survives navigation-layout remounts, with no disk/sessionStorage token
cache. Standalone/test composition gets an isolated store. It reuses `CognitoVoiceIdentity` and
the existing pool/client, with Cognito signup, email confirmation, ForgotPassword
and ConfirmForgotPassword. Credentials and tokens stay in memory. Reload requires
sign-in. No second sign-in is needed for voice or sharing.

`LiveVoiceProvider` consumes the shared session when mounted in the app. Its
standalone injected identity port remains available for existing tests/adapters.
Logout, expiry and account switching synchronously notify audio/handoff cleanup
before waiting for remote work. Obsolete HTTP and sharing responses cannot update
a new session. Account changes clear shared snapshots and reset wellness session
state; AI cache reads/writes remain bound to their original account namespace.
`AppShell` keeps the Expo navigator mounted behind the cache-loading notice, so
switching a storage namespace cannot tear down navigation or the shared session.
Voice-consent
withdrawal stops local capture/playback before the network request. Local AI state
must finish loading before server voice-consent synchronization, preventing an
initial local default from withdrawing a real grant accidentally.

The relay verifies access-token signature, issuer, purpose, client and expiry and
calls Cognito GetUser to reject revoked/deleted sessions. Recipient email comes
from verified Cognito attributes, never a client-supplied owner claim. Voice's
existing processing checks and approved policy remain in place. Identity and
consent APIs remain authenticated and usable without an OpenAI key; voice session
creation and sockets still fail closed when provider/policy configuration is absent.

## Client composition and contract

`apps/mobile/src/app/_layout.tsx` mounts the shared session, account-scoped AI
provider, existing live voice/wellness providers, and the security providers.
`SharedInformationProvider` selects `createLiveSharingService` in that composition.
The simulated service is isolated to standalone prototype/test composition; the
configured app never falls back to simulated success on a failed live request.
The public sharing port now distinguishes live/simulated execution, carries the
reviewed destination, and provides a live status/history boundary.

Zain's `useShareWorkflow` retains source-availability checks, exact selection and
destination snapshots, preview invalidation, consent rechecks and duplicate-click
guards. It reads authenticated sharing consent, passes the entire confirmed
destination, and consumes the public sharing provider. Existing styling,
navigation, recipient validation and unrelated wellness behavior are preserved.

Shared types are exported from `packages/contracts/src/index.ts`; declarations
live in `security.d.ts`. Live share input is:

```ts
{
  requestId: string; // retained for an unchanged retry
  destination: { id: string; name: string; email: string; relationship: string };
  content: readonly string[];
}
```

The server accepts only a labelled synthetic-source line and one to three unique
wellness metrics (Steps, Sleep, Resting heart rate), each with seven nonnegative
bounded values, matching units and a validated displayed average. Arbitrary
conversations, raw audio and transcripts are not a share payload. The reviewed
destination remains in the immutable snapshot. The server additionally records
`recipientAccountId`, its resolved Cognito subject, and `executionMode: "live"`.

All routes below use `/api/security` with an authenticated bearer access token.
An owner is derived exclusively from the token. Responses have `Cache-Control:
no-store`. Nginx proxies `/api/*` to the existing relay.

| Route | Contract |
| --- | --- |
| `POST /session` | Register verified account email/subject after Cognito sign-in. |
| `GET /snapshot` | Account-owned preferences, contacts, saved categories, outgoing history, currently authorized incoming shares, alert inbox/permissions and deletion availability. |
| `PUT /consent` | Exactly four booleans: wellnessData, saveSummaries, sharing, contactNotifications. |
| `POST /contacts` | `{id,name,relationship}`; no sharing/alert eligibility. |
| `PUT /saved` | Explicit selected fictional categories; wellnessData and saveSummaries required. No automatic seeding or transcript saving. |
| `DELETE /saved` | `{categories: [categoryId,...]}`; deletes only the named owned categories. |
| `POST /shares` | Exact payload above; ownership, active accounts, wellnessData/sharing consent and destination revalidated in the transaction. |
| `GET /shares/status/:requestId` | `{share: AccountShare \| null}`, scoped to the owner; used to reconcile unknown outcomes. |
| `DELETE /shares/:shareId` | Owner-only, idempotently marks revoked; does not require sharing consent. |
| `PUT /alerts/permission` | `{email,allowed}`; recipient's explicit sender opt-in. |
| `POST /alerts` | `{requestId,email,message}`; exact reviewed in-app message, max 1,000 characters. Both consents and recipient opt-in rechecked transactionally. |
| `POST /logout` | Stops owner's active relay sessions and requests Cognito global sign-out; local cleanup does not wait for it. |
| `DELETE /account` | Disabled by default and in the verified environment; no mutation when disabled. |

Create is durably idempotent by **owner + requestId**. Repeating an identical
completed request returns the original record, including its revoked state; it
never regrants access. A changed content/destination under the same ID is a 409
conflict. Client bindings also cover cached/in-flight and ambiguous attempts.
Revoke is idempotent by owner + immutable share ID. Alert retry IDs are bound to
the same sender/message in the recipient inbox.

Transport rejection, timeout, or an ambiguous server error is an **unknown**
outcome. The client reconciles an unknown create through status lookup before
resubmitting the unchanged ID. A null status alone does not prove an earlier
in-flight operation cannot complete. The version-checked transaction prevents
duplicates. Revocation stays pending/unknown until confirmed or reconciled and
never claims that access is unchanged after a lost connection. A confirmed write
remains confirmed even if a subsequent history refresh fails; the history screen
exposes a retry. An explicit rejected operation stays a failure. No live request
can become mock success.

## Persistence and limits

The existing on-demand DynamoDB table stores `SECURITY_V1` under `USER#<subject>`.
Security aggregates use optimistic revisions and transactional compare-and-swap,
including sender and recipient when granting access or sending an alert. A
recipient inbox stores references and resolves current owner records on reads,
checking the stable recipient subject and revocation. Email lookup records use
SHA-256 keys with a verified subject binding; they are not a public directory API.
There is no table scan, new index, service, subscription or polling loop.

Each account has a capstone limit of 25 contacts, outgoing share records (including
revoked records/idempotency history), incoming share references, received alerts,
allowed senders and alert targets. Aggregates are rejected above 240 KB. This is
a bounded academic increment, not an unlimited production history. Limits fail
explicitly rather than silently deleting earlier records or idempotency keys.

| Data | Current boundary |
| --- | --- |
| Existing synthetic AI data | `mindguard.synthetic.v1`, preserved; never migrated to a signed-in account. |
| Existing demo privacy/contact stores | `mindguard.synthetic.privacy-preferences.v1` and `mindguard.synthetic.recipients.v1`, preserved; not used as authenticated consent or account-owned contacts. |
| Signed-in AI simulation cache | `mindguard.account.<subject>.ai.v1`, separately scoped. This preserves the AI feature's local persistence; it does not introduce an AI cloud history service. |
| Security preferences/contacts/saved categories/shares/alerts | Account-owned AWS records. Missing consent defaults off; saved categories initially empty. |
| Wearable simulation and sharing-recipient draft | Existing session-only wellness state; remounts on account change. Measurements remain synthetic. |
| Live voice identity/audio/transcripts | Memory only; no application transcript saving is enabled. |

Screen 17 explicitly offers saving fictional examples to the account, with
wellness/save-summary consent required. Deleting a category does not remove
contacts, AI records, another category, or prior share snapshots. Export-only
review stays simulated and does not download a file or create a share.

The disabled account-deletion path first locks processing, then cleans linked
share/alert references and owned voice metadata, removes the verified directory
binding and Cognito account, and retains a minimal subject-only tombstone.
Partial failure stays locked and can resume; the app never claims deletion after
a timeout. Its local cache cleanup targets only the deleted account's AI key,
after its old namespace is deactivated and queued writes settle. No application
deletion calls `AsyncStorage.clear()`.

## Configuration, infrastructure and costs

Run the existing local Docker product:

```powershell
npm run setup:env
aws login --profile mindguard
.\scripts\voice-local.ps1 -Action Up
# http://localhost:8080/sign-in
```

Existing Cognito issuer/client/table/region and AWS credential refresh settings
remain in `ENVIRONMENT-SETUP.md` and `VOICE-LOCAL.md`. No new frontend secret or
service URL is required. The existing `EXPO_PUBLIC_VOICE_RELAY_URL` also locates
the security API in native/development configurations. The Docker browser uses
its same-origin proxy. Tokens/passwords are never written to these files.

The `mindguard-voice-foundation` CloudFormation stack was updated in place to
allow email-confirmed self-signup and verified-email-only recovery. It reached
`UPDATE_COMPLETE`; no pool/table replacement or new resource was requested.
The generator and template are committed together. IAM is not managed by this
stack: the prepared deployer policy adds only Query/DeleteItem on the existing
table, but those permissions were denied and **not applied**. Munsif explicitly
chose to keep account deletion blocked. `SECURITY_ACCOUNT_DELETION_ENABLED=false`
is the default. Do not enable it before the owner/admin resolves IAM and verifies
deletion. EKS remains deferred to April 2027.

The increment reuses existing on-demand services, caps records and makes no
OpenAI calls during security verification. Existing AWS request/storage/Cognito
usage can still incur charges; this is not a promise of zero cost or an AWS
billing cap. No new paid delivery or subscription is enabled.

## Verification and demo

```powershell
npm run check
npm run test:voice
.\scripts\security-test-accounts.ps1
npm exec -- playwright install ffmpeg
node scripts/verify-security.cjs
```

The account setup suppresses invitations and stores credentials only in ignored
`artifacts/security-test-accounts.local.json`. It creates three dedicated synthetic
identities and must not be used with real recipient data. Browser tests use
installed Chrome (override with `PLAYWRIGHT_CHROMIUM_EXECUTABLE`) and Docker at
8080 by default. `MINDGUARD_URL` and `SECURITY_API_URL` can select the development
app/relay. Reports, screenshots and silent video remain ignored under `artifacts/`.

The demo is: sign in as recipient and sender; enable applicable consents; save a
trusted contact and fictional categories; preview synthetic Steps for the exact
recipient; confirm a real share; reconcile a deliberately lost browser response;
view it in the recipient account; withdraw Sharing consent and verify new shares
are denied while old access remains; revoke and refresh the recipient inbox;
verify an alert is rejected before opt-in, then allow the sender and receive the
confirmed in-app alert; sign out and switch accounts to inspect isolation.

See `SECURITY-VERIFICATION.md` for executed results and limits. Native Android was
not tested for this increment; native iOS remains unverified. Live audio could not
be reverified because this checkout has no OpenAI key. Signup/recovery API wiring
has focused tests, but actual email delivery/code entry requires an authorized
email mailbox and is not established by admin-created synthetic accounts.

Implementation references: [Cognito GetUser](https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_GetUser.html),
[password recovery](https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_ConfirmForgotPassword.html),
[DynamoDB transactions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis.html),
[transaction IAM permissions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis-iam.html).
