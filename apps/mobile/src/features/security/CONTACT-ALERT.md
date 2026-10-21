# Contact Alert Review (Screen 15)

This screen is a standalone frontend simulation. Its recipient list, enabled flags,
default message, privacy/permission notices, and success copy come from
`packages/fixtures/security/contact-alert.json`. The default recipient and a second
fictional recipient have alerts enabled; a third exercises the disabled notice.
These flags are demo inputs, not saved consent or real notification permissions.
No persistent trusted contacts or sharing recipients are automatically eligible.

The field-style recipient dropdown button opens the existing accessible Dialog
with shared MenuRow choices, avoiding a new native dependency. It supports keyboard
activation, focus containment/return, cancellation, and larger text. Native Android
and iOS layouts stay mobile; only web enters the existing desktop layout.

The reducer validates the selected fixture recipient, alerts-enabled flag, and
nonblank message before review. Review captures the exact name/message snapshot.
Send is accepted only from that review state, rechecks eligibility, and rejects a
stale snapshot. Draft edits invalidate review/success; repeated Send actions do
nothing. Cancelling review returns to the unchanged draft. The screen's Cancel
returns to the previous route, falling back to Screen 12 on direct entry. Leaving
the screen clears local alert state.

“Review sent” is accompanied by an explicit simulation-only explanation. No message
is delivered, no external app is opened, and no notification, email, SMS, AI call,
storage write, sharing-history record, permission change, or deletion occurs.
No new providers, shared contracts, dependencies, or storage keys are introduced.

Security tests validate this fixture and the gated transitions. The general fixture
CLI continues to cover its existing AI/wellness bundles. Exact screenshot matching
cannot be verified until a reference image is supplied; the established app theme
is used.
