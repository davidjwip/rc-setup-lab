# 02 — Front-view kinematics

Build order: 2 of 9. Depends only on module 1.

This is the module the whole app is judged on. Everything a racer changes on the front end — camber
link length or position, arm shims, ride height, hub spacing — lands here, and this is where the
answer has to be both right and explainable.

---

## 1. Purpose

Given the hardpoints of one corner, compute, at any wheel position:

| Output | Symbol | Unit |
|---|---|---|
| Front-view instant centre | IC | mm (y, z) |
| Instant-centre lateral distance from the contact patch | — | mm |
| Roll centre height | z_rc | mm |
| Roll centre lateral position | y_rc | mm |
| Camber change per mm of bump | κ | °/mm |
| Camber change per degree of roll, body frame | — | °/° |
| Camber change per degree of roll, road frame | — | °/° |
| Kingpin inclination | KPI | ° |
| Caster | — | ° |
| Trail | — | mm |
| Scrub radius | r_s | mm |

---

## 2. Inputs

| Input | Symbol | Unit | Range (1/10 TC) | Range (1/8 buggy) | Source |
|---|---|---|---|---|---|
| lower hinge axis point | Lᵢ | mm (y, z) | — | — | module 1 |
| lower ball joint | Lₒ | mm (y, z) | — | — | module 1 |
| upper link inner | Uᵢ | mm (y, z) | — | — | module 1 |
| upper ball stud | Uₒ | mm (y, z) | — | — | module 1 |
| wheel centre | W | mm (y, z) | 80–90 | 100–115 | module 1 |
| contact-patch half-track | t/2 | mm | 86 | 110 | derived from W.y |
| x of Lₒ, Uₒ, W | — | mm | — | — | module 1 (for caster/trail) |
| static camber | γ₀ | ° | −4 … +1 | −4 … +1 | setup |
| bump range | z | mm | −6 … +6 | −30 … +30 | setup |

No physical constants are involved. Every number here is geometry or a user input. That is why this
module can be trusted more than modules 3, 6 and 7.

---

## 3. Model

### 3.1 The transverse-plane four-bar

Project the corner onto the **y–z plane** (the plane normal to x). The links become:

- a **crank** of length `a = |Lₒ − Lᵢ|` pivoting about Lᵢ;
- a **coupler** — the hub carrier — of length `d = |Uₒ − Lₒ|` between the two ball joints;
- a **rocker** of length `b = |Uₒ − Uᵢ|` pivoting about Uᵢ (single link) or about the upper hinge
  axis (A-arm; same 2D line).

One degree of freedom. This is the standard construction in Milliken & Milliken, *Race Car Vehicle
Dynamics*, ch. 17 ("suspension kinematics"), and in Dixon, *Suspension Geometry and Computation*.

The model deliberately **ignores the projection error** of links that are not exactly transverse:
a link raked 5° in plan has a 0.4% shorter transverse projection, which moves the instant centre
by a few percent when it is far away. §5 covers when this matters.

### 3.2 Solving it

Parameterise by the crank angle θ (the angle of Lᵢ→Lₒ from +y):

```
Lₒ(θ) = Lᵢ + a·(cos θ, sin θ)                                    (2.1)
```

The upper ball stud is the intersection of two circles — one of radius `b` about Uᵢ, one of radius
`d` about Lₒ(θ):

```
D   = |Lₒ − Uᵢ|
aa  = (b² − d² + D²) / (2D)                                      (2.2)
h   = √(b² − aa²)                                                (2.3)
ê   = (Lₒ − Uᵢ)/D,   p̂ = (−ê_z, ê_y)
Uₒ(θ) = Uᵢ + aa·ê ± h·p̂                                          (2.4)
```

Two branches. **The branch is fixed at the static state** by "which solution reproduces the measured
Uₒ", and every later solve keeps that branch. Switching branches mid-stroke is the classic
implementation bug that makes a camber curve jump; the fix is to store the branch sign in the
corner object at construction and never re-derive it.

