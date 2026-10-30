# 10 — Chassis: material, thickness, mass and torsional stiffness

Build order: optional, after module 6. **Diagnostic**: nothing downstream depends on it except the
front/rear split of roll stiffness, and it never blocks another module. Requirement: GitHub issue #11.

---

## 1. Purpose

Answer the question "does the plate matter?", which a racer asks whenever they see a carbon chassis
listed against an aluminium one, or a 2.5 mm option against a 2.0 mm one.

| Output | Symbol | Unit | Shown as |
|---|---|---|---|
| Plate/rail mass | m_ch | g | computed from material, thickness and outline |
| Change in first moment (mass × CG height) | Δ(m·h) | g·mm | computed |
| Torsional stiffness | k_ch | N·m/rad, and N·m/deg | **measured** if supplied, else estimated with a band |
| Front and rear roll angle with a flexible chassis | φ_f, φ_r | ° | replaces module 6's single φ |
| Chassis twist at a given lateral g | φ_f − φ_r | arcmin | diagnostic |
| Balance with a flexible chassis | — | % | replaces module 6's rigid-chassis balance |
| Ride-height change implied by the thickness | Δz | mm | **explicit input**, §3.4 |

### 1.1 The correction this module exists to make

**Material and thickness do not move the roll centre.** The roll centre is fixed by hardpoint geometry
(module 2). Issue #11's premise — "it changes roll centres" — is wrong, and the module says so in the
UI rather than quietly producing a number that agrees with the premise. What a different plate actually
changes:

