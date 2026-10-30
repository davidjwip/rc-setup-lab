# 07 — Damping

Build order: 7 of 9. Depends on module 5 (wheel rate, critical damping, installation ratio) and on the
damper fields in the input contract (01 §4.4).

Damping is the part of RC setup the community understands least and argues about most, and the part
where a model without a shock dyno is most tempted to bluff. This module is written to make the bluff
impossible: it states exactly which inputs it needs, what it can predict from geometry alone, and what
it cannot.

---

## 0. What ζ is in v1, and what it is not (owner decision, 2026-10-30)

**ζ ships in v1 as an estimate** (decision **D-13**). Not a validated number, not a curve fit to a dyno, and not a
single-decimal absolute claim about a particular shock — an **estimate with a band**, an `estimated`
badge, and a **direction of change that must be trustworthy**.

The distinction is the whole design:

| The user's question | Can v1 answer it? | How it is shown |
|---|---|---|
| "If I go up 50 cSt of oil, does damping go up or down?" | **yes, and monotonically** | the direction table (§9), no number needed |
| "If I lay the shock down, what happens to ζ?" | **yes** — ζ ∝ IR exactly | §9, with the coefficient |
| "If I fit a 4-hole piston, how much less damping at 50 mm/s?" | **yes**, geometry-dominated | §9, about −44 % |
| "Is my car at ζ = 0.25 or 0.35?" | only to ±30 % | the number with its band and `estimated` badge |
| "What is my damping *below 20 mm/s*?" | **no** — stiction dominates (0.5–2 N against 0.21 N modelled) | number shown, flagged `belowFrictionFloor`, direction only |
| "Will it land off this jump?" | no | out of scope |

Round 1's version of this module said "do not show a single damping ratio" (its §8) and `99 §5.3`
said the same, while the requirements made ζ a v1 output — three documents, three answers. The owner
has resolved it: ζ is shown, as an estimate, with its band. §8 is rewritten to say how, not whether.

**The two parameters that set the absolute level, `F_bo` and `c_post`, are dyno-only.** They are
`ASSUME(4.0 N / 12 N·s/m, flag estimatedDamper)` in the input contract (01 §4.4), which is why the
band exists. Everything the model says about *direction* survives that assumption; almost nothing it
says about *level* does.

---

## 1. Purpose

| Output | Symbol | Unit | Shown as |
|---|---|---|---|
| Critical damping, per corner | c_crit | N·s/m | a derived number, exact given k_w and m_s |
| Damping ratio vs shaft speed | ζ(v) | — | estimate + band, `estimated` |
| Damper force vs shaft speed | F(v) | N | estimate + band |
| Damper force at the wheel | F_wheel(v) | N | estimate + band |
| Blow-off speed and force | v_bo, F_bo | m/s, N | `assumed` unless dyno-fitted |
| Direction of change for each lever | — | sign + % | §9, no band, this is the headline |
| Temperature sensitivity | ∂ζ/∂T | %/K | direction + magnitude above blow-off only |

---

## 2. Inputs

### 2.1 Geometry and rates

| Input | Symbol | Unit | Range (1/10 TC) | Source |
|---|---|---|---|---|
| piston (displaced) area | A_p | mm² | 45 – 90 | **derived** from bore and shaft (01 §4.4) |
| piston hole count | n | — | 2 – 8 | setup |
| piston hole diameter | d_h | mm | 0.4 – 1.2 | setup |
| installation ratio | IR | — | 0.5 – 0.7 | module 5 |
| wheel rate | k_w | N/mm | 1.0 – 1.6 | module 5 |
| sprung corner mass | m_s | kg | 0.20 – 0.45 | **module 6 §6.1** (round 1 sourced this to module 1, which does not store it) |

### 2.2 Fluid and constants

| Input | Symbol | Unit | Default | Range | Label |
|---|---|---|---|---|---|
| oil density | ρ | kg/m³ | 950 | 900 – 1000 | `assumed` (silicone 300–600 cSt) |
| orifice discharge coefficient | C_d | — | 0.62 | 0.60 – 0.80 | `assumed` (sharp-edged orifice) |
| oil reference viscosity | ν_ref | cSt | 500 | 200 – 900 | setup (printed on the bottle) |
| viscosity-temperature coefficient | B | K | 1200 | 800 – 2000 | `assumed` — calibrate if possible |
| reference temperature | T_ref | °C | 20 | — | setup |
| blow-off force | F_bo | N | 4.0 | 2 – 10 | `assumed` unless dyno-measured |
| post-blow-off rate | c_post | N·s/m | 12 | 5 – 40 | `assumed` unless dyno-measured |

