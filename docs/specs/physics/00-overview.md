# 00 — Physics & calculator specification: overview

Status: **round 4** (2026-10-31). No implementation has been written against this document yet.
Audience: the TypeScript developer implementing `packages/physics`, a physics-competent
reviewer, and Dave (owner).

This spec is the contract for the pure-TypeScript physics package (`packages/physics` — no DOM, no
React, no I/O). It is deliberately arithmetic-heavy:
every number the app displays must be reproducible from this document by hand, and every claim
about a model's validity is paired with the case where it fails.

---

## 0. Changed in round 2

Round 1 produced 36 blockers (`docs/reviews/round1/CONSOLIDATED.md`). This revision applies two
rulings and closes the physics subset. Read this table first; it says what moved and why, so a
reviewer can diff against round 1 without re-reading everything.

| # | Change | Closes | Where |
|---|---|---|---|
| 1 | **Frame is ISO 8855** — x forward, **y left**, z up, origin on the ground plane at the **rear axle centre**. Stated once, as normative, with the note that `spec.md` §4.2's y-right/mid-wheelbase frame is superseded (the `spec.md` edit is R2-B's). | A1 | 01 §2 |
| 2 | **Per-wheel signed conventions.** Camber, toe, KPI and scrub radius are per-wheel quantities: positive camber = top outboard, positive toe = toe-in, and every y-difference carries the side sign `s` (+1 left, −1 right). Car-level quantities (roll-centre height, load transfer, balance) are frame-free and never signed per side. | A3 | 01 §3, 02 §3.6–3.7 |
| 3 | **Storage is mm, g, deg on disk** (R-2), converted to SI at exactly one boundary — the `setup_physics` adapter. The `\|c\| > 3 m` guard becomes `\|c\| > 3000 mm`. 01 §5's example file and §8 are re-stated in mm. | A2 | 00 §2, 01 §5–§6 |
| 4 | **No implicit 10⁻³ anywhere.** Every equation states its symbols' units and applies its own conversion explicitly. Fixed: (5.7), (5.8), (5.9), (6.3), (6.7)–(6.9), (9.9), (9.12). | A4 | 05 §3, 06 §3, 09 §4 |
| 5 | **Reference-car sprung masses corrected** to 0.24375 kg front / 0.31125 kg rear per corner. Front ride frequency 10.781 Hz (was 9.560), rear 10.286 Hz (was 9.073); every damping ratio in module 7 rises 12.8%. | B1 | 05 §6, 07 §6 |
| 6 | **Anti-dive example rebuilt.** The reference car's hinge lower arm has no side-view line; the module returns `Undefined(noSideViewConstruction)` and the 316.1 % case is withdrawn. Three defensible readings give no-anti-geometry twice and 773 % once, which is the finding. | B2, B7 | 03 §3.1, §5.2 |
| 7 | **Bump steer sign inverted** to the toe-in convention, `τ = −(ψ(bump) − ψ(0))`, and reported as a per-wheel *and* an axle-total quantity. Toe at +2 mm bump is −0.484° per wheel, not +0.484°. | B3 | 04 §3.4 |
| 8 | **Installation-ratio sign:** `IR = −(dL_d/dθ)/(dz_w/dθ)`. Module 5 also distinguishes `IR < 0` (a real geometric inversion) from `IR = 0`. | B4 | 05 §3.1 |
| 9 | **Rigid-carrier transform specified** as one function with the branch rule pinned (rotate by the change of the carrier axis `ê₁`, not by the crank angle), plus a second rule for points on the lower arm. Worked example and golden case added. | B5 | 02 §3.2.3, §6.9 |
| 10 | **Rack displacement applies with the same sign to both ends** — a rack is one bar. The `±` in (4.4) is deleted; a literal implementation turned a 127 % Ackermann car into a 0 % car. | B6 | 04 §3.2 |
| 11 | **Roll-centre sensitivity table and every consequence of it** recomputed: `Lₒ.z +0.1 mm → −0.187 mm` of roll-centre height (**−1.87 mm/mm**, not +0.165), and κ moves −2.60 % per 0.1 mm. V3's pass mark, the display precision and the "not hypersensitive" conclusion are all re-derived; roll-centre height can honestly claim ±1 mm. | M14/P-01 | 02 §9, 99 §7 |
| 12 | **Input contract completed** (C1): bar diameter, span, arm length and G, and the damper's bore, shaft, hole diameter, hole count, `F_bo`, `c_post` now exist as named fields with a declared owner, unit, range and absence policy. | C1 | 01 §4.4 |
| 13 | **Damping ratio ships in v1 as an estimate** (owner decision D-13, 2026-10-30): module 7 keeps its orifice + blow-off model, ζ carries an explicit band and an `estimated` badge, and a "what changes ζ" table states the sign and size of the five levers a racer actually pulls. What must be trustworthy is the **direction**, not the absolute number — and one of the five (viscosity below blow-off) is a direction the geometry-only model cannot see, which is stated. | C1, C2 | 07 §0, §9 |
| 14 | **Module 10 (chassis) added**, optional/diagnostic: material, thickness, mass, CG-height and torsional stiffness, with the correction that **material and thickness do not move the roll centre** but do move the balance (56.1 % → 52.6 % on the reference car). Ride height is an explicit input, not a hidden effect of thickness. | issue #11 | 10, 99 §11 |
| 15 | **CG height is inferred, never measured** (owner decision D-14, 2026-10-30): a component-mass route and a two-hang plumb-line route, both in module 1 §4.5, plus the robustness split the UI must carry — balance is invariant to `h` (±0.13 pp over 24–32 mm), absolute load transfer and roll angle are not (±14.3 % and ±22.2 %). The component route gives 18.7 mm for the reference car against the 28.0 mm it assumed. | P-06, owner | 01 §4.5, 06 §6.7 |

