# 06 — Load transfer, balance and roll angle

Build order: 6 of 9. Depends on modules 2 (roll-centre heights) and 5 (roll stiffness).

This module is where the app stops describing geometry and starts saying something a racer acts on:
"your change moved 4% of the load transfer to the front". It is also where the model's ceiling is
most visible, because load transfer only becomes *handling* through the tyre, and v1 has no tyre.

---

## 1. Purpose

| Output | Symbol | Unit |
|---|---|---|
| Static corner weights | F_z | N (and g) |
| Total lateral load transfer | TLLT | N |
| Roll moment resisted elastically | M_el | N·m |
| Chassis roll angle at a given lateral g | φ | ° |
| Elastic transfer, per axle | ΔW_el | N |
| Geometric transfer, per axle | ΔW_geo | N |
| Unsprung transfer, per axle | ΔW_u | N |
| Front share of total transfer ("balance") | — | % |
| Per-wheel vertical load at a given lateral g | F_z,i | N |

### 1.1 What the predecessor computed, and what is ours

Stated here because the review rules require it and because it changes what the UI may claim.

| Quantity | RC3 | Us |
|---|---|---|
| Total lateral load transfer | yes ("TLLT") | yes |
| Front/rear split of it ("weight transfer balance") | yes | yes |
| Roll angle / "chassis roll sensitivity" | yes | yes |
| Geometric vs elastic decomposition | not evidenced in the corpus | **ours** |
| Unsprung mass term shown separately | not evidenced | **ours** |
| Conversion of transfer into grip or balance judgement | none (no tyre model) | none (no tyre model) |

The last row is the important one: neither the predecessor nor we can say "this will understeer".
We can say "this moves 3% more of the load transfer to the front". Module 8 explains why that gap
cannot be closed honestly in v1.

---

## 2. Inputs

| Input | Symbol | Unit | Range (1/10 TC) | Source |
|---|---|---|---|---|
| total mass | m | kg | 1.0 – 1.6 | measured |
| unsprung mass (all four corners) | m_u | kg | 0.16 – 0.32 | measured or estimated |
| CG height | h | mm | 15 – 45 | **assumed** unless measured |
| unsprung CG height | h_u | mm | ≈ wheel centre height | assumed |
| CG x | x_cg | mm | from the weight split | measured |
| front/rear static weight split | — | % | 40/60 – 55/45 | measured |
| roll-centre heights | z_rc,f / z_rc,r | mm | module 2 | computed |
| roll stiffness per axle | k_φ,f / k_φ,r | N·m/rad | module 5 | computed |
| tracks | t_f / t_r | mm | 165 – 180 | module 1 |
| lateral acceleration | a_y | g | 0 – 2.5 | **analysis input**, not measured |
| gravitational acceleration | g | m/s² | 9.81 | physical constant, `assumed` (Hong Kong latitude: 9.788; the 0.2% difference is below every other uncertainty here) |

Derived, not input:

```
h_s = (m·h − m_u·h_u)/m_s          sprung CG height                              (6.1)
```

`h_s` must be derived this way, not assumed independently: an inconsistent triple (m, h, h_s)
silently breaks the consistency check in §3.7.

`h_u` default: the wheel-centre height (= tyre radius), because that is where most of an RC car's
unsprung mass is. Labelled `assumed`.

---

## 3. Model

### 3.1 Static corner weights

```
F_z,front,corner  = (m·g·w_f)/2
F_z,rear,corner   = (m·g·(1 − w_f))/2                                     (6.2)
```

where `w_f` is the front weight fraction. If the user has corner-weight data (four numbers), use it
and report the discrepancy against (6.2); a diagonal-split car has unequal left/right weights and
the model's lateral numbers are then asymmetric — which is the point of measuring.

### 3.2 Total lateral load transfer

For an axle of track t:

```
ΔW = m · a_y · h / t                                                      (6.3)
```

with `a_y` in m/s² (so `a_y = g` at 1 g). This is the whole-car lateral load transfer felt by one
axle's pair of wheels; the outer wheel gains `ΔW/2` and the inner loses `ΔW/2` relative to the
static value, in the rigid-axle sense.

Note what it does **not** depend on: springs, bars, roll centres. Total transfer is set by mass,
CG height and track. Setup changes only move it around between the axles. That is the single most
useful sentence in this module and the app should say it on the balance screen.

