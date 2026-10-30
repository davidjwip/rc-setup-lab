# Review 02 — Practicability, measurement realism and honesty of claims

**Round:** 1 · **Reviewer role:** hostile club racer with a caliper and a sceptical streak
**Documents:** `docs/specs/physics/00-overview.md`, `01-coordinates-and-hardpoints.md`,
`99-validation.md`, `02`–`07` where they carry a sensitivity claim, against `docs/specs/spec.md`
and `docs/intent.md`. Design cross-checked against `docs/design/screens.md` §13–16 and
`docs/design/flows.md` §6.4.
**Not in scope:** elegance of the maths, choice of wheel model, file-format design.

**Method.** I did not take the sensitivity claims on trust. I re-implemented module 2's four-bar
(circle intersection, static branch, bisection on crank angle) and module 6's load-transfer algebra
from the text and reproduced the documents' own worked examples exactly:

| Check | Spec | Mine |
|---|---|---|
| `02` §6.1 instant centre | (−435.691, 60.509) mm | identical |
| `02` §6.2 roll-centre height | 9.9749 mm | 9.9749 mm |
| `02` §6.3 camber gain κ | −0.10982 °/mm | −0.109816 |
| `02` §6.4 camber at +2 mm | γ_kp = −8.2515°, Uₒ = (72.8018, 45.9419) | identical |
| `06` §6.5 balance | 56.14 % front | 56.144 % |

So where a number below disagrees with the spec, the disagreement is in the spec's claim, not in my
transcription of its model.

**Verdict in one paragraph.** The physics documents are far more honest than the product built on
top of them. Modules 2–7 state their own limits with unusual candour, and `99 §1` says plainly that
"every number in modules 2–7 is L0 + L1 today. Not one is L2." That sentence never reaches the
screen: `spec.md` contains no acceptance criterion for a validation state, and the design renders a
computed value as a solid number with no caveat whenever its inputs are `measured` *or* inherited
from a library. Meanwhile the error budget those documents rely on (0.16 mm of roll centre per mm of
hardpoint error) is wrong by an order of magnitude, the two normative documents describe two
different coordinate frames, two of the twelve promised outputs cannot be computed from the file
format the spec defines, and the only validation test that could catch the app's most self-doubted
number needs a rig no club racer owns. For the most common user — a box-stock car, no measurements
taken — the app is a digital setup sheet and cannot legally display a single computed number.

---

## 1. Findings

### BLOCKER

**P-01 — The roll-centre sensitivity that the whole precision policy rests on is wrong by ~11× and
has the wrong sign.**
`02-front-view-kinematics.md` §9, restated in `01` §4 and in `99-validation.md` §2.1 and §7.

The claim is "Lₒ.z +0.1 mm → +0.0165 mm of z_rc", i.e. 0.165 mm of roll centre per mm of hardpoint
error, and it is used four times: to justify the ±2 mm V3 pass mark, to set the 0.1 mm display
precision, to say a "0.5 mm error in a ball joint centre is worth ~0.08 mm of roll centre height"
(`01` §4), and to argue "roll-centre height is *not* hypersensitive on this geometry" (`02` §9).

Perturbing the reference car's actual `Lₒ`:

| Perturbation | Spec | Actual |
|---|---|---|
| `Lₒ.z` +0.1 mm | +0.0165 mm | **−0.187 mm** |
| `Lₒ.z` +0.2 mm | +0.0330 mm | −0.375 mm |
| `Lₒ.z` +0.5 mm | +0.0824 mm | −0.946 mm |
| `Lₒ.y` +0.1 mm | — | −0.019 mm |

The spec's *ratios* (0.165–0.19) match a perturbation of `Lₒ.y`, not `Lₒ.z`, so the table appears to
have been computed on one axis and labelled on another — and its sign is inverted either way. The
true vertical sensitivity is ~1.9 mm/mm: a 0.5 mm error in the lower ball joint's height moves the
roll centre 0.95 mm, roughly **twice the effect of a 1.0 mm shim at the camber-link inner point**
(−0.45 mm, measured). One hardpoint, measured as carefully as the protocol asks, swamps the setup
change the user came to evaluate.

*Fix:* recompute §9 across all three coordinate axes of all four links, publish the Jacobian rather
than three rows, and derive §7's precision table from it. Then either display roll centre to 1 mm
with a stated band, or show it only as a migration line.

**P-02 — The L0–L3 ladder exists only in the physics document, so no acceptance criterion can put
it on the screen, and the product spec does not require it.**
`99-validation.md` §1, §8.4 vs `spec.md` Epics E3, E5 (94 ACs) and `docs/design/screens.md` §0.2.

