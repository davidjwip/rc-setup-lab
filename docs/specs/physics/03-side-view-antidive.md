# 03 — Side view: anti-dive and anti-squat from the two inner pivot screws

Build order: 3 of 9. Depends on modules 1 (hardpoints) and 6 (load transfer). The front view
(module 2) still consumes the **midpoint** of the two inner pivots; this module is the only
consumer of their **difference**.

**This file supersedes the round-2 refusal for hinge arms.** Round 2 correctly found that a
single fore-aft hinge axis has no unique side-view line and refused to invent one. The car
itself supplies the missing information: the inner pivot is **two screws, fore and aft**, and
shimming one end tilts the hinge axis. That tilt is the input. A level pair is the exact
zero-anti-dive limit, not a missing construction.

Bob Wright did not model this, and said so three times:

- *"the program is only 2D, so castor, pro/anti dive and squat are not considered at this point"*
  (2012);
- *"that version will likely be more 3D … so I can include … dive/squat, castor, akerman,
  chassis stiffness"* (2012);
- *"it could be included in the current 2D program but would be best handled with a 3D model"*
  (Dec 2012).

This slice is the thing RC3 could not do. It is still a **2D side-view projection of a real 3D
linkage**, so it is `modelled`, `diagnosticOnly`, and never a setup recommendation.

---

## 1. Purpose

| Output | Unit | Meaning |
|---|---|---|
| Anti-dive, front | % | share of braking load transfer carried by the front links at the traction limit |
| Anti-squat, rear | % | same under acceleration |
| Side-view instant centre | mm | intersection of the lower hinge-axis line and the upper link line |
| tan θ | — | signed, from the contact patch to that instant centre |

The percentage is signed. Negative is **pro-dive** at the front and **pro-squat** at the rear.

---

## 2. Inputs

| Input | Symbol | Unit | Source |
|---|---|---|---|
| lower inner pivot, fore screw | `lca_in_a` | mm, x–z | module 1, chassis-fixed |
| lower inner pivot, aft screw | `lca_in_b` | mm, x–z | module 1, chassis-fixed |
| lower ball joint | `lca_out` | mm, x–z | module 1, composed `hub + offset` (D-25) |
| upper link inner | `uca_in` (or the wishbone midpoint) | mm, x–z | module 1, chassis-fixed |
| upper ball stud | `uca_out` | mm, x–z | module 1, composed `hub + offset` (D-25) |
| front contact patch | `x_cp,f = L` | mm | wheelbase; z = 0 in the ground frame |
| rear contact patch | `x_cp,r = 0` | mm | rear axle; z = 0 |
| wheelbase | `L` | mm | module 1 |
| CG height above ground | `h` | mm | **derived**: `cg.z − z_ground`, D-26 |
| longitudinal acceleration | `a_x` | m/s² | analysis input: braking negative, acceleration positive |

There is **no brake-bias, torque-split or centre-diff input**. A single motor drives and brakes
all four wheels, so the axle share is derived from the dynamic axle load (§3.3). `fields.yaml`
has no path for one and the gate's `field-drift` stage fails if one appears.

Missing CG height refuses the output (`incompleteModel`, naming `body.cg.height`). It is never
silently replaced by a default inside this module.

---

## 3. Model

### 3.1 The two views use the pair differently

```text
z_mid = (z_a + z_b)/2              front view: roll centre, camber gain, motion ratio
slope = (z_b − z_a)/(x_b − x_a)    side view: lower arm line
```

Raising both screws by 1 mm moves `z_mid` by 1 mm; raising one moves it by 0.5 mm. That is the
midpoint rule and it is asserted numerically. With `z_a = z_b` every front-view golden is
unchanged.

### 3.2 Side-view instant centre

Project the corner onto the x–z plane.

```text
lower line: through lca_out, direction (x_b − x_a, z_b − z_a)
upper line: through uca_in and uca_out
SVIC       = intersection
```

The lower line passes through the **ball joint**, not through the inner screws: the hinge axis
gives the direction, the ball joint gives the point the arm actually carries. The upper link is
the single line `uca_in → uca_out`.

### 3.3 Signed swing-arm angle and the percentage

```text
front: tan θ_f = (z_ic − z_cp)/(x_cp,f − x_ic)     positive when the SVIC is behind the patch
rear:  tan θ_r = (z_ic − z_cp)/(x_ic − x_cp,r)     positive when the SVIC is ahead of the patch
```

The **side of the patch sets the sign**, not the raw quotient: an SVIC on the wrong side is
pro-dive / pro-squat and is reported negative even when it lies below the ground plane (where a
naive quotient would turn positive through a double negative).

Longitudinal transfer and the traction-limit axle share:

```text
T_long       = m · |a_x| · h / L
Fz_front(a)  = static_front + T_long      braking, a_x < 0
Fz_rear(a)   = static_rear  + T_long      acceleration, a_x > 0

anti-dive %  = tan θ_f · (L/h) · (Fz_front(a)/m) · 100
anti-squat % = tan θ_r · (L/h) · (Fz_rear(a)/m)  · 100
```

`static_front` and `static_rear` are the same static axle loads module 6 uses. At partial
braking or acceleration the driveline, not the load, sets the split; the output therefore says
**evaluated at the traction limit**, and it is plotted as a curve against signed `a_x`.