### 3.3 The elastic path: roll moment and roll angle

The sprung mass's lateral force acts at `h_s`; the links react it at the roll axis. The difference
is the moment the springs and bars must carry:

```
h_ra = z_rc,r + (z_rc,f − z_rc,r)·(x_cg − x_cp,r)/l                       (6.4)
M_el = m_s · a_y · (h_s − h_ra)                                           (6.5)
φ    = M_el / (k_φ,f + k_φ,r)                                              (6.6)
```

`h_ra` is the roll-axis height at the sprung CG's longitudinal position — the linear interpolation
is exact for a roll axis that is straight between the two axle roll centres, which is the standard
assumption.

Equation (6.6) is the "roll angle at a given lateral g" the brief asks for, and it is where a low
roll centre does its work: it increases `h_s − h_ra`, so it *increases* roll. A low roll centre does
not reduce body roll; it increases the moment arm that the springs must resist. This is the
counter-intuitive result that makes the module worth having, and the app should show `h_ra`, `M_el`
and `φ` side by side so the user can see it.

### 3.4 Elastic and geometric split

Per axle:

```
ΔW_el,i  = k_φ,i · φ / t_i                                                (6.7)
ΔW_geo,i = F_y,i,sprung · z_rc,i / t_i                                    (6.8)
```

with `F_y,i,sprung = m_s·a_y·(sprung weight fraction on axle i)`.

`ΔW_geo` is the part of the transfer carried directly by the links, because the lateral force is
reacted at the roll-centre height rather than at the CG. The higher the roll centre, the more of the
transfer happens geometrically (instantaneously, with no roll) and the less happens through the
springs.

### 3.5 Unsprung contribution

The unsprung mass has its own CG height and no springs between it and the road:

```
ΔW_u,i = m_u,i · a_y · h_u / t_i                                          (6.9)
```

At 1/10 scale this is 10–15% of the total, which is not negligible and is routinely ignored in
hobbyist calculators.

### 3.6 Front share ("balance")

```
ΔW_f,total = ΔW_el,f + ΔW_geo,f + ΔW_u,f
ΔW_r,total = ΔW_el,r + ΔW_geo,r + ΔW_u,r
balance    = 100 · ΔW_f,total / (ΔW_f,total + ΔW_r,total)                 (6.10)
```

Report the three components separately as well as the total. A car whose front share rises can get
there two ways — more front roll stiffness (elastic) or a higher front roll centre (geometric) — and
they feel different even when the percentage is identical (see §6).

### 3.7 Consistency check

Sum the per-axle totals and compare with (6.3) evaluated at the mean track:

```
ΔW_sum = ΔW_f,total + ΔW_r,total
ΔW_ref = m·a_y·h/t̄
residual = (ΔW_sum − ΔW_ref)/ΔW_ref
```

The residual should be within a few percent. It is not exactly zero, and the reasons are worth
knowing: the two axles have different tracks (so a single `t̄` cannot be exact), the unsprung masses
sit at a different height from the total CG, and the geometric term is distributed by *sprung* force
fraction rather than by total. A residual above 5% means an input is inconsistent, and the app
should show it as a warning rather than silently displaying the number.

### 3.8 Longitudinal transfer (summary only)

```
ΔW_long = m · a_x · h / l                                                 (6.11)
```

This is the load transfer that anti-dive and anti-squat act on, which is why it lives in this module
and why module 3 exists. It is shown as a diagnostic; no handling claim is made from it.

---

## 4. Assumptions and where this breaks

1. **Rigid, symmetric, steady-state.** The model is a static equilibrium at a constant lateral g.
   Transients (turn-in, kerbs) are not represented — and on an RC car the transient is most of the
   lap.
2. **Linear springs and bars, no bump stops.** Once a car is on its droop screws or into a bump
   stop, the real transfer distribution changes discontinuously. Not modelled.
3. **No tyre load sensitivity.** (6.3) says how much load moves; it says nothing about how much grip
   is lost. Two cars with the same balance number and different tyres behave differently. This is
   the model's real ceiling and the reason module 8 exists.
4. **The roll-centre height is a force point, not a mechanism.** Using `z_rc` in (6.8) assumes the
   link forces are horizontal at the roll centre, which is the standard idealisation (Milliken ch.
   18). It is wrong when the geometry is strongly asymmetric or the roll centre is far off centre —
   which, per module 2 §6.6, is the normal case once the car rolls.