The wheel centre is a rigid point on the carrier, so it follows from the carrier's current
direction:

```
ê₁ = (Uₒ − Lₒ)/d,   ê₂ = (−ê₁_z, ê₁_y)                           (2.5)
W(θ) = Lₒ + u·ê₁ + v·ê₂                                          (2.6)
```

where `(u, v)` are the components of `W − Lₒ` in the static frame `(ê₁, ê₂)` — computed once, at
load, by module 1's derived quantities.

**Bump is prescribed, θ is what we solve for.** `W(θ).z` increases monotonically with θ over the
useful travel, so `bump = W.z(θ) − W.z(θ₀)` is inverted by bisection on `[θ₀ − 0.4, θ₀ + 0.4] rad`,
expanding the bracket until it contains a sign change. 60 iterations is overkill; 40 gives
1 × 10⁻¹² rad. Failure to bracket means the linkage cannot reach that bump: return
`Undefined(outOfTravel)`.

> Why bisection and not Newton: the derivative is well-behaved but the bracket test gives the
> `outOfTravel` answer for free, and 40 bisections of an expression this cheap is faster than a
> robust Newton with a line search. The cost is irrelevant (microseconds).

### 3.3 Instant centre

The instantaneous centre of the carrier is the intersection of the two link lines, **evaluated at
the current link positions**, not at the static ones:

```
line 1: through Lᵢ with direction (Lₒ(θ) − Lᵢ)
line 2: through Uᵢ with direction (Uₒ(θ) − Uᵢ)
IC = intersection                                                    (2.7)
```

With `P₁ + s·d₁ = P₂ + r·d₂`:

```
den = d₁_y·d₂_z − d₁_z·d₂_y
if |den| < ε_parallel:  → Undefined(parallelLinks)   (see §4.3)
IC = P₁ + ((P₂ − P₁)_y·d₂_z − (P₂ − P₁)_z·d₂_y)/den · d₁             (2.8)
```

Using static hardpoints for a bumped state is a common shortcut and it is wrong: at ±5 mm of travel
the IC of the reference car moves by hundreds of millimetres, which is precisely the effect the
racer is trying to see.

### 3.4 Roll centre

**Symmetric car (the normal case).** Draw a line from the contact patch through the IC, on each
side. The roll centre is where that line crosses the vehicle centre plane:

```
z_rc = z_cp + (z_IC − z_cp)·(0 − y_cp)/(y_IC − y_cp)                 (2.9)
```

with `y_cp = t/2`, `z_cp = 0`.

**Asymmetric car, or any rolled/bumped state.** The two sides no longer give the same height at
y = 0, so the roll centre is the **intersection of the two lines**:

```
RC = line(y_cp,L → IC_L) ∩ line(y_cp,R → IC_R)                       (2.10)
```

and `y_rc` — the lateral position — is meaningful. In a symmetric car (2.10) reduces to (2.9) with
y_rc = 0, and the implementation should use (2.10) always so there is one code path.

Note the definition being used: the roll centre is the point where the *resultant of the two
contact-patch lateral forces* acts on the sprung mass. That is the definition Milliken uses and the
one that makes migration meaningful. It is not "the point the body rotates about" — nothing rotates
about it — which is why the phrase "roll centre" misleads people into thinking a low roll centre
magically reduces roll. It does not; it changes the *moment arm* (module 6).

### 3.5 Roll centre migration

Roll the chassis by φ, hold the wheels on the road, and re-solve both corners. Under the sign
convention of module 1 (φ > 0 = left side up):

```
bump_left  = −(t/2)·φ_rad                                            (2.11)
bump_right = +(t/2)·φ_rad
```

The left wheel droops and the right compresses when the left side rises — which is the left-hand
corner case, where the right wheel is the loaded outer wheel.

