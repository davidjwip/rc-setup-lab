# 06 — Load transfer, balance and roll angle

Build order: 6 of 9. Depends on modules 2 (roll-centre heights), 5 (roll stiffness) and — optionally —
10 (chassis torsional stiffness).

This is where the app stops describing geometry and starts saying something a racer acts on: "your
change moved 4 % of the load transfer to the front". It is also where the model's ceiling is most
visible, because load transfer only becomes *handling* through the tyre, and v1 has no tyre.

---

## 1. Purpose

| Output | Symbol | Unit |
|---|---|---|
| Static corner weights | F_z | N (and g) |
| Total lateral load transfer (whole car) | TLLT | N |
| Roll moment resisted elastically | M_el | N·m |
| Chassis roll angle at a given lateral g | φ | ° |
| Elastic transfer, per axle | ΔW_el | N |
| Geometric transfer, per axle | ΔW_geo | N |
| Unsprung transfer, per axle | ΔW_u | N |
| Front share of total transfer ("balance") | — | % |
| Per-wheel vertical load at a given lateral g | F_z,i | N |
| Balance band (from the input uncertainties) | — | ± % |

**What changed in round 2.** (6.3) was framed as a per-axle equation while being a whole-car total
(M2), the inner-wheel fraction was printed as 68 % when the arithmetic gives 80 % (M1), `h_u` broke
its own default rule (M3), and the consistency identity in `99-validation.md` was unsatisfiable (M4).
CG height is now **inferred, never measured** (01 §4.5), and §6.7 states which outputs that affects.

**What changed in round 3 — `x_cg` was the 55 %-front value (D-1).** Round 2 printed
`x_cg = 257 × (1 − 0.45) = 141.35 mm`, which is the **55 %**-front CG, 25.7 mm forward of where a
45 %-front car's CG can be. Every number from `h_ra` onward inherited it, including the −1.223 %
residual that §3.7 then explained at length. The branch taken here is **`x_cg = 115.65 mm`** — the
45 % front split that the same section's corner weights (`m_s,f = 0.48749 kg`, front axle lighter)
already assert — because the alternative (keeping 141.35 and adopting `w_f = 0.55`) moves the corner
weights to 0.31125 kg front / 0.24375 kg rear, the ride frequencies to 9.541 / 11.623 Hz, the rigid
balance to 58.90 % and every ζ in module 7, i.e. it rewrites modules 1, 5 and 7 to preserve one
mistyped line. The trade-off is stated in full in 01 §8.1. `h_ra`, `M_el`, φ, both elastic terms, the
balance, the residual, the flexible-chassis split, the `h` table in §6.7 and G06.3–G06.10 are
re-derived below from the corrected value.

---

## 2. Inputs

| Input | Symbol | Unit | Range (1/10 TC) | Source |
|---|---|---|---|---|
| total mass | m | kg | 1.0 – 1.6 | measured |
| unsprung mass (all four corners) | m_u | kg | 0.16 – 0.32 | measured or estimated |
| CG height | h | mm | 15 – 45 | **inferred** (01 §4.5) — never `measured` |
| unsprung CG height | h_u | mm | 0.55 – 0.75 × tyre radius | assumed, default 0.625 R |
| CG x | x_cg | mm | from the weight split | measured or derived |
| front/rear static weight split | w_f | — | 0.40 – 0.55 | measured |
| roll-centre heights | z_rc,f / z_rc,r | mm | module 2 (rear: **assumed input**, 01 §8.4) | computed |
| roll stiffness per axle | k_φ,f / k_φ,r | N·m/rad | module 5 | computed |
| tracks | t_f / t_r | mm | 165 – 180 | module 1 |
| chassis torsional stiffness | k_ch | N·m/rad | 0 (rigid) – 500 | module 10, optional |
| lateral acceleration | a_y | m/s² | 0 – 24.5 | **analysis input** (see §8) |
| gravitational acceleration | g | m/s² | 9.81 | physical constant. Hong Kong latitude gives 9.788, a 0.2 % difference below every other uncertainty here; `g` is *not* `assumed` — it is known, and the value is stated so a reviewer can substitute |

Derived:

```
h_s = (m·h − m_u·h_u)/m_s          sprung CG height                              (6.1)
```