### What this revision did **not** close

Stated here so it is not mistaken for done:

- **The reference car still has no rear hardpoints.** `IR_r`, `k_bar,r`, `z_rc,r` and `t_r` remain
  assumed inputs with ranges (05 §6.5, 06 §6.3). Balance is therefore a computed number built on
  four assumed inputs, and it says so.
- **The steering-axis plan point** is still the axis's ground intersection, which overstates ρ by
  42 % (17.00 mm against 11.95 mm at tie-rod height). Golden cases G04.1–G04.5 are pinned to that
  choice and are labelled as such; switching to the working-height axis changes every steer angle
  and the Ackermann percentage and needs an owner decision, not an edit (04 §5.1).
- **CG height has no measurement procedure** in the app; module 6's `h` is inferred (01 §4.5), and
  the component route disagrees with the value the golden cases assume by 9.3 mm. Load *magnitudes*
  therefore carry a ±35 % band while the balance split does not.
- **The reference car's assumed `h = 28.0 mm` is not supported by its own component layout.** The
  revision that replaces it (and moves eight G06 cases) needs a measured car, not another guess.
- **D-13's spring-rate clause, corrected in place.** The decision originally listed "a stiffer spring
  raises ζ for the same damper" as a direction that must be trustworthy; `c_crit = 2√(k_w·m_s)` makes ζ
  fall as 1/√k_s instead (−8.7 % for +20 % spring). Dave amended D-13 on 2026-10-30 and the amended
  entry now carries the correction; 07 §9's row and the §9 note are aligned with it. Nothing is
  outstanding here — recorded because round 2's text still described the contradiction as live.
- **No bench validation has been done.** Every number in modules 2–7 and 10 is L0 + L1 (99 §1).

---

## 0.1 Changed in round 3 — the verifier's twelve, and this file's contract deltas

Round 2 came back with 12 numeric discrepancies (`docs/reviews/round2/01-numeric-verification.md`,
**D-1 … D-13**, every value independently recomputed) and a physics-side consistency list
(`02-consistency.md`: C1, F2, F4, F5, D1 and the release-gate contradiction). This pass fixes them.
One line each, with the branch taken where there was a choice.

