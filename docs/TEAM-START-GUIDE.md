# MindGuard: clone, run, and develop with an AI assistant

This is the team's single starting guide. Each member works in their own clone and feature branch, inside the existing application.

## 1. Get access and install the basics

- Make sure your GitHub account can access `MadushanR/MindGuard` and push branches. If you cannot, ask Madushan for collaborator access.
- Install Git and Node.js **24**, the version specified for this project. Node includes npm.
- Have an editor and an AI coding assistant that can read the local repository. Open the entire `MindGuard` folder so the assistant can see the app, contracts, fixtures, and documentation together.
- Android Studio and JDK 17 are required for native Android testing. You can start browser development before completing Android setup.

Check your terminal:

```powershell
git --version
node --version
npm --version
```

Use PowerShell on Windows. Run subsequent commands from the repository root, where the root `package.json` lives.

## 2. Clone the current frontend and create your own branch

**Branch status checked on October 19, 2026:** the initial frontend and responsive desktop web changes are merged into `main`. Start new feature branches from `main`.

In your chosen projects directory:

```powershell
git clone https://github.com/MadushanR/MindGuard.git
cd MindGuard
```

Then run **one** command for your role:

```powershell
# Zain
git switch -c feat/zain-wellness
```

```powershell
# Munsif
git switch -c feat/munsif-security
```

```powershell
# Madushan
git switch -c feat/madushan-conversations
```

## 3. Install and run the browser app

```powershell
npm ci
npm run web
```

Open **http://localhost:8081**. Keep the terminal running. Press **Ctrl+C** when you want to stop it. If port 8081 is already occupied, check whether you already have the app running in another terminal.

The app starts on Welcome. Click **Explore** in the header to open any of the 24 screens. Zain's and Munsif's screens currently show labeled placeholders; replacing these is their development task. Account buttons do not perform real authentication.

Browser layouts expand at 900 pixels to show a sidebar. Collection screens use two columns from 1100 pixels. Narrow browser windows and Android keep mobile presentation.

## 4. Know which files you own

- **Zain — `apps/mobile/src/features/wellness/`:** 05 Home; 09 Wellness Dashboard and Trends; 10 Wellness Data Sources; 11 Wellness and Crisis Resources; 13 Export and Share Preview; 18 Settings and Account; 19 Connect Smartwatch; 20 Add Recipient.
- **Munsif — `apps/mobile/src/features/security/`:** 02 Create Account; 03 Sign In; 04 Account Recovery; 12 Trusted Contacts; 14 Shared Information; 15 Contact Alert Review; 16 Privacy and Consent; 17 Saved Information and Deletion.
- **Madushan — `apps/mobile/src/features/ai/`:** 01 Welcome; 06 Text Chat; 07 Voice Conversation; 08 Voice Tone Settings; 21 Personalized Recommendations; 22 Conversation History; 23 Conversation Preferences and Auto-delete; 24 Remembered Details.

Shared locations:

- `apps/mobile/src/app/`: existing Expo Router route wrappers. Keep these thin; put screen implementation in your feature folder.
- `apps/mobile/src/shared/`: existing controls, icons, dialogs, theme, responsive helpers, and navigation.
- `packages/contracts/src/index.ts`: common types and team interfaces.
- `packages/fixtures/`: editable JSON simulations and validation.
- `docs/design/`: agreed design guide and tokens.

Do not create another React/Expo application, another dependency lockfile, or a separate navigation system for your pages.

## 5. Give your AI this starter prompt

Copy the following into your AI assistant after opening the repository. Fill in the bracketed fields before sending it. Start with one screen so you can review the pattern before expanding to the rest.