`h_s` must be derived this way, not assumed independently: an inconsistent triple (m, h, h_s) breaks
the consistency check in §3.7.

**`h_u`'s default rule, corrected.** Round 1 said "the wheel-centre height (= tyre radius)" and then
used 20.0 mm against a stated tyre radius of 32.0 mm, which breaks 00 §12's "no number that appears
nowhere else". The physically defensible answer is that the unsprung mass is concentrated at the hub
and upright, *below* the wheel centre: the rule is now **0.625 × tyre radius** (20.0 mm on this car),
range 0.55–0.75, labelled `estimated`. 20.0 mm is therefore an input consistent with its own rule
instead of a number that contradicts it. Using the wheel-centre height instead moves `h_s` from
29.73 to 27.14 mm, `M_el` by 12 % and the roll angle from 0.2048° to 0.1801° — which is the size of
the error the old rule was hiding.

---

## 3. Model

### 3.1 Static corner weights

```
F_z,front,corner = m·g·w_f/2
F_z,rear,corner  = m·g·(1 − w_f)/2                                             (6.2)
```

If the user has four corner weights, use them and report the discrepancy against (6.2); a
diagonal-split car has unequal left/right weights and the lateral numbers are then asymmetric — which
is the point of measuring.

### 3.2 Total lateral load transfer — one equation, stated once

```
TLLT [N] = m·a_y·h / t̄          with h in metres, t̄ the MEAN contact-patch track    (6.3)
```

This is the **whole-car** lateral load transfer, and `t̄` is the mean track (173 mm here), not an axle's
track. Round 1's heading said "for an axle of track t" and its text said "the whole-car total"; a
literal implementation against an axle returns 2.156 N for the front and 2.131 N for the rear, and the
app reports 4.29 N of transfer on a car that has 2.14 N — a 100 % error that still looks plausible.
Rename the function `totalLateralLoadTransfer(meanTrack)` and say what it takes.

What it does **not** depend on: springs, bars, roll centres, chassis stiffness. Total transfer is set
by mass, CG height and track. Setup changes only move it *around* between the axles. That is the most
useful sentence in this module and the app should say it on the balance screen.

The per-wheel split is not `ΔW/2` of this number at an axle — it is `ΔW_i/2` of that axle's total from
§3.4–§3.6. (Round 1's §3.2 said "the outer wheel gains ΔW/2", which is true for the whole car only if
the axles have equal tracks and get equal shares.)

### 3.3 The elastic path: roll moment and roll angle

```
h_ra = z_rc,r + (z_rc,f − z_rc,r)·(x_cg − x_cp,r)/l                             (6.4)
M_el = m_s·a_y·(h_s − h_ra)                                                     (6.5)
φ    = M_el / (k_φ,f + k_φ,r)                                                   (6.6)
```

`h_ra` is the roll-axis height at the sprung CG's longitudinal position; the linear interpolation is
exact for a straight roll axis, the standard assumption.

(6.6) is where a low roll centre does its work: it increases `h_s − h_ra`, so it *increases* roll. A
low roll centre does not reduce body roll; it increases the moment arm the springs must resist. That
counter-intuitive result is why the module is worth having, and the app shows `h_ra`, `M_el` and `φ`
side by side.

**With a flexible chassis (module 10 enabled)** there is no single φ. The two axles roll differently
and the chassis carries the difference:

```
M_i = M_el · (F_y,sprung,i / Σ F_y,sprung)          moment allocated by sprung force fraction
k_φ,f·φ_f + k_ch·(φ_f − φ_r) = M_f
k_φ,r·φ_r + k_ch·(φ_r − φ_f) = M_r
```

solved as a 2×2 system; ΔW_el,i then uses `φ_i`, not φ. With `k_ch → ∞` it reduces to (6.6) exactly
(G10.4), which is the test that the extension did not change the rigid answer.

### 3.4 Elastic and geometric split

```
ΔW_el,i  [N] = k_φ,i[N·m/rad] · φ_i[rad] / t_i[m]                              (6.7)
ΔW_geo,i [N] = F_y,i,sprung · z_rc,i[m] / t_i[m]                               (6.8)
```

with `F_y,i,sprung = m_s·a_y·(sprung weight fraction on axle i)`.

