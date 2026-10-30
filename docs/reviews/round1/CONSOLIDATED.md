# Round 1 review — consolidated findings

Four independent critics reviewed the requirements, physics, design and architecture drafts with
no knowledge of each other's reasoning. They reported **36 blockers** between them. This file
de-duplicates them, records what was independently verified, states the rulings that unblock the
revision, and defines round 2.

Raw reports: `01-physics-correctness.md`, `02-practicability.md`, `03-spec-critique.md`,
`04-implementability.md` (same directory).

---

## 1. What I verified myself before accepting any of it

Two claims mattered enough to re-derive by hand in Python, reproducing the spec's own reference
car (Lᵢ, Lₒ, Uᵢ, Uₒ, W) from module 2 §6:

**Roll-centre sensitivity — the reviewers are right, and the spec is worse than "wrong".**
The spec's §9 table says perturbing Lₒ.z by +0.1 mm moves the roll-centre height by **+0.0165 mm**
(0.165 per mm). Reproducing the base case exactly (z_rc = 9.9749 mm, matching the spec to four
decimals), the true answer is **−0.187 mm** for +0.1 mm — the **wrong sign and 11× the magnitude**:

| Perturbation | Spec claims | Computed |
|---|---|---|
| Lₒ.z +0.1 mm | +0.0165 mm | **−0.1869 mm** |
| Lₒ.z +0.2 mm | +0.0330 mm | **−0.3749 mm** |
| Lₒ.z +0.5 mm | +0.0824 mm | **−0.9463 mm** |
| Per mm | +0.165 | **−1.923** |

Consequence: every precision and tolerance statement derived from it is wrong. The 0.1 mm display
precision for roll-centre height, the V3 validation tolerance, and the "not hypersensitive"
conclusion all invert. A 0.5 mm hardpoint measurement error moves the roll centre ~1 mm, which is
larger than the effect of a 1 mm camber-link shim — that is the opposite of what the document
tells a user to expect, and it is a *finding*, not a bug: it makes the case for showing an error
band on roll-centre height rather than a number with two decimals.

**Camber sign across the centreline — confirmed at the static value.** Module 2 defines
γ_kp = atan2(Uₒ.y − Lₒ.y, Uₒ.z − Lₒ.z). On the left corner that returns −8.0000°. Mirror the same
corner per module 1's own rule (negate y only) and the identical formula returns **+8.0000°**. The
formula is a *global-frame* angle, while module 1's mirror rule and modules 2–6's usage assume a
*per-wheel* convention. Left κ = −0.109816 °/mm, exactly as the spec says; the mirror therefore
flips the sign of camber gain, and (2.16) — which adds body roll to camber gain — then produces a
different physical answer on the right corner than the left. No golden case covers the right-hand
corner, so this passes every test in the document.

(I could not get a trustworthy κ for the mirrored corner — my own branch-tracking broke on the
mirrored geometry, which is itself evidence for finding B5 below: the branch rule is not pinned.)

---

## 2. The blockers, grouped by root cause

### A. One fact, stated three ways (blocks everything downstream)

| # | Finding | Where |
|---|---|---|
| A1 | **Coordinate frame differs between documents**: requirements say y-right, origin mid-wheelbase; physics says ISO 8855 y-left, origin at the rear axle. A developer following physics builds a model 128 mm and 257 mm away from one following the requirements. | spec §4.2 vs physics/01 §2 |
| A2 | **Storage units differ three ways**: SI metres (physics/01 §5, with a `\|c\|>3` metre guard), millimetres (spec §4.1.1, decision D6, architecture §6). 01's own example file labels itself `"units": "SI"` while storing degrees. | spec, 00, 01, architecture |
| A3 | **Camber sign convention stated three incompatible ways**: per-wheel "top outboard" (01 §3), global atan2 (02 (2.12)), and a mirror rule that negates camber and toe (01 §6.1). Verified consequence in §1 above. | 01, 02 |
| A4 | **10⁻³ claims are false** for equations (5.7), (6.3), (6.7)–(6.9), (9.12), which silently use metres for symbols their own input tables declare in mm. A mechanical 10⁻³ application gives a bar rate 1000× too small. | 05, 06, 09 |

