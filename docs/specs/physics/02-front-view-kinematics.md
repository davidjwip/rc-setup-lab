# 02 — Front-view kinematics

Build order: 2 of 9. Depends only on module 1.

This is the module the whole app is judged on. Everything a racer changes on the front end — camber
link length or position, arm shims, ride height, hub spacing — lands here, and this is where the
answer has to be both right and explainable.

---

## 1. Purpose

Given the hardpoints of one corner, compute, at any wheel position:

| Output | Symbol | Unit | Signed |
|---|---|---|---|
| Front-view instant centre | IC | mm (y, z) | global frame |
| Roll centre height | z_rc | mm | car |
| Roll centre lateral position | y_rc | mm | car |
| Camber change per mm of bump | κ | °/mm | **per wheel** |
| Camber change per degree of roll, body frame | — | °/° | **per wheel** |
| Camber change per degree of roll, road frame | — | °/° | **per wheel** |
| Kingpin inclination | KPI | ° | **per wheel** |
| Caster | — | ° | per wheel |
| Trail | — | mm | per wheel |
| Scrub radius | r_s | mm | **per wheel** |

Round 1 reported all of these in one frame and got the right-hand corner's signs wrong (§3.6). The
`Signed` column is now part of the contract: per-wheel quantities carry the side sign `s` (+1 left,
−1 right, module 1 §3.1), car-level quantities do not.

---

## 2. Inputs

| Input | Symbol | Unit | Range (1/10 TC) | Range (1/8 buggy) | Source |
|---|---|---|---|---|---|
| lower hinge axis point | Lᵢ | mm (y, z) | — | — | module 1 (`lca_in_a`, projected) |
| lower ball joint | Lₒ | mm (y, z) | — | — | module 1 |
| upper link inner | Uᵢ | mm (y, z) | — | — | module 1 |
| upper ball stud | Uₒ | mm (y, z) | — | — | module 1 |
| wheel centre | W | mm (y, z) | 80–90 | 100–115 | module 1 |
| contact-patch half-track | t/2 | mm | 86 | 110 | **derived** from `wc` (module 1 §6) |
| x of Lₒ, Uₒ, W | — | mm | — | — | module 1 (for caster/trail) |
| static camber | γ₀ | ° | −4 … +1 | −4 … +1 | setup |
| **modelled travel window** | — | mm | −6 … +6 | −30 … +30 | **derived** from the axle's droop/bump limits |

No physical constants are involved. Every number here is geometry or a user input.

The **travel window** is new in this revision and it is load-bearing: round 1 had no defined travel
range at all, only a numerical reach, so "bump = +50 mm" returned `outOfTravel` or `noIntersection`
depending on the order of two tests (G02.8 was not deterministic). The window comes from the model's
stored droop and bump limits and is checked **before** the solve.

All 2-D quantities are `(point.y, point.z)`; caster and trail additionally use `point.x`.

---

## 3. Model

### 3.1 The transverse-plane four-bar

Project the corner onto the **y–z plane**. The links become:

- a **crank** of length `a = |Lₒ − Lᵢ|` pivoting about Lᵢ;
- a **coupler** — the hub carrier — of length `d = |Uₒ − Lₒ|` between the two ball joints;
- a **rocker** of length `b = |Uₒ − Uᵢ|` pivoting about Uᵢ (single link) or about the upper hinge
  axis (A-arm; same 2D line).

One degree of freedom. Standard construction: Milliken & Milliken ch. 17, Dixon.

The model ignores the **projection error** of links that are not exactly transverse. The size of
that error is measured in §9; round 1's estimate of it was 10× too large.

### 3.2 Solving it

Parameterise by the crank angle θ (the angle of Lᵢ→Lₒ from +y):

```
Lₒ(θ) = Lᵢ + a·(cos θ, sin θ)                                    (2.1)
```

The upper ball stud is the intersection of two circles — radius `b` about Uᵢ, radius `d` about
Lₒ(θ):

```
D   = |Lₒ − Uᵢ|
aa  = (b² − d² + D²) / (2D)                                      (2.2)
hc  = √(b² − aa²)                                                (2.3)
ê   = (Lₒ − Uᵢ)/D,   p̂ = (−ê_z, ê_y)
Uₒ(θ) = Uᵢ + aa·ê ± hc·p̂                                         (2.4)
```

(The half-chord is `hc`; round 1 called it `h`, which is the CG height everywhere else.)

#### 3.2.1 Branch rule

**The branch is fixed at the static state** by "which solution reproduces the measured Uₒ", and every
later solve keeps it. Round 1 got this right for the happy path and wrong for three real cases:

