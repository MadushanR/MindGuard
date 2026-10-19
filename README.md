# MindGuard

React Native / TypeScript frontend for the MindGuard capstone. This delivery implements Madushan's eight screens, a shared native design system, editable JSON simulations, and placeholders for Zain and Munsif's screens.

## Run locally

Use Node.js 24 LTS and npm. From the repository root:

```sh
npm ci
npm run web
```

Open `http://localhost:8081`. Select **Explore** in the header to open any screen or load a JSON scenario. Explore is available only in development. Welcome remains the normal launch screen; authentication pages are team placeholders.

Web uses the available browser width. At 900 pixels and above, app screens show a desktop sidebar; recommendations, history, and remembered details use two columns from 1100 pixels. Android and iOS retain the mobile layout. Resizing the browser preserves the current conversation and draft.

```sh
npm run android
```

Android requires the tooling described in [Android setup](docs/ANDROID-SETUP.md). The runner supports a private `android.local.json` or environment variables, so machine paths never enter committed configuration.

## Edit simulated outputs

Edit the eight JSON files in [packages/fixtures](packages/fixtures). Change chat replies, voice transcripts and timings, resource cards, sample history, memories, observations, and screen text without editing screen code.

```sh
npm run validate:fixtures
```

Reload the app after editing. To replace saved sample records, choose **Explore → a scenario → Load scenario**. This action asks for confirmation and replaces local demo data. Ordinary reloads preserve opted-in saved history.

See the [JSON editing guide](docs/JSON-EDITING.md) for examples and the [team integration guide](docs/TEAM-INTEGRATION.md) for screen ownership and module boundaries.

The [verification notes](docs/VERIFICATION.md) record the browser and Android results, reproduction steps, and current limitations.

## Checks

```sh
npm run check
npm run export:web -w @mindguard/mobile
```

For browser verification, leave `npm run web` running, install a Playwright browser once with `npx playwright install chromium`, and run:

```sh
node scripts/verify-web.cjs
```

Alternatively set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to an existing compatible Chromium executable. Screenshots and the machine-readable report are written to the ignored `artifacts` directory.

## Prototype boundaries

Chat, voice, tone estimates, and recommendations are local simulations. There is no AI service, audio capture, account authentication, cloud deployment, watch integration, or actual sharing. The native app blocks microphone permission.

History, voice transcripts, and tone feedback start off. History requires an explicit retention choice. Temporary conversations never write history, observations, or memories. AsyncStorage is unencrypted; use invented scenario details only. iOS-compatible source is included; iOS build/device validation is deferred.