Then recompute (2.7)–(2.10) for both corners with those bumps and take the intersection. Report
`(y_rc, z_rc)` at φ = 0, ±1°, ±2° so the UI can draw a migration line.

**Approximation, stated plainly:** this is a chassis-frame calculation. The contact patch is taken
at its static lateral position (±t/2) and the wheel's own camber is ignored when locating it. The
error in the contact-patch lateral position is `r_tyre·sin γ ≈ 32 × 0.05 = 1.6 mm` at 3° of camber,
i.e. about 1% of track, and it feeds into the roll-centre height at roughly the same relative size.
For φ ≤ 3° the reported migration is good to a few tenths of a millimetre; beyond that, treat the
number as directional. A ground-frame formulation (rotate the hardpoints, keep the road fixed,
solve for the wheel position that puts the contact patch on z = 0) removes the approximation and
is the v2 upgrade.

### 3.6 Camber gain

The carrier is rigid, so the wheel plane rotates exactly as much as the line Lₒ→Uₒ. Define

```
γ_kp = atan2(Uₒ.y − Lₒ.y, Uₒ.z − Lₒ.z)     [deg], positive = top outboard    (2.12)
```

`γ_kp` is the **kingpin-axis** angle, not the wheel's camber. The wheel's static camber is a setup
input (γ₀) and differs from it by the KPI plus the carrier's built-in camber offset. What is
physically identical is the *change*:

```
γ_b(z) = γ₀ + [γ_kp(z) − γ_kp(0)]                                    (2.13)
```

Camber gain, by central difference with step `h = 0.5 mm`:

```
κ = [γ_kp(+h) − γ_kp(−h)] / (2h)     [°/mm]                          (2.14)
```

Central difference at ±0.5 mm reproduces the analytic derivative to 5 significant figures for this
linkage and is far easier to get right than differentiating (2.4) by hand. Report κ at the static
ride height, and optionally at ±half travel for the UI's "camber gain is not constant" note.

**Per degree of roll.** With `z_bump = s·(t/2)·φ_rad`, where `s = −1` for the left wheel and
`s = +1` for the right (matching (2.11)), and remembering that the road does not rotate with the
body:

```
γ_road = γ_b(z_bump) + s·φ_rad                                       (2.15)
dγ_road/dφ [°/°] = s·( 1 + κ·(t/2)/57.2958 )                          (2.16)
```

The `+1` is the whole point: on a car with **no** camber gain the outer wheel's camber relative to
the road changes 1° per degree of roll, because the wheel is bolted to a body that is rolling. The
linkage can only *subtract* from that. Equation (2.16) says how much it manages.

### 3.7 Kingpin axis: KPI, caster, trail, scrub radius

The steering axis is the line Lₒ→Uₒ in 3D (it needs the x coordinates module 1 stores). Its ground
intersection:

```
Δy/Δz = (Uₒ.y − Lₒ.y)/(Uₒ.z − Lₒ.z)
Δx/Δz = (Uₒ.x − Lₒ.x)/(Uₒ.z − Lₒ.z)
y_g = Lₒ.y − (Δy/Δz)·Lₒ.z                                            (2.17)
x_g = Lₒ.x − (Δx/Δz)·Lₒ.z                                            (2.18)
```

then

```
KPI    = atan(−Δy/Δz)          positive when the top leans inboard          (2.19)
caster = atan(−Δx/Δz)          positive when the top leans rearward         (2.20)
trail  = x_g − x_cp            positive when the axis meets the road ahead of the contact patch (2.21)
scrub  = y_cp − y_g            positive when the axis meets the road inboard of the contact patch (2.22)
```

Both KPI and caster are reported from the **static** state. They change with bump (that is what
bump steer is made of, module 4) but nobody quotes them at mid-stroke, and quoting a changing
caster angle invites the reader to believe it is more precise than the measurement behind it.

---

## 4. Degenerate cases

