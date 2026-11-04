# Flows — Setup Lab

The path through the app, end to end. Companion: `screens.md` (screen inventory, states, data)
and `glossary.md` (in-app terminology and the exact "we cannot compute this" copy).

Status: design, no code. Route names and state names here are the contract a web developer
implements with React Router and Zustand (D-19); the **URLs are real URLs**, so every destination is
addressable, shareable and reloadable, and the branch-persistence behaviour below is expressed against
browser history rather than an in-app back stack. `docs/specs/architecture.md` §3 is the binding
version of the back/refresh rules.

---

## 1. Who is holding the phone, and when

| Persona | Moment | What they have | What they want in the next 90 seconds |
|---|---|---|---|
| Club racer (primary) | Pit box, between heats, gloves on, sun on the screen | One car already modelled, a setup from last meeting | "I have 20 minutes. If I add a shim under the front inner link, what moves?" |
| Returning racer | Sofa, evening, watching Bob's videos | Nothing modelled, curiosity, some vocabulary | "Show me what roll centre actually does, on a car I can see." |
| Chassis nerd | Bench, calipers out, new kit | Time, tools, a chassis with no model | "Let me measure this properly once and share it." |

Three design consequences that shape every flow below:

1. **The at-track loop must be reachable in two taps from app launch** — tap the car, tap its
   latest setup, and it opens on the analysis. No menus on the way.
2. **Nothing may require reading to use.** Values first, words on demand.
3. **A number the app cannot stand behind is never shown.** No dash, no zero, no guess
   dressed up as a result.

---

## 2. Navigation model

### 2.1 The decision

**Three-destination bottom navigation — Garage · Compare · Learn — with a stack-based
drill-down inside each destination.**

- Each destination keeps its **own remembered path and scroll offset**, held in memory, so
  switching tabs returns you to the car you were looking at rather than to a list. That is the
  behaviour `indexedStack` gave us for free; on the web it is a `Map<destination, path>` in the
  router store (§3 of the architecture), because there is no per-branch navigator to preserve it.
  Every navigation is still one `push`, so the browser's Back button means "undo my last navigation"
  and never "replay my tab tour".
- No top-level tabs, no drawer, no hamburger. Three destinations is the most a gloved thumb
  can hit blind, and each maps to one verb: *my car*, *what changed*, *what does it mean*.
- The car → setup → analysis path is a **linear push stack**, not a set of peer tabs. There
  is exactly one obvious "back".

**Resolved (D-01, applied 30 Oct 2026).** The wireframes previously drew a four-item bar —
*Garage · Setup · Compare · Learn* — with *Setup* as a peer destination. It is rejected for one
reason: a *Setup* branch has no car until one is chosen, so it opens on a picker or on the last car
used, and the user has to hold "which car is this tab showing?" in their head — the same ambiguity
that made the old app's multiple setup pages confusing. With three destinations, "my car" is one
object and everything else hangs off it: setup, analysis, chassis, sheets, diff and export are all
pushes inside the Garage branch. Every wireframe now draws three items.

### 2.2 Why not the alternatives

| Option | Why rejected |
|---|---|
| Tabs across the top (Setup / Analysis / Geometry) | On a 360 px phone, three tabs of Latin words at the top are the least reachable part of the screen and the most thumb-hostile. Also implies the sections are peers, when they are a hierarchy: geometry → setup → analysis. |
| A single flat hub with no bottom bar | Learn becomes buried in a menu, which kills the teaching outcome for the returning racer, and Compare needs a home that is not "inside one car". |
| Analysis as its own bottom tab | Analysis without a selected car+setup is an empty screen with a picker — a context-free tab that always starts in an error state. Contextual routes avoid that class of bug entirely. |
| Modal sheets for everything | Sheets are used only for the "why?" explanation and one-off pickers; anything with its own scroll depth is a screen with a back button. |

### 2.3 Branch structure

```
Garage  (branch 0, initial)      Compare (branch 1)         Learn (branch 2)
/garage                          /compare                   /learn
  /garage/new                      /compare/pick/:slot        /learn/path
  /garage/import                                              /learn/:conceptId
  /car/:carId
    /car/:carId/edit
    /car/:carId/geometry
      /car/:carId/geometry/wizard/:groupId
      /car/:carId/geometry/wizard/:groupId/:fieldId
      /car/:carId/geometry/field/:fieldId
    /car/:carId/chassis
    /car/:carId/mass
    /car/:carId/sheets
      /car/:carId/sheets/diff?a=&b=
    /car/:carId/setups
      /car/:carId/setups/new
    /car/:carId/setup/:setupId
      /car/:carId/setup/:setupId/analysis
      /car/:carId/setup/:setupId/analysis/:propertyId
      /car/:carId/setup/:setupId/export
```

Global (pushed above the shell, no bottom bar): `/welcome`, `/settings`, `/settings/units`,
`/settings/data`, `/settings/library`.

Sheets (local state, not routes): **Why sheet**, **Export sheet**, **Version history**,
**Unit picker**, **Lateral-g picker**.

### 2.4 Back behaviour, stated as rules

| From | Back goes to | Notes |
|---|---|---|
| Analysis | Setup values | Same setup, same segment state |
| Property detail | Analysis | Scroll position restored exactly (a per-route scroll offset, keyed by card id) |
| Why sheet | Analysis | Sheet dismiss restores the card that opened it, briefly outlined |
| Concept opened from a number | Analysis | The originating card is highlighted for 1.5 s; `?from=analysis&car=…&setup=…` carries the origin |
| Measurement task saved from a missing-input row | Analysis | `?returnTo=analysis` — the user must not be stranded in the wizard after a 20-second fix |
| Compare row → property detail | Compare | Detail renders both slots (A and B), not one |
| Tab switch | The destination's remembered path | One history entry, not a replay of the branch; the remembered path and scroll offset are restored |

