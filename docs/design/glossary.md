# Glossary & copy deck — Setup Lab

In-app terminology and the exact words used when the app cannot produce a number.
Both are shipped strings, not documentation: keep them short enough to read in a pit lane.

Sources for the vocabulary (not for the wording): Bob Wright's *Science of Setup* article
index and the RC Tech thread in `docs/research/`. Wording here is our own. Nothing in this file
may be copied from RC3's help text.

---

## 1. Rules for these strings

- **Second person, present tense, no filler.** "How much camber the wheel picks up", not "This
  field denotes the rate at which camber is acquired".
- **A number always carries its unit** and its sign convention ("higher", "more negative").
- **No handling verdicts.** The app says what moved, never what the car will do. "Moves 6% of
  the load transfer to the front", never "this will understeer".
- **Never the old app's names for its opaque inputs.** There is no field called *arm movement*
  and none called *unsprung weight*; both are computed or measured by recipe.
- **"We" appears only in the cannot-compute sentence**, where it is doing honest work.

---

## 2. Core glossary — the eight terms the app leans on

Each entry: the one-liner the app shows in the Why sheet, the sentence a club racer would
actually say, and where the term surfaces.

### Roll centre
The height the car rolls about at one end, found by extending the suspension links until they
meet in front view. Raise it and that end rolls less but takes more of the weight transfer —
which is why raising the front roll centre puts *more* weight on the front, not less.
*Where:* Analysis card 3, measure groups Front and Rear, concept "Roll centre".

### Camber gain
How much camber the wheel picks up as the suspension compresses — normally quoted per 10 mm of
bump, and it is what keeps the tyre flat as the chassis rolls. More gain keeps the outside tyre
flatter in a corner but makes the car more sensitive to ride height and roll.
*Where:* Analysis card 4, front geometry measurement, concept "Camber and camber gain".

### Bump steer
Toe change as the wheel moves up and down, caused by the tie rod swinging through an arc that
does not match the suspension's arc. A car with bump steer steers itself over bumps and curbs,
so the driver feels it as a car that will not hold a line.
*Where:* Analysis card 5, steering measurements, concept "Toe, bump steer and Ackermann".

### Wheel rate
The spring rate the tyre actually feels, after the linkage has moved the spring less than the
wheel. It is the number to compare when you change shock position, because a stiffer spring in
a worse position can be softer at the wheel.
*Where:* Analysis card 6, spring and damper measurements, concept "Springs, bars and roll
stiffness".

### Motion ratio
How far the spring or shock moves for each millimetre the wheel moves: a motion ratio of 0.65
means 0.65 mm of shock travel per 1 mm of wheel travel. Wheel rate is spring rate multiplied by
the motion ratio squared, which is why small geometry changes bite harder than they look.
*Where:* inside Analysis card 6, and the optional ruler check in the damper group.

### Load transfer
The weight that moves from the inside wheels to the outside wheels in a corner. The *total* is
fixed by the car's mass, its centre of gravity height, its track width and how hard it is
cornering — the setup does not change it. What you tune is how much of it the front takes,
which is what racers call balance.
*Where:* Analysis card 1, concept "Load transfer and balance".

### Damping ratio
How well the shock controls the spring, as a fraction of the damping that would stop it
oscillating at all. Under about 0.3 the car keeps bouncing after a bump; around 0.6–0.7 it
settles in one movement; well over 1 it feels dead and skips over the surface.
*Where:* Analysis card 7, damper group, concept "Dampers and damping ratio".

### Droop
How far the suspension hangs down from ride height when the car is lifted, before it hits the
droop screw or a limiter in the shock. Run out of droop and the inside wheel stops extending, so
that corner lifts and the car rolls onto the outside tyre sooner — droop is a roll control you
can feel but cannot see.
*Where:* Setup values §1, Bench measurement group, concept "Roll stiffness".

---

## 3. Also used — one line each

