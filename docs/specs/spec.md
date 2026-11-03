# Setup Lab — Requirements Specification v0.2

**Status:** revised after review round 1 — `docs/reviews/round1/`
**Date:** 2026-10-30
**Owner:** Dave (merges all PRs)
**Upstream:** [`docs/intent.md`](../intent.md) · **Rules applied:** [`AGENTS.md`](../../AGENTS.md), [`docs/review-rules.md`](../review-rules.md)
**Normative frame and units:** ISO 8855, millimetres, grams, degrees — §4.1, §4.2
**Next artifact:** `docs/specs/plan.md`

This document says *what must be true of the shipped app*, in a form a test can
prove. It does not say how to build it. Where a requirement could be met in
several ways, it is written as the observable behaviour, not the mechanism.

**What changed in round 2.** Nine blocker classes from
`docs/reviews/round1/CONSOLIDATED.md` are closed in this revision, and two rulings
are applied. Every field in §4.2.1 and §4.3.1 now carries a mandatory
`on_absence` policy (§4.1 rule 3, §4.10) and the absence tests are generated from
that table (E1.2, E2.4, E9.10). The coordinate frame is ISO 8855 and the example
model is re-derived in it (§4.2, R-1). The setup/geometry contradiction is
resolved by a closed, signed transform pipeline (§4.3.2). `content_hash` has a
canonical form specified by reference to RFC 8785 with published fixtures
(§4.5, E1.7). A setup that arrives without its model has a defined state, UI and
recorded mapping (§4.6, E6.9). Licence, contributors and attribution text are in
the schema and survive every hop (E7.12). Every build gate is its own AC with
seeded-failure semantics (E9.4, E9.8, E9.9, E9.10, E8.1, E8.13) and the
circular release gate is gone. Every AC now carries a release marker and v1 is
capped (§2, §8.2). The 25 untestable criteria named in
`docs/reviews/round1/03-spec-critique.md` §5 are rewritten or removed, and each
removal is recorded in §8.3. Every computed value now carries a visible
validation state (E3.16, D-11) and a tier (§4.11).