| # | Item | Status | What changed, and where |
|---|---|---|---|
| 1 | **D-1** `x_cg` = the 55 %-front value | **closed** | `x_cg = w_f·l = 115.65 mm`, not `(1 − w_f)·l = 141.35`. The 45 % split is what the corner weights, the sprung masses, both ride frequencies and the 56 % balance were all built on; the other branch (adopt `w_f = 0.55`) moves 0.31125/0.24375 kg per corner, 9.541/11.623 Hz and 58.90 % balance, i.e. rewrites modules 1, 5 and 7. Both branches are tabulated in 01 §8.1 and the trade-off stated there and in 06 §1. Re-derived downstream: h_ra 7.789, M_el 0.23892, φ 0.20854, ΔW_el 0.78876/0.59340, balance 56.15, residual −0.055, M_f/M_r 0.10493/0.13399, φ_f/φ_r 0.18836/0.23506, balance 52.61, the 10 §4.2 table, G06.3–G06.12. |
| 2 | **D-2** ride-height label inverted | **closed** | 01 §6.2 step 1 now says `dz > 0` raises the chassis **i.e. droop of the wheel**, with the 1.44 mm consequence (10.7049 vs 9.2617) printed. 02 §6.6 and 10 §3.4/§4.3 were already right; G01.13 is the new case. |
| 3 | **D-3 + F2** fixed ±30 % band vs a computed one | **closed on the physics side** | 07 §6.6 is new: the band is ζ re-run at each input's tolerance ends, with the tolerances stored per field (01 §4.4 gains a tolerance column, `c_post` included) and the dominant input named per speed — `C_d` at 50 mm/s, `F_bo`/`c_post` above blow-off. Every fixed ±30 %/±50 % claim is gone from 07 and 99. The residual `spec.md` §4.3.1 policy delta (`REFUSE` on `damper_blowoff_force` vs `ASSUME(4.0)`) is recorded in 01 §4.4 and §11 below. |
| 4 | **D-4** V15's ±0.26 pp | **closed** | 99 §2.1: ±0.41 pp symmetric (−0.46 / +0.36), derived from 52.98 / 52.15 % at k_ch ±20 %. |
| 5 | **D-5** 06 §6.7's 1.6 %/mm and 0.12 pp | **closed** | 3.57 % of the transfer per mm, 0.09 pp for a 3 mm CG error, ±14.3 % and ±22.2 % over 24–32 mm. |
| 6 | **D-6** front frequency 10.782 Hz | **closed** | 10.781 Hz in 05 §6.2, 05 §6.5, G05.3 and 00 §5. |
| 7 | **D-7** V2's κ noise | **closed** | 99 §2.1: ±13 % at a uniform ±0.2 mm (RSS over six coordinates), ±6.7 % on the protocol session; the pass mark moves to ±15 % because ±10 % was inside the noise. 99 §7's κ row matches. |
| 8 | **D-8** `tie_out` y at +2 mm | **closed** | 74.0945 in 02 §6.9. |
| 9 | **D-9** V3's floor 0.37–0.94 | **closed** | 0.37–0.93 mm in 99 §2.1. |
| 10 | **D-10** `dTₒ/dbump` | **closed** | (0.0547, 0.9771) in 04 §6.5, with the dot product re-derived; the 57/43 split is unchanged. |
| 11 | **D-11** `W.z` peak 73.9 mm | **closed** | 73.77 mm at θ = 0.896 rad in 02 §3.2.2. |
| 12 | **D-12** three last-digit slips | **closed** | 01 §8.3 ê₁ = −0.139173; 04 §6.4's z_Tᵢ coefficient column re-derived at every row (−0.502 / +0.163 at the ends); τ(+4) = −1.290. |
| 13 | **D-17** camber/toe are per-wheel signed and not negated by mirroring | **closed** | 01 §2's ruling and 01 §6.1 now separate the *stored* value (unchanged on mirror) from the *global-frame* angle (camber negates, toe does not), with `s = ±1` doing the conversion inside the solver. New cases G01.12 (symmetric car: identical stored values, zero total toe) and I13 rewritten to assert both halves. |
| 14 | **D-11 (decision) vs 99 §8** release gate | **closed** | 99 §8 rewritten: a release ships when every property carries its evidence state; a property is promoted to `validated` only when its own V-test passes and is logged. No bench run blocks a release. V-tests, pass marks and the empty results log are kept; §2's priorities now block a *claim*, not a ship. |
| 15 | **C1 / F4 / F5** field and tolerance mismatches | **partial — see §11** | No field was renamed here (the schema is another agent's). Every physics-side field the schema does not yet carry is listed in §11's contract-deltas table; the two that matter for the band are `tolerance_pct` on estimated values and a gauge tolerance on `damper.piston_hole_dia`. |
| 16 | **This changelog** | **closed** | — |

### Golden cases changed by this pass

Stated so a reviewer can diff the suite rather than rediscover it. **Changed:** G01.1 (stored camber
unchanged, D-17), G01.8 (total toe +1.000°, not 0), G04.4 (τ(+4) = −1.290), G04.6 (zero crossing
+0.0000), G05.3 (10.781 Hz), G06.3 (h_ra 7.789 / M_el 0.23892 / φ 0.20854), G06.4 (1.20299 / 0.93929 /
56.15 %), G06.5 (3.5813 / 2.3783 / 120.2 % / 79.8 %, rear 87.1/112.9), G06.8 (−0.055 %), G06.9
(0.10095° / 55.70 %), G06.10 (0.18836 / 0.23506 / 52.61 %), G06.11 (56.15 %), G07.14 (no band below the
floor), G10.4 (0.20854 / 56.15 %), G10.5 (0.18836 / 0.23506 / 2.80 arcmin / 52.61 %), G10.9 (54.00 %).
**Added:** G01.12 (symmetric car, D-17), G01.13 (ride-height sign, D-2), G06.12 (`x_cg = w_f·l`, D-1),
G07.15 (the band is computed, D-3). **Withdrawn:** none.

### What round 3 did **not** close

- **The schema still has no tolerance field.** 07 §6.6 computes the band from per-field tolerances
  that no field in `fields.yaml` can carry (`value_object` is `{value, source}`). Until it does, the
  band is computable in the physics package and not storable in a file. §11 item 1.
- **`spec.md` §4.2.1 and `fields.yaml` still derive `x_cg = wheelbase · (1 − front_mass_share)`** —
  the D-1 slip, now in the normative schema, where 45 % front gives 141.35 mm instead of 115.65. Neither
  file is owned by this pass; it is §11 item 2 and the single most important thing to fix next.
- **`spec.md` §4.3.1 makes `damper_blowoff_force` `REFUSE` on absence** while 01 §4.4 assumes 4.0 N.
  Recorded as a policy delta in 01 §4.4; one row to change in the spec.
- **The two damper reference speeds** are still 50/200 mm/s in physics and 5/300 mm/s in the design
  (round-2 `02-consistency.md` §D). Physics-side numbers are quoted at 50/200 throughout; the design's
  5 mm/s readout is in the band the model says it cannot see.
- **The reference car still has no rear hardpoints**, so `IR_r`, `k_bar,r` and `z_rc,r` remain assumed
  inputs (unchanged from round 2).

---

## 1. What the package computes

Given a **chassis model** (hardpoint coordinates, spring rates, bar geometry, damper data, masses,
tyre radius) and a **setup** (ride height, shims, spring and bar choices, oil, piston, droop), the
package computes properties. Nothing else. It does not simulate a lap, does not predict grip, and
does not pick a setup for you.

| Module | File | Produces | Status in v1 |
|---|---|---|---|
| 1 | `01-coordinates-and-hardpoints.md` | A validated, unit-safe chassis model and the derived quantities every later module indexes | in |
| 2 | `02-front-view-kinematics.md` | Instant centre, roll centre height/lateral position/migration, camber gain, scrub radius, KPI, caster, trail | in |
| 3 | `03-side-view-antidive.md` | Anti-dive, anti-squat, side-view swing-arm angle | in, `diagnosticOnly`, suppressed on hinge arms |
| 4 | `04-steering.md` | Steering angles, Ackermann, bump steer, toe curve | in |
| 5 | `05-rates.md` | Installation ratio, wheel rate, ARB rate, roll stiffness, ride frequency | in |
| 6 | `06-load-transfer.md` | Corner weights, total lateral load transfer, front/rear balance, geometric vs elastic split, roll angle | in |
| 7 | `07-damping.md` | Critical damping, damper curve, ζ with its band and the direction-of-change table | in, **estimate** |
| 8 | `08-tyre-interface.md` | Nothing in v1. Defines what a grip model would need | out, deliberately |
| 9 | `09-motor-dyno.md` | Outline of the phase-3 motor/ESC model | out (phase 3) |
| 10 | `10-chassis.md` | Chassis mass, CG-height delta, torsional stiffness, and its effect on the roll-stiffness split | in, **optional/diagnostic** |

The build order is the file order, with one exception: module 10 is optional and feeds only module
6. Module 5 depends on module 2's geometry; module 6 depends on 2, 5 and (if present) 10. Module 4
depends on 2. Modules 3, 8 and 9 block nothing.

**One ladder of confidence, not three.** Round 1 found three different rating systems in play (a
per-module High/Medium/Low, the L0–L3 evidence ladder, and a per-question confidence in module 7).
Only the ladder survives: every displayed quantity carries an L-level from `99-validation.md` §1,
and the per-question confidences in module 7 are stated as bands on the number rather than as
grades.

---

## 2. Unit policy (ruling R-2)

Three layers, one conversion, and **no implicit power of ten anywhere**.

| Layer | Units | Why |
|---|---|---|
| Chassis/vehicle/setup JSON on disk | **mm, g, deg** (also N/mm, N·s/m, °/mm) | what a caliper and a setup sheet produce; a file read by a human must not need a conversion |
| Equations *in this document* | **mm, g, deg**, each equation carrying an explicit unit line | the reader checks arithmetic with the numbers they measured |
| Inside `setup_physics` | **SI**: m, kg, N/m, N·s/m, rad | `AGENTS.md`; keeps the numerical core consistent with published constants |
| UI | mm, g, N/mm, °, °/mm | display only |

**The single boundary.** The adapter in `setup_physics` (the `PhysicsInput` constructor) is the
only place a length is divided by 1000 or an angle converted to radians. Nothing above it and
nothing below it converts again. A module function never receives a number whose unit it has to
guess.

**The trap this closes.** Round 1's version of this section said "this document works in mm and the
package works in metres, so every equation below carries an implicit 10⁻³". That sentence is false
for `t²` terms and for `(1/a)²` terms — it is not a single power — and an implementer who applied it
mechanically got a bar rate 1000× too small from (5.7) and a load transfer 1000× too small from
(6.3). The rule now is the opposite: **an equation may not rely on an implicit factor; it must show
the conversion it applies**, as (5.9) already did in round 1 (`[N·mm/rad ÷ 1000 → N·m/rad]`).

Every equation in modules 2–10 therefore ends with a unit line such as:

```
k_bar [N/m] = k_θ [N·m/rad] · (IR_arm / a_arm[m])²                       (5.7)
```

and every symbol in every input table carries its unit. `npm run spec:audit` should reject an
equation line with no bracketed unit on its left-hand side.

**Proof that the two layers agree.** The reference roll-centre height is 9.9749 mm in `02` §6.2 and
0.0099749 m inside the package. `G02.1` is asserted at both, so a scaling slip fails a test rather
than a user's setup.

---

## 3. Notation

| Symbol | Meaning | Unit in this doc |
|---|---|---|
| x, y, z | vehicle axes; x forward, y **left**, z up (ISO 8855) | mm |
| s | side sign: **+1 left, −1 right** | — |
| ᵢ, ₒ | inner / outer end of a link | — |
| γ | camber, wheel plane angle to vertical, **per wheel, positive = top outboard** | ° |
| γ_kp | kingpin-axis angle, per wheel, same sign convention | ° |
| φ | chassis roll, **positive = left side up** | ° or rad |
| δ | steer angle, **positive = wheel points left** | ° |
| τ | toe, **per wheel, positive = toe-in** | ° |
| θ | crank angle of the lower arm about its inner point, from +y | rad |
| θ_vsa | side-view swing-arm angle from horizontal | ° |
| IR | installation (motion) ratio = spring/damper travel ÷ wheel travel | — |
| k_s, k_w | spring rate, wheel rate | N/mm |
| k_φ | roll stiffness of an axle | N·m/rad |
| k_ch | chassis torsional stiffness | N·m/rad |
| J | polar second moment of a bar section; `(1/3)·w·t³` for a thin plate | mm⁴ or m⁴ (stated per equation) |
| ζ | damping ratio | — |
| h | centre-of-gravity height | mm |
| h_u, h_s | unsprung and sprung CG heights | mm |
| m, m_s, m_u | total, sprung, unsprung mass | kg |
| F_z | vertical load on a wheel | N |
| ΔW | lateral load transfer across an axle | N |

Suffixes: `f`, `r` for axles; `L`, `R` for sides; `_rc` roll centre; `_cg` centre of gravity; `_kp`,
`_cas` for kingpin inclination and caster; `_ch` chassis.

---

## 4. Failure is a value, not an exception

`AGENTS.md` and review rule 4: degenerate geometry must be handled, not crashed. The package
returns a sealed result type for every geometric query, **with per-field validity** — a struct of
`Solved<double>` fields, so that one undefined field never invalidates its siblings (round 1's
G02.7 proved the need: for parallel arms `z_rc` is defined and `y_rc` is not).

```text
Solved<T> = Defined(value, conditioning, flags) | Undefined(reason, inputs)
```

**Reasons** — closed set. Every reason string that appears in any module must be a member of this
table; a spec-audit check enforces it.

| Reason | Trigger | What the UI says |
|---|---|---|
| `parallelLinks` | the two arm lines have no finite intersection (normalised cross product below `kParallelTol`) | "instant centre at infinity — parallel links" |
| `noIntersection` | a circle–circle solve has no real solution at load time | "this geometry cannot be built" |
| `coincidentPoints` | two hardpoints that must differ are within `kCoincidentTol` | "two hardpoints coincide: <names>" |
| `outOfTravel` | requested bump is outside the axle's stored travel window | "outside the modelled travel" |
| `outOfRackTravel` | requested rack position is outside the rack's stored travel | "outside the rack's travel" |
| `incompleteModel` | a required point or field is missing | "model incomplete: <list>" |
| `degenerateGeometry` | a geometric construction is undefined for this input set (zero-length link, zero link extent, tangent circle pair, `\|d̂_y\|` below tolerance in a construction that divides by it) | "undefined for this geometry: <case>" |
| `noSideViewConstruction` | the lower arm is a `hinge` whose axis is within 8° of x, so module 3 has no side-view line to draw | "not computable for a transverse hinge arm" |
| `noAntiGeometry` | the side-view IC is on the wrong side of the contact patch (pro-dive / pro-squat) | "0 %, pro-dive geometry" |
| `noMotionRatio` | `dz_w/dθ` or the damper's velocity is zero | "the spring does nothing in this geometry" |
| `noRollStiffness` | `k_φ,total = 0` | "no roll stiffness" |
| `ambiguousBranch` | two solutions are equidistant from the static reference | "two solutions: result not unique" |
| `zeroLateral` | a ratio whose denominator is `a_y` is requested at `a_y = 0` | "undefined at zero lateral acceleration" |
| `outOfDomain` | non-physical input (negative rate, zero mass, `T ≤ 0 K`) | validation error, refused at entry |

**Flags** — also a closed set, also a spec-audit check: `diagnosticOnly`, `lowConfidence`,
`assumedLinkage`, `progressiveSpring`, `rockerApproximated`, `symmetricDamper`, `rollCentreAboveCg`,
`temperatureInsensitive`, `noDamping`, `lowAngle`, `belowFrictionFloor`, `chassisRigidAssumed`,
`chassisTorsionEstimated`. A flag is a statement about the answer; a reason is the absence of one.
Round 1 mixed the two (half of its ~20 names were flags), which is why the UI could not decide
between a caveat and a refusal.

Rules:

1. **No `NaN` and no `Infinity` may cross a public API boundary.** A property test over randomised
   geometry asserts this.
2. `parallelLinks` is not an error. Parallel arms are a legitimate design, and the answer to "where
   is the roll centre?" is the limit expression in `02` §4.3, **not** a hard zero — round 1's rule
   said `rollCentre = 0 mm`, which is only right for horizontal parallel arms. Take the limit, carry
   the flag, and say so in the UI.
3. Tolerances are explicit constants, in **mm** (the document's unit) with the SI value in brackets:
   `kParallelTol = 1e-9` on the normalised cross product, `kCoincidentTol = 1e-3 mm` (1 µm = 1e-9 m;
   round 1 had `1e-9 m`, a nanometre, in one file and 1 µm in another — one constant now),
   `kCircleTol = 1e-6 mm`.
4. **Precedence.** Structural errors (presence, finiteness, coincidence) are load-time and stop the
   load. Travel and rack limits are checked *before* the solve, so an out-of-range request returns
   `outOfTravel`/`outOfRackTravel` deterministically rather than whichever circle test happens to
   fail first. `noIntersection` is a load-time condition only.

---

## 5. Every input carries its provenance

Review rule 1: no number without a source. Every input field has, in addition to its value, a
`source` and a `confidence`, and — where the value is an estimate — a `tolerance_pct`.

| confidence | Meaning | UI treatment |
|---|---|---|
| `measured` | the user measured this with a caliper/setup station | normal |
| `manufacturer` | published by the chassis maker | normal |
| `derived` | computed from other stored values by a stated equation | normal, links to the equation |
| `estimated` | borrowed from a similar car, or scaled; `tolerance_pct` required | shown with a tilde: `~78.0`, and the tolerance if present |
| `assumed` | a modelling assumption, not a measurement (e.g. `C_d` of an orifice) | warning dot |
| `library` | copied from another chassis's model | own badge, naming the donor car |

**No blanket tolerance.** Round 1's design attached "±15 %" to every estimated input. A shim
thickness and a CG height are not the same quantity; the tolerance is a stored per-field value and
where it is absent the badge shows no number.

Physics constants that are *not* measurements of the car (fluid density, discharge coefficient,
shear modulus, gravity) appear in each module's input table with a default and a range, labelled
`assumed`. **No constant is invented silently.** Where no defensible default exists, the field is
required and every output that consumes it is `Undefined(incompleteModel)` naming the field.

---

## 6. What is not claimed about the predecessor

Round 1 correctly deleted this document's RC3 comparison tables: every row was an unverifiable
claim about a program nobody in this repo has run, in a document whose own checklist forbids
invented citations. What survives is the only part that constrains us:

- Modules 2–7 are derived from published vehicle dynamics (Milliken & Milliken ch. 17–19, Gillespie
  ch. 6, Dixon) and from arithmetic printed in these files. They are **not** reverse-engineered from,
  nor validated against, any other calculator.
- Where a number here disagrees with another tool, the resolution is the printed arithmetic and a
  bench measurement (`99-validation.md`), not a comparison of outputs.
- "Our additions" claims are gone with the table. If a future revision wants to claim novelty, it
  must cite a published source for what it is being compared against.

---

## 7. v1 scope decisions (do not relitigate without Dave)

| Decision | Choice | Why |
|---|---|---|
| Frame | ISO 8855, y left, origin at the rear axle centre on the ground plane (R-1) | every equation in modules 2–6 was derived in it; it is the frame the published references use |
| Units on disk | mm, g, deg (R-2) | a racer's instruments; one conversion at the adapter |
| Front-view model | 2D transverse-plane four-bar, solved by circle intersection + bisection on the crank angle | robust, closed form, testable; a full 3D solve is a v2 upgrade |
| Plan-view model | vertical steering axis through the axis's ground point, rigid knuckle | the standard hand construction; the 42 % ρ bias it carries is stated in 04 §5.1 |
| Anti-dive/anti-squat | computed for arms with side-view extent, flagged `diagnosticOnly`, never used in advice, `noSideViewConstruction` for hinge arms | module 3 |
| Tyre model | none | module 8 |
| Damper model | orifice + linear blow-off, per direction; ζ is an **estimate** with a band, and the direction of change is the deliverable | 07 §0, §9 |
| Chassis | optional module; mass, CG height and torsional stiffness; balance effect only | module 10, issue #11 |
| Motor dyno | outline only | phase 3 |

---

## 8. Golden tests

Every module ends with a table of golden cases. They are the acceptance criteria for the module and
the source of `app/test/golden/`. Conventions:

- IDs are `G<module>.<n>`, e.g. `G02.3`. The test name contains the ID so
  `npm run spec:audit` can trace spec → test.
- **Tolerances are part of the case.** Geometry 1e-3 mm; angles 1e-4 °; ratios 1e-4 relative;
  damping forces 1e-3 N; stiffness and loads 1e-4 relative. A case that asserts a value derived from
  a finite difference states the step, because the step is part of the value.
- **Every expected value has a stated origin**: `hand calc §x.y` (arithmetic printed in this
  document, checkable with a calculator) or a named published result. No expected value is "what
  the code produced". Where a value comes from a solver table rather than printed arithmetic, the
  case says so and the tolerance reflects the printed precision — round 1's G02.4 cited a hand
  calculation that produced a different number from the one it asserted.
- At least one case per module is a **degenerate** case, because that is where implementations
  quietly return `NaN`.
- **Structural cases are worth more than arithmetic ones.** A case that asserts an identity
  (mirror symmetry, mass budget, a limiting case, a sign) catches a class of error; a case that
  re-states a printed decimal catches a typo.

---

## 9. How a number reaches the screen

```text
ChassisModel (mm/g/deg on disk, validated)  ──┐
Setup (mm/g/deg on disk, validated)         ──┼──▶ adapter: mm→m, g→kg, deg→rad (ONE place)
Environment (temp, g)                       ──┘            │
                                                            ▼
                                              module function (SI) → Solved<T>
                                                            │
                                  ┌─────────────────────────┴───────────────────────┐
                                  ▼                                                 ▼
                     value + units + conditioning                    Undefined(reason)
                                  │                                                 │
                     display conversion (mm, °)                     "undefined for this geometry: <reason>"
                                  │                                                 │
                                  └──────────────────▶ widget ◀─────────────────────┘
```

Anything the user can change on the main setup screen should be recomputed in under 5 ms on a
mid-range phone so numbers update live while a slider moves. The honest cost statement: one
front-view query is a **bump inversion** — a bounded scan plus up to 40 bisection steps, each
evaluating one circle intersection — so a 13-point roll sweep on both axles is ~26 × 2 × 40 ≈ 2000
circle intersections. Still microseconds-to-a-millisecond, but it is 40× the cost round 1's §9
implied, and the performance budget should be read against that number.

---

## 11. Contract deltas — physics-side fields the schema does not yet carry

The schema is owned by `docs/specs/fields.yaml` (D-16) and this pass does not rename or add anything in
it. What follows is the list this package needs and cannot yet store, so the schema owner can pick each
item up in one place instead of finding them scattered through nine modules. Units are the ones the
physics documents already state; none is invented here. **Snapshot: 2026-10-31**, against
`fields.yaml` as it stands in the working tree.

The round-2 findings C1, F2 and F5 are closed on the schema side:
`corners.<corner>.damper.c_post` (N·s/m), `body.chassis.{material, thickness, span, rail_factor,
torsion_measured, ride_height_basis}`, `body.cg.components[]`, `body.cg.unsprung_height` and the
per-axle `body.mass.unsprung_front/_rear` all exist in `fields.yaml`, and 01 §4.4 has been restated to
match (§5.1 is the path map). What remains is the part no field can fix on its own:

| # | Physics-side field | Unit | Where this package uses it | What the schema has today | Delta |
|---|---|---|---|---|---|
| 1 | **`tolerance_pct`** on every `estimated` value, and an **absolute tolerance** (in the field's own unit) on every `measured` value | — / field's unit | 07 §6.6 — the ζ band *is* the re-run at these ends; 01 §4.4's tolerance column; `spec.md` §4.8 requires the band to be "recomputed with each estimated input moved to the ends of its own `tolerance_pct`" | `value_object` is `{value, source}`; `tolerance_pct` appears only in two *notes* (f_blowoff, c_post), never as a field | **Add a third member to the value object** (or a sibling field per path). Without it the band cannot be stored or re-derived from a file, and §4.8's own test — "doubling one input's `tolerance_pct` widens the band" — has nothing to double. |
| 2 | **`x_cg` derivation direction** | mm | 06 §6.3–6.5, 10 §4.2, G06.3–G06.12 | `body.cg.front_mass_share` (%), with the note `x_cg = wheelbase · (1 − front_mass_share)` | **Formula, not field:** with 45 % front that expression returns 141.35 mm; the correct one is `x_cg = wheelbase · front_mass_share` = 115.65 mm (D-1). One character, and every load number in the app depends on it. |
| 3 | `corners.<corner>.damper.piston_hole_dia` **measurement tolerance** | mm | 07 §6.6 (d_h dominates the 50 mm/s band at −12/+15 %), 99 §7, F4 | the field exists; the ±0.02 mm pin-gauge figure appears only in a note | covered by item 1; listed separately because it is the *only* measured input whose tolerance materially changes the answer, and the note already promises it enters the band |
| 4 | `axles.front.steering.rack.travel_limit` (`s_max`) | mm | 04 §3.6, 02 §3.2.2 — the mechanical guard that makes `outOfRackTravel` reachable | `rack.{x, z, y_left, y_right, travel_per_turn}`; `travel_per_turn` is display-only | **Field needed.** Without a stored limit the model returns +294° of steer at rack +20 mm (04 §3.6); `travel_per_turn` is not it. |

Three policy deltas that are not fields, recorded so no one has to rediscover them:

- **`damper_blowoff_force` `on_absence`.** `spec.md` §4.3.1 says `REFUSE`; 01 §4.4 assumes 4.0 N with a
  ±50 % tolerance, because a REFUSE means ζ is refused for every file a racer can actually produce
  from a caliper and a bottle label (C1). `spec.md` §4.8 already describes the field as
  estimated-with-tolerance, so §4.3.1 is the row to change.
- **`damper.piston_holes` lower bound.** Physics allows 2–8 holes (01 §4.4, 07 §5: `A_h = 0` is
  `outOfDomain`); the schema's plausible range starts at 1. A one-hole piston is physically possible but
  the model has nothing to say about it at the edge, so the two ranges should be reconciled in the
  schema, not in a module.
- **The two damping reference speeds.** `50` and `200` mm/s (07 §6.3, `analysis_inputs.damping_*`) versus
  the design's `5` and `300`. Physics owns the band, the design owns the display; the design's low speed
  sits in the range where the model says it cannot see (below 20 mm/s, 99 §5.3).

---

## 12. Review checklist for this document

- [ ] Every symbol has a unit, and every equation ends with a bracketed unit on its LHS.
- [ ] No equation depends on an implicit power of ten.
- [ ] Every constant has a default and a range, or is required from the user.
- [ ] Every module has: assumptions, where it breaks, degenerate behaviour with a reason from §4's
      closed set, a worked example with visible arithmetic, and golden cases with stated origins.
- [ ] No step relies on a number that appears nowhere else — or, where it does, the number is
      labelled an input with a range and a source.
- [ ] Every displayed quantity has a precision in `99-validation.md` §7, derived from a stated
      sensitivity rather than chosen.
- [ ] No RC3 text, no invented citations.