| Condition | Detection | Behaviour |
|---|---|---|
| Arm lines parallel | `\|den\| < 1e-9·\|d₁\|\|d₂\|` | `Undefined(parallelLinks)` for the IC; roll centre by the limit (§4.3) |
| Bump outside reachable travel | bisection bracket fails | `Undefined(outOfTravel)` |
| Circle intersection impossible (`h²` < 0) | during (2.3) | `Undefined(noIntersection)` — geometry inconsistent, usually a mis-typed hardpoint |
| `Uₒ == Lₒ` | caught at load (module 1) | never reaches here |
| Wheel centre beyond the ball joints (`u ≤ 0`) | load-time plausibility check | warning; the projection is still computed |

### 4.3 Parallel arms: the documented limit

When both arm lines are parallel, the instant centre is at infinity along the common direction `d̂`.
The line from the contact patch to the IC degenerates to a line through the contact patch parallel
to `d̂`. So:

```
line: through (y_cp, z_cp) with direction d̂ = (d̂_y, d̂_z)
z_rc = z_cp − d̂_z·y_cp/d̂_y            (valid for |d̂_y| > tol; with z_cp = 0: z_rc = −d̂_z·y_cp/d̂_y)
```

and in the special case of **horizontal** parallel arms (`d̂_z = 0`) the line is along the ground,
so `z_rc = 0` — the textbook answer for a swing-axle-free parallel-arm car.

Implementation: when `parallelLinks` fires, take `d̂ = ` direction of the lower arm, compute
`z_rc` from the limit expression, and return `Ok(value, flags: [parallelLinks])` so the UI can say
"parallel links: roll centre at ground level". Do **not** return an error, and do **not** return a
huge number — a 3 × 10⁴ mm "instant centre" is a real value of a badly-conditioned computation and
must never reach a chart.

---

## 5. Assumptions and where this breaks

1. **Planar links.** Everything is projected onto the transverse plane. A link raked 10° in plan
   has a 1.5% shorter transverse projection; with the reference car's far-away IC that is a ~15%
   change in IC distance and a ~1% change in roll-centre height. Buggies with strongly swept arms
   exceed this. This is the largest single modelling error in the module and it is not visible to
   the user, so the UI should not present roll-centre height to 0.1 mm precision — one decimal,
   never two.
2. **Rigid chassis, rigid links.** Bushing compliance (pivot balls, plastic arms, rubber-sealed
   links) is not modelled. On a 1/10 touring car this can be worth more camber change than the
   linkage itself at high lateral load. If the app ever disagrees with a setup station, this is
   the first suspect after measurement error.
3. **No anti-roll bar or damper compliance in the kinematic path.** Correct: bars and dampers
   carry load, not position.
4. **The carrier is rigid and the wheel plane is parallel to the kingpin axis in the front view.**
   True for a machined aluminium hub carrier, approximately true for a moulded one.
5. **Roll centre migration is a chassis-frame calculation** (§3.5). Directional outside ±3° of roll.
6. **Tyres are not springs here.** Contact-patch lateral position is taken as the wheel centre's;
   tyre lateral deflection (several millimetres at 1 g) is ignored. It belongs in module 8, which
   does not exist in v1.
7. **Caster and KPI are static values.** Their variation with bump is real and is computed
   internally by module 4 for bump steer, but not exposed.

---

## 6. Worked example

Reference car, left front corner, from module 1 §8.2 (all mm).

```
Lᵢ = (30.00, 12.00)     Lₒ = (78.00, 7.00)
Uᵢ = (42.00, 45.00)     Uₒ = (72.80, 44.00)
W  = (86.00, 32.00)     contact patch (86.00, 0)
```

Lengths (module 1 §8.3): a = 48.2597, b = 30.8162, d = 37.3636.

### 6.1 Instant centre

Lower line: from (30, 12) to (78, 7). Slope

