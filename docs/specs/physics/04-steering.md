# 04 — Steering: Ackermann, bump steer, toe curve

Build order: 4 of 9. Depends on module 2 for the wheel position and for the tie-rod outer ball's
height at a given bump — which is the **carrier transform** (02 §3.2.3), not a wheel-centre formula.

---

## 1. Purpose

| Output | Unit | Meaning |
|---|---|---|
| Rack travel | mm | input, signed |
| Steer angle, each front wheel | ° | at a given rack position, positive = wheel points left |
| Ackermann | % | 100 % = the ideal `cot δ_o − cot δ_i = t/l` |
| Toe curve vs bump | ° vs mm | the bump-steer signature, **toe-in positive** |
| Bump-steer coefficient | °/mm | slope of the toe curve at static ride height, toe-in positive |
| Axle total toe change | ° | `τ_L + τ_R`; the number a racer reads off two toe bars |

Two sub-models share one plan-view construction: steering (**rack → angles**) and bump steer
(**bump → toe**). Both reduce to "intersect a circle about the rack end with a circle about the
steering axis".

**Three things changed in round 2**, each of which produced plausible-looking wrong numbers in
round 1: the rack's displacement sign (B6), the toe sign (B3), and the absence of a defined carrier
transform for the tie-rod outer ball (B5, now 02 §3.2.3).

---

## 2. Inputs

| Input | Symbol | Unit | Range (1/10 TC) | Source |
|---|---|---|---|---|
| steering-axis ground point | A = (x,y) | mm | — | module 2 §3.7 (`y_g`, `x_g`) — see §5.1 for the bias this carries |
| inner tie-rod ball | Tᵢ | mm (x,y,z) | — | module 1 |
| outer tie-rod ball | Tₒ | mm (x,y,z) | — | module 1 |
| wheel centre | W | mm | — | module 1 |
| front track, wheelbase | t, l | mm | 172, 257 | module 1 |
| rack travel, each direction | s | mm | ±2 … ±8 | setup input |
| **rack travel limit** | s_max | mm | 2 – 10 | **model** (pinion travel), not geometry |
| static toe per wheel | τ₀ | ° | −1 … +1 | setup |
| steering-arm angle offset | α | ° | −10 … +10 | **input** (the "Ackermann shim"), see §6.3 |

Derived quantities, computed once at load:

```
ρ   = |Tₒ_plan − A|                       steering-arm plan radius                  (4.1)
L   = |Tₒ − Tᵢ|  (3D)                     tie-rod length, nominally constant        (4.2)
r_p = √(L² − (z_Tₒ − z_Tᵢ)²)              plan length the tie rod must span         (4.3)
```

No physical constants. Friction, compliance and servo compliance are not modelled (§5).

---

## 3. Model

### 3.1 The knuckle's plan motion

v1 uses a **vertical steering axis through A**. The knuckle's outer tie-rod ball moves on a circle of
radius ρ about A in plan, and the wheel's steer angle equals the rotation ψ of that circle. This is
the standard hand construction and it is an approximation: the real axis is inclined by KPI (8°) and
caster (7.7°). §5.1 quantifies both the *variation* and the *bias* it introduces.

### 3.2 Rack → steer angles (rack sign corrected — B6)

**The rack translates as one body: both inner ends move the same way.**

```
Tᵢ' = (Tᵢ.x, Tᵢ.y + s, Tᵢ.z)          same sign on BOTH sides                       (4.4)
```

Round 1 wrote `Tᵢ.y ± s`, "+ for the left, − for the right", while its own worked example used +2 mm
on both sides. Implementing (4.4) literally gives, at rack +2 mm:

```
per round 1's (4.4):  δ_left = −7.603°,  δ_right = +7.603°     ← wheels toe apart
per its own §6.2:     δ_left = −7.603°,  δ_right = −8.563°     ← correct, Ackermann 127 %
```

The bug is invisible on a plot — both curves still look like steering — and turns a 127 % Ackermann
car into a 0 % one. **Sign convention:** `s` is the rack's displacement in +y; positive `s` moves both
rack ends left, which steers the car **right** (`δ < 0`).

Then solve for the outer ball: it lies on both

