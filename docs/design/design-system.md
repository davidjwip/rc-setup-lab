# Setup Lab — design system

**Status:** v1, design-complete, implementation-ready.
**Applies to:** the React app (`web/`), the wireframes in `wireframes/`, and any print or share material. The stack is D-19; where a rule below names a mechanism it names a web one, and §12 maps the tokens to CSS custom properties. Every colour, type size, spacing value, badge, value state and tier in this document is stack-neutral and unchanged by that decision.
**Companion documents:** `docs/design/wireframe-notes.md` (what each screen is for), `wireframes/design-notes.html` (live token board with computed contrast ratios), `docs/intent.md` (why the app exists).

This is a specification, not a mood board. Every value here is meant to be typed into a CSS custom-properties block (or a Tailwind theme, or a native port) without a judgement call. Where a decision could plausibly go two ways, the wrong way is named.

---

## 1. Stance

### 1.1 What each screen is

Design decisions are inherited from what the screen does, not from a house style. Nine screens, five surface archetypes:

| Screen | Surface | The user is… | What wins |
|---|---|---|---|
| Garage | Explore / Operate | picking a car | recognition, completeness at a glance |
| Car model (hardpoints) + chassis card | Configure | measuring | order, recoverability, one thing at a time |
| Setup editor | Configure | changing a value | one gesture per change, consequence on the same row |
| Analysis | Monitor | reading state | density, glanceable hierarchy, no decoration |
| Compare A/B | Compare | weighing two options | aligned columns, parity, one emphasised difference |
| Setup sheets (library) | Browse | finding what was run | chronology, conditions, provenance |
| Sheet diff | Read / Interpret | asking what a change did | claim tier before claim, limits beside the claim |
| Exported sheet | Export | handing the number to someone else | the caveat travels with the number |
| Learn | Decide / Learn | understanding | one idea per section, reading comfort |

The failure mode this section exists to prevent: giving the Analysis screen a hero and three feature cards. It is a **Monitor** surface. Density and glanceability beat drama, and the biggest number on the screen is the one the racer acts on (load-transfer balance), not a badge.

### 1.2 Four rules

1. **The number is the interface.** Typography, spacing and colour all exist to make one number and its unit readable at arm's length in bad light. Chrome is what's left after the numbers are placed.
2. **Never a number without its unit, never a unit without its number.** They are set in different sizes and colours but are always in the same visual group.
3. **Direction is not judgement.** A delta tells you which way a value moved. It never implies better or worse, because the app does not know the track, the tyres or the driver. Only explicit thresholds (damping ratio out of range) are allowed to carry a warning colour.
4. **Broken geometry is a state, not an error.** Missing inputs and unsolvable geometry are designed, named and given a route out. Nothing reads `NaN`, `∞`, `-`, or a blank.

### 1.3 Named anti-patterns

Do not: use gradients as decoration (a hard-stop gradient for a slider fill is the only permitted use), put a photographic hero anywhere, use emoji as iconography, use colour to mean good/bad, add a coloured rail to the left of a card, put an icon above every heading, or centre-stack body copy.

---

## 2. Colour

### 2.1 The palette in one paragraph

Warm graphite neutrals, near-black but never `#000`, with a single high-chroma lime accent borrowed from measurement instruments and laser setup gear. The lime is the only saturated colour in the UI and it is spent on exactly three things: the primary action, the active navigation destination, and the value currently being pointed at. Everything else is a tonal step of the same warm neutral, so a screen full of numbers stays quiet. A muted amber is reserved for incomplete or degraded data; a salmon red for genuine errors; a pale teal for "this value went down".

### 2.2 Dark scheme (default)

| Token (Material 3 role name, kept for continuity) | Hex | Used for |
|---|---|---|
| `surface` (background) | `#121410` | screen background |
| `surfaceContainerLowest` | `#0B0C09` | inset wells, diagram canvas |
| `surfaceContainerLow` | `#171A14` | segmented control track, maths panel, inputs |
| `surfaceContainer` | `#1C1F18` | cards |
| `surfaceContainerHigh` | `#24281F` | card pressed, chips, delta pill background |
| `surfaceContainerHighest` | `#2D3127` | switches (off), split-bar remainder |
| `onSurface` | `#E8EADF` | primary text, all numbers |
| `onSurfaceVariant` | `#A8AD9C` | labels, units, hints, secondary text |
| `outline` | `#767C69` | 1 px hairlines that must be seen, slider track (unfilled) |
| `outlineVariant` | `#3C4034` | dividers, card borders, metering tracks |
| `primary` | `#C6EF6E` | primary action, active nav, delta-up glyph, selected dot |
| `onPrimary` | `#1A2100` | text on primary |
| `primaryContainer` | `#38480C` | selected chip background, callout background |
| `onPrimaryContainer` | `#DCF9A4` | text on primaryContainer |
| `secondary` | `#A9C9BC` | delta-down glyph, secondary emphasis |
| `tertiary` | `#E4B78C` | third data series only (never decorative) |
| `error` | `#FFB4A2` | real errors |
| `onError` | `#5C1600` | text on error |
| `warning` (extension) | `#E9C46A` | incomplete model, uncomputable value |
| `deltaUp` (extension) | `#C6EF6E` | value increased |
| `deltaDown` (extension) | `#9FC8C0` | value decreased |

### 2.3 Light scheme

| Token (Material 3 role name, kept for continuity) | Hex | Notes |
|---|---|---|
| `surface` | `#FBFBF4` | warm paper, not `#FFF` |
| `surfaceContainerLowest` | `#FFFFFF` | inset wells (the only pure white) |
| `surfaceContainerLow` | `#F5F5ED` | same as the page background |
| `surfaceContainer` | `#EFEFE6` | cards |
| `surfaceContainerHigh` | `#E8E9DE` | pressed, chips |
| `surfaceContainerHighest` | `#E1E2D6` | switches off, tracks |
| `onSurface` | `#1A1C14` | |
| `onSurfaceVariant` | `#4B5041` | |
| `outline` | `#767C68` | |
| `outlineVariant` | `#C7CBBA` | |
| `primary` | `#445E06` | deep olive — lime is unusable as text on paper |
| `onPrimary` | `#FFFFFF` | |
| `primaryContainer` | `#D3F190` | the lime lives here in light mode |
| `onPrimaryContainer` | `#182200` | |
| `secondary` | `#3D6156` | |
| `tertiary` | `#7A5530` | |
| `error` | `#B3261E` | |
| `warning` | `#7A5000` | |
| `deltaUp` | `#3F5A05` | |
| `deltaDown` | `#2F5A50` | |

**The one rule that keeps both themes honest:** in dark, the accent is a *light* lime on dark; in light, the accent is a *dark* olive on paper. Do not reuse `#C6EF6E` as text in light mode — it fails contrast and it reads as a highlighter.

### 2.4 Contrast (computed, WCAG 2.1)