- **`hc = 0`** (tangent circles): both branches coincide. Not an error — return the single solution.
- **Neither branch near the measured Uₒ** (residual above 0.5 mm): the carrier length `d` is
  inconsistent with `|Uₒ − Lₒ|`, i.e. a mis-typed hardpoint. Return `Undefined(incompleteModel)`
  naming `uca_out`/`lca_out`; do not pick "least bad" and continue.
- **The mirrored corner is a different parameterisation.** The mirror of the reference LF has
  `θ₀ = −174.05°` and branch sign −1 (the left's is −5.95° and +1), because mirroring reverses the
  sense in which the crank turns. The branch must be re-derived **after** mirroring; copying the
  left corner's branch sign makes every right-hand corner wrong.

#### 3.2.2 Bump inversion — prescribed bump, solved θ

`W(θ).z` is monotone in θ over the travel window, but **the direction differs by side**: for the
reference LF `dW.z/dθ = +48.7475 mm/rad`, and for its mirror `−48.7475`. An implementation whose
bracket test assumes increasing fails on every right-hand corner, which is the corner the default
mirror path produces.

```
1. if |bump| > travel window:  Undefined(outOfTravel)          ← checked first, always
2. scan θ ∈ [θ₀ − 0.6, θ₀ + 0.6] rad in 64 steps, record the sign of (W.z(θ) − target)
3. bisect the bracketing step for 40 iterations  (0.8/2⁴⁰ = 7e-13 rad)
4. if hc² < 0 anywhere in the scan:  Undefined(outOfTravel)    ← not noIntersection
5. if the scan finds no sign change: Undefined(outOfTravel)
6. if the scan finds two sign changes (non-monotone): the outer one is a branch-flipped
   configuration; return Undefined(ambiguousBranch) rather than choose
```

Two precedence rules matter and round 1 had neither: `noIntersection` is a **load-time** condition
only, and any failure during bump inversion is `outOfTravel`. Beyond ±1 rad on the reference car
`W.z` peaks at 73.9 mm and comes back down, so an expanding bracket can contain a second root and
converge to a flipped branch — which is exactly the bug §3.2.1 warns about, reintroduced by the
expansion rule. A fixed scan cannot do that.

The result of step 4–6 is also reported as `reachableTravel` so the UI can say what the range is
instead of only refusing.

#### 3.2.3 Rigid-carrier transform (new — closes B5)

The wheel centre is a rigid point on the carrier. **So is the tie-rod outer ball, and so is anything
else bolted to the knuckle.** Round 1 defined the transform for `wc` only (2.5)–(2.6), delegated the
offsets to module 1, module 1 delegated the formula back, and modules 4 and 5 needed it for points
that were never defined. The choice is not cosmetic: rotating by the carrier's own rotation
reproduces the toe table in module 4; rotating by the crank-angle change gives τ(+2) = 0.430°
instead of 0.484° — an 11 % error that looks entirely reasonable on a chart.

**The rule, for any point P rigidly attached to the carrier:**

```
Δ      = atan2(ê₁(θ)) − atan2(ê₁(θ₀))            carrier rotation, NOT θ − θ₀
P(θ)   = Lₒ(θ) + R(Δ)·(P₀ − Lₒ(θ₀))              R = 2×2 rotation by Δ
```

with `ê₁ = (Uₒ − Lₒ)/d` at the current and static states. Equivalently, and identically to (2.6):
store `(u, v) = ((P₀ − Lₒ)·ê₁, (P₀ − Lₒ)·ê₂)` once at load (module 1 §6.3) and evaluate
`P(θ) = Lₒ(θ) + u·ê₁(θ) + v·ê₂(θ)`. The two forms agree to machine precision; the second is what the
package implements, the first is what a reviewer can check by hand.

**The other rule, for points on the lower arm** (`damper_lo`, `arb_drop`):

```
P(θ) = Lᵢ + R(θ − θ₀)·(P₀ − Lᵢ)                  arm rotation, about the hinge point
```

That is the one place in the package where the crank angle *is* the arm rotation, and it is a
**different frame** from the carrier's. Using the carrier rule for `damper_lo` gives a damper length
wrong by several tenths of a millimetre; using the arm rule for `tie_out` gives the 11 % bump-steer
error above.

The MIRRORED corner uses the same two rules with its own `θ₀` and its own `ê₁`;
`Δ` is computed from the *current* axes, so no sign special-casing is needed.

### 3.3 Instant centre

The instantaneous centre of the carrier is the intersection of the two link lines, **evaluated at the
current link positions**:

```
line 1: through Lᵢ with direction (Lₒ(θ) − Lᵢ)
line 2: through Uᵢ with direction (Uₒ(θ) − Uᵢ)
IC = P₁ + ((P₂ − P₁)_y·d₂_z − (P₂ − P₁)_z·d₂_y)/den · d₁                  (2.7)
den = d₁_y·d₂_z − d₁_z·d₂_y
if |den| < kParallelTol·|d₁||d₂|:  Undefined(parallelLinks)              (2.8)
```

Using static hardpoints for a bumped state is a common shortcut and it is wrong: at ±5 mm the IC of
the reference car moves by hundreds of millimetres, which is the effect the racer is looking at.

### 3.4 Roll centre

**Symmetric car.** Line from the contact patch through the IC, both sides; the roll centre is where
that line crosses the centre plane:

```
z_rc = z_cp + (z_IC − z_cp)·(0 − y_cp)/(y_IC − y_cp)                     (2.9)
```

with `y_cp = t/2`, `z_cp = 0`.

**Asymmetric or rolled state.** The two sides no longer agree at y = 0, so the roll centre is the
intersection of both lines:

```
RC = line(y_cp,L → IC_L) ∩ line(y_cp,R → IC_R)                           (2.10)
```

Use (2.10) always — one code path — and note it makes `y_rc` meaningful. Definition used: the point
where the resultant of the two contact-patch lateral forces acts on the sprung mass (Milliken). It
is not "the point the body rotates about"; nothing rotates about it, which is why a low roll centre
does not reduce roll (module 6 §3.3).

**Parallel arms.** See §4.3: take the limit, do not return a hard zero, carry `parallelLinks`. For a
symmetric car `y_rc = 0` by symmetry; for an asymmetric one `y_rc` is `Undefined(parallelLinks)`
while `z_rc` remains defined. (Round 1's G02.7 asserted `z_rc = 0` and left `y_rc` undefined for any
car, including an inclined-parallel one where the limit is not zero.)

### 3.5 Roll centre migration

Roll the chassis by φ, hold the wheels on the road, re-solve both corners. Under module 1's
convention (φ > 0 = left side up):

```
bump_left  = −(t/2)·φ_rad                                                (2.11)
bump_right = +(t/2)·φ_rad
```

The left wheel droops and the right compresses when the left side rises — which is the left-hand
corner case, where the right wheel is the loaded outer wheel. Report `(y_rc, z_rc)` at φ = 0, ±1°,
±2°.

**Approximation, stated plainly.** This is a chassis-frame calculation: the contact patch is held at
its static lateral position and the wheel's own camber is ignored when locating it. The error in the
contact-patch lateral position is `R·sin γ ≈ 32 × 0.05 = 1.6 mm` at 3° of camber, ~1 % of track, and
it feeds the roll-centre height at about the same relative size. For φ ≤ 3° the migration is good to
a few tenths of a millimetre; beyond that, directional. A ground-frame formulation is the v2 upgrade.

### 3.6 Camber gain — per wheel

The carrier is rigid, so the wheel plane rotates exactly as much as the line Lₒ→Uₒ. **Per wheel,
with the side sign:**

```
γ_kp = s · atan2(Uₒ.y − Lₒ.y, Uₒ.z − Lₒ.z)    [°], positive = top outboard     (2.12)
```

`γ_kp` is the **kingpin-axis** angle, not the wheel's camber. Static camber is a setup input `γ₀` and
differs from it by the KPI plus the carrier's built-in offset. The *change* is what is physically
identical:

```
γ_b(z) = γ₀ + [γ_kp(z) − γ_kp(0)]                                              (2.13)
κ      = [γ_kp(+hc) − γ_kp(−hc)] / (2·hc)   [°/mm],  hc = 0.5 mm               (2.14)
```

**Why the `s`.** On the reference car the un-signed formula returns −8.0000° for the LF and
**+8.0000°** for the mirrored RF — the same physical camber. κ comes out −0.109816 °/mm on the left
and **+0.109816** on the right, so (2.16) then produced 1.165 °/° for the outer wheel instead of
0.835 °/°, a 40 % error on the corner that matters most, silently. With `s` in (2.12): γ_kp =
−8.0000° and κ = −0.109816 °/mm on **both** corners. G01.9 and G02.11 pin it.

**Per degree of roll.** With `z_bump = s·(t/2)·φ_rad` (s = −1 left, +1 right, matching (2.11)):

```
γ_road = γ_b(z_bump) + s·φ_rad                                          (2.15)
dγ_road/dφ [°/°] = s·( 1 + κ·(t/2)/57.2958 )                             (2.16)
```

κ is the per-wheel value, so `κ·(t/2)` is the same number on both sides and the `s` outside carries
the frame. The `+1` is the point: with no camber gain the outer wheel's road camber changes 1° per
degree of roll because it is bolted to a rolling body; the linkage can only subtract from that.

### 3.7 Kingpin axis: KPI, caster, trail, scrub radius — per wheel

The steering axis is the line Lₒ→Uₒ in 3D (it needs the x coordinates module 1 stores):

```
Δy/Δz = (Uₒ.y − Lₒ.y)/(Uₒ.z − Lₒ.z)
Δx/Δz = (Uₒ.x − Lₒ.x)/(Uₒ.z − Lₒ.z)
y_g = Lₒ.y − s·(Δy/Δz)·Lₒ.z                                             (2.17)
x_g = Lₒ.x − (Δx/Δz)·Lₒ.z                                               (2.18)
KPI    = s · atan(−Δy/Δz)     positive = top leans inboard  (per wheel)  (2.19)
caster = atan(−Δx/Δz)         positive = top leans rearward              (2.20)
trail  = x_g − x_cp           positive = axis meets the road ahead of the patch  (2.21)
scrub  = s·(y_cp − y_g)       positive = axis meets the road inboard     (2.22)
```

Caster and trail use x, which mirroring does not touch, so they need no side sign — that is why
module 1's original "unchanged" row was right for caster and trail and wrong for KPI and scrub.

KPI and caster are reported from the **static** state. They change with bump (that is what bump
steer is made of) but nobody quotes them at mid-stroke.

---

## 4. Degenerate cases

| Condition | Detection | Behaviour |
|---|---|---|
| Arm lines parallel | `\|den\| < kParallelTol·\|d₁\|\|d₂\|` | `Undefined(parallelLinks)` for the IC; roll centre by the limit (§4.3) |
| **Vertical parallel arms** (`\|d̂_y\| < 1e-6`) | limit expression divides by `d̂_y` | `Undefined(degenerateGeometry)` — `z_rc = −d̂_z·y_cp/d̂_y` would return ±∞ across a public API. A trailing-arm or swing-axle buggy hits this. Covered by G02.12. |
| Bump outside the travel window | checked before the solve | `Undefined(outOfTravel)` — deterministic |
| `hc² < 0` at load | (2.3) | `Undefined(noIntersection)` — an unbuildable model |
| `hc² < 0` during inversion | inside the scan | `Undefined(outOfTravel)` (§3.2.2) |
| Two roots in the scan window | non-monotone | `Undefined(ambiguousBranch)` |
| `Uₒ == Lₒ` | load time (module 1) | never reaches here |
| κ requested where one of ±0.5 mm is outside the window | travel check | κ is `Undefined(outOfTravel)`; the rest of the struct is unaffected |
| Wheel centre beyond the ball joints (`u ≤ 0`) | load-time plausibility | `lowConfidence` flag; the projection is still computed |

### 4.3 Parallel arms: the documented limit

When both arm lines are parallel, the IC is at infinity along the common direction `d̂`, and the line
from the contact patch to the IC degenerates to a line through the patch parallel to `d̂`:

```
z_rc = z_cp − d̂_z·y_cp/d̂_y                       (valid for |d̂_y| > 1e-6)
```

For **horizontal** parallel arms (`d̂_z = 0`) that gives `z_rc = 0`, the textbook answer.

Implementation: when `parallelLinks` fires, take `d̂` = direction of the lower arm, evaluate the
limit, and return `Defined(z_rc, flags: [parallelLinks])`. Do **not** return an error and do **not**
return a huge number — a 3 × 10⁴ mm "instant centre" is a real value of a badly conditioned
computation and must never reach a chart (module 1 §9's class of error).

---

## 5. Assumptions and where this breaks

1. **Planar links.** Everything is projected onto the transverse plane. A link raked 10° in plan has
   a 1.5 % shorter transverse projection; measured by scaling both links' y-extents by cos 10°, the
   IC moves from (−435.69, 60.51) to (−428.7, 60.52) — a **1.6 %** change in IC distance — and
   `z_rc` from 9.9749 to 10.1119 mm, a **1.4 %** change. Round 1 said "~15 % change in IC distance
   and ~1 % in roll-centre height"; both numbers were wrong (the 15 % was 10× too large and the 1 %
   was in the wrong place). Buggies with strongly swept arms exceed this, and the UI should still
   not claim more precision than §9 supports.
2. **Rigid chassis, rigid links.** Bushing compliance (pivot balls, plastic arms, rubber-sealed
   links) is not modelled, and on a 1/10 touring car it can be worth more camber change than the
   linkage itself at high lateral load. If the app disagrees with a setup station, this is the first
   suspect after measurement error.
3. **No bar or damper compliance in the kinematic path.** Correct: bars and dampers carry load, not
   position.
4. **The carrier is rigid and the wheel plane is parallel to the kingpin axis in the front view.**
   True for a machined hub carrier, approximately true for a moulded one.
5. **Migration is a chassis-frame calculation** (§3.5). Directional outside ±3°.
6. **Tyres are not springs here.** Contact-patch lateral position is taken as the wheel centre's;
   tyre lateral deflection (millimetres at 1 g) is ignored.
7. **Caster and KPI are static values**; their variation with bump is computed internally by module 4
   but not exposed.

---

## 6. Worked example

Reference car, left front corner, module 1 §8.2 (all mm):

```
Lᵢ = (30.00, 12.00)     Lₒ = (78.00, 7.00)
Uᵢ = (42.00, 45.00)     Uₒ = (72.80, 44.00)
W  = (86.00, 32.00)     contact patch (86.00, 0)
```

Lengths (module 1 §8.3): a = 48.2597, b = 30.8162, d = 37.3636. Static crank angle
θ₀ = atan2(−5, 48) = −5.94686°, branch +1.

### 6.1 Instant centre

```
m₁ = (7 − 12)/(78 − 30) = −5/48 = −0.1041670
m₂ = (44 − 45)/(72.8 − 42) = −1/30.8 = −0.0324675
12 − 0.1041670(y − 30) = 45 − 0.0324675(y − 42)
y_IC = −435.691 mm
z_IC = 12 − 0.1041670×(−435.691 − 30) = 60.509 mm
```

**IC = (−435.691, 60.509) mm** — 521.7 mm inboard of the contact patch and 60.5 mm above the road.

The two lines converge **inboard**: going outboard they diverge, so the IC lands on the far side of
the car. (Round 1's prose said "converge outboard", which is the opposite of what its own slopes
show, and it matters: it is why the IC is 526 mm away and why migration is large.)

### 6.2 Roll centre

```
m = 60.509/(−435.691 − 86) = −0.1159872
z_rc = 0 + (−0.1159872)(0 − 86) = 9.9749 mm
```

**Roll centre height 9.97 mm**, on the centreline by symmetry.

### 6.3 Camber gain per mm

At ±0.5 mm of bump, bisect (2.1)–(2.6) for `W.z = 32.5` and `31.5`, then (2.12):

```
bump = +0.5 mm:  θ = −5.359806°,  Lₒ = (78.04871, 7.49207),  γ_kp = −8.056900°
bump = −0.5 mm:  θ = −6.535190°,  Lₒ = (77.94613, 6.50740),  γ_kp = −7.947084°
κ = (−8.056900 − (−7.947084))/(2 × 0.5) = −0.109816 °/mm
```

κ < 0 means that as the wheel rises, its top leans inboard: the suspension gains negative camber in
bump. Same value on the mirrored corner after (2.12) is applied with `s = −1`.

### 6.4 Camber at +2 mm, in full

Bisection gives θ = −3.605500°:

```
cos(−3.605500°) = 0.9980194,  sin(−3.605500°) = −0.0628971
Lₒ.y = 30.00 + 48.2597×0.9980194 = 78.1641
Lₒ.z = 12.00 + 48.2597×(−0.0628971) = 8.9646
```

The solver reports Lₒ = (78.1642, 8.9651); the 0.0005 mm gap is the 6-decimal θ. Circle intersection
for Uₒ (Uᵢ = (42, 45), b = 30.8162, d = 37.3636):

```
Δ = Lₒ − Uᵢ = (36.1641, −36.0349),  D = 51.0525
aa = (949.638 − 1396.040 + 2606.358)/(2×51.0525) = 21.1543
hc = √(949.638 − 447.505) = 22.4083
ê  = (0.708369, −0.705842),  p̂ = (0.705842, 0.708369)
Uₒ = (56.985 + 15.817, 30.068 + 15.873) = (72.802, 45.941)
```

matching the solver's (72.8018, 45.9419) — the branch that reproduces the static Uₒ. Then

```
γ_kp = atan2(72.8018 − 78.1642, 45.9419 − 8.9651) = atan2(−5.3624, 36.9768) = −8.2515°
Δγ at +2 mm = −0.2515°   (against κ×2 = −0.2196°)
```

The difference is the curvature of the camber curve: κ is a derivative, the app plots the secant.
A test asserting `Δγ(+2) == 2κ` would assert a falsehood — do not write one.

### 6.5 Per degree of roll

Outer wheel (right side, `s = +1`):

```
κ·(t/2)/57.2958 = −0.109816 × 86/57.2958 = −0.1648 °/°
dγ_road/dφ = 1 + (−0.1648) = +0.8352 °/°
```

For every degree the body rolls, the outer front wheel loses 0.84° of camber relative to the road,
and the linkage recovers only 16 % of the 1° that body roll alone imposes. Body-frame version:
−0.1648 °/°.

### 6.6 Roll centre migration

With t = 172 mm, (2.11) at φ = +1° gives bump_ℓ = −1.5009 mm and bump_r = +1.5009 mm. Re-solving
each corner separately:

```
left  at bump −1.5009:  IC = (−585.4153,  95.3948)   γ_kp = −7.853°
right at bump +1.5009:  IC = (+342.4797,  39.2751)   γ_kp = +8.183°  (global frame, s = −1)
m_L = 95.3948/(−585.4153 − 86) = −0.142080
m_R = 39.2751/(342.4797 + 86) = +0.091662
y_rc = 86·(m_L + m_R)/(m_L − m_R) = 18.5500 mm
z_rc = m_L·(18.5500 − 86) = 9.5833 mm
```

**RC at φ = +1°: (y, z) = (+18.550, 9.583) mm.**

| φ (°) | left IC (mm) | right IC (mm) | y_rc (mm) | z_rc (mm) |
|---|---|---|---|---|
| −2.0 | (−278.2, 25.1) | (871.0, 162.8) | −36.37 | 8.442 |
| −1.0 | (−342.5, 39.3) | (585.4, 95.4) | −18.55 | 9.583 |
| 0.0 | (−435.7, 60.5) | (435.7, 60.5) | 0.00 | 9.975 |
| +1.0 | (−585.4, 95.4) | (342.5, 39.3) | +18.55 | 9.583 |
| +2.0 | (−871.0, 162.8) | (278.2, 25.1) | +36.37 | 8.442 |

**Bumped, not rolled** — the same two-sided solve covers kerbs:

| state | left IC (mm) | right IC (mm) | y_rc (mm) | z_rc (mm) |
|---|---|---|---|---|
| static | (−435.7, 60.5) | (435.7, 60.5) | 0.00 | 9.975 |
| heave: both +3 mm | (−278.3, 25.1) | (278.3, 25.1) | 0.00 | **5.936** |
| left +3 mm only | (−278.3, 25.1) | (435.7, 60.5) | −21.83 | 7.443 |
| left −3 mm only | (−870.5, 162.7) | (435.7, 60.5) | +16.26 | 11.861 |

Two results worth showing:

- **A pure heave drops the roll-centre height by 4 mm** (9.975 → 5.936), with no lateral shift: it
  moves 40 % over 3 mm of bump. Any statement of the form "my car's roll centre is X" is a statement
  about one ride height.
- **A single-wheel bump moves it 22 mm sideways** and drops it 2.5 mm. On a kerb the car does not
  have one roll centre.

Small heaves, for the module-10 cross-reference: +0.5 mm of heave gives z_rc = 9.2617 mm and −0.5 mm
(droop) gives 10.7049 mm, a local slope of about −1.43 mm/mm — which is why a 0.5 mm thicker chassis
plate, if it raises the car, moves the roll centre 0.73 mm without changing a single hardpoint.

At φ > 0 (left up, a left-hand corner) the roll centre migrates toward **+y, the inside of the
corner**. Whether that helps or hurts is not something this model can say; it is reported, not
interpreted.

### 6.7 Kingpin axis quantities

```
Δy/Δz = −5.20/37.00 = −0.140541        Δx/Δz = −5.00/37.00 = −0.135135
y_g = 78.00 − (−0.140541)(7.00) = 78.9838 mm
x_g = 259.00 − (−0.135135)(7.00) = 259.9459 mm
KPI    = atan(0.140541) = 8.0000°      caster = atan(0.135135) = 7.6961°
trail  = 259.9459 − 257.00 = 2.9459 mm
scrub  = 86.00 − 78.9838  = 7.0162 mm
```

Sane for a touring car: 8° KPI, 7.7° caster, 3 mm positive trail, 7 mm positive scrub. On the
mirrored corner the same four numbers come out of (2.17)–(2.22) **positive**, which is the test
G01.9 asserts; without the `s` they come out +8.0000 KPI's negation, −8.0000, and −7.0162.

### 6.8 The buggy corner, same code

```
a = 64.560, b = 48.662, d = 48.662
IC = (−281.391, 131.565) mm
z_rc = 131.565 × 110/(110 + 281.391) = 36.976 mm
κ = −0.14639 °/mm
KPI = 9.4623°
dγ_road/dφ = 1 + (−0.14639 × 110/57.2958) = 0.7189 °/°
```

33 % more camber gain and a roll centre 37 mm above the road instead of 10. The outer wheel loses
*less* camber per degree of roll (0.719 against 0.835) — the product of 33 % more camber gain and
28 % more half-track (1.33 × 1.28 = 1.70 against 0.2811/0.1648 = 1.71).

### 6.9 The carrier transform, worked (new)

Take the tie-rod outer ball, `tie_out = (74.04, 32.00)` mm in (y, z). Its static carrier-frame
coordinates (module 1 §8.3) are `(u, v) = (25.3078, 0.4421)`.

At bump +2 mm the carrier's axis has rotated by `Δ = +0.252°` (from `atan2(ê₁(θ)) − atan2(ê₁(θ₀))`,
where θ(2 mm) = −3.605500°), so