**Ruling R-1.** ISO 8855 (x forward, y **left**, z up, origin on the ground plane at the rear axle
centre) is the frame. It is the frame every equation in modules 2–6 was derived in, the frame the
published references use, and the one that leaves the fewest things to re-derive. Per-wheel
quantities (camber, toe) are **per-wheel signed** — positive camber = top outboard, positive toe =
toe-in — and are negated on mirroring; quantities that are properties of the car (roll-centre
height, load transfer) are frame-free and are never signed per side. Module 2's γ_kp must be
redefined per wheel (or wrapped in `sign(y_wheel)`), and a golden case must exist for the right-hand
corner asserting κ_R = −κ_L in the *global* frame and equality in the *per-wheel* frame.

**Ruling R-2.** On disk: **millimetres, grams, degrees** — what a caliper and a setup sheet produce.
The adapter converts to SI at exactly one boundary, as architecture §6 requires. The `|c| > 3` metre
guard becomes a `|c| > 3000` mm guard, and 01's example file and §8 are re-derived.

### B. Physics that is wrong rather than ambiguous

| # | Finding | Where |
|---|---|---|
| B1 | **Reference-car masses are inconsistent**: 05 uses 0.310 kg front / 0.400 kg rear per corner (1.42 kg sprung) while 06 derives 1.11 kg total. Corrected ride frequencies 10.781 / 10.286 Hz (not 9.560 / 9.073), and every ζ in module 7 rises 12.8%. | 05 vs 06 |
| B2 | **Anti-dive example uses a point that does not exist**: module 3 uses (250, 12) for the lower arm, but module 1's lower arm is a hinge at x = 238–272, z = 12. The 316.1% result and its perturbation table are artefacts. Real hinge geometry gives either `noAntiGeometry` or a pro-dive result. | 03 §5.2, G03.2 |
| B3 | **Bump steer sign inverted**: τ = ψ(bump) − ψ(0) measures a steer angle (positive = wheel turns left), so the asserted +0.484° at +2 mm is toe-*out* under the stated convention. Also one scalar is reported per corner where a symmetric bump produces equal toe-out at both. | 04 (4.12), §6.4 |
| B4 | **Motion ratio sign**: (5.2) drops the minus from (5.1); IR evaluates to −0.5653, and 05 §5 maps IR ≤ 0 to `Undefined(outOfDomain)` — so a literal implementation makes *every car* undefined. | 05 (5.2) |
| B5 | **Rigid-carrier transform for off-centre points is undefined** — required by 04 (tie_out height) and 05 (damper length, arb_drop). Rotating by carrier-axis change reproduces the toe table; rotating by crank angle gives τ(+2) = 0.430 vs 0.484 — an 11–14% error that passes an eyeball check. | 02 §3.2, 01 §6.6 |
| B6 | **Ackermann rack sign**: (4.4) applies rack travel with opposite signs to the two wheels, turning a 127% Ackermann car into 0% — which still plots plausibly. | 04 |
| B7 | **Side-view construction is undefined for a hinge-type lower arm** (the reference car's own type): its fore-aft projection is degenerate, so the side-view instant centre is arbitrary or at infinity. | 03 §3.1, §7 |

### C. The file format cannot feed the maths (two of twelve advertised outputs)

| # | Finding | Where |
|---|---|---|
| C1 | **Roll stiffness and damping ratio have no inputs.** Module 5 needs bar diameter, effective span, arm length and G; the car model carries only `arb_setting × rate_at_full_stiff`, and module 5 models a torsion bar (`k = GJ/L`). Module 7 needs piston area, hole diameter, F_bo and c_post; the setup carries hole count and oil viscosity. Both have analysis cards. | spec §4.2/§4.3 vs physics/05, 07 |
| C2 | **Damping ratio is a leaked MUST** given C1 — and it is one of the three things v1 is now *for* (D-12). | spec E3.6 |
| C3 | **Bump steer needs rack-end geometry** that most users cannot measure without removing the bumper and rack cover. | spec, corpus |

### D. Requirements that cannot be tested or are circular

| # | Finding |
|---|---|
| D1 | Three contradictory absence policies (assume-0-with-flag / refuse / either) and E1.2 forbids the placeholder E1.8 mandates. Needs a mandatory `on_absence: ASSUME \| REFUSE \| OMIT` column per field, with tests generated from it. |
| D2 | Setups contain geometry (upper-link shims, wheel offset) while §4.3 says a setup never contains geometry; shim axis and direction unspecified, so every hash and headline output diverges. |
| D3 | `content_hash` canonicalisation is undefined (scope, key ordering, float formatting, `-0.0`) — two installs hash the same car differently, breaking E1.7/E2.1/E2.7/E7.1. |
| D4 | **A setup shared to another user cannot be opened**: it references `(model_id, content_hash)` and §4.1 rule 6 forbids embedding the model. The primary community use case dead-ends with no defined path. |
| D5 | **Attribution cannot travel**: model data is CC BY 4.0 and contributor-attributed, but the schema has no licence/contributors fields, so re-sharing strips attribution. |
| D6 | **The release gate is circular** — depends on a `spec_audit` tool no AC requires; six other MUSTs ride on unrequired build checks. |
| D7 | **74 MUSTs, no cut line, no slice marker**: §2.3's Slice 0 is invisible to §3, so `plan.md` cannot be written without silently re-tagging. |
| D8 | 25 acceptance criteria that cannot fail, including E1.1 (passes on a blank screen), E3.10 (demands bit-identical transcendentals across ARM/x86), E9.5 (n=3, no pass rule), E9.8 (circular). |
| D9 | **The evidence ladder is not in the requirements at all** — no AC requires a per-output validation state, so an unvalidated model renders 9.97 with a unit and no caveat. This is now a direct conflict with D-11. |

### E. Design artefacts that reintroduce what the spec forbids

| # | Finding |
|---|---|
| E1 | A new setup is "created from template defaults: every row has a value" — contradicting the spec's own rule that missing is missing. |
| E2 | A blanket "tolerance ±15%" is attached to every estimated input regardless of field. |
| E3 | "Library" inputs are rendered as solid numerals, the most confident-looking provenance in the app, when they are another car's measurement. Needs a fifth badge: `inherited`. |

### F. Inputs the user probably cannot obtain (practicability)

CG height (corner scales cannot locate a CG — the spec's own cited source is physically impossible);
damper blow-off force and post-blow-off rate (dyno-only, yet they set the magnitude, ±30%);
ARB setting→rate curve on blade bars (manufacturer data, usually unpublished); piston hole diameter
(pin gauges, 0.4–1.2 mm, and force scales as 1/A², so ±0.02 mm is ±13%); ARB effective span
(±5 mm on 90 mm is 5.5% of roll stiffness); unsprung mass (±20% realistically).

**This is not a defect list — it is the v1 honesty boundary.** Every one of these must either become
a measured input with a published procedure, or an explicitly estimated input whose estimate is
shown, or leave v1.

---

## 3. What this means for v1 (D-12)

D-12 said v1 = geometry, balance, static damping ratio. Findings C1/C2 mean **static damping ratio
cannot ship as specified** — there is no damper curve in the data model, and the model needs dyno
constants. Three options, for Dave:

1. **Narrow v1 to geometry + balance**, move damping ratio to v1.1 with a proper damper document
   kind and a measured-curve path. Honest, smallest, fastest.
2. **Ship damping ratio as an estimate from published piston/shaft geometry** with the ±30% band
   printed next to it and the `estimated` badge. Keeps the promise, wears the uncertainty.
3. **Ship a measured-drop-test workflow**: the user drops the corner and enters the oscillation
   period; ζ follows. One afternoon of user effort, no dyno, real data.

Recommendation: **1 for the first slice, 3 as the feature that earns damping ratio its place.** A
number that comes from a measurement the user performed is worth ten from assumed blow-off forces.

---

## 4. Round 2 — revision tasks

| Task | Scope | Owner |
|---|---|---|
| R2-A | Physics spec revision: apply R-1/R-2, fix B1–B7, add the carrier transform and branch rule, add module 10 (chassis), add the missing ARB/damper schema fields or remove those outputs | agent |
| R2-B | Requirements revision: apply R-1/R-2 and D1–D9, add the `on_absence` column, canonical hash, model-missing path, attribution fields, gate ACs, an R0/R1/R2 cut column, cap R1 near 35 MUSTs | agent |
| R2-D | Design/UX revision: fifth badge (`inherited`), no template defaults, stored tolerance or none, validation state on every surface, chassis card, sheet-diff screens (#10) | agent |
| R2-E | Architecture revision: three branches not four, `gate.dart` (D-09), frame/units, iOS deferred (D-10) | agent |
| R2-V | Verifier round: a fresh critic re-checks the revised documents against this file, and recomputes the corrected sensitivity table and the mirror case | agent |

Nothing is implemented until R2-V is green. No Dart has been written.