`A_p` is the **displaced** area: piston area minus shaft area on the rod side. For a 9.6 mm bore and a
2.5 mm shaft, `A_p = π/4·(9.6² − 2.5²) = 67.5 mm²`. Using the bore area alone overstates force by ~7 %.

`C_d = 0.62` is the standard value for a sharp-edged orifice. It is not a fitted parameter — do not
tune it to match a dyno; tune `A_p` or the hole diameters, which are things a user can measure.

### 2.3 The two dyno-only inputs, stated plainly

`F_bo` and `c_post` cannot be obtained without a shock dyno: they are a property of the shim stack, not
of any dimension a caliper can reach. v1 assumes them (4.0 N, 12 N·s/m) and flags the output. That
assumption is the ±30 % band. A user with a dyno pull enters the two values and the badge changes from
`estimated` to `measured`.

Unmodelled stiction (0.5–2 N on a 1/10 car, §4.2) is **larger than the modelled force below 20 mm/s**,
so below that speed the model's level is not merely uncertain, it is irrelevant. That is a floor, not
a band, and the output says so.

---

## 3. Model

### 3.1 Critical damping and damping ratio

```
c_crit = 2·√(k_w·m_s)                     N·s/m, k_w in N/m                (7.1)
ζ(v)   = c_wheel(v)/c_crit                                                 (7.2)
c_wheel(v_s) = F_wheel(v_s)/v_w = F_damper(v_s)·IR²/v_w                   (7.3)
```

**Subscript the speeds.** Round 1's (7.3) wrote `F_wheel(v)/v` with `v` meaning the shaft speed in one
term and the wheel speed in the other; the two forms are equal only if the two `v`s are related by IR.
v1 uses `v_s` for shaft speed and `v_w = v_s/IR` for wheel speed, and every table in this document
states which one its column is.

```
ζ(v_s) = F_damper(v_s)·IR² / ( (v_s/IR) · 2√(k_w·m_s) )                    (7.4)
```

**Damping ratio is a function of speed, not a number.** A damper has a different ζ at 5 mm/s than at
500 mm/s; the app shows the curve and marks the reference speeds.

| Regime | Shaft speed | What it is for |
|---|---|---|
| Low | 5 – 20 mm/s | roll and pitch build-up — **friction-dominated in the model's own terms** |
| Handling | 20 – 100 mm/s | body motion in a corner; the range that dominates feel |
| Bump | 100 – 600 mm/s | kerbs and landings |

### 3.2 Orifice model

With `Q = A_p·v_s` (continuity) and `A_h = n·π·d_h²/4`:

```
v_orifice = Q/(C_d·A_h)
Δp        = ½·ρ·v_orifice²
F_orifice = Δp·A_p = (ρ·A_p³)/(2·C_d²·A_h²) · v_s²                       (7.5)
```

`K_h = ρ·A_p³/(2·C_d²·A_h²)`, units N·(s/m)². The damper is a pure quadratic element below blow-off:
force ∝ v², damping coefficient ∝ v, damping ratio ∝ v.

### 3.3 Blow-off (digressive) model

```
F(v) = min( K_h·v² ,  F_bo + c_post·v )                                   (7.6)
v_bo = [ c_post + √(c_post² + 4·K_h·F_bo) ] / (2·K_h)                     (7.7)
```

The result is digressive: quadratic below blow-off, then a slope `c_post`.

**Rebound and compression are separate.** Use separate `A_h`, `F_bo`, `c_post` per direction. If the
user has one set of numbers, the app applies them to rebound and copies them to compression (flag
`symmetricDamper`) — a deliberate simplification the UI must disclose, because no real shock is
symmetric.

### 3.4 Motion ratio

```
ζ ∝ IR        (exactly, for a given spring and damper)
```

Damping ratio scales **linearly** with installation ratio while wheel rate scales with its square.
Laying a shock down reduces both, but ζ falls less than k_w — which is why a shock-angle change is not
interchangeable with a spring change, and why the comparison screen should say so.

### 3.5 Oil viscosity and temperature

```
µ(T) = µ_ref·exp[ B·(1/T − 1/T_ref) ]        T in kelvin                    (7.8)
```