**Units, stated.** Round 1 declared `t` in mm, `h` in mm and `z_rc` in mm in the input table and then
wrote `0.172`, `0.028` and `0.009975` in the arithmetic with no conversion note — the same defect as
(5.7) and the reason 00 §2 no longer permits an implicit 10⁻³. Every symbol above is in SI inside the
package; the adapter is the only converter.

`ΔW_geo` is the part of the transfer carried directly by the links, because the lateral force is
reacted at the roll-centre height rather than at the CG. The higher the roll centre, the more of the
transfer happens geometrically, instantaneously, with no roll.

### 3.5 Unsprung contribution

```
ΔW_u,i = m_u,i · a_y · h_u[m] / t_i[m]                                         (6.9)
```

At 1/10 scale this is 10–15 % of the total — not negligible, and routinely ignored in hobbyist
calculators.

### 3.6 Front share ("balance")

```
ΔW_f,total = ΔW_el,f + ΔW_geo,f + ΔW_u,f
ΔW_r,total = ΔW_el,r + ΔW_geo,r + ΔW_u,r
balance    = 100 · ΔW_f,total / (ΔW_f,total + ΔW_r,total)                      (6.10)
```

Report the three components separately as well as the total: a front share can rise from more front
roll stiffness (elastic) or a higher front roll centre (geometric), and they feel different even when
the percentage is identical.

### 3.7 Consistency check

```
ΔW_sum = ΔW_f,total + ΔW_r,total
ΔW_ref = m·a_y·h/t̄
residual = (ΔW_sum − ΔW_ref)/ΔW_ref
```

The residual is **−0.055 % on the reference car** (round 2 printed −1.223 %, which was the 55 %-front
`x_cg` of D-1 and nothing else). It is not exactly zero: the geometric term is distributed by
*sprung force fraction* while the reference is a whole-car `m·a·h/t̄` with `h` the whole-car CG, and
the two different tracks and the separated unsprung height are second-order. On a self-consistent
`x_cg` those three effects together are worth five hundredths of a percent, i.e. the identity nearly
holds and the closure is a real test rather than a tolerance. Round 1 listed the three causes in the
wrong order and said "a few percent" without a number; round 2 then justified a loosened 5 % pass mark
with a residual that was an artefact of the arithmetic slip.

- The residual still moves with `h` (it is −0.12 % at `h = 18.693 mm`, G06.9), so a 5 % warning
  threshold remains a defect detector rather than a calibration: a wrong `x_cg`, a roll centre above
  the CG or a mistyped track pushes it to percent level immediately.
- A residual above 5 % means an input is inconsistent: show it as a warning, do not silently display
  the number.
- A user who changes the front weight split will see this move, and should be told why.

### 3.8 Longitudinal transfer (summary only)

```
ΔW_long = m·a_x·h/l                                                            (6.11)
```

Shown as a diagnostic; no handling claim is made from it. It is what module 3's anti-dive would act on
if the geometry supported the computation.

---

## 4. Assumptions and where this breaks

1. **Rigid, symmetric, steady-state.** A static equilibrium at constant lateral g. Transients — the
   part of an RC lap that matters most — are not represented.
2. **Linear springs and bars, no bump stops.** Once a car is on its droop screws the real distribution
   changes discontinuously.
3. **No tyre load sensitivity.** (6.3) says how much load moves; nothing about how much grip is lost.
   That is the model's real ceiling and module 8's subject.
4. **The roll-centre height is a force point, not a mechanism.** Using `z_rc` in (6.8) assumes the link
   forces are horizontal at the roll centre (Milliken ch. 18). It is wrong when the geometry is
   strongly asymmetric or the roll centre is far off centre — the normal case once the car rolls
   (module 2 §6.6).
5. **`h` is inferred, `h_u` is assumed.** Every load number scales linearly with `h`; §6.7 quantifies
   it and says which outputs are immune.
6. **No aero or gyroscopic terms.** Irrelevant at this scale.
7. **Ride height changes are not propagated to `h`.** v1 takes `h` from the model. Module 10 §3.4 does
   propagate a plate-thickness change, because that one is explicit.

---

## 5. Degenerate cases

