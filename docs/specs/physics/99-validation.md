# 99 — Validation: what must be true before a number is called right

This file is the gate between "the app computes something" and "the app claims something". It is
written to be used: each row is a test someone can run, with a pass mark, and each pass mark is
derived from the model's own sensitivity rather than picked to be comfortable.

---

## 1. The claim ladder

A number in Setup Lab is at one of four levels. The UI must show which.

| Level | Meaning | Evidence required | UI treatment |
|---|---|---|---|
| **L0 — arithmetic** | the equation is implemented as written | a golden test whose expected value is a hand calculation in `docs/specs/physics/` | shown plainly |
| **L1 — identity** | the implementation satisfies known limiting cases | analytic cases (parallel arms, symmetric car, mirror, zero travel, 100 % Ackermann, mass budget) | shown plainly |
| **L2 — bench** | the model matches a measurement on a real car, within a stated tolerance | the protocol in §3 | shown plainly, with the tolerance in the tooltip |
| **L3 — correlated** | the number predicts an outcome (lap time, driver report) within a stated tolerance | on-track or dyno correlation | shown with an explicit confidence statement |

**Every number in modules 2–10 is L0 + L1 today.** Not one is L2. The app must not present any of them
as validated, and the "about this number" sheet says "computed from your geometry; not yet checked
against a measurement on a real car" until the corresponding row below is signed off. That is the
`computed, not yet validated` state D-11 ships with, and §8 makes the *state* — not the bench run — the
release condition: a property is promoted to `validated` one test at a time, and no test gates the
release.

That sentence is unpleasant to ship. It is also the only honest position, and `docs/intent.md` is
explicit that a teaching tool which is confidently wrong is worse than no tool.

---

## 2. Validation matrix

Priorities: **P1** blocks a *claim* (the property cannot be promoted to `validated` and its caveat is
mandatory), **P2** blocks a narrower claim, **P3** is a nice-to-have. **No priority blocks a release** —
see §8 and D-11: a property ships as `computed, not yet validated` until its own test passes.

| # | Module | Claim | Method | Pass mark | Pri |
|---|---|---|---|---|---|
| V1 | 1 | hardpoints convert and mirror correctly | build a model from a caliper session, check the derived wheelbase/track against a tape | ±0.5 mm | P1 |
| V2 | 2 | camber gain per mm | setup station, camber at ride height, then with **±2.5 mm** spacers and a **central difference** (§3.3) | ±15 % of κ **on the central difference**, and the sign correct | P1 |
| V3 | 2 | static roll centre height | a lateral-force rig (§3.7), or a kinematic check against the four-scale asymmetry in V10 | ±2 mm; report as a band, never a decimal | P2 |
| V4 | 2 | roll-centre migration | the same rig at two roll angles | ±3 mm lateral | P3 |
| V5 | 2 | scrub radius, KPI, caster, trail | setup station for caster/KPI; scrub from the kingpin intersection on a plumb line | ±0.3°, ±1 mm | P2 |
| V6 | 4 | Ackermann | turn to a measured steer angle on one side, read the other | ±5 percentage points | P2 |
| V7 | 4 | bump steer | toe at −5, 0, +5 mm with spacers; three repeats, settled | ±0.10 °/mm **and** the zero-bump-steer height within ±1 mm | P1 |
| V8 | 5 | installation ratio / wheel rate | load the corner with weights, measure deflection, fit k_w | ±8 % on k_w | P1 |
| V9 | 5 | ARB rate | bench-test the bar alone: hold one arm, load the other | ±25 % — see §2.1; ±15 % is inside the model's own error | P2 |
| V10 | 6 | static corner weights | four scales | ±3 g per corner, and the diagonal split vs the model's ±5 g | P1 |
| V11 | 6 | load-transfer split | **not directly measurable.** Compare against a tilt-rig four-scale measurement if one exists | n/a | P3 |
| V12 | 7 | damper force curve | shock dyno at 20 °C, or a drop test with an accelerometer (measures ζ, not force) | inside the **computed band** at that shaft speed (07 §6.6) and the direction correct at every speed — no fixed percentage | P2 |
| V13 | 7 | temperature sensitivity | dyno at 20 °C and 40 °C | direction correct, magnitude within 2× **above blow-off** | P3 |
| V14 | 9 | rollout and speed | one straight-line run with a GPS logger | ±2 % | P3 |
| **V15** | **10** | chassis torsional stiffness | bench test: clamp one end, load the other through a known lever, measure angular deflection (§11) | ±20 % on k_ch, and the balance consequence stated (±0.41 pp) | P2 |
| **V16** | **1/6** | CG height (inferred) | two-hang plumb line (§3.8) | ±1.5 mm on `h`; the component estimate is checked against it | P2 |