For silicone shock oil, B ≈ 1000–1400 K; 1200 K gives a **12.6 % drop in viscosity for 20 → 30 °C**.

**Where viscosity enters our model, and where it does not.** In (7.5) the force is set by fluid
*density* and geometry: pure orifice flow is inertial and therefore nearly temperature-insensitive. In
reality dampers are strongly temperature-sensitive at low speed because their low-speed flow is
*viscous* — leakage past the piston band, bleed through the shim stack, the laminar part of the orifice
flow. v1 has one place for this: the blow-off and post-blow-off terms are viscosity-dominated,

```
F_bo(T)   = F_bo(T_ref)·µ(T)/µ(T_ref)
c_post(T) = c_post(T_ref)·µ(T)/µ(T_ref)                                   (7.9)
```

and `K_h` is left alone. Consequence, and it is a §9 row: above blow-off the model gets the direction
**and the full magnitude** of temperature sensitivity; below blow-off it gets **zero**, against a real
damper's ~12 % per 10 °C.

### 3.6 The term we know is missing

A laminar bleed path in parallel with the orifice gives a real damper its linear low-speed region:

```
A_p·v = C_d·A_h·√(2Δp/ρ) + Δp/R_b          R_b ∝ µ(T)                    (7.10)
```

a quadratic in `u = √Δp`, closed-form and cheap. We do **not** ship it in v1 because `R_b` cannot be
derived from anything a user can measure without a dyno, and a freely-fitted `R_b` would let the app
match any curve — the "confident, unverifiable maths" review rule 1 exists to prevent. It is the first
item on the v1.1 list and a prerequisite for claiming anything about temperature below blow-off.

### 3.7 Where the model is honest, and where it is only directionally right

| Question | Answer | Basis |
|---|---|---|
| "Is my car over- or under-damped at handling speeds?" | yes, to ±30 % | §6 table, with the band |
| "Does a 4-hole piston need more or less oil than a 6-hole?" | yes; the ratio is good | geometry-dominated (A_h²) |
| "How much stiffer is this piston at 20 mm/s?" | partly — level not trustworthy there | stiction is 2.4–9.5× the modelled force |
| "How stiff is this piston overall?" | order of magnitude only | `F_bo`, `c_post` assumed |
| "What will 10 °C of track temperature do?" | right above blow-off, understated below | §3.5 |
| "Will the car land off this jump?" | no | shim-dominated, out of scope |

---

## 4. Assumptions and where this breaks

1. **Single-piston, no shaft displacement volume, no gas spring.** The gas force is a few percent and
   is a spring, not damping.
2. **No friction.** Shaft-seal friction and pivot stiction on a 1/10 car are **0.5–2 N**, against a
   modelled 0.211 N at 20 mm/s and 0.013 N at 5 mm/s: **2.4× to 9.5× the modelled force**. This is the
   largest unmodelled term in the low-speed range and it biases the model toward under-predicting
   low-speed damping. Round 1 called this "comparable to the force at 20 mm/s" and then claimed ±30 %
   across the whole speed range, which the same paragraph's numbers contradict.
3. **No cavitation, aeration or hysteresis.** All three matter at high speed.
4. **Rigid, incompressible oil.** Fine.
5. **One damper per corner.** Rocker linkages approximated.
6. **Linear blow-off.** Real shim stacks open progressively; (7.6) is a two-parameter stand-in.
7. **IR taken at static ride height.** The ±1.3 % variation over travel is ignored.

---

## 5. Degenerate cases

| Condition | Behaviour |
|---|---|
| `A_h = 0` (all holes closed) | `Undefined(outOfDomain)` — force unbounded; a real damper would be hydraulically locked |
| `d_h = 0` for one of n holes | same |
| `A_p ≤ 0`, `IR = 0`, `k_w ≤ 0`, `m_s ≤ 0` | validation error at entry |
| **`v_s = 0`** | `F = 0` for force; **ζ is `Undefined(zeroSpeed)`** — round 1 returned `ζ = 0`, which is a number for a quantity it had just declared undefined, and 00 §4 forbids that pattern |
| `IR < 0` (damper lengthens in bump) | the direction flips: ζ is reported negative with `lowConfidence`, and the UI shows "this damper is installed inverted" (module 5 §5) |
| `F_bo = 0` and `c_post = 0` | blows off to zero force — a failed damper; `noDamping` |
| `T ≤ 0 K` | validation error |
| `B = 0` | no temperature sensitivity; valid, `temperatureInsensitive` |
| `F_bo` or `c_post` assumed | ζ carries `estimatedDamper` and §6's band |
| `v_s < 20 mm/s` | ζ carries `belowFrictionFloor`; the band widens (§6.4), the number is still shown |