| Pair | Dark | Light |
|---|---|---|
| onSurface / surface | 15.2:1 | 16.6:1 |
| onSurfaceVariant / surface | 8.1:1 | 8.0:1 |
| onSurfaceVariant / surfaceContainer | 7.3:1 | 7.2:1 |
| primary / surface | 14.1:1 | 7.1:1 |
| primary / surfaceContainer | 12.7:1 | 6.4:1 |
| onPrimary / primary | 12.7:1 | 7.4:1 |
| onPrimaryContainer / primaryContainer | 8.6:1 | 13.2:1 |
| error / surface | 10.9:1 | 6.3:1 |
| warning / surface | 11.1:1 | 7.2:1 |
| deltaUp / surfaceContainer | 12.7:1 | 5.9:1 |
| deltaDown / surfaceContainer | 9.1:1 | 5.8:1 |
| outline / surface (non-text, needs 3:1) | 4.3:1 | 4.2:1 |

All text pairs clear AA (4.5:1); all large numerals clear AAA. `outline` is a **non-text** token — never set body copy in it.

### 2.5 Colour rules a developer can get wrong

- **Do not generate the scheme with `ColorScheme.fromSeed`.** The tonal-palette algorithm desaturates `#C6EF6E` into a dull yellow-green and the whole identity collapses. Construct `ColorScheme(...)` explicitly from the tables above.
- **No shadow-based depth.** Dark depth is tonal (`surface` → `surfaceContainer` → `surfaceContainerHigh`). Shadows smear on OLED and muddy the neutral. The only shadow in the system is the scrim under a bottom sheet.
- **Hairlines are 1 logical px of `outlineVariant`**, not a darker background. Two adjacent tonal surfaces with no hairline look like a rendering bug.
- **Amber means "we could not compute this", not "this is bad".** A high roll centre is not amber.
- **Delta colour is direction, not quality.** `deltaUp` is lime, `deltaDown` is pale teal. Neither is green/red. If a future feature needs "this will make the car push", that is a sentence in `onSurface`, not a colour.

---

## 3. Typography

### 3.1 Family

**The platform UI face**, expressed as the system stack
`ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`.
No web fonts, no bundled display face, no `@font-face` at all. This is deliberate and it got
simpler with D-19: the old rule delegated to the platform through a Flutter typography API, which
meant a Material default on Android and SF Pro on iOS by way of the framework. A system stack states
the same intent in one line, works on every engine, and adds **zero bytes** to the first-load budget
(E8.11) — a bundled font family would be the single largest asset in the app.

**Equations and tabular data** use the platform monospace through the stack
`ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace`. Do not bundle a mono
face for v1; if the fallback proves inconsistent in review, bundle one (Apache-2.0 or OFL) and
change one token — but only if E8.11's budget still holds afterwards, because a mono face on top of
a system sans is the first thing that would blow it.

**Every number in the app uses tabular figures**: `font-variant-numeric: tabular-nums` on the numeric
tokens. This is not cosmetic — a live-updating value that reflows its own width while you drag a slider is the single most common "this feels cheap" bug in a data app.

### 3.2 Scale (CSS px at a 100% root font size)

| M3 slot | Size / line | Weight | Tracking | Used for |
|---|---|---|---|---|
| `displayLarge` | — | — | — | not used |
| `displayMedium` | — | — | — | not used |
| `displaySmall` | 30 / 36 | 500 | −0.5 | screen H1: Garage, Learn article title |
| `headlineLarge` | — | — | — | not used |
| `headlineMedium` | 20 / 26 | 500 | −0.1 | app bar title, section heading |
| `headlineSmall` | 18 / 24 | 500 | −0.1 | card title, property name |
| `titleLarge` | 15 / 20 | 500 | −0.1 | list row label, control label |
| `titleMedium` | 14 / 20 | 500 | 0 | sub-row label, stepper label |
| `titleSmall` | 13 / 18 | 500 | +0.2 | small button label |
| `bodyLarge` | 15.5 / 25 | 400 | −0.1 | Learn article prose (measure 45–60 characters) |
| `bodyMedium` | 14 / 21 | 400 | 0 | UI body, callouts |
| `bodySmall` | 12 / 17 | 400 | 0 | hints, footnotes, "where to measure" |
| `labelLarge` | 13 / 16 | 500 | +0.2 | buttons, tabs |
| `labelMedium` | 11.5 / 15 | 500 | +0.3 | chips, nav labels |
| `labelSmall` | 10.5 / 14 | 600 | +0.8 | uppercase eyebrow / section label |

Three slots are deliberately unused. Do not fill them "for completeness" — a 48 px display style has no job in a trackside app.

### 3.3 Numeric styles (their own tokens, not the type scale)

| Token | Size / line | Weight | Tracking | Used for |
|---|---|---|---|---|
| `numHero` | 34 / 38 | 400 | −0.8 | load-transfer balance, empty-state figure |
| `numLarge` | 22 / 26 | 500 | −0.3 | property value on Analysis, setup value |
| `numMedium` | 18 / 22 | 500 | −0.2 | alignment steppers, compare cells |
| `numSmall` | 14 / 18 | 500 | −0.2 | table cells, meta numbers |

Each is a CSS custom property (`--fs-num-large: 1.375rem; --lh-num-large: 1.625rem; …`) with
`font-variant-numeric: tabular-nums` and `letter-spacing` from the tracking column; the tracking
value is the CSS `letter-spacing`, in `em`. They are *not* part of the M3-named type scale above,
because a numeric token has to carry tabular figures and the `~`/`↳` glyph order with it (§10.13).

`unit` is `labelMedium` in `onSurfaceVariant`, baseline-aligned to the number with 3 px of leading space. Units are never inside the number string and never inside the same text node as the number — they are a separate `<span>` inside one labelled group, so they can be styled and so the accessibility name can say "22 millimetres".

### 3.4 Dynamic type

- The app honours the user's text size up to **1.3** everywhere and does not clamp it — on the web
  that means both mechanisms at once: the browser's page zoom (which scales everything, including
  layout) and a larger root font size (which scales type in `rem` while boxes stay put). Layouts must
  survive 1.3 with no truncation: rows grow, cards grow, nothing is fixed-height except the 44 px
  touch target (which grows to 48 at 1.15 and above). Every type size and spacing token is in `rem`
  so the second mechanism works; a token written in `px` is a bug in the token file.
- The only layout that may scale a number down is `numHero` inside its card, and only down to 0.85 —
  on the web that is `font-size: clamp(...)` or a one-off transform, decided per card, never a global
  rule.
- Two-line wrapping is allowed for labels. Ellipsis is only allowed on setup and car *names* in a card, never on a value, a unit or a property name.
- At 1.3, the compare table's four columns stop fitting. Specification: below 350 CSS px of content width, the compare table switches from side-by-side A/B to **stacked A / B rows** (label, then two indented value lines). Do not shrink the type.

### 3.5 Measure

Article prose is capped at 62 characters (≈ 360 CSS px at 15.5 px). UI body copy is never justified, never hyphenated, and is always `text-align: start` (never `left` — the app is externalised for RTL, E8.9b).

---

## 4. Spacing and layout

### 4.1 Scale

4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64. Every margin, padding and gap is one of these. 4 and 20 are the only non-multiples of 8, and both are reserved: 4 for a hairline gap inside a control, 20 for reading margins in the Learn article.

### 4.2 Screen anatomy (390 × 844 reference)

```
safe area (env(safe-area-inset-*): 44 top / 34 bottom on the reference phone)
├─ status bar                46
├─ app bar                   56   (large titles live in the body, not the bar)
├─ content                   flex, scrolls
│   └─ horizontal margin     16   (20 for article prose)
├─ bottom action bar         72 + safe area   (when the screen has one)
└─ navigation bar            72 + safe area   (not on detail screens)
```

