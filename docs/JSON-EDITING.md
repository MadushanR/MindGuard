# Editing MindGuard's JSON simulations

All fixture files live in `packages/fixtures`. Layouts and privacy rules remain in TypeScript. The JSON files contain content and permitted simulation inputs, not executable code.

## Change a chat reply

Open `chat.json`. Find `scripts` → the script with `id: "normal"` → `replies`. Change the first reply's `text`, `delayMs`, and optional `observation`:

```json
{
  "text": "Would it help to choose one small thing for today?",
  "delayMs": 1200,
  "observation": { "label": "Hopeful", "confidence": 0.58 }
}
```

Replies are consumed in order. After the list is exhausted, `fallback` is used repeatedly. There is no keyword matching. `failOnce: true` makes that reply fail once per conversation/sequence position; Retry returns its text without adding a duplicate user message. `introduction` and `suggestedPrompts` control the initial chat content.

Edit the selected script, or explicitly load a scenario using that script. **Explore → Normal** resets the reply sequence by starting fresh. A new chat also starts at the first reply.

## Change voice output and timing

Open `voice.json`. Each script has ordered `steps`. Durations are milliseconds:

```json
{
  "state": "speaking",
  "durationMs": 3500,
  "transcript": {
    "user": "I would like a quiet moment.",
    "assistant": "We can take a small pause together."
  },
  "observation": { "label": "Calm", "confidence": 0.61 }
}
```

Begin with `listening`, then `processing`, then `speaking`. Speaking can return to listening; the final speaking step loops to the first listening step. Active states need a positive duration up to 60000 ms. Use `reconnecting`, `error`, or `stopped` to pause automatic progression. Reconnect resumes after a reconnecting step; retry after an error restarts the script. End a script with speaking, error, or stopped.

Transcripts and observations belong on speaking steps and are applied only after that step completes. An interrupted or stopped turn is not committed. Tone estimates require separate voice and tone consent, and are suppressed for temporary conversations. A transcript appears in the active session but is persisted only when that conversation opted into transcript saving. No audio file exists.

`statusText` controls the visible labels. These simulations never access a microphone or play audio.

## Add a recommendation

Duplicate an entry in `recommendations.json` → `cards` and give it a unique `id`:

```json
{
  "id": "hopeful-guide-2",
  "emotion": "Hopeful",
  "format": "Guides",
  "title": "A small intention for today",
  "description": "Choose one manageable thing that matters to you.",
  "duration": "3 min read",
  "artwork": "sunrise",
  "detail": "This illustrative guide is coming soon."
}
```

Emotion values are `Calm`, `Tense`, `Low`, or `Hopeful`; `null` makes a general card for an empty week. Formats are `Videos` and `Guides`. Artwork choices are `meadow`, `leaves`, `dunes`, `steps`, `dusk`, and `sunrise`. Cards open local details, not external media.

Ranking uses observations in the current local Monday–Sunday week, excluding future and dismissed entries. Corrections replace the label used for ranking; ties use the most recent observation, then alphabetical order. Each observation counts once. Fixture `ageDays` values are converted to timestamps when a scenario loads; sufficiently old observations will not influence the current week.

## Create a scenario

1. Add or duplicate a chat/voice script with a unique ID.
2. Duplicate an entry in `scenarios.json` → `scenarios`.
3. Set a unique scenario `id`, `name`, and `description`, plus its `chatScriptId` and `voiceScriptId`.
4. Set `initialChatState` to `idle`, `processing`, or `error`. Processing/error previews use the first suggested prompt.
5. Reference sample record IDs through `conversationIds`, `observationIds`, and `memoryIds`.
6. Validate, reload, then use **Explore → scenario name → Load scenario**.

An example is `sample-history`. `expired-history` loads a ten-day-old record with a seven-day retention policy; the record and its linked information are immediately pruned. If a selected observation or memory links to a conversation, that conversation must also be selected.

`defaultScenarioId` selects the scripts for normal startup; it does not automatically load that scenario's sample records. `defaults` supplies initial preferences/consent only when no local data exists. Saved preferences take precedence on reload. Loading a scenario explicitly replaces local preferences and records after confirmation.

Fixtures cannot bypass consent, temporary-chat restrictions, valid voice transitions, or the requirement to select retention when enabling history.

## Other editable files

- `wellness/wearable.json`: labels, units, and exactly seven Monday–Sunday synthetic values for steps, sleep, and resting heart rate. Home, Trends, and Share read this same fixture. Schemas reject incomplete weeks, negative measurements, sleep over 24 hours, and values outside demo ranges.
- `wellness/resources.json`: Canadian support wording, region, source review date, bundled fallback instructions, and external actions. Keep phone/SMS/HTTPS destinations verified against official sources; never put scripts or arbitrary URL schemes in this file. Resource links are not activated by automated browser checks.

- `conversations.json`: titles, text/voice messages, IDs, and age in days.
- `emotions.json`: source, original estimate, confidence, status, optional corrected label, dismissal state, and age. A corrected label is required exactly when status is `Corrected`.
- `remembered-details.json`: explicitly chosen text, optional conversation links, and age.
- `screen-copy.json`: headings, explanatory text, empty states, error messages, and notices for the eight screens. Standard control labels remain in the shared native components.

## Validate and reload

```sh
npm run validate:fixtures
```

Each JSON file references its schema under `schemas`. Editors supporting JSON Schema offer completions and validation. The command checks required fields, allowed values, unique IDs, references, consent consistency, and voice transitions. Errors identify the file and field. JSON syntax errors also identify the source file; the Expo development error display will show syntax errors while bundling.

Use double quotes, no comments, and no trailing commas. Keep IDs stable when editing text. Change sample records by explicitly loading a scenario; restarting or editing JSON never silently replaces locally saved history. Resetting demo data leaves the JSON files intact.
