# Setup Lab — Requirements Specification v0.1

**Status:** draft for review round 1
**Date:** 2026-10-30
**Owner:** Dave (merges all PRs)
**Upstream:** [`docs/intent.md`](../intent.md) · **Rules applied:** [`AGENTS.md`](../../AGENTS.md), [`docs/review-rules.md`](../review-rules.md)
**Next artifact:** `docs/specs/plan.md`

This document says *what must be true of the shipped app*, in a form a test can
prove. It does not say how to build it. Where a requirement could be met in
several ways, it is written as the observable behaviour, not the mechanism.

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
split, roll-centre height and migration, camber gain, bump steer, damping ratio
— displays each as a value with its units, its equation and its inputs, lets the
racer put two setups side by side and see which quantities moved and by how
much, and explains the concept at the point where it is being used rather than
in a manual nobody opens. It is a clean-room successor to RC Crew Chief: the
workflow (measure → model → compare) is kept because it is good, the physics is
standard vehicle dynamics, and nothing of the original program's code, help
text, iconography or name is used or required.

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

One sentence, from the intent, and it is testable (see E9.5): a club racer with
a phone, a setup station and one caliper session models their car in under
thirty minutes, and correctly predicts the direction of a camber-link or
roll-centre change before making it.

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

The one substantive difference is provenance vocabulary: the screen inventory's
`answered · unknown · estimated · library · unanswered` maps onto the source
types in §4.1 as `measured`, `unknown`, `estimated`, `manufacturer`/
`third_party`, and field-absent respectively. `estimated` exists in both, and
E2.11 is the requirement that keeps it honest.

---

## 2. Scope of v1, and the slice that proves it

### 2.1 In v1

Suspension **geometry and balance**, plus **static damper rate** — that is,
every property that follows from hardpoint positions, masses, spring rates, bar
rates and damper curves. Concretely: motion ratio, wheel rate, ride frequency,
roll stiffness, load-transfer split, roll-centre height and migration, camber
gain, bump steer, damping ratio, and the static camber/toe at a given roll
angle. Plus the model library, setup versioning, comparison, explanations,
import/export and the measurement guidance that makes the model possible.

### 2.2 Not in v1

Motor/battery/ESC dyno, acceleration simulation, time-domain chassis roll,
tyre modelling, cloud sync, multi-user anything. These are listed with reasons
in §6, not left implicit.

### 2.3 The slice (Slice 0)

The first thing a person can hold and use is **one screen**: a complete example
model, three live outputs (wheel rate, roll-centre height, camber gain per
degree of roll), an input the user can move, and the equation behind whichever
output they tap. If Slice 0 is not in someone's hands early, the spec has
failed regardless of how many criteria below are green. Slice 0 satisfies
E3.1, E3.3, E3.4, E3.7, E5.1 and E3.12; it does not satisfy the measurement,
library or export epics, and that is deliberate.

### 2.4 Consequences of decisions already taken

Recorded here so they are not re-litigated later; each one costs something.

| Decision | Consequence the spec must absorb |
|---|---|
| Flutter, Android/iOS first | Every numeric input must be usable on a 320 dp-wide touch screen with no keyboard-hover; desktop/web are later renderings of the same screens (E8.6). |
| Offline-only, no accounts, no backend | Model sharing has to work through the OS share sheet and files, which means the file format *is* the community feature (E6.4, E7.1). There is no server to fix a bad model, so validation must be local and strict (E6.5). |
| Human-readable versioned JSON with per-value provenance | The format is a public interface from day one; schema changes need migrations and fixtures (E9.2), and every value needs a source or the format is a lie (E1.3). |
| Physics in a pure Dart package | The UI cannot compute; it can only present. Anything the user sees must be obtainable from a function that a headless test can call (E3.10, E3.11). |
| Free forever | No paid tier, no telemetry-funded tier, no ad SDK — which removes a whole class of "how do we see usage" features and replaces them with the instrumented usability test (E9.5, E8.13). |
| Clean-room | Explanation text is written by us and mechanically checked against the research corpus (E5.4, E9.4). This is a build-time gate, not a promise. |

---

## 3. Acceptance criteria

**How to read these.** Every criterion is numbered, tagged **MUST** / **SHOULD**
/ **LATER**, and phrased as *Given … when … then …* so that a single automated
test or a single scripted manual check can decide pass or fail. Tags mean:

- **MUST** — v1 does not ship without it. A red MUST blocks release.
- **SHOULD** — v1 ships it unless it is descoped in writing in `plan.md`, with
  the reason and the consequence recorded.
- **LATER** — explicitly not v1. Listed so it is not rediscovered as a bug.

Where a criterion names a numeric bound, that bound is the test's assertion, not
an aspiration. Where a criterion says "stated", the app must display the
quantity it used, so that the test can read it off the screen or the export.

---

### Epic E1 — Car model and measurement

The model is the expensive artifact: a caliper session costs an hour and can
never be repeated exactly. Everything in this epic exists to make that hour
survive, and to stop the app inventing a number where a measurement is missing.

**E1.1** — *Given* a new car model with no hardpoints entered, *when* the user
opens it, *then* every unentered hardpoint is listed as "not measured" and no
output that depends on it is displayed at all. **MUST**

**E1.2** — *Given* a model whose front hardpoints are complete and whose rear
hardpoints are not, *when* analysis runs, *then* the front outputs are computed
and displayed, the rear outputs each report "not measured" with the missing
field named, and no displayed value is `NaN`, `Infinity` or a placeholder
number. **MUST**

**E1.3** — *Given* a numeric field in a car model, *when* the user attempts to
save it without a provenance entry that resolves, *then* the save is refused,
the offending field path is named, and no partial file is written. **MUST**

**E1.4** — *Given* symmetry is enabled (the default for a new model), *when*
the user enters a front-left hardpoint, *then* the front-right value is written
as the mirror image about the vehicle centreline and the pair is displayed as
linked; *given* symmetry is disabled, *when* the user enters one corner, *then*
no other corner changes. **MUST**