- **Gutters:** 16 px between the screen edge and a card; 12 px between cards; 16 px inside a card.
- **Card padding:** 16, except dense list rows, which use 14 vertical with a 72 px minimum height.
- **Thumb zone:** primary action sits in the bottom 25% of the screen. On Garage, "Add a car" is a sticky bottom bar, not a top-right icon (the icon remains for discoverability at reach, not for the primary path).
- **Detail screens drop the navigation bar** (Setup editor, hardpoints). They get a bottom action bar instead. A screen never has both.

### 4.3 Grid

No column grid. A single column of full-bleed cards with a 16 px margin is the whole system. The one exception is the compare table's fixed columns (1fr / 66 / 66 / 62).

---

## 5. Shape

| Token | Radius | Used for |
|---|---|---|
| `xs` | 4 | badges, ticks, tiny chips |
| `sm` | 8 | chips, number fields, segmented items |
| `md` | 12 | buttons, list rows, banners, small cards |
| `lg` | 16 | cards, diagram container, sheets' top corners |
| `xl` | 24 | modal bottom sheet |
| `full` | 999 | switches, slider thumb, circular icon buttons |

Token map: buttons `md`, cards `lg`, dialogs `xl`, chips `sm`, inputs `sm` — one `--radius-*` per token, consumed by component classes. A card is never a pill; a button is never a card.

---

## 6. Elevation

Tonal elevation only, levels 0–3, expressed as background-colour steps; no `box-shadow` anywhere except the sheet scrim. (This was a Material 3 rule about shadows; on the web it is simply "no shadows", and the reason is unchanged — a shadow on a warm neutral looks like a 2014 Android app and smears on OLED.)

| Level | Use | Dark | Light |
|---|---|---|---|
| 0 | page background, inline content | `surface` | `surface` |
| 1 | card | `surfaceContainer` | `surfaceContainer` |
| 2 | card while pressed, sticky bar | `surfaceContainerHigh` | `surfaceContainerHigh` |
| 3 | bottom sheet (with 32% scrim) | `surfaceContainerHigh` + scrim | `surfaceContainerLowest` + scrim |

Depth is communicated by the tonal step **plus** a 1 px `outlineVariant` hairline. Removing the hairline in dark mode makes cards float ambiguously; adding a shadow makes them look like a 2014 Android app.

---

## 7. Motion

| Duration | Curve | Used for |
|---|---|---|
| 100 ms | `linear` | press feedback (background step; there is no Material ripple on the web) |
| 160 ms | `cubic-bezier(0.2, 0, 0, 1)` | colour, opacity, delta chip fade-in |
| 220 ms | `cubic-bezier(0.2, 0, 0, 1)` | expand/collapse of the maths panel, chevron rotation, tab underline |
| 300 ms | `cubic-bezier(0.05, 0.7, 0.1, 1)` (emphasised) | bottom sheet, page transition |
| 400 ms | `cubic-bezier(0.2, 0, 0, 1)` | number change when it comes from somewhere other than the user's finger |

Rules:

- **While a finger is on a slider, there is no animation at all.** The number tracks the drag frame-for-frame. Animating a value under a moving thumb feels broken.
- A value that changes because of a *remote* cause (recalculation after a hardpoint edit) cross-fades old→new over 160 ms with a 2 px vertical slide. No counting/odometer animation — it is theatre, and it lies about intermediate values.
- The maths panel expands with a 220 ms height transition (`grid-template-rows: 0fr → 1fr`, which
  animates without measuring the content) plus the chevron rotation. It never pushes the row it
  belongs to off-screen.
- `@media (prefers-reduced-motion: reduce)` sets every duration to 1 ms and removes the slide, but
  keeps the state change (E8.16c).
- **Haptics: dropped, and deliberately.** The Flutter design used a selection click on slider ticks
  and a light impact on save. On the web there is no equivalent that works where it matters: iOS
  Safari exposes no vibration API at all, and `navigator.vibrate` exists only in some Android
  browsers, fires only from a user gesture, and is ignored when the user has system haptics off. A
  save that sometimes buzzes on one platform is worse than a save that never does, so **v1 ships no
  haptics** and the save bar's own 160 ms colour change carries the confirmation. If a wrapper
  (Capacitor) ever lands, this line is the one to revisit — not the design.

---

## 8. Iconography

- **Set:** Material Symbols Rounded, outlined, weight 300, 24 px optical size — shipped as an inline
  SVG sprite (the paths only), **not** as the Material Symbols webfont: the font is a few hundred
  kilobytes for a dozen glyphs and would break E8.11's first-load budget on its own. The *set* is a
  design decision and is unchanged; the delivery mechanism is the web's.
- **Sizes:** 24 in app bars and navigation, 20 in list rows, 16 in chips and inline links, 14 in dense table cells. Icon stroke never goes below 16 px.
- **Touch target:** every icon is wrapped in a 44 × 44 (or 48 × 48) target, even at a 20 px visual size.
- **Vocabulary** (fixed, so screens stay consistent):

| Concept | Icon |
|---|---|
| Garage / car | `directions_car` |
| Setup / tune | `tune` |
| Compare | `compare` (two panels) |
| Learn | `menu_book` |
| Add | `add` |
| Overflow | `more_vert` |
| Back | `arrow_back` |
| Drill in | `chevron_right` |
| Measure / ruler | `straighten` |
| Swap A/B | `swap_horiz` |
| Not computable / undefined | `warning_amber` |
| Info | `info` |

- **No custom illustrated icons, no chassis silhouettes, no emoji.** The only drawn artwork in the app is the geometry diagram (§10.11), which is data, not decoration.
- Icons never carry meaning alone: every icon sits next to a label or inside a control with an accessible name.

---

## 9. Numbers, units and formatting

This is where a port of a physics app usually goes wrong, so it is specified rather than left to the component layer.

| Property | Unit (display) | Decimals | Sign shown | Uncomputable when |
|---|---|---|---|---|
| Roll centre height | mm | 0 | no | a hardpoint for that corner is missing |
| Roll centre migration | mm at ±1° of roll (a displacement, not a rate) | 1 | yes | same as above |
| Camber gain | ° per 10 mm bump (headline) · °/mm in the detail | 2 | yes | missing hardpoint |
| Camber per degree of roll | °/° | 2 | yes | missing hardpoint |
| Bump steer | mm toe per 10 mm bump (headline) · °/10 mm in the detail | 2 | yes | steering link endpoint missing |
| Roll stiffness | N·m/deg (the solver returns N·m/rad; ÷ 57.29578 once, in the formatter) | 3 | no | spring or bar data missing |
| Wheel rate | lb/in, or N/mm per the car's unit preference | 2 | no | spring rate or motion ratio missing |
| Motion ratio | — | 2 | no | damper mount or arm length missing |
| Damping ratio | — | 2 | no | damper data missing |
| Load transfer split | % front | 1 | no | roll stiffness for either axle missing |
| Roll sensitivity | °/g | 1 | no | mass, CG height or roll stiffness missing |

Rules:

