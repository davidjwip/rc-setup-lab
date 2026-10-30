# 04 — Steering: Ackermann, bump steer, toe curve

Build order: 4 of 9. Depends on module 2 for the wheel position and the tie-rod outer ball's
height at a given bump.

---

## 1. Purpose

| Output | Unit | Meaning |
|---|---|---|
| Rack travel | mm | input, ± |
| Steer angle, each front wheel | ° | at a given rack position |
| Ackermann | % | 100% = the ideal relation `cot δ_o − cot δ_i = t/l` |
| Toe curve vs bump | ° vs mm | the bump-steer signature of the linkage |
| Bump-steer coefficient | °/mm | slope of the toe curve at static ride height |

Two independent sub-models share one plan-view construction: steering (**rack → angles**) and bump
steer (**bump → toe**). Both reduce to "intersect a circle about the rack end with a circle about
the steering axis".

---

## 2. Inputs

| Input | Symbol | Unit | Range (1/10 TC) | Source |
|---|---|---|---|---|
| steering-axis ground point | A = (x,y) | mm | — | derived in module 2 §3.7 (from Lₒ, Uₒ) |
| inner tie-rod ball | Tᵢ | mm (x,y,z) | — | module 1 |
| outer tie-rod ball | Tₒ | mm (x,y,z) | — | module 1 |
| wheel centre | W | mm | — | module 1 |
| front track, wheelbase | t, l | mm | 172, 257 | module 1 |
| rack travel, each direction | s | mm | ±2 … ±8 | setup input |
| static toe per wheel | τ₀ | ° | −1 … +1 | setup |
| steering-arm angle offset | — | ° | −20 … +20 | **derived** from the Tₒ hardpoint; exposed in the UI as "Ackermann shim" |

Derived quantities, computed once at load:

```
ρ   = |Tₒ_plan − A|                       steering-arm plan radius                  (4.1)
L   = |Tₒ − Tᵢ|  (3D)                     tie-rod length, nominally constant        (4.2)
r_p = √(L² − (z_Tₒ − z_Tᵢ)²)              plan length the tie rod must span         (4.3)
```

No physical constants. (Friction, compliance and servo compliance are not modelled — see §5.)

---

## 3. Model

### 3.1 The knuckle's plan motion

v1 uses a **vertical steering axis through A**. The knuckle's outer tie-rod ball therefore moves on
a circle of radius ρ about A in plan, and the wheel's steer angle equals the rotation ψ of that
circle.

That is the standard hand construction, and it is an approximation: the real axis is inclined by KPI
and caster, so ρ changes slightly as the wheel moves up and down. §5 quantifies the error.

### 3.2 Rack → steer angles

The rack translates both inner tie-rod balls by the same amount `s` in y (that is what a rack does —
one bar, two ends). For each side:

```
Tᵢ' = (Tᵢ.x, Tᵢ.y ± s, Tᵢ.z)          + for the left, − for the right, per the rack's direction
```
(4.4)

Then solve for the outer ball position: it must lie on both

```
circle about Tᵢ'  of radius r_p        (tie-rod length preserved)
circle about A    of radius ρ          (knuckle rigid, axis fixed)
```

Two-circle intersection:

```
D  = |A − Tᵢ'|
aa = (r_p² − ρ² + D²)/(2D)                                                (4.5)
h  = √(r_p² − aa²)                                                        (4.6)
ê  = (A − Tᵢ')/D,  p̂ = (−ê_y, ê_x)
Tₒ' = Tᵢ' + aa·ê ± h·p̂                                                    (4.7)
```

Choose the branch nearest the static Tₒ (and then keep it, as in module 2). The steer angle is the
change of the polar angle of Tₒ' about A:

```
δ_side = atan2(Tₒ'.y − A.y, Tₒ'.x − A.x) − atan2(Tₒ.y − A.y, Tₒ.x − A.x)   (4.8)
```

Sign: `δ` is positive when the wheel turns toward +y (left). For the left wheel that is a negative
ψ per the convention above; the implementation should normalise so that **positive δ = the car
turns left** for both wheels, and the golden tests below assert the normalised values.

