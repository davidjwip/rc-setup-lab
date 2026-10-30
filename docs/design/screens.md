# Screens — Setup Lab

Screen-by-screen inventory: purpose, actions, every state, the data on screen.
Companion to `flows.md` (paths and navigation) and `glossary.md` (terminology and copy).

No code. Route strings, provider names and state names are the contract.

---

## 0. Conventions used throughout

### 0.1 The six states

Every screen declares its behaviour in all six. Where a state cannot occur, it says so — an
empty cell is a design hole.

| State | Meaning |
|---|---|
| **empty** | Nothing to show yet: no car, no setup, no measurements, no comparison |
| **partial** | Some data present, so some analysis exists and some is blocked by named gaps |
| **complete** | Everything this screen needs is present and computed |
| **undefined-geometry** | All inputs present but the maths has no answer (parallel links, coincident points, zero-length link) |
| **error** | A load, parse, save or compute failure with a stated recovery |
| **offline** | Network needed and absent — always informational, never blocking, and absent from every screen that has no network need |

### 0.2 The value badge

One component renders every number in the app, in four variants. This is the mechanism that
keeps "we can't compute this" honest.

| Variant | Look | Used when | Tappable |
|---|---|---|---|
| `computed` | Solid value + unit | All inputs measured or library-sourced | → property detail / field detail |
| `estimated` | `~` prefix, dotted underline | Any input is `estimated` | same, plus "why is this approximate" |
| `missing` | No numeral; `Not computable yet` + first missing input | `MissingInputs` | → the measure task for that input |
| `undefined` | No numeral; `Undefined for this geometry` | `UndefinedGeometry` | → the two fields involved + what to check |

### 0.3 Delta chips

`▲ +4 mm` / `▼ −2 mm` / no chip when equal or no baseline. Direction is always arrow + sign +
word in the accessible label, never colour alone.

### 0.4 Alignment with `docs/specs/spec.md`

The spec is normative for physics, data and tests; this file is normative for UI. Three places
where the vocabulary differs, resolved once so an implementer does not have to choose:

| Topic | Spec | On screen |
|---|---|---|
| Provenance | `measured`, `unknown`, `estimated`, `manufacturer`, `third_party`, field-absent | Badges read **measured**, **from template**, **approximate**, **not measured**. `from template` covers both `manufacturer` and `third_party`; the badge's detail line names which. |
| Camber gain units | deg/deg | Headline reads **deg per 10 mm bump** (what a racer measures with a setup station); the detail shows deg/deg, and the two are the same curve. |
| Bump steer units | deg/mm | Headline reads **mm of toe per 10 mm bump**; the detail shows deg/mm. |
| Outputs without a card | motion ratio, ride frequency, roll-centre migration, camber-at-roll, toe-at-roll, Ackermann | All exist as drill-downs inside cards 3–6. None becomes an eighth card. |

### 0.5 Route → screen map

| Route | Screen | Branch |
|---|---|---|
| `/welcome` | Onboarding | shell-less |
| `/garage` | Garage | Garage |
| `/garage/new` | New car | Garage |
| `/garage/import` | Import | Garage |
| `/car/:carId` | Car | Garage |
| `/car/:carId/edit` | Edit car | Garage |
| `/car/:carId/geometry` | Geometry overview | Garage |
| `/car/:carId/geometry/wizard/:groupId` | Measure group | Garage |
| `/car/:carId/geometry/wizard/:groupId/:fieldId` | Measure field | Garage |
| `/car/:carId/geometry/field/:fieldId` | Field detail | Garage |
| `/car/:carId/setups` | Setup list | Garage |
| `/car/:carId/setups/new` | New setup | Garage |
| `/car/:carId/setup/:setupId` | Setup values | Garage |
| `/car/:carId/setup/:setupId/analysis` | Analysis | Garage |
| `/car/:carId/setup/:setupId/analysis/:propertyId` | Property detail | Garage |
| `/compare` | Compare | Compare |
| `/compare/pick/:slot` | Compare picker | Compare |
| `/learn` | Learn | Learn |
| `/learn/path` | Learning path | Learn |
| `/learn/:conceptId` | Concept | Learn |
| `/settings` | Settings | shell-less |
| `/settings/units` | Units | shell-less |
| `/settings/data` | Data & backup | shell-less |
| `/settings/library` | Library | shell-less |