```
tie_out(θ) = Lₒ(θ) + u·ê₁(θ) + v·ê₂(θ) = (74.0543, 33.948)
```

The number that matters for module 4 is the height:

| bump (mm) | `z_Tₒ` carrier rule (mm) | `z_Tₒ` crank-angle rule (mm) | Δ (mm) |
|---|---|---|---|
| −2 | 30.039 | 30.168 | −0.129 |
| 0 | 32.000 | 32.000 | 0 |
| +1 | 32.975 | 32.897 | +0.078 |
| +2 | **33.948** | 33.782 | +0.165 |
| +4 | 35.882 | 35.517 | +0.365 |

The crank-angle rule is wrong by 0.17 mm at +2 mm of bump, which through module 4's ρ = 17 mm lever
is 0.05° of toe — an 11 % error on a 0.48° signal. Both rules are "a rigid carrier"; only one is
right, and the document now says which. G02.13 asserts the table.

---

## 7. What this module implies (for the teaching copy in the app)

- On a touring car the front-view linkage recovers ~16 % of the camber change body roll imposes.
  Static camber does the work; the link trims.
- The roll centre's height barely changes with roll; its **lateral position** changes a lot when the
  IC is far away. A single "roll centre height" number hides the thing that moves.
- Camber gain is a derivative. The 0→+5 mm secant on this car is −0.149 °/mm, **36 % larger in
  magnitude** than the reported derivative, and the droop-side secant is −0.068 (a third of it): the
  curve is strongly asymmetric. A chart drawn from the secant and a headline drawn from the
  derivative will disagree, deliberately. (Round 1 said 15 % for the ±5 mm secant; that figure was
  the one-sided 0→+2 mm value.)