- The **physics package works in SI** (m, N, kg, rad). Conversion happens once, in `packages/data`'s adapter, and formatting once, in `web/src/format/`. No component does arithmetic and no component calls `toFixed`.
- Display units are a **per-car preference**, stored with the car, not a global toggle: a club racer who buys springs in lb/in should never see N/mm.
- The minus sign is **U+2212 (−)**, not a hyphen. It is set with a hair of extra tracking; a hyphen next to a tabular digit reads as a dash.
- Unit strings sit in `labelMedium`/`onSurfaceVariant` with a non-breaking space from the number, so "22 mm" never wraps to "22 / mm".
- Precision is **fixed per property**, never "significant figures" and never trailing-zero trimming: `1.10` stays `1.10` so a column of values lines up.
- Deltas use the same precision as the value, always signed (`+0.15`, `−0.05`), and show `—` when the change is below half the last decimal.
- A value with no answer renders one of the five variants in §10.13 — never `--`, `n/a`, `0` or an empty string.
- **A tolerance is data, never a default.** If the source record carries `tolerance_pct` or `tolerance_abs`, an estimated value prints it in the value's own unit (`~2.8 lb/in ±0.2`). If it carries neither, the value prints the `~` and nothing else. There is no blanket ±15%, no ±10%, no "approx." — the UI adds no number the document did not store. Where the tolerance is a band the physics derives from a published material range (a chassis torsion estimate), the band is shown as `~` plus the range in the provenance line, not as a ± on the numeral.
- **Every number carries a validation state**, independent of its badge (§10.13). Badge = where it came from; ring = whether anyone has checked the answer. Neither substitutes for the other.

---

## 10. Components

### 10.1 App bar

Height 56. Back (44) · title block · overflow (44). The title is `headlineMedium`; when a subtitle is present it is `labelMedium`/`onSurfaceVariant` on a second line and the block is vertically centred. Background is `surface` at 92% opacity with `backdrop-filter: blur(12px)` when content scrolls under it (and an opaque `surface` where `backdrop-filter` is unsupported — iOS Safari has supported it for years, but a bar that goes transparent when it is not is a readable fallback); no divider. Large titles (30 px) live in the scrolling body as an H1, not in the bar — a bar that grows and shrinks on scroll is motion for its own sake.

### 10.2 Navigation bar

A bottom navigation bar built to the tokens below — one `<nav>` with three `<a>`s and `aria-current`, not a framework component — height 72 + safe area, **three destinations: Garage · Compare · Learn** (decision D-01, and the URLs are real URLs so each one is a link, §3 of the architecture). Active: icon and label in `primary`, `labelMedium`. Inactive: `onSurfaceVariant`. No pill indicator behind the icon — the colour change plus the label is enough at this size, and a second active-state signal competes with the numbers on screen.

There is no Setup destination. Setup, analysis, the chassis card, the sheet library and the sheet diff are **pushes inside the Garage branch**, because they have no subject until a car is chosen; a Setup tab would reintroduce "which car is this tab showing?". Detail screens under a push (setup editor, hardpoints) drop the navigation bar and carry a bottom action bar instead (§4.2). Consequence for the wireframes: every tab bar draws three items, and the current destination for the whole car-and-setup subtree is garage.

### 10.3 Card

`surfaceContainer`, radius 16, 1 px `outlineVariant`, padding 16. Cards are containers for a *group of related values*, never for a single sentence. A card that contains one number and one label is a list row, not a card.

### 10.4 Property card (Analysis) and list row

Analysis is **seven cards, front and rear, and never an eighth** — motion ratio, ride frequency, roll-centre migration and camber-at-roll are drill-downs inside the card they belong to. Card minimum height 78, padding 12/14. Left: label (`titleLarge`) + the property's unit or plain-language hint (`labelSmall`/`onSurfaceVariant`), fixed 92 px so the two value columns start at the same x on every card. Right: two columns, `FRONT` and `REAR` over-line in 9 px `labelSmall`/`onSurfaceVariant`, then `numLarge` + unit, then the delta chip. Chevron 16 at the trailing edge, rotated 90° when the maths is open.

A card with one value (compare rows, setup rows) uses the single-column version at 72 minimum: label left, value + delta right.

The row is the whole tap target. A row with an expandable body is a `<details>`/`<summary>` pair, so
the expanded state is announced and keyboard-operable for free — not a `div` with a click handler.
Where the disclosure must animate, keep the `<details>` and drive the height with CSS (§7).

### 10.5 Delta chip

Height 24, radius 6, padding 0 8, background `surfaceContainerHigh`, `labelMedium`. Content: arrow glyph (9 px) + **signed** magnitude, e.g. `▲ +3`, `▼ −0.05`, `—`. In a two-value card each value carries its own chip (18–20 px tall, `surfaceContainerHigh`, 10.5 px) so the front and rear deltas are never ambiguous.

- Up: glyph in `deltaUp`. Down: glyph in `deltaDown`. **The text stays `onSurface`.**
- No change: chip is hidden entirely in the editor, and shown as a dash in the compare table (where the absence of a chip would break the column).
- Never green/red. Never the word "better".

### 10.6 Slider control row (continuous values)

```
Front                                    2.8 lb/in
Spring rate                                 ▲ 0.2
[─────────●───────────────]
2.0                                 4.5 lb/in
Wheel rate 1.08 lb/in · motion ratio 0.62
```

- Track 5 px, `outlineVariant`, filled portion `primary`; thumb 22 px, `primary`, with a 3 px `surface` ring so it reads on both the filled and unfilled track.
- The hit area is 44 px tall even though the track is 5.
- The value itself is a button (dashed 1 px underline, 44 px target) that opens the numeric keypad sheet. **There is no separate stepper next to a slider** — two controls for one value is the most common way a setup editor gets cluttered.
- Ticks only for discrete values (bar diameter); continuous springs get no ticks.
- The derived line under the slider is mandatory: it is where the teaching happens.

### 10.7 Stepper row (discrete values: camber, toe, droop, ride height)

Minus button (44 × 44, circular outline) · value (`numMedium`, 78 px wide, centred, tap to type) · plus button. Row height 56, label left with a secondary line stating the step and the change versus saved. Long-press repeats at 8/s after a 400 ms delay.

### 10.8 Number field

Used inside the hardpoint editor and the keypad sheet.

- Height 52, radius 8, `surfaceContainerLow` fill, 1 px `outlineVariant`.
- Label above the value inside the field: 10 px uppercase, `onSurfaceVariant` (`X · FWD`). The unit is a 10 px suffix pinned bottom-right inside the field.
- Input is `<input type="text" inputmode="decimal" pattern="-?\d{0,3}(\.\d{0,2})?">`: a text input
  with a decimal keypad hint, because `type="number"` brings spinners, scroll-wheel changes and a
  locale-dependent decimal separator that has broken more measurement forms than it has fixed.
  Validation still happens on blur, not on keystroke.
- Missing state: dashed `warning` border, value `—` in `warning`, helper line below naming what to measure. A missing field is never empty and never shows a placeholder `0.0` — a zero is a legitimate measurement and must not be confused with an absence.
- Validation is on blur, not on keystroke.

### 10.9 Chips and segmented control

