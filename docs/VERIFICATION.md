# Frontend verification

Madushan's eight screens and the shared foundation were verified locally. Zain and Munsif's destinations remain explicit placeholders.

## Automated checks

- `npm run check`: fixture validation, strict TypeScript checking, Expo lint, and 24 passing Jest tests across two suites.
- Expo Doctor: all 20 checks passed with the installed SDK 58 dependencies.
- Web export: a production browser bundle was generated successfully.
- Fixture tests cover editable replies, sequence fallback, duplicate IDs, missing references, unsupported states, invalid durations, consent consistency, and voice transitions.
- Domain and storage tests cover opt-in history, temporary isolation, stale replies, transcript consent, original estimates versus corrections, selective deletion, retention boundaries, restored-data validation, and serialized write failure/retry.
- Component/provider checks cover editable Welcome content, account-module navigation, delayed mock responses, and the explicit retention requirement. Jest allows 30 seconds for initial native component transforms on Windows; decorative native animation is isolated from component interaction tests.

## Browser verification

The running Expo web preview passed 160 combinations: all eight screens at widths of 320, 390, 430, 768, 899, 900, 1024, 1100, 1440, and 1920 pixels, with normal and larger text. The checks verify the desktop sidebar breakpoint and absence of horizontal page overflow.

Desktop verification also covers two-column recommendation cards, sidebar navigation, dialog keyboard containment and Escape dismissal, and preserving a text draft when crossing the desktop breakpoint. Welcome uses a split layout; reading pages keep a bounded width. The Android emulator was checked after the responsive changes: chat still shows its mobile header, composer, and bottom navigation without the desktop sidebar.

The interaction checks passed for history opt-in, restart persistence, remembered details, selective linked deletion, temporary text/voice switching and cleanup, mock failure/retry without duplicate messages, voice reconnection/mute/stop, recommendation filtering and details, dialog keyboard containment and Escape dismissal, and expired fixture records.

There were no page errors, browser console errors, or application requests to external services during the final verification run. Reduced-motion preference was enabled in the browser test context.

Run `node scripts/verify-web.cjs` against the local preview to reproduce the browser checks. The machine-readable report is written to `artifacts/web-verification.json`.

## Android verification

The development APK compiled successfully and was installed on `MindGuard_API_36`, a Pixel 6 emulator with an Android 36 Google APIs x86_64 image. The package is `com.mindguard.capstone`.

Native checks passed for:

- History opt-in and explicit retention controls.
- Keyboard entry and Send with the composer visible above the keyboard.
- JSON-driven replies and saved conversation history.
- Explicit remembered details, with the dialog's confirmation accessible while typing.
- Saved records remaining available after force-stopping and relaunching the application.
- Text/voice switching, separate voice consent, mute/unmute, and stop.
- Separate tone consent and confirmation of a completed-turn estimate.
- Personalized recommendations derived from the shared observations.
- No requested microphone permission and no AndroidRuntime fatal exception during the checked flows.

The shared shell and dialogs use native keyboard avoidance. Emulator animations were disabled for stable UI inspection and reduced-motion verification. The build uses the generated Expo native folders; no generated native source was manually patched.

For a repeatable native journey, start the installed development build and Metro, move Expo's floating Tools bubble away from the Explore header action, then run:

```sh
node scripts/verify-android.cjs
```

Run this only on a dedicated test emulator: it explicitly loads the Normal scenario through the app's confirmation dialog, replacing local demo data. `ANDROID_HOME`, optional `ADB_PATH`, and optional `ANDROID_SERIAL` select the tool/device. `scripts/android-ui.cjs` provides the inspection harness. Reports and screenshots go to the ignored `artifacts` directory.

## Limits and follow-up

This validates a frontend prototype with local JSON providers, not live AI, backend authentication, cloud consent enforcement, actual audio processing, or wearable integration. iOS builds and device validation remain deferred as agreed.

AsyncStorage is unencrypted and represents one synthetic local profile. Future authenticated accounts need deliberate account-scoped storage and lifecycle integration. Retention runs while the application operates, rather than as a background service while closed.

The dependency audit reported 55 advisories in the current Expo/Jest dependency graph, including 30 high and 25 moderate. A compatible-fix preview did not resolve these; suggested major framework downgrades were not applied. Review upstream fixes before moving beyond the synthetic local prototype. The current framework versions and lockfile were retained and passed Expo's compatibility checks.