Sheets, not screens: Why, Export, Version history, Unit picker, Lateral-g picker, Field
explainer (inline in the wizard).

---

## 1. Onboarding — `/welcome`

**Purpose.** Explain the product in one screen and get to a car, without a tutorial carousel.
**Primary.** *Model my car* → `/garage/new`.
**Secondary.** *Start from a template* → `/garage/new?intent=library`; *Just show me* → loads
the read-only sample car.

**Data.** Product name and one-line promise; tool checklist (calipers — needed; scales — helpful;
20 minutes — helpful); the three actions; privacy line ("No account. Nothing leaves this phone.").

**States.** empty n/a · partial n/a · complete n/a · undefined-geometry n/a · error n/a ·
offline: one line under the library door — "Templates are built in; no connection needed."

**Notes.** Shown once (`seenOnboarding`). Never re-shown after "Skip". Reachable again from
Settings → About → "Show welcome again" (useful for demos, harmless for users).

---

## 2. Garage — `/garage`

**Purpose.** The home. Every car the user owns, with just enough status to choose one.
**Primary.** Open a car.
**Secondary.** *Add a car* (FAB, bottom-right); overflow: *Import*, *Settings*.

**Data per car card.** Name · class/scale chip · geometry completeness (ring + "Front 9/13" on
tap) · setup count · last-opened setup name and date · baseline name · a "Sample" badge and
*Remove* on the sample car · a "Draft" dot when a setup has unsaved changes.

**States.**
- **empty** — chassis outline illustration, "No cars yet.", primary *Add a car*, secondary
  *Import a car file*, one line: "You can stop measuring and finish later."
- **partial** — cards carry a completeness ring and a quiet line "Geometry incomplete — 4 cards
  can't be computed" which opens the geometry overview.
- **complete** — normal list.
- **undefined-geometry** — a small hollow-dot chip on the car card: "1 property undefined" →
  geometry overview. Never a red badge for something that is a legitimate geometry.
- **error** — per-card failure: "This car couldn't be opened." with *Export raw file* and
  *Repair* (keeps the car, drops the unreadable setup). The other cards render normally.
- **offline** — invisible. No sync, no badge, no banner.

**Notes.** Sort: last opened. No folders, no tags, no search until > 8 cars (then: a filter
chip row, not a search field). Long-press a card = the same menu as its overflow; nothing is
swipe-only.

---

## 3. New car — `/garage/new`

**Purpose.** Create a car in three fields and one choice of door.
**Primary.** *Create*.
**Secondary.** Switch door (Template / From scratch / Import); *What do I need?* → a 3-line
sheet.

**Data.** Name (text, pre-filled "My car"), class (TC / buggy / pan / other), scale (1/10,
1/8, other), drive (2WD / 4WD / FWD), door selector, and — if Template — a short list of
templates with class filter, each showing its `source` line ("measured from a club car, 2026").

**States.**
- **empty** — name field empty; *Create* disabled with the reason inline ("Give it a name").
- **partial** — template chosen, identity half filled; *Create* enabled.
- **complete** — all identity fields valid.
- **undefined-geometry** — n/a at creation; a "from scratch" car is `partial` by definition.
- **error** — name collision: "You already have a car called 'T4'. Save anyway?" (allowed —
  names are labels, ids are ids).
- **offline** — library door shows only bundled templates: "Built-in templates. More available
  when you're online." with the library count.

**Notes.** Never asks for manufacturer, model year, motor, ESC or gearing. That is RC3's
database, not physics, and it is what made the old app feel like admin.

---

## 4. Import — `/garage/import`

**Purpose.** Bring in a car model or setup from another device or another racer, with the
provenance intact.
**Primary.** *Import*.
**Secondary.** Paste text / pick file / (later) open from URL.