| Term | Line |
|---|---|
| **Bump** | Suspension compressing (wheel moving up). "10 mm bump" means the wheel moved 10 mm up from ride height. |
| **Roll stiffness** | How much torque it takes to roll the chassis one degree, from springs and bars together. More at one end means that end takes more load transfer. |
| **Camber link** | The upper link on a touring car that sets camber gain and, with its inner mount height, the roll centre. |
| **Toe gain** | Toe changing as the suspension moves. On the front it is bump steer; on the rear it is what makes a car feel nervous or planted under load. |
| **Hardpoint** | Any pivot or mount point with a position on the car. The geometry is just a list of these. |
| **Shim gain** | How far a pivot actually moves per millimetre of shim, which is not 1:1 when the mount sits on an angled plate. |
| **Corner weight** | The load under one wheel with the car on scales. Gives front/rear distribution and cross-weight. |
| **Baseline** | The setup you are judging changes against. One per car, and it can be moved. |
| **Undefined** | All the numbers are present but the maths has no answer for this geometry — usually links that are parallel or pivots in the same place. |
| **Approximate** | A value you marked as an estimate. Shown with a `~`, plus its stored tolerance if the source recorded one — never a tolerance the app invented. |
| **Inherited** | A value that came from another car's model, a template, or another user's sheet. Shown with a `↳` and the source named. Never presented as if you measured it. |
| **Validated / not validated** | Whether a computed number has been checked against a bench measurement. In v1 every number reads **computed, not yet validated**; the hollow ring after the value is that state. |
| **Inferred, not a measured quantity** | The third state: the quantity is defined by a model rather than measured on a car, so there is nothing to validate it against — damping ratio is the case in v1. Shown with a struck ring and its band. |
| **Sheet** | A saved snapshot of a whole setup at a moment, with optional conditions and a note. What used to live on paper. |
| **Tier** | How far the physics reaches for a claim: **Firm** (from the equations), **Inferred** (steady-state reasoning, always *all else equal*), **Speculative** (needs a model or measurement the app does not have). |
| **Inference** | A sentence the app will say but cannot compute — balance direction, and anything about grip. No number, no badge, no ring. |
| **Push / loose** | Words this app does not use. It says **understeer** and **oversteer**. |

---

## 4. The "we cannot compute this" deck

Three distinct sentences, never interchangeable. A missing input is a job for the user; an
undefined geometry is a fact about the car; an extrapolation is a warning about the edge of the
model.

### 4.1 By property

| Property | Required inputs | String when missing |
|---|---|---|
| **Load transfer — total** | mass, CG height, track width | **Not computable yet** — Total load transfer needs the car's mass, its centre-of-gravity height and its track width. `Add them ›` |
| **Load transfer — front/rear split** | front and rear roll stiffness; front and rear roll centre heights | **Not computable yet** — The total is {total} g at {g}, but the split needs spring rates and roll centre heights at both ends. `Add them ›` |
| **Roll stiffness** | spring rate F/R, motion ratio F/R, ARB rate F/R | **Not computable yet** — Roll stiffness needs the {end} spring rate. `Add it ›` |
| **Roll centre** | front-view pivot heights and lateral positions, both ends | **Not computable yet** — Roll centre needs the {end} upper or lower inner pivot height. `Add it ›` |
| **Camber gain** | upper and lower pivot positions F/R, wheel centre, tyre diameter | **Not computable yet** — Camber gain needs the {end} upper pivot position and the tyre diameter. `Add them ›` |
| **Bump steer** | tie rod inner and outer points, steering arm geometry | **Not computable yet** — Bump steer needs the {end} tie rod inner point. `Add it ›` |
| **Wheel rate** | spring rate, motion ratio (shock mounts + arm pivots) | **Not computable yet** — Wheel rate needs the {end} spring rate. `Add it ›` |
| **Damping ratio** (an estimate in v1) | damper model — oil, piston holes or a dyno curve — plus wheel rate and sprung mass at that corner | **Not computable yet** — Damping ratio needs the {end} damper's oil and piston holes, or a measured drop test. `Add it ›` |