### 2.1 Why these pass marks — re-derived

They come from the model's sensitivity to its own input uncertainty, not from comfort. **Three of the
round-1 numbers were derived from a sensitivity that was wrong by 11×**, so this section is rewritten
rather than adjusted.

- **V2, ±15 % on κ, central difference.** κ changes −2.60 % per 0.1 mm on `Lₒ.z` and −4.42 % per 0.1 mm
  on `Uᵢ.z` (module 2 §9). Propagating a **uniform ±0.2 mm** session through the six coordinates by RSS
  gives **±13 %** on the reported κ (the ±0.2 mm terms are 0.54 / 5.20 / 0.26 / 8.26 / 0.28 / 8.84 %,
  RSS 13.2 %) — so the ±10 % mark round 2 carried was **inside the geometry noise the test exists to
  bound**, and a correct implementation could fail it on a bad afternoon. ±15 % sits outside that
  noise. A session that follows §3.2's instruction to re-measure the three Jacobian-dominant points to
  ±0.1 mm has ±6.7 % noise and will normally land inside ±10 %; the mark stays at 15 % because the
  protocol cannot force the better session. The *measurement* is still the binding constraint on the
  method: it must be a central difference, because the one-sided 0→+5 mm secant is −0.1494 °/mm
  against the reported −0.1098 — **+36 %**, outside the pass mark before any gauge error. Central
  ±2.5 mm gives −0.10955 (−0.2 %), central ±5 mm gives −0.10867 (−1.0 %). Round 1's V2 used a
  one-sided 5.00 mm spacer and a ±10 % mark, which the model fails by construction.
- **V3, ±2 mm on roll-centre height.** The vertical sensitivity is **−1.87 mm per mm of `Lₒ.z` error**
  (02 §9), so a realistic 0.2–0.5 mm hardpoint uncertainty puts a floor of **0.37–0.93 mm** under the
  number (0.5 mm × 1.869 mm/mm = 0.935), and the contact-patch approximation adds ~0.15 mm. ±1 mm is
  the honest expectation; ±2 mm allows for the rig. Round 1 justified the same ±2 mm with "0.16 mm of
  RC per mm of hardpoint error", which was wrong in both sign and magnitude — the pass mark was right,
  the argument was not.
- **V8, ±8 % on wheel rate.** Spring rates are sold to ±5 %, and IR enters squared; ±8 % is what the
  inputs support.
- **V9, ±25 % on ARB rate.** Module 5 §4.5 states the model's own error against a bench bar is 10–20 %
  (bends, bushings, effective span judged to ±5 mm on 90 = 5.5 %). Round 1's ±15 % was **inside** the
  model's error, so the test could not fail for the reason it exists.
- **V12, the computed band.** Above blow-off the level is set by `F_bo` and `c_post`, whose stored
  tolerances are ±50 % each, so the band at 200 mm/s is ±50 % of ζ (07 §6.6) and at 50 mm/s it is
  −40/+15 %. A fixed pass mark cannot express that: ±30 % would be narrower than the low side at
  50 mm/s and narrower than the band at 200. The test therefore compares the measured force against
  the model's band at the same shaft speed, and separately asserts the direction at every speed. Below
  20 mm/s stiction (0.5–2 N) exceeds the modelled force by 2.4–9.5× at 20 mm/s, so no comparison is
  meaningful there at
  all. Round 1's blanket ±30 % and its "drop test measures ζ" method also disagreed with each other:
  the drop test measures ζ, so the pass mark should be on ζ, not on force.