- **Chip:** 32 tall, radius 8, 1 px outline; selected = `primaryContainer` fill, no border, `onPrimaryContainer` text. Chips are for discrete options (oil weight, piston holes) and appear in a 44 px-tall row.
- **Segmented control:** `surfaceContainerLow` track, radius 12, 4 px padding, 40 px items, radius 9. Selected item is `surfaceContainerHigh` + `onSurface`; the track stays visible so the group reads as one control. Used for Front/Rear/Chassis and for the four setup groups. Never used for navigation between screens.

### 10.10 "Show the maths" panel

A disclosure, collapsed by default, attached to the row it explains (never a separate screen) — the same `<details>`/`<summary>` component as §10.4.

- On phones this **replaces the "Why sheet"** named in `screens.md`. Same content, one tap, no context loss — a sheet that covers the number you are asking about is worse on a 390-wide screen. The desktop and tablet builds may open the same content as a sheet.
- Collapsed: chevron + the row. Expanded: chevron rotated, card background steps to `surfaceContainerLow`, and a body appears separated by a hairline.
- Body order: (1) the equation with the real symbols, monospace, `white-space: pre`, horizontally scrollable rather than wrapping; (2) one sentence naming what each symbol is; (3) one sentence of meaning ("longer links and a higher roll centre both reduce it"); (4) a link to the Learn article.
- The equation is rendered as text with real superscripts/subscripts, not an image and not MathML — it must be selectable, searchable and screen-readable.

### 10.11 Diagram canvas

`surfaceContainerLowest` well, radius 16, 1 px `outlineVariant`, 12 px inset, caption strip beneath with the view name on the left and the selected item on the right.

- Line weights: geometry 2.4 px `onSurfaceVariant`; construction lines 1.1 px dashed `warning` (they are *derived*, and dashed says so); the value being explained 2 px `primary`.
- Labels 9–10 px, `onSurfaceVariant`, never rotated.
- The diagram is always paired with text. It is not the only place a fact appears.
- Every diagram has a fixed 340 × 132 (corner) or 340 × 250 (full car) viewBox and scales to the container width; it never reflows independently of the card.

### 10.12 Empty state

Centred, max 270 px of text, one drawn diagram at 180 × 130, headline `headlineMedium`, one sentence of `bodyMedium` that explains the premise, one filled primary button, one text link for the secondary path. No illustration of a sad car, no "Oops".

### 10.13 Value badges: computed, estimated, inherited, missing, undefined

One component renders every number in the app, in **five** variants. The badge answers *where did this number come from*; it does not answer *has anyone checked it* — that is §10.14, and the two marks are always set together. These names and strings are the contract with `docs/design/screens.md` §0.2.

| Variant | Looks like | Used when | Tap goes to |
|---|---|---|---|
| `computed` | solid value + unit | every input is present and was measured **on this car** | property detail |
| `estimated` | `~` prefix, dotted underline, value in `onSurface` | at least one contributing input is an estimate the user marked | the estimate's provenance |
| `inherited` | `↳` prefix in `secondary`, dotted underline | at least one contributing input came from **another car's model, a template, or another user's sheet** | the source car or sheet |
| `missing` | no numeral; **Not computable yet** in `warning` + the first missing input | an input is absent | the measure task for that input |
| `undefined` | no numeral; **Undefined for this geometry** in `warning` | all inputs present, maths has no answer (parallel links, coincident points, zero-length link) | the two fields involved, and what to check |

Rules:

