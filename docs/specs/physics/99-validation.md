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
| **L1 — identity** | the implementation satisfies known limiting cases | analytic cases (parallel arms, symmetric car, zero travel, 100% Ackermann condition) | shown plainly |
| **L2 — bench** | the model matches a measurement on a real car, within a stated tolerance | the measurement protocol in §3 | shown plainly, with the tolerance in the tooltip |
| **L3 — correlated** | the number predicts an outcome (lap time, driver report) within a stated tolerance | on-track or dyno correlation | shown with an explicit confidence statement |

**Every number in modules 2–7 is L0 + L1 today.** Not one is L2. The app must not present any of them
as validated, and the "about this number" sheet should say "computed from your geometry; not yet
checked against a measurement on a real car" until the row below is signed off.

That sentence is unpleasant to ship. It is also the only honest position, and the intent document is
explicit that a teaching tool which is confidently wrong is worse than no tool.

---

## 2. Validation matrix

Priorities: **P1** blocks a release, **P2** blocks a claim, **P3** is a nice-to-have.

| # | Module | Claim | Method | Pass mark | Pri |
|---|---|---|---|---|---|
| V1 | 1 | hardpoints convert and mirror correctly | build a model from a caliper session, check the derived wheelbase/track against a tape | ±0.5 mm | P1 |
| V2 | 2 | camber gain per mm | setup station: camber at ride height, then with a 5.00 mm spacer under the wheel | ±10% of κ, and the **sign** correct | P1 |
| V3 | 2 | static roll centre height | the roll-centre test from the corpus's MTC2 series (apply lateral force, find the height where the chassis does not roll) | ±2 mm, sign/magnitude only | P2 |
| V4 | 2 | roll-centre migration | same rig at two roll angles | ±3 mm lateral | P3 |
| V5 | 2 | scrub radius, KPI, caster, trail | setup station: caster and KPI are directly readable; scrub from the kingpin intersection on a plumb line | ±0.3°, ±1 mm | P2 |
| V6 | 4 | Ackermann | turn the wheels to a measured steer angle on one side, read the other; compare the ratio | ±5 percentage points | P2 |
| V7 | 4 | bump steer | toe at ride height, +5 mm and −5 mm with spacers | ±0.10 °/mm, and the sign correct | **P1** |
| V8 | 5 | installation ratio / wheel rate | load the corner with calibrated weights, measure wheel deflection, fit k_w | ±8% on k_w | **P1** |
| V9 | 5 | ARB rate | bench-test the bar alone: hold one arm, load the other, measure deflection | ±15% | P2 |
| V10 | 6 | static corner weights | four scales | ±2 g per corner | P1 |
| V11 | 6 | load-transfer split | **not directly measurable.** Compare against the four-scale measurement of a car on a tilt rig if one is available; otherwise treat as unvalidated | n/a | P3 |
| V12 | 7 | damper force curve | shock dyno at 20 °C, or a drop test with an accelerometer | ±30% on force, ±10% on the shape (blow-off speed) | P2 |
| V13 | 7 | temperature sensitivity | dyno at 20 °C and 40 °C | direction correct, magnitude within 2× | P3 |
| V14 | 9 | rollout and speed | one straight-line run with a GPS logger | ±2% | P3 |

### 2.1 Why these pass marks

They are derived from the model's sensitivity to its own input uncertainty, not chosen for comfort:

- **V2, ±10% on κ**: a 0.1 mm hardpoint error moves κ by ~2% (§02 §9), and a setup station reads
  camber to ±0.05°, which is ±6% of a 0.11 °/mm gain over 5 mm of travel. ±10% is what the inputs
  support; tighter would be theatre.
- **V3, ±2 mm on roll-centre height**: 0.16 mm of RC per mm of hardpoint error, plus the ~1% of track
  contact-patch approximation in §02 §3.5, gives a floor of about ±1 mm. ±2 mm allows for the rig.