```
m₁ = (7 − 12)/(78 − 30) = −5/48 = −0.1041670
```

Upper line: from (42, 45) to (72.8, 44). Slope

```
m₂ = (44 − 45)/(72.8 − 42) = −1/30.8 = −0.0324675
```

Equate the two line equations `z = 12 + m₁(y − 30)` and `z = 45 + m₂(y − 42)`:

```
12 − 0.1041670(y − 30) = 45 − 0.0324675(y − 42)
12 − 0.1041670y + 3.12501 = 45 − 0.0324675y + 1.36364
15.12501 − 0.1041670y = 46.36364 − 0.0324675y
−31.23863 = 0.0716995y
y_IC = −435.691 mm
z_IC = 12 − 0.1041670×(−435.691 − 30) = 12 + 48.509 = 60.509 mm
```

**IC = (−435.691, 60.509) mm.** It is 521.7 mm inboard of the contact patch and 60.5 mm above the
road. Sanity check: the upper link is shorter than the lower but the lines still converge outboard,
which is what a touring car looks like — its IC sits far outboard of the opposite side of the car
and slightly above the road.

### 6.2 Roll centre

Line from the contact patch (86, 0) to the IC (−435.691, 60.509). Slope:

```
m = 60.509/(−435.691 − 86) = 60.509/(−521.691) = −0.1159864
```

At y = 0:

```
z_rc = 0 + (−0.1159864)(0 − 86) = 9.9749 mm
```

**Roll centre height 9.97 mm**, on the centreline by symmetry.

### 6.3 Camber gain per mm

Static crank angle:

```
θ₀ = atan2(7 − 12, 78 − 30) = atan2(−5, 48) = −5.94686°
```

At bump +0.5 mm and −0.5 mm, bisect (2.1)–(2.6) for `W.z = 32.5` and `31.5`, then evaluate (2.12):

```
bump = +0.5 mm:  θ = −5.359806°,  Lₒ = (78.04871, 7.49207),  γ_kp = −8.056900°
bump = −0.5 mm:  θ = −6.535190°,  Lₒ = (77.94613, 6.50740),  γ_kp = −7.947084°
κ = (−8.056900 − (−7.947084))/1.0 = −0.109816 °/mm
```

The sign is the useful part: κ < 0 means that as the wheel goes up, its top leans **inboard**, i.e.
the suspension gains negative camber in bump. That is what a racer means by "camber gain".

### 6.4 Camber at +2 mm, in full

This is the arithmetic the golden test repeats, so it is shown at every step.

Bisection gives θ = −3.605500°, so by (2.1):

```
cos(−3.605500°) = 0.9980194,  sin(−3.605500°) = −0.0628971
Lₒ.y = 30.00 + 48.2597×0.9980194 = 30.00 + 48.1641 = 78.1641
Lₒ.z = 12.00 + 48.2597×(−0.0628971) = 12.00 − 3.0354 = 8.9646
```

The solver reports Lₒ = (78.1642, 8.9651). The 0.0005 mm gap is because θ is quoted to six decimal
places (1 × 10⁻⁶ rad is 4.8 × 10⁻⁵ mm of arc at this radius); use the solver's value downstream, as
the golden test does.

Circle intersection for Uₒ, with Uᵢ = (42, 45), b = 30.8162, d = 37.3636:

```
Δ = Lₒ − Uᵢ = (36.1641, −36.0349),   D = √(1307.84 + 1298.52) = 51.0525
b² = 949.638,  d² = 1396.040,  D² = 2606.358
aa = (949.638 − 1396.040 + 2606.358)/(2×51.0525) = 2159.956/102.105 = 21.1543
h  = √(949.638 − 447.505) = √502.133 = 22.4083
ê  = (0.708369, −0.705842),   p̂ = (0.705842, 0.708369)
base = Uᵢ + aa·ê = (42 + 14.985, 45 − 14.932) = (56.985, 30.068)
Uₒ = base + h·p̂ = (56.985 + 15.817, 30.068 + 15.873) = (72.802, 45.941)
```

