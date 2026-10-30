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
| `diagnosticOnly` flag | — | always true in v1 |

Textbook physics: Gillespie ch. 6, Milliken ch. 19. The reason the app computes it at all is that it
should be able to *say* why the number does not matter at this scale instead of silently omitting it.

**What changed in round 2.** Round 1's worked example was built on a lower-arm point at x = 250 mm
that the reference car does not have — the car's lower arm is a **hinge whose axis runs fore-aft**,
and its side-view projection is not a 9 mm inclined line but a degenerate horizontal one. The
headline number (316.1 %) was an artefact of that invented point, and the module never noticed that
for the arm type its own reference car uses there is nothing to intersect. The construction is now
defined per arm type, and the reference car returns `Undefined(noSideViewConstruction)`.

---

## 2. Inputs

| Input | Symbol | Unit | Range (1/10 TC) | Source |
|---|---|---|---|---|
| lower arm type | — | `hinge` \| `aal` | hinge | module 1 |
| lower hinge axis direction (hinge only) | `û` | — | unit | module 1 |
| lower arm inner pivot x, z (A-arm) | — | mm | — | module 1 |
| lower ball joint x, z | — | mm | — | module 1 |
| upper link inner x, z | — | mm | — | module 1 |
| upper ball stud x, z | — | mm | — | module 1 |
| front contact patch x | x_cp,f | mm | = wheelbase | module 1 |
| rear contact patch x | x_cp,r | mm | = 0 | module 1 |
| wheelbase | l | mm | 150–400 | module 1 |
| CG height | h | mm | 15–45 (**inferred**, 01 §4.5) | module 1 |
| front brake fraction | K_bf | — | 0–1 | **user input** |
| drive fraction to the axle | K_d | — | 0–1 | **user input** |

`K_bf` and `K_d` cannot be derived from geometry; they are drivetrain properties. Defaults in v1:
`K_bf = 0.55`, `K_d = 0.5` (a 4WD touring car), both `assumed`. A 2WD buggy sets `K_d = 1.0` on the
driven axle and 0.0 on the other. **A golden case that depends on one of them states its value in
the input column** — round 1's G03.5 asserted a result that needs `K_bf = 1.0` while listing only
`θ_f`.

No physical constants.

---

## 3. Model

### 3.1 Side-view instant centre — defined per arm type

Project the corner onto the **x–z plane** and intersect the projections of the two link lines.
**The lower link's side-view line depends on the arm type**, and this is the rule round 1 lacked:

```
lower arm line:
  if arm_type.lower == "aal":     through (x_Li, z_Li) with direction (x_Lo − x_Li, z_Lo − z_Li)
  if arm_type.lower == "hinge":
      if |û_x| ≥ 0.99:            no side-view line exists  → Undefined(noSideViewConstruction)
      else:                       through (x_Li, z_Li) with direction (û_x, û_z)
upper link line (always):
                                  through (x_Ui, z_Ui) with direction (x_Uo − x_Ui, z_Uo − z_Ui)
SVIC = intersection                                                                    (3.1)
```

Why the hinge case is a refusal, not a detail. The reference car's hinge axis runs along x at
(y, z) = (30, 12), so its projection on the x–z plane is the horizontal line z = 12 spanning every x.
There is no inboard point to draw a line from, and there are three defensible readings, which give:

| Reading of "the lower link's side-view line" | SVIC (mm) | θ_f | Anti-dive |
|---|---|---|---|
| the hinge axis itself (z = 12, horizontal) | (382.0, 12.0) | — | `noAntiGeometry`, x_ic > x_cp |
| the velocity constraint (the ball joint has zero x-velocity → vertical line at x = 259) | (259.0, 42.75) | — | `noAntiGeometry`, x_ic > x_cp |
| the hinge-axis midpoint as an "inboard point" (x = 255) | (223.25, 51.69) | 56.86° | **773.1 %** |
| (round 1's printed x = 250, which is the *upper* link's inner x) | (142.0, 72.0) | 32.05° | 316.1 % |

A construction whose answer ranges from "no anti-geometry at all" to 773 % depending on an
unstated choice is not a construction. The module refuses on hinge arms and says why.

**The 10 mm suppression rule does not catch this.** Round 1 also said the number is suppressed when
either link's side-view projection is shorter than 10 mm. The reference car's *arm* spans 34 mm in x
(238 → 272), so the rule would not have fired — while the *link line* does not exist. The rule tests
projection **length**; the failure is projection **degeneracy**. Both are checked, and the degeneracy
check comes first.

### 3.2 Swing-arm angle

Front: the line from the **front contact patch** to the SVIC. Anti-dive needs the SVIC *behind* the
patch:

```
θ_f = atan( (z_ic − z_cp) / (x_cp − x_ic) )     if x_ic < x_cp, else undefined        (3.2)
```

