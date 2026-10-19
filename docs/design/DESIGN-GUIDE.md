# MindGuard shared UI guide — v1.0

This is the common visual reference for Zain, Munsif, and Madushan. Values are taken from the existing browser UI, not a redesign. The current app is light mode only and uses local, in-memory interactions. The eventual React Native / Expo implementation is separate.

## Start here

1. Extract the entire ZIP and open `index.html` for the visual reference. No installation, server, external fonts, or internet connection is needed.
2. Read this guide before building a screen.
3. Use `tokens.json` for named color and dimension values. Use `tokens.css` for the common color variables.
4. For HTML screens, reuse the classes in `mindguard-ui.css`. This is a full snapshot of the app stylesheet, including global styles; load it once at app level, not into unrelated websites.
5. Use the supplied SVG icons and Zen orb markup. Do not replace them with a different icon family or avatar.

The live project’s `ui.css` is the source for browser presentation. This kit is a snapshot and will not automatically track later changes. Agree on shared changes together, update the live stylesheet, then regenerate/review the kit. Avoid creating separate palettes for IoT, security, and AI.

## Colors

| Role | CSS variable | Hex |
|---|---|---|
| App background / warm ivory | `--paper` | `#F8F7F2` |
| Card and field surface / warm white | `--card` | `#FFFEFA` |
| Main text / deep green | `--ink` | `#253F37` |
| Supporting text | `--muted` | `#63726A` |
| Primary action / dark teal | `--teal` | `#285E50` |
| Primary action hover | `--teal-dark` | `#1D4B40` |
| Sage surface | `--sage` | `#E7EDDF` |
| Subtle card borders and dividers | `--line` | `#E1E5DB` |
| Warm accent | `--clay` | `#9B553D` |
| Soft card background | `--soft-card` | `#EEF1E7` |
| Selected navigation background | `--nav-active` | `#E1E9D9` |
| Primary-button text | `--on-primary` | `#FFFFFF` |
| Field border | `--field-border` | `#B9C7B8` |
| Keyboard focus ring | `--focus` | `#A45F38` |

Error notice: text `#754631`, background `#FFF2E9`, border `#E6C4B1`. Inline form error: `#963E28`. Destructive button: text `#873E2F`, background `#FFF8F3`, border `#DCBCAF`.

Pair primary text with ivory/white surfaces and white text with teal buttons. Pale sage and chart colors are fills, not body-text colors. Subtle card borders are decorative; do not rely on those borders alone to identify an interactive field. Always accompany errors, connection status, and selected states with words, icons, or control state.

## Emotion colors

| Emotion | Chart fill | Label background | Label text |
|---|---|---|---|
| Calm | `#A0B48A` | `#E5EDDA` | `#4F6942` |
| Tense | `#D4AD90` | `#F0DFD0` | `#745037` |
| Low | `#AFB6CC` | `#E8EAF2` | `#555F7B` |
| Hopeful | `#D6C48C` | `#F2ECD7` | `#726132` |

Use these exact meanings across chat, voice feedback, Trends, and recommendations. Show the source and Estimated / Confirmed / Corrected status. Offer Confirm, Correct, and Dismiss where applicable. Do not describe an estimated emotion as a diagnosis or use color alone to identify it.

## Typography

System sans-serif only: `ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`. Do not download a custom font. Exact glyph shapes depend on the device’s system font.

| Use | Current reference size | Weight | Line height |
|---|---:|---:|---:|
| Page title | 29–32px; account title 31px | 500 | about 1.2 |
| General section heading (`.content h2`) | 29px | 550 | 1.18 |
| Card heading (`.content h3`) | 17px | 600 | 1.4 |
| Lead paragraph (`.lead`) | 15px | normal | 1.65 |
| Supporting body (`.muted`) | 13px | normal | 1.6 |
| Chat message | 14px | normal | 1.75 |
| Input value | 14px | normal | inherited |
| Button | 13px | 600 | 1.35 |
| Caption (`.tiny`) | 11px | normal | 1.6 |
| Eyebrow | 10px | 650 | inherited; 1.7px letter spacing |

These are existing component values, not a requirement to make every heading identical. Compact recommendation headings and chart labels have intentional overrides in the stylesheet. Browser fallback fonts may map 550/650 to available weights. For native implementation, agree on font-weight mapping once for the whole app.

Keep essential instructions in body-sized text. Existing chart and navigation annotations can be smaller; they should not become the default text size for new content. Preserve the Larger text setting, wrapping, and scrolling. Avoid fixed-height text containers.

## Spacing, shape, and layout

- Main screen horizontal inset: **26px**, reduced to **19px at widths ≤350px**.
- Standard card: **20px padding**, **24px corner radius**, 1px subtle border. Current vertical card margin is 17px.
- Standard button: **49px minimum height**, **13px × 16px padding**, **15px radius**. Small buttons retain a 44px minimum height.
- Fields: **48px minimum height**, **13px padding**, **12px radius**, label above the field, 8px label-to-input margin.
- Icon-only buttons: **44 × 44px** with a descriptive accessible name.
- Common row gap: 12px; equal-width action group gap: 10px.
- Bottom sheets: **28px top corners**, 25px horizontal padding, maximum height 90%, internal scrolling.
- Desktop preview app width: **414px**. At ≤600px, the app fills the viewport and has no decorative phone border. The desktop frame is not a native mobile component.
- Preserve safe-area space around navigation and voice controls. Keep the chat composer above bottom navigation.

