# Voice increment verification

Verification date: November 16, 2026. Scope: UC-04 / UC-13 in the existing app.

## Evidence already established

- Frontend: after incorporating main through `a589971`, fixture validation, TypeScript, lint and **114 tests across 19 suites passed**, including the merged security prototypes and existing-permission handling on native platforms. Before that integration, the voice baseline passed 57 tests across 10 suites.
- Backend: **7 domain tests and 11 relay tests passed** inside the final Docker image build, including the credential-process regression test. Together with the integrated frontend, 132 tests passed.
- AWS identity and the existing foundation were verified. Account: `950801850836`; identity: `mindguard-deployer`; region: `ca-central-1`; foundation: `CREATE_COMPLETE`. CloudFormation ownership remains unchanged.
- The configured `gpt-realtime-mini` and `gpt-4o-mini-transcribe` IDs were available to the project. Actual Realtime configuration and subsequent speech processing were exercised; this evidence goes beyond model listing.
- After incorporating main's security screens, the Docker web export rebuilt successfully. Browser smoke checks rendered live voice, security sign-in and privacy screens with zero page errors (`artifacts/pr-web-smoke.json`). This is an integration/rendering check, separate from the earlier full live and native journeys.

## Live browser verification

`scripts/verify-live-voice.cjs` uses an isolated synthetic account, generated speech fed through Chrome's microphone API, and real Cognito/DynamoDB/OpenAI services. It does not record the user's microphone. `artifacts/live-voice-verification.json` reports a passing run with zero browser runtime errors and two approved replies.

Verified behaviors:

- Real sign-in, authenticated consent and session/socket startup.
- Raw microphone-frame capture and actual transcription/provider processing.
- Approved PCM playback completes and automatically returns to listening.
- A second speech turn works without Record/Finish controls.
- Interruption returns to listening, mute stops transmitted frames, and unmute captures afresh.
- Temporary text continuation retains only bounded completed context and returns checked real-provider replies.
- Live content and access tokens are absent from saved application storage.
- Consent revocation and logout stop voice.

`scripts/verify-voice-exceptions.cjs` separately passed stop, navigation cleanup, reload dropping in-memory identity, automatic reconnection, and stopping after exactly two unsuccessful recovery attempts. Its report is `artifacts/voice-exceptions-verification.json`.

These are browser tests with synthetic input, not human listening, acoustic echo-cancellation, or physical microphone measurements. The silent walkthrough recording shows UI transitions; it has no audio track. Real-service and storage assertions come from the test report and implementation checks, not from the video alone.

## Safety evidence and limitations

Unit tests verify transcript/session correlation, incomplete inputs, cancellation, access revocation, unsafe-output blocking, buffered output, final transcript requirements, mismatched output items, and rejection of synthetic policy versions. Cancellation before a provider response ID arrives is also covered.

The live deterministic resource-routing test passed using the separate generated safety utterance and real transcription/relay services. The completed transcript matched the approved rule, capture stopped, no approved reply/audio was delivered, and the existing Resources screen opened. Its report is `artifacts/voice-safety-verification.json`.

Approved phrase matching remains limited and English-based. It does not constitute a complete crisis detector, diagnosis, clinical assessment or guarantee that every unsafe paraphrase is blocked.

## Android and iOS

The self-contained release test APK built successfully and was installed on Android Studio's `MindGuard_API_36` Android 36 x86_64 emulator. `scripts/verify-native-voice.cjs` passed real Cognito sign-in, authenticated relay/provider session startup, native microphone capture, mute stopping Android OS recording, fresh recording on unmute, background shutdown without automatic restart, and revocation/logout cleanup. Its report is `artifacts/native-voice-verification.json`; the inspected screenshot is `artifacts/native-live-voice-listening.png`.

Two integration issues were corrected and verified: an existing microphone grant now bypasses Android's permission activity, and local Compose allows the exact origin automatically supplied by React Native's socket. An unapproved socket origin was separately confirmed rejected. The native app retains immediate background cleanup, including during the first permission prompt; press Start again after granting if that prompt stopped the initial start.

APK: `artifacts/mindguard_voice_android_x86_64.apk`, SHA256 `4BA51FBBDB688CCB86FD9202E345C0F98F4BCC39BA96A1DF5CC6082BD408210A`. This is a local emulator test binary, not a store distribution. It contains its JavaScript bundle and uses the ADB-forwarded loopback relay.

That recorded APK and the live journey evidence were produced before the voice branch incorporated main's newly merged security screens (`a589971`). The voice adapters and relay are unchanged by that integration. The integrated source passed the frontend checks above; the recorded APK is not a freshly rebuilt binary of the rebased PR.

The emulator microphone had host audio disabled. These native results establish recording/session/control lifecycle, not a spoken native conversation, acoustic playback/echo quality, or physical-device behavior. Real speech processing and approved playback were exercised separately in the browser with synthetic microphone input.

The user has an iPhone but no Mac or paid Apple Developer membership. Native iOS has not been built, installed or tested. Native source/type checking and browser verification do not satisfy native iOS verification.

Expo's newly available [hosted iOS Simulator](https://docs.expo.dev/eas/simulators/how-to/work-without-a-mac/) can run a native simulator build from Windows without Apple signing. It requires an Expo sign-in, linked project and [paid Expo plan](https://docs.expo.dev/eas/simulators/reference/usage-and-billing/). The owner chose to keep the no-subscription setup and document native iOS as unverified. No subscription, project upload or simulator session was started.

## Demonstration evidence

The final passing browser run's reviewed, silent recording is `artifacts/live_voice_final_browser_walkthrough.webm` (39.68 seconds), SHA256 `087BD1ACE954D7C83867BB16CE87F878D5490516EC5DCDF7FC36E34D5F6F3A6F`. Review confirmed visible listening/speaking/mute/text-handoff/logout transitions and no exposed password or token in the sampled frames. Only generated conversation input and the dedicated synthetic email appear. It demonstrates browser behavior; native recording/control assertions come from the separate emulator report.

## Known operational limits

- Host relay compilation was blocked by the Windows dependency tree; verified backend builds/tests run inside Docker from the root lockfile.
- Docker and Windows/Android builds can compete for resources. The local helper builds relay and web sequentially, then obtains credentials, rather than consuming credential lifetime during the build.
- One browser rerun during Android compilation hit the relay's audio-rate bound and stopped. The serialized rerun after compilation passed without relaxing the limit. This is not a stress or overload acceptance test; avoid running full native builds during a demo on this 16 GB machine.
- The local credential helper refreshes temporary AWS credentials while the browser-based AWS login remains valid. When that login itself expires, the owner must run `aws login --profile mindguard` again. Missing/expired credentials fail closed.
- Actual minute-by-minute file replacement, exclusive refresher locking, authenticated consent reads, and absence of AWS secret values in container environment metadata were verified. The operational report is `artifacts/voice-runtime-verification.json`; it contains no credential values.
- No EKS deployment, load test, multi-replica test, physical Android test, native iOS test or clinical safety validation has passed.
