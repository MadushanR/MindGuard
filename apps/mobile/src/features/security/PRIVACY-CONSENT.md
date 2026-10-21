# Screen 16: Privacy and Consent

`/privacy` is a thin wrapper for `screens/PrivacyConsentScreen.tsx`. Copy is editable in `packages/fixtures/security/privacy.json`. Shared Page, Toggle, MenuRow, Notice, theme and web-only responsive helpers match the AI and security screens. Back and Resources remain provided by AppShell.

All toggles are drafts until **Save preferences**. Leaving discards unsaved edits; returning reloads current permissions. Voice, tone and chat observations use the AI feature's public `useAI().consent` and `setConsent` APIs. No AI files are changed. Enabling tone requires voice; disabling voice clears draft tone, and saving applies voice before tone. These choices affect existing AI simulations; no microphone or external service is enabled.

The four additional choices are explicitly labelled **local demo preferences**. Only wellnessData, saveSummaries, sharing and contactNotifications are stored under `mindguard.synthetic.privacy-preferences.v1`, as `{version:1, preferences:{...boolean fields}}`. Missing storage starts all four off. Existing malformed/unreadable storage is preserved, editing is blocked, and Retry loading is available. They do not enforce gates in existing wellness/sharing/contact-alert demos. There is no summary generator; saveSummaries never enables conversation history or transcripts.

Saving writes demo choices first, then calls the existing AI consent API, which uses its own storage queue. A failed demo write leaves AI consent unchanged; a failed AI write leaves permissions applied for the session and displays an explicit retry message. These two stores are not a transaction. Press Save preferences again to retry. No existing conversations, observations, contacts, memories, sharing records or retention settings are deleted or reset. The existing AI developer-reset action does not clear these four separately stored choices.

Links use route(2), route(17) and route(23). Screen 17 remains a placeholder. No contracts, dependencies, shared navigation, root providers, or other features need changing.

Verification: run `npm run check`, then `npm run web` and open `/privacy`. Test mobile widths (320–430px), desktop widths (900–1440px), larger text from Explore, keyboard Tab/Space activation, voice/tone dependencies, saving and reload, leaving without saving, all three links, Back and Resources. Changes must not take effect before Save; existing saved records must survive. No new dialog is required by this screen; the shared Explore dialog should retain its keyboard behaviour.

When the local Android toolchain is available, run the repository's `npm run android`, open Screen 16 from Explore, and repeat the toggle, save/relaunch, navigation, scrolling and larger-font checks. Native Android and iOS require separate device/emulator verification.
