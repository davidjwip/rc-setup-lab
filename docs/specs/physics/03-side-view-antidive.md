# 03 — Side view: anti-dive and anti-squat

Build order: 3 of 9. Depends on module 1 only. **Nothing else depends on it**, which is why this
module is allowed to be honest about being a diagnostic rather than a design tool.

---

## 1. Purpose

Compute, from the side-view (x–z) geometry of the front and rear suspensions:

| Output | Unit | Meaning |
|---|---|---|
| Side-view swing-arm angle, front | ° | angle of the line from the front contact patch to the front side-view IC |
| Side-view swing-arm angle, rear | ° | same, rear |
| Anti-dive, front | % | fraction of the front load transfer carried by the linkage instead of the springs |
| Anti-squat, rear | % | same, under drive |
| `diagnosticOnly` flag | — | always true in v1 (see §6) |

The physics is textbook — Gillespie, *Fundamentals of Vehicle Dynamics*, ch. 6; Milliken ch. 19 —
and the reason we compute it at all is that the app should be able to *say* why it does not matter
at this scale instead of silently omitting it.

---

## 2. Inputs

| Input | Symbol | Unit | Range (1/10 TC) | Source |
|---|---|---|---|---|
| lower arm inner pivot x, z | — | mm | — | module 1 |
| lower ball joint x, z | — | mm | — | module 1 |
| upper link inner x, z | — | mm | — | module 1 |
| upper ball stud x, z | — | mm | — | module 1 |
| front contact patch x | x_cp,f | mm | = wheelbase | module 1 |
| rear contact patch x | x_cp,r | mm | = 0 | module 1 |
| wheelbase | l | mm | 150–400 | module 1 |
| CG height | h | mm | 5–80 | module 1 |
| front brake fraction | K_bf | — | 0–1 | **user input** |
| drive fraction to the axle | K_d | — | 0–1 | **user input** |

`K_bf` and `K_d` cannot be derived from geometry; they are drivetrain properties and must be
supplied. Defaults in v1: `K_bf = 0.55`, `K_d = 0.5` (a 4WD touring car), both flagged `assumed`.
A 2WD buggy sets `K_d = 1.0` on the driven axle and 0.0 on the other.

No physical constants.

---

## 3. Model

### 3.1 Side-view instant centre

Project the corner onto the **x–z plane** and intersect the projections of the two link lines, the
same construction as module 2 §3.3 with y replaced by x:

```
line 1: through (x_Li, z_Li) with direction (x_Lo − x_Li, z_Lo − z_Li)
line 2: through (x_Ui, z_Ui) with direction (x_Uo − x_Ui, z_Uo − z_Ui)
SVIC = intersection                                                   (3.1)
```

### 3.2 Swing-arm angle

Front suspension: the line from the **front contact patch** to the SVIC. Anti-dive needs the SVIC
*behind* the contact patch:

```
θ_f = atan( (z_ic − z_cp) / (x_cp − x_ic) )     if x_ic < x_cp, else undefined    (3.2)
```

Rear: SVIC *ahead* of the contact patch:

```
θ_r = atan( (z_ic − z_cp) / (x_ic − x_cp) )     if x_ic > x_cp, else undefined    (3.3)
```

Positive θ means the line rises as it goes away from the contact patch, which is the condition for
the linkage to carry load.

### 3.3 Anti-dive and anti-squat

```
%anti-dive (front)  = tan θ_f · (l/h) · K_bf · 100                       (3.4)
%anti-squat (rear)  = tan θ_r · (l/h) · K_d  · 100                       (3.5)
```

Derivation sketch, because the structure is what matters: under braking the load transfer
`ΔW = m·a·h/l` has to be reacted. The linkage can react part of it at the contact patch if the
force line through the links is inclined; the fraction it can carry is
`(tan θ)·(l/h)` scaled by how much of the braking is done at that axle. The same argument with
longitudinal force in place of braking force gives (3.5). Gillespie derives both; the form above is
the standard one and we use it without embellishment.