---

## 6. Worked example

Reference car, front corner. `A_p = 67.5 mm²`, `ρ = 950 kg/m³`, `C_d = 0.62`, `n = 3` holes of
`d_h = 0.60 mm`. Rebound only (symmetric damper assumed for the example).

### 6.1 Geometry constant

```
A_h = 3 × π × (0.60e-3)²/4 = 8.4823e-7 m²
K_h = 950 × (6.75e-5)³ / (2 × 0.3844 × (8.4823e-7)²) = 528.20 N·(s/m)²
```

### 6.2 Blow-off

```
v_bo = [12 + √(144 + 4 × 528.20 × 4.00)]/(2 × 528.20)
     = (12 + √8595.2)/1056.39
     = (12 + 92.710)/1056.39 = 0.09912 m/s
```

so the shim stack takes over at **99 mm/s** — the top of the handling range, a plausible place for a
touring-car shock to go digressive. (Round 1's printed arithmetic showed `√(144 + 8447.4)` where the
product is 8595.2 — it had dropped a factor — but its answer, 0.09913, is within 1e-5 of the correct
0.09912, so this is a printing error, not a physics error. The value shipped and asserted in G07.2 is
**0.09912 m/s**.)

### 6.3 The curve (corrected masses — B1)

`IR = 0.565308`, `k_w = 1118.51 N/m`, **`m_s = 0.24375 kg`**, `c_crit = 33.023 N·s/m`. Round 1 used
0.310 kg and `c_crit = 37.242`, which made every ζ in this table **12.8 % too small**.

| v_s (mm/s) | F_orifice (N) | F_linear (N) | F (N) | c_damper (N·s/m) | c_wheel (N·s/m) | ζ | band |
|---|---|---|---|---|---|---|---|
| 5 | 0.0132 | 4.060 | 0.0132 | 2.64 | 0.84 | 0.026 | **none stated** — `belowFrictionFloor`, direction only |
| 20 | 0.2113 | 4.240 | 0.2113 | 10.56 | 3.38 | 0.102 | ±50 % (0.05 – 0.15) |
| 50 | 1.3205 | 4.600 | 1.3205 | 26.41 | 8.44 | **0.256** | ±30 % (0.18 – 0.33) |
| 99.1 | 5.1884 | 5.1884 | 5.1884 | 52.35 | 16.73 | **0.507** | ±30 % (0.35 – 0.66) |
| 200 | 21.13 | 6.400 | 6.400 | 32.00 | 10.23 | 0.310 | ±30 % (0.22 – 0.40) |
| 500 | 132.05 | 10.000 | 10.000 | 20.00 | 6.39 | 0.194 | ±30 % (0.14 – 0.25) |

Worked for 50 mm/s:

```
F = 528.20 × 0.050² = 1.3205 N        c_damper = 26.41 N·s/m
c_wheel = 26.41 × 0.565308² = 8.439 N·s/m
ζ = 8.439/33.023 = 0.2556
```

**Read the shape, not the values.** ζ peaks at ~0.51 near blow-off and falls to 0.19 at 500 mm/s. That
hump is what "digressive" feels like: firm in body motions, soft over kerbs. A single ζ would hide the
only interesting thing about the damper.

### 6.4 Motion ratio

Same damper, laid down so IR drops from 0.5653 to 0.500 (−11.5 %):

```
k_w:  1118.51 × (0.500/0.565308)² = 874.9 N/m
c_wheel at 50 mm/s: 26.41 × 0.500² = 6.603 N·s/m
c_crit: 2·√(874.9 × 0.24375) = 29.21 N·s/m
ζ: 6.603/29.21 = 0.2261        (was 0.2556, −11.6 %)
```

Wheel rate −21.7 %, damping ratio −11.6 % — ζ ∝ IR exactly, which is §3.4 made concrete.

### 6.5 Temperature

```
µ(30)/µ(20) = exp[1200 × (1/303.15 − 1/293.15)] = exp(−0.13501) = 0.8737
```

