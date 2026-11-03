# Wireframe notes

Nine self-contained HTML files in `wireframes/`, each fixed at **390 × 844** and laid out for a
phone. Open them directly from disk — no server, no build step, no network. `wireframes/index.html`
lists all nine; `design-notes.html` is the live token board.

Each file has an annotation rail to the right of the phone (hidden under 780 px) with a theme switch
and, where the screen has one, a state toggle. Press **T** anywhere to flip dark ↔ light. The rail
links back to `index.html` and to the token check.

**Every frame that shows a number is labelled `Example data` inside the frame**, with what the
values are: synthetic, equation-consistent, not a real car. That label is part of the design, not a
caption for reviewers — a screen that invents a number to look finished is the failure this whole
revision exists to close.

**Two marks on every value, and they answer different questions:**

| Mark | Question | v1 answer |
|---|---|---|
| Provenance badge — `computed` · `estimated` · `inherited` · `missing` · `undefined` | Where did this number come from? | Mixed, and shown honestly: a template hardpoint reads `↳22` with `inherited`, an approximation reads `~2.8 ±0.2` or `~2.8` and nothing else |
| Validation ring — hollow / filled / struck | Has anyone checked the answer? | **Hollow everywhere**, v1 ships as `computed, not yet validated` — except damping ratio, which is `inferred · not a measured quantity` (struck ring), because there is no measurement to validate ζ against (E3.6c) |

---

## A — Garage (`garage.html`)

The landing surface answers one question before the user has scrolled: which car am I working on.
Completeness is the second read, because an unmeasured chassis silently ruins every number
downstream — so an incomplete car is a first-class card with an honest 31 / 42, not an error toast.
Cards carry only what a racer would say out loud: class, when it last ran, and the one number that
predicts the car's behaviour — that number carries its ring. The empty state explains the model-once
premise instead of apologising for having no data. "Add a car" sits in a sticky bottom bar so the
primary action is under the thumb.

**States to try:** "Empty state" in the rail.

## B — Car model / hardpoints + chassis (`hardpoints.html`)

This is the slowest, most error-prone task in the app, so it is the calmest screen. A pinned
front-view schematic stays at the top while the fields scroll under it; the row being edited lights
its own dot on the drawing, so the value and the part are never separated. Hardpoints are 3D, but the
field labels are the three directions a person actually measures — forward from the axle, out from
the centreline, up from the floor — with X/Y/Z as secondary notation. One corner is measured and
mirrored; progress is stated honestly with a time estimate.

Row C is **template-sourced** and demonstrates the fifth badge: `↳12.5 · 40.0 · 56.0`, an
`inherited` chip, the template named, and *Measure mine* one tap away. That value feeds the front
roll centre, which is why the Analysis roll-centre card shows the same badge.

The **Chassis** tab holds the two cards that are not hardpoints:

- **Chassis plate** — material chips, thickness, optional measured torsion, and a torsion estimate
  that only exists while the measurement does not. It ends with **What the plate changed**: roll
  centre *unchanged* (the correction the feature exists to make), ride height, mass, CG height, and
  the front share of roll stiffness — each with a direction and a ring.
- **Mass & CG** — CG height with its **derivation route** (plumb-line / component estimate /
  another car), never `computed` and never "imported from scales", plus the two columns that matter:
  what the value makes uncertain (total transfer, roll angle) and what it leaves robust (the balance
  split).

**States to try:** tap any row to expand it and watch the diagram follow; switch the segment to
**Chassis** for the plate and CG cards.

## C — Setup editor (`setup-editor.html`)

Four groups, one gesture, no nested navigation. The number is the control: drag the rail or tap the
number to type, and there is no duplicate stepper beside the slider. Every rate row prints its
consequence underneath — wheel rate, motion ratio, share of roll stiffness — because that is the
whole point of the app. The rear bar row shows an `inherited` badge: it came from S02, another
user's sheet, and says so.

**States to try:** "New sheet (empty)" in the rail — **every row starts empty**. That state is the
design: sections report `none set`, the analysis preview reads `0 of 7 computed`, and the only two
actions are *Copy from a sheet…* and *Set values by hand*. There are no template defaults for a
setup, because a setup is the record of what was run.

## D — Analysis (`analysis.html`)

The payoff screen: seven properties, front and rear, against a baseline, under a **validation strip**
that says `computed, not yet validated` and `0 of 7 bench-checked` once for the screen while every
value carries its own ring. Load transfer leads. Every card below is the same anatomy: label, a
`FRONT` and a `REAR` column at equal weight, **one delta chip per value**, its provenance badge where
it is not `computed`, and a disclosure that opens the equation, its substitution and one sentence of
meaning — with the validation statement in the panel footer.

Two cards carry the harder honesty:

- **Roll centre** — front value inherited from the MTC2 template, source named under the value.
- **Camber gain** — front shows `~3.95 ±0.12` because the sheet stored a tolerance; rear shows
  `~3.50` and nothing else because it did not. The app never invents the missing band.