**The 100% condition** is `tan θ = h/l`. For the reference car, `h/l = 28/257 = 0.109`, i.e.
`θ = 6.22°`. A full-size car with `l = 2500 mm` and `h = 500 mm` needs `θ = 11.3°`. Both are within
the range of real designs, which is why the concept is useful — at both scales the *number* is
extremely sensitive to a small angle.

---

## 4. Why RC cars rarely model it

Five reasons, in order of how much they matter. The first is decisive.

1. **The number is dominated by l/h, and l/h is 9 at 1/10 scale.** The reference car needs a 6.2°
   swing-arm angle for 100% anti-dive; the geometry it actually has produces 300–400% for the same
   arm inclinations a full-size designer would call "mild". A model that returns "anti-dive 316%"
   is not wrong arithmetic — it is arithmetic from which no usable conclusion follows, because the
   classical derivation assumes the links are the only load path and at this scale they are not.
2. **The dominant compliance is not in the model.** Tyre carcass deflection, chassis flex and damper
   oil movement account for most of the visible dive on a 1/10 car. The linkage's geometric
   contribution is a small term on top of those, and the model has none of them.
3. **Electric touring cars have no hydraulic brakes.** Braking comes from the motor, through the
   drivetrain, reacted at the motor mounts and the belt tension — not at the suspension links in the
   way (3.4) assumes. The `K_bf` input has no physical meaning for these cars; there is no brake
   bias to enter.
4. **4WD splits drive torque.** (3.5) assumes one driven axle. A shaft-driven 4WD car delivers
   torque to both axles, and the belt/shaft tension reaction (which RC3's author explicitly
   declined to model, on the forum record) is a term the classical formula does not contain.
5. **Travel is ±5 mm.** The whole pitch event is under 0.3° of chassis rotation. Whatever the
   linkage does, it does it over a range where the geometry barely changes.

None of that says anti-dive is unreal on an RC car. It says the *classical estimator* is the wrong
instrument at this scale, and the honest product decision is to compute it, label it, and never
build setup advice on it.

---

## 5. Worked examples

### 5.1 A pan car trailing arm (the construction at its best)

A pan car rear end has a single trailing arm: pivot at (x, z) = (90, 40) mm, axle at (0, 30) mm,
contact patch at (0, 0). A single link's SVIC **is** its pivot — there is nothing to intersect.

```
tan θ_r = z_ic/(x_ic − x_cp) = 40/(90 − 0) = 0.4444
l/h = 257/28 = 9.1786
%anti-squat = 0.4444 × 9.1786 × 1.0 × 100 = 407.9%
```

Four hundred percent. Read literally, the linkage more than cancels the squat and the rear of the
car should rise under power. What actually happens is that the arm's pivot bushing, the chassis and
the tyre absorb it. This is the number the app would show, and it is why the module is flagged.

### 5.2 The touring car, where the construction degenerates

Reference car front corner, side-view projections (x, z):

```
lower: (250.0, 12.0) → (259.0, 7.0)
upper: (250.0, 45.0) → (254.0, 44.0)
```

Slopes:

```
m₁ = (7 − 12)/(259 − 250) = −5/9 = −0.55556
m₂ = (44 − 45)/(254 − 250) = −1/4 = −0.25000
```

Intersect `z = 12 + m₁(x − 250)` and `z = 45 + m₂(x − 250)`:

```
12 − 0.55556(x − 250) = 45 − 0.25(x − 250)
12 − 0.55556x + 138.89 = 45 − 0.25x + 62.50
150.89 − 0.55556x = 107.50 − 0.25x
43.39 = 0.30556x
x_ic = 142.00,   z_ic = 12 − 0.55556(142 − 250) = 72.00
```

```
θ_f = atan(72.00/(257 − 142.00)) = atan(0.62609) = 32.05°
%anti-dive = 0.62609 × 9.1786 × 0.55 × 100 = 316.1%
```

Now the part that matters. The two links' side-view projections are 9 mm and 4 mm long — they are
**transverse arms seen almost edge-on**. Perturb one hardpoint by the width of a pencil line:

| Perturbation | SVIC | %anti-dive |
|---|---|---|
| none | (142.0, 72.0) | 316.1% |
| Lₒ.x + 0.5 mm | (130.6, 74.9) | 298.9% |
| Uₒ.x + 0.5 mm | (151.0, 67.0) | 319.1% |

A 0.5 mm measurement error moves the answer by 5–6% of a number that is already three times
physical. There is no calibration that fixes this: the construction is being asked for a small
angle from two nearly-vertical lines, and the input precision does not support it.

### 5.3 What would make it meaningful

A car whose arms *are* swept in plan — a buggy with 20–30° of arm sweep, or a pan car — gives the
construction something to work with, because the side-view projection is then tens of millimetres
long. That is the case where the module earns its place, and the app should say so: show the number
with a confidence band derived from the projection length, and hide it when the projections are
under 10 mm.

---

## 6. Assumptions, limits and the v1 decision

**Assumptions**

1. Rigid links, rigid chassis, no compliance in the load path.
2. The longitudinal force is reacted at the contact patch and through the links only.
3. One driven axle for anti-squat; a defined brake split for anti-dive.
4. Instantaneous geometry — the angle is taken at static ride height and treated as constant over
   travel.

**Where it breaks:** all four, and badly, at 1/10 scale (§4).

**v1 decision:** compute it, display it behind a "diagnostics — not used for setup advice" panel,
always attach `flags: [diagnosticOnly]`, and suppress the number entirely when either link's
side-view projection is shorter than 10 mm (which is the normal case for a touring car). Never let
it appear in the setup comparison or in any recommendation. This is a deliberate product choice and
should be recorded in the changelog as such.

---

## 7. Degenerate cases

| Condition | Behaviour |
|---|---|
| link projections parallel (`\|m₁ − m₂\| < 1e-9`) | `Undefined(parallelLinks)` — no finite SVIC |
| SVIC on the wrong side of the contact patch (front: `x_ic > x_cp`) | `Undefined(noAntiGeometry)` — the linkage is pro-dive; report "0%, pro-dive geometry" |
| side-view projection of either link < 10 mm | `Ok(value, flags: [lowConfidence, diagnosticOnly])`, value suppressed in the UI |
| arm exactly vertical in side view (`Δx = 0`) | line is vertical; handle explicitly, do not divide by Δx |
| `K_bf` or `K_d` missing | `incompleteModel` — these are not derivable |

---

## 8. Golden test cases

| ID | Input | Expected | Origin |
|---|---|---|---|
| G03.1 | pan car trailing arm, pivot (90, 40), l = 257, h = 28, K_d = 1.0 | θ_r = 23.963°, anti-squat = 407.9% | hand calc §5.1 |
| G03.2 | reference TC front, §5.2 geometry, K_bf = 0.55 | SVIC = (142.00, 72.00) mm, θ_f = 32.05°, anti-dive = 316.1%, flags include `diagnosticOnly` | hand calc §5.2 |
| G03.3 | same with Lₒ.x = 259.5 | anti-dive = 298.9% | hand calc §5.2 table |
| G03.4 | front links parallel in side view | `Undefined(parallelLinks)` | spec §7 |
| G03.5 | 100% anti-dive condition, θ_f = 6.218° | anti-dive = 100.0% ± 0.1 | hand calc: tan(6.218°) × 9.1786 × 0.55 = 0.55; requires K_bf = 1.0 → 100% |

G03.5 is stated carefully: with `K_bf = 1.0` and `θ_f = atan(h/l)`, (3.4) gives exactly 100%. That
is a good structural test because it checks the `l/h` factor and the tangent together.

---

## 9. One-paragraph summary for the app's teaching copy

Anti-dive and anti-squat describe how much of the load transfer under braking or acceleration the
suspension *links* carry, rather than the springs. They are real, they are in every vehicle dynamics
textbook, and on a 1/10 car the classical way of estimating them produces numbers in the hundreds of
percent because the wheelbase-to-CG-height ratio is twice a full-size car's and the dominant
compliances are not in the model. Setup Lab computes them so it can show you the geometry, and
labels them a diagnostic. Change your springs and your shocks.