Rear: SVIC *ahead* of the patch:

```
θ_r = atan( (z_ic − z_cp) / (x_ic − x_cp) )     if x_ic > x_cp, else undefined        (3.3)
```

Positive θ means the line rises going away from the contact patch, which is the condition for the
linkage to carry load.

### 3.3 Anti-dive and anti-squat

```
%anti-dive (front)  = tan θ_f · (l/h) · K_bf · 100                                     (3.4)
%anti-squat (rear)  = tan θ_r · (l/h) · K_d  · 100                                     (3.5)
```

Under braking the load transfer `ΔW = m·a·h/l` has to be reacted; the linkage can react part of it at
the contact patch if the force line through the links is inclined, and the fraction it can carry is
`(tan θ)·(l/h)` scaled by how much of the braking is done at that axle. The same argument with
longitudinal force gives (3.5). Gillespie derives both; the form above is standard and we use it
without embellishment.

**The 100 % condition** is `tan θ = h/l`. For the reference car, `h/l = 28/257 = 0.109`, i.e.
`θ = 6.22°`. A full-size car with `l = 2500 mm` and `h = 500 mm` needs 11.3°. Both are within the
range of real designs, which is why the concept is useful — and why the *number* is so sensitive to a
small angle.

---

## 4. Why RC cars rarely model it

1. **The number is dominated by l/h, and l/h is 9 at 1/10 scale.** The reference car needs a 6.2°
   swing-arm angle for 100 % anti-dive; a full-size designer's "mild" arm inclination produces several
   hundred percent here. Arithmetic from which no usable conclusion follows, because the classical
   derivation assumes the links are the only load path.
2. **The dominant compliance is not in the model.** Tyre carcass deflection, chassis flex and damper
   oil movement account for most of the visible dive on a 1/10 car.
3. **Electric touring cars have no hydraulic brakes.** Braking comes from the motor, reacted at the
   motor mounts and belt tension — not at the suspension links in the way (3.4) assumes. `K_bf` has no
   physical meaning for these cars.
4. **4WD splits drive torque.** (3.5) assumes one driven axle.
5. **Travel is ±5 mm.** The whole pitch event is under 0.3° of chassis rotation.

None of that says anti-dive is unreal on an RC car. It says the *classical estimator* is the wrong
instrument at this scale, and the honest product decision is to compute it where the construction
exists, label it, and never build setup advice on it.

---

## 5. Worked examples

### 5.1 A pan car trailing arm (the construction at its best)

A pan car rear end has a single trailing arm: pivot at (x, z) = (90, 40) mm, axle at (0, 30) mm,
contact patch at (0, 0). A single link's SVIC **is** its pivot — there is nothing to intersect.

```
tan θ_r = z_ic/(x_ic − x_cp) = 40/(90 − 0) = 0.4444
l/h = 257/28 = 9.1786
%anti-squat = 0.4444 × 9.1786 × 1.0 × 100 = 407.9 %
```

Four hundred percent. Read literally, the linkage more than cancels squat and the rear should rise
under power. What happens is that the pivot bushing, the chassis and the tyre absorb it. This is the
number the app shows, and it is why the module carries `diagnosticOnly`.

Note the arm type here is `aal` (or a single-link type with a real x-extent) — the pan car's trailing
arm has a side-view line, which the touring car's hinge does not. That difference is the whole point
of §3.1.

### 5.2 The touring car: the construction does not exist (replaces round 1's 316.1 %)

Reference car front corner, from module 1 §8.2:

```
lca_in_a = (238, 30, 12)   lca_in_b = (272, 30, 12)   →  hinge axis direction û = (1, 0, 0)
lca_out  = (259, 78, 7)
uca_in   = (250, 42, 45)   uca_out  = (254, 72.8, 44)
```

The lower arm's axis is along x (`|û_x| = 1.0 ≥ 0.99`), so the side-view line does not exist:

```
→ Undefined(noSideViewConstruction), flags: [diagnosticOnly]
```

and the UI says "anti-dive is not computable for a transverse hinge arm". The three alternative
readings are tabulated in §3.1; the spread from `noAntiGeometry` to 773 % is the argument for
refusing rather than choosing.

Round 1's §5.2 printed `lower: (250.0, 12.0) → (259.0, 7.0)`, a 9 mm side-view projection that
produced SVIC = (142, 72), θ_f = 32.05° and 316.1 %. The x = 250 is `uca_in.x`, borrowed from the
upper link; the reference car has no lower-arm point there. **That case and its perturbation table
are withdrawn.**

### 5.3 What would make it meaningful: a swept-arm car