- **V15, ±20 % on k_ch.** From module 10 §4.2's table, k_ch = 21.60 ±20 % (25.92 / 17.28 N·m/rad) gives
  balance 52.98 % / 52.15 %, i.e. **−0.46 / +0.36 pp** about 52.61 % — **±0.41 pp** as a symmetric
  statement — below the **±1.5 pp** floor that a bar measurement alone puts under the balance number
  (§7). Round 2's ±0.26 pp came from the secant between two printed table rows, which linearises a
  concave response; the conclusion (below the floor) survives, the number did not. Tighter would be
  theatre; looser would let a wrong material model pass.

- **Balance, ±1.5 pp.** Measured, not assumed: bar diameter ±0.05 mm on 1.5 mm is ±14 % of the bar's
  contribution, which is ±7.8 % of `k_φ,f`, which is **±1.2 pp** of balance; ±1 mm of arm length is
  ±0.84 pp; ±5 mm of span is ±0.46 pp; ±5 % of spring rate is ±0.4 pp. These add in quadrature to about
  ±1.5 pp, and the number is displayed to 0.5 % with that band. If the chassis stiffness is not
  supplied, the band widens to ±3.5 pp (module 10 §4.2) and the UI must say so.

---

## 3. Measurement protocol

Minimum viable session: one car, one caliper, one setup station, one afternoon, and a notebook.

### 3.1 Before anything

1. Zero the caliper and record the zero error. **A 0.2 mm systematic bias moves the roll centre
   −0.37 mm and κ −5.2 %** (module 2 §9) — the numbers round 1 quoted here (0.03 mm and 4 %) came from
   the wrong sensitivity table, and they understated the roll-centre effect by 12×.
2. Record tyre radius and ride height **at the same moment** as the hardpoints. Ride height changes
   move every chassis-side point in z.
3. Photograph each corner with a ruler in frame. Months later the photograph is the only way to resolve
   "did I measure to the ball or to the stud?".

### 3.2 Hardpoints (V1)

For each corner: the two lower-arm pivot screw centres, the lower ball joint centre, both camber-link
ball studs, the rack end and the steering-arm ball, and the wheel centre height. Measure each point
twice from two directions and record both; the discrepancy is that point's uncertainty, usually
0.2–0.5 mm, and it is entered as the `confidence` on the hardpoint.

Practical note that costs an afternoon if missed: the ball joint centre is inside the ball, not at the
top of the stud. Measure to the stud's shoulder and subtract the stud length, or use a setup-station
pin of known length seated in the ball.