---

## 8. Golden test cases

All at static ride height unless stated. Reference car from module 1 §8.2.

| ID | Input | Expected | Origin |
|---|---|---|---|
| G02.1 | reference LF, static | IC = (−435.691, 60.509) mm; z_rc = 9.9749 mm; y_rc = 0.0 mm | hand calc §6.1–6.2 |
| G02.2 | reference LF, bump ±0.5 mm | κ = −0.109816 °/mm ±1e-5 | hand calc §6.3 |
| G02.3 | reference LF, bump +2.000 mm | γ_kp = −8.2515°; Uₒ = (72.8018, 45.9419); W = (86.0544, 34.0000) | hand calc §6.4 |
| G02.4 | reference car, φ = +1.000° | y_rc = +18.5500 mm, z_rc = 9.5833 mm (±0.02) | solver table §6.6, ICs quoted to 4 dp |
| G02.5 | reference LF, static | body −0.1648 °/°; road +0.8352 °/° | hand calc §6.5 |
| G02.6 | reference LF, static | KPI +8.0000°, caster 7.6961°, trail 2.9459 mm, scrub +7.0162 mm | hand calc §6.7 |
| G02.7 | both arm lines horizontal and parallel | `flags ∋ parallelLinks`; z_rc = 0.0 mm; y_rc = 0.0 (symmetric); no NaN | §4.3 |
| G02.8 | reference LF, bump +50 mm | `Undefined(outOfTravel)`; and bump +7 mm likewise (TC window ±6) | §3.2.2 — deterministic |
| G02.9 | buggy corner, static | IC = (−281.391, 131.565); z_rc = 36.976; κ = −0.14639 °/mm | hand calc §6.8 |
| G02.10 | reference car, heave +3.000 mm | y_rc = 0.000, z_rc = 5.936 mm | hand calc §6.6 |
| **G02.11** | **mirrored RF corner**, static and ±0.5 mm | γ_kp = −8.0000° (per wheel); κ = −0.109816 °/mm (per wheel); the same quantities in the **global** frame are +8.0000° and +0.109816; z_rc = 9.9749; KPI and scrub as G02.6 | hand calc §3.6, §6.7; verified κ_global(RF) = +0.109816 |
| **G02.12** | **vertical parallel arms** (both link directions `(0, ±)`), symmetric car | `Undefined(degenerateGeometry)`, no ±∞ | §4 table |
| **G02.13** | **carrier transform**, tie_out at bump −2…+4 | z_Tₒ = 30.039 / 32.000 / 32.975 / **33.948** / 35.882; branch Δ = +0.252° at +2 mm | hand calc §6.9 |
| **G02.14** | reference LF, bump +2 mm but with `d` inconsistent by 0.6 mm (mis-typed `uca_out`) | `Undefined(incompleteModel)`, not a least-bad branch | §3.2.1 |