```
circle about Tᵢ' of radius r_p        (tie-rod length preserved)
circle about A    of radius ρ          (knuckle rigid, axis fixed)

D  = |A − Tᵢ'|
aa = (r_p² − ρ² + D²)/(2D)                                                    (4.5)
hc = √(r_p² − aa²)                                                            (4.6)
ê  = (A − Tᵢ')/D,  p̂ = (−ê_y, ê_x)
Tₒ' = Tᵢ' + aa·ê ± hc·p̂                                                       (4.7)
δ_side = atan2(Tₒ'.y − A.y, Tₒ'.x − A.x) − atan2(Tₒ.y − A.y, Tₒ.x − A.x)      (4.8)
```

**Branch rule (one rule, not two).** Choose the solution **nearest the static Tₒ**, keep it, and store
it against the corner (as module 2 does). If the two solutions are equidistant within `kCircleTol`,
return `Undefined(ambiguousBranch)`; do not apply a second tie-break by `|ψ|` — round 1 had both
rules and no statement of which wins. The static residual is checked before the solve: if
`r_p(0) ≠ |Tₒ − Tᵢ|_plan` (i.e. the tie rod does not fit at bump 0), the model is inconsistent and the
call returns `Undefined(incompleteModel)` naming `tie_in`/`tie_out` rather than silently re-zeroing
(§6.4 explains why that matters for the rack-height table).

`δ` is normalised to (−180°, 180°] and **positive = the car turns left** for both wheels. Static toe
τ₀ is a setup input added to the geometric angle; it does not feed back into the linkage (adjusting
the turnbuckle for toe changes the rack's neutral position, modelled as an offset, not a geometry
change).

### 3.3 Ackermann

```
Ackermann % = 100 · (cot|δ_outer| − cot|δ_inner|) / (t/l)                       (4.9)
```

- 0 % = parallel steer; 100 % = both wheels' axes meet on the rear-axle line; >100 % = over-Ackermann.

`t` here is the **contact-patch track** (172.0 mm on the reference car), not the steering-axis spacing
(157.97 mm). Both are defensible — Milliken uses the axis spacing, many practical calculators use
track — and the choice is stated here rather than buried in a test, because a reviewer who "fixes" it
to 158 mm changes the reference Ackermann from 127.0 % to 138.4 %. **We use contact-patch track and
say so; do not correct it silently.**

Do not report a percentage when `|δ_inner| < 0.5°`: the ratio is dominated by noise there. On the
reference car that threshold is crossed below ~0.13 mm of rack travel (G04.8 uses +0.10 mm).

**The classic design rule, and why we do not apply it.** Texts say to aim the steering arm at the
rear-axle centre for 100 % Ackermann. That rule is exact for a linkage whose inner pivots are *fixed*;
a rack's inner ends **translate**, which changes the effective geometry. On the reference car, arms
aimed at the rear-axle centre give **127 %**.

### 3.4 Bump steer (toe sign corrected — B3)

Bump raises Tₒ. **Tₒ's height comes from module 2's carrier transform** (02 §3.2.3) — it is a rigid
point on the knuckle, so it rotates with the carrier axis, not with the crank angle. Using the crank
angle instead is an 11 % error that passes every eyeball check (02 §6.9).

Since the tie rod's 3D length is fixed, the knuckle must rotate in plan until the plan-projected
length satisfies (4.3) at the new height:

```
z_Tₒ(bump)  ← module 2 carrier transform
r_p(bump)   = √(L² − (z_Tₒ(bump) − z_Tᵢ)²)                                    (4.10)
Tₒ'(bump)   = circle(Tᵢ, r_p(bump)) ∩ circle(A, ρ)                             (4.11)
ψ(bump)     = atan2(Tₒ'.y − A.y, Tₒ'.x − A.x)
τ(bump)     = −( ψ(bump) − ψ(0) )      per wheel, POSITIVE = TOE-IN             (4.12)
```

**Why the minus sign.** ψ increases counter-clockwise in plan. For the LF, raising Tₒ rotates the
knuckle CCW, which swings the wheel's *front* edge outboard — that is **toe-out**. Round 1's (4.12)
wrote `τ = ψ(bump) − ψ(0)` and its table therefore reported +0.484° where module 1's convention (toe
positive = toe-in) says −0.484°. Worse, it printed one scalar per corner while a symmetric bump toes
*both* wheels out: the axle's total toe change is `τ_L + τ_R = −0.968°`, and a per-wheel "+0.484° toe"
is not a quantity a racer can use.