- **Precedence when several apply:** `missing` / `undefined` (no numeral at all) → `estimated` → `inherited` → `computed`. The most cautious provenance wins the badge; the provenance line beneath names every contributing source, so nothing is hidden by the ranking.
- **Five badges, eight source types.** `spec.md` §4.1.4 stores `measured`, `estimated`, `manufacturer`, `third_party`, `library`, `derived`, `inferred` and `unattributed`; the component renders five badges via the mapping in `screens.md` §0.4. `derived` inherits the worst contributing badge, and `inferred` renders as `estimated` **plus a mandatory route chip** naming the method — an inferred value must never read like a user's guess.
- **Inherited is not computed.** A library or template value is another car's measurement and is never rendered as a solid numeral — that was the whole point of the fifth variant. It carries the source name on a second line: `Inherited · Mugen MTC2 template v2` or `Inherited · Dan's sheet (S02)`. The line is part of the component, not a footnote elsewhere on the screen.
- **Estimated shows the stored tolerance or nothing.** `~2.8 lb/in ±0.2` when the source record has one; `~2.8 lb/in` when it does not. See §9. The tolerance is never a system-wide default.
- **Both marks, one value:** an inherited estimate reads `↳~22 mm` with a provenance line naming both ("estimated from the MTC2 template, ±0.3 mm"). The glyph order is fixed: `↳` then `~`.
- The variant replaces the numeral **in place**. The unit, the validation ring, the delta chip and the label column do not move, so a scan down a column of cards still lines up.
- Only the affected column changes. In a front/rear card, a missing front hardpoint leaves the rear value intact and computed.
- Every affected card carries a one-sentence reason in its expanded body, naming the input or the geometric condition — never "calculation error".
- A banner appears at the top of the screen when **two or more** values are affected, because at that point the model is not trustworthy and the user needs to know before reading anything else. The banner is `warning` at 9% fill, 1 px 45% border, a 20 px icon, a `titleSmall` headline, two lines of `bodySmall`, and one 44 px text action.
- The header's health line counts what survived: "7 of 7 computed", "5 of 7 computed", "1 undefined". It is a sentence, not a progress bar.
- **Never** render `0`, `--`, `n/a` or an empty cell for an uncomputed value. A zero is a legitimate measurement and must stay distinguishable from an absence.

A parallel-link geometry is `undefined`, not `0 mm`. The front-view construction does have a limiting height as the instant centre recedes, but that limit is numerically fragile and stops responding to ride height — reporting it as a tunable number would teach the user something false. The app refuses to report a limit it cannot defend, and says so in those words.

### 10.14 Validation state — the ring

The second, independent mark on every number (owner decision D-11). **v1 ships entirely in the first state.**

| State | Marker | Short string | Full string |
|---|---|---|---|
| `unvalidated` | hollow 7 px ring, 1.2 px `warning` at 85%, baseline-aligned immediately after the unit | `computed, not yet validated` | **Computed, not yet validated.** Every number here was computed from your model and the published equations; none has been checked against a bench measurement yet. |
| `validated` | filled 7 px ring, `outline` | `validated · bench` | **Validated against a bench measurement** — roll centre within 0.4 mm over five heights, 12 Mar 2026. |
| `not_validatable` | ring with a 1 px diagonal through it, `outline` | `inferred · not a measured quantity` | **This is an inference, so there is nothing to validate against.** It moves with the model's assumptions (procedure, part masses, damper model); the band shows how much, and the route is named. |

Rules:

- **The ring is on every number, always.** A numeral with no ring is a bug, including numbers quoted inside prose ("your 22 mm"), in a comparison cell, in a maths panel and on an exported page.
- **The words appear once per surface**, in this order of preference: the maths panel footer, the property-detail block, the export foot, the screen strip. Repeating "not yet validated" after seven values is noise; the ring is the per-value carrier.
- **Degradation is a data change, not a layout change.** When an output's evidence record exists, the same slot swaps: the marker fills, the chip reads `validated · bench`, and the full sentence gains the evidence. Nothing moves, so a sheet exported last month stays comparable with today's.
- **`not_validatable` is not a loophole.** It applies only where the *quantity itself* is defined by a model rather than measured on a car: damping ratio under `orifice_single_piston_v1` (E3.6c: "never marked validated"), and any grip sentence (which carries no value at all). Anything with a measured benchmark — roll centre, camber gain, bump steer, wheel rate — is `unvalidated` until the bench case exists, never `not_validatable`.
- **Evidence is per output, per model version.** A validated output returns to `unvalidated` when the model version changes, because the bench case proved the old arithmetic. Copy: **Not yet re-validated for model 0.2** — same ring, same position.
- **What does not count as validation:** a golden test comparing two copies of the same equation, a second implementation agreeing, a user saying it "feels right", a textbook value. Only a bench or on-car measurement with a stated tolerance.
- **Where each surface states it:**

| Surface | Per-value mark | Where the words go |
|---|---|---|
| Analysis card | ring after each value | one strip under the header, naming the count (`0 of 7 bench-checked`) |
| Property detail | ring after the value | a block directly under the value: state chip, full sentence, *What would validate this* link, evidence line when present |
| Compare row | ring after each cell | one footnote under the table, and once in the "what this does" block |
| Maths panel | — | footer line inside the panel: **Computed, not yet validated.** The equation is the published one and the inputs are yours; no bench case exists for this output yet. |
| Export / setup sheet | ring after each value | foot block: the words in full, the input-provenance counts, app version, generation date, "a record of what was run, not a validation certificate" |
| Sheet diff | ring on the firm rows | one statement above the tier panel; the tiers answer a different question and never absorb it |
| Garage card / Learn callout | ring after the value | one line per screen naming the state |

- **A sheet that leaves the phone cannot outlive its caveat.** If the export omits the state, the whole feature is theatre: a printed sheet is the artefact most likely to be pinned to a pit table for a season.
- Accessibility name: the value's label appends the state — "Roll centre, front, 22 millimetres, up 3 from saved, computed, not yet validated".

### 10.14a `<Value>` component contract (web)

Geometry, and every later page, renders every number through one component:

```tsx
<Value value unit provenance band validation accessibleName />
```

- `value` is the numeral only, already formatted by `web/src/format/`; `unit` is a separate
  `<span>` inside the same labelled group. The component never formats a number.
- `provenance` is one of `computed` (every contributing input was measured on this car),
  `measured` (a stored measurement), `modelled`, `estimated`, `inferred`, `missing` or `undefined`.
  The visible badge is the provenance word itself, so **an inferred, modelled or estimated value can
  never carry `computed`**.
- `validation` is the ring state from §10.14. The ring is always rendered; the words appear once per
  surface, never after every value.
- `band` is a formatted `±x` string, or `null`. A null band prints `no band` plus a `bandReason`
  naming why the source stores no tolerance. The component never invents one.
- `accessibleName` is the property and end ("Front roll-centre height"). The rendered group's
  accessibility name appends the number, unit, band, provenance and validation in that order, so the
  number, unit and ring are not read as three separate nodes.
- Numerals use `font-variant-numeric: tabular-nums`. Large is `numLarge`; every other value is
  `numMedium` or smaller, and no value is larger than the page `h1`.
- For `missing` and `undefined` there is no numeral: the component prints **Not computable yet** or
  **Undefined for this geometry** and a human `reason`. Solver codes (`lca_in`, `parallelLinks`) never
  reach the screen.

### 10.15 Chassis card

The model input that is not a hardpoint (GitHub #11). Material and thickness do **not** move the roll centre — the card says so, because the intuitive claim is the wrong one.

- **Where:** the Chassis tab of the car-model screen, and referenced (one line, not a duplicate card) from the Analysis roll-stiffness card.
- **Order:** material chips (carbon · aluminium · steel) → thickness (number field, caliper, `K · 2.0`) → measured torsion (optional, empty by default, N·m/deg) → estimated torsion (only while measured is empty) → **What the plate changed**.
- **Measured torsion is the primary input.** When present it replaces the estimate entirely; the estimate row is not shown greyed or "for reference". The card is the one place in the app where a user-supplied measurement overrides a model estimate without argument.
- **Estimated torsion** is a thin-plate estimate from material G and section. Carbon's G depends on weave and layup, so it prints as `~2.9 N·m/°` with the range in the provenance line — never as a ± on the numeral (§9).
- **What the plate changed** is a mandatory block of rows: roll-centre height (**unchanged** — fixed by hardpoints), ride height (a thicker plate lifts the car unless a shim comes out), mass, CG height, front share of roll stiffness (the chassis is a spring in series with springs and bars). Each row carries its direction, its number, and a validation ring. This is the "statement of which quantities it changed" the feature exists for; without it the card is a form.
- No separate "chassis flex" handling read-out in v1: flex folds into the balance number (§ issue #11 open question 1).

### 10.16 Sheet row and diff row

**Sheet row** (setup-sheet library, `/car/:carId/sheets`):

```
12 Aug   Wed club                        [baseline]
19:40    "Q2 — 1.2 bar, 400 rear oil."
         dry · air 18 °C · track 24 °C · 32R
         4 changes vs Sat open · 8 of 8 set · 7 of 7 computed      ›