`99 §1` says "The UI must show which [level]" and `§8.4` makes "every number still unvalidated at L2
carries its caveat string" a release gate. `spec.md` never mentions the ladder; its nearest ACs are
E5.5 (a limits list naming tyre behaviour, aero, chassis flex, diff height, droop) and E3.7 (show the
equation). Neither requires a *validation state*. The design's value badge (§0.2) has exactly four
variants — `computed`, `estimated`, `missing`, `undefined` — and `computed` is defined as "all inputs
measured or library-sourced", rendered as a **solid numeral**. So a roll-centre height produced by an
unvalidated model, from a library car's hardpoints, appears as `9.97` with a unit and no mark, which
is precisely what `docs/intent.md` forbids.

*Fix:* add `E3.16 — every displayed output carries a validation state from {L0+L1, L2, L3} and a
caveat string while it is not L2; the caveat is present on the analysis screen, the property detail,
the comparison row and every export; a build check fails if any output id has no state.` Then add a
fifth badge variant and make `99 §8.4` traceable to it.

**P-03 — Two normative documents define two different coordinate frames and two different storage
unit systems.**
`spec.md` §4.2 vs `00-overview.md` §2 and `01-coordinates-and-hardpoints.md` §2, §5.

| | `spec.md` §4.2 | `01` §2 |
|---|---|---|
| y axis | **Y to the right** | **y positive to the left** ("state loudly") |
| origin | flat plate, **mid-wheelbase**, centreline | flat plate, **rear axle line** |
| x of the front axle | ≈ 0 | +257 |
| units on disk | **mm**, `mass` in **g** | **m**, `kg`; `00` §2 says "SI: m, kg, N/m" and calls a mm file a hazard |

Every camber and toe sign, every mirrored point, every shared model file depends on the first row;
every worked example in `01`–`07` (which are in mm) depends on the third. `01` §5's example file is
in metres and `spec.md` §4.2's is in millimetres, so the two "same" documents cannot both be right.

*Fix:* one frame (recommend `spec.md`'s Y-right / mid-wheelbase, because it matches every published
alignment convention a racer reads), one storage unit (mm), and delete the contradicting prose in
`00` §2 and `01` §2. Then re-derive `01` §8's worked example, `02`'s IC signs and the mirror test
G01.1 from the surviving convention.

**P-04 — Two of the twelve promised outputs cannot be computed from the file format the spec
defines.**
`spec.md` §4.2.1 / §4.3.1 vs `05-rates.md` §2 and `07-damping.md` §2.1.

§4.4 promises roll stiffness and damping ratio. Module 5 needs bar **diameter, effective span
`L_bar`, arm length `a_arm`, material `G`**; the car model carries only
`axles.<axle>.arb.rate_at_full_stiff` (a bench-measured rate in N/mm at the link) and no bar geometry
at all. Module 7 needs **`A_p` (displaced piston area), hole count, hole diameter `d_h`, `F_bo`,
`c_post`**; the setup carries `damper_piston_holes` and `damper_oil_cst` and nothing else. As
specified, roll stiffness and damping ratio are not computable from a conforming file, yet both have
analysis cards.

*Fix:* either add `arb.{diameter, span, arm_length, material}` and
`damper.{piston_bore, shaft_dia, hole_dia, f_blowoff, c_post}` to the schema with provenance, or move
both outputs to "not in v1" and delete their cards. Do not leave them as derived-from-nothing.

**P-05 — The design reintroduces the fabricated numbers the spec spends an epic forbidding.**
`screens.md` §13 "empty" state, §0.2; `flows.md` §6.4.

Three separate leaks:

1. *"new setup created from template defaults: every row has a value"* — directly contradicts E2.4
   ("the field is absent from the file (not defaulted to a number)") and E1.1. A new setup on a
   measured car inherits someone else's spring rates and ARB setting and computes confidently.
2. `flows.md` §6.4: *"Approximate — `estimated`, value kept, **tolerance ±15%**"* — a fixed numerical
   tolerance attached to every estimated input regardless of field. CG height (±15% is generous,
   ±50% is realistic), a shim thickness (±0), and an unsprung mass are not the same quantity. No
   spec defines ±15 %; `spec.md` §4.1.4 makes `tolerance_pct` an optional *per-source* field, so the
   design invents a number when the field is absent.
3. `screens.md` §0.2: `computed` = "all inputs measured **or library-sourced**". A library value is a
   different chassis's measurement — the single most dangerous provenance in the model — and it
   renders as a solid numeral while a genuinely-measured-then-hedged value gets a tilde.

*Fix:* delete template defaults (a new setup starts empty with a `missing` analysis); make the
estimated badge show the stored `tolerance_pct` or nothing; give `library` its own badge with an
inherited-car name.

---

### MAJOR

**P-06 — CG height is a required field that almost no club racer can measure, and the spec's own
example lies about how it was obtained.**
`spec.md` §4.2.1 (`cg.height` **Req**), `06` §4 input table ("**assumed** unless measured"),
`01` §8.1 ("assumed"), `spec.md` §4.2 example source `s3` = "corner scales" for `cg.height`.

