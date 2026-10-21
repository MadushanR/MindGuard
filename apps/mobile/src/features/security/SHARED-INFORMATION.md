# Shared Information (Screen 14)

`SharedInformationProvider` is mounted at the app root. Its public
`useSharedInformation` hook exports `records`, `recordShare`, `revokeShare`, and
`clearShareSession`. The immutable snapshot model contains an ID, recipient name,
confirmation time, and the exact confirmed content strings. It excludes recipient
email, raw conversations/audio, source records, and permissions. No AsyncStorage,
account identity, backend, or real sharing/revocation service is connected.

Screen 13 calls `recordShare` only after **Confirm simulated action** for a selected
recipient. Opening/cancelling preview, invalid or unavailable content, adding a
recipient, and export-only confirmation do not create history. A guard prevents
repeat handling of the same confirmation. A later explicit confirmation is a new
share. Existing wellness data gates and exclusion rules remain intact.

Screen 14 reviews snapshots, even after selections or recipients change. **Revoke
access** opens confirmation; Cancel preserves the record. Confirm removes only
that record, then returns keyboard focus to **Share information**. This models
demo access revocation only; it cannot recall copies or change real access. Source
wellness data, saved AI information, and persistent trusted contacts are unaffected.

History survives navigation during the current app runtime. It clears on reload
or after confirmation of Settings' wellness reset, leave-demo action, or Explore's
demo reset. Those dialogs describe this consequence. Loading an AI scenario does
not silently clear share history. Nothing new is persisted and existing storage
keys are untouched. No recipient is silently converted into a trusted contact.

`packages/fixtures/security/shared-information.json` holds editable copy.
`shared-information-records.json` holds synthetic examples for tests/previews only;
they are never seeded automatically. Security tests validate and use those files;
the existing fixture CLI continues to validate its AI/wellness bundles.
