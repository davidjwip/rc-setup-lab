# Round 1 review — physics correctness

Reviewer scope: `docs/specs/physics/00-overview.md` … `09-motor-dyno.md`, `99-validation.md`.
Method: every worked example was re-derived in an independent Python implementation (4-bar solve with
the branch fixed at static, bisection on `W.z`, circle–circle solves, plan-view steering) rather than
by re-reading the doc's arithmetic. Scripts and outputs: `/opt/data/cache/scratch/rcphys/`. Nothing in
the spec tree was edited.

Reproduction summary — 41 numeric examples/tables recomputed:

| Module | Recomputes | Fails |
|---|---|---|
| 01 §8.3 | a, b, d, damper-on-arm check | — |
| 02 §6.1–6.7 | IC, z_rc, κ, +2 mm camber, per-degree-of-roll, migration table (5 rows), bump table (4 rows), KPI/caster/trail/scrub, buggy corner | §9 sensitivity table |
| 03 §5.1–5.2 | pan-car 407.9 %, TC 316.1 %, perturbation table | the hardpoints the TC case is built on |
| 04 §6.1–6.5 | ρ/L/r_p, both steer angles, Ackermann 127.0 %, full bump-steer table, coefficient + chord, z_Tᵢ sensitivity, dTₒ/dbump split | §6.3 arm-offset table; the toe **sign** |
| 05 §6.1–6.5 | IR (both routes), IR vs travel, k_w, f, c_crit, bar, k_φ | the sprung masses everything is built on |
| 06 §6.1–6.5 | masses, TLLT, h_ra/M_el/φ, all nine transfer terms, balance, residual, per-wheel loads | "68 %" |
| 07 §6.1–6.5 | K_h, v_bo, all six curve rows, motion-ratio case, temperature | — (values inherit 05's mass error) |
| 09 §4 | G, rollout, speed, force, acceleration, k_e, 22T result | — |

Where a number below is mine, it comes from those scripts; the module's own arithmetic reproducing a
value is not evidence that the value is right, so the findings are ordered by what reaches a racer.

---

## BLOCKER

### B1 — Every y-signed quantity inverts on the right-hand corner (γ_kp, KPI, scrub radius)

**Where** `02-front-view-kinematics.md` §3.6 (2.12), §3.7 (2.19), (2.22); contradicted by
`01-coordinates-and-hardpoints.md` §6.1.

**Quote**
> `γ_kp = atan2(Uₒ.y − Lₒ.y, Uₒ.z − Lₒ.z)     [deg], positive = top outboard    (2.12)`

> `KPI = atan(−Δy/Δz)          positive when the top leans inboard          (2.19)`

> `scrub = y_cp − y_g            positive when the axis meets the road inboard of the contact patch (2.22)`

and, in 01 §6.1, the mirroring rule:

> | caster, KPI, trail | unchanged (they are defined per wheel, mirrored in y) |
> | scrub radius | unchanged in magnitude, sign convention already per-wheel |

**Wrong.** All three formulas are written against the *left* corner's y sense. `|mirror_of|` in 01 §5
builds the right corner by **negating y only**, so on the RF (`Uₒ = (254, −72.80, 44)`,
`Lₒ = (259, −78, 7)`):

| quantity | 02's formula on the RF | 01 §6.1 says | physical |
|---|---|---|---|
| γ_kp | `atan2(+5.20, 37) = +8.0000°` | — | **−8.0000°** (top leans inboard, i.e. camber-negative) |
| KPI | `atan(−5.20/37) = −8.0000°` | +8.0000° | **+8.0000°** |
| scrub | `−86 − (−78.9838) = −7.0162 mm` | +7.0162 mm | **+7.0162 mm** |

So on a symmetric car the app would print KPI −8.0° and scrub −7.0 mm on the right front wheel, and
(2.13) would give `γ_b(RF) = γ₀ + [γ_kp(z) − γ_kp(0)] = +2.0 + 0.2515` in bump — i.e. the right front
wheel *gains positive camber* in bump while the left gains negative. Half the front-end screen is
sign-flipped, and the model silently asserts that a symmetric car is asymmetric. `01` §5 also
negates `camber` and `toe` on mirroring, which is only correct for camber, not for toe (see M9).

**Correct.** Carry the side sign into the y-difference, as 01 §6.1's table already promises:

```
s = +1 for L, −1 for R
γ_kp  = atan2(s·(Uₒ.y − Lₒ.y), Uₒ.z − Lₒ.z)      positive = top outboard (per wheel)
KPI   = atan(−s·Δy/Δz)
y_g   = Lₒ.y − s·(Δy/Δz)·Lₒ.z
scrub = s·(y_cp − y_g)                            positive = inboard
```
Equivalently: define all per-wheel camber-like quantities in an outboard-positive frame and state that
`02` is written in that frame, not in vehicle coordinates. `caster`, `trail` and `x_g` are unaffected
(they use x), which is why 01 §6.1's "unchanged" row is right for caster and trail and wrong for KPI
and scrub.

**Test.** Mirror the LF corner and assert `KPI_RF == KPI_LF == +8.0000`, `scrub_RF == +7.0162`,
`γ_kp_RF(0) == −8.0000`, `κ_RF == κ_LF == −0.10982`. This is exactly 99-validation I4; today I4
*contradicts* (2.12) rather than testing it, which is the tell that only one of them can be right.

---

### B2 — Module 5's sprung masses contradict modules 1 and 6; the mass budget does not close

**Where** `05-rates.md` §6.2, §6.5; against `01` §8.1 and `06` §6.1.

**Quote**
> `Spring 3.50 N/mm, sprung corner mass 0.310 kg:` … `f = 60.067/(2π) = 9.560 Hz`

> `Rear spring 2.60 N/mm, IR_r = 0.7071, sprung rear corner 0.400 kg`

**Wrong.** `06` §6.1 derives the sprung mass from the same car: `m_s,f = 0.48749 kg` **per axle**
(0.24375 per corner) and `m_s,r = 0.62249 kg` per axle (0.31124 per corner), with `m_s = 1.110 kg`.
05's four corners sum to `2(0.310 + 0.400) = 1.42 kg` — 28 % more sprung mass than the car has, and
more than `m_total = 1.35 kg` once the 0.24 kg of unsprung mass is added (1.66 kg). 05's front figure
(0.310) is numerically the *rear* corner's correct value, which suggests a transcription slip that
then propagated everywhere.

**Correct.** Per corner: front 0.24375 kg, rear 0.31124 kg. Recomputed:

| quantity | doc | correct |
|---|---|---|
| front f | 9.560 Hz | **10.781 Hz** |
| front c_crit | 37.242 N·s/m | **33.023 N·s/m** |
| rear f | 9.073 Hz | **10.286 Hz** |
| rear c_crit | 45.607 N·s/m | **40.231 N·s/m** |

Every ζ in module 7 then rises by √(0.310/0.24375) = 1.128: ζ(50 mm/s) becomes **0.2556**, not 0.2266;
ζ at blow-off becomes **0.507**, not 0.449. G05.3, G05.6 and G07.3–G07.6 all need new expected values.
The 5 % front/rear split survives (1.048), which is why the error is easy to miss.

**Test.** A property test that `Σ m_s,corner + m_u == m_total` to 1e-9 across every module's worked
example — this single assertion catches the class of error and nothing in the spec currently makes it.

---

### B3 — Module 3's worked example is built on hardpoints the reference car does not have, and the real
car cannot produce a front SVIC at all

**Where** `03-side-view-antidive.md` §5.2 and G03.2/G03.3.

**Quote**
> `lower: (250.0, 12.0) → (259.0, 7.0)`
> `upper: (250.0, 45.0) → (254.0, 44.0)`

**Wrong.** Module 1 §8.2 has `lca_in_a = (238, 30, 12)` and `lca_in_b = (272, 30, 12)`: the lower arm
is a **hinge whose axis is parallel to x** at `(y, z) = (30, 12)`. There is no lower-arm point at
x = 250; 250 is the *upper* link's inner x (`uca_in = (250, 42, 45)`) and has been borrowed for the
lower one to manufacture a 9 mm side-view projection and a finite SVIC at (142, 72).

For a hinge arm, the side-view projection of the lower link is not a 9 mm inclined line:
- taking the hinge axis as the link line (the textbook construction) gives a horizontal line `z = 12`,
  and intersecting it with the upper line gives **SVIC = (382.0, 12.0)**, `x_ic > x_cp = 257`;
- taking the constraint form (the ball joint has zero x-velocity) gives a vertical line at x = 259 and
  **SVIC = (259.0, 42.75)**, also `x_ic > x_cp`.

Both land on the wrong side of the contact patch, so by 03 §7's own rule the reference car is
`Undefined(noAntiGeometry) — pro-dive`, not 316.1 %. The module's headline number, its cancellation
argument in §4 and two golden cases are computed from a geometry that does not exist.

**Correct.** Either (a) make §5.2 a swing-arm car and keep the construction, or (b) keep the reference
car and state that a pure-transverse hinge has no side-view construction — which is the honest answer
and is what §6's "suppress below 10 mm" rule already implies. Note the real projection for this arm is
**34 mm** (238→272), so the 10 mm suppression rule would *not* fire, and the app would display 300 %+
anti-dive on a car whose lower arm cannot generate any.

**Test.** G03.2 as a golden case must be driven by module 1's hardpoint table, not by literal
coordinates typed into the module. Add the identity: for the reference TC corner, the side-view
projection length must be 0 (hinge) and the result `Undefined(noAntiGeometry)`.

---

### B4 — Bump steer's sign is inverted against module 1's toe convention

**Where** `04-steering.md` (4.12), §6.4, G04.4; against `01` §3.

**Quote**
> `τ(bump) = ψ(bump) − ψ(0)   (4.12)`

> | +2 | 33.948 | 51.4330 | +0.484 | +0.484 |

and 01 §3:

> | Toe (per wheel) | τ | wheel front edge toward the **centreline** (toe-in) |

**Wrong.** ψ is the knuckle's plan polar angle about A, counter-clockwise positive. For the LF, an
increase in ψ moves the rearward steering arm inboard, which rotates the knuckle CCW, which moves the
wheel's *front* edge outboard — **toe-out**. So +0.484 in the τ column is 0.484° of toe-**out**, and
(4.12) as written defines τ with the opposite sign to 01 §3. Worse, τ is one scalar per *corner* while
the two front wheels' toe changes are physically opposite quantities: on a symmetric bump both wheels
toe out by 0.484°, so the *total* toe change is −0.968° in the toe-in convention, and a per-corner
value of "+0.484° toe" is meaningless as displayed.

**Correct.**
```
τ_wheel = −(ψ(bump) − ψ(0))        per wheel, positive = toe-in
total toe change = τ_L + τ_R = 2τ_wheel   (symmetric bump)
```
and §3.5's `τ₀ + τ(bump)` is then legal, because τ₀ is toe-in-positive too. As it stands, adding a
toe-in-positive static toe (+0.5° on the LF) to a toe-out-positive increment is dimensionally a
subtraction.

**Test.** At bump +2 mm assert `toe_L = −0.484°` and `toe_R = −0.484°` in the toe-in convention, and
assert `sign(toe_at_+2) == −sign(δ_steer_at_+2)` for the LF. Any test that only checks magnitudes
passes today.

---

### B5 — The unit policy is violated by six equations, and the worked arithmetic hides it

**Where** `00-overview.md` §2; `05` (5.7); `06` (6.3), (6.7), (6.8), (6.9).

**Quote** 00 §2:

> This document works in mm and the package works in metres, so every equation below carries an
> implicit 10⁻³.

and 05 (5.7):

> `k_bar = k_θ · (IR_arm / a_arm)²` … `k_bar = 0.43792 × (0.80/0.020)² = 0.43792 × 1600 = 700.67 N/m`

**Wrong.** The input table declares `a_arm` in **mm** (12–30). An implementer following 00 §2's
"implicit 10⁻³" statement mechanically — the one thing §2 promises is mechanical — computes
`0.43792 × (0.80/20)² = 7.007e-4`, a 1000× error in every bar rate and hence in every roll-stiffness
and balance number. The example only works because `0.020` is silently written in metres. The same
pattern occurs in `06`: the input table declares `t` in mm, `h` in mm and `z_rc` in mm, and the
arithmetic uses `0.172`, `0.028`, `0.009975` metres, with no stated conversion. Contrast (5.9), which
*does* document its own conversion (`[N·mm/rad ÷ 1000 → N·m/rad]`) — so the spec is inconsistent with
itself about whether the conversion is implicit.

**Correct.** One of: (a) every equation is stated in SI with the symbol table in SI, or (b) every
equation carries an explicit conversion factor as (5.9) does. Recommendation: state `k_bar [N/m] =
k_θ · (IR_arm/a_arm[m])²` and `ΔW [N] = k_φ φ / t[m]`, and add a units column to each equation line.
The `10⁻³` cannot be "implicit" — it is not a single power for `t²` or `(1/a)²` terms.

**Test.** A table-driven test that feeds each equation's inputs in the units its *input table* declares
and asserts the worked value; G05.4 with `a_arm = 20` (mm) must return 0.70067 N/mm or the equation is
not unit-safe. `tool/spec_audit.dart` could check that every symbol in every equation has a declared
unit.

---

### B6 — The roll-sign worked example in the conventions table is backwards

**Where** `01-coordinates-and-hardpoints.md` §3.

**Quote**
> **Roll sign.** φ > 0 means the chassis lifted its left side. In a left-hand corner the car rolls
> right, so φ < 0; the outer (right) wheel compresses and the inner (left) wheel droops.

**Wrong.** Rolling right *is* the left side lifting, which by the row immediately above (`φ | positive
means left side up`) is φ **>** 0. As written, the sentence asserts φ < 0 for a left-hand corner *and*
that the right wheel compresses, which are inconsistent with each other under the stated convention.
`02` §3.5 ("The left wheel droops and the right compresses when the left side rises — which is the
left-hand corner case"), `02` (2.11) and `06` §6.5 ("left-hand corner, so the right wheels are
loaded") all assume φ > 0. The sentence that defines the convention is the one that is wrong, and any
code that keys "left-hand corner" to the sign of φ inherits it.

**Correct.** "In a left-hand corner the car leans right, which lifts the left side, so φ > 0; the
outer (right) wheel compresses and the inner (left) droops." (02's equations are already consistent
with this; only 01 §3's prose needs to change.)

**Test.** For `a_y = +g` (toward +y, a left-hand corner) assert `φ > 0` and `F_z,RF > F_z,LF`. This is
the test that should be sitting next to I9 and isn't.

---

### B7 — Hinge-type lower arms have no side-view construction, and the spec never notices

**Where** `03` §3.1, §6 assumption 1; `01` §4.1.

**Quote** 03 §3.1:

> Project the corner onto the **x–z plane** and intersect the projections of the two link lines, the
> same construction as module 2 §3.3 with y replaced by x[.]

**Wrong.** This is exact only for a link whose axis lies in the projection plane. For the touring car —
the car every worked example uses — the lower arm is a hinge whose axis is *along x* (`01` §4.1: "a
lower wishbone that pivots about a fore-aft hinge axis"). Its side-view projection is either a
degenerate horizontal line (the axis) or a zero-length one (the arm), and the construction returns
either ±infinity or an arbitrary point depending on which point on the axis you pick. `01` §9.4 states
the projection-error caveat for module 2 but not this degenerate case, and 03 §7 handles only
*parallel* links (`|m₁ − m₂| < 1e-9`), which is not what happens here.

**Correct.** Detect hinge arms explicitly: if `arm_type.lower == "hinge"` and the axis direction has
`|d_x| > 0.99`, the lower link's side-view line does not exist; return
`Undefined(noSideViewConstruction)` with the explanation, or use the velocity constraint (the ball
joint's x-velocity is zero, so the SVIC lies on x = x_Lₒ). Do not silently pick a point on the axis.

**Test.** Reference car front corner → `Undefined(noSideViewConstruction)`; a buggy (A-arm) corner →
a finite SVIC. Neither case exists today, which is how B3 survived.

---

## MAJOR

### M1 — `06`'s "68 %" inner-wheel figure is 80 %

**Where** `06-load-transfer.md` §6.5.

**Quote** "The front axle's inner wheel drops to 68 % of its static load while the outer rises to
120 %."

**Wrong.** `2.3855 / 2.9798 = 0.8005`. The outer figure (120 %) is right, so the pair is internally
impossible — the two must sum to 2.0.

**Correct.** 80 % inner, 120 % outer. (This is the number 06 tells the user to show next to tyre load
sensitivity in module 8, so it is the one number from module 6 that survives into a claim.)

**Test.** `G06.5` should assert both *and* assert `inner + outer == 2 × static` — a one-line identity
that would have caught it.

### M2 — `06` (6.3) is framed as a per-axle equation but is the whole-car total

**Where** `06` §3.2, (6.3).

**Quote** "For an axle of track t: `ΔW = m · a_y · h / t` … This is the whole-car lateral load transfer
felt by one axle's pair of wheels."

**Wrong.** The two sentences contradict each other and the formula is only valid for the second
reading, with `t` the *mean* track. Implemented literally against an axle (which is what "for an axle
of track t" invites), it returns 2.156 N for the front and 2.131 N for the rear and the app reports
4.29 N of transfer on a car that has 2.14 N — a 100 % error that still "looks plausible". §6.2 in fact
uses t̄ = 173, i.e. the whole-car reading. Also, "the outer wheel gains ΔW/2" is wrong for the
whole-car ΔW: the per-wheel split is ΔW_i/2 for the *axle* value, which is what §6.5 computes.

**Correct.**
```
TLLT = m·a_y·h/t̄                       (whole car, t̄ = mean contact-patch track)
per axle: ΔW_i = ΔW_el,i + ΔW_geo,i + ΔW_u,i     (6.7)–(6.9)
per wheel: F_z,outer/inner = F_z,i ± ΔW_i/2
```
**Test.** Rename the function `totalLateralLoadTransfer(meanTrack)`; assert (6.7)+(6.8)+(6.9) summed
over axles equals (6.3) to within the stated residual (06 §3.7). I9 in 99-validation tests linearity
but not this identity, so a per-axle implementation passes I9.

### M3 — `06`'s worked example uses an `h_u` that its own default rule forbids

**Where** `06` §2, §6.1.

**Quote** "`h_u` default: the wheel-centre height (= tyre radius)" … "`h = 28.0 mm, h_u = 20.0 mm`"

**Wrong.** Module 1 gives the reference car `tyre_radius = 32.0 mm` and `wc.z = 32.0 mm`. The example
uses 20.0 mm, which appears nowhere else in the spec (the 00 §10 checklist: "No step relies on a number
that appears nowhere else"). Consequence:

| | h_u = 20 (doc) | h_u = 32 (the stated default) |
|---|---|---|
| h_s | 29.7297 mm | 27.1351 mm |
| M_el | 0.23459 N·m | 0.20634 N·m |
| φ at 1 g | 0.20476° | 0.18010° |

A 12 % change in the headline roll-angle number, and it propagates into every ΔW_el.

**Correct.** Either h_u = 32.0 mm with the golden values recomputed, or state a defensible measured
h_u for the reference car with a source. (Physically, 20 mm is more defensible than 32 — the unsprung
mass is concentrated at the hub/upright, below the wheel centre — so the *default rule* is the thing
that should change, to "≈ 0.6 × tyre radius" or a measured value.)

**Test.** Assert `h_s == (m·h − m_u·h_u)/m_s` **with h_u taken from the model**, not from a literal;
and assert the reference car's `h_u` equals `tyre_radius` if that is the rule.

### M4 — 99-validation I10 asserts an identity that module 6 says is false

**Where** `99-validation.md` §4 I10; `06` §3.7.

**Quote** "| I10 | sum of parts | elastic + geometric + unsprung = total, per axle, to 1e-9 |"

against 06 §3.7: "The residual should be within a few percent. It is not exactly zero".

**Wrong.** On the reference car the residual is **−1.23 %**, i.e. 2.6e-2 N against a 1e-9 tolerance.
I10 as written fails on the spec's own worked example, and cannot be made to pass without changing the
model (the two axles have different tracks, and the geometric term is distributed by sprung force
fraction). 99 §4 says "I9 and I10 are the two that catch the confident-but-wrong class of error" — I10
as specified would instead block release.

**Correct.** I10 becomes: `|ΔW_el,i + ΔW_geo,i + ΔW_u,i summed − m·a_y·h/t̄| / (m a_y h/t̄) < 0.05`, with
the reference value −1.23 % as the regression anchor; plus a per-axle identity that *does* hold
exactly and is worth asserting: `ΔW_el,i == k_φ,i·φ/t_i` recomputed through the public API to 1e-9
(note `ΣΔW_el = M_el/t̄` only when the two tracks are equal — with 172/174 the doc's own numbers give
1.35712 vs 1.35599, a 0.08 % gap, so do not write that one).

**Test.** The corrected I10 on the reference car returns −0.01223; the current one fails.

### M5 — The P1 validation gate V2 cannot pass against the model's own κ

**Where** `99-validation.md` §2 V2 and §3.3; `02` §7.

**Quote** V2: "setup station: camber at ride height, then with a **5.00 mm** spacer under the wheel |
±10 % of κ, and the **sign** correct"

against 02 §7: "Camber gain is a derivative. Over ±5 mm of travel the secant differs from the
derivative by 15 % on this car".

**Wrong.** By the spec's own definition (2.14) the app reports the tangent at ride height,
**κ = −0.10982 °/mm**. The procedure in §3.3 measures a *one-sided* secant from 0 to +5 mm:

```
γ_kp(+5) = −8.74696°, γ_kp(0) = −8.00000°  →  κ_measured = −0.14939 °/mm   (+36 %)
```

Two separate errors: the 15 % figure in 02 §7 is not the ±5 mm secant (that is 1.0 %; the 15 % is the
*one-sided* 0→+2 mm value, 14.5 %), and V2's ±10 % pass mark is unreachable by the model's own
arithmetic — 36 % high on the bump side, and on the droop side the one-sided secant is +0.06795
(wrong sign, because the curve is strongly asymmetric: κ at +5 is −0.189 and at −5 is −0.024).

**Correct.** Either V2 measures a central difference over ±5 mm (κ = −0.10867, matching within 1 %),
or the pass mark becomes ±40 % one-sided, or the app reports the secant the station measures. State
which of the two numbers the app displays and make V2 measure that one. Recommendation: V2 uses
±2.5 mm spacers and a central difference.

**Test.** Compute the V2 measurement *from the model* before writing the pass mark; assert
`κ_measured(procedure) / κ_reported == 1.00 ± 0.10`.

### M6 — The steering-axis plan point A is 4.5 mm from the real axis, inflating ρ by 42 %

**Where** `04` §2, §3.1, §5.1.

**Quote** "v1 uses a **vertical steering axis through A**"; A = "(259.9459, 78.9838) mm from module 2
§6.7" (the *ground* intersection); and §5.1:

> The consequence is that ρ varies by roughly `ρ·sin(KPI)·Δz ≈ 17 × 0.14 × 2 = 4.8 %` over ±2 mm of
> travel.

**Wrong.** Two things.
1. The arithmetic is not a percentage: `17 × 0.14 × 2 = 4.76`, which is 4.76/17 = **28 %** of ρ, and
   it is not the right formula either — the variation of ρ with height is `Δρ = sin(KPI)·Δz`
   (**0.28 mm over 2 mm = 1.6 %**), with no factor of ρ.
2. The *bias*, which §5.1 does not discuss, is larger than the variation. A is the axis's **ground**
point; the tie-rod outer ball is at z = 32 mm, where the real axis is at
`(255.62, 74.49)` (interpolating Lₒ→Uₒ). The plan radius about that point is
`ρ = |(243.68, 74.04) − (255.62, 74.49)| = 11.95 mm`, not 17.00 mm. Using the ground point overstates
ρ by **42 %**, and every steer angle, the Ackermann percentage and the bump-steer coefficient scale
roughly linearly with 1/ρ.

**Correct.** Place the vertical equivalent axis at the knuckle's working height (`A(z) = Lₒ +
(z − Lₒ.z)/(Uₒ.z − Lₒ.z)·(Uₒ − Lₒ)` projected at the tie-rod height), giving ρ = 11.95 mm, or state
explicitly that A is at the ground and add the ±42 % to §5's error budget. Either way §5.1's "4.8 %"
number is wrong and must be replaced.

**Test.** G04.1's δ values change from −7.603/−8.563 to approximately −10.8/−12.2 under the corrected
ρ; a test asserting ρ == 11.95 mm from the module-1 hardpoints would pin the construction.

### M7 — G04.7 asserts a degenerate case that is unreachable for this geometry

**Where** `04` §7 G04.7; §4.

**Quote** "| G04.7 | rack +40 mm (beyond reach) | `Undefined(noIntersection)` | spec §4 |"

**Wrong.** The circles intersect whenever `|r_p − ρ| < D < r_p + ρ`. Here `r_p = 51.5455`,
`ρ = 17.0`, so `|r_p − ρ| = 34.5455 mm`, while `|A − Tᵢ'|` has a **lower bound of 34.9459 mm** (the
x-offset alone, since `A.x − Tᵢ.x = 34.9459` and the rack only moves y). The circles therefore
intersect at *every* rack position, for all s: at s = 40, D = 37.28; at s = 60, D = 35.64. A correct
implementation returns a (nonsense) steer angle at rack +40 mm — **δ = +223°**, with the knuckle
solved to y = 93.7 mm, i.e. 7.7 mm outboard of the wheel centre — and G04.7 fails. At rack +20 mm it
already returns +294°. The failure mode in §4 — "rack travel
exceeds the linkage's reach" — cannot occur on the reference car at all, and nothing else stops the
model from reporting a knuckle position the servo could never produce.

**Correct.** Drop G04.7 or replace it with a case where it can fire (a car with `A.x − Tᵢ.x <
|r_p − ρ|`), and add the missing guard the spec actually needs: a rack-travel limit derived from the
real mechanism (the pinion's travel), not from circle geometry. Without it the app will happily report
60° of steer at a rack position no servo can reach.

**Test.** Assert that for the reference car `noIntersection` is unreachable over `s ∈ [−60, 60]`; and
that `outOfRackTravel` fires at the modelled limit.

### M8 — G02.8 asserts a reason the algorithm cannot return deterministically

**Where** `02` §7 G02.8, §3.2, §4.

**Quote** "| G02.8 | reference LF, bump = +50 mm | `Undefined(outOfTravel)` | spec §3.2 |"

**Wrong.** `02` §3.2's solver bisects on θ over `[θ₀ − 0.4, θ₀ + 0.4]` and expands "until it contains
a sign change". At θ₀ + 0.4 rad, `W.z = 51.74` (bump +19.7 mm); the linkage's actual reach is
**+40 mm** (at which point `W.y` has swung from 86 to 58 mm — a posture no car can adopt). Beyond
+40 mm the circle intersection for Uₒ fails (`h² < 0`), which §4 maps to `noIntersection`, *not*
`outOfTravel`. So whether +50 mm returns `outOfTravel` or `noIntersection` depends on whether the
implementation checks reachability before or inside the h² test — and neither is specified. There is
no defined "travel range" anywhere in the module, only a numerical reach.

**Correct.** Define the modelled travel range explicitly (`02` §2 already lists it: −6…+6 mm TC,
−30…+30 mm buggy) and validate the requested bump against **that** before solving:

```
if |bump| > travelLimit: Undefined(outOfTravel)
```
Then G02.8 is deterministic and the app cannot report a camber curve at a hardpoint position that
implies the wheel has moved 28 mm inboard.

**Test.** `bump = +50 → outOfTravel`; `bump = +7 → outOfTravel` (TC limit); `bump = +40` must **not**
return a value — today it does.

### M9 — `01` §6.1's toe mirroring rule is wrong for a toe-in-positive convention

**Where** `01` §5, §6.1, G01.1.

**Quote** "| toe τ | −τ |" and "`"mirror_of": "LF"` generates the right-hand corner by negating **y
only**, and negating the signs of `camber` and `toe` (they are left/right-asymmetric scalars)".

**Wrong.** Camber is genuinely antisymmetric under mirroring with the "top outboard" convention
(outboard flips sides), so −γ is right. Toe is **symmetric**: 0.5° of toe-in on the left wheel mirrors
to 0.5° of toe-in on the right wheel, because "toward the centreline" is itself mirrored. Negating τ
makes the mirror of a +0.5° toe-in car a −0.5° toe-out car, i.e. 1.0° of total toe error on a car the
user believes is symmetric — and it does so silently, in the one code path every right-hand corner
takes. 01 §6.1 leaves `scrub radius` "unchanged … sign convention already per-wheel" for exactly this
reason, and toe is the same kind of quantity.

**Correct.** `toe: unchanged` under mirroring. (Neither G01.1 nor any other golden case tests it:
G01.1 asserts only the camber sign change, so G01.1 passes with the wrong rule.)

**Test.** Mirror a corner with `toe = +0.5` and assert the RF's toe is `+0.5`; assert total toe is
`2 × 0.5`. Add it to G01.1.

### M10 — No rear corner exists, so the rear roll centre, rear IR and half of modules 5–6 are invented

**Where** `01` §5/§8 (schema has only `LF` + `mirror_of`), `05` §6.5 (`IR_r = 0.7071`),
`06` §6.3 (`z_rc,r = 6.000 mm`).

**Quote** 06 §6.3: "`z_rc,r = 6.000 mm` (assumed for this example from a similar rear geometry — the
app computes it the same way as the front)".

**Wrong.** The reference car in module 1 has no rear hardpoints at all, yet:
- `05` needs a rear IR (0.7071 = 1/√2 exactly, chosen so `IR² = 0.5` and the arithmetic is round);
- `05` needs `k_bar,r = 0.2870 N/mm` ("same geometry", i.e. a 1.20 mm bar);
- `05` needs a rear k_w of 1.3000 N/mm;
- `06` needs `z_rc,r` and `t_r`;
- `06`'s balance number is 56 % and its entire meaningful output is the *front/rear split*.

Every rear number in the two modules that produce the app's headline output is a free parameter. `05`
§7 states "every value is a hand calculation in §6" and 00 §10 requires "No step relies on a number
that appears nowhere else" — both fail here.

**Correct.** Publish rear hardpoints for the reference car (mirroring the front's schema) and derive
`IR_r`, `k_w,r`, `z_rc,r`; or mark the rear values `assumed` with a source and stop quoting the
balance number as a computed result in the golden tests.

**Test.** A spec-audit check that every symbol in every worked example resolves to a hardpoint in
module 1's reference table. It would flag 0.7071, 6.000, 0.2870 and 1.3000 immediately.

### M11 — G04.3's arm-offset table cannot be reproduced from the stated construction

**Where** `04` §6.3 table, G04.3.

**Quote**
> | −10° (arm rotated rearward) | −6.847° | −7.152° | 53.6 % |
> Ten degrees of arm rotation moves Ackermann by roughly 5–7 percentage points per degree

**Wrong.** §6.3 never says what "the steering arm rotated −10°" means operationally: rotate Tₒ about A
(yes, that keeps ρ = 17), but then the tie rod no longer reaches Tᵢ unless `r_p` (or L) is re-derived —
and the doc does not say which. I tried the plausible readings at rack +2 mm and none reproduces
(−6.847, −7.152):

| definition | δ_L | δ_R | Ackermann |
|---|---|---|---|
| r_p held at 51.5455, branch nearest rotated Tₒ | −17.603 | −1.437 | 5484 % |
| r_p re-derived as \|Tₒ′ − Tᵢ\|, branch nearest rotated Tₒ | −8.854 | +11.360 | 215 % |
| r_p re-derived, branch nearest original Tₒ | −7.355 | (mirror) | — |

The closest single value is 0.2° off. Separately, the prose contradicts its own table: 127 → 53.6 over
10° is 7.3 pp/deg, and 127 → 160.7 is 3.4 pp/deg, so "5–7 percentage points per degree" is wrong for
half the table.

**Correct.** Specify the construction (which end moves, what happens to the tie-rod length, which
branch is selected) and regenerate the table from it; or delete the table and G04.3 (see Deletions).

**Test.** G04.3 must be runnable from a written procedure; as it stands the only way to make it pass is
to hard-code the expected numbers, which is exactly what 00 §8 forbids ("No expected value is 'what
the code produced'").

### M12 — `05`'s IR-vs-travel claim about damping ratio is wrong by a factor of two either way

**Where** `05` §3.1.

**Quote** "That is ±1.3 %, which is a ±2.6 % change in wheel rate and damping ratio".

**Wrong.** Wheel rate ∝ IR² ✓ (±2.6 %). Damping ratio does not: with `c_wheel = c·IR²` and
`c_crit = 2√(k_w m) = 2√(k_s m)·IR`, ζ ∝ `IR²/IR = IR` — §3.4 of module 7 states exactly this
("ζ ∝ IR (exactly)"). So the change is **±1.3 %**, not ±2.6 %, unless ζ is defined in the shaft
domain, in which case it is 0 %. There is no convention in which it is 2.6 %.

**Correct.** "±1.3 % in wheel rate and ±1.3 % in damping ratio (ζ ∝ IR); ±2.6 % only for wheel rate."

**Test.** Assert `ζ(IR×1.01)/ζ(IR) == 1.01` — module 7 §6.4's worked example already does the analogous
case correctly (IR −11.5 % → ζ −11.5 %, k_w −21.7 %), so the two modules disagree in prose only.

### M13 — Module 7's ±30 % confidence is contradicted by its own unmodelled-term estimate

**Where** `07` §3.7, §4.2; `99` §2 V12, §5.3.

**Quote** §3.7: "| 'Is my car over- or under-damped at handling speeds?' | yes, as a ratio | medium
(±30 % on the force) |"; §4.2: "Shaft-seal friction and pivot stiction on a 1/10 car can be 0.5–2 N —
comparable to the damper force at 20 mm/s."

**Wrong.** At 20 mm/s the modelled force is **0.2113 N**; the unmodelled friction is 0.5–2 N, i.e.
**2.4× to 9.5× the modelled force**. A ±30 % band is not an honest statement about a quantity that is
dominated by a term the model omits, and the same is true at 5 mm/s (0.013 N modelled). The band is
defensible at 50–100 mm/s (1.3–5.2 N) and nowhere below.

**Correct.** Make the confidence speed-dependent: "±40 % above 50 mm/s shaft speed; not a force
estimate below 20 mm/s (friction-dominated)". This matters because 07 §3.1 designates 5–20 mm/s
"roll and pitch build-up, platform control" — the range where the model has nothing to say — and 99
§5.3's ±30 % band inherits the same error.

**Test.** Assert the reported confidence band is a function of v, and that `F_model(20 mm/s)` is
flagged `belowFrictionFloor`.

### M14 — `02` §9's sensitivity table is wrong in sign and by a factor of 11, and 99 §2.1's pass mark
is built on it

**Where** `02` §9; `99` §2.1 (V3), §3.1.

**Quote** "| Lₒ.z +0.1 mm | +0.0165 mm | 6 % of the perturbation |" … "So roll-centre height is *not*
hypersensitive on this geometry (0.16 mm per mm of error)".

**Wrong.** Moving the lower ball joint up by 0.1 mm flattens the lower link's slope from −0.104167 to
−0.102083, moving the IC from (−435.691, 60.509) to (−449.63, 60.96) and the roll-centre height from
**9.9749 to 9.7876 mm**: `Δz_rc = −0.1869 mm` (and it is *negative*). Per mm of error that is
**−1.87 mm**, not +0.16 mm — 11× larger and the opposite sign. Scaling: +0.2 mm → −0.3749 mm,
+0.5 mm → −0.9463 mm.

This is not cosmetic: 99 §2.1 uses the figure to justify V3's pass mark ("0.16 mm of RC per mm of
hardpoint error … gives a floor of about ±1 mm; ±2 mm allows for the rig") and §3.1 claims "a 0.2 mm
bias … moves the roll centre by 0.03 mm and κ by 4 %". The correct figures are 0.37 mm and 5.2 %
(κ moves 2.6 % per 0.1 mm, not 2 %). With 0.2–0.5 mm of realistic caliper uncertainty the floor is
0.4–0.9 mm, so V3's ±2 mm still holds — but by luck, not by the stated argument.

**Correct.** `Δz_rc = −1.87 mm per mm of Lₒ.z`; `κ = 2.6 % per 0.1 mm`. 02 §5.1's "one decimal, never
two" for the UI becomes *more* justified, not less.

**Test.** A property test that perturbs each hardpoint by ±0.1 mm and asserts the printed
sensitivity table to 3 s.f. — it would have failed on the current table.

---

## MINOR

### m1 — `00` §4's `Undefined` reason enum has no `degenerateGeometry`, but four modules use it

`00` §4 lists `parallelLinks, noIntersection, coincidentPoints, outOfTravel, incompleteModel,
outOfDomain`; `01` §6.1 says it returns "`incompleteModel` or `degenerateGeometry`", `01` §7 uses
`degenerateGeometry` for five conditions, `04` §4 for `ρ < 1 mm`, `05` §5 for `damper_lo == damper_up`,
and G01.6 asserts "`degenerateGeometry`, reason `coincidentPoints`". The enum needs the variant or the
modules need to use `coincidentPoints`/`outOfDomain`. Fix the enum; add a spec-audit test that every
reason string in every module is a member of 00 §4's table.

### m2 — `01` §6.3's coincidence tolerance (1 µm) contradicts `00` §4's `kCoincidentTol = 1e-9 m`

`00` §4 rule 3 fixes `kCoincidentTol = 1e-9 m`; `01` §6.3 and §7 require points to "differ by > 1 µm"
(1e-6 m), a factor of 1000 apart. The golden case G01.6 (identical points) passes either way, so
neither test pins it. State one constant and reference it.

### m3 — `01` §6.5's track consistency check assumes the contact patch is under the wheel centre

"warn if the declared track differs from `2·|wc.y|` by more than 1 mm, because it means the contact
patch is not under the wheel centre" — but for a cambered wheel the contact patch is *never* under the
wheel centre: at γ = −2°, `r·sin γ = 32 × 0.0349 = 1.12 mm`, already over the threshold. `02` §3.5
admits this ("the wheel's own camber is ignored when locating it"). Either compute
`y_cp = wc.y − r·sin(γ)` for the check or set the tolerance to accommodate the modelled camber.

### m4 — `02` §5.1's projection-error estimate is 10× too large

"A link raked 10° in plan has a 1.5 % shorter transverse projection; with the reference car's
far-away IC that is a ~15 % change in IC distance and a ~1 % change in roll-centre height." Scaling
both links' y-extents by cos 10° = 0.985 moves the IC from (−435.69, 60.51) to (−428.8, 60.52) — a
**1.3 %** change in IC distance — and z_rc from 9.975 to 10.11, a **1.4 %** change. Both are ~1.5 %,
not 15 % and 1 %. The conclusion ("do not show RC to 0.1 mm") survives on other grounds, but the
number that justifies it does not.

### m5 — `05` (5.8)'s blade-bar formula divides by n where parallel blades should multiply

"`k_blade = 3·E·I/L³ · (1/n)` n blades in parallel, cantilever". n identical cantilevers in parallel
share the load, so each sees F/n and the total stiffness is `n · 3EI/L³`. The `1/n` is what you would
write for n blades in *series*. v1 does not ship this formula (§3.2: "v1 does not derive the setting →
stiffness curve"), so the damage is contained, but it must not be implemented as written.

### m6 — `02` §7 and 02 §9 give three different precisions for the same two numbers

§5.1: "the UI should not present roll-centre height to 0.1 mm precision — one decimal, never two";
§9: "Publish κ to 3 decimals, roll centre to 2"; `99` §7: roll-centre height **0.1 mm**, camber gain
**0.01 °/mm**. Three policies. Pick 99 §7's (it is the one derived from the sensitivity analysis) and
make 02 reference it.

### m7 — `02` (2.3) names a length `h` in a document where `h` is CG height

`h = √(b² − aa²)` is the circle-intersection half-chord; `00` §3 defines `h` as CG height and `06`
uses it as such throughout. In an implementation, a reviewer reading `h` in the 02 solver will look for
the wrong thing. Rename to `hh` or `hc`.

### m8 — `04` (4.10)–(4.12) has an unstated consistency requirement at bump = 0

`r_p(0) = √(L² − (z_Tₒ − z_Tᵢ)²)` must equal `|Tₒ − Tᵢ|_plan`, otherwise the solved Tₒ′(0) differs from
the measured Tₒ and `τ(0) ≠ 0` — the app reports bump steer at the ride height the user just zeroed.
For the reference car it holds (both 51.5455), because L was fitted to it. For the §6.4 z_Tᵢ sensitivity
table it does not: at z_Tᵢ = 26 the solved Tₒ′(0) is 1.35° away from the static point, and the table's
"toe at +2" column only reproduces if τ is re-zeroed at bump 0. State the re-zeroing rule explicitly
(or derive L from the static geometry, which is the clean fix).

### m9 — `07` §2.1 says the sprung corner mass comes from module 1; no module provides it

"| sprung corner mass | m_s | kg | 0.20 – 0.45 | module 1 |" — module 1 stores `mass_total` and
`mass_unsprung` only; the sprung corner mass is derived in `06` (6.1) from corner weights. Point at
06, and note the dependency order problem: 07 is built after 05, which needs it too (see B2).

### m10 — `06` §3.7's residual explanation omits the dominant term

"the reasons … the two axles have different tracks … the unsprung masses sit at a different height …
the geometric term is distributed by *sprung* force fraction". The arithmetic shows the residual is
−1.23 %, and the dominant contributor is the last one: (6.8) weights by sprung force fraction while
the total is `m·a·h/t̄` with `h` the *whole-car* CG. Turning the dial on that single term reproduces
almost the entire residual. Worth saying, because a user who changes the front weight split will see
the residual move and needs to know why.

### m11 — `09` §4's acceleration figure uses a torque that is inconsistent with the speed it is quoted at

"A 1.5 g acceleration at 57 km/h top speed is in the right box" — the 0.150 N·m is applied at
20 000 rpm, where 1.5 g cannot also hold (that is 314 W at the shaft, and 19.7 N of thrust at 16 m/s).
The two numbers are quoted as if simultaneous. They are both individually plausible; say "0.150 N·m at
low speed gives 1.5 g; the same motor at 20 000 rpm gives 57 km/h" and the feasibility argument is
stronger, not weaker.

### m12 — `06` §2's `g = 9.81` is labelled `assumed` and then contradicted in the same cell

"gravitational acceleration | g | m/s² | 9.81 | physical constant, `assumed` (Hong Kong latitude:
9.788; the 0.2 % difference is below every other uncertainty here)". If it is a physical constant at a
known latitude, use 9.788 for a Hong Kong app (or 9.81 and document the 0.2 %), and do not label it
`assumed` — 00 §5 defines `assumed` as "a modelling assumption, not a measurement", which this is not.
Also: every load in module 6 scales with g, so the label matters more than the number.

---

## NIT

- **N1** `06` §6.3 computes `M_el = 0.23459` and G06.3 asserts `0.23458`. Both pass a 1e-4 tolerance;
  pick one.
- **N2** `02` §6.1's sanity check says "the upper link is shorter than the lower but the lines still
  converge **outboard**". They converge **inboard**: m₁ = −0.104, m₂ = −0.032, so going outboard they
  diverge and the IC lands at y = −435.7, on the far side of the car.
- **N3** `07` §6.2's arithmetic prints `√(144 + 4 × 528.20 × 4.00) = √(144 + 8447.4)`; the product is
  8449.6. The result (0.09913) is within the case's 1e-4 tolerance of the correct 0.09911.
- **N4** `05` §3.2: "This matters for roll stiffness and is the reason (5.9) has a 2 in it" — the 2 in
  (5.9) is `k_w/2`; the bar's doubling is already folded into `k_bar·t²`. Reword.
- **N5** `00` §9 promises "the four-bar solve … is 40 bisection iterations"; `02` §3.2 says "40 gives
  1 × 10⁻¹² rad" over a bracket of 0.8 rad (which is 7 × 10⁻¹³ — correct) but then says "60 iterations
  is overkill". Harmless, but three numbers where one would do.
- **N6** `01` §4.1 calls the touring-car corner "a five-constraint linkage" without enumerating the
  five; the paragraph then lists four items (hinge, ball, camber link, tie rod).
- **N7** `02` §2's input table gives `W | mm (y, z) | 80–90` for a TC and 100–115 for a buggy, but
  `t/2 | 86` is listed as a separate input "derived from W.y" — one row should be derived, not input.
- **N8** `04` §6.4's caption "Cleanest form of the same data, which is what the golden test asserts"
  is followed by a table with the same five rows as the previous one, minus `r_p` and `ψ`. Delete the
  duplicate.

---

## Deletions

**(a) The three things I would delete from the spec**

1. **Module 3's computation** (keep one paragraph of §4, delete §3, §5, §7, §8). It is required to be
   hidden on the reference car, it is never used in advice, its worked example is built on hardpoints
   that do not exist (B3), and it is the only module whose §5 assumptions licence ignoring the result.
   A spec that spends 11 KB deriving a number it then instructs the app to suppress is 11 KB of
   maintenance with no user-visible output. Replace with: "anti-dive is not computed because the
   classical estimator needs a side-view construction that a transverse hinge arm does not have, and
   at l/h ≈ 9 it returns 300–400 % for realistic geometry."
2. **The RC3-comparison tables** (`00` §6, `03` §4.4, `06` §1.1, `07` §3.5's "RC3's author found…",
   `08` §4.3). Every row is an unverifiable claim about a program nobody in this repo has run
   ("not evidenced in the corpus", "on the forum record"), in a document whose own checklist says "No
   RC3 text, no invented citations" and whose §6 of 99 says "Validated against RC3" is a claim we will
   never make. They contribute nothing an implementer can use and they are the only place in the spec
   where a number has no arithmetic behind it.
3. **The hand-written sensitivity and propagation tables** (`02` §9, `05` §8, `99` §2.1, `99` §3.1's
   figures). One of them is wrong by 11× and backwards (M14), one is 10× too large (m4), and 99's pass
   marks are derived from them. Replace with a scripted perturbation harness in `tool/` that re-runs
   the golden cases at ±0.1/±0.5 mm on every hardpoint and emits the table, and quote the emitted
   numbers. The spec's whole claim is that numbers are reproducible; a hand-maintained derivative
   table contradicts that claim the first time a hardpoint moves.

**(b) Numbers I could not verify, and why**

| Number | Why not |
|---|---|
| `04` §6.3 arm-offset table (−6.847, −7.152, 53.6 %; +10° row) | The construction is not defined (does Tₒ move about A? is the tie-rod length re-derived? which branch?), and none of the plausible readings reproduces the values (M11). |
| `03` §5.2's 316.1 % | Reproducible *from the printed coordinates* (I get 316.06 %), but those coordinates are not the reference car's, so the number has no referent. Not verifiable as a claim about the car. |
| `02` §5.1's "~15 % change in IC distance" for a 10° plan rake | I computed the perturbed geometry directly and got 1.3 %, so this is not a "couldn't verify" — it is a failed verification (m4). Listed here because the doc's stated derivation ("0.4 % shorter projection… moves the instant centre by a few percent when it is far away") is a hand-wave I cannot reconstruct even to get the doc's own answer. |
| `06` §4.5's "A 3 mm CG height error is a 10 % error in the total transfer" | Arithmetically 3/28 = 10.7 % ✓ if the *CG height alone* moves; but h_s is derived from h and h_u, so a CG measurement error moves h_s by m/m_s = 1.22× as much. Which of the two the 10 % refers to changes the sensitivity by 22 %. |
| `99` §2 V3's "roll-centre test from the corpus's MTC2 series" | No such test is described in the repo (`docs/research/` not in scope here, but no protocol, no fixture, no pass criterion). Cannot be verified as written. |
| `07` §3.5's "he needed roughly +150 cSt on a 700 cSt oil … i.e. ~20 %" | A third-party video claim; unverifiable from the repo and, per 00 §10's checklist, should not be in a spec. |
| `05` §3.5 and `07` §3.7's ranges (ride frequency 8–12 Hz, wheel rate 1.0–1.6 N/mm, IR 0.5–0.7, ±30 % on force) | No source and no derivation; they are priors, not results. The revised masses move the reference car from 9.56 Hz to 10.78 Hz, still inside the band — which is the only evidence the band is right. |
| `03` (3.4)/(3.5)'s `K_bf` scaling | The formula matches Gillespie's structure, but the doc's own §4.3 says electric touring cars have no hydraulic brakes, so `K_bf = 0.55` has no referent for the reference car. Cannot be checked against anything. |