| Condition | Behaviour |
|---|---|
| `m_u ≥ m` | validation error |
| `h_s < h_ra` (roll centre above the sprung CG) | negative `M_el`; report as computed, `flags: [rollCentreAboveCg]` — usually a mistyped `h` |
| `k_φ,total = 0` | `Undefined(noRollStiffness)` |
| `t_f` or `t_r` = 0 | validation error |
| `a_y = 0` | all transfers zero; `balance` is `Undefined(zeroLateral)` (0/0) — the other fields stay defined |
| corner weights supplied but inconsistent with the masses | warn, use the supplied values, show the residual |
| `k_ch` supplied as 0 | treated as **absent** (`chassisRigidAssumed`), not as an infinitely soft chassis |
| chassis torsion estimated from material | every balance number carries `chassisTorsionEstimated` |

---

## 6. Worked example

Reference car, `a_y = 1 g = 9.81 m/s²`.

### 6.1 Masses and geometry

```
m = 1.350 kg,  m_u = 0.240 kg,  m_s = 1.110 kg
h = 28.0 mm,   h_u = 20.0 mm
h_s = (1.350 × 28.0 − 0.240 × 20.0)/1.110 = 33.00/1.110 = 29.7297 mm
```

Front weight fraction 0.45:

```
F_z,f = 1.350 × 9.81 × 0.45 = 5.9596 N   → 2.9798 N per front corner (303.8 g)
F_z,r = 1.350 × 9.81 × 0.55 = 7.2839 N   → 3.6420 N per rear corner (371.3 g)
```

Sprung mass per axle, which is what modules 5 and 7 need:

```
m_s,f = (5.9596 − 0.120 × 9.81)/9.81 = (5.9596 − 1.1772)/9.81 = 0.48749 kg  → 0.24375 kg per corner
m_s,r = (7.2839 − 1.1772)/9.81 = 0.62249 kg                                → 0.31125 kg per corner
sprung front fraction = 0.48749/1.110 = 0.43919
```

### 6.2 Total transfer

```
TLLT = 1.350 × 9.81 × 0.028/0.173 = 0.37079/0.173 = 2.1435 N
```

**2.14 N moves from the inside to the outside of the car at 1 g**, 16 % of the car's 13.24 N weight.

### 6.3 Roll moment and roll angle

Roll-centre heights: `z_rc,f = 9.9749 mm` (module 2 §6.2); `z_rc,r = 6.000 mm` — an **assumed input**
for this example, range 0–20 mm, because the reference car has no rear hardpoints (01 §8.4).

```
x_cg = 257 × 0.45 = 115.65 mm
h_ra = 6.000 + (9.9749 − 6.000) × 115.65/257 = 6.000 + 1.7887 = 7.789 mm
M_el = 1.110 × 9.81 × (29.7297 − 7.7887)/1000 = 10.889 × 0.021941 = 0.23892 N·m
φ    = 0.23892/65.642 = 0.0036397 rad = 0.20854°
```

