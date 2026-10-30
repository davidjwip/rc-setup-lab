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

**E4.8** — *Given* three or four setups, *when* the user compares them together
in one view with per-output ranking. **LATER**

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
"assumptions and limits" entry is present in one tap, naming what the model does
not include for this build (at minimum: no tyre model, no aero, no chassis
flex, no diff-height effect, no droop-limit interaction in the static analysis),
and the same text is carried in every export. **MUST**

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

**E6.8** — *Given* an internet connection, *when* the user browses models inside
the app and installs one without leaving it. **LATER**

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

<!--APPEND-->