A car whose arms *are* swept in plan — a buggy with 20–30° of sweep — has a side-view line tens of
millimetres long and the construction is well conditioned. Illustrative arithmetic, **not the reference car**:
a lower arm whose side-view projection runs from x = 100 mm to x = 118 mm while rising 6 mm — an
18 mm projection, the size that makes the construction well conditioned — an upper link positioned so
that the two projections meet at
`(x_ic, z_ic) = (60, 30)` mm, and the contact patch at x_cp = 130 mm:

```
tan θ_f = 30/(130 − 60) = 0.4286      θ_f = 23.2°
%anti-dive = 0.4286 × (257/28) × 0.55 × 100 = 216.4 %
```

Still hundreds of percent — the scale argument in §4 does not go away — but now the number is a
function of the geometry rather than of a modelling choice, and the app may show it with a
confidence band derived from the projection length.

---

## 6. Assumptions, limits and the v1 decision

**Assumptions**

1. Rigid links, rigid chassis, no compliance in the load path.
2. Longitudinal force is reacted at the contact patch and through the links only.
3. One driven axle for anti-squat; a defined brake split for anti-dive.
4. Instantaneous geometry, taken at static ride height and treated as constant over travel.

**Where it breaks:** all four, and badly, at 1/10 scale (§4).

**v1 decision:** compute it where the construction exists, display it behind a "diagnostics — not
used for setup advice" panel with `flags: [diagnosticOnly]`, suppress the number when either link's
side-view projection is shorter than 10 mm, and refuse entirely for a hinge arm whose axis is
within 8° of x. Never let it appear in the setup comparison or in any recommendation.

---

## 7. Degenerate cases

| Condition | Behaviour |
|---|---|
| lower arm is a hinge with `\|û_x\| ≥ 0.99` | `Undefined(noSideViewConstruction)` — the normal touring-car case |
| link projections parallel (`\|d₁×d₂\| < kParallelTol·\|d₁\|\|d₂\|`) | `Undefined(parallelLinks)` — no finite SVIC. (Round 1 tested `\|m₁ − m₂\| < 1e-9` on slopes, which divides by Δx and then says "handle the vertical case explicitly, do not divide by Δx" — the test itself divides by Δx.) |
| SVIC on the wrong side of the patch (front: `x_ic > x_cp`; rear: `x_ic < x_cp`) | `Undefined(noAntiGeometry)` — report "0 %, pro-dive geometry" |
| side-view projection of either link < 10 mm | `Defined(value, flags: [lowConfidence, diagnosticOnly])`, value suppressed in the UI |
| `K_bf` or `K_d` missing | `incompleteModel` — not derivable |
| `h` provenance is `assumed` | accepted; every output carries `flag cgInferred` |

---

## 8. Golden test cases

| ID | Input | Expected | Origin |
|---|---|---|---|
| G03.1 | pan car trailing arm, pivot (90, 40), l = 257, h = 28, K_d = 1.0 | θ_r = 23.963°, anti-squat = 407.9 % | hand calc §5.1 |
| **G03.2** | **reference TC front corner, module 1 §8.2 hardpoints, K_bf = 0.55** | **`Undefined(noSideViewConstruction)`, no number, `diagnosticOnly`** | §3.1 — hinge axis `\|û_x\| = 1.0` |
| G03.3 | reference TC front, hinge axis tilted 11.5° off x (`û = (0.98, 0, −0.199)`) | a finite SVIC **is** produced — (1005, −144) mm — but `x_ic > x_cp`, so `Undefined(noAntiGeometry)`. The construction exists here; that is the difference from G03.2 | hand calc §3.1 (line through (238, 12) with slope −0.20306) |
| G03.4 | front links parallel in side view (A-arm corner, equal slopes) | `Undefined(parallelLinks)` | §7 |
| G03.5 | 100 % anti-dive condition, `θ_f = 6.218°`, **`K_bf = 1.0`** | anti-dive = 100.0 % ± 0.1 | hand calc: tan(6.218°) × 9.1786 × 1.0 = 1.000 |
| **G03.6** | **swept-arm buggy corner, §5.3** | θ_f = 23.2°, anti-dive = 216.4 % | hand calc §5.3 |

G03.2 is the case round 1 needed and did not have: it is an identity between module 1's arm type and
module 3's answer, and it fails on any implementation that invents an inboard point. G03.5 now states
`K_bf` in its input column; round 1 asserted 100 % while giving an input set that produces 55 %.

---

## 9. One-paragraph summary for the app's teaching copy

Anti-dive and anti-squat describe how much of the load transfer under braking or acceleration the
suspension *links* carry rather than the springs. They are real and they are in every vehicle
dynamics textbook, and on a 1/10 car the classical way of estimating them produces numbers in the
hundreds of percent, because the wheelbase-to-CG-height ratio is twice a full-size car's and the
dominant compliances are not in the model. Most touring cars cannot be computed at all, because a
fore-aft hinge arm has no side-view geometry to intersect — and Setup Lab says that instead of
inventing a point. Change your springs and your shocks.