so `F_bo` and `c_post` drop 12.6 %. At 200 mm/s the model's force is blow-off-limited, so ζ falls 12.6 %
(from 0.310 to 0.271) — right. At 50 mm/s the orifice term dominates (1.32 N against a 4.6 N cap) and
ζ **does not move at all**, while a real damper would lose ~12 %. That gap is the honest state of v1
and it is in the §9 table as a row the model cannot see.

---

## 7. Golden test cases

| ID | Input | Expected | Origin |
|---|---|---|---|
| G07.1 | §6.1 geometry | K_h = 528.20 N·(s/m)² ± 0.5 | hand calc §6.1 |
| G07.2 | §6.2 blow-off parameters | v_bo = 0.09912 m/s ± 1e-4 | hand calc §6.2 |
| **G07.3** | v_s = 50.0 mm/s | F = 1.3205 N ± 1e-3; **ζ = 0.2556** ± 5e-4 | hand calc §6.3 (m_s = 0.24375) |
| G07.4 | v_s = 200.0 mm/s | F = 6.400 N ± 1e-3 (blow-off regime); ζ = 0.3097 | hand calc §6.3 |
| **G07.5** | v_s = 5.0 mm/s | **ζ = 0.0256** ± 5e-4, and `flags ∋ belowFrictionFloor` | hand calc §6.3 |
| **G07.6** | IR 0.565308 → 0.500, v_s = 50 mm/s | **ζ = 0.2261** ± 1e-3; k_w = 874.9 N/m | hand calc §6.4 |
| G07.7 | `A_h = 0` | `Undefined(outOfDomain)`, no infinity | §5 |
| **G07.8** | `v_s = 0` | F = 0; **ζ = `Undefined(zeroSpeed)`**, not 0 | §5 |
| G07.9 | T = 30 °C vs 20 °C at v_s = 200 mm/s | F(30)/F(20) = 0.874 ± 0.002 | hand calc §6.5 (via (7.9)) |
| **G07.10** | **monotonicity in IR**: ζ at IR = 0.45, 0.50, 0.565, 0.62, v_s = 50 mm/s | strictly increasing with IR, ratio = IR ratio to 1e-9 | §3.4, §9 |
| **G07.11** | **monotonicity in hole area**: n = 2, 3, 4, 6 holes | ζ strictly decreasing in n; ζ(4)/ζ(3) = (3/4)² = 0.5625 at 50 mm/s | §9 (A_h² law) |
| **G07.12** | **monotonicity in viscosity**: ×1.5 at 200 mm/s and at 50 mm/s | +50 % at 200 mm/s; **0 % at 50 mm/s** — the model's known blind spot, asserted so it cannot drift silently | §6.5, §9 |
| **G07.13** | **monotonicity in spring rate**: k_s × 1.2 at 50 mm/s | ζ × 1/√1.2 = 0.9129 (−8.7 %) | §9 |
| **G07.14** | **below-friction floor**: F(20 mm/s) = 0.2113 N against stiction 0.5–2 N | the output carries `belowFrictionFloor`; the band is ≥ ±50 % | §4.2, §6.4 |

Tolerances as stated; every value is hand arithmetic printed in §6.

The monotonicity cases (G07.10–G07.13) exist because the owner's requirement is that the **direction**
be trustworthy even where the magnitude is not. A direction test is the only kind of test that can
pass at ±30 % accuracy, and it is the only kind that fails when a sign goes wrong in a refactor.

---

## 8. What the UI must and must not do

- **Do** show ζ as an estimate: the value, the band, the speed it is quoted at, and the `estimated`
  badge with the reason ("blow-off force assumed — needs a dyno").
- **Do** show the curve with the reference speeds marked, and the §9 direction table beside it.
- **Do not** show a single ζ with no band, and do not show it to three decimals (two is generous; the
  input uncertainty is ±30 %).
- **Do not** compare a modelled curve with a manufacturer's published dyno plot and call it validation.
  Manufacturers publish at 25 °C nominal with proprietary oil; the comparison needs the same oil,
  temperature and piston.
- **Do not** let a user "tune `C_d`" to match a feel. It is a physical constant, and the moment it
  becomes a fudge factor every other number in the module loses its provenance.
- **Do not** show ζ below 20 mm/s without the `belowFrictionFloor` flag. At 5 mm/s the modelled force
  is 0.0132 N; the stiction in the same damper is 0.5–2 N — 38× to 150× larger.

---

## 9. What changes ζ — the direction table (the headline deliverable)