```

- Date in a fixed 44 px column, day and time stacked; the list is chronological and that is the only sort in v1.
- Name row carries at most two chips: `baseline` (accent) and `draft` (dot + chip). An imported sheet carries `inherited` and the source name in the meta row.
- Note is one line of the user's own words, truncated with `…` at two lines — the only place in the app where truncation of prose is allowed.
- Conditions row is always present, even when empty ("no conditions recorded"), because a diff is meaningless without it.
- The row is one tap target, whole width, and goes to the sheet's diff against the previous sheet.

**Diff row** (`sheet-diff`): grouped under `Geometry` / `Springs & bars` / `Dampers` / `Alignment`. Changed rows read `A → B` with A in `onSurfaceVariant` and B in `onSurface`; unchanged rows exist but sit behind the changed-only filter. Computed diff values carry the ring; a value that arrived with an imported sheet carries `inherited` and the source.

### 10.17 Tiered interpreter panel

The "what this did" panel on the sheet diff (GitHub #10). **Three tiers, and the tier is the honesty mechanism.**

| Tier | Backing | Wording contract |
|---|---|---|
| **Firm** | v1 physics: geometry, rates, stiffness split and their arithmetic | States direction and magnitude. Numbers carry the validation ring. |
| **Inferred** | steady-state reasoning from the firm rows | Must contain the words **all else equal** on screen, plus two fields: *Reverses if* and *What it does not claim*. |
| **Speculative** | needs a transient model or a measurement the app does not hold | Names the question and refuses it: `not answered`. Never an estimate, never greyed-out pseudo-data. |

- **Vocabulary: understeer / oversteer, never push / loose.** Phases are `entry` / `mid` / `exit`. One vocabulary in the app, the export and the Learn copy, so a claim cannot be read two ways (owner decision, 30 Oct 2026).
- **Grip is never measured or computed — it is inference, and it looks different.** A grip sentence never carries a numeral, a unit, a value badge or a validation ring, because there is no value. It renders as an inference strip: hatched 9% `surfaceContainerHigh` fill, 1 px dashed `outline`, the word `inference` in `labelSmall`, the sentence in `bodyMedium`, and a single qualifier line naming what would be needed to make it a claim (tyre data or a measured test). It sits inside the Inferred tier but is visually distinct from every computed number on the screen. A grip claim inside a Firm block is a bug.
- **Not colour-coded.** Tiers differ by border style (solid / dotted / dashed) and by the word. Colour would read as a quality scale; the tiers are epistemic, not evaluative.
- **A rule with no tier does not ship.** The panel has no unlabelled sentence, including the summary line.
- **Phase is a tag, not a tier.** `entry` / `mid` / `exit` sits on the rule. Firm rules are steady-state and therefore mid-corner; entry and exit only ever appear on Speculative rules in v1.
- **Why not four tiers, or a percentage:** a confidence number would claim a measurand the inference does not have (nobody can state ±12% on "understeers more"), and a fourth band would repeat Speculative under a new name. Three tiers plus two per-claim limits ("reverses if", "does not claim") is the most the model can honestly carry.
- **The conditions gate sits above the tiers, not below.** Sheets record **optional** conditions — surface (carpet / asphalt / other), temperature, humidity, plus free text for tyres and motor. If the two sheets differ in surface, tyre or temperature, the panel says **Different day — not like-for-like** before the first claim and dims the Inferred tier and greys the grip strip; Firm rows survive, because they do not depend on the tyre. If every recorded field matches, it says **Comparable** with what was compared. If nothing is recorded, it says **No conditions recorded — this diff cannot say whether it is like-for-like**, which is neither a pass nor a warning.

### 10.18 Damping-ratio card

ζ is an **estimate in v1** (owner decision; `CONSOLIDATED` §3, option 2). The card leads with direction, not magnitude, because the direction is robust and the absolute value is not.

- **Leading line is the direction of change, with its magnitude**: `▲ Rear oil 350 → 400 cSt: more damping at the wheel, ζ +0.04 (estimate)`, `▼ Shock laid down: less wheel damping`. A sentence with an arrow, in `onSurface`, above the absolute values — the trustworthy part first (E3.6e).
- **The value is secondary and hedged**: `~0.42 ±0.06` with the `estimated` badge, a dotted underline and the `not_validatable` ring. The band comes from the damper model's own range, computed by re-running ζ with each estimated input at the ends of its own tolerance — never a blanket percentage (§9). The band is displayed **wherever ζ is** (E3.6b): the card, the compare view, the property detail and every export.
- **Two shaft speeds, per corner (E3.6a).** The card front/rear columns show the *low-speed* value; a `50 / 200 mm/s` segmented control inside the card switches both columns (the two defaults in
`fields.yaml`; 5 mm/s sits below the model's friction floor and is not offered), and the detail lists all four corners at both speeds so a mirrored car reads as four equal values rather than an assumption. Both speeds' numbers are always reachable in one tap; a single averaged ζ is never shown.
- **What changes this panel**, inside the card, collapsed by default: four levers with the direction and the relative size of their effect — oil viscosity (heavier → more), piston holes (more → less low-speed), spring rate (stiffer → lower ζ at the same damper), motion ratio / shock angle (laying the shock down → less wheel damping). Each row is a sentence, not a slider.
- **Absent gracefully.** No damper data → the card is `missing` (no numeral), the direction line is replaced by *Not computable yet*, and the "what changes this" panel still opens — teaching without pretending. No estimate is manufactured from a spring rate alone.
- **Validation ring is always present**; in v1 the card is unvalidated like every other.

### 10.19 Mass and CG card

CG height is **inferred, never fetched from a scale session** — corner scales weigh the car and cannot locate its centre of gravity (review P-06; the spec's own example claiming "corner scales" is the defect this card exists to prevent).

- **Route is the headline, not the number.** The card shows which route produced h: `plumb-line` (four corner weights at two ride heights — a real measurement of h), `component estimate` (massed parts and their heights — an inference), or `inherited` (another car's value).
- **Badge by route:** plumb-line → `estimated` with the stored ± on the numeral and the words *measured by plumb-line*; component estimate → `estimated` with the range and *derived from component masses, ±8 mm*; another car → `inherited` with the source. **CG height never carries `computed`** — there is no instrument in the app's tool list that measures it directly, so a solid numeral would be a lie.
- **What it makes uncertain, stated on the card and on the analysis:** *Absolute load transfer and roll angle move with h; the front/rear balance split is robust to it* (the review measured ±0.13 on balance across h = 24–32 mm, against ±14.5% on total transfer). The card prints both columns so the user knows which numbers to distrust.
- **Editable but not fetchable:** no "import from scales" affordance exists anywhere in the app. A scale session can supply corner masses; it cannot supply h, and the UI says so in one line under the field.

### 10.20 Save / action bar

Sticky at the bottom of an editor: `Revert` (text, 44 px) · "1 change not saved" (`bodySmall`, flex) · `Save setup` (filled, min 148 px). It appears when the first change is made; it does not animate in from off-screen — it fades over 160 ms in place.

### 10.21 Banner

See §10.13. Banners never stack. If two conditions are true, the more severe one wins and the second is a row-level state.

---

## 11. Accessibility

- **Touch targets:** 44 × 44 minimum everywhere; 48 × 48 for primary actions and steppers. Visual size may be smaller than the target (icons 20–24 inside a 44 box). Sliders get a 44 px hit area regardless of track thickness.
- **Contrast:** every text pair in §2.4 clears AA. Numerals clear AAA. Non-text UI (borders, tracks) clears 3:1.
- **Not colour alone:** every delta carries an arrow glyph and a sign; every state change carries a word ("Not computable yet", "Undefined for this geometry") or an icon.
- **Accessibility name:** a compound value is one accessible node — the group carries the `aria-label`,
  its visual children are `aria-hidden` — with a spoken sentence: "Roll centre, front, 22 millimetres, up 3 from saved, inherited from the MTC2 template, computed, not yet validated". The visual split into number + unit + ring must not become three reads; the provenance and validity suffixes are appended in a fixed order (provenance, then validity).
- **The ring is never the only carrier of its meaning:** it has a label ("not yet validated") and the surface's own sentence repeats it, so a screen-reader user is not asked to interpret a glyph.
- **Focus order** follows the visual order top-to-bottom; the app bar's overflow is last. Expanded
  panels carry `aria-expanded` and `aria-controls`, and collapsed content is genuinely not rendered
  (or `hidden`), not merely visually hidden — `display: none` and the accessibility tree agree, which
  they do not when a panel is faded to zero opacity or pushed off-screen.
- **Dynamic type** up to 1.3 with no truncation of values (§3.4).
- **Reduced motion** shortens every transition to 1 ms and removes slides (§7).
- **Landscape / tablet:** the phone layout is the product. On widths above 600, the content column is centred at 600 max; the compare table may show both A and B side by side indefinitely. No two-pane master-detail in v1.

---

## 12. Web implementation map

Every value in §2–§9 is a CSS custom property in `web/src/theme/tokens.css`, declared once for the
dark theme (the default) and overridden for the light theme. The M3 role **names** are kept, because
every table above uses them and renaming them would churn the whole document for no gain; what is
gone is Material as a *mechanism* — there is no `ThemeData`, no `ColorScheme`, no component theme.

```css
:root {
  color-scheme: dark;

  /* Surface — dark (default) */
  --surface:                    #121410;
  --surface-container-lowest:   #0B0C09;
  --surface-container-low:      #171A14;
  --surface-container:          #1C1F18;
  --surface-container-high:     #24281F;
  --surface-container-highest:  #2D3127;
  --on-surface:                 #E8EADF;
  --on-surface-variant:         #A8AD9C;
  --outline:                    #767C69;
  --outline-variant:            #3C4034;
  --primary:                    #C6EF6E;
  --on-primary:                 #1A2100;
  --primary-container:          #38480C;
  --on-primary-container:       #DCF9A4;
  --secondary:                  #A9C9BC;
  --tertiary:                   #E4B78C;
  --error:                      #FFB4A2;
  --on-error:                   #5C1600;

  /* Domain colours the palette has no role for */
  --delta-up:        #C6EF6E;
  --delta-down:      #9FC8C0;
  --warning:         #E9C46A;
  --geometry-line:   var(--on-surface-variant);
  --geometry-guide:  var(--warning);
  --grid-line:       color-mix(in srgb, var(--outline) 12%, transparent);

  /* Type: system faces, no @font-face, no webfont */
  --font-ui:   ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
               "Helvetica Neue", Arial, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas,
               "Liberation Mono", monospace;
  --fs-display-small: 1.875rem;  --lh-display-small: 2.25rem;
  --fs-headline-medium: 1.25rem; --lh-headline-medium: 1.625rem;
  /* …one pair per row of §3.2 and §3.3, in rem */

  /* Space, radius, motion */
  --s-1: 0.25rem; --s-2: 0.5rem; --s-3: 0.75rem; --s-4: 1rem;
  --s-5: 1.25rem; --s-6: 1.5rem; --s-8: 2rem; --s-10: 2.5rem;
  --s-12: 3rem; --s-16: 4rem;
  --radius-xs: 4px; --radius-sm: 8px; --radius-md: 12px;
  --radius-lg: 16px; --radius-xl: 24px; --radius-full: 999px;
  --dur-press: 100ms; --dur-quick: 160ms; --dur-standard: 220ms;
  --dur-emphasised: 300ms; --dur-settle: 400ms;
  --ease-standard:   cubic-bezier(0.2, 0, 0, 1);
  --ease-emphasised: cubic-bezier(0.05, 0.7, 0.1, 1);
}