Corner scales weigh the car; they cannot locate its centre of gravity. Measuring h on a 1:10 car
needs a raised-axle weigh test (two scales, a known height, and a repeatable lift) or a tilt rig —
and E1.10's recorded procedure covers only the sprung/unsprung split and ride stiffness, not h. So
the field is required, unmeasurable by the stated equipment, and the example model teaches the wrong
provenance. Honest consequence, for the record: because the field is `Req`, the model cannot be
"complete" without a number the user has to guess.

For the record, the actual sensitivity is more forgiving than `06 §4.5` claims and less forgiving
than `99 §7` assumes: over h = 24…32 mm the **balance** moves only 55.99 → 56.26 % (±0.13), the
**front-outer load** ±2.4 %, but **total transfer** ±14.5 %. `99 §7`'s rationale for the 0.1 %
balance precision ("CG height uncertainty dominates below that") is therefore wrong; the number is
almost insensitive to h.

*Fix:* add E1.13 with a two-scale raise test (it is genuinely doable: 20 minutes, a 50 mm block and
the same scales), make `cg.height` optional-with-assumption like `mass.unsprung`, and correct the
example's source to `estimated` with a basis.

**P-07 — Damping ratio is a headline card built on two assumed parameters, and the module that owns
it says so.**
`07` §3.7 ("How stiff is this piston overall? — order of magnitude only — **low**"; "no headline ζ"),
`07` §8 ("Do not show a single damping ratio"), `99` §5.3 ("ship the curve, no headline ζ"),
vs `screens.md` §14 card 7 ("Damping ratio — ζ front/rear").

`F_bo` and `c_post` set the absolute force and are defaults 4.0 N / 12 N·s/m with no measurement path
for a sealed shock; unmodelled stiction is 0.5–2 N against ~1.3 N of modelled force at 50 mm/s
(`07` §4.2). `99` V12 needs a shock dyno and `99` §10.4 already asks whether one is accessible. The
analysis screen nevertheless gives ζ a headline number per axle, alongside roll centre and wheel
rate, with the caveat living in a tooltip. A racer will read "ζ 0.23" and set a shock by it.

*Fix:* replace card 7 with the damper **curve** and a "not validated — needs a dyno" state; remove ζ
from the comparison view entirely (E4.1's "every output whose value differs" then stops implying two
ζ numbers are comparable).

**P-08 — The validation matrix's tolerances are below the noise floor of the measurements they
prescribe.**
`99-validation.md` §2 V2, V7, V8, and §3.3–3.5.

V2's pass mark is ±10 % of κ. On the reference car that is ±0.055° of camber over a 5.00 mm spacer.
Applying `07` §4.2's own stiction figure (0.5–2 N) to the measured wheel rate (1.1185 N/mm) gives
0.45–1.79 mm of unresolved wheel travel, i.e. **0.049–0.196° of camber ambiguity** — equal to or
greater than the entire tolerance, before any gauge error, tyre squash or chassis temperature
enters.

V7 fails differently. Its coefficient on the reference car is 0.162 °/mm (`04` §6.4), so a pass mark
of ±0.10 °/mm is **±62 %** — loose enough to pass almost any wrong model. And `99` §5.1 says the model
may be wrong in exactly the way a magnitude test cannot see: "its zero is in the wrong place". A test
that checks a magnitude to 62 % cannot distinguish a correct model from one whose zero-bump-steer
height is 2 mm off, which is the whole question.

So V2 cannot pass or fail reliably on a real touring car — it will pass on a good day and fail on a
bad one — and V7 is too loose to answer the question it was written for. The protocol also never
requires the suspension to be **settled** before reading camber (it requires rolling the car for toe,
§3.4) — the one control that would remove the stiction term.

*Fix:* rewrite V2/V7 as *repeatability-first* tests: three readings per state with the corner tapped
and settled, report the spread, and only compare the model against the mean if the spread is below
half the tolerance. Add a stiction measurement (push the corner down 3 mm, release, read the
residual displacement) as a precondition, and state the resulting uncertainty next to the result.

**P-09 — No test in the plan can validate the two numbers the product leads with.**
`99-validation.md` §2 V3, V4, V11, §8.3.