**This protocol and a 30-minute success criterion cannot both be true** (round 1's P-10): 11 unique
points × 3 coordinates × 2 directions is 66 readings. v1 therefore measures all points **once from the
best direction** and re-measures only the three that the module-2 Jacobian says matter most
(`Lₒ.z`, `Uᵢ.z`, `Uₒ.z`), which is where 80 % of the roll-centre and camber-gain sensitivity lives.

### 3.3 Camber gain (V2) — corrected procedure

1. Setup station on, car at ride height, record camber at the corner.
2. Fit a **2.50 mm** machined spacer under the wheel; re-read camber. Tap and settle the corner first
   (three readings, take the mean; the spread is the honest uncertainty).
3. Fit a **−2.50 mm** equivalent (lift the corner by 2.5 mm using the droop screw or a second block);
   re-read.
4. `κ_measured = [γ(+2.5) − γ(−2.5)]/5.00`.
5. Compare with the model's `κ` at the same corner **with the same signs**.

Why not ±5 mm: the camber curve is strongly asymmetric (γ_kp is −8.747 at +5 mm and −7.660 at −5 mm), so
a one-sided 5 mm measurement is +36 % high on the bump side and −38 % low on the droop side. Round 1's
protocol was one-sided and its ±10 % mark unreachable.

### 3.4 Bump steer (V7)

Same spacers, toe instead of camber, at −5, 0, +5 mm. The car must be rolled back and forth between
readings to settle the tyres. Fit the slope **and** record where it crosses zero, because the zero is
the failing mode (§5.1) and the slope alone cannot see it.

If the measured slope is less than 0.05 °/mm the noise may exceed the signal: repeat three times and
report the spread rather than a single number. On the reference car the model's coefficient is
−0.163 °/mm, so the ±0.10 °/mm pass mark is ±61 % — a magnitude test alone cannot distinguish the
model from a wrong one, which is why the zero-height clause is part of the pass.

### 3.5 Wheel rate (V8)

With the spring fitted and the damper disconnected (or at a speed where its force is negligible):

1. Support the chassis on stands under the opposite corner.
2. Zero the ride height with a dial gauge on the hub.
3. Add mass at the corner in ~1 kg steps (dumbbells are fine; ±1 % is what a gym weight gives and that
   is well inside ±8 % — "calibrated" implies a lab nobody has).
4. Record deflection per step; slope = k_w directly, bypassing IR and therefore testing the whole 2 → 5
   chain.

If the app and the bench disagree, compare `IR = √(k_w/k_s)` computed from the same data to find which
of the two is wrong.

### 3.6 Damper (V12)

A shock dyno is the benchmark. Failing that, a drop test: drop the car from a known height with an
accelerometer on the chassis, fit the decay envelope, get ζ at the relevant speed, compare with the
model's ζ at that speed. **The drop test measures ζ, not force** — so it validates the number the app
shows and cannot validate `K_h`. Say which one the result belongs to.

Compare only at **≥ 50 mm/s** equivalent shaft speed; below that the car is dominated by friction and
the comparison measures the bench, not the model.

### 3.7 Roll centre (V3) — what is actually available

The "apply lateral force and find the height where the chassis does not roll" rig is not buildable from
the kit §3 names. The two honest substitutes:

1. **Kinematic comparison against asymmetry (cheap, and uses only four scales).** Measure the four
   corner weights. A car whose diagonal split differs from the model's prediction by more than 5 g has
   a geometry error, and the model can be re-run to find which hardpoint. This does not validate the
   roll-centre *height* directly; it validates the geometry that produces it.
2. **The rig, if one exists** (a chassis on a pivot with a lateral pull and two dial gauges). Until
   then V3 stays P2 and roll-centre height stays L0 + L1 **permanently**, which the UI says.

### 3.8 CG height (V16) — the two-hang test

Procedure in module 1 §4.5 Route B: hang the car from a front point, plumb-line the side view, repeat
from a rear point, intersect. Pass mark ±1.5 mm against the component estimate, and record both numbers
so the estimator can be calibrated across cars. This is the cheapest real improvement to every load
number in the app and the only route by which `h` ever stops being inferred.

---

## 4. Identity checks (L1) — do these before any bench work

These need no car and catch most implementation errors. Cheap, and in CI from day one.

| # | Identity | Assertion |
|---|---|---|
| I1 | parallel, equal-length, horizontal arms | roll centre at ground level; `parallelLinks` flag; no NaN |
| I2 | symmetric car, φ = 0 | roll centre on the centreline (y_rc = 0) to 1e-9 |
| I3 | zero bump | every output equals its static value, to 1e-9 |
| **I4** | **camber gain under mirroring** | `κ` per wheel is the **same** on the left and the mirrored right (−0.109816 both); in the **global** frame `κ_R = −κ_L` (+0.109816). Assert both, with the side rule stated — round 1 asserted only the first, which passes against an implementation that has quietly taken an absolute value and fails against a literal reading of its own (2.12) |
| I5 | caster = 0, KPI = 0 | trail = 0 and scrub = 0 when the axis is vertical through the contact patch |
| I6 | 100 % anti-dive condition | `tan θ = h/l` with `K_bf = 1` gives exactly 100 % |
| **I7** | **Ackermann at 0 %** | a rack whose inner ends are infinitely far away (parallel tie rods) gives `δ_inner = δ_outer`. Round 1's version ("move the inner points to the knuckle pivots") does not follow and would make the tie rod zero length |
| I8 | IR at 90° damper angle | damper axis perpendicular to the arm's motion → IR = 0 → `noMotionRatio` |
| I9 | linearity of load transfer | doubling `m` doubles every ΔW; doubling `a_y` doubles every ΔW; **and balance is invariant to `a_y`** |
| **I10** | **sum of parts, corrected** | `\|ΔW_el + ΔW_geo + ΔW_u summed − m·a_y·h/t̄\| / (m·a_y·h/t̄) < 0.05`, reference value **−0.055 %** (was −1.223 % on the round-2 `x_cg`, D-1); plus the identity that *does* hold exactly: `ΔW_el,i = k_φ,i·φ/t_i` recomputed through the public API to 1e-9. Round 1 asserted 1e-9 on the first and it fails on the spec's own example |
| **I11** | **mass budget** | `Σ m_s,corner + m_u = m_total` to 1e-9 in every module's worked example. This single assertion catches round 1's B1 class of error, and nothing in the round-1 suite made it |
| **I12** | **carrier transform continuity** | `P(θ)` at `θ₀` returns `P₀` to 1e-12 for every carrier-attached point, and `dP/dθ` from the carrier rule equals the analytic rigid-body velocity to 1e-6 |
| **I13** | **mirror symmetry of stored per-wheel quantities (D-17)** | mirroring a corner with stored τ = +0.5° gives stored **+0.5°** and axle total **+1.000°** (not 0); stored camber −2.0° gives **−2.0°**, and the global-frame camber **+2.0°**; a symmetric car's stored camber and toe are identical left and right |
| **I14** | **damping monotonicity** | ζ strictly increasing in IR, strictly decreasing in hole area, strictly decreasing in `k_s`, non-decreasing in µ (module 7 §9, G07.10–G07.13) |

I9, I10, I11 and I14 are the ones that catch the "confident but wrong" class: a sign error in the
geometric term still produces a plausible balance, a transposed mass still produces a plausible
frequency, and a flipped viscosity term still produces a plausible curve.

---

## 5. The three equations we are least confident in

### 5.1 Bump steer (module 4, §3.4)

**Why.** The 2D plan-view model with a vertical steering axis captures only the component of bump steer
produced by the tie rod's front-view inclination. It cannot see the component from the wheel's lateral
scrub acting on an inclined axis. On the reference geometry those are 57 % and 43 % (§04 §6.5), so the
magnitude is a coincidence of two partial effects and **its zero is in the wrong place**: the model says
"zero bump steer when the tie rod is horizontal", the published criterion says "zero when the tie rod's
projection aims at the instant centre".

**What would settle it.** A bench measurement of the toe curve at three rack heights (V7). If the
measured zero lands near the model's, the missing term is small on this geometry and the model is usable
with a caveat. If it lands near the IC criterion, the model must be replaced by a 3D solve before the
number is displayed at all.

**Interim:** display the toe curve and the coefficient to one decimal place, with the caveat, never in a
comparison verdict, and never for a car whose rack geometry the user has not measured (round 1's C3:
the rack-end points need the bumper and rack cover off, which most users will not do).

### 5.2 Roll-centre migration (module 2, §3.5)

**Why.** Migration is computed in the chassis frame, with the contact patch at its static lateral
position and the wheel's own camber ignored. Each is a ~1 %-of-track approximation, but they compound
where the answer is most sensitive: the reference car migrates 18.6 mm laterally per degree of roll, and
that number is the difference between two long lines (the ICs are 526 mm away). A 1 % error in a 526 mm
lever is 5 mm of migration.

**What would settle it.** The rig at two roll angles (V4), or a ground-frame reformulation compared
against it. Reformulation is v2; the rig is the only external check.

**Interim:** migration as a line on a chart, two significant figures, height and lateral position
labelled separately — the height moves 0.4 mm/degree and the lateral position 18.6 mm/degree, and
averaging them into one "roll centre" number destroys the information.

### 5.3 Damper force magnitude (module 7, §3.3)

**Why.** `F_bo` and `c_post` are assumed, and the model has no friction term (0.5–2 N of stiction
against 1.3 N of force at 50 mm/s and 0.21 N at 20 mm/s). It also understates temperature sensitivity
below blow-off, because the low-speed flow in the model is inertial. The *shape* of the curve is
defensible; the *level* is not.

**What would settle it.** A dyno pull (V12) with the same piston, hole count and oil. Then `F_bo` and
`c_post` become fitted-once, stored-per-piston data and the badge changes.

**Interim — and this is now a product decision, not a caveat:** ship ζ as an estimate with a
**computed** band (07 §6.6: ζ re-run at each input's tolerance ends), an `estimated` badge naming the
assumed parameters, and the direction table of `07` §9 beside it. On the reference car the computed
band is −40/+15 % at 50 mm/s and ±50 % at 200–500 mm/s, dominated by `C_d` at the low speed and by
`F_bo`/`c_post` above blow-off; below 20 mm/s no band is shown because the friction term dominates the
modelled force by 38–150×. Round 1's blanket ±30 % across all speeds was not supportable by its own
stiction figures, and neither is any other fixed percentage — that is why the band is a computation
(`spec.md` §4.8) and why G07.15 asserts that doubling a tolerance widens it.

### 5.4 The fourth, for completeness: anti-dive (module 3)

Not so much unsure of the arithmetic as certain that the classical formula is the wrong instrument at
1/10 scale — and now also that it **does not exist** for the arm type the reference car has. The
mitigation is in the module: `diagnosticOnly`, `noSideViewConstruction` for hinge arms, hidden below a
10 mm projection, never used in advice. Listed so that nobody "fixes" it by tuning a coefficient.

---

## 6. What we will never claim

| Claim | Why not |
|---|---|
| "This setup will be faster" | needs a lap-time model and a driver; the intent document rules it out |
| "Grip is up" | needs a tyre model (module 8) |
| "This will understeer" | needs a tyre model; we say "moves load transfer to the front" |
| "Validated against RC3" | no RC3 binaries, no RC3 output, and comparing against them would be both an IP problem and a false authority |
| "Matches your shock dyno" | unless the user supplies the pull and we fit to it, and then we say "fitted to your data" |
| "Roll-centre height is 9.97 mm" | the honest form is "about 10 mm, ±1 mm" (§7) |
| "ζ is 0.26" | the honest form is "ζ 0.26, band 0.18–0.33, estimated" |
| "Material changes your roll centre" | it does not (module 10 §1.1) |
| Any number to more significant figures than its input uncertainty supports | §7 |

---

## 7. Precision policy

Two columns, because they are two different things: **display precision** is what the number is rounded
to; **honest uncertainty** is what the band says. A quantity may be displayed finely and still be
uncertain; what must never happen is displaying it *without* the band.

Derived from the module sensitivities, not chosen.

| Quantity | Display | Honest uncertainty | Derived from |
|---|---|---|---|
| Roll-centre height | **0.5 mm**, as a band (`≈10 mm ±1 mm`) | **±1 mm** | −1.87 mm per mm of `Lₒ.z` error; 0.2–0.5 mm session + 0.15 mm modelling (02 §9) |
| Roll-centre lateral position | 0.5 mm, band ±2 mm | ±2 mm | migration approximation, §5.2 |
| Camber gain κ | 0.01 °/mm | ±13 % (uniform ±0.2 mm session), ±7 % (protocol) | RSS over the six coordinates of module 2 §9; V2's pass mark is ±15 % for the same reason |
| Camber, caster, KPI | 0.1° | ±0.3° | setup-station resolution |
| Scrub radius, trail | 0.1 mm | ±1 mm | V5 pass mark |
| Bump-steer coefficient | 0.01 °/mm | ±60 %, and the zero within ±1 mm | §5.1 |
| Installation ratio | 0.01 | ±5 % | derivative of a measured geometry |
| Wheel rate | 0.01 N/mm | ±8 % | spring ±5 %, IR squared |
| Roll stiffness | 0.1 N·m/rad | ±10 % | bar d ±0.05 mm = ±14 % of the bar's share |
| Ride frequency | 0.1 Hz | ±5 % | inherits k_w and m_s |
| Load transfer (TLLT) | 0.01 N | **±35 %** | the two `h` routes disagree by 33 % on the reference car (28.0 assumed against 18.7 from components, 06 §6.7) |
| Per-wheel load | 0.01 N | ±15 % | inherits TLLT |
| Balance | **0.5 %** | **±1.5 pp** | bar diameter ±0.05 mm → **±1.2 pp**; arm ±1 mm → ±0.8 pp; span ±5 mm → ±0.5 pp; spring ±5 % → ±0.4 pp; CG height → ±0.13 pp; chassis stiffness (if unknown) → **±3.5 pp** (06 §6.7–6.8) |
| Damping ratio ζ | 0.01 | **the computed band** (07 §6.6): −40/+15 % at 50 mm/s, −50/+4 % at 99 mm/s, ±50 % at 200–500; **no band below 20 mm/s** | 07 §6.6 propagates the stored tolerances |
| Anti-dive / anti-squat | not displayed | — | §5.4 |
| Chassis torsional stiffness | 0.1 N·m/rad | ±20 % measured, ×1–3 estimated | V15, module 10 §3.2 |

**Three things this table changed from round 1**, each of which was an overstatement:

1. **Roll-centre height: 0.1 mm → 0.5 mm plus a band.** At −1.87 mm/mm, 0.1 mm claims 19× more precision
   than a 0.2 mm caliper session supports.
2. **Balance: 0.1 % → 0.5 %, with a ±1.5 pp band and the chassis term dominant.** Round 1 said "CG
   height uncertainty dominates below that": it does not (0.13 pp across the whole range). What swamps a
   0.2 % balance difference is the bar diameter (**±1.2 pp** for ±0.05 mm), the arm length (±0.8 pp per
   mm) and, if it is unknown, chassis torsion (±3.5 pp).
3. **Damping ratio: a blanket ±30 % → the computed band of 07 §6.6.** A fixed percentage cannot be
   right: the band is asymmetric and speed-dependent — −40/+15 % at 50 mm/s, where the model's own
   discharge coefficient sets the low side, and ±50 % at 200 mm/s, where the shim stack is not measured
   at all. Round 2's speed-dependent
   ±30/±50 was the right *idea* attached to the wrong speeds; `spec.md` §4.8's rule — compute it from
   the tolerances — is the only form that survives a change of inputs, and G07.15 asserts it.

---

## 8. Release gate

**A release ships on evidence, not on bench runs.** This section is governed by decision **D-11**
(2026-10-30): v1 ships with an honest validity state on every computed property, and bench validation
proceeds in parallel, promoting properties one at a time as their tests pass. No bench run is a
precondition of shipping, and the results log below starts empty on purpose.

A release may ship when:

1. Every golden test in modules 1–10 passes, and every ID in the specs has a matching test
   (`dart run tool/spec_audit.dart` is clean).
2. The identity checks I1–I14 pass, including the property test that no `NaN` or `Infinity` escapes a
   public API over 10 000 randomised geometries.
3. **Every shipped property carries its evidence state**, in the data and in the UI: `computed` (L0+L1
   only — the golden cases and identities pass), or `validated` (L2 — its V-test has been run and
   recorded in §9). A property with no evidence state does not ship, and a property may not ship as
   `validated` without a row in §9.
4. **Promotion is per property and one-way until contradicted.** A property becomes `validated` when
   *its own* V-test passes on at least one real car and the row is recorded in §9 with the date, the
   car, and the measured-vs-computed table. Before that it ships as `computed, not yet validated`.
   A failed row demotes the property and is never deleted from §9.
5. Every property that is not `validated` carries its caveat string **and its band** in the UI, and the
   band is the one in §7 (for ζ, the computed band of 07 §6.6).
6. Every displayed quantity has a row in §7. A quantity with no precision policy does not ship.

What this changes from round 2: the gate used to require V1, V2, V7, V8 and V10 to have been run on a
real car before any release, which — with §9 empty — meant v1 could not ship while D-11 said it must.
The V-tests, their pass marks and the empty results log all stay; what they now decide is **the state
of a property**, not the existence of the release. The P1/P2 priorities in §2 still order the work and
still block a *claim*, not a ship.

Nothing here requires a tyre model, a dyno, or a second car to start. V2, V7, V8, V10 and V15 are one
afternoon with a setup station, four scales, a set of spacers and a lever — and that afternoon now
upgrades five chips rather than gating a release.

---

## 9. Results log

Empty, deliberately — an empty log is the honest state of a property that ships `computed, not yet
validated` (§8), not a blocker. Fill it in as measurements happen; do not delete failed rows. A row
whose `Pass?` is yes **promotes** the property named in its `Test` column to `validated`; a no
**demotes** it. The row must name the property, not only the test id, because that is where the state
is stored.

| Date | Car | Test | Property | Measured | Computed | Δ | Pass? | Notes |
|---|---|---|---|---|---|---|---|---|
| | | | | | | | | |

---

## 10. Open questions for Dave

1. **When is a bench session planned?** The release question is settled — §8 and D-11 let v1 ship with
   every property at `computed, not yet validated` — but the schedule still needs to know whether the
   first V-test (V2 or V10, both one afternoon) lands in the first quarter, because that is what
   upgrades the chips.
2. **Which car?** The reference geometry here is synthetic-but-plausible. Validating means measuring a
   real chassis, and the second-best option (adopting a community model) only tells us we match someone
   else's numbers.
3. **Is a shock dyno accessible?** If not, V12/V13 are "not planned" rather than open gates, and ζ's
   `estimated` badge is permanent. That is now a supported position (07 §0), not a blocker.
4. **Which car does the chassis module's material list need?** Issue #11 asks whether steel is a real
   class in this world or a physics exercise. The material list should follow real products.

---

## 11. Chassis bench test (V15) — appended for module 10

**Purpose.** Replace the flat-plate estimator with a measured `k_ch` (N·m/deg), which is the difference
between a ±1–3× guess and a ±20 % number.

**Kit.** Two rigid stands or a bench vice, a lever arm of known length (200–300 mm, a steel rule or a
machined bar), a dial gauge or a caliper with a magnetic base, and known masses (a stack of 100–500 g).

**Procedure.**

1. **Support the chassis on its own suspension or on blocks at the four suspension pickup points** — the
   same boundary condition the model assumes. Supporting it at the ends gives a different (lower)
   stiffness and is the most common way this test is done wrong.
2. **Clamp one end.** Fix the rear of the plate rigidly (vice, or bolted to a stand through the rear
   bulkhead). Nothing at the rear may move; check with the dial gauge while loading.
3. **Rig the lever** at the front, at a known longitudinal distance `L_lev` from the clamp, pointing
   laterally so the load produces a roll moment.
4. **Zero the gauge** on the front corner of the plate, then load the lever with a known mass `m_test`
   at distance `L_lev`.
5. **Measure the deflection** `δ` of the loaded corner, and the deflection of the opposite front corner
   (it should move the other way; the difference is the twist).
6. **Compute:**

```
M_twist [N·m] = m_test[kg] · 9.81 · L_lev[m]
θ [rad]       = (δ_loaded − δ_opposite) / w_plate[m]        small-angle, w the plate width
k_ch [N·m/rad] = M_twist / θ
k_ch [N·m/deg] = k_ch · π/180
```

7. **Repeat at half load**; the two values should agree within 10 %. A large difference means the
   fixture is moving, not the plate.
8. **Subtract the fixture compliance** if the clamp deflects: repeat with a solid bar of known stiffness
   in place of the chassis, and subtract.

**Worked check.** A 2.0 mm CFRP plate at the reference dimensions should read about **0.38 N·m/deg**
(module 10 §4.1). A reading more than 3× that means the test is measuring the fixture; a reading near
zero means the clamp is not holding.

**Pass mark.** ±20 % on `k_ch` (V15). Record the number, the material, the thickness and the boundary
condition in §9, and set `chassis.torsion_measured` so the badge stops saying `estimated`.

**What it changes.** From module 10 §4.2: `k_ch = 21.6` gives balance 52.61 %, `k_ch = 63.2` gives
54.47 %. Getting this number wrong by 2.9× — which the estimator easily can — moves the balance by
**1.86 pp**, which is larger than the effect of most bar changes. That is why it is a P2 test and not a
P3.
