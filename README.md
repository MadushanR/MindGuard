# MindGuard

MindGuard is a wellness application for everyday reflection, understanding emotional patterns, and finding small steps toward better wellbeing. Its conversational companion, **Zen**, provides a space to talk through thoughts and feelings, with controls over what is remembered and saved.

The project brings together conversations, wellness insights, and privacy controls in a shared mobile and web experience. It is a non-clinical academic prototype.

## Features

- **Conversations with Zen:** continuous live voice through the local relay, temporary text continuation, and the existing simulated text-chat experience.
- **Personalized recommendations:** illustrative videos and guides associated with recent emotion observations.
- **Emotion feedback:** optional, uncertain estimates that can be confirmed, corrected, or dismissed.
- **Conversation history:** optional local saving, conversation reopening, and individual or bulk deletion.
- **Temporary conversations:** sessions that stay in memory and clear when leaving the conversation screens.
- **Remembered details:** explicitly entered information that can be reviewed and removed.
- **Privacy preferences:** separate consent controls and configurable retention for prototype history; live voice transcripts are not saved.
- **Responsive presentation:** a desktop browser workspace and mobile layouts for smaller screens and Android.

## Current status

The FA3 voice increment connects real microphone capture, Cognito authentication, DynamoDB voice consent and OpenAI Realtime through a NestJS relay. The relay validates completed transcripts, applies the approved deterministic policy, and checks buffered output before playback. See [local voice setup](docs/VOICE-LOCAL.md), [implementation scope](docs/VOICE-INCREMENT.md), and [recorded verification and limits](docs/VOICE-VERIFICATION.md). EKS migration is deferred to April 2027.

Text chat, observations, recommendations and wearable measurements retain their labelled simulations. Munsif's account screens now share the existing Cognito identity with voice; security consent, contacts, explicit fictional saved categories, controlled in-app sharing and recipient-opted-in alerts use the existing DynamoDB foundation. Zain's UC-10 workflow is connected end to end, including exact destination previews, status reconciliation and revocation. Account deletion is explicitly disabled pending the owner's IAM decision; selected saved categories can be deleted. Export remains a local preview. See [security integration](docs/SECURITY-INCREMENT.md) and its verification limits. Resources keep their existing confirmed external-app behavior; no contact is automatic.

AI simulation history stays in account-scoped local AsyncStorage after sign-in; legacy synthetic stores remain separate and preserved. Security contacts, consents, saved categories and sharing/alert records use AWS. History and tone feedback start off; enabling AI history requires choosing retention. Local storage is unencrypted, so use invented information for this capstone. Automatic local-history expiry runs while the application operates. Live tokens, audio and transcripts stay out of application storage; voice processing uses OpenAI under the on-screen disclosure.

## Technology

- React Native and TypeScript
- Expo development builds and Expo Router
- React Native Web for browser support
- Native StyleSheet components and Context/reducers
- AsyncStorage for local persistence
- JSON fixtures with schemas and validation
- Jest and React Native Testing Library

## Getting started

After cloning or pulling the merged app, run `npm run setup:env` to create the local environment files without overwriting existing settings. All current templates, the values Madushan must supply privately, and AWS login requirements are explained in [team environment setup](docs/ENVIRONMENT-SETUP.md).

For the complete live voice product, start Docker Desktop with Linux containers, then run:

```powershell
aws login --profile mindguard
.\scripts\voice-local.ps1 -Action Up
```

Open **http://localhost:8080/voice**. Local credentials and the approved policy must be configured as described in [local voice setup](docs/VOICE-LOCAL.md).

For frontend development:

Use Node.js 24 and npm. From the repository root:

```sh
npm ci
npm run web
```

Open **http://localhost:8081**. In development, **Explore** opens the screen and demo-scenario picker. Loading a scenario asks for confirmation before replacing local demo records; ordinary reloads preserve saved history.

To build and run Android with a configured SDK, JDK 17, and a running emulator:

```sh
npm run android
```

If the browser development server is already running, use a second terminal:

```sh
node scripts/android.mjs --no-bundler
```

See [Android setup](docs/ANDROID-SETUP.md) for native toolchain requirements.

Live native voice requires a custom native build because it includes a raw-audio module. Android verification uses the Android Studio emulator. Native iOS has not been built, installed or tested; the available environment has no Mac or paid Apple Developer membership. Expo Go and browser previews do not establish native iOS functionality.

Run the following repository commands from the root; use `cd ../..` to return there from `apps/mobile`.

## Repository structure

```text
apps/mobile/          Expo application, routes, feature modules, and shared UI
apps/voice-relay/     NestJS relay, provider adapter, consent and safety configuration
packages/contracts/  Shared TypeScript models and interfaces
packages/fixtures/   Editable simulation data, schemas, and validation
packages/voice-core/ Voice session lifecycle and deterministic processing policy
docs/                Design, setup, and development documentation
scripts/             Local build and verification tools
```

## Development and verification

```sh
npm run check
npm run export:web -w @mindguard/mobile
```

The checks cover fixture validation, TypeScript, lint, and tests. The export command generates the browser bundle.

Simulation content can be changed independently of screen code. See the [JSON editing guide](docs/JSON-EDITING.md) for replies, transcripts, resources, sample records, and scenarios.

Additional references:

- [Design guide](docs/design/DESIGN-GUIDE.md)
- [Verification details and limitations](docs/VERIFICATION.md)

## License

See [LICENSE](LICENSE) for the project license.