- **V8, ±8% on wheel rate**: spring rates themselves are sold to ±5%, and IR is a squared quantity.
- **V12, ±30% on damper force**: the two blow-off parameters are assumed, and friction is unmodelled.
  Anything tighter would be asserting the assumed parameters are right.

---

## 3. Measurement protocol

Minimum viable session: one car, one caliper, one setup station, one afternoon, and a notebook.

### 3.1 Before anything

1. Zero the caliper and record the zero error. A 0.2 mm bias is invisible afterwards and moves the
   roll centre by 0.03 mm and κ by 4%.
2. Record tyre radius and ride height **at the same moment** as the hardpoints. Ride height changes
   move every chassis-side point in z.
3. Photograph each corner with a ruler in frame. Months later, the photograph is the only way to
   resolve "did I measure to the ball or to the stud?".

### 3.2 Hardpoints (V1)

For each corner: the two lower-arm hinge points, the lower ball joint centre, the camber-link inner
and outer ball studs, the rack end and the steering-arm ball, and the wheel centre height. Measure
each point **twice, from two directions**, and record both. The discrepancy between the two is the
honest uncertainty of that point — usually 0.2–0.5 mm on a 1/10 car, and it should be entered as the
`confidence` on that hardpoint.

Practical note that costs an afternoon if missed: the ball joint centre is inside the ball, not at
the top of the stud. Measure to the stud's shoulder and subtract the stud length, or use a
setup-station pin of known length seated in the ball.

### 3.3 Camber gain (V2)

1. Setup station on, car at ride height, record camber at all four corners.
2. Fit a **5.00 mm** spacer under one front wheel (a machined block, not washers).
3. Re-read camber on that corner.
4. Repeat at −5 mm by lifting the corner and letting it settle (or by using the droop screw).
5. κ_measured = Δcamber/5.00 °/mm.

This is the single most valuable measurement in the list: it validates modules 1, 2 and 5 in one
procedure, and it takes twenty minutes.

### 3.4 Bump steer (V7)

Same spacers, toe instead of camber. Toe is measured with the setup station's toe bars; the car must
be rolled back and forth between readings to settle the tyres, or the numbers will drift by more than
the effect being measured. Record toe at −5, 0, +5 mm and fit the slope.

If the measured slope is less than 0.05 °/mm, the measurement noise may exceed the signal; repeat
three times and report the spread rather than a single number.

### 3.5 Wheel rate (V8)

With the spring fitted and the damper disconnected (or at a speed where its force is negligible):

1. Support the chassis on stands under the opposite corner.
2. Zero the ride height with a dial gauge on the hub.
3. Add calibrated mass at the corner (a stack of weights, or a bar with known masses) in ~1 kg steps.
4. Record deflection per step. Slope = k_w, directly — this bypasses IR entirely and therefore tests
   the whole 2 → 5 chain including the motion-ratio computation.

If the app and the bench disagree, this measurement tells you *which* of the two is wrong: compare
`k_w` and then compare `IR` computed from the same data (`IR = √(k_w/k_s)`).

### 3.6 Damper (V12)

A shock dyno is the benchmark. Failing that, a drop test: drop the car from a known height with an
accelerometer on the chassis and fit the decay envelope to get ζ at the relevant speed, then compare
with the model's ζ at that speed. The drop test measures the whole car, so it validates the damping
ratio rather than the force curve — which is the number the app shows anyway.

---

## 4. Identity checks (L1) — do these before any bench work

These need no car and catch most implementation errors. They are cheap and should be in CI from day
one.