With (4.12) as written, `τ₀ + τ(bump)` is legal in §3.5, because both are toe-in positive. Reported:
`τ` per wheel, and `τ_L + τ_R` for the axle.

**ρ must not be recomputed from the carrier-solved Tₒ.** The knuckle is rigid and rotates about the
axis, so its plan radius cannot change through the carrier's swing. Recomputing ρ from the moved point
double-counts the lateral motion and moves the zero-bump-steer height by ~2 mm. Hold ρ fixed.

Bump-steer coefficient, central difference:

```
b = [τ(+0.2 mm) − τ(−0.2 mm)] / 0.4        [°/mm]                             (4.13)
```

Round 1's worked example printed the intermediate values as ±0.0325 (symmetric about static); the
model gives **+0.03403 / −0.03096** — asymmetric, because τ is not an odd function of bump. The slope
is right; the printed arithmetic now shows what the equations produce.

#### 3.4.1 Rear toe link

The rear has no rack. The same plan construction applies with `Tᵢ` fixed: the inner ball does not
translate, and the knuckle rotates about its own steering axis until the tie rod's plan projection
matches (4.10)–(4.12). The modelled rear's outer ball sits within ~1.5 mm of the axis, so the
ground-point circle is tangent across the travel window and has no solution; the rear therefore
evaluates the same axis at the **upper ball joint**, which keeps the construction conditioned. The
front remains pinned to the ground point (§5.1) and none of G04.1–G04.10 moves. τ is still per wheel,
toe-in positive, and the axle total is `τ_L + τ_R`; the stored `toe` is the zero-travel value.

### 3.5 The toe curve

The reported toe at a bump is `τ₀ + τ(bump)`. The app plots that over the suspension's travel, reports
the travel endpoints, and flags when the curve leaves the ±0.5° band racers treat as acceptable. It
also reports the **axle total**, because that is what two toe bars measure.

### 3.6 Rack travel limit (new)

Round 1's `noIntersection` case (G04.7) was unreachable on this car: the two circles intersect for
every rack position, because `|A.x − Tᵢ.x| = 34.9459 mm` exceeds `|r_p − ρ| = 34.5455 mm`. At rack
+20 mm the model happily returns +294° of steer, and at +40 mm it returns +223° — a knuckle position
the servo could never produce, reported as a number.

The guard is therefore not geometric but **mechanical**: the model stores the rack's travel limit
`±s_max` (pinion travel × rack gain, from the manufacturer or measured), checked before the solve:

```
if |s| > s_max:  Undefined(outOfRackTravel)                                    (4.14)
```

`noIntersection` remains as a load-time check (a tie rod that cannot span its own geometry).

---

## 4. Degenerate cases

