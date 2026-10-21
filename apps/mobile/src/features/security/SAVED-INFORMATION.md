# Screen 17: Saved Information and Deletion

`/saved-information` is a thin wrapper for `screens/SavedInformationScreen.tsx`. It uses the existing Page, Card, Copy, Button, Dialog, MenuRow, theme and browser-only responsive helpers. The feature-local InformationCheckbox uses shared icons/typography/colors, native accessibility state, web ARIA state, visible focus and Space/Enter activation. It introduces no UI dependency. Native presentation remains one column; desktop web uses the existing security screen layout.

## Data and deletion boundaries

The user selected **separate preloaded fictional examples**, **session-only data and deletion**, and **an independent weekly summary**. `SavedInformationProvider` loads its own copies of `packages/fixtures/security/saved-information-records.json` once per provider mount. Copy and notices are editable in `saved-information.json`. The summary and seven daily records are separate categories; neither is derived from current wearable state or conversation history. Empty fixture categories are unavailable rather than automatically selected.

Both available categories start selected. Each checkbox works independently. A missing category remains visible, unchecked and disabled. Export and Delete are disabled when no available category is selected. The deletion dialog snapshots and names the exact selected categories. Cancel changes nothing; confirmation removes those category records from Context state and moves keyboard focus to the result notice. Deleting wellness records never removes the summary unless both were selected.

Navigation does not recreate deleted categories. Reloading/restarting the app remounts the session provider and restores the examples; this is explicitly stated on screen and in the confirmation. No AsyncStorage key, fixture file, backend, account, connected-watch state, consent setting, conversation, emotion observation, memory, contact, or existing Shared Information snapshot is deleted or changed. This is not account deletion. Existing wellness reset/developer reset controls retain their previous scope; they do not recreate or delete this separate session store while it remains mounted.

## Export integration

`SavedInformationProvider`, `useSavedInformation`, category types and `SavedInformationExportPreview` are public security exports. The root layout adds the session provider. No shared contract, dependency, navigation ID, AI file or wellness feature file changes are needed.

Screen 17 uses `route(13)` with `origin=saved-information` and a comma-separated `categories` parameter containing only category IDs. The existing `/export-share` thin wrapper selects the public saved-information preview for that origin. Normal entry continues to render the existing wellness Screen 13, including its wearable permission gates, destinations, recipient flow and sharing history integration.

The new entry previews only the selected examples and has an explicit simulated export confirmation. It downloads/sends nothing, has no recipient-sharing action and creates no Shared Information record. Missing, unknown, repeated, array-valued or stale category selections fail closed. Preview and confirmation re-evaluate availability, so a deleted category cannot be exported through an old route. No record content is placed in the URL. The return link uses route(17), and the retention/privacy link uses route(16). Back and Resources remain supplied by AppShell.

## Changed files

- `apps/mobile/src/app/_layout.tsx`
- `apps/mobile/src/app/export-share.tsx`
- `apps/mobile/src/app/saved-information.tsx`
- `apps/mobile/src/features/security/index.tsx`
- `apps/mobile/src/features/security/savedInformation.ts`
- `apps/mobile/src/features/security/SavedInformationProvider.tsx`
- `apps/mobile/src/features/security/InformationCheckbox.tsx`
- `apps/mobile/src/features/security/SavedInformationExportPreview.tsx`
- `apps/mobile/src/features/security/screens/SavedInformationScreen.tsx`
- `apps/mobile/src/features/security/__tests__/savedInformation.test.tsx`
- `apps/mobile/src/features/security/SAVED-INFORMATION.md`
- `packages/fixtures/security/saved-information.json`
- `packages/fixtures/security/saved-information-records.json`

## Manual verification

1. From the repository root, run `npm run check`, then `npm run web` if a server is not already running. Open `http://localhost:8081/saved-information`, or select Screen 17 from Explore.
2. Check 320, 390, 430, 900, 1280 and 1440px browser widths. Enable Larger text in Explore; verify wrapping, scrolling, visible actions and both dialogs. Use Tab/Shift+Tab and Space/Enter on checkboxes and buttons. Dialog focus should stay inside until Cancel/Escape closes it and restores focus.
3. Confirm both checkboxes initially show selected. Deselect either without changing the other; deselect both and verify both actions disable. Export summary only, records only, then both. Screen 13 must show exactly those categories and lines. Cancel its review; confirm another review and verify the explicit simulation notice. Shared Information must not gain an export-only record.
4. Select only Wellness records, open Delete and verify only that category is listed. Cancel and verify it remains. Confirm deletion; verify it is disabled, the independent summary remains available and the result is announced/focused. Delete the summary separately. Both actions must disable. Navigate through Resources, privacy and Back: removed examples must remain removed. An old export route requesting a deleted category must be blocked. Reload: both fictional examples return.
5. Confirm previously saved AI data, trusted contacts and privacy preferences remain unchanged. Enter Screen 13 through Explore without the saved-information origin and repeat the existing wearable/recipient workflow; this should remain unchanged.
6. With the local Android SDK, JDK and emulator configured, run `npm run android` (or `node scripts/android.mjs --no-bundler` with the development server running). Repeat selection, dialogs, navigation, scrolling and larger-font checks in the development build. Android and iOS require separate native verification; browser emulation does not establish native compatibility.

Automated feature tests validate both JSON category examples, independent deletion, session lifetime, exact category navigation, invalid/stale selections, Cancel/confirmation, storage isolation and the normal Screen 13 entry. The root fixture validator does not automatically discover new security JSON; these feature tests validate it.

Executed verification: `npm run check` passed (93 tests across 14 suites, fixture validation, TypeScript and lint). Browser checks passed at 320, 390, 430, 900, 1280 and 1440px with standard/larger text, keyboard Space/Enter, dialog focus/Cancel/Escape, all export combinations, independent deletion, stale export blocking, persistent-data isolation and navigation/reload lifetime. The existing wellness browser regression also passed, including the normal wearable sharing flow and 64 screen/viewport/text-size combinations. Android SDK/JDK tooling was unavailable locally; Android and iOS were not tested. Ignored screenshots and browser verification scripts/reports remain under `artifacts/` and are not feature source files.