**Data.** Paste box or file picker; after parse: a preview card — car name, class, measurement
count, setup count, `schema_version`, per-field provenance summary ("38 measured · 4 library ·
2 unknown"); a list of warnings (unknown fields ignored, newer schema, missing sources); the
import action.

**States.**
- **empty** — "Paste a Setup Lab file, or choose one."
- **partial** — file parsed with warnings; preview shown; import allowed.
- **complete** — clean parse.
- **undefined-geometry** — imported geometry is degenerate: a warning line "This model has a
  degenerate front geometry (parallel links); roll centre will read as undefined" — still
  importable.
- **error** — invalid JSON / wrong schema: an error list with the offending line, the file's
  claimed version, and *Copy diagnostics*. Never a stack trace in the UI.
- **offline** — n/a except URL import, which is disabled with the reason.

---

## 5. Car — `/car/:carId`

**Purpose.** The workspace hub for one chassis: what it is, how complete it is, and where to
go next.
**Primary.** *Open latest setup* (or *Create your first setup* when there is none).
**Secondary.** *Continue measuring* · *New setup* · *Edit car* (identity, mass, tyres) ·
*Duplicate car* (same chassis, second example) · *Export car* · overflow: delete.

**Data.** Name, class/scale/drive; a geometry card with per-subsystem completeness (Front 9/13,
Rear 0/13, Steering 5/7, Springs 4/6, Bars 2/3) and the single next action; key dimensions once
known (wheelbase, track F/R, mass, CG height) as a compact row of four; the last three setups
with dates and baseline flag; total setup count; a "template geometry" chip while library
values are still in use.

**States.**
- **empty** — brand new car: geometry card reads "No measurements yet", setups section shows
  "No setups yet" with *Create your first setup*; primary action is *Start measuring*.
- **partial** — the normal state for most of the first session: completeness ring, "6 more
  measurements unlock 3 cards", primary *Continue measuring*.
- **complete** — ring full, primary *Open latest setup*.
- **undefined-geometry** — a chip on the geometry card: "Front geometry is degenerate — roll
  centre undefined"; *What to check* opens the field detail for the two suspect fields.
- **error** — car file partially readable: the identity still renders, geometry shows "Couldn't
  read the geometry block" with *Export raw* / *Repair*.
- **offline** — n/a.

---

## 6. Edit car — `/car/:carId/edit`

**Purpose.** The four identity fields plus the car-owned numbers that are not hardpoints.
**Primary.** *Save*.
**Secondary.** *Re-measure* links per field (to the wizard) · *Mark unknown* per field ·
*Delete car* (bottom, destructive, requires typing the car's name once).

**Data.** Name, class, scale, drive; total mass; corner masses (if measured); unsprung mass (or
"estimated from library" chip); CG height (or estimated); tyre diameter/width F/R; spring free
length; damper stroke. Each row: value badge with provenance, and a "from measurement / from
library / unknown" line.

**States.** empty (name empty → save blocked with reason) · partial (some car-owned values
unknown, listed as such) · complete · undefined-geometry n/a · error (save failure keeps edits,
bar reads "Not saved — retry") · offline n/a.

**Notes.** This screen never shows setup-owned values except as a link. Duplicate-number
complaints are designed out here.

---

## 7. Geometry overview — `/car/:carId/geometry`

**Purpose.** See the model: which subsystems are done, what is still missing, and whether the
numbers look like a car. This is where a racer catches a typo before it poisons an analysis.
**Primary.** *Continue measuring* (resumes the last group at its next unanswered task).
**Secondary.** Per-group *Review / Edit* · *Compare to template* (every field, delta vs the
template it started from, biggest deltas first) · *Show outliers* · *Change model depth*
(Quick ↔ Full) · *Export raw geometry*.

**Data.** A front-view and side-view diagram with plotted hardpoints (tap a point → field
detail); completeness per group with counts; key dimensions; a completeness-derived
"unlocks" line: "4 of 7 analysis cards available"; the outlier list (fields outside expected
range or > 25% from the template).

**States.**
- **empty** — "Nothing measured yet." with the two model-depth options and *Start measuring*.
- **partial** — the working state: diagram shows what exists, dashed placeholders for what does
  not, per-group counts, *Continue measuring*.
- **complete** — full diagram, all counts full, "All 7 cards available".
- **undefined-geometry** — the affected corner is drawn with a warning marker and a chip naming
  the reason; the rest of the diagram still renders.
- **error** — diagram asset or geometry parse failure: "Couldn't draw the model." + the field
  list still renders as a fallback table + *Copy diagnostics*.
- **offline** n/a.

---

## 8. Measure group — `/car/:carId/geometry/wizard/:groupId`

**Purpose.** One subsystem's ordered task list, with progress and a clear next step.
**Primary.** *Start* / *Continue* → the next unanswered field.
**Secondary.** Tap any task to jump · *Mark group complete* · *Skip group* · *Same left and
right* toggle · *Group explainer* (what these measurements unlock).

**Data.** Group name and car state ("wheels off, car on blocks"); progress "9 of 13"; estimated
time remaining ("~7 min"); the task list, each with label, status
(`answered · unknown · estimated · library · unanswered`), the analysis it unlocks, and any
dependency ("needs front-left wheel off"); the group's live result card once computable ("Front
roll centre: 22 mm").

**States.**
- **empty** — nothing answered: progress 0, one primary.
- **partial** — mixed statuses; *Continue* targets the first unanswered.
- **complete** — all answered or explicitly skipped; the live result card is the hero; primary
  becomes *Next group: Rear end*.
- **undefined-geometry** — the live result card shows "Undefined for this geometry" with *What
  to check*; the task list is unaffected.
- **error** — a saved value fails to persist: the task row shows "not saved" and a retry on
  that row only.
- **offline** n/a.

---

## 9. Measure field — `/car/:carId/geometry/wizard/:groupId/:fieldId`

**Purpose.** Exactly one measurement, unambiguously, in under a minute.
**Primary.** *Save and continue*.
**Secondary.** *Skip — not sure* · *Use library value* (only when one exists) · *Mark
approximate* · *Same left and right* toggle · *Why this matters* (inline explainer sheet) ·
*Previous / Next* within the group.

**Data.** Group + position ("Front · 3 of 9"); diagram with two arrows, feature labels and the
datum line, side and front view; field label; "Measure from" / "To" / "Datum"; usual range with
units; current value and provenance; unit toggle; numeric keypad; ±0.5 stepper; the list of
analysis cards this field unlocks.

**States.**
- **empty** — no value; *Save* disabled with the reason ("Enter a value, or skip").
- **partial** — value entered but out of expected range: inline amber note under the number
  ("That's about 3× the usual 20–30 mm — wrong unit?") with *Fix unit* and *That's correct*;
  saving is still allowed.
- **complete** — valid value, saved; auto-advance to the next task.
- **undefined-geometry** — n/a on this screen by construction: one field cannot be degenerate.
  If the field is the second of a degenerate pair, an informational line appears: "With the
  value you just entered, the front links are parallel — roll centre will be undefined."
- **error** — save fails: the value stays in the field, the button reads *Retry*, no navigation.
- **offline** n/a.

**Notes.** Every action here is one-thumb reachable; the primary is bottom-anchored; the OS
keyboard is never used.

---

## 10. Field detail — `/car/:carId/geometry/field/:fieldId`

**Purpose.** The provenance and consequences of a single number: where it came from, when, how
sure we are, and what depends on it.
**Primary.** *Re-measure* → the measure field screen.
**Secondary.** *Mark unknown* · *Change source* (measured / library / approximate) · *See what
uses it* · *Copy field id* (for issue reports).

**Data.** Value + unit + provenance badge; method note and date; the diagram for that feature;
the dependent analysis properties, each with its computed value and a badge showing whether
*this* field is load-bearing for it; a "changed from" line if the value was edited (old → new,
plus setup version).

**States.** complete (measured) · complete (library, shown with the template name and version) ·
partial (estimated, with the tolerance) · empty (unknown: "Not measured. Used by: roll centre,
camber gain.") · undefined-geometry (this field is part of a degenerate pair: named partner
field) · error (field missing from the record) · offline n/a.

---

## 11. Setup list — `/car/:carId/setups`

**Purpose.** The racer's setup sheets for one car: what was run, when, where, and against what.
**Primary.** Open a setup.
**Secondary.** *New setup* · *Copy from…* · *Set as baseline* · *Duplicate* · *Export sheet* ·
*Version history* · delete.

**Data per row.** Name ("S04 · Track A, 26 °C") · date · conditions (track, air/track temp,
tyre) · baseline flag · changes vs baseline count ("4 changes") · draft dot · analysis health
("all 7 cards" / "5 of 7 — geometry incomplete" / "1 undefined").

**States.**
- **empty** — "No setups yet. A setup records what you ran, not what you measured." Primary
  *Create your first setup*; secondary *Copy from template defaults*.
- **partial** — rows exist; some carry a draft dot or an incomplete-analysis chip.
- **complete** — normal list, baseline pinned to the top under a "Baseline" header.
- **undefined-geometry** — rows show "1 undefined" chip; opening the setup lands on a card in
  the undefined state.
- **error** — one setup unreadable: row reads "This setup couldn't be opened" with *Export raw*
  and *Remove from list*.
- **offline** — export sheet still works (local PDF); "Share to another app" is unavailable
  with the reason on the disabled control.

---

## 12. New setup — `/car/:carId/setups/new`

**Purpose.** Create a setup fast, usually by copying.
**Primary.** *Create*.
**Secondary.** *Copy from* (any existing setup, or template defaults) · *Start blank* · *Name
from track* (pre-fills name and conditions from the last-used track name).

**Data.** Name (pre-filled "S05"); copy source picker showing the last three setups with their
conditions; conditions block (track, air temp, track temp, tyre) pre-filled from the copied
source and clearly marked as "copied — update if different"; a preview of which analysis cards
will be computable.

**States.** empty (no name) · partial (copied values marked as inherited) · complete · 
undefined-geometry (banner: "Geometry is incomplete — this setup's analysis will show 3 cards
as not computable") · error (save failure, retry inline) · offline n/a.

---

## 13. Setup values — `/car/:carId/setup/:setupId`

**Purpose.** Read and change the setup. The editing surface.
**Primary.** *Save as v2* (only appears when dirty).
**Secondary.** Segment toggle *Setup | Analysis* · *Discard changes* · *Compare* · *Version
history* · *Export sheet* · per-row *Reset to baseline value*.

**Data.** Two-segment header with the setup name and baseline chip; six sections in setup-sheet
order (ride height & droop · camber & toe · springs & bars · dampers · mounts & shims ·
conditions & notes); each row: label, value badge, unit, delta-vs-baseline chip, chevron to the
field explainer; inherited rows marked "from car ›"; a sticky draft bar when dirty ("3 changes ·
Discard · Save as v2").

**States.**
- **empty** — new setup created from template defaults: every row has a value; if a value is
  genuinely unset it reads "not set" and the affected card is named.
- **partial** — some rows unset or unknown → inline note at the affected section: "Wheel rate
  can't be computed — front spring rate not set."
- **complete** — all values set.
- **undefined-geometry** — a banner above the analysis segment only: "1 property undefined for
  this geometry"; values are unaffected.
- **error** — save failed: bar reads "Not saved — retry", edits retained, navigation blocked
  until resolved or discarded.
- **offline** — invisible except on *Export sheet → share*, which degrades to a local file.

**Notes.** No edit mode, no modal forms: every value is an inline field with the app keypad.
Long-press on a value shows its explainer (equivalent to the chevron).

---

## 14. Analysis — `/car/:carId/setup/:setupId/analysis`

**Purpose.** The answer. Seven properties, front and rear, and what changed.
**Primary.** *Compare* (with baseline pre-loaded) — or *Change something* when no baseline
exists.
**Secondary.** Per card: `?` → Why sheet, tap → property detail; header: *Lateral g* picker
(default 1.0 g) · *Baseline* chip/menu · overflow: export sheet, copy diagnostics.

**Data.** Header: setup name, baseline comparison target ("vs S01 baseline"), any confidence
chip ("2 estimated inputs"), and the analysis-health line when incomplete ("4 of 7 computed").
Seven cards, each: property name, front value, rear value, delta chip, `?`.

| Card | Headline numbers | Inside the detail |
|---|---|---|
| Load transfer | total g at the chosen lateral g; front share % | front/rear split in grams, per-axle values |
| Roll stiffness | N·m/deg front and rear; °/g roll | % front, contributions from springs vs bars |
| Roll centre | height front/rear, mm | migration over ±10 mm bump, instant-centre positions |
| Camber gain | °/10 mm bump front/rear | camber at 1 g roll, camber curve |
| Bump steer | mm toe per 10 mm bump front/rear | toe curve, toe at 1 g roll |
| Wheel rate | N/mm front/rear | motion ratio, spring rate, wheel-rate curve over bump |
| Damping ratio | ζ front/rear | damping coefficient, critical damping, low/high-speed split |

**States.**
- **empty** — a setup with no values at all (rare): one card computed if possible, the rest
  `missing` with named inputs; header reads "0 of 7 computed" and the primary is *Add setup values*.
- **partial** — mixed `computed` and `missing` cards; the missing ones are visually quiet
  (dashed, no numerals) and each names its first missing input with an *Add it ›* link carrying
  `returnTo`.
- **complete** — seven `computed` cards, deltas against baseline where they differ.
- **undefined-geometry** — affected cards render the `undefined` variant with the reason and
  *What to check*; the other cards are unaffected. The header carries "1 undefined" so the user
  knows before scrolling.
- **error** — a property throws: that card becomes "Something in the maths failed" with *Copy
  diagnostics*; the remaining six render. The header notes "1 property failed".
- **offline** — invisible. No card needs the network. Export sheet offers local file only.

**Notes.**
- Hard cap of seven cards. Any eighth property is a drill-down, not a card.
- No handling verdicts. Effect lines are directional and mechanical ("moved 6% of the load
  transfer forward"), never "this will understeer".
- Scroll position is preserved per setup (`PageStorageKey`), so the sheet → back loop never
  loses the user's place.

---

## 15. Property detail — `/car/:carId/setup/:setupId/analysis/:propertyId`

**Purpose.** Depth on one property: the curve, the numbers behind it, and what moves it.
**Primary.** *Why?* → the Why sheet (equation with the user's numbers).
**Secondary.** *What if?* (live slider on the dominant input, not saved, labelled "scenario") ·
*Compare* (opens the same property in comparison mode) · *Show inputs* (the fields used, with
provenance) · *Read the concept*.

**Data.** Property name and the current value(s); a chart over bump travel (roll centre,
camber gain, bump steer, wheel rate) or over lateral g (load transfer, roll stiffness, roll
angle), with the measured-range boundary drawn and the beyond-range segment dashed; a table of
values at 0, 2, 5, 10 mm (or 0.5, 1.0, 1.5 g); the equation; the **input sensitivity ranking**
("what moves this, biggest first": +1 mm at the front upper inner mount → +2.1 mm roll centre;
+1 N/mm front spring → 0.4% less front load transfer); coupling notes ("also changes camber
gain by 0.3°/10 mm"); the list of inputs used with badges.

**States.** complete · partial (some samples beyond the measured range → dashed, labelled) ·
empty (no value: the `missing` variant plus the list of what is needed) · undefined-geometry
(the reason, the two fields, what to check, and a short explanation of what "the instant centre
is at infinity" means in racer terms) · error (chart fails to build → numeric table renders as
fallback, *Copy diagnostics*) · offline n/a.

---

## 16. Compare — `/compare`

**Purpose.** Two setups side by side: what changed, and what the change does.
**Primary.** *Swap*; row tap → property detail in comparison mode.
**Secondary.** Tap a slot → picker · *Set B as baseline* · *Save as note* · *Export sheet* ·
*Show unchanged*.

**Data.** Two slot cards (car, setup, version, date, conditions); a conditions-difference
warning when track/temp/tyre differ; sections in fixed order: **Consequences** (7 properties,
delta only), **What you changed** (inputs that differ, grouped by subsystem), **Unchanged**
(collapsed count), **Conditions**. Each consequence row: A value · B value · delta · one-line
mechanical effect. Each change row: label · A · B · delta in the unit the racer thinks in
("+1.0 mm shim" not "+1.0 mm y").

**States.**
- **empty** — fewer than two setups on the device: "A comparison needs two setups." with
  *Duplicate your baseline to start a variant* and *Pick two setups*.
- **partial** — one slot filled (A) and B empty → B slot is an empty card with *Pick a setup*;
  rows show A only, no deltas.
- **complete** — both slots, ≥1 consequence, consequence rows expanded, unchanged collapsed.
- **undefined-geometry** — rows for the undefined property read "Not comparable — undefined in
  A"; the rest render.
- **error** — a slot's setup fails to load: the slot becomes "Couldn't load this setup" with
  *Choose another*; the other slot stays.
- **offline** — *Export sheet* works to a local file; "Share" disabled with the reason.
- **cross-car** — banner "Different chassis geometry — deltas are real but not like-for-like",
  and the "What you changed" section is suppressed.
- **identical setups** — one line: "These two setups are identical." + *Show unchanged*.

---

## 17. Compare picker — `/compare/pick/:slot`

**Purpose.** Choose the setup for one slot without losing the other.
**Primary.** Select a setup.
**Secondary.** Filter by car · *Show only this car's setups* · *Duplicate a setup* · back.

**Data.** Car groups (name, class), each with its setups: name, date, conditions, baseline flag,
version count; the currently-selected other slot pinned at the top as a reminder of what is
being compared against.

**States.** empty (no setups anywhere → *Create a setup* deep-linking to the most recent car) ·
partial (one car only, no filter needed) · complete · undefined-geometry n/a · error (a setup
fails to read → row disabled with the reason) · offline n/a.

---

## 18. Learn — `/learn`

**Purpose.** The concept library, and the entry to the guided path.
**Primary.** Open a concept or continue the path.
**Secondary.** Search (only if > 20 concepts) · *Concepts on my car* filter · *Jump to the number
I'm looking at* (recent analyses list).

**Data.** A "Start here" path card (7 steps, progress "2 of 7"); groups: **Setup physics &
terminology**, **Load transfer & balance**, **Springs, bars & roll stiffness**, **Camber &
roll centre**, **Toe, bump steer & steering**, **Dampers**; each concept: title, one-line
description, a "on your car" dot when the user's car has a computed value for it.

**States.** empty n/a (content is bundled) · partial n/a · complete n/a · undefined-geometry n/a ·
error (content pack missing → "The concept library didn't load." + *Restore built-in content*) ·
offline (video links disabled with "Video needs a connection. Written version below.").

---

## 19. Concept — `/learn/:conceptId?car=&setup=&from=`

**Purpose.** One idea, 200–350 words, at the moment it is needed.
**Primary.** *See it on my car* (returns to the analysis and highlights the card).
**Secondary.** *Next / previous in path* · *Mark step done* · *Related concepts* · back.

**Data.** Title; one-sentence definition; a diagram; the equation in words; "What it changes"
and "What changes it" lists; an optional **"On your car"** live card (front/rear values from the
given setup) or a worked example on the sample car, labelled as an example; "Where you meet
this in the app" (links to the analysis card, the wizard group, and the setup row); video link
if one exists; the concept's `source` line (which published source it paraphrases).

**States.** complete with car context · complete without context (example card instead) ·
partial (car context present but the property is `missing` → the card reads "Not computable on
your car yet — needs the front upper inner pivot" with *Add it ›*) · empty n/a ·
undefined-geometry (car context exists but undefined → the reason, in racer words) ·
error (concept id unknown → a search screen, not a crash) · offline (video disabled, text intact).

---

## 20. Learning path — `/learn/path`

**Purpose.** An ordered route through the concepts, following the structure of the source
articles, with one action per step.
**Primary.** *Continue at step 3*.
**Secondary.** Tap any step · *Reset progress* · back to all concepts.

**Data.** Seven steps: number, title, one line, "what you'll be able to answer", the one task on
your car ("measure your front roll centre"), duration ("~4 min"), completion check.

**States.** not-started (primary = *Start*) · partial (primary = *Continue at step n*, completed
steps ticked) · complete ("Path finished" + *Browse all concepts*) ·
undefined-geometry n/a · error n/a · offline n/a.

---

## 21. Settings — `/settings`

**Purpose.** Units, theme, defaults, data, about.
**Primary.** none (a settings list has no hero action).
**Secondary.** *Units* · *Data & backup* · *Library* · *About & credits* · *Show welcome again* ·
*Reset all data* (destructive, typed confirmation).

**Data.** Current units summary ("mm · N/mm · g"); theme (Dark — default / Light / System);
default lateral g (1.0); default model depth (Quick); storage used ("4 cars · 18 setups ·
2.1 MB"); app version and schema version; a dedication line to Bob Wright and a licensing note.

**States.** default · offline (Library row shows "updates need a connection", nothing else
changes) · error (storage unreadable → "Storage is having trouble" + *Export what's readable*) ·
other states n/a.

---

## 22. Units — `/settings/units`

**Purpose.** Set display units once, with the conversion visible.
**Data.** Length (mm / in), spring rate (N/mm / lb/in), mass (g / oz / kg), force (N / gf / lb),
angle (deg only), with a live example row ("172 mm = 6.77 in").
**States.** default · others n/a. Changing a unit never mutates stored values; the screen states
this once, plainly.

---

## 23. Data & backup — `/settings/data`

**Purpose.** Make the "your data is yours" promise operable.
**Primary.** *Export everything*.
**Secondary.** *Import a backup* · *Export one car* · *Where is my data?* (explains local-only
storage and the OS backup behaviour).

**Data.** Counts (cars, setups, versions), last backup date, storage location note, export
format (`setup-lab-backup.json`, schema version), and a restore preview ("this will add 3 cars,
replace 0").

**States.** empty (nothing to export → disabled with reason) · complete · error (export write
failure → path tried, and a retry) · offline n/a (file export is local).

---

## 24. Library — `/settings/library`

**Purpose.** Template chassis models and concept-pack versions.
**Data.** Installed packs (name, version, source, field count, date); available updates; each
template's provenance line.
**Primary.** *Check for updates* (the only network action in the app).
**States.** default (bundled packs listed) · offline ("Updates need a connection. Your installed
templates keep working.") · error (update check failed → "Couldn't reach the library", retry) ·
empty (no templates installed → "Restore built-in templates").

---

## 25. Sheets and shared components

| Component | Where | Contents |
|---|---|---|
| **Why sheet** | Any `?` on a value | 1) what it is (one sentence) 2) your numbers in the equation 3) why this direction, including the counter-intuitive case 4) what else moves 5) *Read more ›* |
| **Export sheet** | Setup, Compare | PDF sheet / PNG / text; car JSON; "what's included" checklist; offline note on sharing |
| **Version history** | Setup overflow | Versions newest-first: label, timestamp, "4 changes from previous", *Restore as new version* (never an in-place revert) |
| **Unit picker** | Any numeric input | mm/in etc., applied to that field's display only |
| **Lateral-g picker** | Analysis header | 0.5 – 2.0 g in 0.1 steps, default 1.0, with "typical club racing cornering" hint |
| **Field explainer** | Wizard, inline | The same concept text as the Learn entry, trimmed to the field, with a diagram |
| **Notice banner** | Global | One line, dismissible, never modal; used for "car not found", "newer file version", "draft restored" |

---

## 26. State matrix

`●` primary state for that screen · `○` possible · `–` not applicable.

| Screen | empty | partial | complete | undefined-geom | error | offline |
|---|---|---|---|---|---|---|
| Onboarding | – | – | ● | – | – | ○ |
| Garage | ● | ○ | ○ | ○ | ○ | – |
| New car | ● | ○ | ○ | – | ○ | ○ |
| Import | ● | ○ | ○ | ○ | ○ | ○ |
| Car | ● | ● | ○ | ○ | ○ | – |
| Edit car | ○ | ● | ○ | – | ○ | – |
| Geometry overview | ● | ● | ○ | ○ | ○ | – |
| Measure group | ● | ● | ○ | ○ | ○ | – |
| Measure field | ● | ○ | ● | ○ | ○ | – |
| Field detail | ○ | ○ | ● | ○ | ○ | – |
| Setup list | ● | ○ | ● | ○ | ○ | ○ |
| New setup | ○ | ○ | ● | ○ | ○ | – |
| Setup values | ○ | ○ | ● | ○ | ○ | ○ |
| Analysis | ○ | ● | ● | ○ | ○ | – |
| Property detail | ○ | ● | ● | ○ | ○ | – |
| Compare | ● | ○ | ● | ○ | ○ | ○ |
| Compare picker | ● | ○ | ● | – | ○ | – |
| Learn | – | – | ● | – | ○ | ○ |
| Concept | – | ○ | ● | ○ | ○ | ○ |
| Learning path | ○ | ● | ● | – | – | – |
| Settings | ● | – | – | – | ○ | ○ |
| Units | – | – | ● | – | – | – |
| Data & backup | ○ | – | ● | – | ○ | – |
| Library | ○ | – | ● | – | ○ | ● |

---

## 27. Copy for the states that matter most

Exact strings for the four situations the app must never paper over. Full deck in
`glossary.md` §4.

| Situation | String |
|---|---|
| Missing geometry | **Not computable yet** — Roll centre needs the front upper inner pivot height. `Add it ›` |
| Missing setup value | **Not computable yet** — Wheel rate needs the front spring rate. `Add it ›` |
| Degenerate geometry | **Undefined for this geometry** — The front upper and lower links are parallel in front view, so the instant centre is at infinity. `What to check ›` |
| Estimated inputs | **Approximate** — 2 inputs are estimated (±15%). `See which ›` |
| Beyond measured range | **Outside your measured range** — The solid line is within the travel you measured; the dashed line is an extrapolation. |
| No baseline | **No baseline yet** — Mark a setup as baseline to see what changed. `Set baseline ›` |
| Cross-car compare | **Different chassis geometry** — The deltas are real, but they are not like-for-like. |
| Identical compare | **These two setups are identical.** `Show unchanged` |
