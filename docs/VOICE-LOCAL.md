# Run the voice increment locally

The general `/sign-in` and `/create-account` flows now use the same Cognito session
as `/voice`. See `SECURITY-INCREMENT.md`. Security/account/consent operations do
not require an OpenAI key; starting real voice still does. The existing local
Docker and CloudFormation foundation remain the shared development setup.

Use the existing app and the existing AWS foundation. EKS migration is deferred to April 2027. The flexible AWS/OpenAI budgets are monthly; currency and exact cloud dates remain for the later deployment review.

## Start the complete Docker app

From the repository root in PowerShell, with Docker Desktop using Linux containers:

```powershell
npm run setup:env
# Add the OpenAI key to apps/voice-relay/.env and configure your authorized AWS profile first.
aws login --profile mindguard
.\scripts\voice-local.ps1 -Action Up
```

Open [Talk with Zen](http://localhost:8080/voice). The web export and relay both run in Docker. A separate Expo preview server is not required. Create/confirm a voice account using your own email, or sign in to an existing one. Allow server-side voice processing, then press Start voice conversation to request the microphone. Speak naturally; subsequent turns do not need Record or Finish controls.

Health: [relay health](http://localhost:3001/api/voice/health). Configuration readiness: [relay readiness](http://localhost:3001/api/voice/ready). Health/readiness are not evidence of an authenticated microphone conversation.

The web server proxies `/api/voice/*`, including WebSockets, to the relay. Both published ports are bound to PC loopback. Localhost is a browser secure context; this does not authorize exposing plain HTTP over a LAN or the internet. Future remote deployment requires HTTPS/WSS. No purchased domain is needed for this local setup.

## Local credentials and policy

Keep `apps/voice-relay/.env` ignored; never overwrite an existing key. `npm run setup:env` creates missing local files from the root, frontend and relay templates and preserves existing files. See `ENVIRONMENT-SETUP.md` for their different loaders and which settings require private access. The relay template already contains the selected `gpt-realtime-mini` and `gpt-4o-mini-transcribe` models and public foundation references; supply the OpenAI key locally.

Verified foundation references:

```dotenv
AWS_REGION=ca-central-1
COGNITO_ISSUER=https://cognito-idp.ca-central-1.amazonaws.com/ca-central-1_gHPR0XqZa
COGNITO_CLIENT_ID=1h724t9mf6h9jen6v3r6upq2pt
VOICE_TABLE=mindguard-voice-access
ALLOWED_ORIGINS=http://localhost:8080,http://localhost:8081,http://localhost:3001
```

Compose mounts the approved policy read-only and enables its recorded approval. The relay rejects draft/test versions even if an approval flag is set. `.env.example` still defaults to unapproved for other deployments; configure the actual reviewed file deliberately there.

The startup helper builds images sequentially before obtaining credentials. It verifies AWS account `950801850836`, exports temporary credentials into the ignored `artifacts/voice-runtime` directory, and starts one hidden local refresher. The AWS SDK reads those credentials through its credential-process protocol from a read-only directory mount. The host AWS directory is not mounted, and temporary credentials are excluded from image builds and source control. Docker environment metadata does not need to contain the credential values.

The refresher updates the file once per minute using the existing `mindguard` browser login. When that login itself expires, run `aws login --profile mindguard` and `Up` again. Refresh errors contain only operational codes in the ignored runtime logs; the application fails closed if access cannot be checked. Do not share the runtime directory, account fixtures or `.env`, and do not run `read-local-credentials.cjs` in a visible terminal: its stdout is the SDK's private credential pipe.

To validate Compose without printing resolved secrets:

```powershell
.\scripts\voice-local.ps1 -Action Check
```

To rebuild/restart only the relay during development:

```powershell
.\scripts\voice-local.ps1 -Action Up -RelayOnly
```

To stop the product, stop credential refreshing and remove the temporary credential file:

```powershell
.\scripts\voice-local.ps1 -Action Down
```

This does not delete AWS foundation resources. The earlier helper passed static temporary credentials in the container environment; the current helper replaces that approach to support refresh during long demos.

## Android Studio emulator

The user confirmed an iPhone is the available physical phone; Android verification uses the `MindGuard_API_36` emulator. Installation on that iPhone remains unavailable in the current Windows/no-Apple-membership setup. Expo also offers a hosted native iOS Simulator on paid Expo plans; that separate option needs the owner's account/plan decision and has not been enabled. Safari/browser verification is a separate platform result.

Start the configured emulator in Android Studio, then use the existing Android build runner:

```powershell
$env:EXPO_PUBLIC_VOICE_RELAY_URL='http://localhost:3001'
adb reverse tcp:3001 tcp:3001
node scripts/android.mjs --variant release --no-bundler --device emulator-5554
```

The release test binary includes its JavaScript bundle and does not require a running Metro server. The local network plugin permits only `localhost`/`127.0.0.1` cleartext traffic for USB/emulator forwarding; remote API connections retain normal TLS requirements. Microphone permission, native routing and background shutdown come from the audio plugin and adapter. Native folders are generated; do not edit them manually.

Android's React Native socket supplies the relay's HTTP origin (`http://localhost:3001`) automatically. Local Compose explicitly allows that origin alongside the two browser origins; authentication and consent are still required. Keep the deployed relay's allowed origins aligned with the actual native endpoint when migrating later.

For an emulator-only build, Gradle can be limited to its x86_64 architecture without changing project defaults:

```powershell
$env:GRADLE_OPTS='-Dorg.gradle.project.reactNativeArchitectures=x86_64'
```

The native adapter does not enable file output, background recording, a recording foreground service or notification permissions. It stops for backgrounding, audio interruptions and loss of an audio route. Emulator tests with host audio disabled do not establish physical microphone quality, acoustic echo cancellation or native iOS correctness.

The verified emulator test APK is `artifacts/mindguard_voice_android_x86_64.apk`. With the test emulator running and Docker up, install it without rebuilding:

```powershell
$voiceAdb = Join-Path $env:LOCALAPPDATA 'Android/Sdk/platform-tools/adb.exe'
& $voiceAdb -s emulator-5554 install -r artifacts/mindguard_voice_android_x86_64.apk
& $voiceAdb -s emulator-5554 reverse tcp:3001 tcp:3001
& $voiceAdb -s emulator-5554 shell am start -W -a android.intent.action.VIEW -d mindguard:///voice com.mindguard.capstone
```

The first Android microphone permission activity may stop the initial start because it backgrounds the app. After granting, press Start again. Subsequent starts and unmute check the existing grant without reopening that activity.

## Reproduce verification

Frontend source checks:

```powershell
npm run check
```

Docker's relay build compiles and runs the backend suites before producing its runtime image. Windows host `npm run build:voice` was not verified because its backend dependency tree was unavailable; Docker uses the root lockfile and is the verified backend build environment.

A read-only provider configuration probe (no microphone audio or conversation):

```powershell
Get-Content -Raw scripts/verify-voice-provider.mjs | docker compose -f compose.voice-local.yaml exec -T voice-relay node --input-type=module
```

For full live automated tests, prepare the dedicated synthetic account and generated WAV fixtures with the commands below. An installed Chrome browser and Playwright's video recorder are also required. Tests use real AWS/OpenAI services and count toward provider usage/session allowances. They never record the user's microphone. Generated test-account credentials remain in ignored `artifacts/voice-test-account.local.json`; they are not a login to share in chat.

```powershell
.\scripts\voice-test-account.ps1
.\scripts\voice-test-audio.ps1
npm exec -- playwright install ffmpeg
$env:MINDGUARD_URL='http://localhost:8080'
node scripts/verify-live-voice.cjs
node scripts/verify-voice-exceptions.cjs
```

The safety scenario uses the separate synthetic safety WAV:

```powershell
$env:VOICE_TEST_SCENARIO='safety'
node scripts/verify-live-voice.cjs
Remove-Item Env:VOICE_TEST_SCENARIO
```

The native script is only for the dedicated test emulator, after the release test app is installed:

```powershell
$env:ANDROID_SERIAL='emulator-5554'
node scripts/verify-native-voice.cjs
```

It changes only emulator animation settings, enters the synthetic account, requests microphone permission, and checks native recording/mute/background cleanup. It does not prove a spoken native conversation when the emulator's host microphone is disabled. See `VOICE-VERIFICATION.md` for actual recorded passes and limits.

## References

- [AWS credential-process protocol](https://docs.aws.amazon.com/sdkref/latest/guide/feature-process-credentials.html)
- [AWS CLI credential export](https://docs.aws.amazon.com/cli/latest/reference/configure/export-credentials.html)
- [Docker environment configuration](https://docs.docker.com/compose/how-tos/environment-variables/set-environment-variables/)
- [Expo development build options](https://docs.expo.dev/develop/development-builds/introduction/)
- [Native audio compatibility](https://docs.swmansion.com/react-native-audio-api/docs/other/compatibility/)
- [Android network security configuration](https://developer.android.com/privacy-and-security/security-config)