1. **Mass and CG height** (steel is 7.85 g/cm³ against CFRP's ~1.55), which moves load transfer.
2. **Ride height**, because the suspension mounts off the plate: a thicker plate lifts the whole car
   unless shims come out. That changes the roll moment arm and it *does* move the roll-centre
   *reading* — but through module 2's ride-height path, not through any direct effect of material.
3. **Torsional stiffness**, which is the interesting one: the chassis is a spring in series with the
   suspension, and on a 1/10 touring car it can be the softest element in that chain. The front/rear
   split of roll stiffness — the quantity that decides balance — is therefore partly a property of the
   plate rather than of the springs. On the reference car the difference between a rigid chassis and a
   2.0 mm CFRP plate is **3.5 percentage points of balance**, larger than most bar changes a racer
   makes in a session.

---

## 2. Inputs

| Input | Symbol | Unit | Range | Source |
|---|---|---|---|---|
| material | — | enum | `cfrp` \| `aluminium_6061` \| `steel` \| `other` | chassis card |
| shear modulus | G | GPa | see §2.1 | material table, overridable |
| density | ρ | g/cm³ | see §2.1 | material table |
| plate thickness | t | mm | 1.5 – 4.0 | caliper |
| plate width | w | mm | 70 – 110 | caliper |
| plate length (overall) | L_ch | mm | 200 – 350 | caliper |
| side-rail contribution factor | κ_rail | — | 1.0 – 3.0, default 1.0 | **assumed**; §3.2 |
| **measured torsional stiffness** | k_ch,meas | N·m/deg | 0.05 – 5 | **bench test** (99 §11) — overrides the estimate |
| **ride-height basis** | — | enum | `underside_clearance` \| `axle_height` | §3.4 |
| shim change when the plate thickness changes | Δz_shim | mm | −2 … +2, default 0 | user |

### 2.1 Material properties (defaults, with source)

From issue #11, quasi-isotropic handbook values:

| Material | E (GPa) | G (GPa) | ρ (g/cm³) | Note |
|---|---|---|---|---|
| CFRP, quasi-isotropic | 70 | **27** | 1.55 | G depends on weave and layup: treat the estimate as a range, ±30 % |
| Aluminium 6061-T6 | 69 | **26** | 2.70 | |
| Steel | 200 | **79** | 7.85 | |

These are `assumed` defaults, not measurements of the user's plate. A CFRP plate's real shear modulus
varies with layup by more than the difference between CFRP and aluminium, which is why the measured
torsion is the primary route and the estimator is labelled `chassisTorsionEstimated`.

---

## 3. Model

### 3.1 Torsion of the plate

Thin rectangular section in Saint-Venant torsion (w ≫ t):

```
J     = (1/3)·w·t³            [m⁴, w and t in metres]                          (10.1)
k_ch  = G·J / L_ch            [N·m/rad, G in Pa, L_ch in metres]               (10.2)
k_ch° = k_ch · π/180          [N·m/deg]                                        (10.3)
```

The units of (10.1)–(10.2) are stated because this module is where a millimetre/metre slip is most
likely: `t³` is a cube, so the old "implicit 10⁻³" would have been 10⁻⁹.

### 3.2 What the estimator leaves out, and the rail factor

A real chassis is not a flat plate: it has side rails, a top deck, motor mounts, and cut-outs for the
battery and the belt. The estimator is a flat plate of the same outline with an optional rail factor

```
k_ch,est = κ_rail · G·J/L_ch          κ_rail default 1.0, range 1.0 – 3.0
```

`κ_rail = 1.0` means "pretend there are no rails", which under-predicts stiffness; 3.0 is a guess for a
rail-heavy tub. **The estimator's job is to rank materials and thicknesses, not to state an absolute
number** — and it says so. Every balance number computed from an estimated `k_ch` carries
`chassisTorsionEstimated`; one computed from a measured value does not.

Priority: `k_ch,meas` if present → else `κ_rail·G·J/L_ch` → else the chassis is treated as rigid with
`chassisRigidAssumed`.

### 3.3 Mass and first moment

```
m_ch     = ρ·w·L_ch·t                     [from §2 units: g/cm³ × mm³ → 1e-3 g]  (10.4)
Δ(m·h)   = m_ch · z_ch                    z_ch = plate mid-height above ground    (10.5)
```

`z_ch` comes from the model, not from a guess: `ride_height + t/2` when the basis is
`underside_clearance`, or `axle_height − t/2` when it is `axle_height`. **If the model's `mass.total`
already includes the current plate, the module works in differences** — a material change contributes
`Δm_ch·z_ch`, not `m_ch·z_ch` — because adding the plate again would double-count it.

### 3.4 Ride height: explicit, never hidden

A thicker plate raises the suspension mounts by Δt. Whether that raises the *car* depends on what the
user held constant, and the module makes the user say:

| Basis | What is held | Consequence of `t → t + Δt` |
|---|---|---|
| `underside_clearance` (default) | plate underside above the road | every chassis-side hardpoint rises by Δt → module 2 sees **Δt of droop**, `h` rises by ≈ `(m_s/m)·Δt` |
| `axle_height` | wheel-centre height | the suspension absorbs Δt; hardpoints unchanged; only mass and `k_ch` change |

plus an explicit `Δz_shim` for the shims a user actually removes or adds when they change a plate:

```
Δz_effective = (basis == underside_clearance ? +Δt : 0) + Δz_shim           (10.6)
```

This is the "not a hidden effect" requirement: the number that reaches module 2 is a number the user
can see in the chassis card and override.

### 3.5 Roll stiffness in series

The chassis couples the two axles' roll. Module 6 already allocates the sprung roll moment `M_i` to the
axles by sprung force fraction; with a flexible chassis the two axles roll by different angles:

```
k_φ,f·φ_f + k_ch·(φ_f − φ_r) = M_f
k_φ,r·φ_r + k_ch·(φ_r − φ_f) = M_r

φ_f = [(k_φ,r + k_ch)·M_f + k_ch·M_r] / Det
φ_r = [k_ch·M_f + (k_φ,f + k_ch)·M_r] / Det
Det = (k_φ,f + k_ch)(k_φ,r + k_ch) − k_ch²                                    (10.7)
```

and module 6's elastic terms use `φ_i` in place of the single φ. Limits, both of which are golden cases:

- `k_ch → ∞`: `φ_f = φ_r = M_el/(k_φ,f + k_φ,r)`, i.e. module 6's (6.6) exactly — the extension must
  not change the rigid answer (G10.4).
- `k_ch → 0`: the axles are independent, `φ_f = M_f/k_φ,f`, `φ_r = M_r/k_φ,r`; the car twists freely
  and the balance is decided entirely by the moment allocation (a pathological case, flagged).

### 3.6 What the damping ratio does with this

The chassis stiffness gives the damper something to work against, which is where the "shock package"
question lives. v1 does **not** extend module 7 with it: a chassis-mode treatment needs a second
degree of freedom and a chassis damping ratio that nothing in the input contract supplies. Stated here
so the gap is recorded rather than discovered.

---

## 4. Worked example

Reference car: `w = 90 mm`, `L_ch = 300 mm`, `z_ch = 8.0 mm` (5.0 mm ride height + 2.0/2 = 6 → 8 mm with
the plate's centre at 6 mm and mounting bosses at 8 mm; **`z_ch = 8.0` is an assumption with the range
5–12 mm**), and the car's 1350 g already includes a 2.0 mm CFRP plate.

### 4.1 Torsional stiffness by material and thickness

```
CFRP, t = 2.0 mm:  J = (1/3)(0.090)(0.002)³ = 2.400e-10 m⁴
                   k_ch = 27e9 × 2.400e-10 / 0.300 = 21.60 N·m/rad = 0.3770 N·m/deg
```

| Material | t (mm) | J (m⁴) | k_ch (N·m/rad) | k_ch (N·m/deg) | m_ch (g) |
|---|---|---|---|---|---|
| CFRP | 2.0 | 2.400e-10 | **21.60** | 0.377 | 83.7 |
| CFRP | 2.5 | 4.688e-10 | 42.19 | 0.736 | 104.6 |
| 6061-T6 | 2.0 | 2.400e-10 | 20.80 | 0.363 | 145.8 |
| 6061-T6 | 2.5 | 4.688e-10 | 40.63 | 0.709 | 182.2 |
| steel | 2.0 | 2.400e-10 | **63.20** | 1.103 | 423.9 |
| steel | 2.5 | 4.688e-10 | 123.44 | 2.154 | 529.9 |

Carbon to steel at the same thickness is **2.9×** — exactly the G ratio (79/27), because `J` is
geometry. Thickness is the stronger lever: 2.0 → 2.5 mm is ×1.95, because `J ∝ t³` (1.25³ = 1.953).

### 4.2 What it does to the balance

Module 6's rigid answers: `k_φ,f = 37.274`, `k_φ,r = 28.368 N·m/rad`, `M_f = 0.10303`, `M_r = 0.13156
N·m`, `φ = 0.20476°`, balance 56.14 %.

With `k_ch = 21.60` (CFRP 2.0 mm), (10.7):

```
Det = (58.874)(49.968) − 466.56 = 2941.9 − 466.56 = 2475.3
φ_f = (49.968 × 0.10303 + 21.60 × 0.13156)/2475.3 = 7.9905/2475.3 = 0.0032279 rad = 0.18494°
φ_r = (21.60 × 0.10303 + 58.874 × 0.13156)/2475.3 = 9.9719/2475.3 = 0.0040282 rad = 0.23080°
ΔW_el,f = 37.274 × 0.0032279/0.172 = 0.69949 N     (rigid 0.77445)
ΔW_el,r = 28.368 × 0.0040282/0.174 = 0.65674 N     (rigid 0.58265)
balance = 100 × (0.69949+0.27735+0.13688)/((0.69949+0.27735+0.13688)+(0.65674+0.21058+0.13531))
        = 52.63 %                                  (rigid 56.14 %)
```

Twist `φ_r − φ_f = 0.0459° = 2.75 arcmin`. The front of the car rolls *less* than the rear because the
front is stiffer in roll, so the plate twiddles load transfer rearward: **3.5 percentage points of
balance**, in the understeer-reducing direction.

| k_ch (N·m/rad) | what | φ_f (°) | φ_r (°) | balance (%) |
|---|---|---|---|---|
| ∞ | rigid (module 6) | 0.20476 | 0.20476 | 56.14 |
| 123.44 | steel 2.5 | 0.19940 | 0.21180 | 55.19 |
| 63.20 | steel 2.0 | 0.19534 | 0.21714 | 54.47 |
| 42.19 | CFRP 2.5 | 0.19194 | 0.22160 | 53.87 |
| 21.60 | CFRP 2.0 | 0.18494 | 0.23080 | 52.63 |

### 4.3 Mass and ride height, which the balance table hides

Switching the 2.0 mm CFRP plate for 2.5 mm CFRP, on the `underside_clearance` basis:

```
Δm_ch   = 104.6 − 83.7 = +20.9 g
Δ(m·h)  = 20.9 × 8.0 = +167 g·mm                       (mass effect)
ride height: chassis rises 0.5 mm → h_s +0.5 mm → Δ(m·h) = 1110 × 0.5 = +555 g·mm
total   = +722 g·mm on a base of 1350 × 28 = 37 800 g·mm   →  +1.91 % on every load
z_rc    : 0.5 mm of droop → +0.73 mm  (9.9749 → 10.7049, computed on module 2's model; the
          heave table in 02 §6.6 gives the ±3 mm entries and the note under it gives this one)
```

Steel instead of CFRP at 2.0 mm: `Δm = +340 g`, `Δ(m·h) = +2720 g·mm` → **+7.2 % on every load**, plus
25 % more mass to accelerate (`a = F/m`), and the roll centre does not move at all unless the ride
height changes.

The numbers a racer would actually notice are in this order: mass (+7.2 % load transfer for steel),
torsion (±3.5 pp balance for the whole carbon-to-rigid range), and ride height (+1.9 % load transfer for
+0.5 mm). **The roll centre is not on the list.**

### 4.4 What the module refuses to claim

- That a stiffer plate makes the car faster. It moves the balance split; whether that helps is module 8's
  question and module 8 does not exist.
- That the estimator's `k_ch` is right. It is a flat-plate model of a shape with rails and holes; the
  measured value is the one to trust, and the badge says which one was used.
- That material alone tells you anything about feel. Two carbon plates of different layup differ more
  than carbon and aluminium at the same thickness.

---

## 5. Assumptions and where this breaks

1. **Saint-Venant torsion of a thin rectangle.** No warping restraint, no cut-outs, no top deck. Expect
   the estimate to be low by a factor of 1–3 on a real tub — which is what `κ_rail` is for and why it is
   labelled.
2. **The chassis is one spring, not a structure.** No local compliance at the suspension mounts, which
   on a 1/10 car may be the bigger effect (module 1 §9.1).
3. **Two-node roll model.** The twist is assumed linear front-to-rear; a chassis with a stiff centre
   section does not behave that way.
4. **Mass is added, not moved.** The module does not model relocating the battery, only adding or
   removing plate material.
5. **No chassis damping.** §3.6.
6. **CFRP is treated as isotropic.** Real laminates are not; the shear modulus is the weakest number in
   the module.

---

## 6. Degenerate cases

| Condition | Behaviour |
|---|---|
| `t = 0` or absent | no torsion estimate; chassis treated as rigid, `chassisRigidAssumed` |
| `material = other` with no `G` | `incompleteModel` naming `G` |
| `k_ch,meas` supplied | used, and `chassisTorsionEstimated` is **not** set |
| `k_ch < 1 N·m/rad` | warn: the chassis is a hinge; the two-node model is meaningless there |
| `Det ≤ 0` (numerically impossible for positive `k_φ` and `k_ch`, but guarded) | `Undefined(degenerateGeometry)` |
| `ride_height_basis` absent | `ASSUME(underside_clearance, flag)` — stated in the UI, because it changes every vertical number |
| `w` or `L_ch` absent with an estimated `k_ch` | `incompleteModel` naming the missing dimension |
| `m_ch` would exceed 25 % of `mass.total` | warn (`lowConfidence`): the model's own mass probably already includes a different plate |

---

## 7. Golden test cases

| ID | Input | Expected | Origin |
|---|---|---|---|
| G10.1 | CFRP, `w = 90`, `t = 2.0`, `L_ch = 300`, `G = 27 GPa` | J = 2.400e-10 m⁴; k_ch = 21.60 N·m/rad = 0.3770 N·m/deg | hand calc §4.1 |
| G10.2 | steel, same geometry | k_ch = 63.20 N·m/rad = 1.103 N·m/deg | hand calc §4.1 |
| G10.3 | CFRP, t 2.0 → 2.5 mm | k_ch × 1.953 (t³ law), mass × 1.25 | hand calc §4.1 |
| **G10.4** | `k_ch → ∞` | φ_f = φ_r = 0.20476°; balance = 56.14 % — reproduces module 6's (6.6) exactly | limit of (10.7) |
| **G10.5** | `k_ch = 21.60 N·m/rad` | φ_f = 0.18494°, φ_r = 0.23080°, twist 2.75 arcmin, balance = 52.63 % | hand calc §4.2 |
| **G10.6** | change material CFRP → steel at constant thickness, `ride_height_basis = axle_height` | **z_rc, y_rc and every module-2 output unchanged to 1e-12**; Δ(m·h) = +2720 g·mm (+7.2 %) | the correction in §1.1 — material does not move the roll centre |
| **G10.7** | same change with `ride_height_basis = underside_clearance` and Δt = 0.5 mm | z_rc 9.9749 → 10.705 mm (+0.73); every chassis-side hardpoint z +0.5 | module 2 §6.6, §3.4 |
| G10.8 | `t = 0` | rigid chassis, `chassisRigidAssumed`, no torsion number | §6 |
| G10.9 | measured `k_ch = 0.80 N·m/deg` supplied | used instead of the estimate (equivalent 45.84 N·m/rad → balance ≈ 54.0 %); badge is not `estimated` | §3.2 |

Tolerances: 1e-6 relative on stiffness, 1e-5 ° on angles, 0.01 pp on balance.

G10.6 is the case that makes the correction testable. An implementation that "makes material change the
roll centre" — which is what a literal reading of the feature request would produce — fails it, and no
amount of plausible-looking output will hide that.
