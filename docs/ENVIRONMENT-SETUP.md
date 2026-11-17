# Team environment setup

After PR #6 is merged, pull the latest main into a clean checkout. The existing app, relay and example files are shared through Git; each member creates their own ignored local files. Use Node.js 24. The current Docker startup helper requires Windows PowerShell, Docker Desktop with Linux containers, and an AWS CLI that supports the existing browser-login/credential-export workflow.

## Create the files once

From the repository root:

```sh
npm run setup:env
npm ci
```

The setup command needs only Node, reads no credential values, and never overwrites an existing destination. Rerun it after pulling new templates to create missing files. It does not merge newly added variables into an existing `.env`; compare variable names with its `.env.example` and add missing settings locally while preserving existing values.

| Committed template | Local file created | Used for | How it is loaded |
| --- | --- | --- | --- |
| `.env.example` | `.env` at repository root | Optional browser verification and Android tool paths | Explicit `node --env-file=.env ...`; plain Node scripts do not auto-load it |
| `apps/mobile/.env.example` | `apps/mobile/.env` | Public frontend relay URL | Expo CLI when running/building the mobile workspace locally |
| `apps/voice-relay/.env.example` | `apps/voice-relay/.env` | Server provider key, models, AWS profile, foundation references, policy and limits | Local Docker Compose, or the relay workspace's host start command |

The root file is optional for ordinary app use. The frontend file contains only `EXPO_PUBLIC_VOICE_RELAY_URL=http://localhost:3001` for local Expo/ADB-forwarded development. Its values are public in the compiled client. OpenAI keys and AWS credentials belong outside the frontend. Local Docker web builds exclude local `.env` files and use their same-origin relay proxy instead.

## What Madushan supplies later

- **OpenAI project key:** add it only as `OPENAI_API_KEY` in `apps/voice-relay/.env`. It is intentionally blank in the example. The relay cannot process live conversations until the key is configured.
- **Authorized AWS access:** each member needs an authorized identity in the existing AWS account and permission to read/update the existing voice-consent and usage table. Configure a local profile named `mindguard`, or pass the chosen profile with `-Profile NAME` to `voice-local.ps1`. An app/Cognito sign-in is separate from this AWS service access.

The relay template already includes the public Cognito issuer/client ID, DynamoDB table, region and selected model IDs. They are configuration references, not account credentials. Do not create replacement foundation resources. The existing foundation remains managed by CloudFormation.

AWS CLI sign-in/cache/configuration live outside the repository and are not made by this setup command. The local refresher creates short-lived runtime credentials in ignored `artifacts/voice-runtime`; these are generated automatically, not copied from Madushan or entered into another `.env`. Compose controls its credential-process paths and temporary-credential environment settings. No hand-written `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` or `AWS_SESSION_TOKEN` is required for this local workflow.

The credential reader's `VOICE_LOCAL_AWS_CREDENTIALS_FILE` override exists for isolated tests; normal startup uses the managed container path and needs no member setting. System variables such as `PATH`, `LOCALAPPDATA` and `NODE_ENV` are supplied by the operating system or tooling, not project secrets.

## Run the app

For screen development without live voice:

```sh
npm run web
```

Open http://localhost:8081. Once the server key and authorized AWS profile are available, start Docker Desktop and run in PowerShell:

```powershell
aws login --profile mindguard
.\scripts\voice-local.ps1 -Action Up
```

Open http://localhost:8080/voice, create/confirm a voice account or sign in, allow server-side voice processing, and start the conversation. Docker's approved policy mount/flag override the conservative host defaults in the relay example. After changing the relay key/settings, rerun `Up` to recreate the local service. The helper runs on Windows; a macOS/Linux host needs a corresponding credential-refresh launcher before claiming this startup path is supported there.

For local frontend edits, keep the relay running and use `npm run web` on port 8081. Reload the frontend after changing public variables; rebuild an installed native binary to change its bundled endpoint. For Android, start the local emulator and forward port 3001 as described in `VOICE-LOCAL.md` and `ANDROID-SETUP.md`. The emulator/device's `localhost` is its own loopback; your teammates cannot access Madushan's laptop by opening `localhost` on theirs.

To stop Docker and its temporary credential refresh:

```powershell
.\scripts\voice-local.ps1 -Action Down
```

## Optional verification settings

Edit the root `.env` only if using the verification/Android overrides. Examples:

```sh
node --env-file=.env scripts/verify-live-voice.cjs
node --env-file=.env scripts/verify-voice-exceptions.cjs
node --env-file=.env scripts/verify-wellness.cjs
node --env-file=.env scripts/android.mjs
```

Live verification additionally needs the dedicated generated test account and audio fixtures described in `VOICE-LOCAL.md`; copying environment files does not create them. Running the normal app does not require those test fixtures. Browser paths, JDK/SDK paths and emulator serials are machine-specific; optional examples are commented out so they do not override working defaults.

Zain's wellness and Munsif's security prototypes currently have no separate backend environment files or service keys. No unused wearable, SMS, sharing or database variables are invented for unimplemented services. Add a matching example and documentation when an agreed implementation introduces a new setting.

## References

- [Expo environment-variable loading and public values](https://docs.expo.dev/guides/environment-variables/)
- Existing local operation: `VOICE-LOCAL.md`