**E1.5** — *Given* the measurement worksheet, *when* it is opened, *then* it
contains exactly one step per required model field, in the order the
measurements are physically taken, and each step names its datum ("from the flat
plate", "from the hinge-pin centre", "between pivot centres") and shows a
diagram. **MUST**

**E1.6** — *Given* a measurement outside the plausible range for its field
(negative length; a hardpoint more than twice the wheelbase from the origin; a
spring rate of zero), *when* the user confirms entry, *then* the value is
accepted, the field is flagged, and the flag survives save and reload. **MUST**

**E1.7** — *Given* a saved model, *when* it is loaded and saved again with no
edits, *then* the persisted bytes of the model body are identical (round-trip
test), including field order and float representation. **MUST**

**E1.8** — *Given* a model with no unsprung mass recorded, *when* analysis runs,
*then* every output that depends on unsprung mass is marked "assumes unsprung
mass = 0" and that mark is visible on screen and present in every export.
**MUST**

**E1.9** — *Given* a model with no reference ride height recorded, *when* the
user opens analysis, *then* the app refuses to compute ride-height-dependent
outputs and states that the ride-height datum is missing. **MUST**

**E1.10** — *Given* a model with hardpoints complete but corner weights not
measured, *when* the user opens the mass section, *then* the app offers a
recorded procedure for measuring sprung/unsprung split and ride stiffness at a
corner, and accepts the raw readings (four corner weights, stepped ride heights,
shock weights) as the provenance for the derived masses and rates. **SHOULD**

**E1.11** — *Given* a model whose real hardware differs from the modelled
representation (rocker arms, gull-wing arms, inboard spring on a linkage),
*when* the model is displayed, *then* the difference is stated on the model in
the user's own words, and it appears in the model's summary so a shared model
cannot be mistaken for an exact representation. **SHOULD**

**E1.12** — *Given* a set of photographs of a chassis with a scale reference,
*when* the user imports them, *then* hardpoints can be picked from the image
and scaled from two reference measurements. **LATER**

---

### Epic E2 — Setup entry

A setup is a small, cheap, frequently-changed artifact. The failure mode to
design out is the one the corpus shows repeatedly: a change made to explore an
idea silently overwrites the setup that represented a known-good car.

**E2.1** — *Given* an existing car model, *when* the user creates a setup,
*then* the setup is linked to that model's id and to the content hash of the
model body, and both are visible on the setup screen. **MUST**

**E2.2** — *Given* a saved setup, *when* the user changes any value, *then* the
saved setup is unchanged and the change lives in a working copy; *when* the user
saves, *then* a new revision is created and the previous one remains selectable.
**MUST**

**E2.3** — *Given* any numeric field, *when* it is displayed, *then* its unit is
shown adjacent to the value; *when* the user switches a display-unit preference,
*then* every displayed value converts and every stored value is unchanged
(round-trip test at the storage boundary). **MUST**

**E2.4** — *Given* a setup field the user has not set, *when* analysis runs,
*then* the field is absent from the file (not defaulted to a number), the output
that depends on it is either marked "assumes …" with the assumption value shown
or reported as not computable, and the setup screen lists every assumption in
one place. **MUST**

**E2.5** — *Given* the setup screen, *when* the user inspects any field, *then*
the field is either (a) consumed by at least one displayed output, with that
output named, or (b) labelled "reference only — not used in the maths". No field
is unexplained. **MUST**

**E2.6** — *Given* a setup for a complete model, *when* the user enters values,
*then* every setup group (springs, bars, dampers, geometry, tyres, notes, analysis
inputs) is reachable directly from the setup screen without having to complete
another group first, and the number of taps from the setup screen to any group is
shown in the design's screen inventory and does not grow with model size.
**MUST**

**E2.7** — *Given* a setup saved against model revision A, *when* the model is
edited to revision B, *then* the setup is not silently recomputed: the app shows
"model changed since this setup was saved", names the changed fields, and offers
"recompute against the current model" or "keep the model snapshot this setup was
saved with", recording which the user chose. **MUST**

**E2.8** — *Given* a setup, *when* the user writes notes, *then* track,
conditions, tyre and general notes are stored separately, are searchable across
all setups, and travel with the setup in every export. **SHOULD**

**E2.9** — *Given* a paper setup sheet in front of the user, *when* they enter a
setup, *then* a sheet-order entry mode presents the same values in the order the
paper sheet lists them, so the transfer is one pass rather than a hunt. **SHOULD**

**E2.10** — *Given* a photograph of a filled paper setup sheet, *when* the user
imports it, *then* values are extracted for confirmation field by field. **LATER**

**E2.11** — *Given* a value entered as an estimate with a stated basis, *when* any
output consumes it, *then* that output is marked as approximate, the number of
estimated inputs behind it is reachable from the output, and the basis of each is
one tap away; *given* the value is later measured, *then* the mark disappears from
every output that consumed it. **MUST**

---

### Epic E3 — Computation and analysis

The physics is the product. The criteria here are about the numbers being
right, being explainable, being honest when the geometry breaks them, and
arriving fast enough to be dragged.

**E3.1** — *Given* a model with both corners of an axle measured, *when*
analysis runs, *then* motion ratio (dimensionless) and wheel rate (N/mm) are
reported per corner, and each is reported separately from the spring rate so
that a spring change and a geometry change can be told apart. **MUST**

**E3.2** — *Given* a complete model and setup and a stated lateral acceleration,
*when* analysis runs, *then* ride frequency (Hz) per axle, roll stiffness (N·m
per degree) per axle, and the lateral load-transfer split (percent of total
transfer carried by the front axle) are reported, with the lateral g used
displayed next to them. **MUST**

**E3.3** — *Given* a complete front and rear geometry, *when* analysis runs,
*then* static roll-centre height (mm above the flat-plate datum) is reported per
axle, and a migration table gives roll-centre height at roll angles from −3.0°
to +3.0° in 0.5° steps, with the height at each step displayed rather than only
drawn. **MUST**

**E3.4** — *Given* a complete geometry, *when* analysis runs, *then* camber gain
(degrees of camber change per degree of chassis roll) is reported per axle, and
static camber is reported at roll −2.0°, 0.0° and +2.0° for each corner.
**MUST**

**E3.5** — *Given* a measured front geometry, *when* analysis runs, *then* bump
steer (degrees of toe change per mm of wheel travel) is reported per side over a
stated travel range, and the range used is displayed. **MUST**

**E3.6** — *Given* a model, a setup and a damper curve, *when* analysis runs,
*then* damping ratio is reported per corner at a stated low and a stated high
shaft speed, with both speeds displayed and the damper curve's source named.
**MUST**

**E3.7** — *Given* any displayed output, *when* the user asks "how", *then* the
app shows the equation in symbols, the same equation with this model's numbers
substituted, the result with units, and the provenance of every input used.
**MUST**

**E3.8** — *Given* degenerate geometry (zero-length link, coincident hardpoints,
parallel links producing an instant centre at infinity), *when* analysis runs,
*then* the affected output returns a typed "undefined" result naming the reason,
the app displays "undefined for this geometry" with that reason, and a
randomised property test over ≥10,000 generated geometries finds no `NaN` or
`Infinity` in any public output. **MUST**

**E3.9** — *Given* a geometry that computes but is outside the model's stated
validity domain (roll centre more than a stated distance from the ground plane;
instant centre ahead of the axle on a trailing-arm rear), *when* analysis runs,
*then* the output is shown with an "outside the range this model is valid for"
flag rather than presented as a normal number. **MUST**

**E3.10** — *Given* the same model and setup, *when* analysis runs twice, on two
devices and in both a debug and a release build, *then* every output agrees to a
relative tolerance of 1e-9. **MUST**

**E3.11** — *Given* every computed output, *when* the test suite runs, *then* at
least one golden case exists whose expected value comes from a source outside
the codebase (a published equation evaluated by hand, a cited worked example, or
a hand calculation filed in `docs/specs/physics/`), and the test names that
source. **MUST**

**E3.12** — *Given* a complete model on the reference device (§5.1), *when* the
user drags a setup slider continuously for 10 seconds, *then* the full analysis
recomputes in ≤16 ms per update and ≥95% of frames are presented within 16.7 ms,
measured by an automated frame-timing test rather than by eye. **MUST**

**E3.13** — *Given* a model where the user has measured ride stiffness at a
corner, *when* analysis runs, *then* the predicted wheel rate is compared with
the measured value, both are shown, and a difference greater than 15% raises
"check your measurements or your model" against the offending corner. **MUST**

**E3.14** — *Given* any single setup input, *when* the user asks what a change
would do, *then* the app reports the output change for a stated step of that
input (e.g. +1 mm of lower-arm shim), computed numerically, with the step size
displayed. **SHOULD**

**E3.15** — *Given* a lateral acceleration input over time, *when* the user runs
the roll simulation, *then* chassis roll, load transfer and camber are reported
as a time series including droop-limited behaviour. **LATER**

---

### Epic E4 — Compare

Comparison is the feature that answers the question the racer actually has:
*what did I change, and what did it do?* It must be an explanation of a
difference, not two tables the user has to diff by eye.

**E4.1** — *Given* two setups attached to the same model, *when* the user
compares them, *then* a single view lists every input whose value differs
(previous value, new value, delta with sign and units) and every output whose
value differs (previous, new, delta, and the direction of the change in words
used consistently with the explanation text). **MUST**

**E4.2** — *Given* a comparison, *when* it is displayed, *then* outputs that did
not change are still listed and explicitly marked "unchanged", so that absence
never has to be interpreted. **MUST**

**E4.3** — *Given* two setups attached to different models, *when* the user
attempts a comparison, *then* the comparison is refused with a message stating
that outputs depend on geometry and are not comparable across different chassis,
and the user is offered a comparison of the setup inputs only. **MUST**

**E4.4** — *Given* a comparison in which an output changed, *when* the user opens
that output, *then* the app names the inputs that changed and are consumed by
that output, so the causal chain is visible without the user knowing the
equation. **MUST**

**E4.5** — *Given* a car with several setups, *when* the user marks one as the
baseline, *then* every other setup for that car displays its deltas against that
baseline, and the baseline survives app restart. **MUST**

**E4.6** — *Given* an output changed by several inputs, *when* the user asks for
the breakdown, *then* the inputs are ranked by their contribution to the change,
with each contribution shown as a value in the output's units. **SHOULD**

**E4.7** — *Given* a comparison, *when* the user exports or prints it, *then* the
side-by-side table is produced as a single page, and where a chart is used, each
setup is distinguishable by line style and direct label as well as colour.
**SHOULD**

**E4.8** — *Given* three or four setups on the same car, *when* the user compares
them together, *then* one view ranks them per output and shows each difference
against a chosen reference. **LATER**

---

### Epic E5 — Learn and explain

The app is a teaching tool first and a calculator second; the intent says the
teaching happens *at the point where the concept is used*. Every criterion here
exists because a number the user cannot interrogate is worse than no number.

**E5.1** — *Given* any computed output, *when* the user taps its explanation,
*then* one screen states what the quantity is, what it affects on the car, the
equation that produces it (E3.7), and what happens to the car when it rises or
falls — reachable in one tap from the value itself, not from a separate manual.
**MUST**

**E5.2** — *Given* any input field, *when* the user taps "how do I measure
this?", *then* the app states the datum, the tool, the common mistake and a
worked example with numbers, and the worked example's inputs are the example
model's own values so the user can reproduce it. **MUST**

**E5.3** — *Given* the body of explanation text, *when* it is scanned, *then*
every technical term used inside an explanation is itself defined somewhere in
the app and linked from first use; a build-time check fails on any term that is
used but undefined. **MUST**

**E5.4** — *Given* the shipped explanation and help strings, *when* the
originality check runs against `docs/research/`, *then* no shipped string shares
a run of more than 8 consecutive words with any corpus document, and the check
fails the build if one does. **MUST**

**E5.5** — *Given* any analysis screen, *when* it is displayed, *then* an
"assumptions and limits" entry is present in one tap, naming what the model leaves
out for this build (at minimum: tyre behaviour, aerodynamic load, chassis
torsional flex, the diff-height torque term, and any interaction between droop
limits and the static analysis), and the same text is carried in every export.
**MUST**

**E5.6** — *Given* any output, *when* it is displayed, *then* the app never
presents a composite "grip" or "handling" score, and every directional claim
it makes is a claim about a computed quantity (load-transfer share, camber at
roll, wheel rate) rather than about lap time. **MUST**

**E5.7** — *Given* a first launch, *when* the user follows the guided path,
*then* the sequence model → measure → first setup → first delta is presented as
discrete steps with progress shown, and progress survives an app restart at any
step. **SHOULD**

**E5.8** — *Given* the glossary, *when* the user searches a term, *then* it
returns the definition plus every screen and output that uses it, and the
vocabulary matches what the community uses (roll centre, camber link, droop,
motion ratio, ride stiffness, roll stiffness, bump steer, ackermann) rather than
inventing synonyms. **SHOULD**

**E5.9** — *Given* an explanation screen, *when* the user wants more, *then* a
link to the corresponding published article or video is offered, opening in the
system browser. **LATER**

---

### Epic E6 — Model library and sharing

The original library died with its website. The library here must be a set of
files that anyone can copy, and installing one must never require trusting a
server.

**E6.1** — *Given* a fresh install, *when* the app first opens, *then* at least
one complete example model is present, every one of its values has a resolvable
provenance entry, and it is the model used by the tutorial and the worked
examples. **MUST**

**E6.2** — *Given* a model file received by any means the OS offers (share
sheet, file picker, opening from a file manager), *when* the user installs it,
*then* it appears in the library with its name, class and per-value provenance
intact, and computes without further input. **MUST**

**E6.3** — *Given* the model library, *when* it is displayed, *then* each model
shows name, class, completeness (measured fields as a count and a percentage of
required fields), a provenance summary (how many values are measured, how many
manufacturer, how many unknown) and last-modified date. **MUST**

**E6.4** — *Given* a model or setup, *when* the user shares it, *then* the OS
share sheet is offered with a single self-contained JSON file, and the app itself
performs no network request to complete the share. **MUST**

**E6.5** — *Given* an invalid model file, *when* it is imported, *then* it is
rejected with the schema path and reason for each offending field and nothing is
added to the library; *given* a file that is valid but incomplete, *when* it is
imported, *then* it is added as incomplete, the missing fields are listed, and no
value is invented to fill them. **MUST**

**E6.6** — *Given* a file whose `schema_version` major is newer than the app
supports, *when* it is imported, *then* the import is refused with the file's
version and the app's supported range named, and no partial data is written.
**MUST**

**E6.7** — *Given* a contributor who has measured a chassis, *when* they prepare
a contribution, *then* the app can export a contribution bundle (the model, the
worksheet answers, and references to photographs), and the published review
checklist requires either two independent measurement records or photographic
evidence for every hardpoint before a model is accepted into the shipped
library. **SHOULD**

**E6.8** — *Given* an internet connection, *when* the user browses a model library
inside the app, *then* a model can be installed without leaving the app.
**LATER**

---

### Epic E7 — Import, export and durability

The file format is the community's memory. If a user cannot get their work out
in a form that outlives the app, the app has failed at the only thing the
original could not do.

**E7.1** — *Given* any model or setup, *when* it is exported and imported on a
different device, *then* every computed output for a given setup agrees with the
original to a relative tolerance of 1e-9, and no field is lost. **MUST**

**E7.2** — *Given* an exported file, *when* it is opened in a text editor,
*then* it is indented, keys appear in a stable documented order, units are
declared in the file, unknown-but-preserved fields survive a round trip, and the
file contains no encoded binary, no base64 blob and no opaque identifier that a
reader cannot resolve within the file. **MUST**

**E7.3** — *Given* an export, *when* it is inspected, *then* it carries
`schema_version`, the producing app version, the model content hash, per-value
provenance, and the assumptions block (E5.5). **MUST**

**E7.4** — *Given* a setup, *when* the user exports a setup sheet, *then* a
single page is produced containing the inputs, the key outputs with units, the
notes, and one line naming the model and its completeness — printable on desktop
and shareable as a PDF on mobile. **MUST**

**E7.5** — *Given* a library that already contains a model or setup with the same
id as an imported file, *when* the import runs, *then* nothing is overwritten
without confirmation, the differing fields are shown before the user decides, and
the default action creates a copy with a distinguishing label. **MUST**

**E7.6** — *Given* a populated library, *when* the user runs backup, *then* one
file contains every model, setup and note; *when* the user restores that file
into a populated library, *then* a preview of additions, conflicts and
replacements is shown and nothing is written until confirmed. **MUST**

**E7.7** — *Given* a comparison, *when* the user exports it, *then* a CSV with one
row per setup and one column per input and output is produced, with units in the
header. **SHOULD**

**E7.8** — *Given* a spreadsheet of setups, *when* the user imports it, *then* a
mapping screen assigns columns to setup fields, the user picks the unit for each
mapped column, and the resulting setups are previewed before being created.
**SHOULD**

**E7.9** — *Given* any file that is a binary database, an installer, or anything
produced by the program this app succeeds, *when* the user attempts to import
it, *then* the app refuses, explains that it does not read that format, and
points to the measurement worksheet instead. **MUST**

**E7.10** — *Given* a manufacturer's published setup sheet format, *when* the
user imports it, *then* values are mapped with a confirmation step. **LATER**

---

### Epic E8 — Platform, offline and accessibility

The phone at the track is the only context that matters, and it is a hostile
one: bright sun, gloves, one hand, no signal, no charger.

**E8.1** — *Given* the built Android artifact, *when* its manifest is inspected,
*then* it declares no `INTERNET` permission; *given* the built iOS artifact,
*when* its entitlements are inspected, *then* no network capability is requested
beyond the OS share sheet, and a build-time check fails if either changes.
**MUST**

**E8.2** — *Given* a device in airplane mode with no SIM and no Wi-Fi, *when*
the user models a car, enters a setup, computes, compares, reads an explanation
and exports, *then* every one of those actions completes. **MUST**

**E8.3** — *Given* a first launch, *when* the app opens, *then* no account,
login, email address or personal detail is requested at any point, and a working
analysis screen is reachable without entering anything about the user. **MUST**

**E8.4** — *Given* the app is in use, *when* its storage is inspected, *then* all
user data is held in the app's own storage on the device, and data leaves the
device only through an action the user started (share, export, backup). **MUST**

**E8.5** — *Given* the reference device, *when* the app is cold-started to an
interactive analysis screen, *then* it takes ≤2.0 s, and opening a stored model
takes ≤300 ms, measured by an automated test on the release build. **MUST**

**E8.6** — *Given* a device running Android 8.0 or later, or iOS 15 or later,
*when* the app runs, *then* every screen is usable from 320 dp to 1024 dp wide,
in portrait, landscape and split view, with no horizontal scrolling and no
clipped value on the analysis screen at 320 dp. **MUST**

**E8.7** — *Given* the app's own screens, *when* they are audited, *then* every
interactive target is at least 44×44 dp, text scales to 200% without clipping or
overlap, body text contrast is at least 4.5:1 and large text 3:1 in both themes,
every chart has an equivalent table view, and every change in a value is encoded
by sign and symbol as well as colour — meeting WCAG 2.2 AA. **MUST**

**E8.8** — *Given* a screen reader, *when* the user moves to a computed value,
*then* it announces the quantity's name, its value, its unit and whether it
changed from the baseline, and no icon-only control is unlabelled. **MUST**

**E8.9** — *Given* a pseudo-locale that expands every string by 40% and a
right-to-left locale, *when* the app runs, *then* no text is clipped, no
concatenated sentence is broken mid-phrase, no number or unit is misformatted,
and no layout overlaps; all user-facing strings resolve from externalised
resources with no string built by concatenation. **MUST**

**E8.10** — *Given* either theme, *when* the app is used in direct sunlight,
*then* both themes meet the contrast thresholds of E8.7 and no information is
carried by a colour that only exists in one theme. **MUST**

**E8.11** — *Given* the release artifacts, *when* their download sizes are
measured, *then* the Android App Bundle download for a phone is ≤25 MB, the
thinned iOS download is ≤40 MB, and the installed footprint is ≤60 MB, with the
figures recorded in the release checklist. **MUST**

**E8.12** — *Given* a save in progress, *when* the process is killed at the write
boundary, *then* the previously saved version is intact and readable on next
launch, and no partially written file is ever offered as valid. **MUST**

**E8.13** — *Given* the shipped app, *when* its dependencies are inspected,
*then* it contains no analytics, advertising or crash-reporting SDK that
transmits data off the device, and the privacy statement says plainly that no
usage data is collected. **MUST**

---

### Epic E9 — Release

**E9.1** — *Given* the app, *when* the user opens the about screen, *then* the
app version, the supported schema version range and the spec version are shown,
and the app version and schema version travel in every export. **MUST**

**E9.2** — *Given* a fixture file for each released schema version, *when* the
test suite runs, *then* every fixture either loads correctly or is refused with a
named reason; no fixture crashes or loads silently incomplete, and adding a
schema version without a fixture fails the suite. **MUST**

**E9.3** — *Given* the store listing, *when* it is prepared for submission, *then*
the title, description, screenshots and keywords have been checked against the
clean-room rule and contain no reference to, or imagery of, the program this app
succeeds, and the check is recorded in the release checklist. **MUST**

**E9.4** — *Given* a release candidate, *when* the IP check runs, *then* the
built artifacts contain no occurrence of the predecessor's names, no `.sdf` or
other database asset, no string with an 8-word overlap with the research corpus,
and the build fails on any hit. **MUST**

**E9.5** — *Given* three club racers who have never used the app, *when* each
runs the success test on their own car, *then* each produces a complete model in
≤30 minutes from a caliper session and correctly predicts the direction of one
camber-link change and one roll-centre change before making them; results,
timings and any failure are recorded in `docs/specs/eval/`. **MUST**

**E9.6** — *Given* the app, *when* the user opens licences and credits, *then*
the code licence, the data licence, the attribution for every shipped model and
its contributor, and the dedication are readable in-app. **MUST**

**E9.7** — *Given* a user who has found a problem, *when* they look for a way to
report it, *then* a route that requires no account is offered (a mail link or an
issue tracker link) and it is reachable from the about screen. **SHOULD**

**E9.8** — *Given* a release candidate, *when* the release gate runs, *then*
static analysis is clean, the test suite is green, the spec audit reports no
untested MUST and no orphaned test, and the behaviour-verification screenshots
have been reviewed against the screen inventory. **MUST**

---

## 4. Data model

Two document kinds, both plain JSON, both carrying `schema_version`. They are
the app's public interface: a setup or a model that leaves the device must be
readable, validatable and re-importable by a future version of the app and by a
person with a text editor.

### 4.1 Rules that apply to both documents

1. **Units are declared in the file, not implied.** A `units` object states the
   unit used for each dimension. This build writes lengths in **mm**, angles in
   **degrees**, masses in **g**, spring rates in **N/mm**, damper forces in
   **N at a shaft speed in m/s**. The physics package converts to SI once, at
   its own boundary; storage units never reach a calculation. (mm is chosen
   because a caliper reads mm and the community measures in mm — see §7 D6 for
   the risk this carries.)
2. **Every numeric value is an object, not a bare number:**
   `{"v": <number>, "s": "<source id>"}`, where `s` resolves into the document's
   top-level `sources` map. One source id can be shared by many values (a whole
   caliper session is one source), which keeps files readable and provenance
   honest at the same time.
3. **Absence means "not measured".** A field that is not measured is omitted.
   It is never written as `0`, `null` or a sentinel number, and a loader never
   fills it with a default. Downstream outputs either declare the assumption
   they made (with the value shown) or report the output as not computable.
4. **A source entry must resolve, and must say what kind of evidence it is:**

   | `type` | Meaning | Required extra fields |
   |---|---|---|
   | `measured` | The owner measured this car with a named tool | `method`, `datum`, `by`, `date` |
   | `estimated` | The owner could not measure it and supplied a considered figure | `basis`, `by`, and optionally `tolerance_pct` |
   | `manufacturer` | From a manual, CAD, or published drawing | `ref` |
   | `third_party` | Another person's measurement or a contributed model | `by`, `ref` (may be a handle) |
   | `derived` | Computed from other values in the file | `from` (list of field paths) |
   | `unknown` | Present in a file but with no recorded origin | *(none — and the completeness count treats it as unmeasured)* |

   An `estimated` value is written and used, never silently promoted to
   `measured`; every output that consumes one is marked as estimated (E2.11).

5. **Content hash.** `content_hash` is the SHA-256 of the canonical form of the
   document body: UTF-8, keys sorted, no insignificant whitespace, `meta`
   excluded. The hash is what setups reference, so a model can be edited without
   silently changing the meaning of a saved setup.
6. **Revisioning.** A saved model is immutable. Editing produces a new revision
   with a new `content_hash`; the library holds a pointer to the current one, and
   every earlier revision stays on disk. Setups reference `(model_id,
   content_hash)`. This is how E2.7 is satisfied without embedding model copies
   inside setups.
7. **Forward compatibility.** A reader preserves `x_`-prefixed keys it does not
   understand and writes them back on export. A reader refuses a document whose
   `schema_version` major is greater than it supports (E6.6).

### 4.2 Car model

Frame: right-handed, **X forward, Y to the right, Z up**; origin on the
flat-plate surface at the midpoint of the two axle centrelines, on the vehicle
centreline. Every hardpoint is `[x, y, z]` in mm from that origin.

```json
{
  "schema_version": "1.0.0",
  "kind": "car_model",
  "id": "mdl_8f2c41",
  "name": "Example 1/10 TC — measured 2026-10-12",
  "class": "touring_car_1_10",
  "units": {
    "length": "mm", "angle": "deg", "mass": "g",
    "spring_rate": "N/mm", "damper_force": "N", "damper_speed": "m/s"
  },
  "frame": { "axes": "X fwd, Y right, Z up", "origin": "flat plate, mid-wheelbase, centreline" },
  "symmetry": true,
  "meta": { "created": "2026-10-12", "app_version": "0.1.0", "revises": null },

  "sources": {
    "s1": { "type": "measured", "method": "digital caliper 150 mm", "datum": "flat plate, hinge-pin centre",
            "by": "DW", "date": "2026-10-12", "note": "car on setup stands, wheels off" },
    "s2": { "type": "manufacturer", "ref": "kit manual p.14, exploded view" },
    "s3": { "type": "measured", "method": "corner scales", "datum": "four pads, ride height 5.0 mm",
            "by": "DW", "date": "2026-10-12" },
    "s4": { "type": "derived", "from": ["body.mass.total"], "note": "corner weights minus unsprung" }
  },

  "body": {
    "reference_ride_height": { "v": 5.0, "s": "s1" },
    "wheelbase":            { "v": 257.0, "s": "s1" },
    "cg": {
      "height":            { "v": 38.0, "s": "s3" },
      "longitudinal_front_pct": { "v": 50.5, "s": "s4" }
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
        "track":            { "v": 163.0, "s": "s1" },
        "tyre_radius":      { "v": 31.0,  "s": "s1" },
        "roll_centre_validity": { "v": 40.0, "s": "s2" },
        "droop_limit_wheel":{ "v": 6.0,   "s": "s1" },
        "bump_limit_wheel": { "v": 6.0,   "s": "s1" },
        "arb": { "type": "blade", "rate_at_full_stiff": { "v": 0.42, "s": "s2" } },
        "corners": {
          "left": {
            "lower_arm": {
              "inboard_front": { "v": [-110.0, -78.0, 12.0], "s": "s1" },
              "inboard_rear":  { "v": [-62.0,  -78.0, 12.0], "s": "s1" },
              "outboard":      { "v": [0.0,    -80.0, 10.5], "s": "s1" }
            },
            "upper_link": {
              "inboard_front": { "v": [-96.0, -60.0, 38.0], "s": "s1" },
              "inboard_rear":  { "v": [-80.0, -60.0, 38.0], "s": "s1" },
              "outboard":      { "v": [-2.0,  -76.0, 34.0], "s": "s1" }
            },
            "upright": {
              "lower_ball":    { "v": [0.0,  -80.0, 10.5], "s": "s1" },
              "upper_ball":    { "v": [-2.0, -76.0, 34.0], "s": "s1" },
              "wheel_centre":  { "v": [0.0,  -81.5, 31.0], "s": "s1" }
            },
            "damper": {
              "lower_mount":   { "v": [-52.0, -72.0, 15.0], "s": "s1" },
              "upper_mount":   { "v": [-56.0, -66.0, 62.0], "s": "s1" }
            },
            "spring": { "location": "coilover_at_damper",
                        "rate": { "v": 3.10, "s": "s2" },
                        "free_length": { "v": 20.0, "s": "s2" } },
            "steering": {
              "tie_rod_inboard":  { "v": [-40.0, -46.0, 14.0], "s": "s1" },
              "tie_rod_outboard": { "v": [-8.0,  -74.0, 16.0], "s": "s1" }
            },
            "arb_pickup": { "v": [-44.0, -70.0, 13.0], "s": "s1" }
          }
        }
      }
    }
  }
}
```

This example is deliberately incomplete: `corners.right` and the whole
`axles.rear` block are omitted. Rule 3 above permits that, and E1.2 is the
requirement that the app reports what is missing rather than filling it in.

#### 4.2.1 Field table — car model

`Req` = required for the model to be considered complete. Optional fields may be
absent; a downstream output then either declares an assumption or refuses.

| Field | Type | Unit | Req | Notes |
|---|---|---|---|---|
| `schema_version` | string | — | yes | `MAJOR.MINOR.PATCH`; reader refuses a greater major |
| `kind` | string | — | yes | `car_model` |
| `id` | string | — | yes | Stable, unique, opaque; never reused |
| `name` | string | — | yes | Free text, shown in the library |
| `class` | enum | — | yes | `touring_car_1_10`, `buggy_1_10_2wd`, `buggy_1_10_4wd`, `truck_1_10`, `other` |
| `units` | object | — | yes | Every dimension declared; loader rejects unknown/missing dimensions |
| `frame` | object | — | yes | Documents axes and origin; must match §4.2 |
| `symmetry` | bool | — | yes | When true, right-hand points must equal the mirror of the left within 0.01 mm |
| `sources` | object | — | yes | Map of source id → source record; every `s` must resolve |
| `reference_ride_height` | value | mm | yes | Datum for all vertical geometry (E1.9) |
| `wheelbase` | value | mm | yes | Also validated against the hardpoints (±3 mm) |
| `cg.height` | value | mm | yes | Above the flat plate |
| `cg.longitudinal_front_pct` | value | % | yes | Front axle share of total mass |
| `mass.total` | value | g | yes | |
| `mass.sprung_front`, `.sprung_rear` | value | g | no | Absent → outputs declare "sprung mass not measured" |
| `mass.unsprung_front`, `.unsprung_rear` | value | g | no | Absent → treated as 0 **with a visible flag** (E1.8) |
| `axles.<axle>.track` | value | mm | yes | Hub-face to hub-face at static ride height |
| `axles.<axle>.tyre_radius` | value | mm | yes | Used for contact-patch geometry and travel conversion |
| `axles.<axle>.roll_centre_validity` | value | mm | no | Domain bound for E3.9; absent → default stated in the UI |
| `axles.<axle>.droop_limit_wheel` / `bump_limit_wheel` | value | mm | no | Wheel travel, not shaft travel |
| `axles.<axle>.arb` | object | — | no | `type` in `blade`/`fixed`/`none`, plus `rate_at_full_stiff` (N/mm at the link) |
| `axles.<axle>.corners.<side>.lower_arm.inboard_front` / `inboard_rear` / `outboard` | point | mm | yes | Defines the lower hinge-pin axis and the outer ball joint |
| `…upper_link.inboard_front` / `inboard_rear` / `outboard` | point | yes (front), yes (rear) | | Camber link / upper wishbone |
| `…upright.lower_ball` / `upper_ball` / `wheel_centre` | point | mm | yes | `wheel_centre` fixes track and scrub radius |
| `…damper.lower_mount` / `upper_mount` | point | mm | yes | Eye-to-eye at static ride height defines motion ratio |
| `…spring.location` | enum | — | yes | `coilover_at_damper`, `separate_seat`, `inboard_rocker` |
| `…spring.rate` | value | N/mm | yes | |
| `…spring.free_length` | value | mm | no | Needed for preload and for coil-bind checks |
| `…steering.tie_rod_inboard` / `tie_rod_outboard` | point | mm | front only | Drives bump steer; rear uses `toe_link_*` of the same shape |
| `…arb_pickup` | point | mm | no | Required if `arb.rate_at_full_stiff` is present |
| `x_*` | any | — | no | Preserved verbatim on export |

### 4.3 Setup

A setup is a set of values for one car, plus the conditions it was run in. It
references a model revision by hash; it never contains geometry.

```json
{
  "schema_version": "1.0.0",
  "kind": "setup",
  "id": "set_2b91c0",
  "label": "Carpet baseline A",
  "model_ref": {
    "id": "mdl_8f2c41",
    "content_hash": "sha256:9f1c…",
    "name": "Example 1/10 TC — measured 2026-10-12"
  },
  "parent_id": null,
  "created": "2026-10-12",
  "meta": { "app_version": "0.1.0" },
  "sources": {
    "m1": { "type": "measured", "method": "camber gauge + toe plates", "datum": "flat plate",
            "by": "DW", "date": "2026-10-12" },
    "m2": { "type": "measured", "method": "ride-height gauge", "datum": "flat plate",
            "by": "DW", "date": "2026-10-12" },
    "m3": { "type": "third_party", "by": "setup sheet, P. Smith", "ref": "printed sheet, 2026-09" }
  },

  "conditions": {
    "surface": "carpet", "air_temp_c": { "v": 22.0, "s": "m1" },
    "tyre": { "compound": "handout", "diameter": { "v": 62.0, "s": "m1" } },
    "notes": "club night, fresh surface"
  },

  "corners": {
    "fl": {
      "camber":          { "v": -1.5,  "s": "m1" },
      "toe":             { "v": 0.5,   "s": "m1" },
      "caster":          { "v": 4.0,   "s": "m3" },
      "ride_height":     { "v": 5.0,   "s": "m2" },
      "droop":           { "v": 2.0,   "s": "m2" },
      "spring_rate":     { "v": 3.10,  "s": "m3" },
      "spring_preload":  { "v": 0.5,   "s": "m2" },
      "damper_oil_cst":  { "v": 300.0, "s": "m3" },
      "damper_piston_holes": { "v": 3, "s": "m3" },
      "upper_link_inner_shims": { "v": 1.0, "s": "m1" },
      "upper_link_outer_shims": { "v": 0.0, "s": "m1" },
      "tyre_pressure_kpa": { "v": 240.0, "s": "m2" },
      "wheel_offset":    { "v": 0.0,   "s": "m3" }
    }
  },

  "axles": {
    "front": { "arb_setting": { "v": 0.6, "s": "m3" } },
    "rear":  { "arb_setting": { "v": 0.4, "s": "m3" } }
  },

  "transmission": {
    "diff_front_oil_cst": { "v": 3000.0, "s": "m3" },
    "diff_rear_oil_cst":  { "v": 1000.0, "s": "m3" },
    "diff_height":        { "v": 0.0,    "s": "m3" }
  },

  "analysis_inputs": {
    "lateral_g": { "v": 1.2, "s": "m1" },
    "roll_sweep_deg": { "v": 3.0, "s": "m1" },
    "damping_low_speed_m_s": { "v": 0.05, "s": "m1" },
    "damping_high_speed_m_s": { "v": 0.30, "s": "m1" }
  },

  "notes": {
    "track": "club layout, clockwise",
    "setup": "droop 2 mm front, 3 mm rear",
    "tyres": "handout, 2 runs old"
  },

  "assumptions": ["unsprung mass not measured — treated as 0"]
}
```

Only the front-left corner is shown; `corners.fr`, `.rl`, `.rr` use the same
shape and are omitted for brevity, as is the abbreviated hash.

#### 4.3.1 Field table — setup

| Field | Type | Unit | Req | Consumed by an output? |
|---|---|---|---|---|
| `schema_version` | string | — | yes | — |
| `kind` | string | — | yes | `setup` |
| `id` | string | — | yes | — |
| `label` | string | — | yes | — |
| `model_ref.id` / `.content_hash` / `.name` | string | — | yes | Selects the geometry every output uses (E2.1, E2.7) |
| `parent_id` | string \| null | — | yes | The revision this was copied from; makes history a chain |
| `created`, `meta.app_version` | string | — | yes | Carried in exports (E7.3) |
| `sources` | object | — | yes | As §4.1 |
| `conditions.surface` | enum | — | no | Reference only |
| `conditions.air_temp_c` | value | °C | no | Reference only |
| `conditions.tyre.compound` / `.diameter` | value | mm | no | Diameter feeds contact-patch height; compound is reference only |
| `corners.<c>.camber` | value | deg (negative = top in) | no | yes — contact patch, camber at roll |
| `corners.<c>.toe` | value | deg (positive = toe in) | no | yes — bump steer, ackermann readout |
| `corners.<c>.caster` | value | deg | no | Reference only in v1 (flagged as such, E2.5) |
| `corners.<c>.ride_height` | value | mm | no | yes — static geometry, roll-centre datum |
| `corners.<c>.droop` | value | mm | no | yes — informs the static limits check, not the roll simulation (E3.15) |
| `corners.<c>.spring_rate` | value | N/mm | no | yes — wheel rate, ride frequency, roll stiffness |
| `corners.<c>.spring_preload` | value | mm | no | yes — static ride height / load |
| `corners.<c>.damper_oil_cst` / `.damper_piston_holes` | value | cSt / count | no | yes — with the damper curve, damping ratio |
| `corners.<c>.upper_link_inner_shims` / `_outer_shims` | value | mm | no | yes — changes hardpoint positions, therefore geometry |
| `corners.<c>.tyre_pressure_kpa` | value | kPa | no | Reference only |
| `corners.<c>.wheel_offset` | value | mm | no | yes — track change, scrub radius |
| `axles.<a>.arb_setting` | value | 0–1 fraction of full stiff | no | yes — roll stiffness |
| `transmission.diff_front_oil_cst` / `rear` | value | cSt | no | Reference only in v1 |
| `transmission.diff_height` | value | mm | no | Reference only in v1; listed in the assumptions as not modelled |
| `analysis_inputs.*` | value | g / deg / m/s | yes (defaults offered) | yes — the lateral g, roll sweep and damper speeds actually used |
| `notes.track` / `.setup` / `.tyres` | string | — | no | Exported, searchable |
| `assumptions` | string[] | — | yes | Written by the app; shown on screen and in every export |

### 4.4 Computed outputs — names, units, inputs

Outputs are never stored in a setup file. They are functions of (model revision,
setup, analysis inputs) and are recorded only in exports, where they are labelled
as derived.

| Output | Unit | Depends on |
|---|---|---|
| Motion ratio | – | damper mounts, lower arm, wheel centre, spring location |
| Wheel rate ("ride stiffness") | N/mm | motion ratio, spring rate, spring preload, arb contribution |
| Ride frequency | Hz | wheel rate, sprung mass at that axle |
| Roll stiffness | N·m/deg | wheel rates, track, ARB rate and setting |
| Lateral load-transfer split | % front | roll stiffness front/rear, cg height, roll-centre heights, total mass |
| Roll-centre height (static) | mm | both arms' inboard axes and outboard points, wheel centre, ride height |
| Roll-centre migration | mm per 0.5° roll | as above, swept |
| Camber gain | deg/deg | upper and lower link geometry, upright |
| Camber at roll | deg | camber gain, static camber |
| Bump steer | deg/mm | tie-rod inner and outer positions, lower arm, rack height |
| Damping ratio (low/high speed) | – | damper curve, sprung mass at corner, wheel rate, motion ratio |
| Ackermann / dynamic toe | deg | tie-rod geometry, steering input (readout, not modelled as handling) |

---

## 5. Functional and non-functional requirements

### 5.1 Functional requirements

The capability set, numbered for the plan. Each is proven by the acceptance
criteria named beside it; the ACs are the contract, this list is the map.

| # | Capability | Proven by |
|---|---|---|
| FR-01 | Create, measure, edit and revision a car model, with per-value provenance | E1.1–E1.7, E2.7 |
| FR-02 | Guide the measurement, in physical order, with datums and diagrams | E1.5, E1.10, E5.2 |
| FR-03 | Record mass properties, including a sprung/unsprung split derived from raw readings | E1.8, E1.10 |
| FR-04 | Create, edit and revision setups against a specific model revision | E2.1, E2.2, E2.7 |
| FR-05 | Compute the twelve outputs in §4.4 from a complete model and setup | E3.1–E3.6, E3.9 |
| FR-06 | Show the equation, substituted inputs and units behind every output | E3.7 |
| FR-07 | Handle degenerate and out-of-domain geometry without producing a fake number | E3.8, E3.9 |
| FR-08 | Recomputed continuously while an input is being dragged | E3.12 |
| FR-09 | Validate the model against a measured wheel rate and flag disagreement | E3.13 |
| FR-10 | Compare two setups: input deltas, output deltas, causal inputs, baseline | E4.1–E4.6 |
| FR-11 | Explain any output and any input in place, with definitions that close | E5.1–E5.3, E5.8 |
| FR-12 | State the model's limits on the analysis screen and in every export | E5.5, E7.3 |
| FR-13 | Maintain a local model library with completeness and provenance visible | E6.1–E6.3 |
| FR-14 | Install and share models and setups as files through the OS | E6.2, E6.4, E7.5 |
| FR-15 | Export any model, setup, comparison and sheet; back up and restore the library | E7.1–E7.8 |
| FR-16 | Offer a guided first run from empty install to first delta | E5.7 |
| FR-17 | Work completely with no network, no account and no personal data | E8.1–E8.4, E8.13 |
| FR-18 | Be usable one-handed, in sunlight, with gloves, at 200% text | E8.6–E8.10 |

### 5.2 Performance

**Reference device (the budget's denominator).** A mid-range phone of the class
in a racer's pocket in 2026: 8 cores (2 performance + 6 efficiency, roughly
Snapdragon 695 / Dimensity 700 class), 4 GB RAM, 1080×2400 at 60 Hz, Android 12,
**release build, profile mode, no debugger attached, battery not in saver mode,
device at 25 °C**. Every number below is measured on that device; a faster phone
proves nothing and a slower one is not a release blocker until it is the
reference.

| # | Measurement | Target | Test |
|---|---|---|---|
| P-01 | Full analysis recompute for a complete model (all outputs, both axles, 13-row roll-centre sweep) | **≤16 ms** typical, ≤25 ms at p99 | Timing harness over 1,000 iterations, release build |
| P-02 | Recomputation during a continuous slider drag of 10 s | **≥95% of frames presented within 16.7 ms**; no frame >32 ms | Automated frame-timing capture |
| P-03 | Single-output recompute (one output, one input change) | ≤2 ms | Timing harness |
| P-04 | Cold start to interactive analysis screen | ≤2.0 s | Automated launch test on release build |
| P-05 | Open a stored model | ≤300 ms | Timing harness |
| P-06 | Library list, 200 models, scroll | Sustained 60 fps | Frame-timing capture |
| P-07 | Validate + import a 1 MB model file | ≤150 ms | Timing harness |
| P-08 | Generate a one-page setup sheet PDF | ≤2.0 s | Timing harness |
| P-09 | Peak resident memory during analysis | ≤150 MB | Platform profiler |
| P-10 | Continuous use, 30 minutes | No frame-rate drop attributable to thermal throttling; ≤5% battery on the reference device | Manual, recorded in the release checklist |

**Design consequence:** P-01 and P-02 together mean the analysis must be a
single pure function over a pre-parsed model — allocating a new results object
per frame is acceptable, re-parsing JSON per frame is not. This is a constraint
on the physics package's API (it takes a typed model, not a file) and it is
already implied by the pure-Dart rule.

### 5.3 Reliability and data safety

- The app must never present a number it cannot justify: no `NaN`, no
  `Infinity`, no silent default (E1.2, E1.8, E2.4, E3.8).
- Saves are atomic; a killed process never leaves a corrupt current revision
  (E8.12).
- Every model revision and setup revision is retained until the user deletes it;
  deletion is confirmed and, for models, reported when setups still reference the
  revision being deleted.
- No operation requires a network acknowledgement to complete (E8.1, E8.2).

### 5.4 Accessibility

Target: **WCAG 2.2 AA** for the app's own screens, with the following specifics
treated as the testable subset (E8.7, E8.8, E8.10):

| # | Requirement |
|---|---|
| A-01 | Minimum interactive target 44×44 dp with ≥8 dp separation |
| A-02 | Text scales to 200% (system setting) with no clipping, overlap or loss of a value |
| A-03 | Contrast: 4.5:1 body text, 3:1 large text and non-text UI, both themes |
| A-04 | Never colour alone: every delta carries a sign and a direction word; every chart series carries a line style and a direct label |
| A-05 | Every chart has an equivalent table view reachable in one tap |
| A-06 | Every computed value announces name, value, unit and change state to a screen reader |
| A-07 | Focus order follows reading order; the analysis screen is fully operable by switch access |
| A-08 | No content requires precise dragging: every slider has an alternative stepped input |
| A-09 | No flashing content; no motion that cannot be reduced by the system setting |

### 5.5 Localisation readiness

- All user-facing text lives in externalised resources from the first commit;
  no string is assembled by concatenation (E8.9).
- Plurals and numbers use the platform's locale-aware formatting; units are
  formatted per locale (decimal separator) and converted from storage units once.
- The layout survives a pseudo-locale of +40% string length and an RTL locale
  without clipping or reflow breakage (E8.9).
- v1 ships English only. Whether any translation ships is decision **D10**.

### 5.6 App size and distribution

| Artifact | Target |
|---|---|
| Android App Bundle, phone download | ≤25 MB |
| iOS thinned download | ≤40 MB |
| Installed footprint | ≤60 MB |

No bundled model library beyond the example models (E6.1); no bundled video, no
bundled fonts beyond one variable family; explanations are text, not images.

### 5.7 Maintainability and IP

- The physics package has no Flutter dependency, and a test asserts it
  (review rule 3).
- Every physics function states its units in its doc comment (review rule 6).
- Every constant in the physics carries a citation (review rule 1).
- No forbidden material in the repository or the artifacts, enforced by build
  checks (E5.4, E7.9, E9.4).

---

## 6. Non-goals and out of scope for v1

These are stated so that a reviewer can reject work that drifts into them, and so
that a user is never promised them by accident.

### 6.1 Non-goals (not this product, at any version)

| # | Non-goal | Why |
|---|---|---|
| N-01 | A lap-time simulator | The intent forbids it. Nothing in this app predicts a lap time, and no output is labelled as performance. |
| N-02 | A tyre model of record | A tyre model whose coefficients we cannot measure would launder guesses into "grip" numbers. Absent at v1; if ever added, quarantined and labelled. |
| N-03 | A driving game or a physics sandbox | Different product. |
| N-04 | A telemetry platform | Requires hardware partnerships, real-time ingest and a backend — all excluded by the offline constraint. |
| N-05 | An account system, a cloud service, a subscription | Excluded by the intent and by the funding model. |
| N-06 | Any dependence on a proprietary database engine or an installer | This is the failure that killed the predecessor. |
| N-07 | Reproducing the predecessor's user interface | Its workflows are kept because they work; its screens, icons, wording and name are not. |

### 6.2 Out of scope for v1 (candidates for later)

| # | Deferred | Trigger to revisit |
|---|---|---|
| L-01 | Motor, battery and ESC modelling; dyno analysis | After v1 ships and the geometry core is validated in use |
| L-02 | Acceleration simulation and time-domain chassis roll (E3.15) | After v1; needs a validated damper model and a lateral-g input |
| L-03 | Chassis torsional stiffness, diff-height effect, aero | Each needs measured inputs the app cannot currently obtain |
| L-04 | Droop-limited roll behaviour in the static analysis | Needs a load-path model; v1 states the limit instead of guessing |
| L-05 | Desktop and web builds | Same source, later rendering; v1 is Android/iOS |
| L-06 | Any sync, sharing service or model store (E6.8) | Files work offline; a store adds cost and a trust boundary |
| L-07 | OCR of paper sheets (E2.10), photo/CAD capture (E1.12), sheet-format adapters (E7.10) | Each is a separate feature with its own accuracy problem |
| L-08 | Multi-setup comparison beyond two (E4.8) | Two is the question users actually ask |
| L-09 | In-app teaching videos | Link out (E5.9); never embed or re-host |

---

## 7. Open decisions for the owner

Each entry: the question, the recommendation, and what it costs to get wrong.
These are the decisions the spec deliberately does not make for you.

**D1 — The product name.**
*Question:* ship as "Setup Lab", or name it before the first store submission?
*Recommendation:* treat "Setup Lab" as an internal codename and decide the store
name at least four weeks before first submission, after a store and trademark
search in the app stores and in the RC trade. The name is the one thing that
cannot be changed after reviews, backlinks and community references exist.
*Cost of getting it wrong:* a rename after launch breaks every shared link, every
setup file's `meta`, and the community's memory of the app; a name that collides
with an existing product invites a takedown at the worst moment. The rename
itself is one line of code and a month of everything else.

**D2 — Depth of v1.**
*Question:* geometry + balance only, or wait for damper and motor-dyno parity
with the predecessor?
*Recommendation:* **geometry, balance and static damping ratio — no motor dyno,
no acceleration simulation** (as written in §2). The success test in the intent
is satisfiable entirely by the geometry core; every week spent on the dyno is a
week not spent on the measurement experience that decides whether anyone can use
the app at all.
*Cost of getting it wrong:* aiming for parity delays the first usable artifact by
months and puts the hardest, least-verified part (motor and battery modelling)
in front of the part that makes the app worth installing. Shipping too thin —
geometry without explanations or comparison — produces a calculator nobody
returns to.

**D3 — Tyre model.**
*Question:* ship a crude grip-versus-load model with a warning, or none?
*Recommendation:* **none in v1**, and no composite "grip" or "balance verdict"
score (E5.6). Ship the quantities that do not depend on a tyre model — load
transfer share, camber at roll, wheel rate — and let the user draw the handling
conclusion, which is the skill the app is trying to teach.
*Cost of getting it wrong:* a crude tyre model makes the app *confidently wrong*
in exactly the situation it is consulted for, and the correction — deleting a
number users have built decisions on — costs more trust than never shipping it.
Shipping nothing costs some users the "so which way does it push?" shortcut, and
that is the cheaper loss.

**D4 — Model data from the predecessor, and importing it.**
*Question:* can the chassis/damper/motor model data be obtained from the family,
and may it be imported?
*Recommendation:* **do not import it and do not build an importer** (E7.9). Ask
the family in writing for the *data* under a licence compatible with CC BY 4.0
attribution; until a written answer exists, the library is built from our own
measurements and community re-measurements. A file-format importer is a
reverse-engineering exercise regardless of intent, and it would consume the
goodwill the project depends on.
*Cost of getting it wrong:* building the importer before permission converts a
polite request into a fait accompli, and no licence answer survives that. Waiting
costs library breadth for one release — recoverable. This is the only decision
here that cannot be walked back.

**D5 — How community models are reviewed.**
*Question:* what does a contributed model have to pass before it ships?
*Recommendation:* a **published checklist plus two independent measurement
records, or photographic evidence for every hardpoint, plus a reproducibility
run**: a second person re-enters three random hardpoints from the contributed
worksheet and must land within 0.5 mm. Review happens as a repository pull
request against the model library, with the reviewer named in the file's
provenance. No in-app submission, no voting.
*Cost of getting it wrong:* an unreviewed model is worse than a missing one — it
produces plausible numbers from someone else's measuring error, and the user has
no way to tell. Too strict a bar and the library never grows, which returns the
project to the state it was founded to fix.

**D6 — Storage units in the JSON.**
*Question:* write lengths in mm, or in SI metres to match the physics package?
*Recommendation:* **mm in the file, SI at the physics boundary** (§4.1). Calipers
read mm, every setup sheet in the sport is in mm, and a human-readable file in
metres reads as `0.105` — which is where transcription errors come from. The
units are declared in the file, so a future inches-native file is unambiguous.
*Cost of getting it wrong:* one missed conversion is a silent 1000× error that
looks like a number (review rule 6 exists for this reason). The mitigation is
structural: exactly one conversion site, with its own round-trip tests, and no
arithmetic anywhere on storage-unit values.

**D7 — Where the first shipped models come from.**
*Question:* if the family says no (D4), what ships in the box?
*Recommendation:* **ship exactly one complete example model that we measured
ourselves**, fully sourced, plus a worked measurement session recorded as a
document, and let the community library grow from contributions (D5). Do not
ship ten half-measured models to look substantial.
*Cost of getting it wrong:* a library of unsourced models teaches the user to
trust unsourced numbers, which is the failure mode the whole project exists to
avoid. One honest model plus a guided measurement is a slower start and a much
better second impression.

**D8 — Minimum OS versions and the performance denominator.**
*Question:* Android 8.0 / iOS 15, and the reference device in §5.2?
*Recommendation:* **yes to both**, and buy one cheap reference device, keep it,
and run every performance test on it rather than on a flagship. If the app cannot
hit P-01 on that phone, the budget is wrong, not the phone.
*Cost of getting it wrong:* a budget validated on a flagship ships an app that
stutters on the phones racers actually bring to a track, and the discovery
happens in reviews. Raising the minimum OS later excludes users; lowering it
later is free.

**D9 — Store accounts against "free forever, zero running cost".**
*Question:* who holds the Apple and Google developer accounts, and does the
"zero running cost" claim survive the annual fees?
*Recommendation:* one Google Play account and one Apple Developer account held
personally by the owner, budgeted as a fixed annual cost, and the public claim
phrased as "free to use, no account, no server, no ads" rather than "no cost to
run". Keep the app free with no paid tier.
*Cost of getting it wrong:* an unqualified "zero cost" claim that the owner's own
bank statement contradicts is a small credibility problem now and a large one if
it is ever used to solicit donations. Letting an account lapse unpublishes the
app and orphans every installed copy's updates.

**D10 — Localisation timing.**
*Question:* translate in v1, or ship English and stay ready?
*Recommendation:* **English in v1, fully externalised and pseudo-locale tested**
(E8.9); translate after the explanation text stops changing, because translating
text that is still being rewritten is work done twice. Revisit when the
explanation corpus is stable for two releases.
*Cost of getting it wrong:* retrofitting localisation into concatenated strings
is a rewrite of every screen; translating too early means paying for the same
work repeatedly and shipping explanations that do not match the physics they
describe.

---

## 8. Traceability

### 8.1 Intent statements referenced

| ID | Statement (from `docs/intent.md`, abbreviated) |
|---|---|
| I1 | Model the chassis once and keep the model forever, in a plain-text format the community can version and share |
| I2 | Calculate the properties that matter — camber/toe gain, roll centre and migration, bump steer, wheel rates, motion ratios, load-transfer split, damping ratios |
| I3 | Show the equation behind every number |
| I4 | Compare two setups side by side and say what changed and why it matters |
| I5 | Teach the same concepts at the point where they are used |
| I6 | Run on a phone at the track, offline, no account, no server, no subscription |
| I7 | One codebase, cross-platform, store-shippable, no installer, no proprietary database |
| I8 | Zero running cost |
| I9 | No predecessor code, binaries, help text, iconography or name |
| I10 | Physics as a pure Dart package, unit-testable and reusable headless |
| S | Success test: model in under 30 minutes, predict the direction of a camber-link or roll-centre change correctly |
| N2 | Non-goal: a tyre model of record (ties to §6.1) |

### 8.2 Coverage

94 acceptance criteria across 9 epics: **74 MUST, 13 SHOULD, 7 LATER**.
Verification column: `U` unit, `G` golden value from an external source, `P`
randomised property test, `W` widget/integration, `B` build or CI check, `M`
scripted manual check, `E` usability evaluation on real users.

| AC | Tag | Intent | Verification |
|---|---|---|---|
| E1.1 | MUST | I1, I2 | W |
| E1.2 | MUST | I1, I2 | W, U |
| E1.3 | MUST | I1 | U |
| E1.4 | MUST | I1 | W, U |
| E1.5 | MUST | I1, I5, S | M |
| E1.6 | MUST | I1 | W |
| E1.7 | MUST | I1 | U |
| E1.8 | MUST | I2 | W |
| E1.9 | MUST | I1, I2 | W |
| E1.10 | SHOULD | I1, I5 | M, U |
| E1.11 | SHOULD | I1 | W |
| E1.12 | LATER | I1 | — |
| E2.1 | MUST | I1, I4 | U |
| E2.2 | MUST | I4 | U, W |
| E2.3 | MUST | I1 | U, W |
| E2.4 | MUST | I2, I3 | U |
| E2.5 | MUST | I3, I5 | W |
| E2.6 | MUST | I6 | W, M |
| E2.7 | MUST | I1, I4 | W |
| E2.8 | SHOULD | I1 | U |
| E2.9 | SHOULD | I6 | M |
| E2.10 | LATER | I6 | — |
| E2.11 | MUST | I2, I3 | W, U |
| E3.1 | MUST | I2 | G |
| E3.2 | MUST | I2 | G |
| E3.3 | MUST | I2 | G |
| E3.4 | MUST | I2 | G |
| E3.5 | MUST | I2 | G |
| E3.6 | MUST | I2 | G |
| E3.7 | MUST | I3 | W |
| E3.8 | MUST | I2, I10 | P |
| E3.9 | MUST | I2 | G, W |
| E3.10 | MUST | I10 | U |
| E3.11 | MUST | I10 | G, B |
| E3.12 | MUST | I6 | U (perf) |
| E3.13 | MUST | I2, I5 | W, U |
| E3.14 | SHOULD | I4 | U |
| E3.15 | LATER | I2 | — |
| E4.1 | MUST | I4 | W |
| E4.2 | MUST | I4 | W |
| E4.3 | MUST | I4 | W |
| E4.4 | MUST | I4, I3 | W |
| E4.5 | MUST | I4 | W, U |
| E4.6 | SHOULD | I4, I3 | U |
| E4.7 | SHOULD | I4 | W, M |
| E4.8 | LATER | I4 | — |
| E5.1 | MUST | I5, I3 | W |
| E5.2 | MUST | I5 | W, M |
| E5.3 | MUST | I5 | B |
| E5.4 | MUST | I9 | B |
| E5.5 | MUST | I3, I2 | W, B |
| E5.6 | MUST | N2 | W |
| E5.7 | SHOULD | I5 | W |
| E5.8 | SHOULD | I5 | W |
| E5.9 | LATER | I5 | — |
| E6.1 | MUST | I1 | U |
| E6.2 | MUST | I1 | W |
| E6.3 | MUST | I1 | W |
| E6.4 | MUST | I1, I6 | W |
| E6.5 | MUST | I1 | U |
| E6.6 | MUST | I1 | U |
| E6.7 | SHOULD | I1 | M |
| E6.8 | LATER | I1 | — |
| E7.1 | MUST | I1 | U |
| E7.2 | MUST | I1 | U |
| E7.3 | MUST | I1, I3 | U |
| E7.4 | MUST | I1, I4 | W, M |
| E7.5 | MUST | I1 | U |
| E7.6 | MUST | I1 | U |
| E7.7 | SHOULD | I4 | U |
| E7.8 | SHOULD | I1 | U |
| E7.9 | MUST | I9 | W |
| E7.10 | LATER | I1 | — |
| E8.1 | MUST | I6 | B |
| E8.2 | MUST | I6 | M |
| E8.3 | MUST | I6 | W, M |
| E8.4 | MUST | I6 | B, M |
| E8.5 | MUST | I6 | U (perf) |
| E8.6 | MUST | I6, I7 | W |
| E8.7 | MUST | I6 | M, W |
| E8.8 | MUST | I6 | M |
| E8.9 | MUST | I7 | W, B |
| E8.10 | MUST | I6 | M |
| E8.11 | MUST | I7 | B |
| E8.12 | MUST | I1 | U |
| E8.13 | MUST | I6, I8 | B |
| E9.1 | MUST | I1 | W |
| E9.2 | MUST | I1 | B |
| E9.3 | MUST | I9 | M |
| E9.4 | MUST | I9 | B |
| E9.5 | MUST | S | E |
| E9.6 | MUST | I9 | W |
| E9.7 | SHOULD | I6 | W |
| E9.8 | MUST | I10 | B |

Every AC maps to at least one intent statement; every intent statement apart
from I8 (running cost, served by E8.13 and D9) is served by at least two ACs.
No AC exists that serves no intent — that check belongs in `spec:audit`.

---

## 9. Evidence base, and what it changed

The corpus was read as evidence of what users ask for and what vocabulary they
use, never as a source of sentences. Files read for this version:

- `docs/intent.md` — complete.
- `AGENTS.md`, `docs/review-rules.md`, `docs/LICENSING.md`, `DEDICATION.md`,
  `docs/research/README.md` — complete.
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
   every input has a "how do I measure this" entry (E5.2).
3. **Live, quantified deltas are the feature that made the tool teach.** The
   later versions added charts that update as a value is changed, compare against
   a selected baseline, and quantify *how much* of a change was made, with the
   ability to isolate one effect. That is E3.12, E4.1–E4.6, and it is why the
   performance budget exists at all.
4. **Overwriting a known-good setup is a documented failure.** The author warns
   users, in his own words, that saving after experimenting overwrites the setup
   the graphs were comparing against. Hence E2.2, E2.7 and the baseline concept
   in E4.5.
5. **Printing and notes are how the track session actually works.** Requests for
   a one-page summary and for separate track/setup/tyre notes recur. Hence E7.4
   and E2.8.
6. **Export anxiety is real.** Users were told to back up the database and export
   models as text because a glitch would lose their work; schema changes were
   resisted for fear of data loss. Hence E7.1–E7.6 and the migration fixtures in
   E9.2.
7. **The gaps are documented, so v1 names them.** Tyre behaviour is absent by
   design, the diff-height torque effect was explicitly declined, ackermann was
   never modelled as a handling influence, and droop limits sat outside the
   charts because they depend on the handling condition. §6 and E5.5 carry each
   of those forward explicitly rather than letting users discover them.
8. **Library growth was the author's own biggest problem** — he could not get his
   hands on every chassis. That is why the contribution path (E6.7) and the
   review bar (D5) are specified rather than assumed.

---

## 10. What changes at v0.2

- Decisions D1–D10 resolved and folded into the ACs, with the ACs they unblock
  marked.
- A per-epic effort estimate and build order in `plan.md`, starting from Slice 0
  (§2.3).
- Golden test cases named per output in `docs/specs/physics/`, each with its
  citation.
- A screen inventory from the design agent, cross-checked against E2.6, E8.6 and
  E8.7.