5. **`h`, `h_u` are assumptions.** Every number in this module scales linearly with `h`. A 3 mm CG
   height error is a 10% error in the total transfer. This is the single largest input uncertainty in
   the whole package and the app must flag `h` as `assumed` when it is not measured.
6. **No aerodynamic or gyroscopic terms.** Irrelevant at this scale, stated for completeness.
7. **Ride height changes are not propagated to `h`.** Raising the car raises the CG. v1 takes `h`
   from the model, not from the ride height, and says so.

---

## 5. Degenerate cases

| Condition | Behaviour |
|---|---|
| `m_u ≥ m` | validation error |
| `h_s < h_ra` (roll centre above the sprung CG) | negative `M_el` → the car would roll the "wrong" way; report as computed, flag `rollCentreAboveCg` — usually a mis-typed CG height |
| `k_φ,total = 0` | `Undefined(noRollStiffness)` — division by zero; a car with no springs |
| `t = 0` | validation error |
| `a_y = 0` | all transfers zero, `balance` undefined (0/0) → report `undefinedAtZeroLateral` |
| corner weights supplied but inconsistent with the masses | warn, use the supplied values, show the residual |

---

## 6. Worked example

Reference car, `a_y = 1 g = 9.81 m/s²`.

### 6.1 Masses and geometry

```
m = 1.350 kg,  m_u = 0.240 kg,  m_s = 1.110 kg
h = 28.0 mm,   h_u = 20.0 mm
h_s = (1.350 × 28.0 − 0.240 × 20.0)/1.110 = (37.80 − 4.80)/1.110 = 33.00/1.110 = 29.7297 mm
```

Front weight fraction 0.45:

```
F_z,f = 1.350 × 9.81 × 0.45 = 5.9596 N   → 2.9798 N per front corner = 303.8 g
F_z,r = 1.350 × 9.81 × 0.55 = 7.2839 N   → 3.6420 N per rear corner = 371.3 g
```

Sprung mass per axle:

```
m_s,f = (5.9596 − 0.120 × 9.81)/9.81 = (5.9596 − 1.1772)/9.81 = 0.48749 kg
m_s,r = (7.2839 − 1.1772)/9.81 = 0.62249 kg
sprung front fraction = 0.48749/1.110 = 0.43918
```

### 6.2 Total transfer

```
ΔW = m·a_y·h/t = 1.350 × 9.81 × 0.028/0.173 = 0.37079/0.173 = 2.1435 N
```

(`t̄ = 173 mm`, the mean of 172 and 174.) So **2.14 N moves from the inside to the outside of the
car at 1 g**, which is 16% of the car's 13.24 N weight.

### 6.3 Roll moment and roll angle

Roll-centre heights from module 2: `z_rc,f = 9.975 mm`; `z_rc,r = 6.000 mm` (assumed for this
example from a similar rear geometry — the app computes it the same way as the front).

```
x_cg = 257 × (1 − 0.45) = 141.35 mm
h_ra = 6.000 + (9.975 − 6.000) × 141.35/257 = 6.000 + 2.186 = 8.186 mm
M_el = 1.110 × 9.81 × (29.7297 − 8.186)/1000 = 10.889 × 0.021544 = 0.23459 N·m
φ    = 0.23459/65.643 = 0.0035736 rad = 0.20476°
```

**0.20° of roll at 1 g.** That is the number the app shows as "chassis roll sensitivity", and the
sense of it is worth stating: a *lower* roll centre gives a *larger* `h_s − h_ra` and therefore
*more* roll at the same lateral g. RC3's teaching said the same thing — lowering the roll centre
increases camber change through roll — and this is the equation behind it.

### 6.4 The split

Elastic, from (6.7):

```
ΔW_el,f = 37.274 × 0.0035736/0.172 = 0.13321/0.172 = 0.77448 N
ΔW_el,r = 28.369 × 0.0035736/0.174 = 0.10138/0.174 = 0.58264 N
```

Geometric, from (6.8):

```
F_y,sprung,f = 1.110 × 9.81 × 0.43918 = 4.7823 N
ΔW_geo,f = 4.7823 × 0.009975/0.172 = 0.047704/0.172 = 0.27735 N

F_y,sprung,r = 1.110 × 9.81 × 0.56082 = 6.1068 N
ΔW_geo,r = 6.1068 × 0.006000/0.174 = 0.036641/0.174 = 0.21058 N
```