```text
We are working in the existing MindGuard repository.
My name is [Zain / Munsif / Madushan].
My feature folder is apps/mobile/src/features/[wellness / security / ai].
The first screen to implement is [screen number and title].
My screen-specific requirements and design reference are: [paste them here].

First inspect the repository, applicable AGENTS.md instructions, README.md,
docs/TEAM-START-GUIDE.md, docs/TEAM-INTEGRATION.md, docs/JSON-EDITING.md,
docs/design/DESIGN-GUIDE.md, docs/design/tokens.json, package.json,
packages/contracts/src/index.ts, and the existing route for my screen.

Before editing, explain what already exists, identify my placeholder,
and ask about any missing requirements that materially affect the screen.
Do not invent product requirements or replace the established stack.

Use the existing React Native + TypeScript + Expo development-build app,
Expo Router, native StyleSheet, Context/reducers, AsyncStorage, Jest,
and React Native Testing Library. Use installed compatible versions.
Reuse shared controls, icons, colors, dialogs, responsive helpers,
and route(screenId). Do not generate another app or install a UI framework.

Implement my screen in my feature folder and keep its route a thin wrapper.
Keep other members' screens intact. Coordinate any necessary changes to
shared navigation, contracts, dependencies, consent, or deletion behavior.
Use public exports when consuming another feature's functionality.

This phase is frontend only. Use editable JSON for mock content and
simulated outputs. Keep state transitions, navigation, consent, and
deletion rules in TypeScript. Do not add real authentication, backend
services, AI calls, wearable connections, sharing, or microphone access.

Preserve the Android layout while adapting browser layouts using the
existing web-only responsive helpers. Use only synthetic demo records.
Do not reset saved data without explaining the action and obtaining consent.

After implementation, run npm run check and verify my screen in the browser
at mobile and desktop widths. Check dialogs, keyboard access, navigation,
and larger text. Verify Android when its local toolchain is available;
otherwise explicitly report that Android was not tested.
Report changed files, test results, and remaining limitations.
Do not commit, push, merge, or change unrelated files unless I ask.
```

Supply the actual screen requirements or mockup alongside this prompt. A placeholder and a screen title alone do not specify all interactions.

## 6. Replace your placeholder without changing other modules

For example, Zain can add:

```text
apps/mobile/src/features/wellness/screens/HomeScreen.tsx
```

Then replace the placeholder wrapper in `apps/mobile/src/app/home.tsx` with:

```tsx
export { HomeScreen as default } from "../features/wellness/screens/HomeScreen";
```

Munsif follows the same pattern under `features/security/screens/`, using the existing route for the relevant screen. The full route-to-screen mapping is in `apps/mobile/src/shared/navigation.ts`.

Use `Page` for normal scrolling screens, `Page wide` for collections, and `ResponsiveGrid` for desktop card layouts. `useBrowserLayout` guards desktop presentation by platform; do not use screen width alone to redesign Android. The shared shell already supplies the header and navigation.

For cross-module data, use the AI module's public exports:

- **Zain's Trends screen:** `useAI().observations`, `confirmObservation`, `correctObservation`, and `dismissObservation`. `ObservationCard`, `weeklyPattern`, and `effectiveEmotion` are also exported.
- **Munsif's consent screen:** `useAI().consent` and `setConsent`. Disabling voice disables tone; tone requires voice permission.
- **Conversation deletion integration:** `deleteConversations(ids, deleteLinkedObservations, deleteLinkedMemories)`. This is conversation deletion, not a complete account-deletion implementation.

Ask the AI to inspect the current exported signatures before integrating them. Avoid reaching into another member's private reducer or screen implementation.

## 7. Keep mock data editable

The existing conversation simulations use `chat.json`, `voice.json`, `recommendations.json`, `conversations.json`, `emotions.json`, `remembered-details.json`, `scenarios.json`, and `screen-copy.json` in `packages/fixtures/`.

For new wellness/security mocks, keep your data in a feature-specific subfolder, such as `packages/fixtures/wellness/` or `packages/fixtures/security/`, and coordinate its exported types and validation. These subfolders are a convention for new work, not prebuilt providers. The current validator does not automatically discover and validate arbitrary new files.

```powershell
npm run validate:fixtures
```