### 3.4 The zero limit, stated as a choice

A level hinge axis makes the side-view motion of the ball joint vertical and the lower line
horizontal. The owner's direction is that this is **exactly 0.0 %**, and the implementation
returns a defined zero rather than a tiny residual from the upper link's inclination. The same
defined zero is returned for an **exact zero-slope parallel pair**. Any other parallel pair has
no finite instant centre and is `Undefined(parallelLinks)`.

The discontinuity at exactly level is deliberate and is the price of the owner's "level means
zero" rule; it is recorded here rather than hidden in a tolerance.

---

## 4. Limits, and why the number is still useful

1. **2D projection of a 3D linkage.** The hinge axis is tilted by shims, and the projection
   ignores the y component. Provenance is `modelled`.
2. **Caster is modelled (04 §3.7) but its anti-dive contribution is not yet included.** It acts through the steering axis, so the
   figure reads **conservative**; the UI says so.
3. **Rigid links, rigid chassis, no compliance.** Tyre carcass, chassis flex and damper oil move
   most of the visible dive at 1/10 scale.
4. **Traction-limit assumption.** The split is the dynamic axle load, not a measured brake or
   drive ratio. That is the honest simplification for a single-motor car with no centre diff.
5. **No handling verdict.** The percentage says how much longitudinal transfer the links can
   carry; it does not say the car will be faster.

At 1/10 scale `L/h` is about 9, so a small hinge tilt produces a large percentage. The number is
a direction and a sensitivity, not a target.

---

> **Units.** The percentage multiplies `tan θ · L/h` by the axle's **dimensionless** share of the car's weight at the traction limit, `Fz/(m·g)`. Using `Fz/m` (m/s²) instead inflates every result by exactly g — an early build of this module reported −590 % where the geometry says −60 %. `axleLoadPerMass_mps2` is kept as a reported working quantity and is not an input to the percentage.

## 5. Worked example (reference car, one front screw +2 mm)

Reference front corner in the ground frame: `lca_in_a = (238, 12)`, `lca_in_b = (272, 14)`,
`lca_out = (259, 7)`, `uca_in = (250, 45)`, `uca_out = (254, 44)`, `x_cp = 257`, all mm.

```text
lower slope = (14 − 12)/(272 − 238) = 0.0588235
upper slope = (44 − 45)/(254 − 250) = −0.25

lower: z = 7 + 0.0588235·(x − 259)
upper: z = 45 − 0.25·(x − 250)
SVIC = (374.76, 13.81) mm
tan θ_f = 13.81/(257 − 374.76) = −0.1173
```

At 1.0 g braking, `m = 1.35 kg`, `h = 28 mm`, `L = 257 mm`:

```text
Fz_front/m = 9.81·0.45 + 9.81·0.028/0.257 = 5.4833 m/s²   (reported as a working quantity)
share      = (Fz_front/m)/g = 5.4833/9.81 = 0.55895          (dimensionless, used in the percentage)
anti-dive  = (−0.1173)·(257/28)·(0.55895)·100 = −60.16 %
```

Negative: the rear screw up moved the instant centre to the wrong side of the front patch, so
this is **pro-dive**, which is the sign test the issue asks for. With both screws level the same
car returns exactly **0.0 %**.

At the rear, the same construction with `x_cp = 0` and the rear upper link gives the anti-squat
sign; equal screw heights again return exactly 0.0 %.

---

## 6. Degenerate cases

| Condition | Behaviour |
|---|---|
| `z_a = z_b` (level hinge axis) | defined **0.0 %** — the zero-anti-dive limit |
| exact zero-slope parallel links | defined **0.0 %** — same limit |
| other parallel side-view links | `Undefined(parallelLinks)` |
| coincident inner screws or upper link points | `Undefined(degenerateGeometry)` |
| SVIC directly above/below the contact patch | `Undefined(outOfDomain)` |
| missing `body.cg.height` | `Undefined(incompleteModel)`, field named |
| braking at the front / acceleration at the rear only | the opposite event is a defined 0 % |

---

## 7. Golden cases (implemented in `packages/physics/test/anti-dive.test.ts`)

| ID | Input | Expected | Origin |
|---|---|---|---|
| G03.1 | reference screws level, `a_x = −1 g` | anti-dive 0.0 %, anti-squat 0.0 % | §3.4 |
| G03.2 | front aft screw +2 mm, `a_x = −1 g` | `tan θ_f = −0.1173`; SVIC (374.76, 13.81) mm; anti-dive **−60.16 %** | §5 |
| G03.3 | front aft screw +1…+5 mm | monotonic decreasing: −42.49 … −112.83 % | §3 |
| G03.4 | rear screw up, front | anti-dive < 0 (pro-dive) | §3.3 |
| G03.5 | fixed geometry, `|a_x|` 0.25…2.0 g | monotonic decreasing | §3.3 |
| G03.6 | front `Fz_front/m` at 1 g | 5.4833 m/s² — a working quantity, **not** the percentage input; the percentage uses `share = 0.55895` | §5 |
| G03.7 | non-zero-slope parallel links | `Undefined(parallelLinks)` | §3.4 |
| G03.8 | missing CG height | `Undefined(incompleteModel)` | §2 |