| # | Identity | Assertion |
|---|---|---|
| I1 | parallel, equal-length arms | roll centre at ground level; `parallelLinks` flag; no NaN |
| I2 | symmetric car, φ = 0 | roll centre on the centreline (y_rc = 0) to 1e-9 |
| I3 | zero bump | every output equals its static value, to 1e-9 |
| I4 | camber gain of a symmetric four-bar under mirroring | κ is the same for the left and mirrored-right corner |
| I5 | caster = 0, KPI = 0 | trail = 0 and scrub radius = 0 when the kingpin axis is vertical through the contact patch |
| I6 | 100% anti-dive condition | tan θ = h/l with K_bf = 1 gives exactly 100% |
| I7 | Ackermann at 0% | if the tie-rod inner points are moved to the knuckle pivots (ρ → tie rod length), δ_inner = δ_outer |
| I8 | IR at 90° damper angle | damper axis perpendicular to the arm's motion → IR = 0 → `noMotionRatio` |
| I9 | linearity of load transfer | doubling m doubles every ΔW; doubling a_y doubles every ΔW |
| I10 | sum of parts | elastic + geometric + unsprung = total, per axle, to 1e-9 |

I9 and I10 are the two that catch the "confident but wrong" class of error in module 6, because a
sign error in the geometric term still produces a plausible-looking balance.

---

## 5. The three equations we are least confident in

Chosen because they are the ones where a reviewer should push hardest, not because they are the most
complex.

### 5.1 Bump steer (module 4, §3.4)

**Why.** The 2D plan-view model with a vertical steering axis captures only the component of bump
steer produced by the tie rod's front-view inclination. It cannot see the component produced by the
wheel's lateral scrub acting on an inclined steering axis. On the reference geometry those two
components are 57% and 43% of the effect (§04 §6.5), so the model's magnitude is a coincidence of two
partial effects and **its zero is in the wrong place**: the model says "zero bump steer when the tie
rod is horizontal", while the published criterion is "zero when the tie rod's projection aims at the
instant centre". Those are different geometries.

**What would settle it.** A bench measurement of the toe curve at three rack heights (V7). If the
measured zero lands near the model's, the missing term is small on this geometry and the model is
usable with a caveat. If it lands near the IC criterion, the model must be replaced by a 3D solve
before the bump-steer number is displayed at all.

**Interim:** display the toe curve and the bump-steer coefficient to one decimal place, with the
caveat, and do not use it in any comparison verdict.

### 5.2 Roll-centre migration (module 2, §3.5)

**Why.** Migration is computed in the chassis frame, with the contact patch held at its static lateral
position and the wheel's own camber ignored when locating it. Each of those is a ~1%-of-track
approximation, but they compound exactly where the answer is most sensitive: the reference car
migrates 18.6 mm laterally per degree of roll, and the whole number is the difference between two
long lines (the ICs are 526 mm away). A 1% error in a 526 mm lever is 5 mm of migration.

**What would settle it.** The MTC2-style roll-centre rig at two roll angles (V4), or a ground-frame
reformulation (rotate the hardpoints, keep the road fixed, solve for the contact patch) compared
against it. The reformulation is a v2 item; the rig is the only external check.

**Interim:** show the migration as a line on a chart, not as a number in a table; two significant
figures at most; label the height and the lateral position separately, because the height moves by
0.4 mm/degree while the lateral position moves by 18.6 mm/degree and averaging them into one "roll
centre" number destroys the information.

### 5.3 Damper force magnitude (module 7, §3.3)

**Why.** The two parameters that set the absolute force — `F_bo` and `c_post` — are assumed, not
measured, and the model has no friction term (0.5–2 N of stiction against ~1.3 N of force at
50 mm/s). It also understates temperature sensitivity, because the low-speed flow in our model is
inertial (density-driven) whereas in a real shock it is substantially viscous. The *shape* of the
curve is defensible, the *level* is not.

**What would settle it.** A dyno pull (V12) with the same piston, hole count and oil. Then `F_bo` and
`c_post` become fitted-once, stored-per-piston data, and the module is honest. Until then, the
damping ratio should be presented as a curve with a ±30% band rather than as a number.

**Interim:** ship the curve, no headline ζ, and the four-item "what we cannot tell you" list from
§07 §3.7 in the app's damper help text.

### 5.4 The fourth one, for completeness: anti-dive and anti-squat (module 3)