Toe is the wheel's own angle relative to the vehicle axis. Static toe τ₀ is a setup input added to
the geometric steering angle; it does not feed back into the linkage (a tie rod adjusted for toe
changes the rack's neutral position, which we model as an offset, not a geometry change).

### 3.3 Ackermann

With the inner wheel being the one on the side the car is turning toward:

```
Ackermann % = 100 · (cot|δ_outer| − cot|δ_inner|) / (t/l)                 (4.9)
```

- 0% = parallel steer (`δ_outer = δ_inner`).
- 100% = the ideal, both wheels' axes meeting on the rear-axle line.
- >100% = the inner wheel turns more than ideal (over-Ackermann).

Report `δ_inner`, `δ_outer` and the percentage. Do not report a percentage when
`|δ_inner| < 0.5°`, because the ratio is dominated by noise at small angles.

**The classic design rule and why we do not apply it.** Suspension texts say to aim the steering arm
at the rear-axle centre to get 100% Ackermann. That rule is exact for a linkage whose inner pivots
are *fixed* points. A rack's inner ends **translate**, which changes the effective geometry, and the
rule degrades. On the reference car, arms aimed exactly at the rear-axle centre give **127%**, not
100% (§6.3). This is the single best argument for computing Ackermann rather than tabulating it, and
the app's teaching copy should say so.

### 3.4 Bump steer

Bump raises Tₒ (module 2 gives its y and z at any bump). Since the tie rod's 3D length is fixed, the
knuckle must rotate in plan until the plan-projected length satisfies (4.3) at the new height:

```
z_Tₒ(bump)  ← from the module-2 carrier solve
r_p(bump)   = √(L² − (z_Tₒ(bump) − z_Tᵢ)²)                                (4.10)
Tₒ'(bump)   = circle(Tᵢ, r_p(bump)) ∩ circle(A, ρ)                        (4.11)
τ(bump)     = ψ(bump) − ψ(0)                                              (4.12)
```

with ρ held **constant**. That last point is not a detail:

> **ρ must not be recomputed from the carrier-solved Tₒ.** The knuckle is rigid and rotates about the
> axis, so its plan radius cannot change through the carrier's swing. Recomputing ρ from the moved
> point double-counts the lateral motion and moves the zero-bump-steer height by ~2 mm. The reference
> implementation holds ρ fixed and the worked example (§6.4) does the same.

Bump-steer coefficient, central difference:

```
b = [τ(+0.2 mm) − τ(−0.2 mm)] / 0.4        [°/mm]                        (4.13)
```

Report the coefficient *and* the toe at ±3 mm, because a racer's question is "how much does it move
over the travel I have", not "what is the derivative".

### 3.5 What the toe curve actually is

The reported toe angle at a bump is `τ₀ + τ(bump)`. The app plots that over the suspension's travel.
It should also report the **travel endpoints** and flag when the curve leaves the ±0.5° band that
racers treat as acceptable.

---

## 4. Degenerate cases

| Condition | Behaviour |
|---|---|
| circles do not intersect at (4.7) or (4.11) | `Undefined(noIntersection)` — the rack travel exceeds the linkage's reach; UI: "rack travel exceeds linkage range" |
| `Tᵢ == Tₒ` | caught at load (module 1) |
| `ρ < 1 mm` | `degenerateGeometry` — steering arm has no length, `δ` is meaningless |
| `r_p ≤ 0` (tie rod shorter than its own vertical span) | `Undefined(outOfDomain)` |
| two solutions equidistant from the static point | take the one with the smaller `\|ψ\|`; log `ambiguousBranch` flag |
| `δ_inner` < 0.5° | Ackermann not reported (see §3.3) |
| rack exactly at neutral and the geometry asymmetric | `δ` ≠ 0 is legitimate (a tweaked car); do not force it to zero |

---

## 5. Assumptions and where this breaks

1. **Vertical steering axis.** Real axes are inclined by KPI (8° reference car) and caster (7.7°).
   The consequence is that ρ varies by roughly `ρ·sin(KPI)·Δz ≈ 17 × 0.14 × 2 = 4.8%` over ±2 mm of
   travel. That is small for Ackermann and **not** small for bump steer, because bump steer is a
   small difference of two large lengths.
2. **This is the important one.** The 2D plan-view model with a vertical axis captures the component
   of bump steer that comes from the tie rod's *front-view inclination* — the plan projection
   shortening as Tₒ rises. It does **not** capture the component that comes from the wheel's lateral
   scrub acting on the *inclined* axis. On the reference geometry those two components are of
   comparable size (§6.5). Consequences:
   - the magnitude can be roughly right for the wrong reason;
   - the model's zero-bump-steer height is where the tie rod is horizontal, not where it aims at the
     instant centre (the published criterion);
   - therefore the app must not present "bump steer" to two significant figures, and 99-validation.md
     puts a bench measurement of the toe curve near the top of its list.
3. **Rigid knuckle, no compliance.** Servo slop, servo-saver springs and tie-rod flex are not
   modelled. A touring car's servo saver can absorb several tenths of a degree, which is the same
   order as the bump steer being computed.
4. **Rack travel is symmetric and the rack is centred.** A rack mounted off-centre produces different
   left/right angles at the same travel; the model handles it (nothing assumes symmetry) but the
   golden cases use a centred rack.
5. **No tyre. ** The wheel's steer angle is not the tyre's slip angle. The app reports geometry, not
   handling.

---

## 6. Worked examples

Reference car. Steering-axis ground point A = (259.9459, 78.9838) mm from module 2 §6.7;
Tᵢ = (225.00, 26.00, 30.00); Tₒ = (243.6802, 74.0415, 32.00); t = 172, l = 257.

### 6.1 Derived quantities

```
ρ  = |(243.6802 − 259.9459, 74.0415 − 78.9838)| = |(−16.2657, −4.9423)| = 17.0000 mm
Δᵢₒ = (18.6802, 48.0415, 2.00)
L  = √(18.6802² + 48.0415² + 2.00²) = √(349.95 + 2307.99 + 4.00) = √2661.94 = 51.5843 mm
r_p = √(51.5843² − 2.00²) = √(2660.94 − 4.00) = √2656.94 = 51.5455 mm
```

### 6.2 Steer angles at 2 mm of rack travel

Rack +2 mm (moves both inner ends toward +y). Left side: Tᵢ' = (225, 28).

Circle 1: centre (225, 28), r = 51.5455. Circle 2: centre (259.9459, 78.9838), r = 17.0000.

```
Δ = A − Tᵢ' = (34.9459, 50.9838),   D = √(1221.22 + 2599.35) = 61.8107
aa = (51.5455² − 17.0000² + 61.8107²)/(2×61.8107)
   = (2656.94 − 289.00 + 3820.56)/123.6214 = 6188.50/123.6214 = 50.0601
h  = √(2656.94 − 2506.01) = √150.93 = 12.2851
ê  = (0.56538, 0.82484),   p̂ = (−0.82484, 0.56538)
base = Tᵢ' + aa·ê = (225 + 28.3025, 28 + 41.2914) = (253.3025, 69.2914)
Tₒ' = base + h·p̂ = (253.3025 − 10.1336, 69.2914 + 6.9457) = (243.1689, 76.2371)
```

(the other branch gives (263.436, 62.346), which is 20 mm away from the static point — rejected.)

```
static ψ = atan2(74.0415 − 78.9838, 243.6802 − 259.9459) = atan2(−4.9423, −16.2657)
         = −180° + atan(4.9423/16.2657) = −180° + 16.91° = −163.09°
new ψ    = atan2(76.2371 − 78.9838, 243.1689 − 259.9459) = atan2(−2.7467, −16.7770)
         = −180° + atan(2.7467/16.7770) = −180° + 9.30° = −170.70°
δ_left   = −170.70 − (−163.09) = −7.61°   (0.133 rad of arc at ρ = 17 mm = 2.26 mm of travel)
```

Right side: Tᵢ' = (225, −24), A_R = (259.9459, −78.9838), Tₒ_R = (243.6802, −74.0415).

```
D = 65.1493,  aa = 50.7478,  h = 9.0331
Tₒ' = (244.597, −71.675)   [branch nearest static]
δ_right = −8.563°
```

Normalising to "positive δ = the car turns left": both are negative, so the car turns **right** at
rack +2. The inner wheel is the right one:

```
δ_inner = 8.563°,  δ_outer = 7.603°
```

### 6.3 Ackermann

```
cot(7.603°) = 7.4916,   cot(8.563°) = 6.6414
Ackermann = 100 × (7.4916 − 6.6414)/(172/257)
          = 100 × 0.8502/0.66926 = 127.0%
```

Now the same geometry with the steering arm rotated (equivalently: the outer tie-rod ball moved
along its arc, which is what an "Ackermann shim" does):

| Arm offset | δ_left | δ_right | Ackermann |
|---|---|---|---|
| −10° (arm rotated rearward) | −6.847° | −7.152° | 53.6% |
| 0° (aimed at the rear-axle centre) | −7.603° | −8.563° | 127.0% |
| +10° (arm rotated forward) | −8.256° | −9.756° | 160.7% |

The rule-of-thumb arm direction gives 127%, not 100% — see §3.3. Ten degrees of arm rotation moves
Ackermann by roughly 5–7 percentage points per degree, which is why the shim exists.

### 6.4 Bump steer

With z_Tᵢ = 30.00 mm and z_Tₒ = 32.00 mm (a tie rod with 2 mm of front-view drop over its length),
and module 2 supplying z_Tₒ at each bump (L = 51.5843 mm throughout):

| bump (mm) | z_Tₒ (mm) | r_p (mm) | ψ (°) | τ (°) |
|---|---|---|---|---|
| −4 | 28.064 | 51.5479 | −0.010 | −0.010 |
| −2 | 30.039 | 51.5842 | −0.166 | −0.166 |
| −1 | 31.021 | 51.5741 | −0.123 | −0.123 |
| 0 | 32.000 | 51.5455 | 0.000 | 0.000 |
| +1 | 32.975 | 51.4984 | +0.202 | +0.202 |
| +2 | 33.948 | 51.4330 | +0.484 | +0.484 |
| +4 | 35.882 | 51.2478 | +1.290 | +1.290 |

Note how small the r_p changes are — 0.3 mm over 8 mm of travel — and how large the resulting toe
changes are, given ρ = 17 mm. That ratio (0.3 / 17 = 1°) is the whole mechanism, and it explains
why bump steer is so sensitive to a millimetre of rack height.

Cleanest form of the same data, which is what the golden test asserts:

| bump (mm) | τ (°) |
|---|---|
| −2 | −0.166 |
| −1 | −0.123 |
| 0 | 0.000 |
| +1 | +0.202 |
| +2 | +0.484 |
| +4 | +1.290 |

Bump-steer coefficient, (4.13):

```
b = [τ(+0.2) − τ(−0.2)]/0.4 = [0.0325 − (−0.0325)]/0.4 ≈ +0.162 °/mm
```

and by the table's chord: `(0.484 − (−0.166))/4 = 0.1625 °/mm`. **+0.16 °/mm of bump**, i.e. about
**0.65° of toe change across ±2 mm** — a big number for a touring car, and the kind of thing the
app exists to surface.

Sensitivity to the tie rod's height, which is the whole design lever:

| z_Tᵢ (mm) | bump-steer coefficient (°/mm) | toe at +2 mm (°) |
|---|---|---|
| 26.00 | +0.487 | +1.143 |
| 28.00 | +0.325 | +0.812 |
| 30.00 | +0.162 | +0.484 |
| 31.00 | +0.081 | +0.321 |
| 32.00 | −0.000 | +0.158 |
| 33.00 | −0.081 | −0.004 |
| 34.00 | −0.162 | −0.166 |

The coefficient moves linearly at **0.081 °/mm per mm** of rack height and crosses zero at
z_Tᵢ = 32.00 mm — which is exactly where the tie rod is horizontal in front view. That is the model
behaving as its equations say it must (§5.2), and it is *not* the published criterion. The
discrepancy is the module's main open question and is listed as such in 99-validation.md.

### 6.5 Why the two components matter

A sanity check a reviewer can do in a minute. The tie-rod outer ball's velocity in the front view at
static is

```
dTₒ/dbump = (0.053, 0.977) mm per mm        (from module 2's carrier solve at ±0.5 mm)
```

The tie rod's unit vector, projected into the front view:

```
û_yz = (26 − 74.0415, 30 − 32)/|…| = (−48.0415, −2.00)/48.0831 = (−0.99914, −0.04160)
```

Component of the ball's motion along the tie rod:

```
û_yz · dTₒ/dbump = (−0.99914)(0.053) + (−0.04160)(0.977) = −0.05295 − 0.04064 = −0.09359
```

The two terms are 57% and 43% of the total. The model in §3.4 reproduces only the second (the
vertical term, through the plan-projection shortening); the first (lateral scrub along the tie rod)
is invisible to a constant-ρ plan construction. Since they are comparable, the model's magnitude is
a coincidence of two partial effects and its zero is in the wrong place. **This is stated so that
nobody "fixes" the bump-steer number by adjusting a coefficient.**

---

## 7. Golden test cases

| ID | Input | Expected | Origin |
|---|---|---|---|
| G04.1 | reference car, rack +2.000 mm | δ_left = −7.603°, δ_right = −8.563° (sign: car turns right) | hand calc §6.2 |
| G04.2 | reference car, rack +2.000 mm | Ackermann = 127.0% ± 0.2 | hand calc §6.3 |
| G04.3 | steering arm rotated −10° about A, rack +2 | δ = (−6.847, −7.152)°, Ackermann = 53.6% | hand calc §6.3 table |
| G04.4 | reference car, z_Tᵢ = 30.00 mm | τ(−2) = −0.166°, τ(+2) = +0.484°, τ(+4) = +1.290° | hand calc §6.4 |
| G04.5 | reference car, z_Tᵢ = 30.00 mm | bump-steer coefficient = +0.162 °/mm ± 0.002 | hand calc §6.4 |
| G04.6 | z_Tᵢ moved to 32.00 mm | coefficient = 0.000 °/mm ± 0.001 | hand calc §6.4 (zero crossing) |
| G04.7 | rack +40 mm (beyond reach) | `Undefined(noIntersection)` | spec §4 |
| G04.8 | rack +2 mm, `\|δ_inner\| < 0.5°` (rack +0.3 mm) | Ackermann not reported, `flags: [lowAngle]` | spec §3.3 |

Tolerance: 1 × 10⁻³ ° on angles, 1 × 10⁻³ °/mm on the coefficient.

**Origins:** all eight are hand calculations in §6, using equations (4.5)–(4.13). No published
experimental data exists for this exact geometry. G04.6 is the most valuable of the eight because it
tests a *structural* property (the zero crossing) rather than an arithmetic one.