`x_cg` is `w_f · l`, not `(1 − w_f) · l`: with a 45 % front split the CG sits 45 % of the wheelbase
ahead of the rear axle, i.e. 115.65 mm, and `141.35 mm` (round 2's figure) is the 55 %-front position.
The front axle carries 5.96 N against the rear's 7.28 N in §6.1, so the CG must be *behind* mid-
wheelbase; 141.35 mm puts it 12.9 mm ahead of mid-wheelbase (and 25.7 mm ahead of the 45 %-front
value), which contradicts the rest of the module. Only one of the two can be kept, and the masses that
modules 5 and 7 consume come from the same 45/55 split, so the split stays and the distance moves.

**0.21° of roll at 1 g** — the "chassis roll sensitivity" number, and the sense of it is worth stating:
a *lower* roll centre gives a *larger* `h_s − h_ra` and therefore *more* roll at the same lateral g.
(The arithmetic prints φ in both rad and degrees because round 1's (6.6) result was quoted in degrees
while the substituted constants were SI, which is how a factor-of-57 error survives review.)

### 6.4 The split

```
ΔW_el,f = 37.274 × 0.0036397/0.172 = 0.78876 N
ΔW_el,r = 28.368 × 0.0036397/0.174 = 0.59340 N

F_y,sprung,f = 1.110 × 9.81 × 0.43919 = 4.7823 N
ΔW_geo,f = 4.7823 × 0.0099749/0.172   = 0.27735 N
F_y,sprung,r = 1.110 × 9.81 × 0.56081 = 6.1068 N
ΔW_geo,r = 6.1068 × 0.006000/0.174    = 0.21058 N

ΔW_u,f = 0.120 × 9.81 × 0.020/0.172 = 0.13688 N
ΔW_u,r = 0.120 × 9.81 × 0.020/0.174 = 0.13531 N

ΔW_f = 0.78876 + 0.27735 + 0.13688 = 1.20299 N
ΔW_r = 0.59340 + 0.21058 + 0.13531 = 0.93929 N
sum  = 2.14228 N
```

### 6.5 Balance, consistency and per-wheel loads

```
balance = 100 × 1.20299/2.14228 = 56.15 % front
residual vs (6.3): (2.14228 − 2.14346)/2.14346 = −0.055 %
```

So at 1 g, **56.1 % of the load transfer is on the front axle, whose static share of the weight is
45 %.** Per wheel (left-hand corner, right wheels loaded):

```
front outer = 2.9798 + 1.20299/2 = 3.5813 N (120.2 % of static)
front inner = 2.9798 − 1.20299/2 = 2.3783 N ( 79.8 % of static)
rear outer  = 3.6420 + 0.93929/2 = 4.1116 N (112.9 %)
rear inner  = 3.6420 − 0.93929/2 = 3.1723 N ( 87.1 %)
```

The front axle's inner wheel drops to **80 %** of its static load while the outer rises to **120 %**.
Round 1 printed "68 %" beside a correct 120 %, a pair that cannot both be true because the two must
average 100 %. This is the number module 8 would put next to the tyre's load sensitivity, so it is the
one number from module 6 that survives into a claim.

### 6.6 What a change does

Adding front roll stiffness increases `k_φ,f`, which increases ΔW_el,f and, through (6.6), *decreases*
φ for both axles. The net effect on balance is sub-linear; the app shows the recomputed numbers rather
than a rule of thumb. With a flexible chassis the effect is muted further, because part of the extra
front stiffness is spent twisting the plate (§6.8).

### 6.7 Robustness to CG height — what the UI must show

Recomputing §6.1–§6.5 across the plausible `h` range (all from the same script, `h_u` and the geometry
held fixed):

| h (mm) | h_s (mm) | M_el (N·m) | φ (°) | TLLT (N) | balance (%) |
|---|---|---|---|---|---|
| 24.0 | 24.865 | 0.18594 | 0.1623 | 1.8372 | 56.00 |
| 26.0 | 27.297 | 0.21243 | 0.1854 | 1.9904 | 56.08 |
| 28.0 | 29.730 | 0.23892 | 0.2085 | 2.1435 | 56.15 |
| 30.0 | 32.162 | 0.26541 | 0.2317 | 2.2966 | 56.22 |
| 32.0 | 34.595 | 0.29189 | 0.2548 | 2.4497 | 56.27 |

- **Balance is robust**: ±0.13 percentage points across the whole 24–32 mm range, because both axles
  scale with the same `h`. A 3 mm CG error moves the balance by **0.09 pp** (56.155 → 56.243 % at
  28 → 31 mm) — smaller than the 0.5 % display step, and far smaller than the ±1.5 pp that a bar
  measurement alone puts under the number.
- **Absolute transfer and roll angle are not**: TLLT ±14.3 % and φ ±22.2 % over the same range, i.e.
  **3.57 % of the transfer per mm** of `h` (13.24 N × 0.001/0.173 = 0.0766 N per mm on a 2.1435 N
  total). Round 2 printed "±1.6 % of load per mm", which was 2.2× low; its ±14.4 % and ±23 % were
  within rounding of the re-derived ±14.3 % and ±22.2 % (`h_s − h_ra` runs 17.08 → 26.81 mm across the
  range, and both quantities scale with it).

So the badge and the band go on the **magnitude**, not on the balance. Round 1 had this exactly
backwards in two places: `99-validation.md` §7 justified 0.1 % balance precision with "CG height
uncertainty dominates below that" (it does not — see the table), and module 6 §8 told the reader a
0.2 % balance difference was "below the precision of the CG-height input". The things that actually
swamp a 0.2 % balance difference are the bar diameter (±1.2 pp for ±0.05 mm) and chassis torsion
(±3.5 pp, §6.8).

### 6.8 With a flexible chassis (module 10)

`k_ch = 21.60 N·m/rad` (2.0 mm CFRP, module 10 §4), `M_f = 0.10493 N·m`, `M_r = 0.13399 N·m`:

```
φ_f = 0.18836°,  φ_r = 0.23506°      (twist 2.80 arcmin, front lower)
ΔW_el,f = 0.71242 N   ΔW_el,r = 0.66886 N     (rigid: 0.78876 / 0.59340)
ΔW_f = 1.12665 N      ΔW_r = 1.01475 N
balance = 52.61 %     (rigid: 56.15 %)
```

**Three and a half percentage points of balance from the plate alone** (56.15 → 52.61 = 3.54 pp),
which is larger than any bar change a racer is likely to make in a session. That is issue #11's point
and the reason module 10 is worth having even though it does not move the roll centre.

---

## 7. Golden test cases

| ID | Input | Expected | Origin |
|---|---|---|---|
| G06.1 | reference car, a_y = 1 g | corner weights 2.9798 N / 3.6420 N | hand calc §6.1 |
| G06.2 | reference car, a_y = 1 g, t̄ = 173 mm | TLLT = 2.1435 N | hand calc §6.2 |
| G06.3 | reference car, a_y = 1 g | h_s = 29.7297 mm; h_ra = 7.789 mm; M_el = 0.23892 N·m; φ = 0.20854° | hand calc §6.3 |
| G06.4 | reference car, a_y = 1 g | ΔW_f = 1.20299 N, ΔW_r = 0.93929 N, balance = 56.15 % | hand calc §6.4–6.5 |
| **G06.5** | reference car, a_y = 1 g | front outer 3.5813 N (**120.2 %**), front inner 2.3783 N (**79.8 %**); and `inner + outer = 2 × static` to 1e-9; rear 87.1 % / 112.9 % | hand calc §6.5 |
| G06.6 | k_φ,total forced to 0 | `Undefined(noRollStiffness)` | §5 |
| G06.7 | a_y = 0 | all transfers 0; balance `Undefined(zeroLateral)`; the other fields defined | §5 |
| G06.8 | consistency residual for §6 | −0.055 % ± 0.002 | hand calc §6.5 |
| **G06.9** | reference car with `h = 18.693 mm` (the component-mass estimate, 01 §4.5) | TLLT = 1.4310 N, φ = 0.10095°, balance = 55.70 % — magnitude moves −33 %, balance moves −0.46 pp | hand calc §6.7, 01 §4.5 |
| **G06.10** | reference car with `k_ch = 21.60 N·m/rad` (2.0 mm CFRP) | φ_f = 0.18836°, φ_r = 0.23506°, balance = 52.61 % | hand calc §6.8 |
| **G06.11** | **balance invariant to `a_y`**: 0.1 g and 2.5 g | balance identical to 1e-9; loads scale | identity — round 1 verified this numerically but never asserted it |
| **G06.12** | **`x_cg` must equal `w_f · l`**: reference car, 45 % front | `x_cg` = 115.65 mm, and `x_cg = (1 − w_f) · l` fails the case (141.35 mm → h_ra 8.186, balance 56.14, residual −1.223 %) | D-1; catches the round-2 slip in one assertion |

Tolerances: 1e-4 N, 1e-3 %, 1e-5 ° on the roll angle.

---

## 8. How to read the balance number (teaching copy)

- Total transfer does not change when you change springs or bars. It is mass × CG height ÷ track.
- What you change is **where** it happens: front vs rear, and instant vs rolled.
- Higher front share → the front tyres carry more of the load change → less front grip relative to the
  rear → understeer, *all else equal*. "All else equal" is doing a lot of work in that sentence.
- The balance number is a % of a force, not a % of grip. Without a tyre model we can tell you the
  direction it moves, not how far the car's behaviour moves with it.
- **The lateral-g input changes the loads, not the balance.** The balance percentage is exactly
  invariant to `a_y` (G06.11: 56.15 % at 0.1 g and at 2.5 g). Say that in the picker, and the "fake
  input" stops being a fake input.
- A 1 % change in balance is small. A 5 % change is worth a setup change. But the honest floor is
  **±1.5 pp** for a bar measurement (±1.2 pp of it from the diameter alone) and **±3.5 pp** if the
  chassis stiffness is unknown — so a 0.2 % difference between two setups is below what this model can
  see, and the app should say so rather than present it as a finding.