We are not so much unsure of the arithmetic as certain that the classical formula is the wrong
instrument at 1/10 scale — it returns 300–400% for realistic geometry because `l/h ≈ 9`. The
mitigation is already in the spec: `diagnosticOnly`, hidden below a 10 mm side-view projection, never
used in advice. It is listed here so that nobody "fixes" it by tuning a coefficient.

---

## 6. What we will never claim

Written down so that a future feature request has something to argue with.

| Claim | Why not |
|---|---|
| "This setup will be faster" | needs a lap-time model and a driver; the intent document rules it out |
| "Grip is up" | needs a tyre model (module 8) |
| "This will understeer" | needs a tyre model; we say "moves load transfer to the front" |
| "Validated against RC3" | we have no RC3 binaries, no RC3 output, and comparing against them would be both an IP problem and a false authority |
| "Matches your shock dyno" | unless the user supplies the pull and we fit to it, and then we say "fitted to your data" |
| Any number to more significant figures than its input uncertainty supports | see the precision table in §7 |

---

## 7. Precision policy

Derived from the sensitivity analyses in the module specs. Every display must round to these.

| Quantity | Display precision | Rationale |
|---|---|---|
| Roll centre height | 0.1 mm | 0.16 mm of RC per mm of hardpoint error |
| Roll centre lateral position | 0.5 mm | dominated by the migration approximation |
| Camber gain | 0.01 °/mm | 2% per 0.1 mm of hardpoint error |
| Camber, caster, KPI | 0.1° | setup station resolution |
| Scrub radius, trail | 0.1 mm | |
| Bump steer coefficient | 0.01 °/mm | §5.1, but *use* only 0.1 |
| Installation ratio | 0.01 | |
| Wheel rate | 0.01 N/mm | spring rate sold to ±5% |
| Roll stiffness | 0.1 N·m/rad | |
| Ride frequency | 0.1 Hz | |
| Load transfer | 0.01 N | but balance to 0.1%, not 0.01% |
| Balance | 0.1% | CG height uncertainty dominates below that |
| Damping ratio | 0.01 | ±30% on force |
| Anti-dive / anti-squat | not displayed | §5.4 |

---

## 8. Release gate

A release may ship when:

1. Every golden test in modules 1–7 passes, and every ID in the specs has a matching test
   (`dart run tool/spec_audit.dart` is clean).
2. The identity checks I1–I10 pass, including the property test that no `NaN` or `Infinity` escapes a
   public API over 10 000 randomised geometries.
3. V1, V2, V7, V8 and V10 have been run once on at least one real car, and the results are recorded
   in this file with the date, the car, and the measured vs computed table.
4. Every number still unvalidated at L2 carries its caveat string in the UI.

Nothing in this list requires a tyre model, a dyno, or a second car to start. V2, V7, V8 and V10 are
one afternoon with a setup station, four scales and a set of spacers.

---

## 9. Results log

Empty, deliberately. Fill it in as measurements happen; do not delete failed rows.

| Date | Car | Test | Measured | Computed | Δ | Pass? | Notes |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

---

## 10. Open questions for Dave

1. **Is an L2 claim required for v1?** If the answer is "yes, before first release", the schedule
   needs one bench session and a willing car. If "no", the caveat strings ship and every number is
   labelled unvalidated — which is defensible but changes the marketing.
2. **Which car?** The reference geometry in this spec is synthetic-but-plausible. Validating against a
   real chassis means either measuring Dave's car or adopting a community model (with its `source`),
   and the second only tells us we match someone else's numbers.
3. **Does the family have the RC3 chassis data?** If a chassis library arrives, its hardpoints become
   test *inputs* (never outputs) and give us dozens of geometries for the property tests, without any
   IP problem.
4. **Is a shock dyno accessible?** If not, V12 and V13 should be marked "not planned" rather than left
   as an open gate, and module 7's caveat becomes permanent.