which matches the solver's (72.8018, 45.9419) — the branch that reproduces the static Uₒ.

Camber:

```
γ_kp = atan2(72.8018 − 78.1641, 45.9419 − 8.9651) = atan2(−5.3623, 36.9768)
     = −8.2515°
```

Static γ_kp = atan2(72.80 − 78.00, 44.00 − 7.00) = atan2(−5.20, 37.00) = −8.0000°.

```
Δγ at +2 mm bumper = −8.2515 − (−8.0000) = −0.2515°     (vs κ×2 = −0.2196°)
```

The difference between −0.2515 and κ×2 is the curvature of the camber curve: κ is a derivative, not
a secant. Both are correct; the app plots the secant and quotes the derivative. A test that asserts
`Δγ(+2) == 2κ` would be asserting a falsehood — do not write one.

### 6.5 Per degree of roll

Outer wheel (right side, s = +1), equation (2.16):

```
κ·(t/2)/57.2958 = −0.10982 × 86/57.2958 = −0.1648 °/°
dγ_road/dφ = 1 + (−0.1648) = +0.8352 °/°
```

Read it as: **for every degree the body rolls, the outer front wheel loses 0.84° of camber relative
to the road, and the linkage recovers only 16% of the 1.0° that the body roll alone would impose.**
That single number is the honest answer to "how much does my camber link actually do on a touring
car", and it is why touring cars carry 2–3° of static camber: the geometry cannot generate it in
roll.

Body-frame version, for the same case: the wheel gains −0.1648° of camber relative to the chassis
per degree of roll.

### 6.6 Roll centre migration

With t = 172 mm, (2.11) at φ = +1° gives bump_ℓ = −1.5009 mm (droop) and bump_r = +1.5009 mm
(compression). Re-solving each corner separately — note that the two sides are now at *different*
bumps, so their instant centres are no longer mirror images:

```
left  at bump −1.5009:  IC = (−585.4,  95.4)   γ_kp = −7.853°
right at bump +1.5009:  IC = (+342.5,  39.3)   γ_kp = +8.183°
```

Left line, through the left contact patch (86, 0):

```
m_L = (95.4 − 0)/(−585.4 − 86) = 95.4/(−671.4) = −0.142092
z = −0.142092·(y − 86) = −0.142092y + 12.2199
```

Right line, through the right contact patch (−86, 0):

```
m_R = (39.3 − 0)/(342.5 − (−86)) = 39.3/428.5 = +0.091715
z = +0.091715·(y + 86) = 0.091715y + 7.8875
```

Intersect:

```
−0.142092y + 12.2199 = 0.091715y + 7.8875
4.3324 = 0.233807y
y_rc = 18.530 mm
z_rc = 0.091715×(18.530 + 86) = 9.583 mm
```

**RC at φ = +1°: (y, z) = (+18.53, 9.58) mm** — matching the solver's (18.550, 9.583) to the
precision the ICs were quoted at. Full migration table:

| φ (°) | left IC (mm) | right IC (mm) | y_rc (mm) | z_rc (mm) |
|---|---|---|---|---|
| −2.0 | (−278.2, 25.1) | (871.0, 162.8) | −36.37 | 8.442 |
| −1.0 | (−342.5, 39.3) | (585.4, 95.4) | −18.55 | 9.583 |
| 0.0 | (−435.7, 60.5) | (435.7, 60.5) | 0.00 | 9.975 |
| +1.0 | (−585.4, 95.4) | (342.5, 39.3) | +18.55 | 9.583 |
| +2.0 | (−871.0, 162.8) | (278.2, 25.1) | +36.37 | 8.442 |

**Bumped, not rolled.** The same two-sided solve covers the cases a chassis sees on a kerb, and they
are not small:

| state | left IC (mm) | right IC (mm) | y_rc (mm) | z_rc (mm) |
|---|---|---|---|---|
| static | (−435.7, 60.5) | (435.7, 60.5) | 0.00 | 9.975 |
| heave: both +3 mm | (−278.3, 25.1) | (278.3, 25.1) | 0.00 | **5.936** |
| left +3 mm only | (−278.3, 25.1) | (435.7, 60.5) | −21.83 | 7.443 |
| left −3 mm only | (−870.5, 162.7) | (435.7, 60.5) | +16.26 | 11.861 |

Two results worth the app showing:

- **A pure heave drops the roll-centre height by 4 mm** (9.98 → 5.94) on this geometry, with no lateral
  shift. The "roll centre" is not a fixed property of the car; it moves 40% over 3 mm of bump. Any
  statement of the form "my car's roll centre is X" is a statement about one ride height.
- **A single-wheel bump moves it 22 mm sideways** and drops it 2.5 mm. On a kerb the car does not have
  one roll centre; it has whatever the two corners' current states produce.

Two things to notice:

- **Lateral migration is large** — 18.6 mm per degree, 11% of half-track. It follows from the IC
  being 526 mm away: when the two sides' ICs diverge at that distance, the crossing point swings a
  long way. This is a property of the geometry, not a bug, and it is the reason migration is worth
  displaying at all.
- **Height barely moves** (−0.39 mm per degree). A car whose ICs are much closer will migrate less
  laterally and possibly more in height. Both are reported, and the app shows the pair, not a
  single "roll centre" number: a roll centre with an 18 mm lateral offset is not what the driver's
  mental model assumes.

The direction is worth stating: at φ > 0 (left up, a left-hand corner) the roll centre migrates
toward **+y, the inside of the corner**. Whether that helps or hurts is not something this model
can say (module 8 does not exist); it is reported, not interpreted.

### 6.7 Kingpin axis quantities

```
Δy/Δz = (72.80 − 78.00)/(44.00 − 7.00) = −5.20/37.00 = −0.140541
Δx/Δz = (254.00 − 259.00)/(44.00 − 7.00) = −5.00/37.00 = −0.135135
y_g = 78.00 − (−0.140541)(7.00) = 78.00 + 0.98378 = 78.9838 mm
x_g = 259.00 − (−0.135135)(7.00) = 259.00 + 0.94595 = 259.9459 mm
KPI    = atan(0.140541) = 8.0000°
caster = atan(0.135135) = 7.6961°
trail  = 259.9459 − 257.00 = 2.9459 mm
scrub  = 86.00 − 78.9838 = 7.0162 mm
```

Sane for a touring car: 8° KPI, ~7.7° caster, ~3 mm of positive trail and ~7 mm of positive scrub
radius. Note how small trail is — at 1/10 scale, with a 32 mm tyre, there is no room for 20 mm of
trail, which is why RC steering feel is dominated by servo torque and tyre scrub rather than by
mechanical self-centring.

### 6.8 The buggy corner, same code

Module 1 §8.4 geometry, with the same functions:

```
a = 64.560, b = 48.662, d = 48.662
IC = (−281.391, 131.565) mm
z_rc = 131.565 × 110/(110 + 281.391) = 36.976 mm
κ = −0.14639 °/mm
KPI = 9.4623°
dγ_road/dφ = 1 + (−0.14639 × 110/57.2958) = 0.7189 °/°
```

Same equations: 33% more camber gain and a roll centre 37 mm above the road instead of 10. The
difference is the lower arm's 18 mm of outboard droop and the shorter upper arm — exactly the two
things the geometry says should matter. The buggy's outer wheel also loses *less* camber per degree
of roll — 0.719 °/° against the touring car's 0.835 — and that is exactly the product of two effects
the geometry produces: 33% more camber gain per mm and 28% more half-track (1.33 × 1.28 = 1.70, and
0.2811/0.1648 = 1.71). Camber gain per mm and camber behaviour in roll are different numbers, and the
app should show both because they move for different reasons.

