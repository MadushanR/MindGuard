# MindGuard

MindGuard is a wellness application for everyday reflection, understanding emotional patterns, and finding small steps toward better wellbeing. Its conversational companion, **Zen**, provides a space to talk through thoughts and feelings, with controls over what is remembered and saved.

The project brings together conversations, wellness insights, and privacy controls in a shared mobile and web experience. It is a non-clinical academic prototype.

## Features

- **Conversations with Zen:** text chat and a simulated voice conversation interface.
- **Personalized recommendations:** illustrative videos and guides associated with recent emotion observations.
- **Emotion feedback:** optional, uncertain estimates that can be confirmed, corrected, or dismissed.
- **Conversation history:** optional local saving, conversation reopening, and individual or bulk deletion.
- **Temporary conversations:** sessions that stay in memory and clear when leaving the conversation screens.
- **Remembered details:** explicitly entered information that can be reviewed and removed.
- **Privacy preferences:** separate consent controls, optional voice transcripts, and configurable retention.
- **Responsive presentation:** a desktop browser workspace and mobile layouts for smaller screens and Android.

## Current status

The repository currently contains a frontend prototype powered by editable JSON simulations. Conversation replies, voice states, observations, recommendations, and sample records use synthetic data. Voice does not capture audio or request microphone access.

Zain's eight wellness screens are implemented, including session-only simulated wearable records, recipient validation, explicitly confirmed sharing previews, and bundled Canadian support resources. Account access and trusted-contact/security destinations remain placeholders. Live AI, backend authentication, wearable integrations, and real sharing are not connected. Resources can open external websites and, after confirmation, the phone or messaging app; nothing is contacted automatically. See [wellness review instructions](apps/mobile/src/features/wellness/README.md).

Saved information stays on the local device using AsyncStorage. History, voice transcripts, and tone feedback start off; enabling history requires choosing a retention option. Storage is unencrypted, so use invented information when exploring the prototype. Automatic expiry runs while the application operates, including on launch and return to the foreground.

## Technology

- React Native and TypeScript
- Expo development builds and Expo Router
- React Native Web for browser support
- Native StyleSheet components and Context/reducers
- AsyncStorage for local persistence
- JSON fixtures with schemas and validation
- Jest and React Native Testing Library

## Getting started

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

For an iPhone preview using Expo Go, install a version supporting SDK 58, connect the phone and computer to the same Wi-Fi, and run:

```sh
cd apps/mobile
npx expo login
npx expo start --go --lan
```

Sign into Expo Go with the same Expo account and scan the QR code. Current dependencies appear compatible, but iPhone testing and native iOS build validation are still pending. See [Expo's device instructions](https://docs.expo.dev/get-started/start-developing/).

Run the following repository commands from the root; use `cd ../..` to return there from `apps/mobile`.

## Repository structure

```text
apps/mobile/          Expo application, routes, feature modules, and shared UI
packages/contracts/  Shared TypeScript models and interfaces
packages/fixtures/   Editable simulation data, schemas, and validation
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