Every row is computed from the model at the stated shaft speed, reference corner
(`IR = 0.5653`, `k_w = 1.1185 N/mm`, `m_s = 0.24375 kg`, `K_h = 528.20`, `F_bo = 4 N`,
`c_post = 12 N·s/m`). **Sign first, magnitude second.** Every row is monotone across its lever's input range, which is what
makes the direction usable even where the number is not.

| Lever | Change | Direction | ζ at 50 mm/s | ζ at 200 mm/s | Where it comes from | Trust |
|---|---|---|---|---|---|---|
| **Oil viscosity up** | 500 → 750 cSt (×1.5 µ) | **↑** (never ↓) | 0.2556 → 0.2556 (**0 %**) | 0.3097 → 0.4645 (**+50 %**) | (7.9): both cap terms ∝ µ | direction yes; magnitude **only above blow-off** |
| **Shock laid down** | IR 0.5653 → 0.500 (−11.5 %) | **↓** | 0.2556 → 0.2261 (−11.6 %) | 0.3097 → 0.2739 (−11.6 %) | ζ ∝ IR exactly (§3.4) | **high** — geometry alone |
| **Spring rate up** | 3.50 → 4.20 N/mm (+20 %) | **↓** (see the note below) | 0.2556 → 0.2333 (−8.7 %) | 0.3097 → 0.2828 (−8.7 %) | ζ ∝ k_s^(−1/2) via `c_crit` | **high** — geometry alone |
| **More piston holes** | n = 3 → 4 (same d_h) | **↓** | 0.2556 → 0.1438 (**−43.7 %**) | unchanged (cap-limited) | K_h ∝ A_h^(−2) | **high** below blow-off; v_bo moves 99 → 138 mm/s |
| **Bigger holes** | d_h 0.60 → 0.62 mm | **↓** | 0.2556 → 0.2242 (−12.3 %) | unchanged | K_h ∝ d_h^(−4) | **high**; ±0.02 mm is ±13 %, so a pin gauge matters |
| **Hotter oil** | 20 → 30 °C | **↓** (never ↑) | 0.2556 → 0.2556 (**0 %**) | 0.3097 → 0.2706 (−12.6 %) | (7.9) again | direction yes; magnitude **only above blow-off** |

> **Note on the spring-rate row, against the decision record.** D-13 lists "a stiffer spring raises ζ
> for the same damper" among the directions that must be trustworthy. The model says the opposite, and
> the model is right: `c_crit = 2√(k_w·m_s)` rises as √k_s while the damper's wheel-level coefficient is
> unchanged at a given shaft speed, so **ζ falls as 1/√k_s** (−8.7 % for +20 % spring). What rises with a
> stiffer spring is the damping *force* needed to hold a target ζ, not the ζ the same shock delivers. The
> app therefore shows "stiffer spring → lower damping ratio at the same shaft speed, and you will need
> more damping to keep the same ζ", and this line is flagged for Dave as an amendment to D-13 rather
> than quietly implemented the other way.

### 9.1 What geometry alone cannot capture — stated plainly

1. **The absolute level.** `F_bo` and `c_post` are shim-stack properties. With the defaults, ζ at
   50 mm/s is 0.256 ± 30 %; a shock with a 2 N blow-off would sit near 0.13. No amount of bore, shaft
   or hole measurement fixes this.
2. **Viscosity below blow-off.** The model's answer is "no change" (row 1 at 50 mm/s), because orifice
   flow in the model is inertial. A real damper loses ~12 % per 10 °C there. **The sign is still safe**
   (the model never says thicker oil damps less) but the magnitude is zero when it should not be, and
   this is the single largest gap the §3.6 bleed term would close.
3. **Anything below ~20 mm/s.** Stiction and seal friction, 0.5–2 N, dominate the modelled 0.013–0.21 N.
   Only the direction survives.
4. **Shim-stack progressivity and hysteresis.** (7.6) is a two-parameter stand-in for a curve that has
   three or four features.
5. **The difference between two shim stacks.** A dyno question; the model has no vocabulary for it.

### 9.2 What it *can* capture, which is most of what racers change

The three levers a club racer actually adjusts — oil weight, shock position, piston holes — are all in
the "trust: high" rows, because they enter through geometry and the `c_crit` that module 5 computes
exactly. That is the case for shipping ζ as an estimate rather than withholding it: the app can answer
"which way and roughly how much" for the changes people make, while being explicit that it cannot
answer "what is my number" to better than ±30 %.