**What changed in round 4.** The owner's **D-19** moved the implementation stack from Flutter/Dart
to **React + TypeScript, built with Vite, installable as a PWA and fully offline**, with D-20–D-23
ruling persistence, the provisional performance budgets, import/export and the drawing mechanism.
Every criterion that named a Flutter mechanism, an Android permission, a Play artefact, a bundle
identifier, an SDK version or an app size has been rewritten for the web **with its id unchanged**;
the clauses D-19 genuinely supersedes are marked `SUPERSEDED by D-19` in §8.3 rather than deleted.
Two criteria are new, and only because the web stack needs them: **E8.17** (installability) and
**E8.18** (storage durability and export as the user's backup). D-21 also moved one marker — E8.11
from SHOULD/R2 to MUST/R1 — because a size budget that only warns does not bind (recorded in §8.3).
The physics, the frame, the units, the schema, the state and tier vocabularies and every tolerance
are untouched; §8.4's audit is what checks that claim rather than trusting this sentence. The stack
itself is specified in `docs/specs/architecture.md`.

**Five owner decisions landed during this revision and are applied throughout:**
setup sheets carry optional conditions with a sheet-diff warning (E4.9); damping
ratio ships in v1 as an estimate with a computed band (E3.6, §4.8); CG height is
inferred, never a must-measure field (§4.2.1); grip is inference-only (§4.11,
E5.6); and the setup-sheet interpreter uses understeer/oversteer at entry/mid/exit
with firm/inferred/speculative tiers and "all else equal" on every inferred claim
(E2.13).

---

## 1. Product statement and primary user

### 1.1 Product statement

Setup Lab is a free, offline, cross-platform web app that turns a set of caliper
measurements into the suspension numbers that explain how an RC car will behave,
and shows the arithmetic behind every one of them. A racer measures their chassis
once — hardpoints, springs, bars, damper settings — and the model is kept in the
browser's own storage and exportable as one file at any time: no installer, no
database engine, no account, no server, no subscription. *Kept for as long as they
keep it* now carries a condition, and the app states it (E8.18): a browser may
evict the data of a site it has not seen for a week unless the app is installed to
the home screen, which is why the first run offers installation and the app nags
for an export. From that model and a setup, the app
computes the properties that connect a setup change to a handling change —
motion ratio, wheel rate, ride frequency, roll stiffness, lateral load-transfer
split, roll-centre height and migration, camber gain, bump steer, and damping
ratio as an estimate with its band (§4.8) — displays each as a value with its
units, its equation, its inputs, its validity state and its tier, lets the racer put two setups side by side and see
which quantities moved and by how much, and explains the concept at the point
where it is being used rather than in a manual nobody opens. It is a clean-room
successor to RC Crew Chief: the workflow (measure → model → compare) is kept
because it is good, the physics is standard vehicle dynamics, and nothing of the
original program's code, help text, iconography or name is used or required.

### 1.2 Primary user

**The club racer.** Runs a 1/10 touring car or buggy, one or two classes, one
meeting a week. Owns a setup station, digital calipers and a phone; does not own
a laptop they are willing to take to a dusty pit table. They have a paper setup
sheet in the pit box and a handful of setup sheets from faster drivers. What
they want is not a simulator: they want to know, before they spend a meeting on
it, which direction a change moves the car and roughly how much — and they want
to understand the answer well enough to argue with it.

The secondary users are the **returning racer** who watched Bob Wright's
published teaching and wants the tool that goes with it, and the **chassis
contributor** who measures a new car and wants to give the model to everyone
else. Both are served by the same features; neither may make the primary user's
first thirty minutes harder.

### 1.3 What "good" means for v1

One sentence, from the intent: a club racer with a phone, a setup station and one
caliper session models their car in under thirty minutes, and correctly predicts
the direction of a camber-link or roll-centre change before making it.

At **R1** the direction half is carried by the signed output deltas in the
compare view (E4.1) and by the assumptions/limits statement (E5.5); at **R2** it
is carried by the observed session (E9.5). The R2 marker is deliberate: the
success test needs users who have not seen the app, and users are not a build
artefact (§2).

### 1.4 Vocabulary, and how it maps to the screen inventory

The design agent works from `docs/design/screens.md` in parallel with this
document. Where the two use different words for the same thing, this table is the
bridge: **the term in the left column is normative in this spec and in tests; the
term on the right is normative in UI copy.**

| This spec | Screen inventory |
|---|---|
| car model, model | Car, Edit car |
| model library | Garage, Settings › Library |
| measurement worksheet | Measure group, Measure field |
| setup | Setup values |
| analysis screen | Analysis |
| output, computed property | Property, Property detail |
| explanation | Concept (Learn) |
| comparison | Compare |
| assumption / limitation | "Why is this approximate", analysis-health line |
| validation state | "not yet validated" chip (D-11) |
| model missing | "model missing" badge (§4.6) |

Provenance vocabulary: the screen inventory's
`answered · unknown · estimated · library · unanswered` maps onto the source
types in §4.1 rule 4 as `measured`, `unknown`, `estimated`, `library`, and
field-absent respectively. `unknown` means *the owner explicitly does not know*;
a value that is present in a file with no recorded origin is `unattributed`, and
the completeness count treats it as unmeasured. `estimated` exists in both, and
E2.11 is the requirement that keeps it honest.

---

## 2. Scope of v1, and the slice that proves it

**The cut line, in one sentence: v1 (R1) is the web release — one URL, installable
to a home screen, working with no network after its first load — that measures a
car, keeps it as a file the user can export, computes the eleven outputs of §4.4
that are not R2 — including a banded damping estimate — with an honest state and
tier on each, compares two setups, and shares files with their attribution intact;
every other criterion in §3 is R2 and does not block that ship.**

Every acceptance criterion in §3 carries a **Release** marker. The markers are
mutually exclusive and mean exactly this:

| Marker | Meaning | Blocks |
|---|---|---|
| **R0** | Slice 0 (§2.3): one screen, a complete example model, three live outputs, an input the user can move, the equation behind each. | The first usable artefact. R0 is a subset of v1. |
| **R1** | The rest of v1: the first public web release. **41 MUSTs**, which with R0's 8 makes 49 MUSTs in v1. | The v1 release. |
| **R2** | v1.1 and later: everything not cut into v1. MUSTs here are commitments to a named later release, not to v1. | Nothing in v1. |

### 2.1 In v1

Suspension **geometry and balance**: every property that follows from hardpoint
positions, masses, spring rates and bar rates. Concretely: motion ratio, wheel
rate, ride frequency, roll stiffness, load-transfer split, roll-centre height and
migration, camber gain, camber at roll, bump steer, toe at roll, and **damping
ratio as an estimate** (§4.8). Plus the model library, setup versioning,
comparison — including the conditions warning (E4.9) — explanations, import and
export with attribution intact, and the measurement guidance that makes the model
possible.

Three quantities are deliberately **not measurements** in v1, and the app says so
wherever they appear (§4.11):

- **CG height is inferred, never asked for as a measurement.** Corner scales
  cannot locate a CG; the field is `on_absence: ESTIMATE` (§4.2.1), derived by the
  two-hang plumb-line procedure or a component-mass estimate, with a computed
  band, and every output that consumes it (the load-transfer split) is `inferred`.
- **Damping ratio is inferred**, computed from the orifice model with a
  dynamically computed band, carrying `inferred` tier and `estimated` provenance.
  The trustworthy output is the **direction and size of change between two
  sheets**, which the compare view leads with; the absolute value is never a
  headline and is never `validated` (E3.6).
- **Grip is not a number at all.** It is never measured, never computed and never
  presented as either; any statement about it carries the `inferred` tier and the
  words "all else equal", and no composite grip or handling score exists at any
  tier (E5.6, §4.11).

### 2.2 Not in v1, not in v1.1

Motor/battery/ESC dyno, acceleration simulation, time-domain chassis roll, tyre
modelling, cloud sync, multi-user anything. These are listed with reasons in §6,
not left implicit.

### 2.3 The slice (Slice 0)

The first thing a person can hold and use is **one screen**: a complete example
model, three live outputs (wheel rate, roll-centre height, camber gain per degree
of roll), an input the user can move, an equation behind whichever output they
tap, and a validity state on every number. If Slice 0 is not in someone's hands
early, the spec has failed regardless of how many criteria below are green.

Slice 0 satisfies **E3.1, E3.3, E3.4, E3.7, E3.11, E3.16, E5.1 and E6.1**. It
must also hold E3.12's *recompute* budget (p50 ≤ 16 ms) but not its frame-timing
clause, which needs the release-build harness that arrives with R1. It does not
satisfy the measurement, library or export epics, and that is deliberate.

### 2.4 Consequences of decisions already taken

Recorded here so they are not re-litigated later; each one costs something.

| Decision | Consequence the spec must absorb |
|---|---|
| React + TypeScript web app, installable and offline (D-19) | Every numeric input must be usable on a 320 CSS px-wide viewport with no keyboard-hover. One URL serves both phone platforms from day one, so there is no platform split to write clauses around — but Safari/WebKit and Chrome/Blink both matter, and criteria that were Apple-only because iOS was deferred are now ordinary criteria on their own merits (§8.3). A web app has no native file system, no share sheet by right and no store review: import is a picker, a drop or a paste (D-22), and installation is the user's choice rather than the distribution channel. Two things are bought and one is lost: no installer, no signing key, and no file association. |
| Offline-only, no accounts, no backend | Model sharing works through the OS share sheet and files, so the file format *is* the community feature (E6.4, E7.1a/b). There is no server to fix a bad model, so validation is local and strict (E6.5). A setup that arrives without its model must therefore have a real local path (§4.6, E6.9). |
| Human-readable versioned JSON with per-value provenance | The format is a public interface from day one; schema changes need migrations and fixtures (E9.10), and every value needs a source or the format is a lie (E1.3). The canonical form is pinned by reference to RFC 8785 (§4.5) so two implementations agree. |
| Physics in a pure TypeScript package — no DOM, no React | The UI cannot compute; it can only present. Anything the user sees must be obtainable from a function a headless test can call (E3.11, E3.16). SI lives inside the package only, at one conversion boundary (§4.1 rule 1). The package compiles without the DOM lib, so a component cannot reach into the maths and the maths cannot reach the browser. |
| Free forever | No paid tier, no telemetry-funded tier, no ad SDK — which removes a whole class of "how do we see usage" features and replaces them with the instrumented usability test (E9.5, R2) and the dependency check (E8.13). |
| Clean-room | Explanation text is written by us and mechanically checked against the research corpus (E5.4, E9.4). This is a build-time gate, not a promise. |
| ISO 8855 frame (R-1) | x forward, y **left**, z up, origin on the ground plane at the rear axle centre. Per-wheel quantities are per-wheel signed (camber + = top outboard, toe + = toe-in) and **mirroring does not negate them** (D-17); only point `y` is negated, and the side factor `s` that converts to the car frame is applied once, inside the solver. Car-level quantities are never signed per side. Every hardpoint in every document is re-derived once. |
| mm/g/deg on disk (R-2) | The file is what a caliper and a setup sheet produce; the physics adapter converts to SI at exactly one site and a `\|coordinate\| > 3000 mm` guard catches a metre value (E3.8's property test covers the guard). |
| Validity state on every number (D-11) | A computed value is never shown bare. Every surface, including every export, carries the state from §4.4.1 (E3.16). |
| Owner decisions, 2026-10-30 | Setups carry **optional** conditions — surface (`carpet`/`asphalt`/`other`), ambient temperature, humidity, free-text tyre and motor — all `on_absence: OMIT` in the maths; a sheet diff warns when they differ (E4.9). Damping ratio ships as an **estimate with a band**, not deferred and not measured (E3.6, §4.8). CG height is **inferred** and never a MUST-measure field (§4.2.1). Grip is inference-only (§4.11, E5.6). The setup-sheet interpreter uses understeer/oversteer at entry/mid/exit with firm/inferred/speculative tiers and "all else equal" on every inferred claim (E2.13). |
| One gate command (D-09, in form now `npm run gate` per D-19) | `npm run gate`, from the repository root, is the only entry point CI runs, and every stage it runs has its own AC here (E9.8). No gate may depend on a tool that no AC requires. |
| IndexedDB documents, `localStorage` preferences (D-20) | The library is browser storage, not a directory: it can be evicted, and on iOS Safari it is evicted for sites unvisited for seven days unless the app is installed. `navigator.storage.persist()` is requested at first run, installation is offered, and an export older than seven days is nagged about (E8.17, E8.18). The document format does not change; only where it lives does. |
| Provisional web performance budgets (D-21) | A slider-drag recompute is budgeted at 8 ms p50 / 16 ms p95, first-load JavaScript at 350 KB gzipped, the cached asset set at 2 MB and a model document at 100 KB — all provisional until measured on the reference phone, and E3.12 then cites the measured number rather than the estimate. A budget nobody measured is a slogan. |
| Import by picker, drop or paste; file association accepted as lost (D-22) | Tapping a `.json` in a mail client cannot open the app, and that is recorded rather than engineered around. Export is a download or a save dialog; "export everything" is one archive (E7.6, E8.18). |
| SVG scene, chart library behind a wrapper (D-23) | The suspension drawing is inspectable and testable against the physics objects, and no renderer computes geometry: a component that calls a trigonometry function is a review failure, and E8.7d keeps every chart's table alternative honest. |

---

## 3. Acceptance criteria

**How to read these.** Every criterion is numbered, tagged **MUST** / **SHOULD** /
**LATER**, carries a **Release** marker (§2), and is phrased as *Given … when …
then …* so that a single automated test or a single scripted manual check can
decide pass or fail. Tags mean:

- **MUST** — *the release named in the criterion's Release marker* does not ship
  without it. A red MUST blocks that release. A MUST marked R2 blocks v1.1, not
  v1.
- **SHOULD** — the release ships it unless it is descoped in writing in
  `plan.md`, with the reason and the consequence recorded.
- **LATER** — explicitly not in the release marked, listed so it is not
  rediscovered as a bug.

Where a criterion names a numeric bound, that bound is the test's assertion, not
an aspiration. Where a criterion says "the field table", it means the generated
table of §4.2.1 or §4.3.1, whose machine-readable source is
`docs/specs/fields.yaml` (§4.10) — so a test can iterate it and a new field
cannot be added without a policy. Where a criterion says "stated", the app must
display the quantity it used, so a test can read it off the screen or the export.

Two conventions hold throughout: **no number is shown without its units and its
state** (E3.16), and **no field is shown without the policy that governs its
absence** (E1.2, E2.4).

---

### Epic E1 — Car model and measurement

The model is the expensive artifact: a caliper session costs an hour and can
never be repeated exactly. Everything in this epic exists to make that hour
survive, and to stop the app inventing a number where a measurement is missing.

**E1.1** — *Given* a new model with `symmetry: false` and no hardpoints entered,
*when* the model screen and the analysis screen open, *then* (a) the set of
fields shown as "not measured" equals, by set equality against
`docs/specs/fields.yaml`, the set of fields with `req: yes`; (b) the analysis
screen shows the string "not measured" for every output whose `consumed_by`
closure is not fully present, and shows no digit, no unit and no bare dash for
any of them; (c) no output carries a state beginning `COMPUTED`. A blank output
list fails (b); a rendered `0` or `— mm` fails (b). **MUST** · **R1**

**E1.2** — *Given* the example model and its setup, *when* the test suite runs
once per field that appears in §4.2.1 with `req: yes` and at least one consumer,
deleting that field from the fixture, *then* the dependent output states equal
what the `on_absence` column prescribes: `ASSUME` → the output carries
`COMPUTED_ASSUMED`, naming the field and showing the assumed value; `ESTIMATE` →
`INFERRED`, naming the procedure and showing a band; `REFUSE` → `REFUSED`, naming
the field and showing no number; `OMIT` → `COMPUTED_INCOMPLETE`, naming the
field. The test is generated
by iterating the table, so a field with no `on_absence` value, or one whose
observed state differs from the prescribed state, fails it and names the field.
**MUST** · **R1**

**E1.3** — *Given* a numeric field in a car model, *when* the user attempts to
save it without a provenance entry that resolves into `sources`, *then* the save
is refused, the offending field path is named in the error, the document in
memory is unchanged, and no file is written or partially written (asserted by
listing the model directory before and after). **MUST** · **R1**

**E1.4** — *Given* `symmetry: true`, *when* the user enters a front-left
hardpoint, *then* the right-hand corner is **not** stored: it is derived at load,
its values are the y-negation of the left corner with x and z unchanged, its
provenance is `derived_by_mirror` (a distinct provenance state, not `measured`),
and the completeness count counts it as measured-by-symmetry. *Given*
`symmetry: false`, *when* the user enters one corner, *then* no other corner
changes and the right-hand corner must carry its own points or the affected
outputs are `REFUSED` naming them. **MUST** · **R2**

**E1.5** — *Given* the field table, *when* the measurement worksheet is opened,
*then* (a) the set of fields in the generated step list equals the set of fields
listed in `docs/specs/fields.yaml`'s `worksheet:` block, each appearing in
exactly one step and every one of them existing in the field list of that file;
(b) each step displays the `datum` string recorded for that step in the YAML,
character for character, and a step with no `datum` fails the schema stage
rather than rendering an empty line; (c) each step's illustration asset
exists, has intrinsic width ≥ 320 px and non-empty `alt` text; (d) the step order
equals the order in `docs/specs/worksheet_order.txt`, and editing that file
changes the order with no code change. **MUST** · **R2**

**E1.6** — *Given* a value outside the `plausible` range declared for its field
in `docs/specs/fields.yaml`, *when* the user confirms entry, *then* the value is
accepted, the field carries an "outside the expected range" flag whose text names
the declared range, and the flag is present after save and reload; *given* a
value inside the range, *then* no flag is shown. The test iterates every field
that declares a `plausible` range and feeds it one value inside and one outside.
**MUST** · **R2**

**E1.7** — *Given* a saved model, *when* it is loaded, re-hashed, saved, reloaded
and re-hashed, *then* the two `content_hash` values are equal; *and given* the
two fixture files `docs/specs/fixtures/hash-1.json` and
`docs/specs/fixtures/hash-2.json` with the expected values published in
`docs/specs/fixtures/hash-1.sha256` and `hash-2.sha256`, *when* the hash function
runs on each, *then* the published value is reproduced exactly, on x86_64 and on
ARM64, in V8 and in JavaScriptCore, and in both development and production
builds. A serialiser rewrite is allowed to change nothing about this test — and
the two engines matter here in a way two CPU architectures did not: RFC 8785 pins
number *formatting* to ECMAScript's, which both implements identically, so a
failure is a bug in our canonicaliser rather than a difference in theirs.
**MUST** · **R1**

**E1.8** — *Given* a model with no unsprung mass recorded (the field's
`on_absence` is `ESTIMATE(unsprung_corner_weighing)`), *when* analysis runs,
*then* every output that consumes it carries `INFERRED`, names the procedure,
shows the computed band and the stated default of 60 g per corner (120 g per
axle) on screen and in every export, carries tier `inferred`; *and when* the
user later records a measured value, *then* every one of those marks disappears
in the same session. The schema stage fails a default that lies outside the
field's own `plausible` range, so `ASSUME(0 g)` — 0 g against a 160–320 g
corner — cannot be reintroduced. **MUST** · **R1**

**E1.9** — *Given* a model with no `reference_ride_height` (the field's
`on_absence` is `REFUSE`), *when* the user opens analysis, *then* every
ride-height-dependent output carries `REFUSED` naming that field, no number is
displayed for any of them, the string "ride-height datum not recorded" is shown
once in the analysis-health line, and every output that does not consume the
field still computes. **MUST** · **R1**

**E1.10** — *Given* a model with hardpoints complete but corner weights not
measured, *when* the user opens the mass section, *then* the app offers a
recorded procedure for measuring the sprung/unsprung split and the ride stiffness
at a corner (steps, tools, datums, in `docs/specs/procedures/mass.md`), accepts
the raw readings (four corner weights, stepped ride heights, unsprung component
weights) and stores them as `derived` sources for the resulting masses and rates,
so that E3.13 can compare against a real number. **MUST** · **R2**

**E1.11** — *Given* a model whose real hardware differs from the modelled
representation (rocker arms, gull-wing arms, inboard spring on a linkage), *when*
the user records the difference, *then* it is stored in
`representation_note` (free text, ≤ 500 characters), shown on the model screen
and carried into the model's share summary, so a shared model cannot be mistaken
for an exact representation. **SHOULD** · **R2**

**E1.12** — *Given* a set of photographs of a chassis with a scale reference,
*when* the user imports them, *then* hardpoints can be picked from the image and
scaled from two reference measurements. **LATER** · **R2**

**E1.13** — *Given* a model being measured in the worksheet, or a setup with
unsaved edits in its working copy, each holding at least one confirmed value,
*when* the process is killed (force-stop, not backgrounded) at ten points in the
flow, *then* on relaunch the same screen and the same field are open, every
confirmed value is present with its provenance, at most the value being typed at
the moment of the kill is lost, and no field has been written with a default.
Verified by an integration test that kills the process at each point and reads
the store back. **MUST** · **R2**

---

### Epic E2 — Setup entry

A setup is a small, cheap, frequently-changed artifact. The failure mode to
design out is the one the corpus shows repeatedly: a change made to explore an
idea silently overwrites the setup that represented a known-good car.

**E2.1** — *Given* a model revision in the library, *when* the user creates a
setup, *then* the setup stores `model_ref {id, content_hash, name}` and
`geometry {base_hash, adjustments[], geometry_hash}`, where `content_hash` is the
model body's canonical hash recomputed at creation time (§4.5.2) and
`geometry_hash` is the canonical hash of the geometry the outputs are actually
computed from (§4.5.3); both hashes and the model name are visible on the setup
screen. A setup created against a model revision that is not on the device is
created in state `model_missing` (§4.6) and never with an empty or placeholder
hash. **MUST** · **R1**

**E2.2** — *Given* a saved setup, *when* the user changes any value, *then* the
saved setup is unchanged and the change lives in a working copy; *when* the user
saves, *then* a new revision is created with `parent_id` set to the previous
revision's id, and the previous revision remains selectable and is never
overwritten; *when* the user deletes a revision, *then* deletion is confirmed and,
for a model revision, the confirmation names every setup that references it by
label before anything is removed. **MUST** · **R1**

**E2.3** — *Given* any numeric field, *when* it is displayed, *then* its unit is
shown adjacent to the value; *when* the user switches a display-unit family,
*then* the rendered string changes to the expected string in the new family and
the stored document is byte-identical to before. Families that must exist:
`mm/cm/in` for length, `N/mm` and `lbf/in` for spring rate, `g/oz` for mass,
`°C/°F` for temperature. The assertion is a property test over the converter
(round-trip `parse(format(v)) == v` within 1 ulp for 10,000 generated values per
family) plus one rendered-string test per family. **SHOULD** · **R2**

**E2.4** — *Given* a setup field the user has not set, *when* analysis runs,
*then* the field is absent from the file (never defaulted to a number), and the
dependent output carries exactly the state §4.3.1's `on_absence` column
prescribes — `ASSUME` with the assumed value shown, `ESTIMATE` with the procedure
and band shown, `REFUSE` with the field named, or `OMIT` with the field named as
not included. The test is generated from that column; "assumes …", "inferred
from …" and "not computable" are three distinct strings and a test asserts no
state ever displays another state's string. **MUST** · **R1**

**E2.5** — *Given* the setup screen, *when* the user inspects any field, *then*
the field shows either the output names in its `consumed_by` list from
`docs/specs/fields.yaml`, or the exact string "reference only — not used in the
maths"; the test iterates every setup field and fails on any field that shows
neither, or whose displayed output names differ from the YAML. **MUST** · **R2**

**E2.6** — *Given* a 320 CSS px viewport, *when* the test drives the real route stack
from the setup screen to each of the seven setup groups in turn, *then* each group
is reached in ≤ 2 taps, every group is reachable without completing another
group first, and the tap counts measured with a 1-setup library and a 50-setup
library are identical. **MUST** · **R2**

**E2.7** — *Given* a setup saved against model revision A, *when* the model is
edited to revision B (a different `content_hash`), *then* the setup is not
silently recomputed: the app shows "model changed since this setup was saved",
names the changed field paths, and offers "recompute against the current model"
or "keep the model snapshot this setup was saved with", recording the choice in
the setup's `meta`. A change to a setup's `geometry.adjustments[]` (a shim or
wheel-offset change) does **not** raise this notice, because it does not change
`model_ref.content_hash`. **MUST** · **R2**

**E2.8** — *Given* a setup, *when* the user writes notes, *then* track,
conditions, tyre and general notes are stored under separate keys, are searchable
across all setups, and travel with the setup in every export (E7.1b asserts the
round trip). **SHOULD** · **R1**

**E2.9** — *Given* a paper setup sheet in front of the user, *when* they enter a
setup, *then* a sheet-order entry mode presents the same values in the order the
paper sheet lists them, so the transfer is one pass rather than a hunt.
**SHOULD** · **R2**

**E2.10** — *Given* a photograph of a filled paper setup sheet, *when* the user
imports it, *then* values are extracted for confirmation field by field.
**LATER** · **R2**

**E2.11** — *Given* a value entered as an estimate with a stated basis, *when*
any output consumes it, *then* that output carries `ESTIMATED_INPUTS` with the
count of estimated inputs behind it, the basis of each is one tap away, and the
export for that output names the field paths; *given* the value is later
measured, *then* the state drops to `COMPUTED` for every output that consumed it
and the count decreases by one. A model containing an `estimated` value whose
`basis` is empty fails at save (E1.3). **MUST** · **R1**

**E2.13** — *Given* a driver's written report of how the car behaved (free text in
the setup's `notes`, in any wording), *when* the user asks the app to interpret
it, *then* (a) every extracted claim is stated in the vocabulary **understeer** /
**oversteer** only — "push" and "loose" are accepted as input and normalised in
the output, and are never displayed as the app's own term; (b) every claim carries
exactly one phase from `entry`, `mid`, `exit`, and a claim whose phase cannot be
determined is labelled `unphased` rather than guessed into one of the three; (c)
every claim carries exactly one tier from `firm`, `inferred`, `speculative`
(§4.11); (d) every `inferred` claim displays the words "all else equal" in the
same view as the claim; (e) a claim the interpreter cannot place in the
understeer/oversteer axis is dropped and counted, never reworded into one. The
test runs the fixture set in `docs/specs/eval/driver-reports/` (each file with its
expected per-claim classification, phase and tier) and additionally asserts that a
report written with "push"/"loose" classifies identically to the same report
written with "understeer"/"oversteer". **MUST** · **R2**

---

### Epic E3 — Computation and analysis

The physics is the product. The criteria here are about the numbers being right,
being explainable, being honest when the geometry breaks them, being honest about
how much they have been checked, and arriving fast enough to be dragged.

**E3.1** — *Given* a model with both corners of an axle measured, *when* analysis
runs, *then* motion ratio (dimensionless) and wheel rate (N/mm) are reported per
corner, each separately from the spring rate so a spring change and a geometry
change can be told apart; *and given* a corner with `arm_type.upper:
"single_link"` and one inboard point (the touring-car case), *then* the motion
ratio is finite and no `UNDEFINED(coincident hardpoints)` is returned, while an
`arm_type.upper: "wishbone"` corner with two distinct inboard points returns its own finite
value. Both cases are golden tests. **MUST** · **R0**

**E3.2** — *Given* a model and setup that are `complete_for` each of ride
frequency, roll stiffness and load-transfer split (every field in the output's
`consumed_by` closure present, or `ASSUME`), and a stated lateral acceleration,
*when* analysis runs, *then* ride frequency (Hz) per axle, roll stiffness (N·m per
degree) per axle, and the lateral load-transfer split (percent carried by the
front axle) are reported with units and the lateral g used displayed next to
them; *given* any field in one of those closures is absent with `on_absence:
REFUSE`, *then* that output alone is `REFUSED` naming the field and the other two
still compute; *and given* any consumed value is `inferred` (CG height is the
normal case, §4.2.1), *then* the load-transfer split is shown with tier
`inferred`, its computed band, and the words "all else equal". **MUST** · **R1**

**E3.3** — *Given* a complete front and rear geometry, *when* analysis runs, *then*
static roll-centre height (mm above the ground plane) is reported per axle to
0.1 mm, and a migration table gives roll-centre height at roll angles from −3.0°
to +3.0° in 0.5° steps with the value at each step displayed rather than only
drawn; *and given* the right-hand corner of the example model, *then* a golden
case asserts camber gain in the **global** frame satisfies κ_R = −κ_L and in the
**per-wheel** frame (R-1) satisfies κ_R = κ_L, so the mirror rule and the
per-wheel convention cannot drift apart unnoticed. **MUST** · **R0**

**E3.4** — *Given* a complete geometry, *when* analysis runs, *then* camber gain
(degrees of camber change per degree of chassis roll) is reported per axle, and
static camber is reported at roll −2.0°, 0.0° and +2.0° for each corner, signed
per-wheel (positive = top outboard, R-1), so that the right-hand corner reads
positive where the left reads negative for the same physical geometry. **MUST** · **R0**

**E3.5** — *Given* a front geometry with `steering.rack` present and both tie-rod
points recorded, *when* analysis runs, *then* bump steer (degrees of toe change
per mm of wheel travel) is reported per side over a stated travel range, the
range used is displayed, and the rack fields used are named in the "how" view
(E3.7); *given* `steering.rack` is absent (`on_absence: REFUSE`), *then* bump
steer carries `REFUSED(rack geometry not recorded)`, no number is displayed, and
the screen offers the measurement procedure entry from E5.2. **MUST** · **R1**

**E3.6** — *Given* a model and setup carrying the six damper inputs of §4.8,
*when* analysis runs, *then* (a) ζ is reported per corner at the two stated shaft
speeds, with both speeds displayed; (b) it carries `INFERRED`, tier `inferred`
(§4.11), the procedure id `orifice_single_piston_v1` and a **computed band**
computed as §4.8 defines — recomputing ζ with each `estimated` input at the ends
of its own `tolerance_pct`, one at a time — and the band is displayed wherever ζ
is displayed, including every export and the compare view; (c) ζ is never marked
`validated`; (d) a test that doubles one input's `tolerance_pct` sees the band
widen, so the band cannot be a constant; (e) when two sheets are compared, the
signed **direction and magnitude of the ζ change** is rendered above the absolute
values, because that is the trustworthy part; (f) *given* any of the six inputs is
absent, ζ is `REFUSED` naming that field and no band, number or dash is shown.
**MUST** · **R1**

**E3.7** — *Given* any displayed output, *when* the user asks "how", *then* the app
shows, from a registry keyed by output id: the equation in symbols, the same
equation with this model's numbers substituted, the result with units, and the
provenance of every input used; the test asserts that every output id in §4.4 has
a registry entry, that the substituted values equal the stored values, and that
the displayed result equals the analysis value at the displayed precision.
**MUST** · **R0**

**E3.8** — *Given* degenerate geometry (zero-length link, coincident hardpoints,
parallel equal-length links producing an instant centre at infinity), *when*
analysis runs, *then* the affected output returns a typed `UNDEFINED` naming the
reason, the screen shows "undefined for this geometry" with that reason and no
number, and a randomised property test over ≥ 10,000 generated geometries finds
no `NaN`, no `Infinity` and no uncaught exception in any public function.
**MUST** · **R1**

**E3.9** — *Given* a geometry that computes but is outside the model's stated
validity domain (a roll-centre height outside `axles.<a>.roll_centre_validity`;
an instant centre at infinity from parallel equal-length links), *when* analysis
runs, *then* the output is displayed with the flag "outside the range this model
is valid for" and the bound that was exceeded, rather than as a normal number.
**MUST** · **R2**

**E3.11** — *Given* `packages/physics/test/golden/*.json`, *when* the
golden suite runs, *then* each file has keys `output_id`, `inputs`, `expected`,
`tolerance`, `source_kind` ∈ {`published_equation`, `cited_worked_example`,
`hand_calculation`} and `source_ref`; a `hand_calculation` requires a file under
`docs/specs/physics/` that exists and contains the `expected` value as a string; a
`cited_worked_example` requires a path under `docs/research/` plus a page or
timestamp locator; every output id in §4.4 has at least one file; and a run with
the implementation deliberately perturbed by 1% fails at least one assertion,
proving the values are not the code's own output. **MUST** · **R0**

**E3.12** — *Given* the reference phone (§5.2) running the installed app in a
production build, *when* the timing harness recomputes the complete example model
1,000 times, *then* a recompute takes **≤ 8 ms at p50 and ≤ 16 ms at p95** (D-21,
provisional); *and when* the user drags one slider continuously for 10 s (600
frames, the first 30 excluded as warm-up), *then* ≥ 95% of frames are presented
within 16.7 ms, no frame exceeds 32 ms, and the app stays interactive throughout —
a dropped frame is a defect, not a trade-off. The budgets are **provisional until
the first measurement**, and are re-baselined from it: the checked-in criterion
must then quote the number measured on the reference phone, with the harness
output in the release checklist (E9.3). A criterion still carrying D-21's estimate
after that measurement has been taken is a review failure, because an unmeasured
budget is indistinguishable from a wish. The pre-release proxy is the same harness
on CI hardware, gated at twice the target so a real regression trips it and a noisy
runner does not. **MUST** · **R1**

**E3.13** — *Given* a model where the user has recorded the measured ride
stiffness at a corner (E1.10), *when* analysis runs, *then* the predicted wheel
rate and the measured value are shown together with the signed difference, and a
difference greater than 15% raises "check your measurements or your model"
against that corner. **MUST** · **R2**

**E3.14** — *Given* any single setup input or geometry adjustment, *when* the user
asks what a change would do, *then* the app reports the change in each affected
output for a stated step of that input (e.g. +1 mm of upper-link inner shim),
computed numerically from the same analysis function, with the step size
displayed; the test fixes the step, the baseline fixture and the expected delta
for three inputs (shim, spring rate, ARB setting) as golden values.
**MUST** · **R2**

**E3.15** — *Given* a lateral acceleration input over time, *when* the user runs
the roll simulation, *then* chassis roll, load transfer and camber are reported
as a time series including droop-limited behaviour. **LATER** · **R2**

**E3.16** — *Given* any output on any surface that exists in the build under test
— analysis screen, compare screen, and every implemented export format — *when*
it is displayed or written, *then* it carries exactly one state from §4.4.1 and,
for the `COMPUTED_*` states, one of `validated` or `not_yet_validated`; a value
produced by this build is `not_yet_validated` unless a golden case (E3.11) exists
for that output and a recorded measurement check (E3.13) has passed for that
model. The test enumerates every output id in §4.4, renders every surface and
every export row, and fails on any surface where the state is missing or differs
from the expected state for the fixture. **MUST** · **R0**

**E3.17** — *Given* a roll-centre height, *when* it is displayed, *then* the app
also shows the numerically computed sensitivity d(z_rc)/d(hardpoint) for the two
hardpoints with the largest |sensitivity|, in mm per mm, so the user can see how
much of the number is measurement precision. **SHOULD** · **R2**

**E3.18** — *Given* a front geometry with `steering.rack` present, *when* the user
opens the steering readout, *then* the Ackermann percentage at a stated steering
input and the toe at roll −2.0°, 0.0° and +2.0° are displayed with units, and the
values are golden-tested against a hand calculation. **SHOULD** · **R2**

*E3.10 was removed in round 2 — see §8.3. The numbering of E3.11 onward is kept
so that cross-references elsewhere survive.*

---

### Epic E4 — Compare

Comparison is the feature that answers the question the racer actually has:
*what did I change, and what did it do?* It must be an explanation of a
difference, not two tables the user has to diff by eye.

**E4.1** — *Given* two setups attached to the same model, *when* the user compares
them, *then* one view lists (a) every input or geometry adjustment whose stored
value differs, with previous value, new value and signed delta with units, and
(b) every output id in §4.4, with previous value, new value, signed delta with
units and a direction word resolved from the `<output_id>.direction.<rising|falling>`
template. The test computes the expected input-diff set from the two fixture
files and asserts set equality, and asserts that every output row is present in
the view's component tree. **MUST** · **R1**

**E4.2** — *Given* two setups that differ only in `corners.LF.spring_rate`
(3.10 → 3.40 N/mm), *when* they are compared, *then* the output list has exactly
the rows of §4.4, exactly the outputs whose value changes by more than the
displayed precision are marked "changed", the changed set includes wheel rate,
ride frequency and roll stiffness and excludes roll-centre height, and every
"unchanged" row's displayed string equals the baseline's displayed string.
**MUST** · **R2**

**E4.3** — *Given* two setups whose `model_ref.id` differ, *when* the user attempts
to compare them, *then* the output comparison is refused with a message naming
both chassis and stating that outputs depend on geometry and are therefore not
comparable across different chassis, no output value from either setup appears in
that view, and the input comparison is offered and shows each differing input
with its value on each car. **MUST** · **R1**

**E4.4** — *Given* a comparison in which an output changed, *when* the user opens
that output, *then* the app names exactly the inputs and geometry adjustments that
changed **and** are in that output's `consumed_by` closure, computed from
`docs/specs/fields.yaml`, so the causal chain is visible without the user knowing
the equation; an input that changed but is not in the closure is not named.
**MUST** · **R2**

**E4.5** — *Given* a car with several setups, *when* the user marks one as the
baseline, *then* every other setup for that car displays its deltas against that
baseline, and the baseline selection is present after an app restart.
**MUST** · **R2**

**E4.6** — *Given* an output changed by several inputs, *when* the user asks for
the breakdown, *then* the app reports a one-at-a-time decomposition from the
baseline, in the field order of §4.3.1, plus a residual row labelled "interaction",
and Σ contributions + interaction equals the total change within 1e-9 relative;
the test asserts the identity and the field order. **SHOULD** · **R2**

**E4.7** — *Given* a comparison, *when* the user exports it, *then* the CSV of
E7.7 and the chart's table alternative (E8.7d) carry every row of the on-screen
comparison; the print layout is R2 and the chart's non-colour encoding is asserted
by A-04's test. **SHOULD** · **R2**

**E4.8** — *Given* three or four setups on the same car, *when* the user compares
them together, *then* one view ranks them per output and shows each difference
against a chosen reference. **LATER** · **R2**

**E4.9** — *Given* two sheets being compared, *when* their conditions differ in
`surface`, `air_temp`, `humidity` or `tyre.compound`, *then* the comparison shows,
above the first delta, a warning that names each differing condition with both
values and reads exactly "conditions differ — the changes below are not
attributable to the setup alone"; *given* the conditions are equal, or absent on
both sides, no warning is shown. The test asserts presence and exact text on the
differing fixture pair and absence on the control pair. **MUST** · **R1**

---

### Epic E5 — Learn and explain

The app is a teaching tool first and a calculator second; the intent says the
teaching happens *at the point where the concept is used*. Every criterion here
exists because a number the user cannot interrogate is worse than no number.

**E5.1** — *Given* any computed output, *when* the user taps its explanation,
*then* one screen states what the quantity is, what it affects on the car, the
equation that produces it (E3.7), the validity state of the value, and what
happens to the car when it rises or falls — reachable in one tap from the value
itself, not from a separate manual; the test asserts the route from every output
row is one tap and that the screen contains the equation string produced by the
E3.7 registry. **MUST** · **R0**

**E5.2** — *Given* any input field with at least one consumer, *when* the user taps
"how do I measure this?", *then* the app states the datum, the tool, the common
mistake and a worked example with numbers, and the worked example's inputs are the
example model's own values; the test asserts an entry exists for every field with
a consumer in `docs/specs/fields.yaml` and that the worked example's numbers equal
the example model's stored values. For the one field with `on_absence: ESTIMATE`
— CG height — the entry states that corner scales cannot locate a CG and offers
the two-hang plumb-line procedure instead of a measurement. **MUST** · **R1**

**E5.3** — *Given* `docs/specs/terms.txt` (one term per line) and the localisation
bundle, *when* the term check runs inside the gate, *then* for every term that
occurs in any shipped explanation or help string there is a glossary entry with a
non-empty definition and at least one inbound link, and for every glossary entry
there is at least one shipped string that links to it; the check exits non-zero
naming the term and the bundle key when either direction fails. **SHOULD** · **R2**

**E5.4** — *Given* the shipped explanation and help strings and `docs/research/`,
*when* the overlap check runs inside the gate, *then* no explanation or help
string shares a run of 8 or more consecutive words with any corpus document
unless its string key is listed in `docs/specs/overlap-allowlist.json` with a
one-line reason; fixtures, golden values and test data under
`docs/specs/physics/` are out of scope; seeding one verbatim 9-word corpus
sentence into a shipped string makes the gate exit non-zero naming the key, and
adding that key to the allowlist makes it exit 0. **MUST** · **R1**

**E5.5** — *Given* any analysis screen, *when* it is displayed, *then* an
"assumptions and limits" entry is present in one tap whose text equals the block
in `docs/specs/limits.md` (at minimum: tyre behaviour, aerodynamic load, chassis
torsional flex, the diff-height torque term, droop-limited roll) plus the
model-specific assumed fields from E1.2, and the identical block is carried in
every export (asserted by string equality between screen and export).
**MUST** · **R1**

**E5.6** — *Given* the production build, *when* the string audit runs over the
string table and the component tree of every screen, *then* no user-facing
string matches
`(?i)\b(grip score|handling score|balance verdict|best setup|faster|lap time)\b`,
every directional string on the analysis, compare and concept screens resolves
from the `<output_id>.direction.<rising|falling>` templates; (b) every statement
about grip carries the `inferred` tier and the words "all else equal", no grip
value is presented as measured or computed anywhere, and adding a grip number — a
ratio, a coefficient, a percentage — fails the audit naming the key; (c) adding
one free-text handling claim fails the audit naming the string key.
**MUST** · **R1**

**E5.7** — *Given* a first launch, *when* the user follows the guided path, *then*
the sequence model → measure → first setup → first delta is presented as discrete
steps with progress shown, and progress survives an app restart at any step.
**SHOULD** · **R1**

**E5.8** — *Given* the glossary, *when* the user searches a term, *then* it returns
the definition plus every screen and output that uses it, and the vocabulary is
the community's (roll centre, camber link, droop, motion ratio, ride stiffness,
roll stiffness, bump steer, ackermann) as listed in `docs/specs/terms.txt`.
**SHOULD** · **R2**

---

### Epic E6 — Model library and sharing

The original library died with its website. The library here must be a set of
files that anyone can copy, and installing one must never require trusting a
server.

**E6.1** — *Given* a fresh install, *when* the app first opens, *then* at least
one complete example model is present, it is the model used by the tutorial and
by every worked example (E5.2), every one of its values has a resolvable
provenance entry, it carries `license`, `contributors[]` and `attribution_text`
(§4.9), and a test asserts that every field with `req: yes` in
`docs/specs/fields.yaml` is present in it, so "complete" is measured against the
table rather than asserted in prose. **MUST** · **R0**

**E6.2** — *Given* a model file received by any of the three entry points the
harness can drive (file picker — `<input type="file">`, or a File System Access
picker where the browser has one — drag-and-drop onto the app on desktop, and
paste-a-document on any platform, per D-22), *when*
the user installs it, *then* the library row shows its name, its `class`, its
completeness as `<measured>/<required> fields` computed from `fields.yaml`, and a
provenance summary equal to the counts in the file's `sources` map, and the
analysis screen displays roll-centre height and camber gain for the fixture's
axle with values equal to the golden fixture within 1e-9 relative, with zero taps
between install and display. **MUST** · **R1**

**E6.3** — *Given* a library of 200 models, *when* it is displayed, *then* each row
shows name, class, completeness count and percentage, provenance summary and
last-modified date, and the percentage equals measured fields divided by required
fields from `fields.yaml` for that row's own model; a row whose percentage does
not match the recomputation fails the test. **MUST** · **R2**

**E6.4** — *Given* a model or setup, *when* the user shares it, *then* a single
self-contained JSON file is produced — offered through the Web Share API where the
browser exposes it for files, and through a download or a save dialog everywhere
else (D-20, D-22) — the app performs no network request to complete the share, and
the preview names every personal field in the file (`sources.<id>.by`,
`contributors[].name`) and the licence id, so the user knows what is leaving the
device. **MUST** · **R1**

**E6.5** — *Given* an invalid file — including a binary database, an installer, or
anything produced by the program this app succeeds — *when* it is imported, *then*
it is rejected with the schema path and the reason for each offending field (or,
for a non-JSON or foreign artifact, the single reason "not a Setup Lab
document"), nothing is added to the library, and the screen offers the
measurement worksheet instead; *given* a file that is valid but incomplete, *then*
it is added as incomplete, the missing fields are listed from `fields.yaml`, and
no value is invented to fill them. **MUST** · **R1**

**E6.6** — *Given* a file whose `schema_version` major is newer than the app
supports, *when* it is imported, *then* the import is refused with the file's
version and the app's supported range named, and no partial data is written;
*given* a file with a newer **minor** and the same major, *then* it is imported,
its unknown non-`x_` keys are preserved verbatim under their original names, and
the library row says "contains fields from a newer version". **MUST** · **R2**

**E6.7** — *Given* a contributor who has measured a chassis, *when* they prepare a
contribution, *then* the app can export a contribution bundle (the model, the
worksheet answers, and references to photographs). **LATER** · **R2**

**E6.8** — *Given* an internet connection, *when* the user browses a model library
inside the app, *then* a model can be installed without leaving the app.
**LATER** · **R2**

**E6.9** — *Given* a setup file whose `model_ref.content_hash` resolves to no
stored revision, *when* it is imported, *then*: (a) it is installed in state
`model_missing` and appears in the setup list with the badge "model missing";
(b) opening it shows every stored input, condition and note read-only, and the
output list shows no digits, each output carrying `REFUSED(model_missing)`;
(c) exactly three actions are offered — "Import this model…", "Use a different
model…", "Discard" — and share and export remain available; (d) "Import this
model…" installs a model chosen in the same flow, and when its hash equals
`model_ref.content_hash` the state becomes `linked` and outputs compute, while a
matching id with a different hash takes the E2.7 path; (e) "Use a different
model…" writes `model_ref.mapped_from = {id, content_hash, name}` (the original
values, verbatim, never overwritten), adds `meta.mapped_at`, sets state `mapped`,
and every output then carries the banner "geometry differs from the sender's car
— outputs are not comparable"; (f) "Discard" removes the library record and
leaves any file outside the app untouched. Each of (a)–(f) has its own component
test. **MUST** · **R1**

---

### Epic E7 — Import, export and durability

The file format is the community's memory. If a user cannot get their work out
in a form that outlives the app, the app has failed at the only thing the
original could not do.

**E7.1a** — *Given* a model file, *when* it is exported, imported into a second
browser profile or a second device — through a different entry point, so the file
path is exercised rather than the in-memory store — and a setup is computed
against it, *then* the imported
`content_hash` equals the exported one, every stored value is present with its
original source id, `schema_version`, `meta.app_version`, `license`,
`contributors[]`, `attribution_text` and the E5.5 assumptions block are all
present in the imported file, and every computed output for the paired setup
agrees with the original within `|Δ| ≤ 1e-9·|ref| + 1e-12`. **MUST** · **R1**

**E7.1b** — *Given* a setup file, *when* it is exported and imported where its
model resolves, *then* every stored input, condition, note and
`geometry.adjustments[]` entry round-trips equal value by value (not byte-wise),
`geometry_hash` is identical on both sides, and the outputs are equal within the
same tolerance as E7.1a; *and given* it is imported where the model does not
resolve, *then* E6.9's behaviour is the only behaviour, asserted by the same
test. **MUST** · **R1**

**E7.2** — *Given* an exported file, *when* it is opened in a text editor, *then*
it is indented, keys appear in the documented order, units are declared in the
`units` object for every dimension the file uses, unknown-but-preserved fields
survive a round trip, the file contains no encoded binary and no base64 blob, and
every identifier that names another document is accompanied by that document's
human-readable name and either a resolvable locator or an explicit
`model_missing` marker. A file whose only reference to another document is an
opaque hash fails the test. **MUST** · **R1**

**E7.4** — *Given* a setup, *when* the user exports a setup sheet, *then* a single
page is produced containing the inputs, the key outputs with units and states
(E3.16), the notes and one line naming the model, its content hash and its
completeness; the PDF is produced on every platform, and printing is offered
where the platform supports it. **MUST** · **R2**

**E7.5** — *Given* a library that already contains a model or setup with the same
id as an imported file, *when* the import runs, *then* nothing is overwritten
without confirmation, the differing field paths are shown before the user
decides, `license`, `contributors` and `attribution_text` are shown side by side,
and the default action creates a copy with a distinguishing label.
**MUST** · **R2**

**E7.6** — *Given* a populated library, *when* the user runs backup, *then* one
file contains every model, setup and note plus a per-document SHA-256 of its
canonical form; *when* the user restores that file into a populated library,
*then* every hash is verified, a mismatch refuses the whole restore naming the
document, a preview of additions, conflicts and replacements is shown, and
nothing is written until confirmed. **MUST** · **R2**

**E7.7** — *Given* a comparison, *when* the user exports it, *then* a CSV with one
row per setup and one column per input and output is produced, with units and
validation states in the header. **SHOULD** · **R2**

**E7.8** — *Given* a spreadsheet of setups, *when* the user imports it, *then* a
mapping screen assigns columns to setup fields, the user picks the unit for each
mapped column, and the resulting setups are previewed before being created.
**SHOULD** · **R2**

**E7.10** — *Given* a manufacturer's published setup sheet format, *when* the user
imports it, *then* values are mapped with a confirmation step. **LATER** · **R2**

**E7.11** — *Given* an export that fails (no space, permission revoked,
cancelled), *when* it fails, *then* the source document is unchanged and still
openable, the failure names its cause, and the user can retry from the same
screen; asserted with a mocked filesystem that fails the write. **MUST** · **R2**

**E7.12** — *Given* a model file carrying `license`, `contributors[]` and
`attribution_text`, *when* it is imported, listed in the library, analysed,
exported and re-shared as a new file, *then* the three keys are byte-identical at
every step (compared against the imported values, not against a re-serialisation),
the library row and the analysis screen's provenance line display `license.id` and
the first contributor's name, and a re-share whose `attribution_text` differs from
the imported string fails the test. A model whose `license.id` begins `CC-BY` and
whose `contributors` is empty is refused at import, naming the missing
attribution. **MUST** · **R1**

*E7.3 was folded into E7.1a and E7.9 into E6.5 in round 2 — see §8.3.*

---

### Epic E8 — Platform, offline and accessibility

The phone at the track is the only context that matters, and it is a hostile
one: bright sun, gloves, one hand, no signal, no charger. v1 is one web app served
by one URL, so every criterion here is written against two engines — Safari on iOS,
Chrome on Android — and neither is a later port of the other. What is new under
D-19 is that the browser is a third party in the middle: it can evict the user's
data, it can serve a stale app from a service worker, and it decides whether a file
picker or a download dialog is the shape of "save" (D-20, D-22). Those are the
subjects of E8.1, E8.17 and E8.18.

**E8.1** — *Given* that a first load has completed once, *when* the browser is put
into offline mode — no network at all — and the app is cold-started from its URL or
from the home-screen icon, *then* the shell loads from the service worker, the
library renders, a stored model opens and every output computes and displays, with
zero network requests: the test's request log contains no request after the shell
is served. The static half is the gate's `offline` stage, which fails the build if
any module in the bundle calls `fetch`/`XMLHttpRequest`/`WebSocket` against an
origin other than the app's own, if any `<script src>` or font URL points off
origin, or if the service worker's precache manifest omits a shell asset. Seeded
failure: adding an off-origin `fetch` to any module makes the stage exit non-zero
naming the module. **MUST** · **R1**

**E8.2** — *Given* a phone with the radio off and the browser in offline mode,
*when* an integration test drives model → setup → compute → compare → explain →
export, *then* every step reaches its own assertion (each named in the test) and
no step blocks on a network call. **MUST** · **R2**

**E8.3** — *Given* a first launch, *when* the app opens, *then* no account, login,
email address or personal detail is requested at any point, and the analysis
screen is reachable without entering anything about the user; the test drives the
first-run flow and fails on any text field that collects personal data.
**MUST** · **R2**

**E8.5** — *Given* the reference phone with the app installed and its shell
cached, *when* it is cold-started to an interactive analysis screen, *then* it
takes ≤ 2.0 s, and opening a stored model takes ≤ 300 ms, measured by an automated
test on the production build. The **first** load is a different measurement and is
governed by E8.11's byte budget rather than by this criterion: on a phone network,
time-to-interactive is a function of what has to be downloaded, and E8.11 is the
number the app controls. **MUST** · **R2**

**E8.6** — *Given* a browser on the current or previous major version of Safari
(iOS and macOS), Chrome (Android and desktop) and Firefox, *when* the app runs,
*then* every screen is usable from 320 CSS px to 1024 CSS px of viewport width, in
portrait, landscape and split view, with no horizontal scrolling and no clipped
value on the analysis screen at 320 px; the test walks every route at 320, 411 and
1024 viewport widths in all three engines, and a route that works in only one of
them fails. **MUST** · **R2**

**E8.7a** — *Given* every route at 320 CSS px, *when* the test walks the
accessibility tree, *then* every tappable node reports a size ≥ 44×44 CSS px and
≥ 8 px from its nearest tappable neighbour. **MUST** · **R2**

**E8.7b** — *Given* 200% browser zoom and, separately, a 32 px root font size —
two mechanisms, both real, and neither implied by the other — *when* every route
is rendered, *then* no text node's box exceeds its parent's, and every output value
on the analysis screen has non-zero painted height and its full string present in
the accessibility tree (so a value clipped to "12." fails). **MUST** · **R2**

**E8.7c** — *Given* a dump of the theme tokens in both themes, *when* the contrast
check runs, *then* every foreground/background pair meets 4.5:1 for body text,
3:1 for large text and 3:1 for non-text UI, and every delta carries a sign and a
direction word in addition to colour (A-04). **MUST** · **R2**

**E8.7d** — *Given* any chart, *when* the test opens its table alternative, *then*
the table is reachable in one tap and its row count equals the chart's
data-point count. **SHOULD** · **R2**

**E8.8** — *Given* a screen reader, *when* the user moves to a computed value,
*then* it announces the quantity's name, its value, its unit, its validation
state and whether it changed from the baseline, and no icon-only control is
unlabelled; asserted by reading the accessibility tree on the analysis, compare and
concept screens. **MUST** · **R2**

**E8.9a** — *Given* the production build, *when* the externalisation check runs inside
the gate, *then* every user-facing string resolves from the localisation bundle,
no string is assembled by concatenation (asserted by a lint rule on string
interpolation inside user-facing components), and adding a literal user-facing
string fails the check naming the file and line. **MUST** · **R2**

**E8.9b** — *Given* a pseudo-locale that expands every string by 40% and an RTL
locale, *when* every route is rendered, *then* no text is clipped, no number or
unit is misformatted, and no layout overlaps. **SHOULD** · **R2**

**E8.11** — *Given* the production build, *when* its sizes are measured, *then* the
**first load is ≤ 350 KB of gzipped JavaScript**, the **total cached asset set is
≤ 2 MB**, and **a single model document is ≤ 100 KB** (D-21), with the three
figures and the measuring command recorded in the release checklist (C-02); the
build job runs the size check on every pull request and **fails** above a budget
rather than warning, because a warning nobody reads is how a 350 KB budget becomes
1.4 MB. The budgets are **provisional**: after the first measurement on the
reference phone they are re-baselined, and the numbers checked in at that point are
the measured ones. **MUST** · **R1**

**E8.12** — *Given* a save in progress, *when* the tab is closed or the process is
killed at the transaction boundary, *then* the previously saved revision is intact
and readable on next launch, and no partially written revision is ever offered as
valid; the tests abort a storage transaction through the store's own failure hook
for each document kind, and a browser test closes the tab mid-save and reopens the
app. **MUST** · **R1**

**E8.13** — *Given* the shipped bundle and the app's screens, *when* the
dependency check, the request-log test and the privacy test run, *then* (a) the
resolved dependency tree contains no package whose declared purpose is analytics,
advertising or crash reporting, and adding one to `package.json` makes the check
exit non-zero naming the package; (b) a Privacy screen is reachable in two taps
from the about screen and its exact text equals `docs/release/privacy.txt`; and
(c) **no third party is contacted at any point** — with the production build open
and every route, import and export exercised while online, the request log contains
requests to the app's own origin only: no beacon, no analytics endpoint, no
third-party font, no error-reporting call, no telemetry of any kind. **MUST** · **R1**

**E8.14** — *Given* a save that fails — the storage quota is exceeded, persistent
storage was refused and the browser rejects the write, or the transaction is
interrupted — *when* it fails, *then* the failure is reported on the field being
saved with a retry affordance that retries that row only, no other value is lost,
and the previous revision remains current; asserted with a mocked storage backend
whose second write rejects with `QuotaExceededError`. **MUST** · **R2**

**E8.15** — *Given* a corrupt or unreadable record in the library at launch, *when*
the app opens, *then* the record is moved to the quarantine store rather than
deleted, named in a single notice with its id and the reason it could not be read,
its raw bytes remain exportable, and the rest of the library opens normally.
**MUST** · **R2**

**E8.16a** — *Given* every slider and drag-based input, *when* the test opens its
stepped alternative, *then* each offers a numeric field or ± step buttons that
produce the same values as the drag, reachable in one tap (A-08).
**MUST** · **R2**

**E8.16b** — *Given* a keyboard-only or switch-access session, *when* the user
traverses the analysis screen, *then* focus order equals the visual reading order,
every interactive element is reachable and operable, no control is reachable only
by pointer, and focus is visible at every stop (A-07). **MUST** · **R2**

**E8.16c** — *Given* the `prefers-reduced-motion: reduce` media query, *when* it
matches, *then* no non-essential animation runs, and no content flashes more than
three times per second in either setting (A-09). **MUST** · **R2**


**E8.17** — *Given* a first visit on a phone, *when* the app offers installation,
*then* (a) the build ships a Web App Manifest with name, short name, start URL,
`display: standalone`, theme and background colours, and 192 px and 512 px icons
including a maskable one, and Lighthouse's installability audit passes on the
production build; (b) on a browser that fires `beforeinstallprompt` (Chrome on
Android) the first run offers one install action wired to that event, dismissible,
and not offered again unless the user asks; (c) on iOS Safari, where no such event
exists, the first run shows the two-step instruction (Share → Add to Home Screen)
as text — not a button that cannot work — and says that installation is what keeps
the library; and (d) the reason is stated in one sentence on the same screen: an
installed app is exempt from the browser's seven-day eviction of unvisited sites,
a bookmark is not. **MUST** · **R1**

**E8.18** — *Given* a library of documents, *when* the user's storage state is
examined, *then* (a) `navigator.storage.persist()` is requested at first run before
the first document is written, and the result is shown on a storage-state row with
the usage and quota reported by `navigator.storage.estimate()`; (b) "export
everything" produces **one archive** containing every model, setup and note, the
date of the last successful export is shown, and the app prompts — dismissible for
the session, not a modal — to export once that date is more than seven days old;
(c) when a write fails because the quota is exhausted, the app says so, names the
largest documents, and offers export-then-delete instead of losing an edit
silently; and (d) when the library is empty on startup *and* a previous session
recorded documents, the app says the data was evicted or cleared, offers "import
your backup" as the primary action, and does not present a first run — because an
empty library is otherwise indistinguishable from a fresh install, and the user
must be told which one happened. **MUST** · **R1**

*E8.4 (deleted, duplicate of E8.1) and E8.10 (deleted, duplicate of E8.7c) — see
§8.3. The former E8.7 and E8.9 are split into a/b/c and a/b, and A-07/A-08/A-09
gain ACs of their own as E8.16a–c.*

---

### Epic E9 — Release

**E9.1** — *Given* the app, *when* the user opens the about screen, *then* the app
version, the supported schema version range and the spec version are shown, and
the app version and schema version travel in every export (asserted against
E7.1a's fixture). **MUST** · **R2**

**E9.3** — *Given* the version being submitted, *when* the release checklist is
inspected, *then* `docs/release/checklist-<version>.md` exists and every item in
§3.5 is present with a reviewer name, a date and either a pass mark or a path to
the evidence; a missing item, an unsigned item or an item with no evidence path
fails the test that parses the file. **MUST** · **R1**

**E9.4** — *Given* a release candidate, *when* the gate's IP stage runs over the
built artifacts, *then* it contains no occurrence of the predecessor's names, no
`.sdf` or other database asset and no string with an 8-word overlap that E5.4
would reject, and the stage exits non-zero on any hit; the seeded-failure test
injects the predecessor's product name into an asset and asserts the stage fails
naming the string. **MUST** · **R1**

**E9.5** — *Given* five participants who have not seen the app, recruited per
`docs/specs/eval/protocol.md`, *when* each completes the session unaided, *then*
(a) ≥ 4 of 5 produce a model whose required fields are all present within 30
minutes, measured from first page load — or from the home-screen icon, where the
app was installed — to the first analysis screen with all four corners measured; (b) each participant, shown a camber-link shim change and a
roll-centre change, names the direction of the affected output in the same
direction the app's own sensitivity output (E3.14) reports, before the app shows
the delta; (c) every session's timing, failures and abandoned steps are recorded
in `docs/specs/eval/run-<date>.md`. Release blocks on (a) and (b) together, not on
each individual session. **MUST** · **R2**

**E9.6** — *Given* the app, *when* the user opens licences and credits, *then* the
code licence, the data licence, and for every shipped model its
`attribution_text`, its `license.id` and every `contributors[].name` are readable
in-app, generated from the model files themselves (not from a hand-written list),
and the dedication is shown; the test asserts the displayed set equals the set
computed from `assets/models/*.json`. **MUST** · **R2**

**E9.7** — *Given* a user who has found a problem, *when* they look for a way to
report it, *then* a route that requires no account is offered (a mail link or an
issue tracker link) and it is reachable from the about screen. **SHOULD** · **R2**

**E9.8** — *Given* the release commit, *when* `npm run gate` runs in CI from the
repository root, *then* every stage exits 0 and the stages are exactly: typecheck,
test, spec audit (E9.9), schema and fixtures (E9.10), IP and overlap (E9.4, E5.4),
offline (E8.1), dependency, privacy and third-party requests (E8.13), string audit
(E5.6); a stage that exists in `tool/gate.ts` without a corresponding AC here fails
the spec audit, and a stage that is named here but absent from the gate fails the
gate. The gate runs on every pull request and its output is pasted in the PR
(AGENTS.md). **MUST** · **R1**

**E9.9** — *Given* the repository, *when* the gate's spec-audit stage runs, *then*
it exits 0 only if every MUST id in §3 whose release marker is R0 or R1 appears
in at least one `specTest('<id>', …)` wrapper call in a test file (a JSDoc
`@SpecTest <id>` tag on the test is equivalent; R2 MUSTs may be annotated early but
are not required to be, so the gate cannot block v1 on a release that has not
started), every annotation's id exists in §3 with the same tag and release marker,
and no LATER-tagged AC has a test; deleting one `specTest('E3.3', …)` call, adding
an unknown id, and annotating a LATER id each make the stage exit non-zero naming
the id, and each is a separate seeded-failure test in the gate's own suite.
**MUST** · **R1**

**E9.10** — *Given* `docs/specs/fields.yaml`, the JSON schema and the fixture
directory, *when* the gate's schema stage runs, *then* it fails unless: (a) every
field of §4.2.1 and §4.3.1 appears in the YAML exactly once with `type`, `unit`,
`req`, `on_absence` ∈ {`ASSUME`, `ESTIMATE`, `REFUSE`, `OMIT`}, an `assume` value where
the policy is `ASSUME`, an `estimate` procedure id where the policy is
`ESTIMATE`, `plausible`, and `consumed_by`; (b) every `consumed_by` id
exists in §4.4; (c) the Markdown tables in §4.2.1 and §4.3.1 are identical to what
the YAML generates; (d) there is one fixture per `schema_version` the app writes,
and each fixture either loads or is refused with a named reason. Seeded failures
are five separate tests: delete one `on_absence`, set an `on_absence` to `ASSUME`
on a field whose YAML declares an `estimate` procedure, point a `consumed_by` at
an unknown output, change one Markdown cell, and add a schema version with no
fixture — each must exit non-zero naming the defect. **MUST** · **R1**

*E9.2 was folded into E9.10 in round 2 — see §8.3.*

---

### 3.5 Release checklist (not acceptance criteria)

These are editorial and observational: no behavioural test can decide them, so
they are not ACs. What *is* asserted is that the evidence exists — E9.3 parses the
checklist and fails on a missing, unsigned or unevidenced item.

| # | Item | Evidence |
|---|---|---|
| C-01 | Install surface checked against the clean-room rule (was E9.3's content): manifest name and short name, icons, the first-run install copy for both engines, store-free sharing text, and any screenshot or preview used publicly | the reviewed manifest, icons and copy in `docs/release/` |
| C-02 | Artifact sizes measured and recorded (E8.11): first-load JS, total cached assets, largest model document | the `size-limit` and build output pasted into the checklist |
| C-03 | Continuous 30-minute session on the reference device: no thermal frame-rate drop, ≤ 5% battery (P-10) | the session log |
| C-04 | Reference-device performance numbers for E3.12 pasted from the harness | harness CSV |
| C-05 | The three-user usability session (E9.5, R2) — each participant's run file linked | `docs/specs/eval/run-<date>.md` |
| C-06 | **SUPERSEDED by D-19** — there is no store and therefore no data-safety declaration to submit. The declaration's *substance* is now the Privacy screen (E8.13 clause (b)) plus the no-third-party-request test (clause (c)); publishing that text at a public URL is a marketing choice, not a release gate | — |
| C-07 | Every MUST id in the release marker R1 has a green test in the gate output pasted in the release PR | the PR body |

---

## 4. Data model

Two document kinds in v1 — car model and setup — plus a third, the `damper_curve`
document, described but not shipped (§4.8). All are plain JSON, all carry
`schema_version`. They are the
app's public interface: a setup or a model that leaves the device must be
readable, validatable and re-importable by a future version of the app and by a
person with a text editor.

**`docs/specs/fields.yaml` is the single normative definition of the on-disk
schema** — every field of both kinds, once, with its type, unit, requiredness,
`on_absence`, plausible range and the outputs it feeds. This section and
`docs/specs/physics/01` §5 are *views* of it: §4.2.1 and §4.3.1 are generated
from it (E9.10 fails the build if they diverge) and the two worked examples are
the same car. No other document defines field names, units or the frame.

### 4.1 Rules that apply to both documents

1. **Units are declared in the file, not implied, and keys never carry a unit
   suffix.** A `units` object declares one unit per dimension in use, from the
   closed list in `fields.yaml` (`meta.dimensions`): `length` (mm), `mass` (g),
   `angle` (deg), `spring_rate` (N/mm), `damper_force` (N), `damper_speed`
   (m/s), `viscosity` (cSt), `temperature` (°C), `pressure` (kPa), `ratio` (–),
   `count` (–), `percentage` (%), `torsion_stiffness` (N·m/deg),
   `shear_modulus` (GPa) and `damping_coefficient` (N·s/m). Every field name
   names the quantity (`air_temp`, not
   `air_temp_c`), and a file that uses a dimension it does not declare is
   refused. R-2: **SI exists only inside the
   physics package, at exactly one conversion boundary** — the adapter that turns
   a document into the typed model. No arithmetic is ever performed on a
   storage-unit value, and the adapter rejects any coordinate whose modulus
   exceeds **3000 mm** as a suspected metre value (E3.8's property test covers
   the guard with both units).
2. **Every numeric value is an object, not a bare number:**
   `{"value": <number>, "source": "<source id>"}`, where `source` resolves into
   the document's top-level `sources` map (D-16: a value without a source is a
   schema error, not a review note). One source id can be shared by many values (a whole
   caliper session is one source), which keeps files readable and provenance
   honest at the same time. Integers are written without a fractional part only
   where the field's `type` is `count`; every other numeric field is a real
   number.
3. **Absence has exactly one policy per field, and never a silent default.** A
   field that is not measured is **omitted**. It is never written as `0`, `null`
   or a sentinel. Every field in §4.2.1 and §4.3.1 carries a mandatory
   `on_absence` attribute with one of four legal values, and the loader and the
   analysis obey that value and nothing else:

   | `on_absence` | Meaning | What the user sees |
   |---|---|---|
   | `ASSUME(value)` | The output is computed with the stated value. | `COMPUTED_ASSUMED`, naming the field and showing the value; the value appears in the assumptions block (E5.5) and in every export. |
   | `ESTIMATE(procedure)` | The field is not asked for as a measurement: the app infers it by the named procedure in `docs/specs/procedures/`, records it with `inferred` provenance, and computes a band. | `INFERRED`, naming the procedure and showing the band; tier `inferred` (§4.11); the value appears in the assumptions block with its band and may not be edited as if it were a measurement. |
   | `REFUSE` | The output is not computable. For a document-envelope field, the document itself is refused (E6.5). | `REFUSED`, naming the field and showing **no number, no dash, no unit**. |
   | `OMIT` | The output is computed without the field, and the maths does not require it. | `COMPUTED_INCOMPLETE`, naming the field as not included. |

   The four rules that make these agree, and that a test can check (E1.2, E2.4,
   E9.10): (i) every field has exactly one policy and a field with none fails the
   schema stage; (ii) `ASSUME` requires an `assume` value and `ESTIMATE` requires
   an `estimate` procedure — those two are the only places the app may produce a
   number the user did not enter, and both are named on screen, in the
   assumptions block and in every export; (iii) `ESTIMATE` is the policy for a
   quantity a racer cannot measure at the bench (CG height is the archetype:
   corner scales cannot locate a CG), so choosing `ASSUME` for such a field is a
   schema error; (iv) `OMIT` is legal only where the field refines a value the
   maths can produce without it, so a consumer that changes the result decisively
   must declare `REFUSE`. "Not measured", "assumed" and "inferred" are three
   different states with three different strings (asserted in E2.4).
4. **A source entry must resolve, and must say what kind of evidence it is:**

   | `type` | Meaning | Required extra fields |
   |---|---|---|
   | `measured` | The owner measured this car with a named tool | `method`, `datum`, `by`, `date` |
   | `estimated` | The owner could not measure it and supplied a considered figure | `basis`, `by`, and optionally `tolerance_pct` |
   | `manufacturer` | From a manual, CAD, or published drawing | `ref` |
   | `third_party` | Another person's measurement or a contributed model | `by`, `ref` (may be a handle) |
   | `library` | Copied from another model in the library | `ref` (`<model id>#<field path>`), `by` |
   | `derived` | Computed from other values in the file | `from` (list of field paths), and for `derived_by_mirror`, the mirrored field path |
   | `inferred` | Derived by the app or the user from an estimate, a procedure or a model, rather than from a measurement of this car | `method` (the procedure id), `basis`, `tolerance_pct`, and the band it produces; tier `inferred` (§4.11) |
   | `unattributed` | Present in a file with no recorded origin — a **file defect** | *(none — the completeness count treats it as unmeasured)* |

   `unknown` is **not** a source type: it is the user-facing state meaning "the
   owner explicitly does not know", and it stores no value. An `estimated` value
   is written and used, never silently promoted to `measured`; every output that
   consumes one carries `ESTIMATED_INPUTS` (E2.11). A `library` value is never
   accepted where the source it copies from is itself `estimated`.
5. **Content hash.** `content_hash` is the SHA-256 of the document's canonical
   form, defined exhaustively in §4.5. Each model revision's hash is what setups
   reference, so a model can be edited without silently changing the meaning of a
   saved setup.
6. **Revisioning, and what a setup may change.** A saved model is immutable.
   Editing produces a new revision with a new `content_hash`; the library holds a
   pointer to the current one and every earlier revision stays on disk. A setup
   references `(model_id, content_hash)` for its **base** revision, and may also
   carry the closed set of geometry adjustments in §4.3.2, which transform that
   base geometry into the geometry the outputs are actually computed from. The
   base hash is unchanged by an adjustment; the derived geometry has its own
   `geometry_hash` (§4.5.3). This is how E2.7 is satisfied without embedding
   model copies inside setups, and it is what makes a shared setup readable at
   all (§4.6).
7. **Forward compatibility.** A reader preserves every key it does not understand
   and writes it back on export: `x_`-prefixed keys and, within the same major
   version, unknown non-`x_` keys (E6.6). A reader refuses a document whose
   `schema_version` major is greater than it supports. Unknown keys are part of
   the hashed body (§4.5.1), so a re-export that drops one changes the hash and
   fails E1.7.
8. **Licence, contributors and attribution text are content.** They are hashed,
   they survive import, analysis, export and re-share, and a document that
   requires attribution cannot be imported without it (§4.9, E7.12).

### 4.2 Car model

**This section is a view.** `docs/specs/fields.yaml` is the single normative
definition of every field in a car model or a setup — path, type, unit,
requiredness, `on_absence`, plausible range and the outputs it feeds. This
section adds only what YAML cannot carry: the frame, the sign conventions, what
"the same car" means, and a complete worked example. The table in §4.2.1 is
generated from the YAML and E9.10 fails the build if the two diverge.
`docs/specs/physics/01` §5 is an **example of this file** — a second worked model
with the physics package's own commentary — and not a second definition
(`decisions.md` D-16).

**Frame — ISO 8855, and nothing else (R-1).** Right-handed, **x forward, y to the
LEFT, z up**. Origin on the ground plane (the flat plate the wheels stand on) at
the intersection of the rear axle centreline and the vehicle centreline. So:

- rear contact patches at `x = 0`, front contact patches at `x = +wheelbase`;
- a left-hand corner has **positive y**, a right-hand corner **negative y**;
- every hardpoint is `[x, y, z]` in mm from that origin;
- contact-patch positions are **derived, never stored**: `(0, ±track/2, 0)` and
  `(wheelbase, ±track/2, 0)`, and the loader asserts the stored `wheelbase`
  against the front wheel centres to ±3 mm.

**Per-wheel quantities are per-wheel signed, and mirroring does NOT negate them
(D-17).** Camber positive = **top outboard**; toe positive = **toe-in**. Those
are statements about the wheel, not about the car's axes, so a symmetric car
stores **identical values on the left and the right**, and the mirror path copies
them unchanged. What mirroring negates is **y on points, and nothing else**.

The conversion to the car frame happens exactly once, **inside the solver**, by
the side factor `s`:

```text
s = +1 on LF and LR        s = −1 on RF and RR
γ_global = s · γ_per_wheel          τ_global = s · τ_per_wheel
```

It never happens in a document, a setup, an export or an import. Getting this
backwards is the round-1 A3 bug one layer out: negating toe on the mirrored
corner gives a straight car 1.0° of total toe, a number small enough to look
plausible and large enough to change the car. The rule is proved by
`physics/01` §6.1 and by golden cases **G01.1** (mirror the LF corner: camber
+2.0°, toe **+0.5° unchanged**), **G01.8** (mirror a corner with toe +0.5°: RF
toe +0.5°, axle total +1.0°) and **G01.9** (camber, KPI and scrub evaluated with
`s`: identical per-wheel values on both corners, opposite signs in the global
frame). `physics/02` G02.11 is the same assertion for camber gain.

Quantities that are properties of the car — roll-centre height, load-transfer
split — are frame-free and are **never** signed per side.

```json
{
  "schema_version": "1.0.0",
  "kind": "car_model",
  "id": "mdl_ref_1tc",
  "name": "Reference 1/10 TC — measured 2026-10-30",
  "class": "touring_car_1_10",
  "units": {
    "length": "mm", "mass": "g", "angle": "deg", "spring_rate": "N/mm",
    "viscosity": "cSt", "temperature": "°C", "percentage": "%",
    "count": "1", "shear_modulus": "GPa"
  },
  "frame": { "standard": "ISO 8855", "axes": "x forward, y left, z up",
             "origin": "ground plane, rear axle centre, vehicle centreline" },
  "symmetry": true,
  "license": { "id": "CC-BY-4.0", "url": "https://creativecommons.org/licenses/by/4.0/" },
  "contributors": [ { "name": "D. W.", "role": "measured" } ],
  "attribution_text": "Reference 1/10 TC — measured by D. W., 2026-10-30. CC BY 4.0.",
  "meta": { "created": "2026-10-30", "app_version": "0.1.0", "revises": null },

  "sources": {
    "s1": { "type": "measured", "method": "digital caliper 150 mm",
            "datum": "flat plate, hinge-pin centre", "by": "D. W.", "date": "2026-10-30",
            "note": "car on setup stands, wheels off" },
    "s2": { "type": "inferred", "method": "two_hang_plumb_line",
            "basis": "chassis hung from one point at each end, plumb line photographed square-on",
            "tolerance_pct": 15.0, "by": "D. W.", "date": "2026-10-30" },
    "s3": { "type": "estimated", "method": "unsprung_corner_weighing",
            "basis": "wheel, tyre, hub, carrier and outboard link ends on a kitchen scale",
            "tolerance_pct": 20.0, "by": "D. W.", "date": "2026-10-30" },
    "s4": { "type": "derived",
            "from": ["body.mass.total", "body.mass.sprung_front", "body.mass.sprung_rear"],
            "note": "corner weights minus unsprung" },
    "s5": { "type": "measured", "method": "corner scales", "datum": "four pads, ride height 5.0 mm",
            "by": "D. W.", "date": "2026-10-30" },
    "s6": { "type": "manufacturer", "ref": "kit manual p.14, exploded view and spring table" }
  },

  "body": {
    "reference_ride_height": { "value": 5.0,   "source": "s1" },
    "wheelbase":             { "value": 257.0, "source": "s1" },
    "cg": {
      "height":           { "value": 28.0, "source": "s2" },
      "front_mass_share": { "value": 45.0, "source": "s4" },
      "unsprung_height":  { "value": 20.0, "source": "s3" }
    },
    "mass": {
      "total":          { "value": 1350.00, "source": "s5" },
      "sprung_front":   { "value": 487.49,  "source": "s4" },
      "sprung_rear":    { "value": 622.49,  "source": "s4" },
      "unsprung_front": { "value": 120.00,  "source": "s3" },
      "unsprung_rear":  { "value": 120.00,  "source": "s3" }
    },
    "chassis": { "material": "cfrp", "thickness": { "value": 2.0, "source": "s6" } }
  },

  "axles": {
    "front": {
      "track":                { "value": 172.0, "source": "s1" },
      "tyre_radius":          { "value": 32.0,  "source": "s1" },
      "roll_centre_validity": { "value": 40.0,  "source": "s6" },
      "droop_limit_wheel":    { "value": 5.0,   "source": "s6" },
      "bump_limit_wheel":     { "value": 5.0,   "source": "s6" },
      "spring": { "location": "coilover_at_damper", "rate": { "value": 3.50, "source": "s6" } },
      "arb": { "type": "torsion_bar",
               "bar_diameter":  { "value": 1.50, "source": "s6" },
               "span":          { "value": 90.0, "source": "s6" },
               "arm_length":    { "value": 20.0, "source": "s6" },
               "shear_modulus": { "value": 79.3, "source": "s6" } },
      "steering": { "rack": {
        "x":               { "value": 225.0, "source": "s1" },
        "z":               { "value": 30.0,  "source": "s1" },
        "y_left":          { "value": 26.0,  "source": "s1" },
        "y_right":         { "value": -26.0, "source": "s1" },
        "travel_per_turn": { "value": 12.0,  "source": "s6" } } }
    },
    "rear": {
      "track":       { "value": 174.0, "source": "s5" },
      "tyre_radius": { "value": 32.0,  "source": "s1" },
      "spring": { "location": "coilover_at_damper", "rate": { "value": 2.60, "source": "s6" } },
      "arb": { "type": "torsion_bar",
               "bar_diameter":  { "value": 1.20, "source": "s6" },
               "span":          { "value": 90.0, "source": "s6" },
               "arm_length":    { "value": 20.0, "source": "s6" },
               "shear_modulus": { "value": 79.3, "source": "s6" } }
    }
  },

  "corners": {
    "LF": {
      "arm_type": { "lower": "hinge", "upper": "single_link" },
      "points": {
        "lca_in_a":  { "value": [238.00, 30.00, 12.00],  "source": "s1" },
        "lca_in_b":  { "value": [272.00, 30.00, 12.00],  "source": "s1" },
        "lca_out":   { "value": [259.00, 78.00,  7.00],  "source": "s1" },
        "uca_in":    { "value": [250.00, 42.00, 45.00],  "source": "s1" },
        "uca_out":   { "value": [254.00, 72.80, 44.00],  "source": "s1" },
        "tie_in":    { "value": [225.00, 26.00, 30.00],  "source": "s1" },
        "tie_out":   { "value": [243.68, 74.04, 32.00],  "source": "s1" },
        "wc":        { "value": [257.00, 86.00, 32.00],  "source": "s1" },
        "damper_lo": { "value": [257.00, 60.00,  8.875], "source": "s1" },
        "damper_up": { "value": [257.00, 44.00, 58.00],  "source": "s1" },
        "arb_drop":  { "value": [250.00, 55.00,  9.40],  "source": "s1" }
      },
      "damper": {
        "piston_bore":     { "value": 9.6,   "source": "s6" },
        "shaft_dia":       { "value": 2.5,   "source": "s6" },
        "piston_holes":    { "value": 3,     "source": "s6" },
        "piston_hole_dia": { "value": 0.60,  "source": "s6" },
        "oil_cst":         { "value": 500.0, "source": "s6" }
      }
    }
  }
}
```

**This is the reference car of `physics/01` §8 — the same car, not a car with the
same wheelbase.** Wheelbase 257.0 mm, tracks 172.0 / 174.0 mm, tyre radius
32.0 mm, CG height 28.0 mm, unsprung 120 g per axle (240 g per car), sprung
487.49 g front and 622.49 g rear per axle, total 1350 g. Every number in modules
2–10 is a function of that table; an example that was a *different* car with the
same wheelbase made every physics golden case unreachable from the only complete
model in the normative document (round-2 finding D-13).

Notes on the example:

- **`symmetry: true` and no `RF` key.** The right corner is derived at load from
  the left by negating y, with `derived_by_mirror` provenance, and is **never
  stored** (E1.4). Camber and toe are copied through **unchanged** (D-17). A
  model that stores both corners says `symmetry: false` and is computed per side.
- **The rear corners are absent**, which is the honest debt of `physics/01`
  §8.4: the reference car has never had its rear hardpoints measured. Rear
  axle-level values (track, spring, bar) are present, so roll stiffness and ride
  frequency compute for both axles; a rear roll-centre or camber-gain output is
  `REFUSED` naming `corners.LR.points.*`, and the app says which measurement
  would fix it. Absence is expressed by the key not existing — never by `0`,
  `null` or a sentinel (§4.1 rule 3).
- **`units` declares exactly the nine dimensions this file uses.** A file that
  uses a dimension it does not declare is refused (rule 1); physics/01 §5's
  previous example used five dimensions it did not declare, which is why its
  `units` block looked complete and was not.
- **`cg.height` carries `source: "s2"`, an `inferred` source with a
  `tolerance_pct`.** 28.0 mm is the procedure's stated default, not a
  measurement of this car — no instrument a club racer owns locates a CG (§4.11,
  `physics/01` §4.5). Every output that consumes it is `inferred` with a band.
- **`body.cg.front_mass_share` is 45.0 %**, which is what the masses in this file
  give (607.49 g of 1350 g on the front axle); `x_cg = 257 · (1 − 0.45) =
  141.35 mm` is derived from it and never stored.
- **`schema_version` 1.0.0** is the only version this app writes (§4.7), so one
  fixture covers it. The `1.1.0` of physics/01 §5 is retired.

#### 4.2.1 Field table — car model

**Generated view — do not edit a row here.** Every row below is generated from
`docs/specs/fields.yaml`, and the gate's `schema` stage (E9.10) fails if this
table and the YAML disagree: a field in one and not the other, a differing
`on_absence`, unit or `req`, or a `consumed_by` id that is not one of §4.4's
output ids. To change a field, change the YAML and regenerate.

`Req` = required for the document to be valid. `on_absence` is the policy of
§4.1 rule 3 and has **four** values — `ASSUME`, `ESTIMATE`, `REFUSE`, `OMIT`.
`ESTIMATE` is a policy in its own right, not a variety of `ASSUME`: it is how
`body.cg.height` and both unsprung masses are carried, it always names a
procedure in `docs/specs/procedures/` and it always produces a band. `Consumed
by` lists §4.4's output ids, so a field that feeds nothing says so.

| Field | Type | Unit | Req | `on_absence` | Consumed by | Notes |
|---|---|---|---|---|---|---|
| `schema_version` | string | — | yes | `REFUSE` | `all` | `MAJOR.MINOR.PATCH`; this file defines 1.0.0. A greater major is refused with the version named (spec E6.6). |
| `kind` | enum: `car_model` | — | yes | `REFUSE` | — | Tells the loader which field list to validate against. |
| `id` | string | — | yes | `REFUSE` | — | Opaque, stable, never reused. `mdl_` prefix by convention. |
| `name` | string | — | yes | `REFUSE` | — | Free text, shown in the library. |
| `class` | enum: `touring_car_1_10`, `buggy_1_10_2wd`, `buggy_1_10_4wd`, `truck_1_10`, `other` | — | yes | `REFUSE` | — | Selects the plausible ranges and the worksheet order; it never changes a formula. |
| `units` | object | — | yes | `REFUSE` | `all` | One entry per dimension in `meta.dimensions` that the file uses. A missing dimension refuses the document; a unit other than the declared one is refused, never rescaled. |
| `frame` | object | — | yes | `REFUSE` | `roll_centre_height`, `camber_gain`, `bump_steer` | `{standard, axes, origin}`; must equal `meta.frame` in this file. A disagreeing frame is refused, never reinterpreted. |
| `symmetry` | bool | — | yes | `REFUSE` | `motion_ratio`, `roll_centre_height`, `camber_gain` | `true` → the right corner is derived at load from the left with `derived_by_mirror` provenance and is never stored (E1.4). No default: a model that does not say is refused. |
| `license` | object | — | yes | `REFUSE` | — | `{id, url}`; spec §4.9. Hashed content. |
| `contributors` | array | — | yes if license.id begins CC-BY | `REFUSE` | — | `[{name, role, contact?}]`, role ∈ measured \| contributed \| reviewed \| licensed_from \| maintained. |
| `attribution_text` | string | — | yes if license.id begins CC-BY | `REFUSE` | — | The exact string a re-sharer reproduces. Stored, never generated. |
| `sources` | object | — | yes | `REFUSE` | `motion_ratio`, `wheel_rate`, `ride_frequency`, `roll_stiffness`, `load_transfer_split`, `roll_centre_height`, `camber_gain`, `bump_steer`, `damping_ratio` | Map source id → source record (spec §4.1 rule 4). Replaces physics/01 §5's per-point prose map: every `source` on a value must resolve here. |
| `meta` | object | — | no | `OMIT` | — | `{created, app_version, revises, mapped_at}`. Excluded from `content_hash` (spec §4.5.1). |
| `representation_note` | string | — | no | `OMIT` | — | Free text ≤ 500 chars; shown in the share summary (E1.11). |
| `body.reference_ride_height` | value | mm | yes | `REFUSE` | `roll_centre_height`, `camber_gain`, `bump_steer` | The ride height every z was measured at. Replaces `measured_at_ride_height` (physics/01 §5). See also `body.chassis.ride_height_basis`. |
| `body.wheelbase` | value | mm | yes | `REFUSE` | `roll_centre_migration`, `load_transfer_split`, `camber_gain` | Stored and cross-checked against the front wheel centres to ±3 mm (spec §4.2); it is not derived, because a model with no front corner yet still needs the number. |
| `body.cg.height` | value | mm | no | `ESTIMATE(two_hang_plumb_line)` | `load_transfer_split`, `roll_centre_height` | **Never asked as a measurement** — corner scales cannot locate a CG (D-14). `ASSUME` on this field is a schema error (spec §4.1 rule iii). Tier `inferred` on every consuming output; the band comes from the procedure (hang: ±1.5 mm) or from the component table's own ranges. 28.0 mm is the reference default, not a measurement: the component route on the reference car gives 18.7 mm (physics/01 §4.5). |
| `body.cg.front_mass_share` | value | % | no | `REFUSE` | `load_transfer_split` | Front share of total mass, normally `derived` from corner weights. `x_cg = wheelbase · front_mass_share`, measured from the rear axle line — derived, never stored. Replaces `cg.longitudinal_front`. |
| `body.cg.lateral` | value | mm | no | `ASSUME(0.0)` | `load_transfer_split` | Positive to the left. A car built with a left-biased battery genuinely differs; `ASSUME(0)` is stated on screen when absent. |
| `body.cg.unsprung_height` | value | mm | no | `ASSUME(0.625 × tyre_radius)` | `load_transfer_split` | 0.55–0.75 × tyre radius is the plausible band; 0.625 (20.0 mm at R = 32) is the stated default. |
| `body.cg.components[]` | array | — | no | `OMIT` | — | `[{component, mass, x, y, z, basis}]` — the component-mass route to `body.cg.height` (physics/01 §4.5). Absent → that route is unavailable and the hang procedure or the default is used, named on screen. Feeds the `body.cg.height` ESTIMATE, so it has no v1 output id of its own. |
| `body.cg.provenance` | enum: `two_hang_plumb_line`, `component_mass_moment` | — | no | `OMIT` | `load_transfer_split` | Derived, never written by the app (D10 above). Accepted on import from files that carry it and rewritten from the source record; a stored copy that disagrees is a warning, not a refusal. |
| `body.mass.total` | value | g | yes | `REFUSE` | `load_transfer_split`, `ride_frequency` | Corner scales. The four corner weights, where present, must sum to it to ±2 g. |
| `body.mass.sprung_front` | value | g | no | `REFUSE` | `ride_frequency`, `roll_stiffness`, `load_transfer_split` | Sprung mass carried by the **front axle** (both corners). Ride frequency and roll stiffness need it; absence refuses those outputs only. |
| `body.mass.sprung_rear` | value | g | no | `REFUSE` | `ride_frequency`, `roll_stiffness`, `load_transfer_split` | Sprung mass carried by the **rear axle**. |
| `body.mass.unsprung_front` | value | g | no | `ESTIMATE(unsprung_corner_weighing)` | `load_transfer_split`, `ride_frequency` | Grams per **axle** (both front corners). Default 120 g = 60 g per corner = the reference car's 240 g total. Range 80–160 g per axle (160–320 g per car). `ASSUME(0)` is retired: 0 is outside the range and drops the reference front ride frequency from 10.782 to 9.156 Hz. |
| `body.mass.unsprung_rear` | value | g | no | `ESTIMATE(unsprung_corner_weighing)` | `load_transfer_split`, `ride_frequency` | Grams per **axle**. Same procedure and band as the front. |
| `body.chassis.material` | enum: `cfrp`, `aluminium`, `steel` | — | no | `OMIT` | — | Mass, CG height and (R2) torsional stiffness. Absent → the chassis is a rigid plate of the class default and the assumption is stated. Selects the default `shear_modulus` when the bar's material is the same. |
| `body.chassis.thickness` | value | mm | no | `OMIT` | — | Plate thickness, caliper-measured. Moves mass, CG height and ride height (see `ride_height_basis`), never the roll centre. |
| `body.chassis.span` | value | mm | no | `OMIT` | — | Plate width across the rails (`w` in physics/10 §4; 90 mm on the reference car). |
| `body.chassis.rail_factor` | value | 1 | no | `ASSUME(1.0)` | — | κ_rail, the effective-torsion factor for a plate with rails and cut-outs (physics/10 §4). 1.0 = the thin-plate estimate taken at face value; the estimator's own range is ±1–3×, which is why no v1 output claims precision from it. |
| `body.chassis.torsion_measured` | value | N·m/deg | no | `OMIT` | — | N·m/deg on disk (the racer's unit), converted to N·m/rad at the adapter. Absent → the thin-plate estimate is used and labelled as one. |
| `body.chassis.ride_height_basis` | enum: `underside_clearance`, `axle_height` | — | no | `ASSUME(underside_clearance)` | — | Decides whether a thickness change moves the car (physics/10 §3.4). On screen with the chassis card. |
| `axles.<axle>.track` | value | mm | yes | `REFUSE` | `roll_stiffness`, `roll_centre_height`, `roll_centre_migration`, `camber_gain` | Contact patch to contact patch at static ride height (hub-face-to-hub-face minus the cambered offset; physics/01 §6 note). |
| `axles.<axle>.tyre_radius` | value | mm | yes | `REFUSE` | `roll_centre_height`, `load_transfer_split`, `camber_gain`, `bump_steer` | Contact-patch height and the bump/droop conversion. A setup's `conditions.tyre.diameter` overrides it for one run. |
| `axles.<axle>.roll_centre_validity` | value | mm | no | `OMIT` | `roll_centre_height` | The bound above which the roll-centre number is `OUT_OF_DOMAIN` (E3.9). Absent → no domain flag and the health line says the bound is not recorded. |
| `axles.<axle>.droop_limit_wheel` | value | mm | no | `OMIT` | `camber_gain`, `bump_steer` | Wheel travel, not shaft travel; the static limits check only. |
| `axles.<axle>.bump_limit_wheel` | value | mm | no | `OMIT` | `camber_gain`, `bump_steer` | Wheel travel, not shaft travel. |
| `axles.<axle>.spring.location` | enum: `coilover_at_damper`, `separate_seat`, `inboard_rocker` | — | yes | `REFUSE` | `motion_ratio`, `wheel_rate` | Selects which pair of points defines the spring axis. |
| `axles.<axle>.spring.rate` | value | N/mm | yes | `REFUSE` | `wheel_rate`, `ride_frequency`, `roll_stiffness` | Baseline rate at the spring. A setup's `corners.<corner>.spring_rate` overrides it (§4.3); the override is named in the "how" view. |
| `axles.<axle>.spring.free_length` | value | mm | no | `OMIT` | — | Preload and coil-bind only. |
| `axles.<axle>.arb` | object | — | no | `OMIT` | `roll_stiffness` | Absent → roll stiffness is computed without a bar contribution and says so. |
| `axles.<axle>.arb.type` | enum: `blade`, `fixed`, `torsion_bar`, `none` | — | yes if arb present | `OMIT` | `roll_stiffness` | `none` is the only way to say "no bar": `bar_diameter: 0` is not a bar and not an absence. |
| `axles.<axle>.arb.rate_at_link` | value | N/mm | yes if arb.type is blade or fixed | `REFUSE` | `roll_stiffness` | N/mm at the drop link at full stiff. Replaces `rate_at_full_stiff`. Converted to a wheel rate through the drop-link motion ratio derived from `points.arb_drop`; without `arb_drop` the bar is excluded and the output says so. |
| `axles.<axle>.arb.bar_diameter` | value | mm | yes if arb.type is torsion_bar | `REFUSE` | `roll_stiffness` | Torsion-bar form. k_θ = G·J/L with J = πd⁴/32. |
| `axles.<axle>.arb.span` | value | mm | yes if arb.type is torsion_bar | `REFUSE` | `roll_stiffness` | Twisting length between the bushes. Replaces `effective_span`. |
| `axles.<axle>.arb.arm_length` | value | mm | yes if arb.type is torsion_bar | `REFUSE` | `roll_stiffness` | Lever arm from the torsion axis to the drop link. |
| `axles.<axle>.arb.shear_modulus` | value | GPa | no | `ASSUME(79.3)` | `roll_stiffness` | GPa. Steel 79.3, titanium 41.0, aluminium 26.0; when absent, taken from `arb.material` if that is present, else 79.3 (steel). The flag `assumedMaterial` is shown. |
| `axles.<axle>.arb.material` | enum: `steel`, `titanium`, `aluminium`, `other` | — | no | `OMIT` | `roll_stiffness` | Selects the default `shear_modulus`. Reference only for display; it never overrides an explicit G. |
| `axles.<axle>.arb.setting_table` | array | — | no | `OMIT` | `roll_stiffness` | `[{setting, rate_at_link}]` — a non-linear blade curve. R2. Absent on a `blade` bar → the bar is linear by definition and the app says "linear bar assumed". |
| `axles.front.steering.rack` | object | — | no | `REFUSE` | `bump_steer`, `ackermann_toe` | `{x, z, y_left, y_right, travel_per_turn}`. Absent → bump steer and the Ackermann readout are `REFUSED(rack geometry not recorded)` and the measurement procedure is offered (C3). |
| `axles.front.steering.rack.x` | value | mm | yes if rack present | `REFUSE` | `bump_steer`, `ackermann_toe` | x of the rack axis in the ISO 8855 frame (rear-axle origin). |
| `axles.front.steering.rack.z` | value | mm | yes if rack present | `REFUSE` | `bump_steer`, `ackermann_toe` | z of the rack axis. |
| `axles.front.steering.rack.y_left` | value | mm | yes if rack present | `REFUSE` | `bump_steer`, `ackermann_toe` | Left rack end y (positive, since y is left). |
| `axles.front.steering.rack.y_right` | value | mm | yes if rack present | `REFUSE` | `bump_steer`, `ackermann_toe` | Right rack end y (negative). A right value that is positive is refused: it would put the rack end on the wrong side. |
| `axles.front.steering.rack.travel_per_turn` | value | mm | no | `OMIT` | `ackermann_toe` | Rack travel per steering-wheel turn (mm); display only in v1. |
| `corners.<corner>.arm_type.lower` | enum: `hinge`, `wishbone` | — | yes | `REFUSE` | `motion_ratio`, `roll_centre_height`, `camber_gain` | `hinge` needs `lca_in_a` + `lca_in_b`; `wishbone` uses the same two points. |
| `corners.<corner>.arm_type.upper` | enum: `single_link`, `wishbone` | — | yes | `REFUSE` | `motion_ratio`, `roll_centre_height`, `camber_gain` | `aal` is accepted on import as an alias for `wishbone` and rewritten on save (D13). |
| `corners.<corner>.points.lca_in_a` | point | mm | yes | `REFUSE` | `motion_ratio`, `roll_centre_height`, `camber_gain`, `load_transfer_split` | Front pivot on the lower hinge axis. `[x, y, z]` mm; every coordinate \|c\| ≤ 3000. |
| `corners.<corner>.points.lca_in_b` | point | mm | yes | `REFUSE` | `motion_ratio`, `roll_centre_height`, `camber_gain` | Rear pivot on the lower hinge axis; `lca_in_a ≠ lca_in_b` or the axis is undefined. |
| `corners.<corner>.points.lca_out` | point | mm | yes | `REFUSE` | `motion_ratio`, `roll_centre_height`, `camber_gain`, `bump_steer` | Lower ball joint. Also the carrier's lower reference point — there is no second key for it. |
| `corners.<corner>.points.uca_in` | point | mm | yes if arm_type.upper is single_link | `REFUSE` | `motion_ratio`, `roll_centre_height`, `camber_gain` | The single camber-link inner ball stud — one point, not two coincident ones. |
| `corners.<corner>.points.uca_in_a` | point | mm | yes if arm_type.upper is wishbone | `REFUSE` | `motion_ratio`, `roll_centre_height`, `camber_gain` | Front upper pivot (buggy). Mutually exclusive with `uca_in`. |
| `corners.<corner>.points.uca_in_b` | point | mm | yes if arm_type.upper is wishbone | `REFUSE` | `motion_ratio`, `roll_centre_height`, `camber_gain` | Rear upper pivot (buggy). |
| `corners.<corner>.points.uca_out` | point | mm | yes | `REFUSE` | `motion_ratio`, `roll_centre_height`, `camber_gain`, `bump_steer` | Upper ball stud on the carrier; with `lca_out` it defines the carrier span and, with `wc`, the carrier frame. |
| `corners.<corner>.points.tie_in` | point | mm | yes on front corners | `REFUSE` | `bump_steer`, `ackermann_toe` | Inner tie-rod ball (rack end). |
| `corners.<corner>.points.tie_out` | point | mm | yes on front corners | `REFUSE` | `bump_steer`, `ackermann_toe` | Outer tie-rod ball on the steering arm. |
| `corners.<corner>.points.wc` | point | mm | yes | `REFUSE` | `motion_ratio`, `roll_centre_height`, `camber_gain`, `bump_steer`, `load_transfer_split` | Wheel centre at the reference ride height. Fixes track and scrub radius; the contact patch is derived from it. |
| `corners.<corner>.points.damper_lo` | point | mm | yes | `REFUSE` | `motion_ratio`, `wheel_rate`, `ride_frequency`, `damping_ratio` | Lower damper eye (or spring seat). On the lower arm, not on the carrier. |
| `corners.<corner>.points.damper_up` | point | mm | yes | `REFUSE` | `motion_ratio`, `wheel_rate`, `ride_frequency`, `damping_ratio` | Upper damper eye on the chassis. |
| `corners.<corner>.points.arb_drop` | point | mm | no | `OMIT` | `roll_stiffness` | Drop-link attachment on the lower arm. Without it the bar's link motion ratio is not derived; the bar is excluded from roll stiffness and the output says so. |
| `corners.<corner>.points.bump_stop` | point | mm | no | `OMIT` | — | Stop contact point. Not modelled in v1; stored so a measured model is not lossy. |
| `corners.<corner>.points.droop_stop` | point | mm | no | `OMIT` | — | Stop contact point. Not modelled in v1. |
| `corners.<corner>.corner_weight` | value | g | no | `OMIT` | `load_transfer_split`, `ride_frequency` | Measured corner weight. Absent → derived from `body.mass.total` and `body.cg.front_mass_share` and reported as `derived`, never `measured` (physics/06 §3.1). |
| `corners.<corner>.damper.piston_bore` | value | mm | no | `REFUSE` | `damping_ratio` | Hardware: measurable with a caliper, so absence refuses ζ and names the field. Absent → ζ `REFUSED`, never guessed. |
| `corners.<corner>.damper.shaft_dia` | value | mm | no | `REFUSE` | `damping_ratio` | Hardware: measurable. |
| `corners.<corner>.damper.piston_holes` | count | 1 | no | `REFUSE` | `damping_ratio` | Hardware: countable. |
| `corners.<corner>.damper.piston_hole_dia` | value | mm | no | `REFUSE` | `damping_ratio` | Hardware: pin gauge or the maker's drawing. ±0.02 mm is ±13 % of the parameter (physics/07 §9), so a measured value still carries its instrument's uncertainty into the band. |
| `corners.<corner>.damper.oil_cst` | value | cSt | no | `ASSUME(500.0)` | `damping_ratio` | Often printed on the bottle. Reference: 500 cSt. Belongs to the setup when it is a chosen oil; the same path, so a setup overrides the model. |
| `corners.<corner>.damper.oil_temp` | value | °C | no | `ASSUME(20.0)` | `damping_ratio` | Oil temperature used for ν(T). A setup's `conditions.air_temp` is a different number and does not substitute. |
| `corners.<corner>.damper.f_blowoff` | value | N | no | `ASSUME(4.0)` | `damping_ratio` | Dyno-only, so on a setup it is normally `estimated` with `tolerance_pct` and flag `estimatedDamper`; the assumed default biases low by the stiction term (physics/07 §2.3). |
| `corners.<corner>.damper.c_post` | value | N·s/m | no | `ASSUME(12.0)` | `damping_ratio` | Post-blow-off damping coefficient, N·s/m (the `damping_coefficient` dimension). Dyno-only; new in this file (F2): it is the dominant term in the ζ band and had no field at all. |

Two rows deserve a note a table cannot carry. `body.cg.height` is `ESTIMATE`
**in both documents** — `ASSUME` on it is a schema error under rule (iii), and
the physics package's `ASSUME(component estimate, flag cgInferred)` is retired.
The two unsprung masses are `ESTIMATE` with a stated default of **120 g per
axle** (60 g per corner, 240 g per car), inside the model's own 80–160 g band;
the previous `ASSUME(0)` was outside that band and cost the reference car 15 %
of its front ride frequency (10.782 → 9.156 Hz), because it made sprung mass the
whole car.

### 4.3 Setup

A setup is a set of values for one car, plus the conditions it was run in, plus a
**closed set of geometry adjustments** that transform the referenced model
revision's geometry (§4.3.2). It never contains hardpoints: it cannot add, remove
or move a point except through the adjustments named in §4.3.2, each of which has
one axis, one sign convention and one unit. That is the resolution of the
round-1 contradiction — the setup *does* affect geometry, and it does so only
through a named, versioned, sign-pinned transform.

The `assumptions` block is **not stored** in a setup: it is generated at export
time from the `on_absence` outcomes of the analysis that produced the file, so a
hand-edited or older file can never carry a stale one.

**One word, one object.** The file — and this specification — call the saved
object a **setup**; its `kind` is `setup` and its label is `label`. The design
layer and the screens call the same object a **sheet**, because that is what a
racer calls the piece of paper it replaces. The mapping is fixed and is not a
translation the implementer gets to choose: **sheet (UI) = setup (file)**, and
"setup sheet" in this document always means the *exported* artifact (PDF or
JSON), never the saved object. Route names and screen copy keep "sheet"; field
names, ids and hashes keep "setup".

```json
{
  "schema_version": "1.0.0",
  "kind": "setup",
  "id": "set_2b91c0",
  "label": "Carpet baseline A",
  "model_ref": {
    "id": "mdl_ref_1tc",
    "content_hash": "sha256:6c1f…",
    "name": "Reference 1/10 TC — measured 2026-10-30"
  },
  "geometry": {
    "base_hash": "sha256:6c1f…",
    "adjustments": [
      { "field": "corners.LF.upper_link_inner_shims", "value": 1.0, "source": "m1" },
      { "field": "corners.RF.upper_link_inner_shims", "value": 1.0, "source": "m1" }
    ],
    "geometry_hash": "sha256:0a94…"
  },
  "parent_id": null,
  "created": "2026-10-30",
  "meta": { "app_version": "0.1.0" },
  "sources": {
    "m1": { "type": "measured", "method": "camber gauge + toe plates", "datum": "flat plate",
            "by": "D. W.", "date": "2026-10-30" },
    "m2": { "type": "measured", "method": "ride-height gauge", "datum": "flat plate",
            "by": "D. W.", "date": "2026-10-30" },
    "m3": { "type": "third_party", "by": "setup sheet, P. Smith", "ref": "printed sheet, 2026-09" },
    "m4": { "type": "estimated", "basis": "same shock family as the kit part, blow-off not measured",
            "by": "D. W.", "tolerance_pct": 30.0 }
  },

  "conditions": {
    "surface": "carpet",
    "air_temp": { "value": 22.0, "source": "m1" },
    "humidity": { "value": 55.0, "source": "m1" },
    "tyre": { "compound": "handout", "diameter": { "value": 64.0, "source": "m1" } },
    "motor": "13.5T stock, 5.5 FDR",
    "notes": "club night, fresh surface"
  },

  "corners": {
    "LF": {
      "camber": { "value": -2.0, "source": "m1" },
      "toe":    { "value": 0.5,  "source": "m1" },
      "caster": { "value": 4.0,  "source": "m3" },
      "ride_height": { "value": 5.0, "source": "m2" },
      "droop": { "value": 2.0, "source": "m2" },
      "spring_rate": { "value": 3.50, "source": "m3" },
      "spring_preload": { "value": 0.5, "source": "m2" },
      "damper": {
        "oil_cst":  { "value": 500.0, "source": "m3" },
        "oil_temp": { "value": 22.0,  "source": "m1" },
        "f_blowoff": { "value": 4.0,  "source": "m4" },
        "c_post":    { "value": 12.0, "source": "m4" }
      },
      "tyre_pressure": { "value": 240.0, "source": "m2" }
    },
    "RF": {
      "camber": { "value": -2.0, "source": "m1" },
      "toe":    { "value": 0.5,  "source": "m1" },
      "caster": { "value": 4.0,  "source": "m3" },
      "ride_height": { "value": 5.0, "source": "m2" },
      "droop": { "value": 2.0, "source": "m2" },
      "spring_rate": { "value": 3.50, "source": "m3" },
      "spring_preload": { "value": 0.5, "source": "m2" },
      "damper": {
        "oil_cst":  { "value": 500.0, "source": "m3" },
        "oil_temp": { "value": 22.0,  "source": "m1" },
        "f_blowoff": { "value": 4.0,  "source": "m4" },
        "c_post":    { "value": 12.0, "source": "m4" }
      },
      "tyre_pressure": { "value": 240.0, "source": "m2" }
    }
  },

  "axles": { "front": { "arb_setting": { "value": 0.6, "source": "m3" } },
             "rear":  { "arb_setting": { "value": 0.4, "source": "m3" } } },

  "transmission": { "diff_front_oil_viscosity": { "value": 3000.0, "source": "m3" },
                    "diff_rear_oil_viscosity":  { "value": 1000.0, "source": "m3" },
                    "diff_height": { "value": 0.0, "source": "m3" } },

  "analysis_inputs": { "lateral_g":          { "value": 1.2,  "source": "m1" },
                       "roll_sweep":         { "value": 1.0,  "source": "m1" },
                       "damping_low_speed":  { "value": 0.050, "source": "m1" },
                       "damping_high_speed": { "value": 0.200, "source": "m1" } },

  "notes": { "track": "club layout, clockwise", "setup": "droop 2 mm front, 3 mm rear",
             "tyres": "handout, 2 runs old" }
}
```

Both front corners are shown, with **identical camber (−2.0°) and toe (+0.5°)**
— that is D-17 in one screenful: a symmetric car has equal stored values left and
right, and the axle's total toe is +1.0° because it is the *sum* of two per-wheel
values, not a difference. `.LR` and `.RR` use the same shape; they are absent
from this example because the model has no rear hardpoints (`physics/01` §8.4).
The two shim adjustments are shown because a shim change is the canonical case
(§4.3.2), and they are stored in `geometry.adjustments[]`, never as keys on a
corner.

`damper.oil_cst`, `.oil_temp`, `.f_blowoff` and `.c_post` live here rather than in
the model because they are what a run changes or cannot measure: the bore, shaft
and hole geometry stay in the model at the same path, and a setup value overrides
it. `f_blowoff` and `c_post` are `estimated` with a 30 % tolerance, and those two
tolerances are the dominant terms in the computed ζ band (§4.8).

#### 4.3.1 Field table — setup

**Generated view — do not edit a row here.** Generated from
`docs/specs/fields.yaml` by the same generator as §4.2.1, and the same gate stage
(E9.10) fails if the two diverge. `Consumed by` lists §4.4's output ids.

A value the user confirms as zero is written as
`{ "value": 0.0, "source": … }`; a value the user never entered is **absent**.
For the three geometry adjustments in §4.3.2 absence and an explicit zero have
the same physical effect, and the difference is preserved in the file so the app
can say "no shim recorded" rather than "0 mm shim".

| Field | Type | Unit | Req | `on_absence` | Consumed by | Notes |
|---|---|---|---|---|---|---|
| `schema_version` | string | — | yes | `REFUSE` | — | Same major/minor as the model the setup is written against. |
| `kind` | enum: `setup` | — | yes | `REFUSE` | — |  |
| `id` | string | — | yes | `REFUSE` | — |  |
| `label` | string | — | yes | `REFUSE` | — | What the racer calls it. The design's word for this object is "sheet"; the file's word is `setup`. |
| `model_ref.id` | string | — | yes | `REFUSE` | `roll_centre_height`, `camber_gain`, `wheel_rate` | Unresolvable → the `model_missing` library state (spec §4.6, E6.9). |
| `model_ref.content_hash` | string | — | yes | `REFUSE` | `roll_centre_height`, `camber_gain`, `wheel_rate` | `sha256:` + 64 lowercase hex; pins the base revision. |
| `model_ref.name` | string | — | yes | `REFUSE` | — | Carried so a shared setup names its car even when the recipient has no model. |
| `geometry.base_hash` | string | — | yes | `REFUSE` | — | Equals `model_ref.content_hash` unless the setup was mapped (§4.6). |
| `geometry.adjustments[]` | array | mm | yes (may be empty) | `OMIT` | `camber_gain`, `roll_centre_height`, `bump_steer`, `wheel_rate` | `[{field, value, source}]` where field ∈ `corners.<corner>.upper_link_inner_shims`, `.upper_link_outer_shims`, `.wheel_offset`. At most one entry per field; a duplicate is a schema error. Empty list = the base geometry, and that is a different statement from "absent". |
| `geometry.geometry_hash` | string | — | yes | `REFUSE` | `camber_gain`, `roll_centre_height`, `bump_steer`, `wheel_rate` | SHA-256 of the canonical transformed geometry (§4.5.3). |
| `parent_id` | string\|null | — | yes | `REFUSE` | — | `null` for a first sheet; otherwise the id of the sheet it was derived from (E2.2). |
| `created` | string | — | yes | `REFUSE` | — |  |
| `meta.app_version` | string | — | yes | `REFUSE` | — | `meta` is excluded from the hash; `app_version` is still required so an export is traceable. |
| `sources` | object | — | yes | `REFUSE` | `damping_ratio`, `camber_at_roll` | As the car model: every `source` on a value resolves here. |
| `derived_from_models[]` | array | — | no | `OMIT` | — | `[{id, content_hash, attribution_text}]` — attribution travels with a copied sheet (§4.9). |
| `conditions.surface` | enum: `carpet`, `asphalt`, `other` | — | no | `OMIT` | — | Reference only in the maths; a sheet diff warns when two sheets differ (E4.9). |
| `conditions.air_temp` | value | °C | no | `OMIT` | `damping_ratio` | Ambient temperature. Reference only in the maths except as the default for the damper's oil temperature when that is absent; warned on in a sheet diff. |
| `conditions.humidity` | value | % | no | `OMIT` | — | Reference only; warned on in a sheet diff (E4.9). |
| `conditions.tyre.compound` | string | — | no | `OMIT` | — | Free text ("handout", "Sorex 28"). Never parsed into grip: grip is inference (§4.11). |
| `conditions.tyre.diameter` | value | mm | no | `OMIT` | `roll_centre_height`, `load_transfer_split` | Overrides the model's `tyre_radius` for this run (radius = diameter / 2). Absent → the model's value is used and named. |
| `conditions.motor` | string | — | no | `OMIT` | — | Free text ("13.5T stock, 5.5 FDR"). Top-level in `conditions`, not under `tyre` (D17). |
| `conditions.notes` | string | — | no | `OMIT` | — | Free text. |
| `corners.<corner>.camber` | value | deg | no | `REFUSE` | `camber_at_roll`, `camber_gain` | Per wheel, signed, positive = top outboard. Identical on left and right for a symmetric car; never negated on mirror (D-17). The solver applies `s`. |
| `corners.<corner>.toe` | value | deg | no | `REFUSE` | `ackermann_toe` | Per wheel, signed, positive = toe-in. Identical on left and right for a symmetric car; never negated on mirror (D-17); axle total toe = sum of the two per-wheel values. |
| `corners.<corner>.caster` | value | deg | no | `OMIT` | — | Reference only in v1; shown as such (E2.5). |
| `corners.<corner>.ride_height` | value | mm | no | `REFUSE` | `roll_centre_height`, `camber_gain`, `bump_steer` | Static geometry datum for this run; drives the `setRideHeight` re-solve (physics/01 §6.2). |
| `corners.<corner>.droop` | value | mm | no | `OMIT` | — | Static limits check only. |
| `corners.<corner>.spring_rate` | value | N/mm | no | `OMIT` | `wheel_rate`, `ride_frequency`, `roll_stiffness` | Overrides `axles.<axle>.spring.rate` for this corner; absent → the model's rate is used and named in the "how" view. |
| `corners.<corner>.spring_preload` | value | mm | no | `OMIT` | — | Static ride height and load. |
| `corners.<corner>.damper.oil_cst` | value | cSt | no | `REFUSE` | `damping_ratio` | Chosen oil. Absent → the model's value is used if it has one, else ζ is `REFUSED` naming the field. Never guessed. |
| `corners.<corner>.damper.oil_temp` | value | °C | no | `OMIT` | `damping_ratio` | Absent → `conditions.air_temp`, then the model's value, then ASSUME(20). The route taken is named. |
| `corners.<corner>.damper.f_blowoff` | value | N | no | `OMIT` | `damping_ratio` | Dyno-only. Normally `estimated` with `basis` and `tolerance_pct`; the tolerance is what widens the computed ζ band (§4.8). |
| `corners.<corner>.damper.c_post` | value | N·s/m | no | `OMIT` | `damping_ratio` | N·s/m. Dyno-only, same treatment as `f_blowoff`, and it must be in §4.8's band inputs (§4.8 said a fixed ±30 % label is not acceptable — this field is how the band gets its dominant term). |
| `corners.<corner>.upper_link_inner_shims` | adjustment | mm | no | `OMIT` | `camber_gain`, `roll_centre_height` | Stored inside `geometry.adjustments[]`, never as a key at this path. Positive = outboard: `y += sgn(y_corner) · shim`. |
| `corners.<corner>.upper_link_outer_shims` | adjustment | mm | no | `OMIT` | `camber_gain`, `camber_at_roll` | Positive = outboard. |
| `corners.<corner>.wheel_offset` | adjustment | mm | no | `OMIT` | `camber_gain`, `roll_centre_height` | Positive = track increase per side; moves `points.wc` and the contact patch, not the ball joints. |
| `corners.<corner>.tyre_pressure` | value | kPa | no | `OMIT` | — | Reference only. |
| `axles.<axle>.arb_setting` | value | 1 | no | `OMIT` | `roll_stiffness` | A **linear fraction of the link rate**: 0 = no bar contribution, 1 = `arb.rate_at_link`. Never a fraction of blade travel (§4.3.3). |
| `transmission.diff_front_oil_viscosity` | value | cSt | no | `OMIT` | — | Reference only in v1. |
| `transmission.diff_rear_oil_viscosity` | value | cSt | no | `OMIT` | — | Reference only in v1. |
| `transmission.diff_height` | value | mm | no | `OMIT` | — | Reference only; named in the limits block as not modelled. |
| `analysis_inputs.lateral_g` | value | 1 | yes | `REFUSE` | `load_transfer_split`, `roll_centre_migration`, `camber_at_roll` | The lateral acceleration the load-transfer split is reported at. |
| `analysis_inputs.roll_sweep` | value | deg | yes | `REFUSE` | `camber_at_roll`, `camber_per_roll`, `roll_centre_migration` | The roll angle the migration and camber-at-roll numbers are reported at (physics/02 §3.5). |
| `analysis_inputs.damping_low_speed` | value | m/s | no | `OMIT` | `damping_ratio` | Default 0.050 m/s (50 mm/s). Below 0.020 m/s the model does not apply (stiction dominates; physics/07 §8) and the app says so instead of printing a band. |
| `analysis_inputs.damping_high_speed` | value | m/s | no | `OMIT` | `damping_ratio` | Default 0.200 m/s (200 mm/s). |
| `notes.track` | string | — | no | `OMIT` | — | Exported and searchable (E2.8). |
| `notes.setup` | string | — | no | `OMIT` | — |  |
| `notes.tyres` | string | — | no | `OMIT` | — |  |
| `x_*` | any | — | no | `OMIT` | — | Extension keys, preserved verbatim on export and included in the hash. Applies at every depth in both kinds. |

The four damper paths appear in both this table and §4.2.1 on purpose: the model
carries the hardware and the baseline fluid, and a setup overrides the fluid and
valve values at the same path. `on_absence` in the *setup* row is the policy for
a field the setup does not carry, which for `damper.oil_cst` is `REFUSE` — ζ is
never guessed from a setup that does not say what oil is in the car.

#### 4.3.2 Geometry transform pipeline

Each adjustment is a delta applied to named base points along one named axis, in
one direction, in millimetres, applied in the order the entries appear in
`geometry.adjustments[]`. Each field appears at most once in that list — a
duplicate entry is a schema error, so "apply it twice" is not expressible and
order cannot change the result, which is why the transform is described as total
and deterministic below. The transform is total and
deterministic: it always produces exactly one geometry, and the derived geometry
is what all outputs are computed from.

| Adjustment | Base points moved | Axis | Direction | Unit | Effect |
|---|---|---|---|---|---|
| `upper_link_inner_shims` | `points.uca_in` (single_link) or `points.uca_in_a` **and** `points.uca_in_b` (wishbone), on that corner | vehicle **y** | **positive = outboard** (away from the centreline): `y += sgn(y_corner) · shim` | mm | Changes upper-link length and inboard pivot line → camber gain, roll-centre height |
| `upper_link_outer_shims` | `points.uca_out` | vehicle **y** | positive = outboard: `y += sgn(y_corner) · shim` | mm | Moves the upper ball joint outboard → camber, camber gain |
| `wheel_offset` | `points.wc` (the contact patch follows) | vehicle **y** | positive = track **increase** per side: `y += sgn(y_corner) · offset` | mm | Track, scrub radius; ball joints do not move |

`sgn(y_corner)` is `+1` for a corner with `y > 0` and `−1` for `y < 0`, computed
from the base model rather than assumed from the corner's name, so a mirrored
model behaves identically. Consequences that the rest of the document depends on:

- The adjustment set is **closed**. A setup file containing any other field that
  would move a hardpoint is refused at import (E6.5) with the field path named.
- Adjustments change `geometry.geometry_hash` and **never** change
  `model_ref.content_hash`; therefore a shim change does **not** raise E2.7's
  "model changed" notice (asserted in E2.7).
- Two setups with different `geometry_hash` are still comparable, because they are
  the same car — that is the point of comparing a shim change (E4.1). Two setups
  whose `model_ref.id` differ are not (E4.3).
- The geometry the physics consumes is the transformed geometry, always; there is
  no "model geometry" path and no second code path for "no adjustments".

#### 4.3.3 Anti-roll bar inputs, and the setting ambiguity

Two representations exist and the file says which one it carries, in
`arb.type`:

| `arb.type` | Fields used | Rate meaning | Wheel-rate conversion |
|---|---|---|---|
| `blade` or `fixed` | `rate_at_link` | **N/mm at the drop link**, the stiffness the bar applies at its link at full stiff | divided by the square of the drop-link motion ratio, which is derived from `points.arb_drop` and the lower arm; without `arb_drop` the conversion is not performed and roll stiffness says the bar was excluded |
| `torsion_bar` | `bar_diameter`, `span`, `arm_length`, `shear_modulus` | torsional stiffness `k_θ = GJ/L`, then a wheel rate | same conversion from `points.arb_drop` |
| `none` | none | no bar | zero contribution, stated |

`arb_setting` is a **linear fraction of the link rate**: 0 = no contribution from
the bar, 1 = `arb.rate_at_link`. It is **not** a fraction of blade travel —
that reading differs by tens of percent on a real blade and is the ambiguity the
round-1 review found. A non-linear blade curve is expressible only through
`arb.setting_table` (R2); a model that declares `blade` and omits the table is
linear by definition and the app says "linear bar assumed" in the assumptions
block.

The torsion-bar fields **are in the v1 schema** — they are fields like any other,
typed, ranged and with an `on_absence`, and §4.2.1 lists them. What is R2 about
them is the *release* of a v1 model that declares `torsion_bar`, not their
existence: a file that carries them validates today, and §4.3.3's earlier claim
that they "do not exist in the v1 schema" while §4.2.1 required them was the
round-2 contradiction. The reference car is such a file, and it is why
`arb.bar_diameter` — never `bar_diameter: 0`, which is not a bar and not an
absence — is how a torsion bar is described.

### 4.4 Computed outputs — names, units, inputs, release

Outputs are never stored in a setup file. They are functions of (transformed
model geometry, setup, analysis inputs) and are recorded only in exports, where
they are labelled as derived and carry the state from §4.4.1.

| id | Output | Solver unit | Displayed as | Depends on (field paths, §4.2.1/§4.3.1) | AC | Release |
|---|---|---|---|---|---|---|
| `motion_ratio` | Motion ratio | – | – | `points.lca_in_*`, `lca_out`, `uca_*`, `wc`, `damper_lo`, `damper_up`; `axles.<axle>.spring.location` | E3.1 | R0 |
| `wheel_rate` | Wheel rate ("ride stiffness") | N/m | N/mm | motion ratio, `spring.rate` (setup override), `spring_preload`, ARB contribution | E3.1 | R0 |
| `ride_frequency` | Ride frequency | Hz | Hz | wheel rate, `body.mass.sprung_front` / `.sprung_rear` | E3.2 | R1 |
| `roll_stiffness` | Roll stiffness | **N·m/rad** | N·m/deg (÷ 57.29578) | wheel rates, `axles.<axle>.track`, `arb.*`, `arb_setting`, `points.arb_drop` | E3.2 | R1 |
| `load_transfer_split` | Lateral load-transfer split | – | % front | roll stiffness front/rear, `body.cg.height`, roll-centre heights, `body.mass.total`, `body.mass.unsprung_front`/`_rear`, `analysis_inputs.lateral_g` | E3.2 | R1 |
| `roll_centre_height` | Roll-centre height (static) | m | mm | both arms' inboard and outboard points, `points.wc`, `body.reference_ride_height` | E3.3 | R0 |
| `roll_centre_migration` | Roll-centre **displacement** at φ = ±`analysis_inputs.roll_sweep` | m | mm | as above, re-solved at ±φ | E3.3 | R0 |
| `camber_gain` | Camber gain κ = dγ/dz_wheel | **rad/m** | ° per 10 mm bump (detail: °/mm) | upper and lower link geometry, `points.wc`, `arm_type.*`, `geometry.adjustments[]` | E3.4 | R0 |
| `camber_per_roll` | Camber change per degree of roll | rad/rad | °/° | `camber_gain` × wheel travel per degree of roll | E3.4 | R0 |
| `camber_at_roll` | Camber at roll | rad | ° | `camber_per_roll` (or `camber_gain`), `corners.<corner>.camber`, `analysis_inputs.roll_sweep` | E3.4 | R0 |
| `bump_steer` | Bump steer | rad/m | mm of toe per 10 mm bump (detail: °/mm) | `points.tie_in`/`tie_out`, lower arm, `axles.front.steering.rack` | E3.5 | R1 |
| `damping_ratio` | Damping ratio at each stated shaft speed | – | – | `damper.*` (§4.8), sprung mass at the corner, wheel rate, motion ratio | E3.6 | R1 |
| `ackermann_toe` | Ackermann / toe at roll | rad | ° | tie-rod geometry, `axles.front.steering.rack`, `corners.<corner>.toe` | E3.18 | R2 |

These ids are what `fields.yaml`'s `consumed_by` refers to and what E4.1's diff
rows carry, so a new output is a new id here, in the YAML and in an AC — in that
order.

**Three units changed in this table, and each one changed a definition**
(round-2 finding D-13):

- **`roll_stiffness` is N·m/rad**, the unit `physics/05` §3.3, `physics/06` (6.6)
  and `physics/99` §7 actually compute in. The v0.2 table said N·m/deg, which
  is 57.3× smaller — a table that would have shipped a number nobody could
  reproduce. N·m/deg remains the **display** unit, converted once in the
  formatter.
- **`camber_gain` is °/mm** — κ = dγ/dz in `physics/02` (2.14), which is also
  what the design's headline ("° per 10 mm bump") reads. `deg/deg` is a
  *different quantity*, the derivative with respect to roll, and it is the
  `camber_per_roll` row. One name per quantity, so "camber gain deg/deg" can no
  longer mean either.
- **`roll_centre_migration` is a displacement in mm at a stated roll angle**, not
  a rate "per 0.5°". `physics/02` §3.5 reports it at φ = ±1.0° and §6.6 prints
  the numbers that way; a per-0.5° rate is not something any module computes.

Every output has an AC: the audit in E9.9 fails an output id here with no AC, so
the two orphan outputs the round-1 review found (Ackermann, dynamic toe) cannot
reappear. **Grip is not in this table and never will be**: it is not measurable,
not computable from these inputs, and not an output (§4.11, E5.6).

#### 4.4.1 Validation and absence states

Every displayed or exported value carries exactly one state, and `COMPUTED_*`
states additionally carry `validated` or `not_yet_validated` (D-11). The states,
and the precedence when more than one applies — highest wins:

| # | State | Set when | What is shown |
|---|---|---|---|
| 1 | `UNDEFINED(reason)` | the geometry is degenerate (E3.8) | "undefined for this geometry" + reason, no number |
| 2 | `REFUSED(field \| reason)` | a consumed field is absent with `on_absence: REFUSE`, or the model is missing (§4.6) | the field or reason named, no number, no unit, no dash |
| 3 | `OUT_OF_DOMAIN(bound)` | the value is outside `roll_centre_validity` or another declared bound (E3.9) | the number, plus the bound exceeded |
| 4 | `COMPUTED_INCOMPLETE(fields[])` | a consumed field is absent with `on_absence: OMIT` | the number, plus "does not include <field>" |
| 5 | `COMPUTED_ASSUMED(fields[])` | a consumed field is absent with `on_absence: ASSUME` | the number, plus the field and the assumed value |
| 6 | `INFERRED(procedure, band)` | a consumed field is absent with `on_absence: ESTIMATE`, or the output is itself inferred | the number, its **band**, the procedure name, tier `inferred` |
| 7 | `ESTIMATED_INPUTS(n)` | at least one consumed value has an `estimated` source | the number, plus the count and the basis one tap away |
| 8 | `COMPUTED` | nothing above applies | the number |

Every value also carries a **tier** — `firm`, `inferred` or `speculative` — per
§4.11, and the tier is shown wherever the state is shown: the state says whether
the number exists, the tier says how much it is worth.

`not_yet_validated` is the initial state of every value this build produces: a
`COMPUTED` value becomes `validated` for an output only when a golden case exists
for it (E3.11) **and** a recorded measurement check has passed for that model
(E3.13). Until then every surface says so, in the analysis-health line and on each
value's chip, and every export carries the same word. This is E3.16, and it is
the requirement that stops an unvalidated model rendering `9.97 mm` with a unit
and no caveat.

### 4.5 Canonical form and `content_hash`

Two implementations, or the same implementation across a serialiser rewrite, must
produce the same hash for the same document. This section is exhaustive; where it
names an external standard it adopts it **whole**, with no local variations.

#### 4.5.1 Scope — what is hashed

The hash covers the **document body**: the top-level JSON object with exactly two
members removed — `meta` and `content_hash`. Everything else is in scope and is
therefore content:

- `schema_version`, `kind`, `id`, `name`, `class`, `units`, `frame`, `symmetry`;
- `license`, `contributors`, `attribution_text` (§4.9);
- `sources` in full, including `by`, `date` and `basis` — a change to who measured
  something is a change to the document;
- every numeric value object and every array, at every depth, including
  `geometry.adjustments[]` and `x_*` keys (§4.1 rule 7).

`meta` is excluded because it holds `app_version`, `created`, `revises` and
`mapped_at`: re-saving the same content through a newer app must not change the
identity of the revision. `content_hash` is excluded because it cannot contain
itself. Nothing else is excluded, so **an exported file re-imported and
re-exported has the same hash** (E1.7), and a file whose unknown keys were
dropped on export does not.

#### 4.5.2 Algorithm

1. Take the body of §4.5.1 as a JSON value.
2. Serialise it with **RFC 8785 JSON Canonicalization Scheme (JCS)**, which pins
   every remaining degree of freedom:
   - **Member ordering**: recursively sorted by **UTF-16 code unit** value,
     ascending (JCS §3.2.3). Where UTF-16 order and UTF-8 byte order differ (only
     for names above the BMP), the RFC's rule wins — this specification adds no
     tie-breaker of its own.
   - **Number formatting**: ECMAScript `Number.prototype.toString()`
     (ES2020 §7.1.12.1), i.e. the shortest decimal string that round-trips to the
     same IEEE-754 double. Integral values are written **without** a fractional
     part (`5`, not `5.0`); `-0` is written **`0`**; exponential form appears only
     below `1e-6` or at or above `1e21` (`1e-7`, `1e+21`). `NaN`, `Infinity` and
     `-Infinity` are not representable and the writer **refuses to write a
     document containing one** (which E3.8 makes unreachable anyway).
   - **Strings**: UTF-8, no BOM, minimal escaping per RFC 8785 §3.2.2.2; no
     Unicode normalisation is applied — a string is hashed as written, so `é`
     composed and `é` decomposed hash differently and that is intended.
   - **No insignificant whitespace.**
3. Hash the resulting bytes with **SHA-256**; write the result as the string
   `"sha256:"` followed by 64 lowercase hexadecimal characters.

Worked consequences, so two implementers can check themselves before they write
code: `{"b": 1, "a": -0.0}` canonicalises to `{"a":0,"b":1}`; `3.0` and `3`
are the same value and both canonicalise to `3`; `1e-7` stays `1e-7`; a document
containing `"v": 0.1 + 0.2` stores the double, and canonicalises to
`0.30000000000000004` — the writer never rounds a stored value on the way out.

#### 4.5.3 `geometry_hash`

A setup's outputs depend on geometry that includes its own adjustments (§4.3.2),
so the geometry is hashed in its own right. `geometry_hash` is the SHA-256 of the
JCS form of exactly this object, and of nothing else:

```text
{ "frame": { "standard": "ISO 8855" },
  "corners": { "<side>": { "<point path>": [x, y, z], … }, … },
  "axle": { "<axle>": { "track": <mm>, "tyre_radius": <mm> } } }
```

(schematic — the placeholders are not JSON)

with points in **canonical, transformed** form (after every adjustment in
§4.3.2), bare numbers rather than `{value, source}` objects (provenance does not
change geometry), and sides ordered as JCS orders them. Two setups with the same base
model and the same adjustments therefore have the same `geometry_hash` on any
device, which is what E7.1b asserts and what makes a shared sheet reproducible.

#### 4.5.4 Fixtures and the unit guard

Two fixture documents are published with this specification and are the
acceptance test for any implementation (E1.7):

| File | Purpose |
|---|---|
| `docs/specs/fixtures/hash-1.json` + `hash-1.sha256` | A complete model in the current schema; exercises nested objects, arrays, negative zero, an integral float, an exponent-form value and an `x_` key |
| `docs/specs/fixtures/hash-2.json` + `hash-2.sha256` | The same body with two members reordered and one insignificant whitespace difference, proving order-independence, plus a second body with one changed digit, proving sensitivity |

A candidate implementation that reproduces neither published value has not
implemented §4.5 and may not write a file with a `content_hash`.

**Unit guard (R-2).** The adapter that converts a document into the typed physics
model rejects any coordinate whose modulus exceeds **3000 mm** with
`schema error: coordinate looks like metres`. It is the one automated defence
against a metre value in a millimetre field, and E3.8's property test exercises
both sides of the boundary.

### 4.6 Document references, and the model-missing state

A setup references its model; it does not embed it (§4.1 rule 6). A setup file
that arrives from another device therefore frequently arrives **without** the
model it names, and this section defines that path end to end so it cannot
dead-end.

**Library record state.** Every setup in the library is in exactly one of four
states. The state is stored in the library index, **never in the setup file**: a
file must not claim a model it has not got, and a state written into the file
would be wrong on the next device.

| State | When | Outputs | Allowed actions |
|---|---|---|---|
| `linked` | `model_ref.content_hash` resolves to a stored revision | computed | all |
| `model_missing` | `model_ref.content_hash` resolves to nothing | none; every output `REFUSED(model_missing)` | Import this model… · Use a different model… · Discard · share/export (read-only values) |
| `mapped` | the user mapped it onto a different model revision | computed, each carrying the "geometry differs from the sender's car — outputs are not comparable" banner | all, plus "restore the original reference" while `mapped_from` is retained |
| `diverged` | the library's current revision for `model_ref.id` has a different hash from `model_ref.content_hash` | computed against the snapshot the setup was saved with, never silently against the new one | Recompute against current · Keep this snapshot, recorded in `meta`. The state exists in v1 because it is derived from the library index; what E2.7 (R2) adds is the notice that explains it |

**The three actions, precisely.**

1. **Import this model…** opens the OS file picker in the same flow. On install:
   hash equal → state becomes `linked` and outputs compute; same `id`, different
   hash → the E2.7 comparison flow runs; different `id` → the user is told the
   file is a different car and offered action 2 instead. Nothing is installed
   silently.
2. **Use a different model…** lists the library and, on selection, writes
   `model_ref.mapped_from = {id, content_hash, name}` — **the original values,
   verbatim** — sets `meta.mapped_at`, and leaves the original `model_ref`
   untouched apart from the added `mapped_from` member. State becomes `mapped`.
   Every output then carries the non-comparability banner, and E4.3 refuses an
   output comparison between a `mapped` setup and a `linked` one.
3. **Discard** removes the library record and touches nothing outside the app; a
   file in the user's Downloads folder is not deleted.

**What the user sees.** In the list: a "model missing" badge, the sender's sheet
label, and no numbers. In detail: every stored input, condition and note,
read-only, with its provenance; the output list in `REFUSED(model_missing)` state
with the field named; and the three actions as buttons, not as a menu. The whole
path is E6.9.

### 4.7 Validation, versioning and fixtures

- `schema_version` is `MAJOR.MINOR.PATCH` semantic versioning, as a **string**.
  There is no integer form anywhere; `docs/specs/physics/01`'s former integer is
  withdrawn (§4 preamble). This build writes **1.0.0** only. `1.1.0`, declared by
  `physics/01` §5 for the same document kind in a different shape, is withdrawn:
  two versions with no migration between them is the defect this section exists
  to prevent, and nothing has shipped, so there is nothing to migrate.
- A reader **refuses** a document whose major is greater than it supports, naming
  both versions and writing nothing (E6.6).
- A reader **accepts** a greater minor within the same major, preserves unknown
  keys per §4.1 rule 7, and marks the library row "contains fields from a newer
  version" (E6.6).
- A reader **refuses** a document that fails the schema, naming every offending
  field path and reason in one pass — not the first one (E6.5).
- One fixture document per `schema_version` the app can write, plus one for each
  version it can still read. Each fixture either loads or is refused with a named
  reason; adding a version without a fixture fails the gate (E9.10).
- No document is ever written that fails its own schema; the writer validates
  before it renames the temp file (E8.12).

### 4.8 Damper model, and the damping-ratio band

**Damping ratio ships in v1 as an estimate** (owner decision, 2026-10-30). It is
not a measurement, and the app never presents it as one.

**What is computed.** ζ per corner at the two stated shaft speeds, from the
orifice model `orifice_single_piston_v1` (physics/07), whose inputs are the
piston bore, the shaft diameter, the piston-hole diameter, the hole count, the oil
viscosity at the recorded ambient temperature, and a blow-off force. The blow-off
force is dyno-only; it is therefore an `estimated` value with a `basis` and a
`tolerance_pct`, and it is the dominant term — which is exactly why the output is
an estimate.

**What the band is.** The band is **computed, not asserted**: ζ is recomputed with
each estimated input moved to the ends of its own `tolerance_pct`, one at a time,
and the band is the resulting [min, max] at that shaft speed. It is displayed
wherever ζ is displayed and carried in every export. A fixed "±30%" label is not
acceptable — the band must move when the inputs' tolerances move, and a test
asserts that doubling one input's `tolerance_pct` widens the band.

**What the app leads with.** Not the absolute value. ζ is shown with its band,
its `inferred` tier and the words "estimate — the change between two sheets is
the reliable part", and whenever two setups are compared the **direction and
sign** of the ζ change is promoted above the absolute values in the compare view.
The absolute number is never used as a headline, never rounded to more than two
significant figures, and never marked `validated` (E3.6).

**What R2 adds, if Dave wants a measured number.** Two options are recorded so
they are not rediscovered:

1. a `damper_curve` document kind (`points: [{shaft_speed, force}]`, `source`,
   `datum`) so a user with a dyno sheet or a manufacturer's curve enters what they
   have; ζ then becomes `firm` for that corner;
2. a measured drop-test workflow: the user drops the corner, records the
   oscillation period from a video, and ζ follows from the log decrement. One
   afternoon of user effort, no dyno, real data.

**Fields the model needs for §4.8.** The hardware — piston bore, shaft diameter,
hole diameter and hole count — is in the car model at
`corners.<corner>.damper.{piston_bore, shaft_dia, piston_hole_dia,
piston_holes}`, all with `on_absence: REFUSE`: a racer can measure or read every
one of them, so their absence refuses ζ and names the field. The fluid and the
valve — `.oil_cst`, `.oil_temp`, `.f_blowoff`, `.c_post` — are in the setup at
the same path, because that is what changes between runs.

`f_blowoff` **and** `c_post` are both `estimated` with a `tolerance_pct`, and
both are inputs to the band: `07` §2.3 says the blow-off assumptions *are* the
±30 % band, and `c_post` had no field in v0.2, so the parameter that dominates
the band could not enter it. A fixed "±30 %" label is still not acceptable —
the band is recomputed from the tolerances, and it must move when they move.

Without the hardware fields ζ is `REFUSED`, and the app says which field is
missing rather than guessing.

### 4.9 Licence, contributors and attribution

Model data ships under **CC BY 4.0, contributor-attributed** (`docs/LICENSING.md`).
CC BY requires attribution on redistribution, so attribution is schema, not a
screen (E7.12).

```json
{
  "license": { "id": "CC-BY-4.0", "url": "https://creativecommons.org/licenses/by/4.0/",
               "note": "optional, free text" },
  "contributors": [ { "name": "D. W.", "role": "measured", "contact": "optional" },
                    { "name": "P. Smith", "role": "reviewed" } ],
  "attribution_text": "Example 1/10 TC — measured by D. W., 2026-10-12; reviewed by P. Smith. CC BY 4.0."
}
```

- `role` ∈ `measured`, `contributed`, `reviewed`, `licensed_from`, `maintained`.
- `attribution_text` is **the exact string a re-sharer must reproduce**. It is
  stored, not generated, because a generated string cannot be kept stable across
  app versions, and a licence condition that changes with a release is not a
  licence condition.
- All three members are in the hashed body (§4.5.1), are preserved through
  import, library listing, analysis, export and re-share, and are shown on the
  library row and the analysis provenance line (E7.12), and in the credits screen
  generated from the files themselves (E9.6).
- A setup that was built from someone else's model carries
  `derived_from_models[] = [{id, content_hash, attribution_text}]`, so a shared
  sheet carries the sender's attribution even when the recipient never receives
  the model.
- A model whose `license.id` begins `CC-BY` and which has no `contributors` or no
  `attribution_text` is **refused at import** (E7.12); a model with no `license`
  at all is refused, because a file that cannot legally be re-shared must not
  enter a library built for sharing.

### 4.10 The machine-readable field map

`docs/specs/fields.yaml` **exists** (it did not in v0.2, which is why this
section described a file nobody could read) and is the single source for both
field tables, for the generated TypeScript table the validator interprets, and for
every test that iterates fields. One entry per field:

```yaml
- path: body.cg.height
  type: value
  unit: length               # a dimension from meta.dimensions → mm
  req: "no"
  on_absence: ESTIMATE       # ASSUME | ESTIMATE | REFUSE | OMIT
  estimate: two_hang_plumb_line   # a procedure id in the same file's `procedures`
  estimate_alt: component_mass_moment
  band: true                 # the value carries a computed band
  default: 28.0
  plausible: [15, 45]
  consumed_by: [load_transfer_split, roll_centre_height]
  notes: "Never asked as a measurement (D-14)."
```

Rules, all enforced by E9.10:

- `on_absence` is mandatory and is one of the **four** legal values. A table, an
  enum or a validation rule that knows only three is wrong: `ESTIMATE` is the
  policy that carries CG height and the unsprung masses, and a loader that
  collapses it into `ASSUME` turns an inferred number into an assumed one and
  loses its band.
- `assume` is mandatory where the policy is `ASSUME` and forbidden otherwise.
- `estimate` and `band` are mandatory where the policy is `ESTIMATE`, and
  `estimate` must name an entry in the file's `procedures` map.
- `consumed_by` lists output ids from §4.4; every id must exist there, and the
  single sentinel `all` is legal on envelope fields only.
- `plausible` is a closed interval in the field's own unit, or absent for a field
  with no meaningful range. A default that falls outside its own `plausible`
  interval is a schema error — which is how `ASSUME(0)` for unsprung mass would
  have been caught by the gate rather than by a review.
- The Markdown tables in §4.2.1 and §4.3.1 are **generated** from this file, and
  the gate fails if the checked-in tables differ from the generated ones. So are
  the TypeScript table and the fixture set.

The file's own header records every place the two documents disagreed and which
name survived, so a reader of an older file can find what happened to a key
instead of guessing. `docs/specs/physics/01` §5 is the same schema shown as a
worked model.

### 4.11 Tiers of claim: firm, inferred, speculative

Every value and every statement about how the car behaves carries one tier, on
every surface and in every export. The tier is orthogonal to the state in §4.4.1:
the state says whether the number exists, the tier says how much it is worth.

| Tier | Means | Examples | Must display |
|---|---|---|---|
| `firm` | Derived from a value the file records as `measured`, through an equation used inside its stated domain | motion ratio, wheel rate, roll-centre height (no `assumed`/`inferred` inputs) | nothing extra |
| `inferred` | Derived from an estimate, an inference procedure, or a model whose inputs are not measured; carries a computed band (§4.8) | damping ratio (§4.8), CG height (§4.2.1 `ESTIMATE`), load-transfer split when `cg.height` is inferred, **every statement about grip** | the word "inferred", the band, and — for any claim about car behaviour — the words **"all else equal"** |
| `speculative` | A candidate offered for the user to try, never a result | a suggested change from the setup-sheet interpreter (E2.13) | "speculative", "try and measure" |

Three hard rules: **grip is never `firm` and never a computed quantity** — the app
may say "more rear bar usually increases rear roll stiffness, which usually
increases oversteer, all else equal", labelled `inferred`, and may not print a
grip value; **no composite grip or handling score exists at any tier** (E5.6);
and **CG height is never requested as a measurement** — corner scales cannot
locate a CG, so it is `ESTIMATE` with the two-hang plumb-line procedure or a
component-mass estimate, and every output that consumes it is `inferred` with a
band.

---

## 5. Functional and non-functional requirements

### 5.1 Functional requirements

The capability set, numbered for the plan. Each is proven by the acceptance
criteria named beside it; the ACs are the contract, this list is the map.

| # | Capability | Proven by |
|---|---|---|
| FR-01 | Create, measure, edit and revision a car model, with per-value provenance | E1.1–E1.3, E2.7 |
| FR-02 | Guide the measurement, in physical order, with datums and diagrams | E1.5, E1.10, E5.2 |
| FR-03 | Record mass properties, including a sprung/unsprung split derived from raw readings, and infer CG height | E1.2, E1.8, E1.10 |
| FR-04 | Create, edit and revision setups against a specific model revision | E2.1, E2.2, E2.7 |
| FR-05 | Compute the twelve outputs in §4.4 from a complete model and setup | E3.1–E3.6, E3.18 |
| FR-06 | Show the equation, the substituted inputs, the units, the state and the tier behind every output | E3.7, E3.16, §4.11 |
| FR-07 | Handle degenerate and out-of-domain geometry without producing a fake number | E3.8, E3.9 |
| FR-08 | Recompute continuously while an input is being dragged | E3.12 |
| FR-09 | Validate the model against a measured wheel rate and flag disagreement | E1.10, E3.13 |
| FR-10 | Compare two setups: input deltas, output deltas, causal inputs, baseline, and differing conditions | E4.1–E4.6, E4.9 |
| FR-11 | Explain any output and any input in place, with definitions that close | E5.1–E5.3, E5.8 |
| FR-12 | State the model's limits and assumptions on the analysis screen and in every export | E5.5, E7.1a |
| FR-13 | Maintain a local model library with completeness and provenance visible | E6.1–E6.3 |
| FR-14 | Install and share models and setups as files — picker, drop, paste, download, web share — with attribution intact | E6.2, E6.4, E7.5, E7.12 |
| FR-15 | Export any model, setup, comparison and sheet; back up and restore the library | E7.1a–E7.8 |
| FR-16 | Offer a guided first run from empty install to first delta | E5.7 |
| FR-17 | Work completely with no network, no account and no personal data | E8.1–E8.3, E8.13 |
| FR-18 | Be usable one-handed, in sunlight, with gloves, at 200% text | E8.6–E8.16c |
| FR-19 | Open a setup whose model is absent, and map it onto another deliberately | E6.9 |
| FR-20 | Validate, version, canonicalise, hash and migrate documents reproducibly | E1.7, E6.5, E6.6, E9.10 |
| FR-21 | Enforce the clean-room rule and the no-score rule mechanically | E5.4, E5.6, E9.4 |
| FR-22 | Save atomically, survive process death, and report save failures without loss | E8.12, E8.14, E8.15, E1.13 |
| FR-23 | State the privacy position in-app, and prove it: no third-party request is made | E8.13 |
| FR-24 | Gate the release: every stage exits 0, every MUST has a test, every checklist item is signed | E9.3, E9.8, E9.9, E9.10 |
| FR-25 | Infer, band and tier every quantity the user cannot measure, and never dress an inference as a measurement | E3.2, E3.6, E5.2, E5.6, §4.11 |
| FR-26 | Interpret a driver's written report as understeer/oversteer claims with phases and tiers | E2.13 |

### 5.2 Performance

**Reference phone (the budget's denominator).** A mid-range phone of the class in
a racer's pocket in 2026 — 8 cores (2 performance + 6 efficiency, roughly
Snapdragon 695 / Dimensity 700 class), 4 GB RAM, 1080×2400 at 60 Hz, Android 12 —
running the **installed app in a production build, launched from the home-screen
icon, with no debugger and no devtools attached, and battery not in saver mode**,
device at 25 °C. Every number below is measured on that device, in that browser;
a faster phone proves nothing, a slower one is not a release blocker until it is
the reference, and **a desktop browser is not the reference** — a value measured in
Chrome on a laptop is a development aid, and the release checklist records which
engine produced each number. The iOS half of the matrix is measured on the same
class of device running Safari, because D-19 made it a v1 platform rather than a
later port.

| # | Measurement | Target | Test | AC |
|---|---|---|---|---|
| P-01 | Full analysis recompute for a complete model (all outputs, both axles, 13-row roll-centre sweep) | **≤8 ms at p50, ≤16 ms at p95** (D-21, provisional) | Timing harness over 1,000 iterations, production build | E3.12 |
| P-02 | Recomputation during a continuous slider drag of 10 s | **≥95% of frames presented within 16.7 ms**; no frame >32 ms | Automated frame-timing capture | E3.12 |
| P-03 | Single-output recompute (one output, one input change) | ≤2 ms | Timing harness | — (design target) |
| P-04 | Warm start to interactive analysis screen (shell cached, app installed) | ≤2.0 s | Automated launch test on the production build | E8.5 |
| P-05 | Open a stored model | ≤300 ms | Timing harness | E8.5 |
| P-06 | Library list, 200 models, scroll | Sustained 60 fps | Frame-timing capture | E6.3 |
| P-07 | Validate + import a 1 MB model file | ≤150 ms | Timing harness | — (design target) |
| P-08 | Generate a one-page setup sheet PDF (print-to-PDF in the browser) | ≤2.0 s | Timing harness | E7.4 |
| P-09 | Peak memory used by the page during analysis | ≤150 MB | Browser memory panel over a 10-minute session | — (design target) |
| P-10 | Continuous use, 30 minutes | No frame-rate drop attributable to thermal throttling; ≤5% battery on the reference phone | Recorded in the release checklist (C-03) | E9.3 |
| P-11 | First load, cold cache, on the reference phone over a mobile network | ≤350 KB gzipped JavaScript (E8.11); time-to-interactive recorded, not gated until the first measurement sets the baseline | `size-limit` in the build job + a one-off device measurement | E8.11 |

The last column exists so that a performance number without a criterion is
visible as such: P-03, P-07 and P-09 are design targets, not release gates, and
saying so is better than pretending they are tested.

**Design consequence:** P-01 and P-02 together mean the analysis must be a single
pure function over a pre-parsed model — allocating a new results object per frame
is acceptable, re-parsing JSON per frame is not, and neither is writing the result
into browser storage per frame. This is a constraint on the physics package's API
(it takes a typed model, not a file) and it is already implied by the pure-TypeScript
rule. On the web it adds one constraint the native build did not have: the frame
also has to carry the browser's style, layout and paint work, so the solve has to
finish well inside the budget rather than exactly at it — which is why D-21 halves
the p50 target instead of carrying 16 ms across.

### 5.3 Reliability and data safety

Every rule here has an AC id, because a rule without one is a rule nobody builds.

- The app never presents a number it cannot justify: no `NaN`, no `Infinity`, no
  silent default, no inference without its band (E1.2, E1.8, E1.9, E2.4, E3.8,
  E3.16, §4.11).
- Saves are atomic; a killed process never leaves a corrupt current revision
  (E8.12).
- A failed save is reported on the field being saved, with a retry that touches
  only that row, and no other value is lost (E8.14).
- A corrupt or unreadable file is quarantined and named; the rest of the library
  still opens (E8.15).
- Every model revision and setup revision is retained until the user deletes it;
  deletion is confirmed and, for a model revision, the setups that reference it
  are named first (E2.2).
- A backup carries a hash per document and a restore verifies every one before
  writing anything (E7.6).
- No operation requires a network acknowledgement to complete (E8.1, E8.2), and no
  operation contacts a third party at all (E8.13 clause (c)).
- Browser storage can be evicted under pressure, and on iOS Safari it is evicted for
  a site not visited for seven days unless the app is installed; persistent storage
  is requested at first run, installation is offered, and an export older than seven
  days is prompted for (E8.17, E8.18). An empty library that was not empty last time
  reports eviction rather than presenting itself as a first run (E8.18 clause (d)).
- Work in progress survives a kill: the worksheet field and the setup working
  copy come back exactly as they were (E1.13).

### 5.4 Accessibility

Target: **WCAG 2.2 AA** for the app's own screens. Each rule below has exactly
one AC, so the nine rules cannot be claimed by one grab-bag criterion.

| # | Requirement | AC |
|---|---|---|
| A-01 | Minimum interactive target 44×44 CSS px with ≥8 px separation | E8.7a |
| A-02 | Text scales to 200% with no clipping, overlap or loss of a value | E8.7b |
| A-03 | Contrast: 4.5:1 body text, 3:1 large text and non-text UI, both themes | E8.7c |
| A-04 | Never colour alone: every delta carries a sign and a direction word; every chart series carries a line style and a direct label | E8.7c |
| A-05 | Every chart has an equivalent table view reachable in one tap | E8.7d |
| A-06 | Every computed value announces name, value, unit, state, tier and change state to a screen reader | E8.8 |
| A-07 | Focus order follows reading order; the analysis screen is operable by switch access | E8.16b |
| A-08 | No content requires precise dragging: every slider has a stepped alternative | E8.16a |
| A-09 | No flashing content; motion respects the system reduce-motion setting | E8.16c |

### 5.5 Localisation readiness

- All user-facing text lives in externalised resources from the first commit; no
  string is assembled by concatenation (E8.9a).
- Plurals and numbers use the platform's locale-aware formatting; units are
  formatted per locale (decimal separator) and converted from storage units once.
- The layout survives a pseudo-locale of +40% string length and an RTL locale
  without clipping or reflow breakage (E8.9b, R2).
- v1 ships English only (D10), which is why RTL layout and the pseudo-locale are
  SHOULD/R2 while externalisation is MUST/R2: the cheap part is kept, the
  expensive part is deferred.

### 5.6 App size and distribution

The numbers live in **E8.11** and nowhere else: first load ≤ 350 KB of gzipped
JavaScript, total cached assets ≤ 2 MB, one model document ≤ 100 KB (D-21,
provisional), with the measuring command recorded in the release checklist (C-02).
No bundled model library beyond the example models (E6.1); no bundled video, and
**no bundled fonts at all** — the type is the platform's system stack, so there is
nothing to download and nothing to licence; explanations are text, not images.
There is no app-store package, so there is no download size to declare and no
installed footprint to report: the service worker's cache *is* the footprint, and
E8.11's second budget is its ceiling.

### 5.7 Maintainability and IP

- The physics package has no React and no DOM dependency — its `tsconfig.json`
  omits the DOM lib, so a browser API is a type error rather than a review note —
  and a test also asserts that its `package.json` declares no UI dependency
  (review rule 3). Both run in E9.8's `typecheck` and `test` stages.
- Every physics function states its units in its doc comment, and that doc comment
  is in SI, because the package is SI-only inside its boundary (R-2).
- Every constant in the physics carries a citation (review rule 1), and E3.11
  requires the golden value to trace to a source outside the codebase.
- No forbidden material in the repository or the artifacts, enforced by the IP
  and overlap stages (E5.4, E9.4).

---

## 6. Non-goals and out of scope for v1

These are stated so that a reviewer can reject work that drifts into them, and so
that a user is never promised them by accident.

### 6.1 Non-goals (not this product, at any version)

| # | Non-goal | Why |
|---|---|---|
| N-01 | A lap-time simulator | The intent forbids it. Nothing in this app predicts a lap time, and no output is labelled as performance. |
| N-02 | A tyre model of record | A tyre model whose coefficients we cannot measure would launder guesses into "grip" numbers. Absent at every version, not deferred. |
| N-03 | A driving game or a physics sandbox | Different product. |
| N-04 | A telemetry platform | Requires hardware partnerships, real-time ingest and a backend — all excluded by the offline constraint. |
| N-05 | An account system, a cloud service, a subscription | Excluded by the intent and by the funding model. |
| N-06 | Any dependence on a proprietary database engine or an installer | This is the failure that killed the predecessor. |
| N-07 | Reproducing the predecessor's user interface | Its workflows are kept because they work; its screens, icons, wording and name are not. |
| N-08 | **A grip value, a grip score or a "balance verdict", at any tier** | Grip is not measurable by this app and not computable from its inputs. Presenting a number, even labelled `inferred`, would convert an inference into a claim the app cannot defend (E5.6, §4.11). |

### 6.2 Out of scope for v1 (candidates for later)

| # | Deferred | Trigger to revisit |
|---|---|---|
| L-01 | Motor, battery and ESC modelling; dyno analysis | After v1 ships and the geometry core is validated in use |
| L-02 | Acceleration simulation and time-domain chassis roll (E3.15) | After v1; needs a validated damper model and a lateral-g input |
| L-03 | Chassis torsional stiffness, diff-height effect, aero | Each needs measured inputs the app cannot currently obtain |
| L-04 | Droop-limited roll behaviour in the static analysis | Needs a load-path model; v1 states the limit instead of guessing |
| L-05 | Desktop and web builds | **SUPERSEDED by D-19** — the web app *is* the product; a desktop browser is the same URL, not a second build. The two layout breakpoints (600, 900 px) are in v1 |
| L-06 | Any sync, sharing service or model store (E6.8) | Files work offline; a store adds cost and a trust boundary |
| L-07 | OCR of paper sheets (E2.10), photo/CAD capture (E1.12), sheet-format adapters (E7.10) | Each is a separate feature with its own accuracy problem |
| L-08 | Multi-setup comparison beyond two (E4.8) | Two is the question users actually ask |
| L-09 | In-app teaching videos or links out to them | The predecessor's teaching is not ours to link; see §8.3 on the removed E5.9 |
| L-10 | **iOS** | **SUPERSEDED by D-19** — one URL serves iOS Safari and the home-screen app, so there is no iOS build to schedule and no enrolment question to answer |
| L-11 | A **measured** damping ratio: a `damper_curve` document or a drop-test workflow (§4.8) | When a user asks for a number they can trust, or a dyno sheet turns up. The estimate plus its band is v1's answer |
| L-12 | Non-linear ARB setting curves (`arb.setting_table`) | When a blade-bar user reports the linear assumption is what makes the number wrong |

---

## 7. Decisions: taken, and still open

### 7.1 Taken — recorded here so they are not re-opened

| # | Decision | Lands in |
|---|---|---|
| R-1 | **Frame is ISO 8855**: x forward, y **left**, z up, origin on the ground plane at the rear axle centre. Per-wheel quantities are per-wheel signed (camber positive = top outboard, toe positive = toe-in) and mirroring copies them **unchanged** — it negates point `y` only (D-17, `docs/decisions.md`); the side factor `s` is applied once in the solver. Car-level quantities are never signed per side. | §4.2, E3.3, E3.4, all hardpoints re-derived |
| R-2 | **Storage is mm, g, degrees**; SI exists only inside the physics package, at one conversion boundary; the metre-value guard is `\|c\| > 3000 mm`. | §4.1 rule 1, §4.5.4 |
| D-09 | One gate command, **now `npm run gate`** (typecheck + unit + schema/field drift): the principle is unchanged, the tool is D-19's. | E9.8, AGENTS.md |
| D-10 | **Superseded by D-19.** iOS is not deferred, because there is nothing to defer: one URL serves both phone platforms. No AC may require a store, an SDK version or a native permission — there is no artifact to hold either. | §2.4, L-10, §8.3 |
| D-19 | **The app is a React + TypeScript web application**, installable as a PWA and fully offline; Flutter and Dart are retired. Distribution is static hosting — no store, no signing key — and the physics, schema, units and goldens are unchanged by the switch. | §2.4, §5.6, E8.1, E8.17, E9.8, `architecture.md` |
| D-20 | **Persistence is IndexedDB for documents, `localStorage` for preferences only**, with `navigator.storage.persist()` at first run; Safari's seven-day eviction of unvisited sites is stated on screen and answered by installation plus an export nag. | E8.17, E8.18, §5.3 |
| D-21 | **Web performance budgets are provisional** — 350 KB gzipped first load, 2 MB cached, 100 KB per document, 8 ms p50 / 16 ms p95 for a drag recompute — and are re-baselined from the first device measurement, which the criterion then quotes. | E3.12, E8.11, §5.2 |
| D-22 | **Import is a picker, a drop or a paste; export is a download; "export everything" is one archive.** File association is an accepted loss, recorded rather than engineered around. | E6.2, E6.4, E8.18 |
| D-23 | **The suspension scene is SVG, series plots go through one chart library behind a wrapper, and no renderer computes physics.** | E8.7d, `architecture.md` §6 |
| D-11 | Every computed property carries a visible validity state, `not_yet_validated` initially. | §4.4.1, E3.16 |
| D-12 | v1 = geometry, balance and damping ratio. Round 2 could not support damping ratio as specified, and the owner's decision of 2026-10-30 resolved it as an estimate with a band rather than a measurement. | §2.1, §4.8, E3.6 |
| S-01 | **Absence policy**: every field declares `on_absence` ∈ `ASSUME`/`ESTIMATE`/`REFUSE`/`OMIT`; three prose policies were deleted and the tests are generated from the table. | §4.1 rule 3, E1.2, E2.4, E9.10 |
| S-02 | **Canonical form is RFC 8785 JCS**, scope = body minus `meta` and `content_hash`, with published fixtures. | §4.5, E1.7 |
| S-03 | **Geometry in setups is a closed transform**: three adjustments, each with one axis, one sign and one unit; `geometry_hash` identifies the geometry actually used. | §4.3.2, §4.5.3, E2.1, E7.1b |
| S-04 | **Attribution is schema**: `license`, `contributors[]`, `attribution_text`, hashed and preserved through every hop. | §4.9, E7.12, E9.6 |
| S-05 | **Model-missing is a first-class state** with three actions and a recorded mapping. | §4.6, E6.9 |
| S-06 | **Release markers** R0/R1/R2 on every AC; v1 capped. | §2, §8.2 |
| S-07 | **Owner decisions of 2026-10-30**: optional conditions with a sheet-diff warning; damping ratio as a banded estimate in v1; CG height inferred, never measured; grip inference-only; the sheet interpreter's vocabulary, phases and tiers. | E4.9, E3.6, §4.2.1, §4.11, E2.13 |

**Two numbering namespaces, deliberately.** `D-nn` in this document always means a decision in
`docs/decisions.md` (the project record). `S-nn` means a decision taken inside this specification —
they are different lists and must not be confused. Before round 3 they shared the `D-` prefix, so
"D-17" meant camber/toe in the body and model-missing in this table.

### 7.2 Still open for the owner

These are the questions this document deliberately does not answer. Each costs
something if answered late.

**O-1 — Is the damping-ratio estimate the right promise?** The owner's decision
makes ζ an estimate with a band and leads with the direction of change. The cost:
users who want a number to write down will read "estimate" as "unreliable", and
the measured path (L-11) is the only cure. The alternative — ship no ζ in v1 —
removes the band from four screens and one output. **Decide before the R1 freeze**,
because E3.6 is R1 and §4.8's field set is in the schema.

**O-2 — Can a user actually measure the rack?** Bump steer (E3.5) needs
`steering.rack`, and measuring rack height often means removing the bumper and the
rack cover. Three options, and the document assumes the first: (a) ship it as a
`measured` field with a procedure and accept that some users will `estimate` it;
(b) make `rack` `ESTIMATE` with a published procedure based on a photograph and
a tape; (c) drop bump steer from v1. If (a), the procedure must exist before R1's
measurement guidance is written; if (c), E3.5 moves to R2 and §4.4 loses a row.

**O-3 — Is the linear bar assumption acceptable for a blade bar?** `arb_setting`
is now defined as a linear fraction of the link rate (§4.3.3). Blade bars are not
linear. Options: accept the assumption and say so (current state, L-12), or add
`setting_table` at R1, which needs a measurement the user probably cannot make.

**O-4 — Does the sheet interpreter belong in v1.1 or v1?** E2.13 is MUST/R2. It is
the only feature that consumes the driver's own words, the corpus says that is how
racers think, and it is cheap; it is R2 only because it is new surface. Pull it
forward if v1 has room.

**O-5 — The name (D1), the model-data permission (D4), the review bar (D5), the
first shipped models (D7), the browser floor and reference phone (D8), hosting
(D9), the localisation timing (D10).** These are unchanged from v0.1 and are
listed below with their original reasoning, each annotated where D-19 changed the
question it asks.

**O-6 — Do the Safari-relevant criteria move from R2 to R1?** The R0/R1/R2
allocation in §8.2 was partly made by platform: anything Apple-only was R2 by
construction while iOS was deferred (the old E8 preamble said so). D-19 removes
that rationale — one URL serves both engines from day one — so the markers on the
criteria that were parked there (E8.6, E8.7b, E8.16a/b) are now a scope decision
rather than a consequence. This revision records the problem and changes nothing,
because promoting them widens v1 by four MUSTs and that is Dave's call, not an
editor's. **Decide before the R1 freeze.**

---

### Original decision notes (D1–D10), with round-2 status

**D1 — The product name.**
*Question:* ship as "Setup Lab", or name it before the first public URL?
*Recommendation:* treat "Setup Lab" as an internal codename and decide the public
name at least four weeks before the first public URL and the first shared link,
after a trademark search in the RC trade (and, if it ever ships to a store, in the
app stores). D-19 removed the store *listing* from the critical path but not the
problem: the name is baked into the domain, the installed app's label on a home
screen, the manifest, and every link anyone has shared.
*Cost of getting it wrong:* a rename after launch breaks every shared link, every
setup file's `meta`, and the community's memory of the app.
**Status:** open.

**D2 — Depth of v1.**
*Question:* geometry + balance only, or wait for damper and motor-dyno parity
with the predecessor?
*Recommendation:* geometry, balance and damping ratio as an **estimate** — no
motor dyno, no acceleration simulation (as written in §2.1).
*Cost of getting it wrong:* aiming for parity delays the first usable artifact by
months and puts the hardest, least-verified part in front of the part that makes
the app worth installing.
**Status:** resolved — see §2.1 and §4.8 (damping is in, as an estimate).

**D3 — Tyre model.**
*Question:* ship a crude grip-versus-load model with a warning, or none?
*Recommendation:* **none at any version**, and no composite "grip" or "balance
verdict" score (E5.6, N-02, N-08).
*Cost of getting it wrong:* a crude tyre model makes the app *confidently wrong*
in exactly the situation it is consulted for.
**Status:** resolved — N-02, N-08.

**D4 — Model data from the predecessor, and importing it.**
*Question:* can the chassis/damper/motor model data be obtained from the family,
and may it be imported?
*Recommendation:* **do not import it and do not build an importer** (E6.5). Ask
the family in writing for the *data* under a licence compatible with CC BY 4.0
attribution; until a written answer exists, the library is built from our own
measurements and community re-measurements.
*Cost of getting it wrong:* building the importer before permission converts a
polite request into a fait accompli. This is the only decision here that cannot be
walked back.
**Status:** open — and note that §4.7's licence rules now make the answer
load-bearing: a model with no licence cannot be imported at all.

**D5 — How community models are reviewed.**
*Question:* what does a contributed model have to pass before it ships?
*Recommendation:* a **published checklist plus two independent measurement
records, or photographic evidence for every hardpoint, plus a reproducibility
run**: a second person re-enters three random hardpoints from the contributed
worksheet and must land within 0.5 mm. Review happens as a repository pull
request against the model library, with the reviewer named in `contributors[]`.
No in-app submission, no voting.
**Status:** open; E6.7 (contribution bundle) is now LATER, so the PR path is the
only path.

**D6 — Storage units in the JSON.**
*Recommendation:* **mm in the file, SI at the physics boundary.**
**Status:** resolved by R-2 — §4.1 rule 1.

**D7 — Where the first shipped models come from.**
*Recommendation:* **ship exactly one complete example model that we measured
ourselves**, fully sourced, plus a worked measurement session recorded as a
document, and let the community library grow from contributions (D5). Do not ship
ten half-measured models to look substantial.
**Status:** open; E6.1 is R0 and its fixture is the example model in §4.2.

**D8 — Minimum OS versions and the performance denominator.**
*Question:* which browser floor, and the reference phone in §5.2?
*Recommendation:* E8.6's matrix — the current and previous major version of Safari,
Chrome and Firefox — and **yes to the reference phone**: buy one cheap mid-range
Android, keep it, install the app on it, and run every performance test on it. A
second, borrowed iPhone is the iOS half of the matrix until one is bought. iOS 15
is no longer relevant: there is no deployment target, only a browser floor.
*Cost of getting it wrong:* a budget validated on a flagship ships an app that
stutters on the phones racers actually bring to a track.
**Status:** resolved in form by D-19 — there is no `minSdkVersion`; E8.6 names the
browser matrix and E8.1's off-origin assertion replaces the old permission check.
The reference-phone purchase is still open.

**D9 — Hosting against "free forever, zero running cost".**
*Recommendation:* static hosting on the owner's existing Cloudflare account, free
tier, deploying from `main`, and the public claim phrased as "free to use, no
account, no server, no ads". No store account of any kind is bought (D-19).
*Cost of getting it wrong:* a host whose free tier changes under load, or a deploy
only one person can run — the second is the one to avoid, because it turns a static
site into a job.
**Status:** open — the subdomain, the deploy trigger and whether per-PR previews
are enabled (`architecture.md` open question 5).

**D10 — Localisation timing.**
*Recommendation:* **English in v1, fully externalised**, translate after the
explanation text stops changing.
**Status:** resolved in direction (E8.9a MUST/R2, E8.9b SHOULD/R2), no date.

---

## 8. Traceability

### 8.1 Intent statements referenced

| ID | Statement (from `docs/intent.md`, abbreviated) | Witness AC |
|---|---|---|
| I1 | Model the chassis once and keep the model forever, in a plain-text format the community can version and share | E7.1a |
| I2 | Calculate the properties that matter — camber/toe gain, roll centre and migration, bump steer, wheel rates, motion ratios, load-transfer split, damping ratios | E3.1 |
| I3 | Show the equation behind every number | E3.7 |
| I4 | Compare two setups side by side and say what changed and why it matters | E4.1 |
| I5 | Teach the same concepts at the point where they are used | E5.1 |
| I6 | Run on a phone at the track, offline, no account, no server, no subscription | E8.1 |
| I7 | One codebase, cross-platform, installable, no installer, no proprietary database | E8.1 (offline shell, no off-origin request), E8.17 (installable) |
| I8 | Zero running cost | E8.13 |
| I9 | No predecessor code, binaries, help text, iconography or name | E9.4 |
| I10 | Physics as a pure TypeScript package — no DOM, no React — unit-testable and reusable headless | E3.11 |
| S | Success test: model in under 30 minutes, predict the direction of a camber-link or roll-centre change correctly | E9.5 (R2); at R1, E4.1 and E3.14 carry the direction claim |
| N2 | Non-goal: a tyre model of record (ties to §6.1, N-02 and N-08) | E5.6 |

The **witness** column is the criterion that would fail if that intent were
abandoned. It is the answer to the round-1 finding that the intent column had
become a catch-all: every intent now has at least one AC whose failure is a
capability failure, not a formatting failure.

### 8.2 Coverage

**110 acceptance criteria** across nine epics, with a release marker on every
one:

| Release | MUST | SHOULD | LATER | Total |
|---|---|---|---|---|
| **R0** — Slice 0 | 8 | 0 | 0 | **8** |
| **R1** — v1 | 41 | 2 | 0 | **43** |
| **R2** — v1.1 and later | 38 | 14 | 7 | **59** |
| **All** | 87 | 16 | 7 | **110** |

v1 therefore ships **49 MUSTs**: 8 in the Slice 0 subset and 41 in the rest of
v1 — the round-2 cap of ~35, plus three the owner's late decisions and the
checklist gate added (E3.6 damping as a banded estimate, E4.9 the conditions
warning, E9.3 the checklist gate), plus three from round 4: E8.11's size budget
became a gate rather than a warning, and E8.17 (installation) and E8.18 (storage
durability and export) are new because the web stack has no directory to keep the
library in. The three round-4 changes are the only ones in this revision that
move a marker or add an id, and each is recorded in §8.3.

Verification legend: `U` unit, `G` golden value from a source outside the
codebase, `P` randomised property test, `W` component test or browser
integration, `B` build or CI check, `M` scripted manual check, `E` usability
evaluation on real users, `U (perf)` timing harness. **No MUST carries `M` alone**: every manual check is
paired with an automated one, and the only observational criterion (E9.5) is
tagged `E` with its protocol and pass rule written into the AC itself.

| AC | Tag | Release | Primary intent | Verification |
|---|---|---|---|---|
| E1.1 | MUST | R1 | I1 | W |
| E1.2 | MUST | R1 | I1 | W, U |
| E1.3 | MUST | R1 | I1 | U |
| E1.4 | MUST | R2 | I1 | W, U |
| E1.5 | MUST | R2 | I1 | W, B |
| E1.6 | MUST | R2 | I1 | W |
| E1.7 | MUST | R1 | I1, I10 | U |
| E1.8 | MUST | R1 | I1 | W |
| E1.9 | MUST | R1 | I1 | W |
| E1.10 | MUST | R2 | I1 | W, M |
| E1.11 | SHOULD | R2 | I1 | W |
| E1.12 | LATER | R2 | I1 | — |
| E1.13 | MUST | R2 | I1 | W |
| E2.1 | MUST | R1 | I1, I4 | U |
| E2.2 | MUST | R1 | I1, I4 | U, W |
| E2.3 | SHOULD | R2 | I1, I4 | U, W |
| E2.4 | MUST | R1 | I1, I4 | U, W |
| E2.5 | MUST | R2 | I1, I4 | W |
| E2.6 | MUST | R2 | I1, I4 | W |
| E2.7 | MUST | R2 | I1, I4 | U, W |
| E2.8 | SHOULD | R1 | I1, I4 | U, W |
| E2.9 | SHOULD | R2 | I1, I4 | U, W |
| E2.10 | LATER | R2 | I1, I4 | — |
| E2.11 | MUST | R1 | I1, I4 | W, U |
| E2.13 | MUST | R2 | I5 | W, U |
| E3.1 | MUST | R0 | I2 | G |
| E3.2 | MUST | R1 | I2 | G |
| E3.3 | MUST | R0 | I2 | G |
| E3.4 | MUST | R0 | I2 | G |
| E3.5 | MUST | R1 | I2 | G, W |
| E3.6 | MUST | R1 | I2 | G, W |
| E3.7 | MUST | R0 | I2, I3 | G |
| E3.8 | MUST | R1 | I2 | P |
| E3.9 | MUST | R2 | I2 | G, W |
| E3.11 | MUST | R0 | I2 | G, B |
| E3.12 | MUST | R1 | I2 | U (perf) |
| E3.13 | MUST | R2 | I2 | W, U |
| E3.14 | MUST | R2 | I2 | U |
| E3.15 | LATER | R2 | I2 | — |
| E3.16 | MUST | R0 | I2, I3 | W, U |
| E3.17 | SHOULD | R2 | I2 | U |
| E3.18 | SHOULD | R2 | I2 | G |
| E4.1 | MUST | R1 | I4 | W |
| E4.2 | MUST | R2 | I4 | W |
| E4.3 | MUST | R1 | I4 | W |
| E4.4 | MUST | R2 | I4 | W |
| E4.5 | MUST | R2 | I4 | W, U |
| E4.6 | SHOULD | R2 | I4 | U |
| E4.7 | SHOULD | R2 | I4 | W |
| E4.8 | LATER | R2 | I4 | — |
| E4.9 | MUST | R1 | I4 | W |
| E5.1 | MUST | R0 | I5, I3 | W |
| E5.2 | MUST | R1 | I5 | W, M |
| E5.3 | SHOULD | R2 | I5 | B |
| E5.4 | MUST | R1 | I9 | B |
| E5.5 | MUST | R1 | I5 | W, B |
| E5.6 | MUST | R1 | N2 | B, W |
| E5.7 | SHOULD | R1 | I5 | W |
| E5.8 | SHOULD | R2 | I5 | W |
| E6.1 | MUST | R0 | I1 | U |
| E6.2 | MUST | R1 | I1 | W |
| E6.3 | MUST | R2 | I1 | W |
| E6.4 | MUST | R1 | I1 | W |
| E6.5 | MUST | R1 | I1 | U, W |
| E6.6 | MUST | R2 | I1 | U |
| E6.7 | LATER | R2 | I1 | — |
| E6.8 | LATER | R2 | I1 | — |
| E6.9 | MUST | R1 | I1, I4 | W |
| E7.1a | MUST | R1 | I1 | U |
| E7.1b | MUST | R1 | I1 | U |
| E7.2 | MUST | R1 | I1 | U |
| E7.4 | MUST | R2 | I1 | W, M |
| E7.5 | MUST | R2 | I1 | U |
| E7.6 | MUST | R2 | I1 | U |
| E7.7 | SHOULD | R2 | I1 | U |
| E7.8 | SHOULD | R2 | I1 | U |
| E7.10 | LATER | R2 | I1 | — |
| E7.11 | MUST | R2 | I1 | U |
| E7.12 | MUST | R1 | I1, I9 | U |
| E8.1 | MUST | R1 | I6, I7 | B |
| E8.2 | MUST | R2 | I6 | W |
| E8.3 | MUST | R2 | I6 | W |
| E8.5 | MUST | R2 | I6 | U (perf) |
| E8.6 | MUST | R2 | I6 | W |
| E8.7a | MUST | R2 | I6 | W |
| E8.7b | MUST | R2 | I6 | W |
| E8.7c | MUST | R2 | I6 | U |
| E8.7d | SHOULD | R2 | I6 | W |
| E8.8 | MUST | R2 | I6 | W |
| E8.9a | MUST | R2 | I6 | B |
| E8.9b | SHOULD | R2 | I6 | W |
| E8.11 | MUST | R1 | I6 | B |
| E8.12 | MUST | R1 | I6 | U, W |
| E8.13 | MUST | R1 | I6, I8 | B, W |
| E8.14 | MUST | R2 | I6 | W |
| E8.15 | MUST | R2 | I6 | W |
| E8.16a | MUST | R2 | I6 | W |
| E8.16b | MUST | R2 | I6 | W |
| E8.16c | MUST | R2 | I6 | W |
| E8.17 | MUST | R1 | I6, I7 | W, B |
| E8.18 | MUST | R1 | I6, I1 | W, U |
| E9.1 | MUST | R2 | I10 | W |
| E9.3 | MUST | R1 | I10 | U |
| E9.4 | MUST | R1 | I9 | B |
| E9.5 | MUST | R2 | S | E |
| E9.6 | MUST | R2 | I9 | B |
| E9.7 | SHOULD | R2 | I10 | W |
| E9.8 | MUST | R1 | I10 | B |
| E9.9 | MUST | R1 | I10 | B |
| E9.10 | MUST | R1 | I10, I1 | B |

### 8.3 Removed in round 2

Nothing disappears silently. Every criterion that was deleted, replaced or folded
in this revision is listed here with its reason.

| AC | Disposition | Reason |
|---|---|---|
| E3.10 | **deleted** | "every output agrees to 1e-9 on two devices, debug and release" demands bit-agreement from transcendental functions across ARM64 and x86_64 libm and across AOT and JIT; it duplicates E7.1a's tolerance, which is stated per fixture on one platform with a cross-platform allowance. |
| E8.4 | **deleted** | Its only machine-checkable content was "no `INTERNET` permission", which is E8.1; the rest is not provable from inside the app. Privacy is now E8.13 (dependency check + privacy screen + the no-third-party-request test). |
| E8.10 | **deleted** | "used in direct sunlight" has no protocol and duplicated E8.7c, which computes the same contrast ratios from the theme tokens in both themes. |
| E5.9 | **deleted** | A LATER that would link out to the predecessor's teaching inside a clean-room successor — the fastest way to turn a respectful project into an accusation, for zero product value. L-09 records it. |
| E1.7 (old text) | **replaced** | The old criterion demanded byte-identical persistence "including field order and float representation": a serialiser property that blocks every legitimate serialiser change and is unsatisfiable alongside unknown-key preservation. Now hash stability plus two published hash fixtures (§4.5.4). |
| E9.3 (old text) | **replaced** | "store copy checked … recorded in the release checklist" was an editorial check with no artifact and no failure mode. E9.3 now asserts that the checklist file exists and every §3.5 item is signed; the editorial check itself is C-01. |
| E3.6 (old text) | **rewritten** | It required "a damper curve" that no document kind held, and a curve model the schema could not feed. It is now the banded estimate of §4.8 with the band computed from input tolerances. |
| E8.7 (old text) | **split** | Five unrelated assertions plus "meeting WCAG 2.2 AA" cannot fail independently. Now E8.7a–d, one assertion each. |
| E8.9 (old text) | **split** | Pseudo-locale and RTL were MUST while no RTL locale ships. Now E8.9a (externalisation, MUST) and E8.9b (pseudo-locale + RTL, SHOULD), both R2. |
| E8.16a–c | **added** | A-07, A-08 and A-09 lived in §5.4 with no AC at all, so three accessibility rules were invisible to the audit. Listed here so a reader does not hunt for an earlier E8.16a. |
| E1.4 (old text) | **rewritten** | It promised that entering FL "writes" FR while rule 3 forbids defaults. Now: with `symmetry: true` the right corner is derived at load with `derived_by_mirror` provenance and never stored; with `false` it must be entered. |
| E1.2, E1.8, E1.9, E2.4 (old text) | **rewritten** | They carried three contradictory absence policies in prose. The behaviour is now the `on_absence` column of §4.2.1/§4.3.1 and the tests are generated from it (E9.10). |
| E7.1 (old text) | **split** | It claimed export/import equality for "a model or setup" while a setup cannot even be opened without its model. Now E7.1a (model) and E7.1b (setup, including the model-absent path). |
| E9.8 (old text) | **rewritten** | It depended on a `spec_audit` tool that no AC required: a circular gate. E9.8 now asserts every named stage exits 0 and that a stage with no AC fails the audit, and each stage has its own AC (E8.1, E8.13, E9.4, E9.9, E9.10). |
| E7.3 | **folded into E7.1a** | "the export carries `schema_version`, app version, provenance, assumptions" is an assertion about a round-tripped file, and E7.1a is that file's test. |
| E7.9 | **folded into E6.5** | "refuse a binary database or an installer" is a rejection case; E6.5 is the rejection test, and it now names the foreign-artifact path explicitly. |
| E8.1 (old text) | **rewritten** | It asserted the *absence of an Android permission* — "the merged manifest declares no `INTERNET`" — an artefact that no longer exists. The property it protected survives as a stronger one: the app completes every path with the network disabled, and the gate fails on any off-origin request in the bundle (D-19). |
| E8.11 (old text) | **rewritten, and re-markered SHOULD/R2 → MUST/R1** | "AAB ≤ 25 MB / installed ≤ 60 MB" measured an artefact that does not exist. Replaced by D-21's three budgets (350 KB gzipped JS, 2 MB cached, 100 KB per document). The marker moved because D-21 makes the budget a release gate and the build job fails above it; a SHOULD that fails CI is a contradiction. |
| E8.13 clause (c) | **SUPERSEDED by D-19** | The Play data-safety declaration cannot be submitted because there is no store. Its substance is now E8.13(b)'s Privacy screen plus the new clause (c): no third party is contacted at all. Recorded as C-06 in §3.5. |
| E6.2 clause (b) | **rewritten** | The `ACTION_VIEW` intent cannot exist: a web app is not the handler for a tapped `.json`. Replaced by the three entry points a browser can drive — file picker, drag-and-drop, paste (D-22). |
| E8.5 (old text) | **rewritten** | It budgeted a cold start to an interactive screen at 2.0 s, which on the web is a download measurement and not a start-up one. Now a warm start; first load is E8.11's business. |
| E8.12 (old text) | **rewritten** | It asserted a kill between a temp-file write and a rename. There are no files; the equivalent boundary is a storage transaction, tested by aborting one and by closing the tab mid-save. |
| E3.12 (old text) | **rewritten** | p50 ≤ 16 ms / p99 ≤ 25 ms were Dart-AOT numbers measured on a native widget tree. D-21 replaces them with 8 ms p50 / 16 ms p95, provisional until measured on the reference phone. |
| E8.6, E8.7a, E8.7b (old text) | **rewritten** | Device and SDK language replaced by a browser matrix and CSS px; "text scale 2.0" replaced by the two mechanisms a browser actually has (200% zoom, and a 32 px root font). |
| E9.8 (old text) | **rewritten** | The gate command and two stage names changed with the stack: `typecheck` for `analyse`, `offline` for `manifest`. The stage count and the one-command contract are unchanged. |
| E8.17, E8.18 | **added** | D-19 adds two capabilities no earlier criterion covered: installation to a home screen (which is what exempts the library from Safari's seven-day eviction) and the storage-durability promise that depends on it. Listed here so a reader does not hunt for an earlier instance. |
| E9.2 | **folded into E9.10** | "one fixture per schema version, adding a version without a fixture fails" is a build gate; E9.10 clause (d) is the same assertion with seeded-failure semantics. |
| E2.12 (planned) | **folded into E1.13** | One process-death criterion covers the worksheet draft and the setup working copy; two criteria would share one mechanism and one test. |
| E1.14 (planned) | **folded into E9.10** | The `fields.yaml` completeness check is a build gate, and the round-2 rule is one AC per gate. |
| E9.11 (planned) | **folded into E8.1** | The manifest gate is the only place "no `INTERNET` permission" is asserted; two criteria for one check would allow one to pass while the other failed. |
| E6.3, E6.6, E2.5, E2.6, E2.7, E4.2, E4.4, E4.5, E7.4, E7.5, E7.6, E7.11, E8.2, E8.3, E8.5, E8.6, E8.8, E8.11, E8.14, E8.15, E9.1, E9.5, E9.6 | **moved to R2** | Not deleted: retain their ids and their content, and do not block v1. Each was cut because v1 is capped at 49 MUSTs (R0's 8 plus R1's 41) and these are the ones a first release can ship without while staying honest. |

### 8.4 What the audit checks

E9.9 and E9.10 together enforce, mechanically, the four properties this section
claims: every MUST id appears in at least one test annotation; every annotation
resolves to an AC with the same tag and release marker; no LATER AC has a test;
and every output id in §4.4, every field in the two field tables and every gate
stage in E9.8 has a corresponding AC. The tables above are hand-checked at this
revision and are machine-checked from the first commit.

---

## 9. Evidence base, and what it changed

The corpus was read as evidence of what users ask for and what vocabulary they
use, never as a source of sentences. Files read for this version:

- `docs/intent.md` — complete.
- `AGENTS.md`, `docs/review-rules.md`, `docs/LICENSING.md`, `DEDICATION.md`,
  `docs/research/README.md` — complete.
- `docs/reviews/round1/CONSOLIDATED.md` and the four round-1 reports — complete.
- `docs/research/handbook/science-of-setup-index.md` — complete; supplied the
  chapter vocabulary (weight transfer, overall suspension stiffness, camber and
  camber gain, roll centre and camber gain, ackermann, shocks) that §4.4 follows.
- `docs/research/forum/rctech-thread.md` — searched across 494 posts for
  *measure, arm movement, unsprung, roll center/centre, print, import, export,
  model, setup sheet, camber link, droop, shim, screenshot, database, mac,
  tablet, compare, slider, graph, tyre, diff height*; excerpts read in full.
- Transcripts read in whole or in substantial part (7 of the 56 available):
  `RC3 V4.3.2 Intro`, `MTC2 Setup Features`, `SetupCharts`,
  `Touring Car Steering Setup`, `Laser Setup System Demo`,
  `MTC2 Roll Center Testing Part 1`,
  `Episode 8 - RC3 Acceleration Simulation Validation`.

What the evidence changed in this spec:

1. **Mobile-first is not a nice-to-have.** Phone and tablet access was the most
   requested capability in the whole thread, and the author's own answer was
   remote-desktopping into a Windows machine left running at home. That is the
   user need behind E8.1–E8.6.
2. **Measurement guidance is a first-class feature, not help text.** The same
   measurement questions recur for a decade ("how do I measure the arm movement
   value?", "how do I figure sprung/unsprung?"), including a detailed worked
   method for weighing unsprung mass. Hence E1.5, E1.10 and the requirement that
   every input has a "how do I measure this" entry (E5.2), and it is why CG
   height is an inference with a published procedure rather than a measurement
   nobody can take.
3. **Live, quantified deltas are the feature that made the tool teach.** The
   later versions added charts that update as a value is changed, compare against
   a selected baseline, and quantify *how much* of a change was made, with the
   ability to isolate one effect. That is E3.12, E4.1–E4.6, and it is why the
   performance budget exists at all.
4. **Overwriting a known-good setup is a documented failure.** The author warns
   users that saving after experimenting overwrites the setup the graphs were
   comparing against. Hence E2.2, E2.7 and the baseline concept in E4.5.
5. **Printing and notes are how the track session actually works.** Requests for
   a one-page summary and for separate track/setup/tyre notes recur. Hence E7.4,
   E2.8, and the optional conditions block (surface, temperature, humidity, tyre,
   motor) that E4.9 warns about when two sheets disagree.
6. **Export anxiety is real.** Users were told to back up the database and export
   models as text because a glitch would lose their work; schema changes were
   resisted for fear of data loss. Hence E7.1a–E7.6, §4.5's canonical form and
   the migration fixtures in E9.10.
7. **The gaps are documented, so v1 names them.** Tyre behaviour is absent by
   design, the diff-height torque effect was explicitly declined, ackermann was
   never modelled as a handling influence, and droop limits sat outside the
   charts because they depend on the handling condition. §6 and E5.5 carry each
   of those forward explicitly rather than letting users discover them.
8. **Library growth was the author's own biggest problem** — he could not get his
   hands on every chassis. That is why the contribution path and the review bar
   (D5) are specified rather than assumed, and why a shared sheet must carry its
   attribution (E7.12) rather than lose it on the way.
9. **The vocabulary of a driver's report is understeer/oversteer, at a phase.**
   The corpus talks about the car "pushing" at entry or "loose" off the corner,
   never in the app's own terms. That is why E2.13 normalises push/loose into
   understeer/oversteer, insists on a phase, and requires every inferred claim to
   say "all else equal".

---

## 10. What changes at v0.3

- Round 2 verification (`R2-V`): a fresh critic recomputes the corrected
  roll-centre sensitivity table, the mirror case and the canonical hash fixtures,
  and re-checks every AC in §3 against the testability bar.
- `docs/specs/plan.md`: a per-epic effort estimate and build order starting from
  Slice 0 (§2.3), with the R1 MUST set as the plan's fixed scope and the R2 set as
  its backlog.
- `docs/specs/fields.yaml` written and the §4.2.1/§4.3.1 tables regenerated from
  it, so E9.10 has something to compare against.
- The three documents that must agree with this one — `physics/01` (frame and
  units), `architecture.md` (the one conversion boundary, `npm run gate`) and
  `docs/design/screens.md` (the `inferred` tier, the model-missing state, the
  conditions warning) — reconciled against §4 and §2.
- Answers to O-1, O-2 and O-4 recorded in §7.1, and the damping-ratio field set
  frozen before the R1 freeze.