Rule: **no action ever lands the user somewhere they cannot get back from with one gesture.**
The one deliberate exception is the missing-input detour, which always carries `returnTo`.

### 2.5 Deep links

`/car/:carId/setup/:setupId/analysis` and `/learn/:conceptId?car=&setup=` are shareable URLs — the
ordinary kind, that paste into a message and open in a browser. If a link names a car that is not
present, the app opens Garage with a one-line notice: "That car isn't on this device — ask for the
car file, then import it." — not a 404, and not a dead end, because with documents living in each
device's own storage this is now the *common* outcome of a shared link rather than an edge case
(architecture §3.3).

---

## 3. The data spine: one owner per number

A complaint that recurs in the source thread is one value living in two places ("Tire Dia and
Tire Width … they are also in Setup page!? How is that handled?"). The rule:

> **A value is owned by exactly one of Car or Setup. The other side shows it as inherited,
> with a link to the owner, never as a second editable copy.**

| Owned by the **Car** (measured once, reused forever) | Owned by the **Setup** (changes between heats) |
|---|---|
| Hardpoint positions (base, unshimmed) | Ride height, per corner |
| Unsprung mass, corner masses, CG height | Camber, toe, per corner |
| Tyre diameter and width | Spring rate fitted, ARB setting/blade, shock oil and piston |
| Wheelbase and track (derived from hardpoints) | Droop limiter thickness, shims at each mount |
| Spring free length, damper body/stroke, ARB geometry | Tyre compound, diff oil, wing, additive |
| Per-mount **shim axis and shim gain** (1 mm of shim ≠ 1 mm of pivot movement — the thread records a 1 mm inner-link shim moving the pivot 0.8 mm on one car) | Track, air/track temperature, run label, notes |

Two consequences the flows depend on:

- **Effective geometry = car hardpoints + setup shim offsets.** Analysis always runs on the
  effective geometry, so "add a 1 mm shim" is a setup edit, not a re-measurement.
- **Droop is one field, not two.** It is stored per corner (spec §4.3.1 `corners.<c>.droop`);
  when ride height and the droop stop are already known, the app *offers* the derived value
  (`ride height − droop-stop travel`) pre-filled, so the user confirms instead of re-measuring.

### 3.1 The three inputs RC3 made the user guess

The thread contains two questions that repeat for a decade: *"How do you figure the arm
movement value that is on the setup page?"* and *"How do you properly figure the weight for
the sprung/unsprung weight?"* Both are **derived quantities the old app asked for as raw
input**. Setup Lab inverts that:

| Old input | Setup Lab behaviour |
|---|---|
| "Arm movement" | Never asked. Motion ratio is computed from the shock mount points. The wizard offers an optional **verification**: move the wheel 10 mm, read shock travel with the calipers; the app compares your reading to its computed value and says "within 4% — model agrees" or "off by 23% — one of these three points is probably wrong" and links them. |
| "Unsprung weight" | Never asked as a bare number. The app offers a **weighing recipe** (block the chassis, weigh the corner, subtract the sprung share). Until then the field is `unknown`: every property that needs it becomes `missing` and names it — there is no assume-zero path. A library value is an explicit opt-in, marked `inherited` with its source, never a silent default. |
| "Where is the chassis mount if the arm is swept?" | The mount is a 3-axis point. Fore/aft offset is a first-class field, so a swept arm is modelled as swept, not approximated by choosing "the closest hole". |

---

## 4. Flow 1 — First run, empty garage

**Goal:** get from install to "this app knows what it is doing" in under 30 seconds, without
a sign-up wall and without a tutorial carousel nobody reads.

```
Launch
  └─ /welcome            (only if seenOnboarding == false)
       ├─ "Model my car"        → /garage/new?intent=scratch  → Flow 2
       ├─ "Start from a template" → /garage/new?intent=library → Flow 2
       └─ "Just show me"        → loads the Sample car (read-only) → /car/sample/…
```

`/welcome` is **one screen, three cards, one paragraph total**:

1. **What this is** — "Setup Lab works out what a setup change does to your car before you
   spend a meeting on it. Everything stays on this phone."
2. **What you need** — calipers (essential); scales, a flat bench and 20 minutes (helpful).
   Both stated as chips, not prose.
3. **Start** — the three actions above.

No permissions requested at launch. No account. No network call. The bundled template
library ships in the app, so `first run` is genuinely functional offline.

**Empty garage** (`/garage`, no cars) is the real empty state and must earn its space:

- One illustration (a chassis outline, not a stock photo of a generic car).
- Headline: "No cars yet."
- Primary: **Add a car**. Secondary: **Import a car file**.
- One line of reassurance: "You can stop measuring and finish later — nothing is lost."

The sample car exists so the returning racer can see a completed analysis in the first
minute. It sits in a separate section labelled **Sample** with "Remove sample" — it never
masquerades as the user's own car.

---

## 5. Flow 2 — Creating a car

`/garage/new` offers **three doors**, in this order:

| Door | Who | What happens |
|---|---|---|
| **Template** (bundled, e.g. "1/10 TC — double wishbone, 4WD") | The 80% case; the racer owns a common chassis | Creates a *car model* pre-filled with library hardpoints. Every field carries the **`inherited`** badge and the template's name and version. The user's only job is to correct what differs. Analysis is available immediately — as `inherited`, never as a solid numeral — until measurements replace it. |
| **From scratch** | Chassis nerd, unusual car | Empty car, no geometry. Analysis shows the "not yet computable" state until Flow 3 supplies inputs. |
| **Import** | Second device, shared model | `/garage/import` — paste JSON, pick a file, preview, validate. |

Car identity is deliberately tiny — four fields: **name** ("T4 '21"), **class** (TC / buggy /
pan / other), **scale**, **drive**. Everything else is a measurement. There is no
"manufacturer, model year, motor, ESC, gearing" block: that is RC3's accountancy, not physics,
and it is what made the old app feel like a database.

**Timing target:** template car created and first analysis visible in **< 2 minutes**.

---

## 6. Flow 3 — The measurement wizard

This is the longest flow and the one that decides whether the product works. The success test
is "model your car in under 30 minutes with one caliper session".

### 6.1 Two depths, chosen up front

At `/car/:carId/geometry` the user picks a mode once (changeable later):

| Mode | Tasks | Time | Unlocks |
|---|---|---|---|
| **Quick model** | ~14 | ≈ 20 min | Load transfer, roll centre, camber gain, wheel rate (4 of 7 analysis cards) |
| **Full model** | ~34 | ≈ 45 min | All 7, including bump steer and damping ratio |

Each task displays **which analysis it unlocks** ("this one unlocks bump steer"). The user is
never asked for a number whose purpose is invisible. This is also the honest answer to "why
do you want my bellcrank pivot".

### 6.2 Order: by disassembly state, not by physics

The wizard is ordered so the car is taken apart once and put back together once. A racer will
not remove all four wheels, measure, refit, then remove them again — so physics order
(which would start with hardpoints) is the wrong order for the bench.

Task counts below are for the **Full model**; the Quick model takes a marked 14-task subset
(one per row where possible).

| Group | State of the car | What is measured | Typical tasks |
|---|---|---|---|
| **A. Bench** | Assembled, wheels on, on a flat surface | Total mass; corner weights (Full); wheelbase; track F/R; tyre diameter and width F/R; ride height F/R; droop limit F/R | 7–11 |
| **B. Front end** | Wheels off, car on blocks | Lower inner pivot, lower outer pivot, upper inner pivot, upper outer pivot (3 axes each: fore/aft from the axle line, inboard from the wheel-centre plane, height above the ground datum); caster; wheel-centre offset | 9–13 |
| **C. Rear end** | Same as B | Same set, plus rear upright/toe-link pickup points | 9–13 |
| **D. Steering** | Front end still open | Rack/bellcrank pivots, inner and outer tie-rod points, steering-arm length, rack travel per turn | 5–7 |
| **E. Springs & dampers** | Any | Spring rate (printed or measured), free length, shock upper and lower mount points, shock stroke; optional motion-ratio verification | 4–6 |
| **F. Anti-roll bars** | Any | Bar diameter, arm length, link pickup, blade angle (if adjustable) | 2–3 |

Within a group, order is **big to small**: put the calipers on the longest span first (least
percentage error), then work inwards. Every task states the two features it spans and the
datum — never "enter the y coordinate".

### 6.3 The single-measurement screen (`MeasureFieldScreen`)

One field per screen, in this shape:

```
──────────────────────────────────────
  Front · Task 3 of 9           [Skip]
──────────────────────────────────────
      [ diagram: two arrows between two labelled
        features, side + front view, datum line ]
──────────────────────────────────────
  Lower inner pivot — height above ground

  Measure from · the flat surface under the car
  To           · the centre of the inner hinge pin
  Usual range  · 8 – 14 mm

        [  1 1 . 5  ]  mm        [ mm | in ]
        [ −0.5 ]  [ +0.5 ]

  ┌───────────────────────────────────┐
  │  Save and continue                │
  └───────────────────────────────────┘
   Not sure?  ( skip  ·  use library  ·  approximate )
   Why this matters ›
```

Design rules:

- **56 px targets, bottom-anchored primary action.** Everything doable with one thumb.
- **Diagram before keypad.** The picture is the instruction; the words are the caption.
- **Numeric keypad is the app's, not the OS keyboard** — decimal point, sign, and a unit
  toggle in the same thumb zone.
- **No OS keyboard ever covers the diagram.** The diagram is above, the keypad below.
- **± 0.5 stepper** for the common case of nudging a shim value.

### 6.4 Unknown, approximate, or not yet — the four answers

Every numeric task accepts four distinct answers, and the app records which one it got. This
is the mechanism that keeps fabricated numbers out of the physics.

| Answer | Stored as | What the analysis does |
|---|---|---|
| A number | `measured` + timestamp + method | Uses it normally, badge `computed` |
| "Use library value" (only if a template or a sheet supplied one) | `library` + which template/sheet and version | Uses it, badge **`inherited`** on the value and the source named on the row; never a silent default, never a solid numeral |
| "Approximate" | `estimated`, value kept, **tolerance only if the source record carries one** | Uses it, value rendered with a leading `~`; if the record has no tolerance, the `~` is the only mark. There is no default ±15% |
| "Not sure — skip" | `unknown` | **Does not use it.** Every property that needs it becomes `missing` with the field named and a link straight back to this task |

There is no fifth *answer* and no default of `0`. Zero is a legitimate measurement (a pivot on
the ground plane), which is exactly why it must never stand in for "I don't know".

Two marks follow every value into the analysis and onto every export: its **provenance badge**
(computed / estimated / inherited / missing / undefined) and its **validation state** (a hollow
ring, `computed, not yet validated`, until a bench case exists). A tolerance is data, never a
system default — see `design-system.md` §9.

**Blocking is forbidden.** Skipping never produces a modal, a nag, or an inability to save.
It produces a named gap that shows up later as words, not as a dash.

### 6.5 Per-corner entry without doubling the work

- Most fields are entered once and **mirrored** to the other side (default on, shown as a
  toggle: "Same left and right").
- Turning mirroring **off** duplicates the remaining tasks for that side. Cars that are
  deliberately asymmetric (oval, pan car, a repaired corner) need this, so it exists — but it
  is never the default, because doubling 34 tasks is how a wizard becomes abandoned.
- The mirror state is visible on every affected row (`L=R` chip); unmirroring later keeps the
  values already entered for the left side.

### 6.6 Validation that catches the real error

The realistic mistake is not a subtle physics error — it is **mm vs cm**, **tyre diameter vs
radius**, or a **transposed digit**. So:

- Each field has an expected range. Outside it: an inline amber note directly under the value
  ("That's about 3× the usual 20–30 mm. Right number, wrong unit?") plus two buttons —
  **Fix unit** and **That's correct**. "That's correct" accepts the value, clears the note and
  records an override so the app stops asking.
- Never a blocking error dialog. Never a red screen for a suspicious number.
- Cross-field plausibility runs at group completion: e.g. wheelbase measured shorter than the
  tyre diameter gets "one of these four numbers is out by about 10×".

### 6.7 Pause, resume, and the reward loop

- Each group ends with a **live result card**: "Front roll centre is now computable: 22 mm."
  Seeing a real number from your own calipers is what makes the remaining tasks worth doing.
- "Continue later" is always available. State is `partial`; nothing is blocked; the Garage
  card shows a completeness ring per subsystem.
- Resume goes to the **next unanswered task in the last group touched**, with a two-line
  summary of what the car is currently missing ("Damping ratio needs your shock mount points").

### 6.8 Undefined geometry, as distinct from missing input

Three different situations, three different sentences (exact copy in `glossary.md`):

1. **Missing input** — "Roll centre needs the front upper inner pivot height." → links to the task.
2. **Degenerate geometry** — the numbers are all present and the maths has no answer:
   "Undefined for this geometry: the front upper and lower links are parallel in front view,
   so the instant centre is at infinity." → links to the two fields involved and a "what to
   check" note (usually a typo making two heights identical).
3. **Out of modelled range** — a computed value exists for the measured travel but the user
   asks beyond it: the chart shows a solid line to the measured limit and a dashed line
   beyond, labelled "outside your measured range".

The app never renders any of these as a number.

---

## 7. Flow 4 — Entering a setup

A **Setup** is a named set of adjustments plus the conditions it was run in. It is not a
re-measurement; it never asks for geometry.

**Entry points:** Car screen → "New setup"; Setup list → "New"; or **copy** from any existing
setup (the normal case — nobody starts from blank twice).

**Pre-fill:** none. A new sheet is **empty** — every value *not set*, analysis *0 of 7 computed*.
Copying another sheet is an explicit choice, and every copied value is marked `inherited` with the
source sheet named. A car's geometry may come from a template; a **setup** may not, because a setup
is the record of what was run.
Fields the car owns (tyre size, spring free length) are shown as **inherited rows**: greyed,
with a small "from car ›" link. Tapping the link goes to the car field, not to a second editor.

**The setup screen is one scroll, six sections**, in the order a setup sheet is written:

1. **Ride height & droop** — RH at each corner, droop limiters.
2. **Camber & toe** — per corner, with the "usual range" hint inline.
3. **Springs & bars** — rate fitted, ARB setting/blade, link hole.
4. **Dampers** — oil, piston, and position of any adjuster.
5. **Mounts & shims** — one row per mount: "Front upper inner · +1.0 mm · up" with a stepper.
   This is where a track-side change actually happens.
6. **Conditions & notes** — track, air/track temp, tyre, diff, wing, free text.

Each row: label, value, unit, a **delta chip against the baseline** if it differs, and a
chevron to the field's explanation. Editing is inline; there is no edit mode.

### 7.1 Drafts and versions (why editing is not destructive)

- Edits go into a **draft overlay**. The saved setup is untouched until the user saves.
- A persistent bottom bar appears only when dirty: **"3 changes · Discard · Save as v2"**.
- Saving appends a **new immutable version**. Old versions stay in **Version history**, where
  any one can be "restore as new version" — never mutated in place.
- The **baseline** is a flag on one version of one setup. Exactly one baseline per car. The
  default baseline is the first setup saved; it can be moved with a long-press menu item, not
  a swipe (destructive-ish actions are never swipe-only — and on mobile Safari a swipe that starts
  near the left edge is the *browser's* back gesture, which the app cannot intercept; architecture
  §3.1).

Rationale: at the track the racer's real fear is "I changed it and lost the reference". A
versioned snapshot per heat costs nothing and makes Flow 6 (compare) exact.

---

## 8. Flow 5 — Reading the analysis

`/car/:carId/setup/:setupId/analysis` is the screen the product exists for.

### 8.1 Seven cards, no more

| # | Card | Front / rear shown as | The one line the racer reads |
|---|---|---|---|
| 1 | **Load transfer** | total at 1 g, and the front share % | "How much weight moves, and how much of it the front takes" |
| 2 | **Roll stiffness** | N·m/deg each end, and °/g of roll | "How hard the car is to roll, and which end resists more" |
| 3 | **Roll centre** | height above ground each end, mm | "The height the car rolls about at each end" |
| 4 | **Camber gain** | °/10 mm bump each end | "How much camber the wheel picks up as it compresses" |
| 5 | **Bump steer** | mm toe change per 10 mm bump | "How much the car steers itself over a bump" |
| 6 | **Wheel rate** | N/mm each end | "The spring rate the tyre actually feels" |
| 7 | **Damping ratio** | ζ each end | "Whether the shock is controlling the spring" |

Motion ratio, ride frequency, roll angle, roll-centre migration, camber-at-roll, toe-at-roll and
Ackermann are **inside** cards 3–6, one level down (`docs/specs/spec.md` §4.4 lists them all as
outputs; they are outputs, not headlines). That is how the screen stays under eight properties.

Each card carries, in this order: property name · front value · rear value · **delta vs
baseline** (arrow + number, only when a baseline exists and differs) · a confidence chip
(`~` for estimated inputs, or nothing).

No verdicts. The app never writes "this will understeer" — there is no tyre model and no
claim to one. It writes what moved: "Raising the front roll centre 4 mm moved 6% of the load
transfer forward." Direction and size, not handling adjectives.

### 8.2 What a card looks like in each state

```
COMPUTED                    MISSING INPUT               UNDEFINED GEOMETRY
┌────────────────────────┐  ┌────────────────────────┐  ┌────────────────────────┐
│ Roll centre          ? │  │ Roll centre            │  │ Roll centre          ? │
│ 22 mm      34 mm       │  │ Not computable yet     │  │ Undefined for this     │
│ ▲ +4 mm vs baseline    │  │ Needs: front upper     │  │ geometry: links        │
└────────────────────────┘  │   inner pivot height   │  │ parallel in front view │
                            │             Add it ›   │  │      What to check ›   │
                            └────────────────────────┘  └────────────────────────┘
```

Three treatments, three meanings, never mixed:

- **computed** — solid border, values in the largest type on the card, delta underneath.
- **missing** — dashed border, no numerals anywhere, first missing input named, whole card taps
  through to that measurement task.
- **undefined** — hollow border, a faint diagonal hatch behind the value area, no numerals, the
  geometry reason in words and a *What to check* link to the two fields involved.

The distinction matters because "add a measurement" and "your geometry has no answer" are
different jobs with different fixes.

### 8.3 From a surprising number to its explanation

Three layers, each one gesture deeper, each reachable in one tap from the card:

**Layer 1 — the card.** Two numbers and a delta. Nothing to interpret.

**Layer 2 — the Why sheet.** Tap the `?` on the card header. A draggable bottom sheet, ~55%
height, dismissible by scrim tap **and** by a close button — the swipe is kept as an extra, never as
the only way out, because the browser's own edge-swipe wins that contest on iOS (architecture §3.1). Contents, in fixed order:

1. **What it is**, one sentence, racer words.
2. **Your numbers, in the equation.** The equation written in words with the user's own
   values substituted, and the arithmetic shown: "Load transfer = mass × cornering force × CG
   height ÷ track width = 1.35 kg × 1.0 g × 30 mm ÷ 172 mm = 236 g at 1 g."
3. **Why this direction.** The rule, then the counter-intuitive case spelled out. A question the
   thread returns to is why *raising* the front roll centre puts *more* weight on the front:
   reducing the front roll moment makes that end behave stiffer, so it takes a bigger share of
   a total that has not changed. The app states the mechanism, not just the rule.
4. **What else moves.** Coupling, named: "This also changes camber gain by 0.3°/10 mm."
5. **Read more ›** — dismisses the sheet and pushes the full concept.

The sheet never covers more than one screen height and never scrolls internally past two.
Depth lives in Layer 3.

**Layer 3 — Property detail** (`/…/analysis/:propertyId`): chart over bump or roll angle,
values at a few points, the input-sensitivity ranking ("what moves this, biggest first": +1 mm
at the front upper inner mount → +2.1 mm roll centre), the measured-range boundary drawn on
the chart, and **What if?** — a single slider on the dominant input that recomputes live and
is explicitly *not saved* ("scenario, not a setup").

**Layer 4 (optional depth) — Concept** from the Learn library, opened with the car context so
it can show "on your car" values in a live card.

### 8.4 Getting back

- Back from the sheet → same card, same scroll offset, card briefly outlined.
- Back from property detail → analysis.
- Back from concept → analysis (the originating card highlighted).
- The analysis screen's own back → the setup values screen.
- Switching to Compare and back preserves the analysis scroll position (per-branch stack).

### 8.5 The 90-second test

A user who launched the app 90 seconds ago, with a modelled car and two setups, must be able
to answer "what did that shim do?" by: tap the car, then tap Compare — the analysis is the
default segment, and Compare opens on baseline-versus-current without asking. Two taps, no
typing, no menu. Three if the Compare tab was left showing a different pair.

---

## 9. Flow 6 — Comparing two setups

`/compare` is a **two-slot** screen: A and B. Slots hold `(carId, setupId, versionId)`.
Behaviour:

- On first open, A = the car's baseline, B = the most recently opened setup. So the common
  case (baseline vs the change I just made) requires no picking at all.
- Both slots are tappable → `/compare/pick/:slot`. Picking keeps the other slot fixed.
- **Swap** is a single icon button.
- The pair is remembered across launches ("last comparison"), because the racer returns to it
  between every heat.

### 9.1 What the comparison shows

Default ordering is **results first, inputs second**, because the question is "what does it
do", not "what did I type":

| Section | Rows |
|---|---|
| **Consequences** (default open) | The 7 analysis properties that differ, each with A, B, delta, and a plain-language effect line: "More of the load transfer is on the front (54% → 60%)." |
| **What you changed** (open below it) | Only the inputs that differ, grouped by subsystem: "Front upper inner mount · +1.0 mm up", "Front spring 3.2 → 3.5 N/mm", "Front ARB hole 2 → 3". |
| **Unchanged** (collapsed) | "31 inputs unchanged" — one row, expandable. |
| **Conditions** | Track, temperature, tyre, run label, side by side, with a warning when they differ: "Different track temperature (18 °C vs 26 °C) — some of this difference may not be the setup." |

Empty diffs are collapsed, not listed. A comparison of two identical setups says so in one
line and offers "Show unchanged" — it does not render 38 zero rows.

### 9.2 Guardrails that produce sentences, not silence

| Situation | Behaviour |
|---|---|
| Different cars, same class | Allowed, but a persistent banner: "Different chassis geometry — the deltas are real but they are not like-for-like." Results are shown; the "what you changed" section is suppressed (meaningless across different base geometry). |
| Different classes (TC vs buggy) | Blocked with an explanation and two actions: "Compare within one car" or "Copy setup to…" |
| A property is undefined or missing in one slot | That row reads "Not comparable — B has no front ARB rate" rather than an empty cell |
| The other car's setup came from a shared file with unknown mass/CG | The row set is collapsed to inputs only, with: "This setup came without corner weights, so its results can't be recomputed on your car." |
| Any input is estimated | A chip on the comparison header: "2 estimated inputs — deltas may be smaller than they look" |
| No second setup exists | Empty state: "A comparison needs two setups. Duplicate your baseline to start a variant." with the action right there |

### 9.3 From a comparison row to understanding

Tapping a **consequence** row opens the property detail **in comparison mode**: A and B on the
same chart, with the delta shaded. Same Why sheet, with both numbers substituted. Back
returns to the comparison at the same scroll offset.

### 9.4 Saving the finding

"Save as note" appends a dated line to the setup's notes ("+1 mm front upper inner shim: front
load transfer 54% → 60%, roll centre 22 → 26 mm") so the pit notebook survives the app being
closed. This is the modern replacement for "print the sheet", and the print sheet (Section 12)
carries it too.

---

## 10. Flow 7 — The learning path

Teaching is not a separate mode; it is the same content reachable from three directions.

### 10.1 Three entry points

| Entry | Path | Content shown |
|---|---|---|
| **Curious, browsing** | Learn tab → `/learn` | Grouped concept list + "Start here" path |
| **Puzzled by a number** | Analysis card → `?` → Why sheet → Read more | That one concept, with the user's car in context |
| **Following Bob's series** | Learn tab → `/learn/path` | 7 ordered steps, each a concept + one thing to try on your car |

### 10.2 The path

Ordered after the structure of the source articles (terminology → suspension properties →
weight transfer → overall stiffness → camber and camber gain → roll centre and camber gain →
steering/Ackermann → dampers), compressed to seven steps for in-app use:

1. What the seven numbers are (and which two matter most)
2. Load transfer and balance
3. Roll stiffness: springs, bars, and the split
4. Roll centre, and why raising it adds front load transfer
5. Camber and camber gain together
6. Toe, bump steer and Ackermann
7. Dampers and damping ratio

Each step: a 200–350 word concept, one diagram, one equation in words, and **one task on your
own car** ("measure your front roll centre height, come back and compare"). Progress is a
checkmark per step, stored locally. Skipping is free; the path is not a course with a lock.

### 10.3 Concept → car → concept

`/learn/:conceptId?car=…&setup=…` renders an optional **"On your car"** card at the top with
live values, and a **"See it on my car"** action that returns to the analysis and highlights
the relevant card. Without car context the card is replaced by a worked example on the sample
car, labelled as such. Every concept ends with "where you meet this in the app" — the two or
three screens that use it.

### 10.4 Scope rule for content

The concept text explains **mechanism and direction**, never a recommended setup. "Raising the
front roll centre moves load transfer forward" — yes. "Raise your front roll centre to fix
understeer" — no: that depends on the tyre, the driver and the track, and the app has no
business guessing on a phone in a pit lane.

---

## 11. Flow 8 — Sheets, diffs and the interpreter

**The loop this flow exists for.** A racer runs four sheets in a day, changes three things, and by
the evening cannot say which change did what. The library keeps the sheets; the diff turns two of
them into a reading with a stated confidence.

**Steps.**

1. **Library** (`/car/:carId/sheets`) — the car's sheets newest-first, each with its date, note and
   **optional conditions** (surface, temperature, humidity, free text for tyres and motor). The
   baseline is pinned. Imported sheets carry `inherited` and the source name.
2. **Pick two** — any two, not just consecutive ones: a session against last month's reference is
   the normal case. Default selection is the newest sheet and its predecessor.
3. **Conditions gate** — a field-by-field table (match / differs) and then one banner:
   *Comparable*, **Different conditions — not like-for-like** (naming the fields), or **No
   conditions recorded — this diff cannot say whether it is like-for-like**. This appears before
   the first claim.
4. **What this did** — the tiered interpreter. Firm rows first (geometry, rates, stiffness split,
   with validation rings), then Inferred (balance direction, with **all else equal**, *Reverses if*
   and *What it does not claim*), then Speculative (named and refused). A grip sentence appears only
   as an inference strip: no number, no badge, no ring.
5. **What you changed** — grouped by area, changed rows only, `A → B`, `inherited` where a sheet
   came from someone else.
6. **Act on it** — *Open B*, *Apply B to car*, *Export this diff*, or *Read the concept*.

**Rules.**

- A rule with no tier does not ship; the screen has no unlabelled sentence.
- Understeer / oversteer, entry / mid / exit. Not push / loose.
- Damping leads with direction ("heavier oil → more damping at the wheel"); the magnitude is an
  estimate with a band, and the band is the damper model's own, never a default percentage.
- Nothing on the screen is hidden because a tier is empty. "We do not model entry" makes the
  mid-corner claim more believable, not less.

**States.** both sheets · one slot empty · identical sheets · conditions differ · conditions not
recorded · a sheet fails to load · offline (no claims need the network).

---

## 12. Cross-cutting rules

### 11.1 Offline is the default state, not an error

The app never blocks on a network. `offline` therefore appears in exactly four places, always
as information, never as a red banner:

- **Library updates** (Settings → Library): "Library updates need a connection. Everything
  else works offline."
- **Video links** on concepts: "Video needs a connection. The written version is below."
- **Share/export to another app**: file export always works; cloud share is unavailable.
- **Import from a URL** (if ever added): disabled with the reason.

Everything else — measuring, analysing, comparing, learning — is fully local.

### 11.2 Errors are recoverable by design

| Failure | Behaviour |
|---|---|
| A car JSON fails to parse | The garage card says "This car couldn't be opened" with **Export raw file** and **Repair** (drops the unparseable setup, keeps the car) — the car is never silently deleted |
| Analysis throws | A single card becomes "Something in the maths failed", with **Copy diagnostics**; the other six cards still render. One bad property never blanks the screen |
| A save fails | The draft stays in memory, the bar reads "Not saved — retry", and the app does not navigate away |
| Schema version is newer than the app | "This file was made by a newer Setup Lab" with the file's version, and a read-only preview |

### 11.3 Units

Display units are chosen once in Settings (mm default; inches available; N/mm vs lb/in;
grams vs ounces). Every value shows its unit inline in the input, and the unit toggle sits
next to the number — because the mm/cm error is the one that actually happens. Changing the
display unit never changes stored values.

### 11.4 One-handed, gloved, in sunlight

- Primary action bottom-anchored on every screen that has one.
- No gesture-only action: every long-press has a visible menu equivalent.
- Minimum 56 CSS px touch targets; 4.5:1 contrast minimum; the dark theme is the default and the
  tested one (mid-grey surfaces, not pure black, so text does not bleed in sunlight).
- Direction is always text + arrow + colour, never colour alone.

---

## 13. Publishing a setup (asked for in the thread's first month, and again ever after)

"Also a print your setup option" appears within the first fifty posts. Ship it as
a first-class action, not a settings toggle:

- **Export sheet** (from the setup overflow, and from Compare): a one-page A4/Letter PDF with
  the setup values in a header grid, the 7 analysis numbers on the right, conditions and notes
  at the foot, and the car's geometry completeness stated. Also exportable as PNG for the
  phone gallery and sharable as text.
- **Export car model**: `car.json` (geometry + setups + provenance per field), versioned by
  `schema_version` and carrying a `source` per measurement — the format the community can
  version and share.
- **Print** goes through the platform print dialog; it degrades to "save as PDF" where there
  is no printer.

---

## 14. State contracts (implementable shape)

Named for the React Router + Zustand implementation (D-19). No component detail beyond names; the
URLs are the contract (§2.3), and the store shapes are described rather than typed.

| Store / selector | Holds | Reads from | Notes |
|---|---|---|---|
| `useGarage` | `CarSummary[]` | `DocumentStore.list('models')` | Car summaries carry completeness counters so the garage renders without loading geometry; the store also holds the load state, because IndexedDB is async and the list is the first thing on screen |
| `useCar(carId)` | `Car \| null` | store | |
| `selectGeometry(carId)` | derived | `useCar` | Per-subsystem completeness + outlier list |
| `useSetups(carId)` | `SetupSummary[]` | store | Includes baseline flag and dirty-draft flag |
| `useSetup(carId, setupId)` | `SetupVersion` | store | Returns the selected version |
| `useDraft(carId, setupId)` | `SetupDraft` | `useSetup` | Field overlay + `dirty` + `changedFieldIds`; `discard()` and `saveAsVersion()`. Mutations land here synchronously and are coalesced to one solve per animation frame (architecture §2) |
| `selectEffectiveGeometry(setupId)` | derived | car + draft | Applies shim offsets to base hardpoints — the *only* place geometry is assembled |
| `selectAnalysis(setupId)` | derived `AnalysisResult` | `selectEffectiveGeometry` | Pure, memoised per solve, never throws (see below) |
| `useCompare` | `CompareSlots` | persisted | `{left, right}` of `SetupRef(carId, setupId, versionId)` |
| `useUnits` | `DisplayUnits` | persisted (`localStorage`) | Conversion happens only in `packages/data`; formatting only in `web/src/format/` |
| `useLearningProgress` | `Set<ConceptId>` | persisted (`localStorage`) | Path checkmarks |
| `useShell` | `destination`, `rememberedPath`, `scroll` | memory only | What replaces the per-branch navigator: the remembered path and offset per destination (architecture §3.1) |

### 14.1 The analysis result is a discriminated union, not a nullable number

The single most important contract, because it is what makes rule 4 of `review-rules.md`
(no `NaN` reaching a chart) and the "never invent a number" trap structurally impossible to
violate by accident:

```ts
type AnalysisResult = PropertyResult[];          // one entry per output, both axles expanded

type PropertyResult =
  | { kind: 'defined'; value: number; tier: 'firm' | 'inferred';
      band: Band | null; basis: Basis | null;
      provenance: ReadonlySet<Ref>; flags: ReadonlySet<Flag> }
  | { kind: 'notMeasured'; missing: FieldRef[] }
  | { kind: 'undefined'; reason: UndefinedReason; inputs: FieldRef[] };
```

The UI maps each variant to exactly one visual state (solid value / dashed "needs X" / hollow
"undefined"). There is no code path that renders a number for a `notMeasured` result, because
there is no number in it, and `value` is non-nullable by construction — `NaN` is unrepresentable at
the boundary.

**Two corrections to this section, made when the stack switched (round 4).** (a) The outline above
used to list a fourth variant, `OutOfRange(partial, measuredLimit, requestedLimit)`. That is not a
transport state: in the shipped vocabulary an out-of-domain value is a *defined* number carrying the
`OUT_OF_DOMAIN(bound)` state and an `outOfDomain` flag (spec §4.4.1, architecture §7), and it must
render as a number, because "flagged number" beats "refusal the user cannot reason about". (b) The
old variant carried `confidence: exact|estimated`, which was a third vocabulary for what spec §4.11
splits into a *tier* (`firm`/`inferred`) and a *state* (eight values): the union carries the tier,
and the state is derived in `packages/data` from the schema's `on_absence` and `plausible` facts.
Neither change is a design change — the four visual states in §10.13 are exactly the four the UI
still renders.

`notMeasured` carries `FieldRef` (field id + measure task id), which is what makes the "Add it ›"
deep link possible without the analysis layer knowing any routes.

### 14.2 Draft lifecycle

```
saved version ──edit──▶ dirty draft ──save──▶ new version (baseline flag preserved)
                            │
                            ├─discard──▶ saved version
                            └─navigate away──▶ draft kept in memory, badge on the setup row
```

A draft is never silently written. A dirty draft surviving a tab switch is deliberate: at the
track, the phone locks, the app is killed, and the user expects their three edits to still be
there. Drafts are persisted to local storage on every change, with the last write debounced.

### 14.3 Route guards

| Guard | Rule |
|---|---|
| `/welcome` | Redirect to `/garage` if onboarding has been seen |
| `/car/:id/*` | If the car is missing → `/garage` with a notice (never a blank screen) |
| `/car/:id/setup/:id` | If the setup is missing → `/car/:id/setups` with a notice |
| `/compare` with < 2 setups on the device | Renders its own empty state, does not redirect |
| `/learn/:conceptId` unknown | 404-equivalent screen with search, not a crash |

---

## 15. Open questions

1. **Reconcile the wizard's task list against the spec's field tables.** `docs/specs/spec.md`
   §4.2.1 and §4.3.1 now carry the authoritative field names (`lower_arm.inboard_front` …
   `upper_link_inner_shims`). This document's groups and task counts are a design estimate of
   how those fields are *asked for*, and must be re-derived from the field table before sprint
   planning — the count may go up, and every added task is 40 seconds of a 20-minute budget.
2. **Coordinate datum.** The flows assume a per-car datum (top surface of the chassis plate +
   rear axle centreline + car centreline); the ground plane is derived from the plate thickness and
   ride height. Absolute vs span-based measurement changes the wizard's wording everywhere, and
   span-based is friendlier with calipers but harder to reconcile with a shared model.
3. **Template library provenance.** Every template hardpoint needs a `source`. If the family
   does not gift the RC3 databases, the initial library is a handful of community
   re-measurements — is that enough to ship a "template" door at launch, or does v1 open only
   with "from scratch" plus import?
4. **Bump steer needs steering-system geometry**, which is the least standardised measurement
   on any chassis (bellcrank orientation differed enough that users asked "does it matter what
   direction the system is facing?"). Does v1 ship bump steer at all, or defer it and ship six
   cards?
5. ~~Roll stiffness in °/g depends on sprung CG height.~~ **Resolved (owner, 30 Oct 2026):** CG
   height is **inferred, never fetched from a scale session** — the route (plumb-line, component
   estimate, or inherited) is shown on the card, the badge follows the route, and the card states
   what it makes uncertain (total transfer, roll angle) against what it leaves robust (the balance
   split). No "import from scales" affordance exists.
6. **Does "compare across cars" earn its keep?** It is allowed with a warning, but if it never
   produces a useful comparison in testing, removing it simplifies the guardrail set.
7. ~~Damping ratio needs shock dyno data.~~ **Resolved (owner, 30 Oct 2026):** ζ is an **estimate
   in v1** — the card leads with the direction of change ("heavier oil → more at the wheel", "shock
   laid down → less"), shows `~0.42 ± band` with the `estimated` badge, and offers a *What changes
   this* panel. With no damper data the card is `missing` and keeps the panel; no estimate is
   manufactured from a spring rate.
8. ~~Three tabs or four?~~ **Decided: three** (D-01, 30 Oct 2026) — Garage · Compare · Learn. The
   wireframes have been redrawn to three destinations; setup, analysis, chassis, sheets and export
   are pushes inside the Garage branch.
9. **Naming.** "Setup Lab" is a working title; the tab labels ("Garage", "Compare", "Learn")
   are chosen for shortness and should be re-tested with 5 club racers before they are frozen.
