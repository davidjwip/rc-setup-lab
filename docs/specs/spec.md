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
validation state (E3.16, D-11).

---

## 1. Product statement and primary user

### 1.1 Product statement

Setup Lab is a free, offline, cross-platform workbench that turns a set of
caliper measurements into the suspension numbers that explain how an RC car
will behave, and shows the arithmetic behind every one of them. A racer measures
their chassis once — hardpoints, springs, bars, damper settings — and the model
is kept for as long as they keep the app: no installer, no database engine, no
account, no server, no subscription. From that model and a setup, the app
computes the properties that connect a setup change to a handling change —
motion ratio, wheel rate, ride frequency, roll stiffness, lateral load-transfer
split, roll-centre height and migration, camber gain, bump steer, and (from v1.1,
§4.8) damping ratio — displays each as a value with its units, its equation, its
inputs and its validity state, lets the racer put two setups side by side and see
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

**The cut line, in one sentence: v1 (R1) is the Android release that measures a
car, keeps it forever as a file, computes the nine geometry-and-balance outputs
with an honest state on each, compares two setups, and shares files with their
attribution intact — every other criterion in §3 is R2 and does not block that
ship.**

Every acceptance criterion in §3 carries a **Release** marker. The markers are
mutually exclusive and mean exactly this:

| Marker | Meaning | Blocks |
|---|---|---|
| **R0** | Slice 0 (§2.3): one screen, a complete example model, three live outputs, an input the user can move, the equation behind each. | The first usable artefact. R0 is a subset of v1. |
| **R1** | The rest of v1: the first Android store submission. **35 MUSTs**, which with R0's 8 makes 43 MUSTs in v1. | The v1 release. |
| **R2** | v1.1 and later: everything not cut into v1. MUSTs here are commitments to a named later release, not to v1. | Nothing in v1. |

### 2.1 In v1

Suspension **geometry and balance**: every property that follows from hardpoint
positions, masses, spring rates and bar rates. Concretely: motion ratio, wheel
rate, ride frequency, roll stiffness, load-transfer split, roll-centre height and
migration, camber gain, camber at roll, bump steer, and the static toe readout.
Plus the model library, setup versioning, comparison, explanations, import and
export with attribution, and the measurement guidance that makes the model
possible.