Where `{end}` is "front" or "rear" and `{total}`/`{g}` are filled from whatever *is* computable,
so a partial result still teaches something instead of going blank.

### 4.2 Degenerate geometry — the maths has no answer

| Reason code | String | What to check |
|---|---|---|
| `parallel-links` | **Undefined for this geometry** — The {end} upper and lower links are parallel in front view, so the instant centre is at infinity and the roll centre has no height. | Two pivot heights are probably identical by typo. |
| `coincident-pivots` | **Undefined for this geometry** — The {end} inner and outer pivots are in the same place, so the link has no direction. | A value is duplicated between two fields. |
| `zero-track` | **Undefined for this geometry** — Track width is zero, so load transfer divides by nothing. | Track width taken as a half-width, or a unit error. |
| `zero-wheelbase` | **Undefined for this geometry** — Wheelbase is zero or the axles are in the same place. | Front and rear measurements taken from different datums. |
| `tie-rod-degenerate` | **Undefined for this geometry** — The {end} tie rod is parallel to the arm it follows, so toe does not change with bump. | Usually correct on a well-designed car — verify the two inner points. |
| `no-spring` | **Undefined for this geometry** — No spring rate is fitted at the {end}, so there is no wheel rate. | A zero spring rate on a car that has springs. |

Rule: the string names the *reason* in the first clause and the *check* in the second. Never
"invalid input", never "error".

### 4.3 Extrapolation, estimates, and other honesty labels

| Situation | String |
|---|---|
| Value beyond measured travel | **Outside your measured range** — The solid line is within the travel you measured; the dashed part is an extrapolation. |
| Inputs marked approximate | **Approximate** — {n} inputs are estimated. `See which ›` (each row shows its own tolerance, or none) |
| Inputs from a template or another sheet | **Inherited** — {n} values come from the {template/sheet} and were not measured on your car. `Review ›` |
| No bench evidence for an output | **Computed, not yet validated** — every number here was computed from your model and the published equations; none has been checked against a bench measurement yet. |
| Bench evidence exists | **Validated against a bench measurement** — {property} within {tolerance} over {n} cases, {date}. |
| Two sheets from different conditions | **Different conditions — not like-for-like** — {fields that differ}. The firm rows still hold; the balance inference and the grip strip do not. |
| Conditions not recorded on a sheet | **No conditions recorded** — this diff cannot say whether it is like-for-like. |
| A claim about grip | **Inference, not a value** — the load moved; what the tyre did with it is not modelled, so no number is given. |
| CG height, derived | **Derived, not measured** — {route}, {band}. Total transfer and roll angle move with it; the balance split does not. |
| Setup came without mass or CG | **Results can't be recomputed** — This setup came without corner weights, so only its own inputs can be compared. |
| Comparing different chassis | **Different chassis geometry** — The deltas are real, but they are not like-for-like. |
| Analysis computation threw | **Something in the maths failed** — The other {n} properties are unaffected. `Copy diagnostics` |
| Car file unreadable | **This car couldn't be opened** — The rest of your garage is fine. `Export raw file` `Repair` |

### 4.4 The rule behind the deck

There is no state in which the app renders a numeral it cannot defend, and no state in which the
absence of a numeral is unexplained. Every blank space on screen is either a `missing` badge that
names its input and links to the task, or an `undefined` badge that names the geometry reason and
links to the fields. Nothing else is allowed to be empty.

---

## 5. Voice, in five lines

1. **Short sentences, active voice, no adjectives of quality.** "Front roll centre: 22 mm", not
   "an excellent front roll centre of 22 mm".
2. **Unit in the label, not the tooltip.** Every input shows its unit beside the box.
3. **Direction words, never verdicts.** *More front load transfer*, *less camber gain*, *softer
   at the wheel* — not *tighter*, *looser*, *understeers*.
4. **No apology, no exclamation, no emoji.** "Not computable yet" is a fact, not a failure.
5. **One idea per screen.** If a screen needs a paragraph to explain itself, the screen is wrong.