---

## 7. What this module implies (for the teaching copy in the app)

- On a touring car the front-view linkage recovers ~15% of the camber change that body roll
  imposes. Static camber is doing the work; the link is trimming. (Reference car: 0.835 °/° net.)
- The roll centre's height barely changes with roll; its **lateral position** changes a lot when
  the IC is far away. A single "roll centre height" number therefore hides the thing that moves.
- Camber gain is a derivative. Over ±5 mm of travel the secant differs from the derivative by 15%
  on this car, so a chart drawn from the secant and a headline number drawn from the derivative
  will disagree — deliberately, and the UI must label which is which.

---

## 8. Golden test cases

All at the static ride height unless stated. Reference car from module 1 §8.2.

| ID | Input | Expected | Origin |
|---|---|---|---|
| G02.1 | reference LF corner, static | IC = (−435.691, 60.509) mm; z_rc = 9.9749 mm; y_rc = 0.0 mm | hand calc §6.1–6.2 |
| G02.2 | reference LF, bump = +0.5 and −0.5 mm | κ = −0.10982 °/mm (±1e-4) | hand calc §6.3 |
| G02.3 | reference LF, bump = +2.000 mm | γ_kp = −8.2515°; Uₒ = (72.8018, 45.9419) mm; W = (86.0544, 34.0000) mm | hand calc §6.4 |
| G02.4 | reference car, φ = +1.000° | y_rc = +18.550 mm, z_rc = 9.583 mm (±0.002) | hand calc §6.6 (solver table) |
| G02.5 | reference LF, static | κ_roll_body = −0.1648 °/°; κ_roll_road = +0.8352 °/° | hand calc §6.5 |
| G02.6 | reference LF, static | KPI 8.0000°, caster 7.6961°, trail 2.9459 mm, scrub 7.0162 mm | hand calc §6.7 |
| G02.7 | both arm lines horizontal and parallel | `flags = [parallelLinks]`, z_rc = 0.0 mm, no exception, no NaN | hand calc §4.3 (horizontal limit) |
| G02.8 | reference LF, bump = +50 mm | `Undefined(outOfTravel)` | spec §3.2 |
| G02.9 | module 1 §8.4 buggy corner, static | IC = (−281.391, 131.565) mm; z_rc = 36.976 mm; κ = −0.14639 °/mm | hand calc §6.8 |
| G02.10 | reference car, heave +3.000 mm both sides | y_rc = 0.000, z_rc = 5.936 mm | hand calc §6.6 (bump table) |

Tolerances: 1 × 10⁻³ mm, 1 × 10⁻⁴ °, 1 × 10⁻⁴ on ratios.

**Where these values come from:** all ten are hand calculations printed in §6 of this document.
None is a published experimental result, because a 1/10 touring car has no published geometry.
That is a real limitation and the reason 99-validation.md puts "measure a real car and compare"
at the top of its list: the *method* is from Milliken ch. 17 and Dixon, the *numbers* are ours.

---

## 9. Sensitivity (feeds 99-validation.md)

Perturbing one hardpoint by the amount a careful caliper measurement might be wrong:

| Perturbation | Δz_rc | Note |
|---|---|---|
| Lₒ.z +0.1 mm | +0.0165 mm | 6% of the perturbation |
| Lₒ.z +0.2 mm | +0.0330 mm | |
| Lₒ.z +0.5 mm | +0.0824 mm | |

So roll-centre height is *not* hypersensitive on this geometry (0.16 mm per mm of error), even
though migration is large. Camber gain is the more sensitive quantity: κ moves by ~2% per 0.1 mm of
Lₒ.z, because it is a derivative of a far-away rotation. Publish κ to 3 decimals, roll centre to 2,
and never claim more.