**Static damping ratio is not in v1.** D-12 named it, but
`CONSOLIDATED.md` §3 (findings C1/C2) shows the data model has no damper curve and
the physics needs dyno-only constants. E3.6 is therefore an **R2 MUST** and §4.8
records the three options for the owner. This is the one place where this
revision does not do what D-12 says, and it is flagged in §7.2 rather than
decided here.

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
| Flutter, Android first (D-10) | Every numeric input must be usable on a 320 dp-wide touch screen with no keyboard-hover. v1 ships Android only; iOS is deferred with no date. No AC may require an Apple-only capability; where the old text did, the Apple clause moved to R2 or was deleted (§8.3). Desktop and web are later renderings of the same screens (E8.6). |
| Offline-only, no accounts, no backend | Model sharing works through the OS share sheet and files, so the file format *is* the community feature (E6.4, E7.1a/b). There is no server to fix a bad model, so validation is local and strict (E6.5). A setup that arrives without its model must therefore have a real local path (§4.6, E6.9). |
| Human-readable versioned JSON with per-value provenance | The format is a public interface from day one; schema changes need migrations and fixtures (E9.10), and every value needs a source or the format is a lie (E1.3). The canonical form is pinned by reference to RFC 8785 (§4.5) so two implementations agree. |
| Physics in a pure Dart package | The UI cannot compute; it can only present. Anything the user sees must be obtainable from a function a headless test can call (E3.11, E3.16). SI lives inside the package only, at one conversion boundary (§4.1 rule 1). |
| Free forever | No paid tier, no telemetry-funded tier, no ad SDK — which removes a whole class of "how do we see usage" features and replaces them with the instrumented usability test (E9.5, R2) and the dependency check (E8.13). |
| Clean-room | Explanation text is written by us and mechanically checked against the research corpus (E5.4, E9.4). This is a build-time gate, not a promise. |
| ISO 8855 frame (R-1) | x forward, y **left**, z up, origin on the ground plane at the rear axle centre. Per-wheel quantities are per-wheel signed and negated on mirroring; car-level quantities are never signed per side. Every hardpoint in every document is re-derived once. |
| mm/g/deg on disk (R-2) | The file is what a caliper and a setup sheet produce; the physics adapter converts to SI at exactly one site and a `|coordinate| > 3000 mm` guard catches a metre value (E3.8's property test covers the guard). |
| Validity state on every number (D-11) | A computed value is never shown bare. Every surface, including every export, carries the state from §4.4.1 (E3.16). |
| One gate command (D-09) | `cd app && dart run tool/gate.dart` is the only entry point CI runs, and every stage it runs has its own AC here (E9.8). No gate may depend on a tool that no AC requires. |

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
`COMPUTED_ASSUMED`, names the field and shows the assumed value; `REFUSE` → the
output carries `REFUSED`, names the field and shows no number; `OMIT` → the
output carries `COMPUTED_INCOMPLETE` and names the field. The test is generated
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
with `req: yes` and `worksheet: yes` in `docs/specs/fields.yaml`, each appearing
in exactly one step; (b) each step displays the `datum` string recorded for that
field in the YAML, character for character; (c) each step's illustration asset
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
ARM64, and in both debug and release builds. A serialiser rewrite is allowed to
change nothing about this test. **MUST** · **R1**

**E1.8** — *Given* a model with no unsprung mass recorded (the field's
`on_absence` is `ASSUME(0 g)`), *when* analysis runs, *then* every output that
consumes it carries `COMPUTED_ASSUMED`, the assumed value `0 g` and the field
name are visible on screen, both are present in every export, and both disappear
from every output the moment the field is recorded. **MUST** · **R1**

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
overwritten. **MUST** · **R1**

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
prescribes — `ASSUME` with the assumed value shown, `REFUSE` with the field
named, or `OMIT` with the field named as not included. The test is generated from
that column; the phrase "assumes …" and the phrase "not computable" are distinct
strings and a test asserts they never appear for the same state. **MUST** · **R1**

**E2.5** — *Given* the setup screen, *when* the user inspects any field, *then*
the field shows either the output names in its `consumed_by` list from
`docs/specs/fields.yaml`, or the exact string "reference only — not used in the
maths"; the test iterates every setup field and fails on any field that shows
neither, or whose displayed output names differ from the YAML. **MUST** · **R2**

**E2.6** — *Given* a 320 dp device, *when* the test drives the real route stack
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

---

### Epic E3 — Computation and analysis

The physics is the product. The criteria here are about the numbers being right,
being explainable, being honest when the geometry breaks them, being honest about
how much they have been checked, and arriving fast enough to be dragged.

**E3.1** — *Given* a model with both corners of an axle measured, *when* analysis
runs, *then* motion ratio (dimensionless) and wheel rate (N/mm) are reported per
corner, each separately from the spring rate so a spring change and a geometry
change can be told apart; *and given* a `upper_link.type: "single_link"` corner
with one inboard point (the touring-car case), *then* the motion ratio is finite
and no `UNDEFINED(coincident hardpoints)` is returned, while a
`type: "wishbone"` corner with two distinct inboard points returns its own finite
value. Both cases are golden tests. **MUST** · **R0**

**E3.2** — *Given* a model and setup that are `complete_for` each of ride
frequency, roll stiffness and load-transfer split (every field in the output's
`consumed_by` closure present, or `ASSUME`), and a stated lateral acceleration,
*when* analysis runs, *then* ride frequency (Hz) per axle, roll stiffness (N·m per
degree) per axle, and the lateral load-transfer split (percent carried by the
front axle) are reported with units and the lateral g used displayed next to
them; *given* any field in one of those closures is absent with `on_absence:
REFUSE`, *then* that output alone is `REFUSED` naming the field and the other two
still compute. **MUST** · **R1**

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

**E3.6** — *Given* a model, a setup and a damper document (§4.8, **not part of
v1**), *when* analysis runs, *then* damping ratio is reported per corner at the
stated low and high shaft speeds, with both speeds displayed and the damper
document's provenance named; *given* no damper document, *then* damping ratio is
absent from the output list rather than shown as a number, an assumption or a
dash. This criterion is written against an option the current data model does not
yet support; §4.8 names the three candidate options and §7.2 asks the owner to
pick one. **MUST** · **R2**

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

**E3.11** — *Given* `app/packages/setup_physics/test/golden/*.json`, *when* the
golden suite runs, *then* each file has keys `output_id`, `inputs`, `expected`,
`tolerance`, `source_kind` ∈ {`published_equation`, `cited_worked_example`,
`hand_calculation`} and `source_ref`; a `hand_calculation` requires a file under
`docs/specs/physics/` that exists and contains the `expected` value as a string; a
`cited_worked_example` requires a path under `docs/research/` plus a page or
timestamp locator; every output id in §4.4 has at least one file; and a run with
the implementation deliberately perturbed by 1% fails at least one assertion,
proving the values are not the code's own output. **MUST** · **R0**

**E3.12** — *Given* the reference device (§5.2) in a release build, *when* the
timing harness performs 1,000 recomputes of the complete example model, *then*
p50 ≤ 16 ms and p99 ≤ 25 ms; *and when* the user drags one slider continuously for
10 s (600 frames, the first 30 excluded as warm-up), *then* ≥ 95% of frames are
presented within 16.7 ms and no frame exceeds 32 ms. The pre-release proxy is the
same harness on the CI emulator with p50 ≤ 40 ms and p99 ≤ 80 ms, and the release
checklist records the reference-device numbers. **MUST** · **R1**

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
the view's widget tree. **MUST** · **R1**

**E4.2** — *Given* two setups that differ only in `corners.fl.spring_rate`
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
the example model's stored values. **MUST** · **R1**

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

**E5.6** — *Given* the release build, *when* the string audit runs over the
localisation bundle and the widget tree of every screen, *then* no user-facing
string matches
`(?i)\b(grip score|handling score|balance verdict|best setup|faster|lap time)\b`,
every directional string on the analysis, compare and concept screens resolves
from the `<output_id>.direction.<rising|falling>` templates, and adding one
free-text handling claim fails the audit naming the string key. **MUST** · **R1**

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
harness can drive (file picker, `ACTION_VIEW` intent, share-sheet target), *when*
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

**E6.4** — *Given* a model or setup, *when* the user shares it, *then* the OS share
sheet is offered with a single self-contained JSON file, the app performs no
network request to complete the share, and the share preview names every personal
field in the file (`sources.<id>.by`, `contributors[].name`) and the licence id,
so the user knows what is leaving the device. **MUST** · **R1**

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
leaves any file outside the app untouched. Each of (a)–(f) has its own widget
test. **MUST** · **R1**

---

### Epic E7 — Import, export and durability

The file format is the community's memory. If a user cannot get their work out
in a form that outlives the app, the app has failed at the only thing the
original could not do.

**E7.1a** — *Given* a model file, *when* it is exported, imported on a second
device or emulator, and a setup is computed against it, *then* the imported
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
one: bright sun, gloves, one hand, no signal, no charger. v1 ships Android only
(D-10), so every criterion here is written against the Android artifact; Apple
clauses are R2 by construction.

**E8.1** — *Given* the built Android artifact, *when* the gate's manifest stage
inspects the merged manifest, *then* it declares no `INTERNET` permission and a
`minSdkVersion` of 26 or higher, and adding
`<uses-permission android:name="android.permission.INTERNET"/>` to the manifest
makes the stage exit non-zero naming the permission. iOS entitlements are not
asserted in v1 (D-10). **MUST** · **R1**

**E8.2** — *Given* a device or emulator in airplane mode with no SIM and no Wi-Fi,
*when* an integration test drives model → setup → compute → compare → explain →
export, *then* every step reaches its own assertion (each named in the test) and
no step blocks on a network call. **MUST** · **R2**

**E8.3** — *Given* a first launch, *when* the app opens, *then* no account, login,
email address or personal detail is requested at any point, and the analysis
screen is reachable without entering anything about the user; the test drives the
first-run flow and fails on any text field that collects personal data.
**MUST** · **R2**

**E8.5** — *Given* the reference device, *when* the app is cold-started to an
interactive analysis screen, *then* it takes ≤ 2.0 s, and opening a stored model
takes ≤ 300 ms, measured by an automated test on the release build.
**MUST** · **R2**

**E8.6** — *Given* a device running Android 8.0 (API 26) or later, *when* the app
runs, *then* every screen is usable from 320 dp to 1024 dp wide, in portrait,
landscape and split view, with no horizontal scrolling and no clipped value on
the analysis screen at 320 dp; the test walks every route at 320, 411 and 1024 dp.
**MUST** · **R2**

**E8.7a** — *Given* every route at 320 dp, *when* the test walks the semantics
tree, *then* every tappable node reports a size ≥ 44×44 dp and ≥ 8 dp from its
nearest tappable neighbour. **MUST** · **R2**

**E8.7b** — *Given* text scale 2.0, *when* every route is rendered, *then* no text
node's painted bounds exceed its parent's, and every output value on the analysis
screen has non-zero painted height and its full string present in the semantics
tree (so a value clipped to "12." fails). **MUST** · **R2**

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
unlabelled; asserted by reading the semantics tree on the analysis, compare and
concept screens. **MUST** · **R2**

**E8.9a** — *Given* the release build, *when* the externalisation check runs inside
the gate, *then* every user-facing string resolves from the localisation bundle,
no string is assembled by concatenation (asserted by a lint rule on string
interpolation inside user-facing widgets), and adding a literal user-facing
string fails the check naming the file and line. **MUST** · **R2**

**E8.9b** — *Given* a pseudo-locale that expands every string by 40% and an RTL
locale, *when* every route is rendered, *then* no text is clipped, no number or
unit is misformatted, and no layout overlaps. **SHOULD** · **R2**

**E8.11** — *Given* the release artifacts, *when* their sizes are measured, *then*
the Android App Bundle download for a phone is ≤ 25 MB and the installed footprint
is ≤ 60 MB, with the figures and the measuring command recorded in the release
checklist (E9.3), and a CI size-diff job warns when a change adds more than 1 MB.
**SHOULD** · **R2**

**E8.12** — *Given* a save in progress, *when* the process is killed at the write
boundary, *then* the previously saved version is intact and readable on next
launch, and no partially written file is ever offered as valid; the test kills
the process between the temp-file write and the rename for each document kind.
**MUST** · **R1**

**E8.13** — *Given* the shipped Android artifact and the app's screens, *when* the
dependency check and the privacy test run, *then* (a) the resolved dependency set
contains no package whose declared purpose is analytics, advertising or crash
reporting, and adding one to `pubspec.yaml` makes the check exit non-zero naming
the package; (b) a Privacy screen is reachable in two taps from the about screen
and its exact text equals `docs/release/privacy.txt`; (c) the Play data-safety
declaration for the submitted version is recorded in `docs/release/checklist.md`
with its public URL. **MUST** · **R1**

**E8.14** — *Given* a save that fails (storage full, permission revoked, write
interrupted), *when* it fails, *then* the failure is reported on the field being
saved with a retry affordance that retries that row only, no other value is lost,
and the previous revision remains current; asserted with a mocked filesystem that
fails the second write. **MUST** · **R2**

**E8.15** — *Given* a corrupt or unreadable file in the library at launch, *when*
the app opens, *then* the file is moved to a quarantine directory, named in a
single notice with its path, and the rest of the library opens normally.
**MUST** · **R2**

**E8.16a** — *Given* every slider and drag-based input, *when* the test opens its
stepped alternative, *then* each offers a numeric field or ± step buttons that
produce the same values as the drag, reachable in one tap (A-08).
**MUST** · **R2**

**E8.16b** — *Given* a switch-access or hardware-keyboard session, *when* the user
traverses the analysis screen, *then* focus order equals the reading order of the
semantics tree and every interactive element is reachable and operable (A-07).
**MUST** · **R2**

**E8.16c** — *Given* the system "remove animations" setting, *when* it is on,
*then* no non-essential animation runs, and no content flashes more than three
times per second in either setting (A-09). **MUST** · **R2**

*E8.4 (deleted, duplicate of E8.1) and E8.10 (deleted, duplicate of E8.7c) — see
§8.3. The former E8.7, E8.9 and E8.16 are split into a/b/c/d as the critic
proposed.*

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
minutes, measured from app install to the first analysis screen with all four
corners measured; (b) each participant, shown a camber-link shim change and a
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
computed from `app/assets/models/*.json`. **MUST** · **R2**

**E9.7** — *Given* a user who has found a problem, *when* they look for a way to
report it, *then* a route that requires no account is offered (a mail link or an
issue tracker link) and it is reachable from the about screen. **SHOULD** · **R2**

**E9.8** — *Given* the release commit, *when* `cd app && dart run tool/gate.dart`
runs in CI, *then* every stage exits 0 and the stages are exactly: analyse, test,
spec audit (E9.9), schema and fixtures (E9.10), IP and overlap (E9.4, E5.4),
manifest (E8.1), dependency and privacy (E8.13), string audit (E5.6); a stage that
exists in `gate.dart` without a corresponding AC here fails the spec audit, and a
stage that is named here but absent from `gate.dart` fails the gate. The gate
runs on every pull request and its output is pasted in the PR (AGENTS.md).
**MUST** · **R1**

**E9.9** — *Given* the repository, *when* the gate's spec-audit stage runs, *then*
it exits 0 only if every MUST id in §3 appears in at least one
`@SpecTest('<id>')` annotation in a test file, every `@SpecTest` id exists in §3
with the same tag and release marker, and no LATER-tagged AC has a test; deleting
one `@SpecTest('E3.3')` annotation, adding an unknown id, and annotating a LATER
id each make the stage exit non-zero naming the id, and each is a separate
seeded-failure test in the gate's own suite. **MUST** · **R1**

**E9.10** — *Given* `docs/specs/fields.yaml`, the JSON schema and the fixture
directory, *when* the gate's schema stage runs, *then* it fails unless: (a) every
field of §4.2.1 and §4.3.1 appears in the YAML exactly once with `type`, `unit`,
`req`, `on_absence` ∈ {`ASSUME`, `REFUSE`, `OMIT`}, an `assume` value where the
policy is `ASSUME`, `plausible`, and `consumed_by`; (b) every `consumed_by` id
exists in §4.4; (c) the Markdown tables in §4.2.1 and §4.3.1 are identical to what
the YAML generates; (d) there is one fixture per `schema_version` the app writes,
and each fixture either loads or is refused with a named reason. Seeded failures
are four separate tests: delete one `on_absence`, point a `consumed_by` at an
unknown output, change one Markdown cell, and add a schema version with no
fixture — each must exit non-zero naming the defect. **MUST** · **R1**

*E9.2 was folded into E9.10 in round 2 — see §8.3.*

---

### 3.5 Release checklist (not acceptance criteria)

These are editorial and observational. They are not ACs because they cannot fail
in a test; they are enforced by E9.3, which asserts the checklist file exists and
is complete.

| # | Item | Evidence |
|---|---|---|
| C-01 | Store listing title, description, screenshots and keywords checked against the clean-room rule (was E9.3's content) | the listing text and screenshot set, reviewed, in `docs/release/` |
| C-02 | Artifact sizes measured and recorded (E8.11) | the `bundletool`/`aapt` output pasted into the checklist |
| C-03 | Continuous 30-minute session on the reference device: no thermal frame-rate drop, ≤ 5% battery (P-10) | the session log |
| C-04 | Reference-device performance numbers for E3.12 pasted from the harness | harness CSV |
| C-05 | The three-user usability session (E9.5, R2) — each participant's run file linked | `docs/specs/eval/run-<date>.md` |
| C-06 | Play data-safety declaration submitted, its public URL recorded (E8.13c) | the Play console confirmation |
| C-07 | Every MUST id in the release marker R1 has a green test in the gate output pasted in the release PR | the PR body |

---

## 4. Data model

Two document kinds in v1 — car model and setup — plus a third described but not
shipped (§4.8). All are plain JSON, all carry `schema_version`. They are the
app's public interface: a setup or a model that leaves the device must be
readable, validatable and re-importable by a future version of the app and by a
person with a text editor.

**§4.2 is the single normative definition of the on-disk schema.** No other
document defines field names, units or the frame; `docs/specs/physics/01` §4
defers to this section and keeps only derived quantities and validation rules.

### 4.1 Rules that apply to both documents

1. **Units are declared in the file, not implied, and keys never carry a unit
   suffix.** A `units` object declares one unit per dimension in use:
   `length, angle, mass, spring_rate, damper_force, damper_speed, viscosity,
   pressure, temperature, ratio, count, percentage`. This build writes lengths in
   **mm**, angles in **degrees**, masses in **g**, spring rates in **N/mm**,
   damper forces in **N at a shaft speed in m/s**, and every field name names the
   quantity (`air_temp`, not `air_temp_c`). R-2: **SI exists only inside the
   physics package, at exactly one conversion boundary** — the adapter that turns
   a document into the typed model. No arithmetic is ever performed on a
   storage-unit value, and the adapter rejects any coordinate whose modulus
   exceeds **3000 mm** as a suspected metre value (E3.8's property test covers
   the guard with both units).
2. **Every numeric value is an object, not a bare number:**
   `{"v": <number>, "s": "<source id>"}`, where `s` resolves into the document's
   top-level `sources` map. One source id can be shared by many values (a whole
   caliper session is one source), which keeps files readable and provenance
   honest at the same time. Integers are written without a fractional part only
   where the field's `type` is `count`; every other numeric field is a real
   number.
3. **Absence has exactly one policy per field, and never a silent default.** A
   field that is not measured is **omitted**. It is never written as `0`, `null`
   or a sentinel. Every field in §4.2.1 and §4.3.1 carries a mandatory
   `on_absence` attribute with one of three legal values, and the loader and the
   analysis obey that value and nothing else:

   | `on_absence` | Meaning | What the user sees |
   |---|---|---|
   | `ASSUME(value)` | The output is computed with the stated value. | The output carries `COMPUTED_ASSUMED`, names the field and shows the value; the value appears in the assumptions block (E5.5) and in every export. |
   | `REFUSE` | The output is not computable. For a document-envelope field, the document itself is refused (E6.5). | The output carries `REFUSED`, names the field and shows **no number, no dash, no unit**. |
   | `OMIT` | The output is computed without the field, and the maths does not require it. | The output carries `COMPUTED_INCOMPLETE` and names the field as not included. |

   The three rules that make these agree, and that a test can check (E1.2,
   E2.4, E9.10): (i) every field has exactly one policy and a field with none
   fails the schema stage; (ii) `ASSUME` requires an `assume` value, and that
   value is the only number the app may invent anywhere in the product; (iii)
   `OMIT` is legal only where the field refines a value the maths can produce
   without it, so a consumer that changes the result decisively must declare
   `REFUSE`. "Not measured" and "assumed" are different states with different
   strings (asserted in E2.4).
4. **A source entry must resolve, and must say what kind of evidence it is:**

   | `type` | Meaning | Required extra fields |
   |---|---|---|
   | `measured` | The owner measured this car with a named tool | `method`, `datum`, `by`, `date` |
   | `estimated` | The owner could not measure it and supplied a considered figure | `basis`, `by`, and optionally `tolerance_pct` |
   | `manufacturer` | From a manual, CAD, or published drawing | `ref` |
   | `third_party` | Another person's measurement or a contributed model | `by`, `ref` (may be a handle) |
   | `library` | Copied from another model in the library | `ref` (`<model id>#<field path>`), `by` |
   | `derived` | Computed from other values in the file | `from` (list of field paths), and for `derived_by_mirror`, the mirrored field path |
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

**Frame — ISO 8855, and nothing else (R-1).** Right-handed, **x forward, y to the
LEFT, z up**. Origin on the ground plane (the flat plate the wheels stand on) at
the intersection of the rear axle centreline and the vehicle centreline. So:

- rear contact patches at `x = 0`, front contact patches at `x = +wheelbase`;
- a left-hand corner has **positive y**, a right-hand corner **negative y**;
- every hardpoint is `[x, y, z]` in mm from that origin;
- contact-patch positions are **derived, never stored**: `(0, ±track/2, 0)` and
  `(wheelbase, ±track/2, 0)`, and the loader asserts the stored `wheelbase`
  against the front wheel centres to ±3 mm.

**Per-wheel quantities are per-wheel signed** and are negated on mirroring:
camber positive = **top outboard**; toe positive = **toe-in**. Quantities that
are properties of the car — roll-centre height, load-transfer split — are
frame-free and are **never** signed per side.

```json
{
  "schema_version": "1.0.0",
  "kind": "car_model",
  "id": "mdl_8f2c41",
  "name": "Example 1/10 TC — measured 2026-10-12",
  "class": "touring_car_1_10",
  "units": {
    "length": "mm", "angle": "deg", "mass": "g", "spring_rate": "N/mm",
    "damper_force": "N", "damper_speed": "m/s", "ratio": "1", "percentage": "%"
  },
  "frame": { "standard": "ISO 8855", "axes": "x fwd, y left, z up",
             "origin": "ground plane, rear axle centre" },
  "symmetry": false,
  "license": { "id": "CC-BY-4.0", "url": "https://creativecommons.org/licenses/by/4.0/" },
  "contributors": [ { "name": "D. W.", "role": "measured" } ],
  "attribution_text": "Example 1/10 TC — measured by D. W., 2026-10-12. CC BY 4.0.",
  "meta": { "created": "2026-10-12", "app_version": "0.1.0", "revises": null },

  "sources": {
    "s1": { "type": "measured", "method": "digital caliper 150 mm", "datum": "flat plate, hinge-pin centre",
            "by": "D. W.", "date": "2026-10-12", "note": "car on setup stands, wheels off" },
    "s2": { "type": "manufacturer", "ref": "kit manual p.14, exploded view" },
    "s3": { "type": "measured", "method": "corner scales", "datum": "four pads, ride height 5.0 mm",
            "by": "D. W.", "date": "2026-10-12" },
    "s4": { "type": "derived", "from": ["body.mass.total", "body.mass.unsprung_front", "body.mass.unsprung_rear"],
            "note": "corner weights minus unsprung" }
  },

  "body": {
    "reference_ride_height": { "v": 5.0, "s": "s1" },
    "wheelbase":             { "v": 257.0, "s": "s1" },
    "cg": {
      "height":              { "v": 38.0, "s": "s3" },
      "longitudinal_front":  { "v": 50.5, "s": "s4" }
    },
    "mass": {
      "total":            { "v": 1352.0, "s": "s3" },
      "sprung_front":     { "v": 486.0,  "s": "s4" },
      "sprung_rear":      { "v": 552.0,  "s": "s4" },
      "unsprung_front":   { "v": 157.0,  "s": "s4" },
      "unsprung_rear":    { "v": 157.0,  "s": "s4" }
    },
    "axles": {
      "front": {
        "track":                 { "v": 163.0, "s": "s1" },
        "tyre_radius":           { "v": 31.0,  "s": "s1" },
        "roll_centre_validity":  { "v": 40.0,  "s": "s2" },
        "droop_limit_wheel":     { "v": 6.0,   "s": "s1" },
        "bump_limit_wheel":      { "v": 6.0,   "s": "s1" },
        "arb": { "type": "blade", "rate_at_full_stiff": { "v": 0.42, "s": "s2" } },
        "steering": {
          "rack": { "x": { "v": 88.5, "s": "s1" }, "z": { "v": 14.0, "s": "s1" },
                    "y_left": { "v": 46.0, "s": "s1" }, "y_right": { "v": -46.0, "s": "s1" },
                    "travel_per_turn": { "v": 12.0, "s": "s2" } }
        },
        "corners": {
          "left": {
            "lower_arm": {
              "inboard_front": { "v": [ 18.5,  78.0, 12.0], "s": "s1" },
              "inboard_rear":  { "v": [ 66.5,  78.0, 12.0], "s": "s1" },
              "outboard":      { "v": [128.5,  80.0, 10.5], "s": "s1" }
            },
            "upper_link": {
              "type": "single_link",
              "inboard":  { "v": [ 40.5,  60.0, 38.0], "s": "s1" },
              "outboard": { "v": [126.5,  76.0, 34.0], "s": "s1" }
            },
            "upright": {
              "lower_ball":   { "v": [128.5,  80.0, 10.5], "s": "s1" },
              "upper_ball":   { "v": [126.5,  76.0, 34.0], "s": "s1" },
              "wheel_centre": { "v": [128.5,  81.5, 31.0], "s": "s1" }
            },
            "damper": {
              "lower_mount":  { "v": [ 76.5,  72.0, 15.0], "s": "s1" },
              "upper_mount":  { "v": [ 72.5,  66.0, 62.0], "s": "s1" }
            },
            "spring": { "location": "coilover_at_damper",
                        "rate": { "v": 3.10, "s": "s2" },
                        "free_length": { "v": 20.0, "s": "s2" } },
            "steering": {
              "tie_rod_inboard":  { "v": [ 88.5,  46.0, 14.0], "s": "s1" },
              "tie_rod_outboard": { "v": [120.5,  74.0, 16.0], "s": "s1" }
            },
            "arb_pickup": { "v": [ 84.5,  70.0, 13.0], "s": "s1" }
          },
          "right": {
            "lower_arm": {
              "inboard_front": { "v": [ 18.5, -78.0, 12.0], "s": "mirror:s1" },
              "inboard_rear":  { "v": [ 66.5, -78.0, 12.0], "s": "mirror:s1" },
              "outboard":      { "v": [128.5, -80.0, 10.5], "s": "mirror:s1" }
            },
            "upper_link": {
              "type": "single_link",
              "inboard":  { "v": [ 40.5, -60.0, 38.0], "s": "mirror:s1" },
              "outboard": { "v": [126.5, -76.0, 34.0], "s": "mirror:s1" }
            },
            "upright": {
              "lower_ball":   { "v": [128.5, -80.0, 10.5], "s": "mirror:s1" },
              "upper_ball":   { "v": [126.5, -76.0, 34.0], "s": "mirror:s1" },
              "wheel_centre": { "v": [128.5, -81.5, 31.0], "s": "mirror:s1" }
            },
            "damper": {
              "lower_mount":  { "v": [ 76.5, -72.0, 15.0], "s": "mirror:s1" },
              "upper_mount":  { "v": [ 72.5, -66.0, 62.0], "s": "mirror:s1" }
            },
            "spring": { "location": "coilover_at_damper",
                        "rate": { "v": 3.10, "s": "s2" },
                        "free_length": { "v": 20.0, "s": "s2" } },
            "steering": {
              "tie_rod_inboard":  { "v": [ 88.5, -46.0, 14.0], "s": "mirror:s1" },
              "tie_rod_outboard": { "v": [120.5, -74.0, 16.0], "s": "mirror:s1" }
            },
            "arb_pickup": { "v": [ 84.5, -70.0, 13.0], "s": "mirror:s1" }
          }
        }
      }
    }
  }
}
```

This example is deliberately incomplete: the whole `body.axles.rear` block is
omitted, which rule 3 permits and which E1.2 requires the app to report rather
than fill in. Both front corners are present with `symmetry: false`, so the
example does not depend on any mirroring behaviour to be complete for the front
axle. A `mirror:s1` source id means "the left corner's `s1` value, y-negated":
the loader resolves it to a `derived_by_mirror` source whose `from` names the
left field path. Values are re-derived once from the pre-round-2 frame
(`x_new = x_old + wheelbase/2`, `y_new = −y_old`, z unchanged), so the rear
contact patches sit at `x = 0` and the front at `x = 257`.

#### 4.2.1 Field table — car model

`Req` = required for the document to be valid. `on_absence` = the policy of §4.1
rule 3, applied when the field is absent. Generated from
`docs/specs/fields.yaml` (§4.10); E9.10 fails the build if this table and the
YAML disagree.

| Field | Type | Unit | Req | `on_absence` | Notes |
|---|---|---|---|---|---|
| `schema_version` | string | — | yes | `REFUSE` | `MAJOR.MINOR.PATCH`; a greater major is refused (E6.6) |
| `kind` | string | — | yes | `REFUSE` | `car_model` |
| `id` | string | — | yes | `REFUSE` | Stable, opaque, never reused |
| `name` | string | — | yes | `REFUSE` | Free text, shown in the library |
| `class` | enum | — | yes | `REFUSE` | `touring_car_1_10`, `buggy_1_10_2wd`, `buggy_1_10_4wd`, `truck_1_10`, `other` |
| `units` | object | — | yes | `REFUSE` | One entry per dimension used; a missing dimension refuses the document |
| `frame` | object | — | yes | `REFUSE` | Must equal §4.2's frame exactly |
| `symmetry` | bool | — | yes | `REFUSE` | `true` → the right corner is derived, never stored (E1.4). No default. |
| `license` | object | — | yes | `REFUSE` | `{id, url}`; §4.9 |
| `contributors` | array | — | conditional | `REFUSE` | Mandatory where `license.id` begins `CC-BY`; `[{name, role, contact?}]` |
| `attribution_text` | string | — | conditional | `REFUSE` | Mandatory where `license.id` begins `CC-BY`; the exact string a re-sharer reproduces |
| `sources` | object | — | yes | `REFUSE` | Map of source id → source record (§4.1 rule 4); every `s` must resolve |
| `body.reference_ride_height` | value | mm | yes | `REFUSE` | Datum for all vertical geometry (E1.9) |
| `body.wheelbase` | value | mm | yes | `REFUSE` | Validated against the front wheel centres (±3 mm) |
| `body.cg.height` | value | mm | yes | `REFUSE` | Above the ground plane; load-transfer split only |
| `body.cg.longitudinal_front` | value | % | no | `REFUSE` | Front share of total mass; normally `derived` from corner weights |
| `body.mass.total` | value | g | yes | `REFUSE` | |
| `body.mass.sprung_front` / `.sprung_rear` | value | g | no | `REFUSE` | Ride frequency and roll stiffness need these; absence refuses those outputs only (M1) |
| `body.mass.unsprung_front` / `.unsprung_rear` | value | g | no | `ASSUME(0)` | The only `ASSUME` in the model. Visible flag, on screen and in every export (E1.8) |
| `body.axles.<axle>.track` | value | mm | yes | `REFUSE` | Hub-face to hub-face at static ride height |
| `body.axles.<axle>.tyre_radius` | value | mm | yes | `REFUSE` | Contact-patch height and travel conversion |
| `body.axles.<axle>.roll_centre_validity` | value | mm | no | `OMIT` | Domain bound for E3.9; absent → no domain flag, and the health line says the bound is not recorded |
| `body.axles.<axle>.droop_limit_wheel` / `.bump_limit_wheel` | value | mm | no | `OMIT` | Wheel travel, not shaft travel |
| `body.axles.<axle>.arb` | object | — | no | `OMIT` | Absent → roll stiffness computed without a bar contribution and says so |
| `body.axles.<axle>.arb.type` | enum | — | yes if `arb` present | `OMIT` | `blade`, `fixed`, `torsion_bar`, `none` (§4.3.3) |
| `body.axles.<axle>.arb.rate_at_full_stiff` | value | N/mm at the link | yes if `type` ≠ `none` | `REFUSE` | The blade/fixed form. Refuses roll stiffness for that axle only |
| `body.axles.<axle>.arb.arm_length` | value | mm | yes if `type` = `torsion_bar` | `REFUSE` | Torsion-bar form (§4.3.3) |
| `body.axles.<axle>.arb.setting_table` | array | — | no | `OMIT` | Non-linear blade curve, `[{setting, rate_at_full_stiff}]`; R2 |
| `body.axles.front.steering.rack` | object | — | no | `REFUSE` | `{x, z, y_left, y_right, travel_per_turn}`; refuses bump steer and the Ackermann readout (C3) |
| `…corners.<side>.lower_arm.inboard_front` / `.inboard_rear` / `.outboard` | point | mm | yes | `REFUSE` | Defines the lower hinge axis and the outer ball joint |
| `…corners.<side>.upper_link.type` | enum | — | yes | `REFUSE` | `single_link` (one `inboard` point) or `wishbone` (`inboard_front`/`inboard_rear`) — M3 |
| `…corners.<side>.upper_link.inboard` | point | mm | if `type` = `single_link` | `REFUSE` | The touring-car camber link: **one** inner ball stud, not two coincident ones |
| `…corners.<side>.upper_link.inboard_front` / `.inboard_rear` | point | mm | if `type` = `wishbone` | `REFUSE` | |
| `…corners.<side>.upper_link.outboard` | point | mm | yes | `REFUSE` | |
| `…corners.<side>.upright.lower_ball` / `.upper_ball` / `.wheel_centre` | point | mm | yes | `REFUSE` | `wheel_centre` fixes track and scrub radius |
| `…corners.<side>.damper.lower_mount` / `.upper_mount` | point | mm | yes | `REFUSE` | Eye-to-eye at static ride height defines motion ratio |
| `…corners.<side>.spring.location` | enum | — | yes | `REFUSE` | `coilover_at_damper`, `separate_seat`, `inboard_rocker` |
| `…corners.<side>.spring.rate` | value | N/mm | yes | `REFUSE` | The baseline rate; a setup's per-corner `spring_rate` overrides it (§4.3) |
| `…corners.<side>.spring.free_length` | value | mm | no | `OMIT` | Preload and coil-bind only |
| `…corners.<side>.steering.tie_rod_inboard` / `.tie_rod_outboard` | point | mm | front only | `REFUSE` | Refuses bump steer only; rear toe links use the same shape |
| `…corners.<side>.arb_pickup` | point | mm | no | `OMIT` | The drop-link attachment on the lower arm; without it the bar's link motion ratio is not derived and roll stiffness says so |
| `representation_note` | string | — | no | `OMIT` | Free text, ≤ 500 chars; shown in the share summary (E1.11) |
| `x_*` | any | — | no | `OMIT` | Preserved verbatim on export; part of the hash |

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

```json
{
  "schema_version": "1.0.0",
  "kind": "setup",
  "id": "set_2b91c0",
  "label": "Carpet baseline A",
  "model_ref": {
    "id": "mdl_8f2c41",
    "content_hash": "sha256:6c1f…",
    "name": "Example 1/10 TC — measured 2026-10-12"
  },
  "geometry": {
    "base_hash": "sha256:6c1f…",
    "adjustments": [
      { "field": "corners.fl.upper_link_inner_shims", "v": 1.0, "s": "m1" },
      { "field": "corners.fr.upper_link_inner_shims", "v": 1.0, "s": "m1" }
    ],
    "geometry_hash": "sha256:0a94…"
  },
  "parent_id": null,
  "created": "2026-10-12",
  "meta": { "app_version": "0.1.0" },
  "sources": {
    "m1": { "type": "measured", "method": "camber gauge + toe plates", "datum": "flat plate",
            "by": "D. W.", "date": "2026-10-12" },
    "m2": { "type": "measured", "method": "ride-height gauge", "datum": "flat plate",
            "by": "D. W.", "date": "2026-10-12" },
    "m3": { "type": "third_party", "by": "setup sheet, P. Smith", "ref": "printed sheet, 2026-09" }
  },

  "conditions": {
    "surface": "carpet", "air_temp": { "v": 22.0, "s": "m1" },
    "tyre": { "compound": "handout", "diameter": { "v": 62.0, "s": "m1" } },
    "notes": "club night, fresh surface"
  },

  "corners": {
    "fl": { "camber": { "v": -1.5, "s": "m1" }, "toe": { "v": 0.5, "s": "m1" },
            "caster": { "v": 4.0, "s": "m3" }, "ride_height": { "v": 5.0, "s": "m2" },
            "droop": { "v": 2.0, "s": "m2" }, "spring_rate": { "v": 3.10, "s": "m3" },
            "spring_preload": { "v": 0.5, "s": "m2" },
            "damper_oil_viscosity": { "v": 300.0, "s": "m3" },
            "damper_piston_holes": { "v": 3, "s": "m3" },
            "tyre_pressure": { "v": 240.0, "s": "m2" } }
  },

  "axles": { "front": { "arb_setting": { "v": 0.6, "s": "m3" } },
             "rear":  { "arb_setting": { "v": 0.4, "s": "m3" } } },

  "transmission": { "diff_front_oil_viscosity": { "v": 3000.0, "s": "m3" },
                    "diff_rear_oil_viscosity": { "v": 1000.0, "s": "m3" },
                    "diff_height": { "v": 0.0, "s": "m3" } },

  "analysis_inputs": { "lateral_g": { "v": 1.2, "s": "m1" },
                       "roll_sweep": { "v": 3.0, "s": "m1" },
                       "damping_low_speed": { "v": 0.05, "s": "m1" },
                       "damping_high_speed": { "v": 0.30, "s": "m1" } },

  "notes": { "track": "club layout, clockwise", "setup": "droop 2 mm front, 3 mm rear",
             "tyres": "handout, 2 runs old" }
}
```

Only the front-left corner is shown for brevity; `.fr`, `.rl`, `.rr` use the same
shape, and the two shim adjustments are shown because a shim change is the
canonical case (§4.3.2).

#### 4.3.1 Field table — setup

| Field | Type | Unit | Req | `on_absence` | Consumed by |
|---|---|---|---|---|---|
| `schema_version` | string | — | yes | `REFUSE` | — |
| `kind` | string | — | yes | `REFUSE` | — |
| `id` | string | — | yes | `REFUSE` | — |
| `label` | string | — | yes | `REFUSE` | — |
| `model_ref.id` / `.content_hash` / `.name` | string | — | yes | `REFUSE` | Every output (§4.6 when unresolved) |
| `geometry.base_hash` / `.geometry_hash` | string | — | yes | `REFUSE` | Selects the geometry every output uses (§4.5.3) |
| `geometry.adjustments[]` | array | mm | yes (may be empty) | `OMIT` | Camber gain, roll centre, bump steer, wheel rate (§4.3.2) |
| `parent_id` | string \| null | — | yes | `REFUSE` | History chain (E2.2) |
| `created`, `meta.app_version` | string | — | yes | `REFUSE` | Carried in exports (E7.1a) |
| `sources` | object | — | yes | `REFUSE` | As §4.1 |
| `derived_from_models[]` | array | — | no | `OMIT` | `[{id, content_hash, attribution_text}]` — attribution for a copied sheet (§4.9) |
| `conditions.surface` | enum | — | no | `OMIT` | Reference only |
| `conditions.air_temp` | value | °C | no | `OMIT` | Reference only |
| `conditions.tyre.compound` / `.diameter` | value | mm | no | `OMIT` | Diameter → contact-patch height; absent → the model's `tyre_radius` is used and named |
| `corners.<c>.camber` | value | deg | no | `REFUSE` | Camber at roll; camber gain's baseline |
| `corners.<c>.toe` | value | deg | no | `REFUSE` | Toe at roll; Ackermann readout |
| `corners.<c>.caster` | value | deg | no | `OMIT` | Reference only in v1; shown as such (E2.5) |
| `corners.<c>.ride_height` | value | mm | no | `REFUSE` | Static geometry; roll-centre datum |
| `corners.<c>.droop` | value | mm | no | `OMIT` | Static limits check only |
| `corners.<c>.spring_rate` | value | N/mm | no | `OMIT` | Wheel rate, ride frequency, roll stiffness; absent → the model's `spring.rate` is used and named in the "how" view |
| `corners.<c>.spring_preload` | value | mm | no | `OMIT` | Static ride height / load |
| `corners.<c>.damper_oil_viscosity` / `.damper_piston_holes` | value | cSt / count | no | `OMIT` | Damping ratio only (§4.8, R2); nothing in v1 consumes them |
| `corners.<c>.upper_link_inner_shims` / `.upper_link_outer_shims` | value | mm | no | `OMIT` | Geometry adjustment, §4.3.2 |
| `corners.<c>.wheel_offset` | value | mm | no | `OMIT` | Geometry adjustment, §4.3.2 |
| `corners.<c>.tyre_pressure` | value | kPa | no | `OMIT` | Reference only |
| `axles.<a>.arb_setting` | value | ratio 0–1 | no | `OMIT` | Roll stiffness; a **linear fraction of the link rate** (§4.3.3) |
| `transmission.diff_front_oil_viscosity` / `diff_rear_oil_viscosity` | value | cSt | no | `OMIT` | Reference only in v1 |
| `transmission.diff_height` | value | mm | no | `OMIT` | Reference only; named in the limits block as not modelled |
| `analysis_inputs.lateral_g` | value | ratio | yes | `REFUSE` | Load-transfer split |
| `analysis_inputs.roll_sweep` | value | deg | yes | `REFUSE` | Roll-centre migration table, camber at roll |
| `analysis_inputs.damping_low_speed` / `.damping_high_speed` | value | m/s | no | `OMIT` | Damping ratio only (§4.8, R2) |
| `notes.track` / `.setup` / `.tyres` | string | — | no | `OMIT` | Exported and searchable (E2.8) |
| `x_*` | any | — | no | `OMIT` | Preserved verbatim |

A value the user confirms as zero is written as `{"v": 0.0, "s": …}`; a value the
user never entered is **absent**. For the three geometry adjustments in §4.3.2
absence and an explicit zero have the same physical effect, and the difference is
preserved in the file so the app can say "no shim recorded" rather than
"0 mm shim".

#### 4.3.2 Geometry transform pipeline

Each adjustment is a delta applied to named base points along one named axis, in
one direction, in millimetres, in the order listed. The transform is total and
deterministic: it always produces exactly one geometry, and the derived geometry
is what all outputs are computed from.

| Adjustment | Base points moved | Axis | Direction | Unit | Effect |
|---|---|---|---|---|---|
| `upper_link_inner_shims` | `upper_link.inboard` (single_link) or `upper_link.inboard_front` **and** `inboard_rear` (wishbone), on that corner | vehicle **y** | **positive = outboard** (away from the centreline): `y += sgn(y_corner) · shim` | mm | Changes upper-link length and inboard pivot line → camber gain, roll-centre height |
| `upper_link_outer_shims` | `upper_link.outboard` | vehicle **y** | positive = outboard: `y += sgn(y_corner) · shim` | mm | Moves the upper ball joint outboard → camber, camber gain |
| `wheel_offset` | `upright.wheel_centre` (the contact patch follows) | vehicle **y** | positive = track **increase** per side: `y += sgn(y_corner) · offset` | mm | Track, scrub radius; ball joints do not move |

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
| `blade` or `fixed` | `rate_at_full_stiff` | **N/mm at the drop link**, the stiffness the bar applies at its link at full stiff | divided by the square of the drop-link motion ratio, which is derived from `arb_pickup` and the lower arm; without `arb_pickup` the conversion is not performed and roll stiffness says the bar was excluded |
| `torsion_bar` | `bar_diameter`, `effective_span`, `arm_length`, `shear_modulus` — **R2** | torsional stiffness `k = GJ/L` | same conversion; the fields do not exist in the v1 schema and their absence refuses nothing in v1 because no v1 model declares this type |
| `none` | none | no bar | zero contribution, stated |

`arb_setting` is a **linear fraction of the link rate**: 0 = no contribution from
the bar, 1 = `rate_at_full_stiff`. It is **not** a fraction of blade travel —
that reading differs by tens of percent on a real blade and is the ambiguity the
round-1 review found. A non-linear blade curve is expressible only through
`arb.setting_table` (R2); a model that declares `blade` and omits the table is
linear by definition and the app says "linear bar assumed" in the assumptions
block.

### 4.4 Computed outputs — names, units, inputs, release

Outputs are never stored in a setup file. They are functions of (transformed
model geometry, setup, analysis inputs) and are recorded only in exports, where
they are labelled as derived and carry the state from §4.4.1.

| Output | Unit | Depends on (field paths, §4.2.1/§4.3.1) | AC | Release |
|---|---|---|---|---|
| Motion ratio | – | damper mounts, lower arm, upper link, wheel centre, spring location | E3.1 | R0 |
| Wheel rate ("ride stiffness") | N/mm | motion ratio, spring rate (setup overrides model), spring preload, ARB contribution | E3.1 | R0 |
| Ride frequency | Hz | wheel rate, `mass.sprung_front`/`sprung_rear` | E3.2 | R1 |
| Roll stiffness | N·m/deg | wheel rates, track, `arb.*`, `arb_setting`, `arb_pickup` | E3.2 | R1 |
| Lateral load-transfer split | % front | roll stiffness front/rear, `cg.height`, roll-centre heights, `mass.total`, `analysis_inputs.lateral_g` | E3.2 | R1 |
| Roll-centre height (static) | mm | both arms' inboard points and outboard points, wheel centre, `reference_ride_height` | E3.3 | R0 |
| Roll-centre migration | mm per 0.5° roll | as above, swept over `analysis_inputs.roll_sweep` | E3.3 | R0 |
| Camber gain | deg/deg | upper and lower link geometry, upright, `geometry.adjustments[]` | E3.4 | R0 |
| Camber at roll | deg | camber gain, `corners.<c>.camber` | E3.4 | R0 |
| Bump steer | deg/mm | tie-rod inner and outer points, lower arm, `steering.rack` | E3.5 | R1 |
| Damping ratio (low/high speed) | – | damper document (§4.8), sprung mass at the corner, wheel rate, motion ratio | E3.6 | R2 |
| Ackermann / toe at roll | deg | tie-rod geometry, `steering.rack`, `corners.<c>.toe` | E3.18 | R2 |

Every output has an AC: the audit in E9.9 fails an output id here with no AC, so
the two orphan outputs the round-1 review found (Ackermann, dynamic toe) cannot
reappear.

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
| 6 | `ESTIMATED_INPUTS(n)` | at least one consumed value has an `estimated` source | the number, plus the count and the basis one tap away |
| 7 | `COMPUTED` | nothing above applies | the number |

`not_yet_validated` is the initial state of every value this build produces: a
`COMPUTED` value becomes `validated` for an output only when a golden case exists
for it (E3.11) **and** a recorded measurement check has passed for that model
(E3.13). Until then every surface says so, in the analysis-health line and on each
value's chip, and every export carries the same word. This is E3.16, and it is
the requirement that stops an unvalidated model rendering `9.97 mm` with a unit
and no caveat.