- **Load transfer** — the hero carries the CG caveat: the *share* is robust to CG height, the total
  and the roll angle are not.
- **Damping ratio** — an estimate in v1, and it **leads with direction and magnitude**: "rear oil
  350 → 400 cSt: more damping at the wheel, ζ +0.04", then `~0.42 ±0.06` per corner at **two shaft
  speeds** (5 and 300 mm/s), then *What changes this* (oil, piston holes, spring rate, shock angle).
  The band is the damper model's, and it prints here, on compare and on the export. With no damper
  data the card reads *Not computable yet* and keeps the panel.

**States to try:** open the roll-centre card, then "Missing input" (two cards read *Not computable
yet*, header drops to 5 of 7) and "Parallel links" (*Undefined for this geometry*). Only the affected
column changes; the rest of the model keeps its numbers.

## E — Compare (`compare.html`)

A reading instrument, not a diff viewer. **Consequences lead** (D-03): the sentence about what the
change does sits directly under the two slot cards, with the validation state attached; **What you
changed** is a collapsed list one tap below it. The table gives aligned digits down a column, one
delta chip per value, a ring on every cell, and an `inherited` marker on the row that came from the
template. Delta is always the third column, never a colour washed over the value, and it is neutral —
up is not better. Unchanged rows exist behind a "changed only" filter, so nothing is silently hidden.
The screen ends in a sentence, because three mechanical changes should resolve into one handling
consequence.

**States to try:** the swap icon (A and B exchange and every delta flips sign); "Changed only" to
reveal the unchanged rows.

## F — Learn (`learn.html`)

One concept, one diagram, one equation, and the user's own number at the end of it. The diagram
carries the argument: the same construction in two states, so the reader sees where the roll centre
comes from and what happens when the links stop converging. Prose is set at a reading size and
measure, deliberately different typography from the dashboards, and the equation block is monospaced
with a symbol legend underneath. The closing callout ties the concept to this car's 22 mm — and
carries the same validation words as the analysis, because a number quoted in prose is still a
number.

**States to try:** "Links parallel" (in the figure and in the rail) — the construction flattens onto
the ground and the roll centre stops following ride height.

## G — Setup-sheet library (`sheets.html`)

The car's memory. Newest first, baseline pinned, and each row carrying the things a diff will need:
date and time, name, the user's note, **optional conditions** (surface, temperature, humidity, free
text for tyres and motor), changes vs the previous sheet, how many values are set, and analysis
health. An imported sheet is marked `inherited` with the source. A pair picker at the top starts a
diff between any two sheets, not just consecutive ones.

**States to try:** "Empty library" — no sheets, no numbers, and two explicit ways to start.

## H — Sheet diff + interpreter (`sheet-diff.html`)

Three things in a fixed order, because the order is the argument:

1. **Conditions** — a field-by-field match/differ table, then one banner: *Comparable*, **Different
   conditions — not like-for-like**, or **No conditions recorded**. It appears before any claim.
2. **What this did**, in three labelled tiers. **Firm** rows give the geometry and rate changes with
   their numbers and rings. **Inferred** rows state the balance direction and must say **all else
   equal**, plus *Reverses if* and *What it does not claim*. **Speculative** rows name the question
   and refuse it — entry and exit are not modelled, and the panel says so rather than estimating.
3. **What you changed**, grouped by area, changed values only.

Grip never appears as a number: it renders as a hatched **inference strip** with no numeral, no unit
and no badge, because grip is a tyre property this build does not model. Vocabulary is understeer /
oversteer, entry / mid / exit throughout.

**States to try:** "Conditions match" in the rail — the warning gives way to *Comparable* and the
Inferred tier un-dims.

## I — Exported sheet (`export-sheet.html`)

The surface that leaves the phone, so the caveat has to travel with it: a ring after every value, and
a foot block with the words in full, the input-provenance counts, the app and schema version, the
generation date, and the line *a record of what was run, not a validation certificate*.

**States to try:** "Validated variant" — the same sheet once a bench case exists. Only two things
change: the marker fills and the sentence becomes the evidence. Nothing moves, so a sheet printed
last month stays comparable with today's.

---

## What these wireframes deliberately do not do

- **No application code.** Layout, tokens and component behaviour are specified in
  `docs/design/design-system.md`; these files are the visual reference, not the implementation.
  (They happen to be HTML, which under D-19 makes them closer to the product than they were — but
  they are not the product, and they carry invented data.)
- **No real data layer.** Values are chosen so the equations check out, and every frame says so.
- **No RC3 resemblance.** No borrowed screens, wording, help text or icons. The vocabulary
  (hardpoint, droop, roll centre, motion ratio, load-transfer split) is the community's, not any one
  application's.
- **No responsive web design.** The phone is the product. Above 780 px the annotation rail appears
  beside the frame; below it, the frame fills the viewport.
- **No four-tab navigation.** Three destinations — Garage · Compare · Learn (D-01). Everything else
  is a push inside Garage.