Tolerances: 1e-3 mm, 1e-4 °, 1e-4 on ratios.

**Where these values come from:** every one is arithmetic printed in §6, except G02.4 which is a
solver table with its ICs quoted to 4 dp (round 1 asserted ±0.002 on a value whose cited hand
calculation gave 18.530 — the origin chain, not the number, was broken). G02.11, G02.12, G02.13 and
G02.14 exist because round 1's suite could not fail on a sign, a degeneracy, a frame choice or a
branch choice respectively.

---

## 9. Sensitivity (feeds 99-validation.md §2.1 and §7)

Perturbing one hardpoint and re-solving **with the wheel held on the road** (the perturbation is in
the geometry, not in the ride height):

| Perturbation | Δz_rc (mm) | per mm | Δκ |
|---|---|---|---|
| Lₒ.z +0.1 mm | **−0.1869** | −1.87 | −2.60 % |
| Lₒ.z +0.2 mm | −0.3749 | −1.87 | −5.22 % |
| Lₒ.z +0.5 mm | −0.9463 | −1.89 | −13.18 % |
| Lₒ.z +1.0 mm | −1.9230 | −1.92 | −26.78 % |
| Lₒ.y +0.1 mm | −0.0194 | −0.194 | −0.27 % |

Round 1's table said **+0.0165 mm** for the first row, "6 % of the perturbation", and concluded
roll-centre height was "not hypersensitive (0.16 mm per mm of error)". The true figure is
**11× larger and the opposite sign**. Round 2's full Jacobian at +0.1 mm on each coordinate:

| Coordinate | Δz_rc (mm) | per mm | Δκ |
|---|---|---|---|
| Lₒ.y | −0.0194 | −0.19 | −0.27 % |
| Lₒ.z | **−0.1869** | **−1.87** | **−2.60 %** |
| Uₒ.y | +0.0014 | +0.01 | +0.13 % |
| Uₒ.z | +0.0420 | +0.42 | +4.13 % |
| Uᵢ.y | −0.0015 | −0.01 | −0.14 % |
| Uᵢ.z | −0.0449 | −0.45 | **−4.42 %** |

and the one the app will be asked about daily: **a 1.0 mm shim at the camber-link inner point**,
`Uᵢ.z +1.0` → **Δz_rc = −0.4539 mm** (and `Uᵢ.y +1.0`, lengthening the link, → −0.0151 mm). So
**a 0.5 mm error in the lower ball joint's height moves the roll centre twice as far as the 1 mm
shim the user came to evaluate.** That is a finding, not a bug, and it is why:

- roll-centre height is displayed to **0.5 mm with a stated ±1 mm band**, never to 0.1 mm
  (`99-validation.md` §7). The honest claim is "about 10 mm, ±1 mm";
- κ is displayed to 0.01 °/mm, which is 9 % of 0.11 — the limit of what a ±0.2 mm session supports,
  and the reason κ carries a ±10 % band;
- the UI shows a **direction plus a band** for shim changes, and never a bare two-decimal delta.

**κ is the more sensitive quantity per unit of *link* error.** It moves 4.4 % per 0.1 mm on `Uᵢ.z`
against 2.6 % on `Lₒ.z`, because it is the angle of a short link seen from far away.

Any display precision not derived from this table is in `99-validation.md` §7, which is the single
home for the precision policy. This section no longer states a second one.