| Condition | Behaviour |
|---|---|
| `\|s\| > s_max` | `Undefined(outOfRackTravel)` — checked first, deterministic |
| circles do not intersect at (4.7)/(4.11) at load time | `Undefined(noIntersection)` — geometry inconsistent |
| `Tᵢ == Tₒ` | caught at load (module 1) |
| `ρ < 1 mm` | `Undefined(degenerateGeometry)` — steering arm has no length; `δ` is meaningless. (A buggy's arm may legitimately be short; the threshold is a length, not a judgement, and the flag `lowConfidence` fires at `ρ < 5 mm` instead of refusing.) |
| `r_p ≤ 0` (tie rod shorter than its own vertical span) | `Undefined(outOfDomain)` |
| two solutions equidistant within `kCircleTol` | `Undefined(ambiguousBranch)` |
| `\|δ_inner\| < 0.5°` | Ackermann not reported, `flags: [lowAngle]` |
| rack at neutral on an asymmetric car | `δ ≠ 0` is legitimate; do not force it to zero |
| static residual: `r_p(0)` inconsistent with the measured Tₒ by > 0.05 mm | `Undefined(incompleteModel)` before any solve (§6.4) |

---

## 5. Assumptions and where this breaks

1. **Vertical steering axis.** The real axis is inclined by KPI (8°) and caster (7.7°). Two separate
   consequences, and round 1 confused them:

   - **Variation** with travel: the plan radius changes by `Δρ = sin(KPI)·Δz` — **0.279 mm over
     ±2 mm** (8° gives sin = 0.1392, × 2 mm). That is **1.6 %** of ρ = 17.0 mm. Round 1 wrote
     "`ρ·sin(KPI)·Δz ≈ 17 × 0.14 × 2 = 4.8 %`", which multiplies by ρ *and* by Δz, gives 4.76 —
     not a percentage of anything — and is 28 %, not 4.8 %, even on its own arithmetic.
   - **Bias**: A is the axis's **ground** point, but the tie rod works at z = 32 mm, where the real
     axis sits at (255.62, 74.49). The plan radius about that point is
     `ρ = |(243.68, 74.04) − (255.62, 74.49)| = 11.95 mm`, not 17.00 mm. Using the ground point
     **overstates ρ by 42 %**, and every steer angle, the Ackermann percentage and the bump-steer
     coefficient scale roughly as 1/ρ.

   The variation is negligible; the bias is not. G04.1–G04.5 are pinned to the ground-point
   construction and labelled accordingly; switching to the working-height axis is an owner decision
   (00 §0) because it changes every steer angle by ~40 %.

2. **This is the important one.** The 2D plan-view model with a vertical axis captures the component of
   bump steer that comes from the tie rod's *front-view inclination* — the plan projection shortening
   as Tₒ rises. It does not capture the component from the wheel's lateral scrub acting on the
   *inclined* axis. On the reference geometry those are 57 % and 43 % of the effect (§6.5), so the
   magnitude can be roughly right for the wrong reason and the model's zero-bump-steer height is where
   the tie rod is horizontal, not where it aims at the instant centre.
3. **Rigid knuckle, no compliance.** Servo slop, servo-saver springs and tie-rod flex are not
   modelled; a touring car's servo saver can absorb several tenths of a degree, the same order as the
   bump steer being computed.
4. **Rack travel is symmetric and the rack is centred.** The model handles an offset rack (nothing
   assumes symmetry); the golden cases use a centred one.
5. **No tyre.** The wheel's steer angle is not a slip angle.

---

## 6. Worked examples

Reference car. A = (259.9459, 78.9838) mm from module 2 §6.7; Tᵢ = (225.00, 26.00, 30.00);
Tₒ = (243.6802, 74.0415, 32.00); t = 172, l = 257.

### 6.1 Derived quantities

```
ρ  = |(−16.2657, −4.9423)| = 17.0000 mm
L  = √(18.6802² + 48.0415² + 2.00²) = √2661.94 = 51.5843 mm
r_p = √(51.5843² − 2.00²) = 51.5455 mm
```

### 6.2 Steer angles at 2 mm of rack travel

Rack +2 mm moves **both** inner ends toward +y: `Tᵢ' = (225, 28)` on the left and `(225, −24)` on the
right.

Left:

```
D = |A − Tᵢ'| = √(34.9459² + 50.9838²) = 61.8107
aa = (2656.94 − 289.00 + 3820.56)/123.6214 = 50.0601
hc = √(2656.94 − 2506.01) = 12.2851
ê = (0.56538, 0.82484),  p̂ = (−0.82484, 0.56538)
Tₒ' = (253.3025 − 10.1336, 69.2914 + 6.9457) = (243.1689, 76.2371)
ψ static = −163.0987°,  ψ new = −170.7017°
δ_left = −7.6032°
```

(the other branch gives (263.436, 62.346), 23 mm from the static point — rejected)

Right: `D = 65.1493, aa = 50.7478, hc = 9.0331`, `Tₒ' = (244.5974, −71.6748)`, `δ_right = −8.5627°`.

Both negative: at rack +2 the car turns **right**. The inner wheel is the right one:

```
δ_inner = 8.5627°,  δ_outer = 7.6032°
```

### 6.3 Ackermann

```
cot(7.6032°) = 7.4913,   cot(8.5627°) = 6.6409
Ackermann = 100 × (7.4913 − 6.6409)/(172/257) = 100 × 0.8504/0.66926 = 127.06 %
```

Now the same car with the steering arm rotated. **The construction is now defined**, which it was not
in round 1 (its table could not be reproduced by any of three plausible readings):

```
Tₒ(α) = A + R(α)·(Tₒ − A)         α positive = counter-clockwise in plan (toward +x for this arm)
α < 0 moves the arm rearward, α > 0 forward
the turnbuckle is re-set, so r_p = |Tₒ(α)_plan − Tᵢ_plan|   (the tie rod is one length and it fits)
branch: nearest the rotated Tₒ(α)
ρ is unchanged (rotation about A)
```

| α (°) | Tₒ (mm) | r_p (mm) | δ_left | δ_right | Ackermann |
|---|---|---|---|---|---|
| −10 | (243.069, 76.941) | 54.051 | −6.904 | −7.355 | 76.5 % |
| −5 | (243.311, 75.478) | 52.758 | −7.202 | −7.852 | 99.0 % |
| 0 | (243.680, 74.042) | 51.545 | −7.603 | −8.563 | 127.1 % |
| +5 | (244.173, 72.643) | 50.430 | −8.139 | −9.625 | 163.7 % |
| +10 | (244.786, 71.292) | 49.425 | −8.854 | −11.360 | 215.5 % |

So five degrees of arm rotation is worth **28 percentage points** at the rearward end and **37** at the
forward end — the relationship is strongly non-linear, which is why the arm shim exists and why
round 1's "5–7 pp/deg" was wrong at both ends of its own table. Holding `r_p` fixed instead of
re-deriving it (the reading that produced round 1's numbers) gives nonsense: the tie rod no longer
reaches the rotated arm, and at α = −5° the left wheel reports +2.4°.

### 6.4 Bump steer

`z_Tᵢ = 30.00 mm`, `z_Tₒ` from module 2's carrier transform (02 §6.9), `L = 51.5843 mm` throughout.
**τ is toe-in positive (4.12).**

| bump (mm) | z_Tₒ (mm) | r_p (mm) | ψ (°) | τ per wheel (°) | axle total (°) |
|---|---|---|---|---|---|
| −4 | 28.064 | 51.5479 | −163.109 | **+0.010** | +0.020 |
| −2 | 30.039 | 51.5842 | −163.265 | **+0.166** | +0.332 |
| −1 | 31.021 | 51.5741 | −163.222 | **+0.123** | +0.246 |
| 0 | 32.000 | 51.5455 | −163.099 | 0.000 | 0.000 |
| +1 | 32.975 | 51.4984 | −162.897 | **−0.202** | −0.404 |
| +2 | 33.948 | 51.4330 | −162.615 | **−0.484** | −0.968 |
| +4 | 35.882 | 51.2478 | −161.809 | **−1.290** | −2.580 |

Note the sign of the whole table against round 1's: the magnitudes are identical, the convention is
now module 1's. **In bump the wheels toe out**; in droop they toe in.

Bump-steer coefficient, (4.13). Central difference on the model's own 0.2 mm steps:
`τ(+0.2) = −0.03403°`, `τ(−0.2) = +0.03096°`, so

```
b = (−0.03403 − 0.03096)/0.4 = −0.1625 °/mm
```

and the chord over ±2 mm gives `(−0.484 − 0.166)/4 = −0.163 °/mm` — the two agree to 0.3 %.
**−0.16 °/mm**, i.e. about **0.65° of toe-out across ±2 mm** — a big number for a touring car, and
exactly what the app exists to surface.

Sensitivity to the tie rod's height, which is the design lever. The table re-zeroes τ at bump 0
because moving `z_Tᵢ` alone breaks the static consistency (§4's last row); the **re-zeroed** column is
the one a racer experiences:

| z_Tᵢ (mm) | τ(0) before re-zeroing (°) | τ(+2) − τ(0) (°) | coefficient (°/mm) |
|---|---|---|---|
| 26.00 | −1.349 | −1.178 | −0.502 |
| 28.00 | −0.501 | −0.822 | −0.328 |
| 30.00 | +0.000 | −0.484 | −0.1625 |
| 31.00 | +0.125 | −0.320 | −0.081 |
| 32.00 | +0.166 | −0.157 | +0.000 |
| 33.00 | +0.125 | +0.004 | +0.081 |
| 34.00 | +0.000 | +0.166 | +0.163 |

The coefficient column is the ±0.2 mm central difference (4.13) at **every** row, not `τ(+2)/2`:
at the ends of the table the two differ by up to 17 % (z_Tᵢ = 26.00: −0.502 against a chord of
−0.589), because τ is strongly curved there. Round 2's last two rows read −0.503 / +0.164, which were
last-digit slips in a column whose whole point is that it is reproducible.

The coefficient crosses zero at `z_Tᵢ = 32.00 mm` — exactly where the tie rod is horizontal in front
view. That is the model behaving as its equations say it must (§5.2), and it is *not* the published
criterion; the discrepancy is the module's main open question (`99-validation.md` §5.1).

### 6.5 Why the two components matter

The tie-rod outer ball's front-view velocity at static (from the carrier transform at ±0.5 mm):

```
dTₒ/dbump = (0.0547, 0.9771) mm per mm
û_yz = (−48.0415, −2.00)/48.0831 = (−0.99914, −0.04160)
û_yz · dTₒ/dbump = −0.05461 − 0.04065 = −0.09526
```

The two terms are 57 % and 43 % of the total. The model reproduces only the second (the vertical term,
through the plan-projection shortening); the first (lateral scrub along the tie rod) is invisible to a
constant-ρ plan construction. Since they are comparable, the magnitude is a coincidence of two partial
effects and the zero is in the wrong place. **Stated so that nobody "fixes" the number by adjusting a
coefficient.**

---

## 7. Golden test cases

| ID | Input | Expected | Origin |
|---|---|---|---|
| G04.1 | reference car, rack **+2.000 mm** (both ends) | δ_left = −7.603°, δ_right = −8.563° (car turns right) | hand calc §6.2 |
| G04.2 | reference car, rack +2.000 mm, `t = 172.0` contact-patch track | Ackermann = 127.06 % ± 0.2 | hand calc §6.3 |
| **G04.3** | steering arm α = −5° about A, r_p re-derived, rack +2 | δ = (−7.202, −7.852)°, Ackermann = 99.0 % ± 0.2 | hand calc §6.3 table |
| **G04.4** | reference car, z_Tᵢ = 30.00 mm | τ(−2) = **+0.166°**, τ(+2) = **−0.484°**, τ(+4) = **−1.290°** per wheel; axle total at +2 = −0.968° | hand calc §6.4 |
| **G04.5** | reference car, z_Tᵢ = 30.00 mm | bump-steer coefficient = **−0.1625 °/mm** ± 0.002 | hand calc §6.4 |
| G04.6 | z_Tᵢ moved to 32.00 mm | coefficient = +0.0000 °/mm ± 0.001 (zero crossing) | hand calc §6.4 |
| **G04.7** | rack +40 mm with `s_max = 8 mm` | `Undefined(outOfRackTravel)` — a **mechanical** limit, not `noIntersection` (which is unreachable on this car: the circles intersect at every rack position) | §3.6 |
| G04.8 | rack **+0.10 mm** | `\|δ_inner\| = 0.400° < 0.5°` → Ackermann not reported, `flags: [lowAngle]`; at +0.30 mm it is reported (`\|δ_inner\| = 1.209°`) | hand calc §3.3 |
| **G04.9** | `r_p(0)` inconsistent with the measured Tₒ by 0.1 mm | `Undefined(incompleteModel)` naming `tie_in`/`tie_out` | §4 |
| **G04.10** | reference car, bump +2 mm, tie-rod outer ball height taken from the **crank-angle** rule | τ(+2) = −0.430° instead of −0.484° — the case that pins the carrier transform | 02 §6.9, §6.4 |

Tolerance: 1e-3 ° on angles, 1e-3 °/mm on the coefficient.

**Origins:** every value is a hand calculation in §6 using (4.5)–(4.13). G04.6 is the most valuable of
the structural cases because it tests a *property* (the zero crossing) rather than arithmetic;
G04.10 is the one that would have caught round 1's undefined transform.

**Pinned choice, restated:** A is the steering axis's **ground** point (ρ = 17.000 mm), which
overstates ρ by 42 % against the working-height axis (§5.1). These cases are labelled L0 + L1, not L2,
partly for that reason.
