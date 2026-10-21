# Zain's wellness screens

Screens 05, 09, 10, 11, 13, 18, 19 and 20 use the existing route wrappers and `WellnessScreen` dispatcher. `screens.tsx` implements the screens with shared native UI, icons, theme, Page, and shell. `state.tsx` holds the session-only demo controller and recipient validation. The root mounts `WellnessProvider`; the shell's existing demo reset also clears wellness state. AI AsyncStorage and its public consent/observation/preferences APIs are unchanged.

## Run and review

From the repository root (`MindGuard`, containing package.json):

```sh
npm ci
npm run web
```

On PowerShell systems that block npm.ps1, use `npm.cmd` instead of `npm`.
Open http://localhost:8081/home. Development **Explore** lists every registered destination under **Screens and ownership**, with the owner's name below each screen. Zain owns 05, 09, 10, 11, 13, 18, 19 and 20; Madushan and Munsif are identified on their respective destinations. No `?review=1` switch is required. Direct routes: `/home`, `/trends`, `/data-sources`, `/resources`, `/export-share`, `/settings`, `/connect-smartwatch`, `/add-recipient`.

Start at Data Sources, connect the demo watch, explicitly allow a metric, then **Sync demo records**. Home, Trends and Share now expose the same seven synthetic Monday–Sunday values from `packages/fixtures/wellness/wearable.json`. Pause, disconnect or deny access to make affected records unavailable. Last week intentionally has no wearable records. **Simulate sync failure** makes records unavailable until a successful **Retry sync**. The watch's separate **Simulate connection failure** switch exposes connection failure/retry; leaving while connecting cancels the attempt.

In Export and Share, select records and add an invented recipient. Invalid fields show inline text. Save returns to the originating screen and selects the recipient when opened from sharing. Cancel preserves previous share choices. Preview shows the destination and exact daily values/averages. Confirmation only displays a simulation result; it never sends, exports or downloads anything. Recipients confer no trusted-contact or notification status.

Screen 12 now opens Screen 20 with `origin=trusted-contacts`. That entry path collects only a name and free-text relationship, saves them through the security module's public `useRecipients().addRecipient` API, and returns to Trusted Contacts after saving succeeds. Save failures keep the draft for retry. Sharing/Settings entry paths continue to collect email and remain session-only. The two recipient stores are separate; no contacts are silently promoted or copied. Neither path enables check-ins, notifications, or sharing permissions. See `../security/RECIPIENTS.md` for persistence and reset boundaries.

Confirmed recipient-sharing simulations now create session-only snapshots through
the security module's public `useSharedInformation().recordShare` API. Export-only
previews and cancelled/invalid confirmations do not create records. Screen 14
reviews those snapshots and removes a selected record after simulated revocation
confirmation. No email is stored in that history. Reloading, confirmed wellness
reset, leaving the demo, or confirmed developer reset clears it; saved AI records
and persistent trusted contacts retain their existing behavior. See
`../security/SHARED-INFORMATION.md`.

Load **Sample saved records** through Explore to inspect nonempty conversation observations in Trends. Existing ObservationCard owns confirm/correct/dismiss. Source permission and period filters apply; these are inferred observations, separate from wearable data. The weekly summary and stacked emotion chart count corrected labels; select a day to filter recent observations, or **All days** to restore the list. Time boundaries refresh on data changes, at least once per minute while open, and when returning to the foreground; calendar arithmetic handles daylight-saving changes. Settings uses the AI provider's existing persistent accessibility preferences and links to all registered teammate destinations. **Reset wellness session** explains which session records will be removed and requires confirmation; Cancel preserves them.

Resources bundles Canadian contact information and official websites in `packages/fixtures/wellness/resources.json`, checked on October 20, 2026 against the official helpline and Government of Canada sources. Text is available without fetching a remote list. Calling/texting requires phone service; websites require internet access. Contact buttons ask before opening another app and never send messages, attach records, or place calls automatically. Opening failures show recovery information. Outside Canada, the screen directs users to local services. This is not a worldwide resource directory or a replacement for clinical/content review.

## Verification

```sh
npm run check
node scripts/verify-wellness.cjs
```

The browser check requires the web server and Playwright Chromium (`npm exec -- playwright install chromium`). An existing browser binary can be supplied with `PLAYWRIGHT_CHROMIUM_EXECUTABLE`; `MINDGUARD_URL` can select a different server port. It creates ignored `artifacts/wellness-verification.json` and screenshots. It never activates external-contact links. Unit tests cover availability gates, reset cancellation/confirmation, avoiding additional persistence, validation, sync failure/retry, new observations, week rollover, correction-aware counts, resource confirmation, and opening failures. See the actual command output/report for executed results.

## Integration and reference gaps

- The initial implementation used repository design tokens without the original HTML. The follow-up review compared the HTML reference from the project workspace and restored the emotion summary/day filtering and sync retry flows. Presentation uses shared native components, icons and Zen orb. A simple activity-icon watch illustration stands in for a missing native watch asset. The current desktop sidebar layout is preserved.
- The wellness demo controller remains isolated from AI storage. Its wearable data and sharing recipients stay session-only. The Trusted Contacts entry path on Screen 20 uses the security module's public API and separate persistent name/relationship store; no email, wearable data, or sharing selections are persisted by that path.
- Canadian resource details are source-checked and bundled, not live availability checks. Keep resource wording, links, region and review date current; get the team's clinical/content review before a real release. Wellness suggestions remain separate from crisis resources.
- Authentication, real sign-out, account deletion, sharing eligibility and saved/shared-information screens remain security integration gaps. Trusted Contacts now has a separate local security store for name/relationship records. Settings offers an explicit leave-demo confirmation that clears wellness and active conversation state while preserving saved AI records and persistent trusted contacts. Account deletion explains its unavailability and links to the existing security route; it claims no deletion.
- Demo weekly wearable values are fixed fixtures, not live measurements, diagnoses or date-aligned real records. All additional wellness state resets on reload or wellness/demo reset. Saved AI data retains existing storage behavior.
- Browser checks do not substitute for Android/iOS keyboard, screen-reader or device testing.
