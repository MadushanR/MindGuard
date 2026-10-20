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

Start at Data Sources, connect the demo watch, explicitly allow a metric, then **Sync demo records**. Home, Trends and Share now expose the same seven synthetic Monday–Sunday values. Pause, disconnect or deny access to make affected records unavailable. Last week intentionally has no wearable records. The watch's **Simulate connection failure** switch exposes failure/retry; leaving while connecting cancels the attempt.

In Export and Share, select records and add an invented recipient. Invalid fields show inline text. Save returns to the originating screen and selects the recipient when opened from sharing. Cancel preserves previous share choices. Preview shows the destination and exact daily values/averages. Confirmation only displays a simulation result; it never sends, exports or downloads anything. Recipients confer no trusted-contact or notification status.

Load **Sample saved records** through Explore to inspect nonempty conversation observations in Trends. Existing ObservationCard owns confirm/correct/dismiss. Source permission and period filters apply; these are inferred observations, separate from wearable data. Settings uses the AI provider's existing persistent accessibility preferences and links to all registered teammate destinations.

## Verification

```sh
npm run check
node scripts/verify-wellness.cjs
```

The browser check requires the web server and Playwright Chromium (`npm exec -- playwright install chromium`). It produces ignored `artifacts/wellness-verification.json` and screenshots. It never activates external-contact links. Unit tests cover availability gates, reset, avoiding additional persistence, and validation. See the actual command output/report for executed results.

## Integration and reference gaps

- No screenshots or original HTML app are available. Presentation uses the local design tokens, shared native components, icons and Zen orb. A simple activity-icon watch illustration stands in for a missing native watch asset. The current desktop sidebar layout is preserved.
- There were no recipient, wearable, wellness permission or sharing contracts/services in the repository. The single wellness demo controller is deliberately isolated from AI storage; replace it with team-approved integration contracts when provided. No sensitive wellness/recipient state is newly persisted.
- No approved crisis-resource wording, regional links, or offline list exists. Resources explicitly flags this gap and links separately to illustrative wellness suggestions and the team's trusted-contact destination. No helpline numbers are invented.
- Authentication, real sign-out, account deletion, sharing eligibility, trusted contacts and saved/shared-information screens remain security integration gaps. Settings offers an explicit leave-demo confirmation that clears wellness and active conversation state while preserving saved AI records. Account deletion explains its unavailability and links to the existing security route; it claims no deletion.
- Demo weekly wearable values are fixed fixtures, not live measurements, diagnoses or date-aligned real records. All additional wellness state resets on reload or wellness/demo reset. Saved AI data retains existing storage behavior.
- Browser checks do not substitute for Android/iOS keyboard, screen-reader or device testing.
