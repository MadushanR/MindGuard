# Team frontend integration

The application is one Expo/React Native app. Clone this repository and run `npm ci` at its root. Commit the root `package-lock.json` whenever agreed dependencies change; do not create another app or lockfile for your pages.

## Ownership

- **Madushan — `features/ai`:** 01 Welcome, 06 Text Chat, 07 Voice Conversation, 08 Voice Tone Settings, 21 Personalized Recommendations, 22 Conversation History, 23 Conversation Preferences and Auto-delete, 24 Remembered Details.
- **Zain — `features/wellness`:** 05 Home, 09 Wellness Dashboard and Trends, 10 Wellness Data Sources, 11 Wellness and Crisis Resources, 13 Export and Share Preview, 18 Settings and Account, 19 Connect Smartwatch, 20 Add Recipient.
- **Munsif — `features/security`:** 02 Create Account, 03 Sign In, 04 Account Recovery, 12 Trusted Contacts, 14 Shared Information, 15 Contact Alert Review, 16 Privacy and Consent, 17 Saved Information and Deletion.

## Add your page

The feature folders live under `apps/mobile/src`. Every destination already has a route wrapper in `src/app`. Implement feature screens under your own module and replace its wrapper's placeholder export with your screen export. The module-level placeholder dispatcher is only a scaffold; replace it with individual screen exports as your pages arrive.

Keep route files small. Put local components, hooks, and tests inside the feature module. Keep non-route files outside `src/app`. Avoid importing another feature's screen or private reducer directly.

Use `shared/Page`, `shared/ui`, `shared/theme`, and `shared/navigation`. The native theme consumes `docs/design/tokens.json`; the accompanying design guide explains the original browser reference. Numeric typography weights map to native-supported weights, and the Zen orb uses native Animated views. Shared icons were ported from the supplied 26 SVG assets; their reference originals remain in the repository.

Navigation uses `route(screenId)` with the existing 01–24 identifiers. The shell handles headers, Resources/Settings actions, Home / For you / Trends navigation, and temporary-session cleanup. Signed-out screens and focused voice omit bottom navigation. Shared layouts do not implement authentication guards yet.

## Consume conversation data

`@mindguard/contracts` exports the common types, `ObservationPort`, and `ConsentPort`. The AI module's public `useAI` hook exposes the state/actions needed by teammates:

```tsx
import { useAI, ObservationCard } from '../ai';

function ObservationList() {
  const { observations } = useAI();
  return observations
    .filter(observation => !observation.dismissed)
    .map(observation => (
      <ObservationCard key={observation.id} observation={observation} />
    ));
}
```

- **Zain:** use `observations`, `confirmObservation(id)`, `correctObservation(id, label)`, and `dismissObservation(id)`. `effectiveEmotion` and `weeklyPattern` are exported selectors. Predictions remain separate from corrections. Recommendations derive from this same data.
- **Munsif:** use `consent` and `setConsent(key, allowed)` for `voice`, `tone`, and `chatObservations`. Disabling voice also disables tone and stops the active simulation. Tone cannot be enabled without voice consent. These are local demo choices, not authenticated server consent records.
- **Settings:** link to the registered history, preferences, memory, and tone routes. `savePreferences` can update larger text or reduced motion while preserving other fields.

Use the deletion action when integrating broader deletion flows: `deleteConversations(ids, deleteLinkedObservations, deleteLinkedMemories)`. Call `leave` when ending the conversation journey. The existing full local reset is explicitly a developer-only demo reset; future account-scoped sign-out/deletion must be integrated deliberately when real authentication arrives.

`TextProvider` and `VoiceProvider` isolate JSON simulation outputs. Future integrations replace provider implementations rather than adding service calls to screen components. The current storage namespace is one synthetic local profile, with no account segregation or server synchronization.

## Coordinate shared changes

Feature branches should primarily change their owner folder and route wrappers. Coordinate changes to root dependencies, contracts, theme, shell, consent, and deletion behavior with the other owners. Add fixtures under your own package subfolder when new teammate simulations are required; do not alter another owner's JSON IDs casually.

Use Expo-compatible dependency installation from the repository root:

```sh
npm exec -w @mindguard/mobile -- expo install PACKAGE_NAME
```

Run `npm run check` before combining changes. Use the development Explore picker to inspect all destinations and fixture scenarios. Placeholder pages intentionally perform no account, watch, security, or sharing operations.