Unsprung, from (6.9):

```
ΔW_u,f = 0.120 × 9.81 × 0.020/0.172 = 0.023544/0.172 = 0.13688 N
ΔW_u,r = 0.120 × 9.81 × 0.020/0.174 = 0.023544/0.174 = 0.13531 N
```

Totals:

```
ΔW_f = 0.77448 + 0.27735 + 0.13688 = 1.18871 N
ΔW_r = 0.58264 + 0.21058 + 0.13531 = 0.92853 N
sum  = 2.11724 N
```

### 6.5 Balance and consistency

```
balance = 100 × 1.18871/2.11724 = 56.14% front
residual vs (6.3): (2.11724 − 2.1435)/2.1435 = −1.23%   ✓ within tolerance
```

So at 1 g: **56.1% of the load transfer is on the front axle, whose static share of the weight is
45%.** In the classical reading, more transfer on the front than its weight share means the front
tyres lose grip before the rears — understeer. The app should present that as *the direction the
balance number points*, with the caveat in §4.3.

Per-wheel loads at 1 g (left-hand corner, so the right wheels are loaded):

```
front outer = 2.9798 + 1.18871/2 = 3.5741 N = 364.4 g
front inner = 2.9798 − 1.18871/2 = 2.3855 N = 243.2 g
rear outer  = 3.6420 + 0.92853/2 = 4.1063 N = 418.6 g
rear inner  = 3.6420 − 0.92853/2 = 3.1777 N = 324.0 g
```

The front axle's inner wheel drops to 68% of its static load while the outer rises to 120%. That
ratio — not the percentage balance — is what the tyre actually sees, and it is the number to show
next to the tyre's own load sensitivity when module 8 arrives.

### 6.6 What a change does

Adding roll stiffness at the front (a thicker front bar) increases `k_φ,f`, which increases
`ΔW_el,f` and, through (6.6), *decreases* `φ` for both axles. The net effect on balance is
sub-linear, and the app should show the recomputed numbers rather than a rule of thumb. This is the
classic "stiffer front bar = more understeer" result, but the model's version of it is quantitative
and includes the roll-angle feedback.

---

## 7. Golden test cases

| ID | Input | Expected | Origin |
|---|---|---|---|
| G06.1 | reference car, a_y = 1 g | corner weights 2.9798 N / 3.6420 N | hand calc §6.1 |
| G06.2 | reference car, a_y = 1 g, t̄ = 173 mm | TLLT = 2.1435 N | hand calc §6.2 |
| G06.3 | reference car, a_y = 1 g | h_s = 29.7297 mm; h_ra = 8.186 mm; M_el = 0.23458 N·m; φ = 0.20476° | hand calc §6.3 |
| G06.4 | reference car, a_y = 1 g | ΔW_f = 1.18871 N, ΔW_r = 0.92853 N, balance = 56.14% | hand calc §6.4–6.5 |
| G06.5 | reference car, a_y = 1 g | front outer 3.5741 N, front inner 2.3855 N | hand calc §6.5 |
| G06.6 | k_φ,total forced to 0 | `Undefined(noRollStiffness)` | spec §5 |
| G06.7 | a_y = 0 | all transfers 0, balance `undefinedAtZeroLateral` | spec §5 |
| G06.8 | consistency residual for §6 | −1.23% ± 0.05 | hand calc §6.5 |

Tolerances: 1 × 10⁻⁴ N, 1 × 10⁻³ %, 1 × 10⁻⁵ ° on the roll angle.

---

## 8. How to read the balance number (teaching copy)

- Total transfer does not change when you change springs or bars. It is mass × CG height ÷ track.
- What you change is **where it happens**: front vs rear, and instant vs rolled.
- Higher front share → the front tyres carry more of the load change → less front grip relative to
  the rear → understeer, *all else equal*. "All else equal" is doing a lot of work in that sentence.
- The balance number is a % of a force, not a % of grip. Without a tyre model we can tell you the
  direction it moves, not how far the car's behaviour moves with it.
- A 1% change in balance is small. A 5% change is worth a setup change. If the app shows a 0.2%
  difference between two setups, that is below the precision of the CG-height input and the app
  should say so rather than present it as a finding.
