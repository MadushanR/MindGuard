# Trusted Contacts integration

Screen 12 reads the `RecipientsProvider` mounted alongside `WellnessProvider` in
the root layout. Zain's Screen 20 uses the public security API when opened from
Trusted Contacts with `origin=trusted-contacts`:

```tsx
import { useRecipients, type RecipientInput } from "../../security";

// Inside Screen 20's trusted-contact flow:
const { ready, saving, readError, addRecipient } = useRecipients();
// On submission, validate the form and await addRecipient(draft) in try/catch.
// Navigate to route(12) only after the promise resolves. If it rejects, keep the
// draft on the form and show the error so the user can retry.
```

`RecipientInput` has `name` and `relationship`. Both are nonempty strings; free-text
relationships match Screen 20's existing form. Earlier fixture values `friend`,
`family`, and `care-professional` still display their original labels. Other
relationship text displays as entered. The provider trims both fields, validates inputs,
generates stable IDs, and serializes writes. `addRecipient` resolves with the saved
`TrustedRecipient`; it rejects when storage is not ready or saving fails. Disable
the form submit while `!ready`, `readError`, or `saving`. Do not retry a failed
save automatically. Existing contacts remain unchanged when a write fails.

The provider uses `mindguard.synthetic.recipients.v1`, containing
`{ version: 1, recipients: [{ id, name, relationship }] }`. It stores only these
fields, and does not write on startup. It preserves unreadable/unsupported data
and exposes `restoreRecipients()` for a read retry. It does not touch the AI
storage key, create an account identity, enable consent, invite anyone, or share.
Use synthetic names only; storage is the existing unencrypted local prototype.

This screen has no removal/reset UI. Existing AI demo reset/scenario loading
also clears the wellness session, but does not clear persistent contacts. Future Screen 17
or whole-profile deletion must explicitly coordinate recipient deletion and its
confirmation; do not implement it by clearing all AsyncStorage. No deletion or
retention rules have changed in this implementation.

Editable display copy is in `packages/fixtures/security/trusted-contacts.json`.
`trusted-recipients.json` contains synthetic preview/test records for the three
relationships. They are never seeded into saved data automatically. These new
files are covered by security tests; the existing fixture CLI covers AI and
wellness bundles and does not discover arbitrary security fixtures.

Screen 14 remains a navigation destination only. The Trusted Contacts entry path
to Screen 20 collects and persists only name and relationship. Screen 20's Share
and Settings paths still collect name, email, and relationship for session-only
sharing recipients, with duplicate-email validation and automatic destination
selection when opened from Share. Those recipients are not automatically copied
into Trusted Contacts, and persistent contacts are not automatically made sharing
destinations. Neither flow grants sharing permissions, invitations, check-in
eligibility, or notifications. A failed trusted-contact save preserves the draft
on Screen 20 for an explicit retry. Cancel does not add a contact. No saved records
are migrated or reset during integration.