After editing fixtures, reload the app. **Explore → scenario → Load scenario** explicitly replaces local demo records after confirmation. Ordinary reloads preserve saved records. Do not silently reseed saved data on launch.

## 8. Run Android on your own PC

The local Java toolchain and generated Android build from Madushan's PC are ignored by Git and will not arrive in your clone.

1. Install Android Studio and JDK 17. Follow `docs/ANDROID-SETUP.md` for SDK, emulator, CMake/NDK, and Windows Ninja setup.
2. Set `JAVA_HOME` and `ANDROID_HOME`, or create an ignored `android.local.json` in the repository root with your actual paths:

```json
{
  "javaHome": "C:/replace-with-your-jdk-17-folder",
  "androidHome": "C:/replace-with-your-Android-Sdk-folder"
}
```

3. Start an emulator in **Android Studio → Device Manager** and wait for Android to boot.
4. If the web server from step 3 of this guide is still running, open another terminal at the repository root and run:

```powershell
node scripts/android.mjs --no-bundler
```

If no development server is running, use:

```powershell
npm run android
```

The first native build downloads dependencies and can take longer. This project uses an Expo **development build**. Use that build for testing. Source/fixture edits normally reload through the development server; native dependency or app-configuration changes can require rebuilding.

Browser and Android save their local records separately. Voice remains simulated. iOS device validation is deferred.

## 9. Preview on an iPhone with Expo Go

Expo Go offers a free preview path from Windows to a physical iPhone without building your own iOS binary. The current dependencies appear compatible with Expo Go, but iPhone testing has not yet been completed. The installed Expo Go must support this project's SDK 58.

Install Expo Go on the iPhone, connect it and your computer to the same Wi-Fi, and stop the existing development server with Ctrl+C. From the repository root:

```powershell
cd apps/mobile
npx expo login
npx expo start --go --lan
```

Sign into Expo Go with the same Expo account used by the CLI, then scan the terminal's QR code with the iPhone camera. The `--go` flag selects Expo Go explicitly; the normal `npm run start` command targets the custom development build.

If LAN connectivity fails, stop that server and try `npx expo start --go --tunnel`. For future custom native modules or native configuration testing, use an iOS development build instead. Local iOS compilation requires a Mac; cloud device distribution requires separate signing setup.

References: [Expo device instructions](https://docs.expo.dev/get-started/start-developing/) and [Expo CLI launch targets](https://docs.expo.dev/more/expo-cli/#launch-target).

Return to the repository root with `cd ../..` before running the checks below.

## 10. Check and submit your work

From the repository root:

```powershell
npm run check
```

This runs fixture validation, TypeScript checks, lint, and the existing tests. Also manually check your pages at narrow and wide browser widths, with larger text, and on Android when available. State what was actually tested in your PR.

Review the changes before committing:

```powershell
git status
git diff
```

Stage the specific feature files, route wrappers, and any agreed fixture/test changes. Do not stage unrelated editor configuration, local paths, credentials, `node_modules`, generated native folders, or screenshots from `artifacts`.

```powershell
git add <your-specific-file-or-folder-paths>
git commit -m "feat: implement your screen name"
git push -u origin HEAD
```

Replace the angle-bracket placeholder with actual paths; it is not a command to paste unchanged. If Git requests an author identity, configure your own name/email locally in this clone. Do not use another member's identity.

Open the PR link shown by GitHub after the push and target `main`. Do not merge or force-push another member's branch.

Include the screens implemented, screenshots where helpful, checks that passed, and any untested platform or known limitation. Have the AI explain conflicts involving shared files instead of accepting a replacement of the entire file.

## Daily workflow

Open your clone, check `git status`, and start `npm run web`. Give the AI one screen or behavior to implement with its requirements. Review the result, run checks, and commit on your own branch. When the team's integration branch changes, save your work first, fetch the latest changes, and review the merge with your AI assistant. Run `npm ci` if the lockfile changes.