V3 (roll-centre height, the app's namesake) needs "apply lateral force, find the height where the
chassis does not roll" — a rig from a video, not something built from "one caliper, one setup
station" (§3's minimum viable session). V4 needs the same rig at two roll angles. V11 admits the
load-transfer split is "**not directly measurable**". §8.3's release gate requires V1, V2, V7, V8,
V10 to have run once — V3 and V11 are excluded from the gate, so the release may ship with roll
centre and balance unvalidated forever. That is defensible honesty, but it means the app's two
headline quantities are, by construction, permanently L0+L1.

*Fix:* say this in the product, not just in `99`: roll centre and balance get a permanent "model, not
measurement" line in the card, not a conditional one. And add the one cheap external check that
*is* available: corner-weight asymmetry from V10 against the model's predicted asymmetry — a car
whose measured diagonal split differs from the model's by more than 5 g is a geometry error, and four
scales are the only instrument the target user actually owns.

**P-10 — The measurement protocol and the 30-minute success test cannot both be true.**
`99` §3.2 ("measure each point **twice, from two directions**, and record both", plus a photograph
per corner) vs `spec.md` E9.5 (MUST: three racers each produce "a complete model in ≤30 minutes from
a caliper session") and §1.3.

The reference corner has 11 points; with mirroring that is 11 unique points × 3 coordinates = 33
readings, 66 with the two-direction rule, plus 4 photographs and a ride-height/tyre-radius snapshot
at the same instant. At a realistic 60–90 s per reading that is 1.5–2.5 hours for geometry alone,
before the setup sheet. E9.5 is a MUST and a release gate; it will fail.

*Fix:* pick one. Either E9.5's number becomes "≤90 minutes from a caliper session" (honest), or the
protocol drops the two-direction rule to "re-measure the three points that most affect the answer"
(ball joint, upper outboard, damper lower eye), and the app computes which three from its own
sensitivity Jacobian.

**P-11 — Roll-centre migration is specified as a card value at ±10 mm of bump, beyond both the
modelled travel and the stated validity.**
`screens.md` §14 card 3 ("migration over ±10 mm bump"), §15 ("table of values at 0, 2, 5, 10 mm"),
vs `02` §2 (bump range −6 … +6 mm for a TC), §5.5 ("directional outside ±3° of roll"), and
`99` §5.2 ("show the migration as a line on a chart, **not as a number in a table**").

`02` §6.6 already shows that a 3 mm heave drops the roll centre 40 % — so a ±10 mm sweep is not a
peripheral view of this quantity, it is a different car. `G02.8` returns `outOfTravel` at +50 mm; the
design will hit that limit inside its own headline chart.

*Fix:* sweep 0 to the axle's stored `bump_limit_wheel`/`droop_limit_wheel`, mark the measured-range
boundary (the design already has that affordance), and drop the table.

**P-12 — Cross-car comparison: spec refuses, design offers it.**
`spec.md` E4.3 (MUST: "the comparison is refused … and the user is offered a comparison of the setup
inputs only") vs `screens.md` §16 "cross-car" state ("banner 'deltas are real but not like-for-like',
and the 'What you changed' section is suppressed").

These are opposite products. E4.3 is right: outputs are functions of geometry, so a delta between two
chassis is not a delta.

*Fix:* delete the cross-car state; show the E4.3 refusal.

**P-13 — Out-of-range inputs are accepted with a flag, and the plausibility ranges are wide enough to
swallow any real typo.**
`spec.md` E1.6, `01` §6.4.

A link length of 5–120 mm, wheelbase 150–400 mm, CG height 5–80 mm: a 3.5 mm entered for 35 mm passes
every check and produces a plausible-looking roll centre. Combined with E1.4's default mirroring, one
bad reading poisons both corners and every output silently. The only hard rejections are
`|coordinate| > 3 m` (catches mm-for-m, nothing else) and negative lengths.

*Fix:* flag with a *computed* consequence ("this moves the front roll centre 14 mm — check the
measurement"), not a static range; and make the model display its own cross-check (derived wheelbase
vs declared, derived track vs declared) as a blocking banner on the analysis screen rather than a
warning in `01` §6.5.

---

### MINOR

**P-14 — Three precision policies, mutually inconsistent.** `99 §7` sets roll centre 0.1 mm and
κ 0.01 °/mm; `02` §5.1 says "never one tenth of a millimetre — one decimal, never two"; `02` §9 says
"publish κ to 3 decimals, roll centre to 2". Camber gain is 0.01 in one table and 0.001 in another;
roll centre is 0.1 and 0.01. Pick a table, put it in one place, and let the golden tests read it.

**P-15 — V9's tolerance is looser than the model's own error.** A ±15 % pass mark on the bar rate
against `05` §4.5's "expect 10–20 % error against a bench measurement" means the test cannot fail for
the reason it exists. It is a formality; say so or drop it.

**P-16 — "Lateral g" is presented as an analysis input the user chooses (default 1.0 g), but no club
racer knows their cornering g.** Fortunately the balance percentage is *exactly* invariant to a_y
(verified: 56.1437 % at 0.1 g and at 2.5 g), and only the absolute loads and roll angle scale with it.
Say that in the picker — "this changes the loads shown, not the balance" — and the fake input stops
being a fake input.

**P-17 — Anti-dive ships as computed, flagged and hidden.** `03` §6 says the classical formula returns
300–400 % at 1:10 scale and the number is suppressed below 10 mm of side-view projection, which the
spec says is the normal touring-car case. A module that always suppresses its own output should not
be in build order 3 of 9 or in `00` §1's module table as a deliverable.

**P-18 — `G02.4`'s migration golden case (±0.002 mm) is tighter than the quantity's own stated
approximation** (~a few tenths of a millimetre, `02` §3.5). The tolerance is testing the solver, not
the physics, which is fine — but then it must not be cited as evidence about migration.

**P-19 — 99 §7's bump-steer row reads "0.01 °/mm … but *use* only 0.1"** — display precision and use
precision cannot be different values in one table.

**P-20 — `00` §5's confidence enum has four values (`measured`, `manufacturer`, `estimated`,
`assumed`); `spec.md` §4.1.4 has six (`+ third_party`, `derived`, `unknown`); the design has five
badges plus "field-absent"; `flows.md` §6.4 adds a seventh (`library`). Four vocabularies for the one
field that carries the app's honesty.**

---

### NIT

- **P-21** — `01` §4 says a 0.5 mm error is "worth ~0.08 mm of roll centre height". Same wrong
  number as P-01; fix together.
- **P-22** — `02` §9's κ claim ("~2 % per 0.1 mm") is ~3.8 % per 0.1 mm by measurement. Right order,
  worth correcting because `99` V2's ±10 % is built on 2 %.
- **P-23** — `06` §8 says a 0.2 % balance difference "is below the precision of the CG-height input".
  CG height moves balance 0.02 %/mm; roll-centre height and bar diameter are what swamp it (see §3).
  The advice is right for the wrong reason and will mislead the reader who checks.
- **P-24** — `05` §2 notes G = 79.3 GPa for steel and 41 GPa for Ti, but `spec.md`'s model has no
  material field, so the assumption can never be recorded.
- **P-25** — "Calibrated mass" in V8 (`99` §3.5): a racer owns dumbbells. Requiring "calibrated"
  implies a lab; ±1 % is what a gym weight gives and that is fine at a ±8 % pass mark.

---

## 2. Input obtainability

How a club racer with a caliper and a setup station actually gets each input, and what the error does
to the output. Propagation uses the spec's own sensitivity where it states one (corrected where P-01
proves it wrong); "output error" is the 1-σ-ish effect on the headline number, not a bound.

| # | Input | How a club racer gets it | Realistic error | Output affected | Resulting output error |
|---|---|---|---|---|---|
| 1 | 33 hardpoint coordinates (11 points × 3 axes, mirroring on; 132 with symmetry off) | Caliper against a flat plate, car on stands, wheels off; "measure to the ball, not the stud" | 0.2–0.5 mm per point (spec's own), 0.5–1 mm on a ball stud with no fixture | Roll centre | 0.1 mm (`y`) to 0.95 mm (`z`) per point |
| 2 | Same | Same | Same | Camber gain κ | 3.8 % per 0.1 mm on `Lₒ.z` alone (spec says 2 %) |
| 3 | Same | Same | Same | Motion ratio → wheel rate | ~0.5 % → ~1 % |
| 4 | `tie_in` / `tie_out` (rack end, steering arm) | Requires removing bumper/rack cover on most TCs | 0.5–1 mm | Bump steer | Comparable to the whole effect — and the model's zero is in the wrong place anyway (`99` §5.1) |
| 5 | `wc` (wheel centre) | Derived from tyre radius and hub face; contact patch ignores camber offset | 0.3 mm | Track, scrub radius | Scrub ±0.3 mm on a 7 mm number (4 %) |
| 6 | Spring rate | Number printed on the packet ("3.5"); no spring tester exists in a pit box | ±5 % nominal, ±10 % between brands, unknown if unbranded | Wheel rate, ride frequency, roll stiffness | 5–10 % / 2.5–5 % / 5–10 % |
| 7 | ARB diameter | Caliper, easy | ±0.02 mm careful, ±0.05 mm likely | Roll stiffness, balance | ±5.4 % / ±14 % of the bar's share (d⁴) → **±0.6 % balance** |
| 8 | ARB effective span `L_bar`, arm `a_arm` | Bar off the car; "effective length" is a judgement between bushings and bends | ±5 mm on 90; ±1 mm on 20 | Roll stiffness | 5.5 % / 10 % |
| 9 | ARB setting → rate multiplier (blade bars) | Manufacturer's chart, if one exists | Often unpublished; user guesses | Roll stiffness, balance | Unbounded — a wrong multiplier is a wrong car |
| 10 | Damper piston displaced area `A_p` | Strip the shock, caliper bore and shaft | ±0.05 mm bore | ζ, force (∝ `A_p³`) | ±1.5 % |
| 11 | Piston hole count and diameter | Pin gauges or the manufacturer's drawing; a sealed RTR shock has neither | ±0.02 mm on 0.6 | Damper force (∝ `A_h⁻²`) | ±13 % |
| 12 | `F_bo`, `c_post` | **Dyno only.** Defaults 4.0 N / 12 N·s/m | ±50 % | ζ magnitude | ±30 % (the module's own figure), biased low by stiction |
| 13 | Oil viscosity | Printed on the bottle | ±5 % | ζ | small |
| 14 | Total mass | Kitchen scale | ±2 g on 1350 g | everything | 0.15 % |
| 15 | Unsprung mass per axle | Corner off, spring and damper removed, hub on a stand; E1.10's stepped-ride-height method is a fairer proxy | ±20 % | Load transfer | 10–15 % of transfer × 20 % = 2–3 % |
| 16 | Sprung mass per corner | Derived from 14/15 | ±5 % | Ride frequency | 2.5 % |
| 17 | **CG height** | **No procedure in the spec.** Needs a raised-axle two-scale test; nobody does this on a 1:10 car | ±4 mm (15 %) on a 28 mm nominal | Total transfer ±14.5 %; per-wheel load ±2.4 %; **balance ±0.13 %** | The headline is robust; the loads are not |
| 18 | CG longitudinal / weight split | Four scales (few own) or two + a stand; sometimes in the manual | ±0.5 % | Static loads, transfer split | <1 % |
| 19 | Corner weights | Four scales, or two scales and a lot of patience | ±2–3 g (cheap scales drift with temperature) | Static loads, diagonal check | 0.7 % of a corner |
| 20 | Ride height | Gauge or machined block, at the same instant as the hardpoints | ±0.2 mm | Everything vertical | RC ±0.4 mm |
| 21 | Static camber / toe | Setup station — the one thing every target user owns and trusts | ±0.05° | Camber at roll, toe curve datum | fine |
| 22 | Droop / bump limits | Droop screws, feeler gauge | ±0.5 mm | Travel range, static limits check | fine |
| 23 | Shim thickness | Machined shims | ±0.02 mm — **the most precise input in the model** | Hardpoint position | ±0.02 mm → RC ±0.04 mm |
| 24 | Tyre pressure, air temp, tyre temp | Pressure gauge / thermometer | exact enough | *Nothing in v1* — used nowhere but the oil temperature | Recorded, unused (see §4) |
| 25 | Lateral g at which to evaluate | Guessed | ±50 % | Loads only; balance invariant (verified) | Loads ±50 %, balance 0 |

**Verdict: five inputs are unobtainable in practice for the primary user.** They are the CG height
(no procedure, and the field is required), the damper blow-off pair `F_bo`/`c_post` (dyno only), the
bar's setting→rate multiplier on blade bars (manufacturer, usually unpublished), the piston hole
diameter on a sealed shock (needs pin gauges and disassembly), and the bar's effective span (a
judgement call that changes roll stiffness by 5 %). Three more are obtainable only by a chassis
contributor rather than a racer: unsprung mass, corner weights, and the rack-end coordinates.

Note the shape of that list: everything unobtainable is in the **damper and bar** modules, which are
exactly the two modules whose outputs the design gives their own analysis cards.

---

## 3. Does the app overstate what it knows?

**The physics documents do not.** `07` §3.7 grades its own answers "low", `02` §5 lists seven ways it
is wrong, `99` §1 says nothing is validated, `99` §6 lists what will never be claimed, and `D3`
refuses a tyre model for exactly the right reason. This is the most honest vehicle-dynamics document
I have reviewed in this genre.

**The product spec and the design do.** Three specific overstatements:

1. **Precision is asserted, not derived.** `99` §7 sets roll centre to 0.1 mm and balance to 0.1 %.
   Measured against the inputs: a plausible 0.5 mm error on one hardpoint moves the roll centre
   0.1–0.95 mm, and reading a 1.5 mm bar to ±0.05 mm moves the balance ±0.6 %. So the roll centre is
   displayed **at least 1×, plausibly 10×, finer than its inputs support**, and the balance **6×
   finer**. The precision table looks like it was written per quantity by judgement; there is no
   error budget anywhere in the corpus, and P-01 shows the one sensitivity it cites is wrong.
2. **`computed` is a confident-looking state, not an epistemic one.** See P-02. A solid numeral means
   "measured inputs", not "trustworthy answer", and the design's own vocabulary treats them as the
   same thing.
3. **An invented tolerance.** `flows.md` §6.4's "±15 %" is the only accuracy figure that would ever
   reach a user, and it comes from nowhere.

**Do the High/Medium/Low ratings match the UI?** No, and there are three different rating systems in
play: `00` §1's per-module "confidence in the physics" (High/Medium/Low), `99` §1's L0–L3 per number,
and `07` §3.7's per-question confidence. `00` §1 rates module 1 "High — it is bookkeeping", but
module 1 is where every downstream error is born and P-03 shows it is not even unambiguous about
which way is right. `00` §1 rates module 6 "High for the algebra; the *split* is an idealisation",
which is the correct nuance, and `99` §1's blanket "not one is L2" overrides both. Reconcile to one
ladder and delete "confidence in the physics" from `00`, or the reviewer will keep finding three
answers to one question.

---

## 4. Audit of `99-validation.md`

**Can one person do V1–V11 in an afternoon with the named equipment?** Only the subset the document
itself names in §8 (V1, V2, V7, V8, V10) — and only if V1 is already done, which it is not.

| Test | Equipment as named | Achievable | Time | Verdict |
|---|---|---|---|---|
| V1 | caliper, tape | yes | 1.5–3 h | At the edge of "an afternoon" on its own; the two-direction protocol (P-10) is what breaks it |
| V2 | setup station, 5 mm spacer | **marginal** | 20–30 min | Tolerance (±0.055°) sits inside the stiction noise (0.05–0.20°); needs a settling protocol (P-08) |
| V3 | "MTC2-style rig, apply lateral force, find zero-roll height" | **no** | — | Not buildable from the named equipment; the app's namesake number has no reachable L2 |
| V4 | same rig | no | — | Drop it; it is P3 and untestable |
| V5 | setup station (caster/KPI), plumb line for scrub | partly | 15 min | Scrub from a plumb line to ±1 mm on a 7 mm number is optimistic but harmless |
| V6 | turn wheels, read both sides | yes | 10 min | Fine, but validates a readout nobody acts on |
| V7 | spacers, toe bars, roll back and forth | yes | 30 min | Achievable, but ±0.10 °/mm is ±62 % of the 0.162 °/mm signal, and it cannot see the wrong-zero failure `99` §5.1 predicts |
| V8 | weights in ~1 kg steps, dial gauge, stands | yes | 45–60 min | Best test in the list; needs "settled, damper off, droop screw backed out" written down |
| V9 | bench the bar | yes with a rig | 45 min | Tolerance looser than the model error (P-15) |
| V10 | four scales | yes | 15 min | `±2 g` assumes class-F scales; state a calibration step |
| V11 | "not directly measurable" | — | — | Honest, but see P-09 |
| V12 | shock dyno / drop test with accelerometer | **no** | — | `99` §10.4 already suspects this; mark "not planned" now |
| V13 | dyno | no | — | follows V12 |
| V14 | GPS logger | no (v1 scope) | — | Not v1 |

**Tolerances that do not make sense.** V2 and V7 (P-08). V12's ±30 % on force from a drop test: the
drop test measures ζ, not force, so the pass mark and the method disagree. V9 (P-15). V10's ±2 g on a
scale whose own resolution may be 1–5 g.

**What is missing entirely:**

- **Temperature.** Air temp is stored (`spec.md` §4.3) and used only for oil viscosity. Camber and toe
  readings move with tyre and chassis temperature; the protocol never says "all four corners within
  one session, same tyre temperature", and V2's whole signal (0.55° of camber) is the same size as a
  warm-tyre artefact.
- **Tyre pressure and tyre state.** Pressure changes ride height, and therefore every vertical
  coordinate — the protocol measures hardpoints at "ride height" but never fixes pressure. Tyre squash
  under the spacer changes the effective 5.00 mm into something else.
- **Binding and stiction.** The two documents know it is 0.5–2 N (`07` §4.2) and that it is "worth
  more camber change than the linkage itself" at high load (`02` §5.2), and the validation plan
  contains **no test for it**. This is the single largest omission: it is the mechanism by which every
  bench test in §3 can fail for a reason that has nothing to do with the model.
- **Chassis twist.** E1.4 assumes symmetry by default; a tweaked car is the normal case after a
  season. There is no protocol step that measures the twist (a diagonal corner-weight comparison
  would do it in five minutes) and no way to feed the result into an asymmetric model.
- **Scale and gauge calibration.** Mentioned for the caliper (§3.1), absent for the scales (V10) and
  the setup station (V2, V5), which is where a systematic bias would silently pass.
- **Repeatability as a criterion.** §3.2 asks for two measurements and calls the spread "the honest
  uncertainty" but no test asserts a repeatability limit, so a session with a 2 mm spread passes
  silently.
- **A negative control.** Nothing deliberately feeds a known-bad model to check the app flags it. A
  ten-minute test: type 780 mm for a 78 mm coordinate and require a flag.

---

## 5. Failure states — is "cannot compute" reachable?

**Structurally, yes, and unusually well.** `Result<T> = Ok | Undefined` with a closed reason set
(`00` §4), E1.1/E1.2 (no output when a hardpoint is missing, and "not measured" naming the field),
E1.8 (unsprung = 0 flagged on screen and in every export), E1.9 (no ride-height datum → refuse),
E2.4 (absent field → assumption shown or not computable), E3.8 (typed undefined, property-tested),
E3.9 (outside-validity flag), and the design's `missing`/`undefined` badges with a first-missing-input
link. The plumbing is the best part of the spec.

**The gaps are semantic, not structural:**

1. **E3.9's domain bound is never stated.** "roll centre more than a stated distance from the ground
   plane" — where `axles.<axle>.roll_centre_validity` is optional and defaults to "a default stated
   in the UI" (§4.2.1). A default that exists only in the UI cannot be tested. Put numbers in the
   schema, sourced from `02` §5.
2. **"Unvalidated" is not a failure state anywhere** (P-02). The app can be perfectly honest about
   a *missing* input and completely silent about a *bad model*.
3. **Estimated is not propagated to the right place.** E2.11 marks outputs that consume an estimate —
   good — but the mark is informational; nothing requires the output to be *withheld* when the
   estimate is the dominant term. A ζ computed almost entirely from two assumed defaults (`F_bo`,
   `c_post`) should be `missing`, not `estimated`.
4. **Inconsistent inputs warn, they do not block.** The `06` §3.7 consistency residual, the `01` §6.5
   track mismatch and the E1.6 out-of-range flags are all warnings; a user can act on a model whose
   own cross-checks disagree. E1.6's "accepted, flagged" is defensible for a field; it is not
   defensible for the *derived* checks, which are the app's chance to catch a bad measurement.
5. **Library-sourced values are `computed`** (P-05), so the most dangerous provenance is the one that
   produces the most confident-looking screen.

---

## 6. What this buys a racer on a race weekend

**Box-stock car, no measurements taken (the common case): nothing.** Every output is `missing`,
E1.1 forbids displaying any of them, and the only thing left is a digital setup sheet with versioning,
notes and compare. That is a real product — it is better than the paper sheet in the pit box — but it
is not what `intent.md` promises, and the app must say so on first launch rather than showing seven
grey cards. **Say it bluntly in the onboarding: "without a caliper session this app is a setup-sheet
notebook."**

**Measured car, one weekend of testing:**

| Question | App | Paper + setup sheet |
|---|---|---|
| "Which direction does 1 mm more camber-link shim move the roll centre?" | answers, with arithmetic and a caveat | "try it" |
| "How much?" | 0.45 mm — inside the measurement error of the model (P-01) | — |
| "Does my front bar change move the balance?" | ±0.6 % for a bar-size step, ±0.9 % for a 1 mm arm change | "stiffer front bar = more understeer", folklore |
| "Is the change I just made above the noise?" | **does not answer this anywhere** | — |
| "What is my camber at 1 g of roll?" | 0.84 °/° net — the single best teaching number in the corpus | unknowable |
| "Did my last setup actually do what I thought?" | compare, with deltas and causal inputs | "look at the sheet" |

So: the honest value is **direction plus a coefficient, with the magnitude explicitly banded**, plus
the teaching, plus the setup-sheet discipline. That is worth installing. It is not worth claiming
"roughly how much" (`spec.md` §1.2) until the error budget in §3 above is published next to the
number.

The gap I would fix first is not accuracy. It is that the app never tells the user **whether the
change they are making is bigger than the app's own uncertainty**. Both numbers exist inside the
package (input tolerance × sensitivity Jacobian). No document asks for their ratio.

---

## 7. The three features I would cut from v1

1. **The damper module's damping ratio (card 7, `07` in full).** Two dominant parameters unobtainable,
   ±30 % on force, stiction larger than the modelled force at low speed, no dyno, and the module's own
   author says "do not show a single damping ratio". Keep oil weight and piston holes as reference-only
   setup fields — racers compare those on paper anyway — and cut the output. This removes one of the
   two unobtainable-input modules and the app's most confidence-damaging number.
2. **Bump steer as a number (module 4's bump-steer half).** `99` §5.1 says the model's zero is in the
   wrong place and the magnitude is "a coincidence of two partial effects". Shipping a number whose
   zero is wrong, behind a caveat, in a card, is exactly the failure mode `intent.md` was written
   against. Cut the output; keep Ackermann as the readout it already is.
3. **Roll-centre migration as a chart-and-table card.** 18.6 mm per degree from a chassis-frame
   approximation with a ~1 %-of-track contact-patch error on a 526 mm lever, displayed ±10 mm beyond
   travel, whose validation rig (V3/V4) does not exist. Cut it to a single sentence in the roll-centre
   card — "on this geometry the roll centre moves 18 mm sideways per degree of roll; the model cannot
   yet say where to" — which teaches the point without shipping the number.

*(Not cut, but should be: the community model-install path in v1. D5 itself says an unreviewed model
"produces plausible numbers from someone else's measuring error, and the user has no way to tell".
Ship one model you measured, and the import path in v1.1.)*

## The one thing that would most increase trust with a sceptical racer

**A two-minute self-check that runs on his own car before he uses any other number: the app predicts
one quantity, he measures it with what he already owns, and the app shows predicted vs measured and
says which is probably wrong.**

Concretely, extend E3.13 (which exists for wheel rate only) to camber: ask for static camber, a
5.00 mm spacer under one front wheel, and the camber re-read. The app already knows κ = −0.1098 °/mm,
so it predicts the reading; the racer gets ±0.05° from a setup station he already trusts. If it
disagrees by more than the stiction band, the app says "your model is wrong, here is which point to
re-measure". Within two minutes the tool has either earned the right to be believed or told him it
cannot help him yet — and that is the only thing that will stop a club racer treating it as another
forum opinion. It costs one screen, one equation the app already has, and one measurement every
target user can already take.

Second place, and nearly free: print the app's own uncertainty band beside every delta — "balance
+0.9 % (app's own uncertainty ±1.2 %)" — because a tool that says "I cannot see this difference" is
more convincing than one that says "+0.2 %".