Use existing component spacing first. Do not globally round every value to a new spacing scale; the current stylesheet includes deliberate per-screen adjustments.

## Shared component vocabulary

| Component | Existing class / structure | Required behavior |
|---|---|---|
| Primary action | `.btn.primary` | Teal fill, white text, clear action verb |
| Secondary action | `.btn` | Warm white fill, outlined |
| Destructive action | `.btn.danger` | Explicit wording and confirmation when destructive |
| Text action | `.text-button` | Use for a secondary link or action |
| Standard / soft card | `.card` / `.card.soft` | Shared padding, radius, and surface |
| Field | `.field` with input/select/textarea | Visible label, readable value, specific error |
| Checkbox | `.check` | Separate choices remain separate |
| Switch | `.toggle`, `role="switch"`, `aria-checked` | Visible state and accessible name |
| Settings row | `.menu-row` | Title, optional description, arrow |
| Status / error | `.notice` / `.notice.error-notice` | Text plus relevant icon and recovery action |
| Emotion label | `.emotion-label.calm` etc. | Consistent emotion and explicit estimate status |
| Dialog | `.modal-mask` + `.modal` | Name, focus handling, Cancel, explicit confirmation |

The visual guide uses an isolated native HTML dialog to demonstrate appearance. In the app, reuse its existing modal focus management rather than copying only the appearance. CSS alone does not implement consent, deletion, validation, or keyboard handling.

Example HTML:

```html
<link rel="stylesheet" href="mindguard-ui.css">
<section class="card">
  <h3>Your preferences</h3>
  <label class="field">Email address
    <input type="email" autocomplete="email" placeholder="you@example.com">
  </label>
  <button type="button" class="btn primary">Save preferences</button>
</section>
```

For a future native app, use the same semantic values from `tokens.json`; these CSS classes and DOM interactions are not React Native components. Shared native components should be implemented once and reused by all three owners.

## Icons, logo, and Zen

- `assets/icons/` contains the **26 existing icons**, each with a 24 × 24 viewBox, 1.65 stroke width, rounded caps and joins. Default UI display size is 21px, with smaller icons inside compact controls.
- Icons are monochrome and use `currentColor` when inlined. An SVG loaded through an image element does not inherit the surrounding text color; inline it when it must match a control’s color.
- `assets/mindguard-mark.svg` supplies the existing leaf mark. Pair it with the text **MindGuard** rather than inventing alternate logos.
- `assets/zen-orb.html` contains the decorative CSS orb markup; use it with `mindguard-ui.css` and adjacent status text.
- Orb timing: ready 6 seconds; listening 4; processing 2.4; speaking 1.5. Paused/disconnected states are static. Reduced-motion mode keeps the orb static and disables transitions.
- Do not use animation alone to communicate listening, processing, speaking, muted, or disconnected states.

## Navigation and shared behavior

- Bottom tabs: **Home / For you / Trends**, in that order. Never add a separate Talk tab to an individual screen.
- Text and voice start from Home. Keep switching between text and voice inside the conversation journey.
- Headers offer labeled **Resources** and **Settings** actions. Supporting screens have a Back action. Signed-out screens and the focused voice screen omit bottom tabs.
- Match the existing selected-tab pill, icon, and label treatment.
- Use the same empty, loading, processing, success, error, retry, and unavailable patterns across features.
- Name deletion and sharing consequences. Keep raw audio, transcripts, emotion observations, remembered details, and shared data distinguishable.
- Preserve user preferences across screen navigation within the current session. This UI currently resets on reload; do not imply that backend persistence is implemented.

## Team coordination

| Owner | Primary shared UI concerns |
|---|---|
| Zain — IoT | Watch permissions and connection states; wellness cards, units, source labels, and weekly context |
| Munsif — security | Account fields, validation, consent choices, sharing reviews, destructive confirmations, and privacy copy |
| Madushan — AI | Orb, chat and voice states, emotion labels, recommendations, history, and remembered details |

Zain and Madushan share the emotion presentation in Trends. Munsif defines consistent consent/deletion behavior with both owners. Each owner should reuse shared navigation, typography, controls, and assets rather than creating a feature-specific visual theme.

## Before combining screens

- Check 320px, 390px, and 430px mobile widths plus desktop preview.
- Test long names, emails, messages, labels, and larger text without clipping.
- Check keyboard reachability, a visible focus ring, dialog focus containment and return, and accessible control names.
- Check reduced motion and text-based state descriptions.
- Review empty, pending, failed, successful, and permission-off states.
- Check the actual text/background pair when adding colors; this kit is not a blanket accessibility certification for every possible combination.
- Confirm the three bottom tabs, back paths, composer position, and header actions match the rest of the app.

## Files

- `index.html` — interactive visual reference; open after extracting the full folder.
- `DESIGN-GUIDE.md` — this team handoff guide.
- `tokens.json` — framework-neutral reference values.
- `tokens.css` — named color variables.
- `mindguard-ui.css` — full snapshot of the live browser stylesheet.
- `guide.css` — layout for the design guide only; do not use it for app screens.
- `assets/` — SVG icons, leaf mark, and Zen orb markup.

No third-party fonts, image downloads, accounts, or network integrations are required by this kit.
