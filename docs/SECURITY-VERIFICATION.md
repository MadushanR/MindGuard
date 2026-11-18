# Security and UC-10 verification

Verified November 17, 2026, on Munsif's `feat/munsif-security-integration` branch.
The final contract, configuration and limits are in `SECURITY-INCREMENT.md`.

## Executed checks

| Check | Result |
| --- | --- |
| `npm run check` | Fixture validation, TypeScript, lint and **151 tests across 23 suites passed**. |
| `npm run test:voice` | **29 tests passed**: 7 voice-domain and 22 relay tests, including security authorization/transaction cases. |
| Docker relay build | Compiled and passed the backend suites before producing the runtime image. |
| Docker web build | Production Expo web export succeeded; Nginx routes the configured app and `/api/*` to the existing relay. |
| `node scripts/verify-security.cjs` | Passed against Docker at `http://localhost:8080` with real Cognito and DynamoDB, dedicated synthetic accounts, and installed Chrome. No browser runtime errors. |
| Layout smoke checks | Live sharing and alert/inbox screens passed **20 viewport/text-size combinations** at 320, 390, 430, 900 and 1440px, normal and larger text, without horizontal overflow. |
| `git diff --check` | Passed. |

The new client tests cover shared account/voice sign-in, confirmation/recovery
requests and invalid codes, immediate voice cleanup, expiry, account switching
with an in-flight share, rejection of stale results, ambiguous transport outcomes,
same-ID status reconciliation, changed destinations, exact submitted content,
application-session survival across a provider remount, and account-scoped local
cache reads/writes/removal without changing synthetic or other-account keys.

Backend tests cover authenticated create/history/recipient read/revoke, missing
consent, consent withdrawal between read and transaction commit, atomic concurrent
duplicates, conflicting content/destinations, invalid payloads, owner isolation,
unauthenticated/expired-session boundaries, explicit recipient alert opt-in,
independent category deletion, and the disabled account-deletion gate. A
regression test reorders map properties as DynamoDB can: identical retries must
not conflict merely because object key order changed. Throttling is classified as
service availability failure, not proof that a valid account was revoked.

## Actual integrated browser flow

The script uses general account sign-in, the real provider composition and product
navigation, not an unused adapter or independently compiled endpoint demo:

1. Sign in as the synthetic recipient and sender and save applicable AWS consents.
2. Save a trusted contact without granting sharing/alert eligibility. Explicitly
   save fictional categories, delete only wellness records, and verify the
   independent summary remains.
3. Connect/sync the existing **simulated** watch, select Steps and review the
   exact source, seven values, average and recipient email/relationship.
4. Commit the share to the real backend, deliberately drop the browser response,
   observe **unknown**, retry the same operation, and reconcile through the status
   endpoint. No second create is needed for this retry.
5. Verify real unauthenticated and cross-account status/revoke denial and a
   changed-payload conflict. Read the exact content in the recipient account.
6. Withdraw Sharing consent: a new server create is denied, the unchanged
   completed retry still identifies its original share, and existing recipient
   access remains. Revoke as owner with Sharing off; refresh the recipient and
   verify access is gone.
7. Reject an alert before recipient opt-in. Explicitly allow the sender, confirm
   the exact in-app alert, and read it in the recipient inbox. No external
   delivery service or real recipient is used.
8. Preserve the existing synthetic storage keys, confirm that the app does not
   persist token result fields, show account deletion as unavailable, sign out,
   and sign in as the other account in the same browser to verify contact
   isolation. Exercise live sharing/inbox layouts with larger text.

`artifacts/security-verification.json` is the local report. Silent recordings are
`artifacts/security-integrated-demo.webm` (owner journey) and
`artifacts/security-recipient-demo.webm` (recipient journey). Review them together
to see both sides of the same test. The script regenerates both. These are local
review artifacts, intentionally excluded from Git alongside account credentials,
screenshots, generated native projects and runtime files. The PR includes the
reproducible demo sequence; it does not imply those ignored media are hosted by
GitHub.

## Limits and blocked work

- **Account deletion is disabled by the owner's explicit decision.** Query and
  DeleteItem on the existing table were denied. The prepared policy update was
  not applied. The HTTP gate is tested to reject deletion without first locking
  or altering account data. The future cleanup path has domain tests but no live
  deletion claim is made.
- **Live voice audio was not reverified.** This checkout has no OpenAI key.
  Security/identity/voice-consent APIs function independently; microphone/provider
  processing stays blocked. Voice cleanup is covered by injected client and
  domain/relay tests, not a new physical microphone or listening test. Madushan's
  earlier evidence remains separately recorded in `VOICE-VERIFICATION.md`.
- **Actual signup/recovery email delivery and mailbox code entry are unverified.**
  Cognito APIs are wired and tested, and CloudFormation enabled self-signup and
  verified-email recovery in place. Browser accounts were admin-created with
  invitations suppressed; they do not prove mailbox delivery. No real recipient
  was contacted during verification.
- **Android was not tested for this increment. Native iOS remains unverified.**
  TypeScript and browser checks do not establish native installation, audio,
  keyboard, screen reader or device behavior.
- Wearable values, AI text/tone features and export-only previews retain their
  disclosed simulations. This increment provides real account-owned security
  records and in-app access, not a real watch integration, file export or
  cloud-based AI history service. Existing local AI data remains unencrypted and
  account-scoped; use fictional information.
- No EKS deployment, paid notification service, new AWS resource, load test or
  clinical validation was performed. Bounded on-demand AWS operations can incur
  normal charges; no claim of a billing cap or zero cost is made.