@media (prefers-color-scheme: light) { :root { /* light overrides from §2.3 */ } }
[data-theme="light"] { /* the user's explicit choice wins over the system default */ }
[data-theme="dark"]  { /* …and back */ }
```

- **Colour is explicit, never generated from a seed.** There is no `color-mix` (or equivalent) in the
  palette itself — the tonal steps are chosen, not computed — except for two derived overlays where
  the derivation *is* the rule: the banner's 9 % warning fill and the 12 % grid line. A generated
  palette is the single fastest way to lose the contrast ratios in §2.4, which E8.7c tests.
- **Both themes exist as a data attribute as well as a media query**, because the theme is a stored
  preference (§3 of `flows.md`): the media query is the default, and the attribute is the override.
  `color-scheme` is set on each so form controls and scrollbars follow.
- **Type is `rem` throughout**, so a larger root font grows type without moving boxes (§3.4); a `px`
  font size in the token file is a bug, and the reason is E8.7b's second mechanism.
- **Numbers**: one `<Number>` component takes a `PropertyView` (architecture §8) — never a bare
  number — and renders the value span, the unit span, the ring and the accessible name, applying
  `font-variant-numeric: tabular-nums`. No screen formats a number itself; the formatter is
  `web/src/format/`.
- **Component classes to set once:** `.card` (background `--surface-container`, 1 px
  `--outline-variant` border, `--radius-lg`, padding `--s-4`, no shadow), `.nav` (height 72 + safe
  area, no indicator), `.slider` (track 5, thumb 22, 44 px hit area via padding, `accent-color` not
  used — the track and thumb are styled explicitly), `.chip` (32/`--radius-sm`), `.input` (52/
  `--radius-sm`), `.divider` (1 px `--outline-variant`), `.banner`.
- **Sheets** are `<dialog>` with `::backdrop` at the 32 % scrim: `<dialog>.showModal()` gives focus
  trapping, Escape, inert background and the top layer for free — three things the Flutter design
  had to build, and three things a `div` sheet gets wrong. The swipe/edge-gesture caution in
  architecture §3.1 applies: the scrim tap and a close button are both mandatory.
- **Press feedback** is a background step (`.active`), 100 ms linear. There is no ripple; a scaled
  Material ripple is one of the few things the web has no faithful equivalent for, and importing one
  costs more code than the feedback is worth.
- **State:** a change is a `SetupDraft` diffed against the saved setup; the save bar reads the diff
  length. Uncomputable values are the `Solved<T>` union (`notMeasured` / `undefined`), **never**
  `number | null` — the physics package returns those and the UI never invents a zero.

```ts
// Two orthogonal axes on every formatted value. Neither is derivable from the other.
export type Provenance = 'computed' | 'estimated' | 'inherited' | 'missing' | 'undefined';
export type Validity   = 'unvalidated' | 'validated';   // + the evidence record's model version

export interface FormattedValue {
  value: number;               // never null: missing/undefined never reach the formatter —
                               // they render as a separate claim type (architecture §8, PropertyView)
  unit: string;
  decimals: number;
  provenance: Provenance;
  validity: Validity;
  tolerance: Tolerance | null; // null means: print the ~ and nothing else
  source: ProvenanceSource | null; // named for estimated / inherited, null for computed
}

// A claim that is not a number. Grip and every inferred sentence use this, never FormattedValue.
export interface Inference {
  sentence: string;            // contains "all else equal" when tier === 'inferred'
  tier: 'firm' | 'inferred' | 'speculative';
  phase: 'entry' | 'mid' | 'exit' | null;
  reversesIf: string | null;
  doesNotClaim: string | null;
}
```

- **The formatter never fills a tolerance.** `tolerance` is nullable on purpose; null prints the `~`
  alone. A build check asserts no call site constructs a `Tolerance` outside the document decoder.

---

## 13. Do not

- Do not generate the palette from a seed colour.
- Do not put a unit inside the number string, or inside the same text node as the number.
- Do not colour a value by whether it went up or down.
- Do not show `0` for a missing measurement, or `NaN`, or `--`.
- Do not animate a value while a finger is dragging it.
- Do not put a stepper next to a slider.
- Do not add an eighth card to Analysis.
- Do not stack two banners.
- Do not add a navigation bar to a detail screen that has a save bar.
- Do not use a shadow where a hairline will do.
- Do not print a tolerance the source document did not record. No ±15%, no ±10%, no "approx".
- Do not render an inherited value as a solid numeral, and do not hide its source in a footnote.
- Do not let a grip claim look like a computed number: no numeral, no unit, no badge, no ring — it is inference.
- Do not use "push" or "loose". The vocabulary is understeer / oversteer, entry / mid / exit.
- Do not show a damping-ratio magnitude as the card's leading line; the direction leads.
- Do not offer corner scales as a source for CG height, and do not give CG height a `computed` badge.
- Do not colour-code the interpreter tiers; border style and the word carry the tier.
- Do not copy RC3's screens, wording or icons — the vocabulary in this document is the app's own.
