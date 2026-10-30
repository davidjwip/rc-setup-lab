# 07 — Damping

Build order: 7 of 9. Depends on module 5 (wheel rate, critical damping, installation ratio).

Damping is the part of RC setup that the community understands least and argues about most, and the
part where a model without a shock dyno is most tempted to bluff. This module is written to make the
bluff impossible: it states exactly which inputs it needs, what it can predict from geometry alone,
and what it cannot.

---

## 1. Purpose

| Output | Symbol | Unit |
|---|---|---|
| Critical damping, per corner | c_crit | N·s/m |
| Damping ratio vs shaft speed | ζ(v) | — |
| Damper force vs shaft speed | F(v) | N |
| Damper force at the wheel | F_wheel(v) | N |
| Blow-off speed and force | v_bo, F_bo | m/s, N |
| Temperature sensitivity | ∂ζ/∂T | %/K |

---

## 2. Inputs

### 2.1 Geometry and rates (from modules 1 and 5)

| Input | Symbol | Unit | Range (1/10 TC) | Source |
|---|---|---|---|---|
| piston (displaced) area | A_p | mm² | 45 – 90 | module 1 / measured |
| piston hole count | n | — | 2 – 8 | setup |
| piston hole diameter | d_h | mm | 0.4 – 1.2 | setup |
| installation ratio | IR | — | 0.5 – 0.7 | module 5 (computed) |
| wheel rate | k_w | N/mm | 1.0 – 1.6 | module 5 (computed) |
| sprung corner mass | m_s | kg | 0.20 – 0.45 | module 1 |

### 2.2 Fluid and constants

| Input | Symbol | Unit | Default | Range | Label |
|---|---|---|---|---|---|
| oil density | ρ | kg/m³ | 950 | 900 – 1000 | `assumed` (silicone 300–600 cSt) |
| orifice discharge coefficient | C_d | — | 0.62 | 0.60 – 0.80 | `assumed` (sharp-edged orifice) |
| oil reference viscosity | ν_ref | cSt | 500 | 200 – 900 | setup (it is printed on the bottle) |
| viscosity-temperature coefficient | B | K | 1200 | 800 – 2000 | `assumed` — calibrate if possible |
| reference temperature | T_ref | °C | 20 | — | setup |
| blow-off force | F_bo | N | 4.0 | 2 – 10 | `assumed` unless measured |
| post-blow-off rate | c_post | N·s/m | 12 | 5 – 40 | `assumed` unless measured |

`A_p` is the **displaced** area: the piston area minus the shaft area on the rod side. For a 9.6 mm
bore and a 2.5 mm shaft, `A_p = π/4·(9.6² − 2.5²) = 67.5 mm²`. Getting this wrong by using the bore
area alone overstates force by ~7%.

`C_d = 0.62` is the standard value for a sharp-edged orifice. A drilled hole in a plastic piston is
close to that; a chamfered hole is higher. It is not a fitted parameter — do not tune it to match a
dyno, tune `A_p` or the hole diameters, which are things a user can actually measure.

---

## 3. Model

### 3.1 Critical damping and damping ratio

```
c_crit = 2·√(k_w·m_s)                     N·s/m, k_w in N/m                  (7.1)
ζ(v)   = c_wheel(v)/c_crit                                                 (7.2)
c_wheel(v) = F_wheel(v)/v = F_damper(v)·IR²/v                              (7.3)
```

so

```
ζ(v) = F_damper(v)·IR² / (v · 2√(k_w·m_s))                                 (7.4)
```

**Damping ratio is a function of speed, not a number.** A damper has a different ζ at 5 mm/s than at
500 mm/s, and quoting one number is the most common error in hobbyist damper discussion. RC3 was
explicit about this too (its damping-ratio display was plotted against wheel velocity); the app
should default to showing the *curve*, with the value at a stated reference speed as the headline.

Reference speeds, and why they are not arbitrary:

| Regime | Shaft speed | What it is for |
|---|---|---|
| Low | 5 – 20 mm/s | roll and pitch build-up, "platform control" |
| Handling | 20 – 100 mm/s | body motion in a corner, the range that dominates feel |
| Bump | 100 – 600 mm/s | kerbs and landings |

### 3.2 Orifice model

Flow through the piston holes. With `Q = A_p·v` (continuity) and `A_h = n·π·d_h²/4`:

```
v_orifice = Q/(C_d·A_h)
Δp        = ½·ρ·v_orifice²
F_orifice = Δp·A_p = (ρ·A_p³)/(2·C_d²·A_h²) · v²                          (7.5)
```

Call the constant `K_h = ρ·A_p³/(2·C_d²·A_h²)`, units N·(s/m)². The damper is a pure quadratic
element: force ∝ v², damping *coefficient* ∝ v, damping *ratio* ∝ v. That is why a real damper's
ζ curve rises steeply at low speed and why a purely orifice-modelled car feels harsh in the small
stuff — the real damper has a blow-off that caps it.

### 3.3 Blow-off (digressive) model

A shim stack opens at a pressure set by its preload and stiffness. v1 models that as a cap on the
force with a residual slope:

```
F(v) = min( K_h·v² ,  F_bo + c_post·v )                                   (7.6)
```

The result is digressive: quadratic below blow-off, then a slope `c_post` that is a fraction of the
orifice slope at that speed. Two parameters, both measurable on a dyno, both defaultable to a
plausible value with a flag.

Blow-off speed, from setting (7.5) equal to (7.6)'s linear part:

```
K_h·v_bo² = F_bo + c_post·v_bo
v_bo = [ c_post + √(c_post² + 4·K_h·F_bo) ] / (2·K_h)                     (7.7)
```

**Rebound and compression are separate.** Use separate `A_h`, `F_bo`, `c_post` for each direction:
a real shock has a much smaller compression hole area and a stiffer shim stack on rebound. Store
both; if the user has one set of numbers, the app applies them to rebound and sets compression to
the same (flag `symmetricDamper`) — a deliberate simplification the UI must disclose, because no
real shock is symmetric.

### 3.4 Motion ratio

From (7.3), `F_wheel = F_damper·IR` and `c_wheel = c_damper·IR²`. Substituting into (7.4) and
simplifying with `k_w = k_s·IR²`:

```
ζ ∝ IR        (exactly, for a given spring and damper)
```

This is a genuinely useful result: **damping ratio scales linearly with installation ratio, while
wheel rate scales with its square.** Laying a shock down reduces both, but damping ratio falls
*less* than wheel rate — which is why RC3's author found shock-angle changes worth only a few
percent of damping ratio while they changed ride stiffness noticeably. It also means a shock
position change and a spring change are not interchangeable, which the setup comparison screen
should point out.

### 3.5 Oil viscosity and temperature

Viscosity follows the Andrade relation:

```
µ(T) = µ_ref·exp[ B·(1/T − 1/T_ref) ]        T in kelvin                    (7.8)
```

with `B` in kelvin. For silicone shock oil, B ≈ 1000–1400 K; the default of 1200 K gives a **12.6%
drop in viscosity for 20 °C → 30 °C**, which is the right order for what RC3's author demonstrated
on video (he needed roughly +150 cSt on a 700 cSt oil to recover the damping ratio over that
interval, i.e. ~20%).

**Where viscosity enters our model, and where it does not.** In (7.5) the force is set by fluid
*density* and geometry, not viscosity: pure orifice flow is inertial and therefore nearly
temperature-insensitive. In reality dampers are strongly temperature-sensitive at low speed because
their low-speed flow is *viscous* — leakage past the piston band, bleed through the shim stack, and
the laminar part of the orifice flow. v1 already has one plausible place for this: the blow-off and
post-blow-off terms are viscosity-dominated, so we scale them:

```
F_bo(T)   = F_bo(T_ref)·µ(T)/µ(T_ref)
c_post(T) = c_post(T_ref)·µ(T)/µ(T_ref)                                   (7.9)
```

and leave `K_h` alone. The consequence is that the model gets the *direction* and roughly half the
magnitude of temperature sensitivity right, and **understates it at low speed**. This is stated in
§6 and is the main reason a dyno comparison is on the validation list.

### 3.6 The term we know is missing

A laminar bleed path in parallel with the orifice gives a real damper its linear low-speed region:

```
A_p·v = C_d·A_h·√(2Δp/ρ) + Δp/R_b          R_b ∝ µ(T)                     (7.10)
```

which is a quadratic in `u = √Δp` and has a closed-form solution, so it is cheap to implement. We do
**not** ship it in v1 because `R_b` cannot be derived from anything a user can measure without a
dyno — and a freely-fitted `R_b` would let the app match any curve, which is exactly the
"confident, unverifiable maths" that review rule 1 exists to prevent. It is the first item on the
v1.1 list and it is a prerequisite for claiming anything about temperature.

### 3.7 What can honestly be modelled without a dyno

| Question | Can we answer it? | Confidence |
|---|---|---|
| "Is my car over- or under-damped at handling speeds?" | yes, as a ratio | medium (±30% on the force) |
| "Does a 4-hole piston need more or less oil than a 6-hole?" | yes, and the ratio is good | high (geometry-dominated) |
| "How much stiffer is this piston at 20 mm/s?" | yes | high |
| "How stiff is this piston overall?" | order of magnitude only | low — needs `F_bo`, `c_post` |
| "What will 10 °C of track temperature do?" | direction only | low (§3.5) |
| "Will the car land off this jump?" | no | — high-speed behaviour is shim-dominated and out of scope |
| "Which of these two shim stacks is better?" | no | — that is a dyno question |

---

## 4. Assumptions and where this breaks

1. **Single-piston, no shaft displacement volume, no gas spring.** Fine for a small shock; the gas
   force is a few percent and is a spring, not damping.
2. **No friction.** Shaft-seal friction and pivot stiction on a 1/10 car can be 0.5–2 N — comparable
   to the damper force at 20 mm/s. **This is the largest unmodelled term in the low-speed range** and
   it biases the model toward under-predicting low-speed damping. A stiction model needs a
   measurement (`F_static`), so v1 leaves it out and says so.
3. **No cavitation, no aeration, no hysteresis.** All three matter on an RC shock at high speed.
4. **Rigid oil, incompressible.** Fine.
5. **One damper per corner.** Rocker linkages and separate spring/damper rates are approximated.
6. **Linear blow-off.** Real shim stacks have a progressive opening; the cap in (7.6) is a
   two-parameter stand-in.
7. **`IR` is taken at static ride height.** §3.4's linear result is exact only for a fixed IR; the
   variation over travel (±1.3% on the reference car) is ignored.

---

## 5. Degenerate cases

| Condition | Behaviour |
|---|---|
| `A_h = 0` (all holes closed) | `Undefined(outOfDomain)` — force is unbounded; a real damper would be hydraulically locked |
| `d_h = 0` for one of n holes | same |
| `A_p ≤ 0`, `IR ≤ 0`, `k_w ≤ 0`, `m_s ≤ 0` | validation error at entry |
| `v = 0` | `ζ` undefined; return `F = 0` and `ζ = 0`, no division by zero |
| `F_bo = 0` with `c_post = 0` | blows off to zero force — physically a failed damper; flag `noDamping` |
| `T ≤ 0 K` | validation error |
| `B = 0` | no temperature sensitivity; valid (flag `temperatureInsensitive`) |

---

## 6. Worked example

Reference car, front corner. `A_p = 67.5 mm²`, `ρ = 950 kg/m³`, `C_d = 0.62`, `n = 3` holes of
`d_h = 0.60 mm`. Rebound only (a symmetric damper is assumed for the example).

### 6.1 Geometry constant

```
A_h = 3 × π × (0.60 × 10⁻³)²/4 = 3 × 2.8274 × 10⁻⁷ = 8.4823 × 10⁻⁷ m²
A_p = 67.5 × 10⁻⁶ m²

K_h = ρ·A_p³/(2·C_d²·A_h²)
    = 950 × (6.75 × 10⁻⁵)³ / (2 × 0.3844 × (8.4823 × 10⁻⁷)²)
    = 950 × 3.0761 × 10⁻¹³ / (0.7688 × 7.1949 × 10⁻¹³)
    = 2.9223 × 10⁻¹⁰ / 5.5315 × 10⁻¹³
    = 528.20 N·(s/m)²
```

### 6.2 Blow-off

`F_bo = 4.00 N`, `c_post = 12.0 N·s/m`:

```
v_bo = [12 + √(144 + 4 × 528.20 × 4.00)]/(2 × 528.20)
     = [12 + √(144 + 8447.4)]/1056.39
     = (12 + 92.70)/1056.39 = 0.09913 m/s
```

So the shim stack takes over at **99 mm/s** — the top of the handling range, which is a plausible
place for a touring-car shock to go digressive.

### 6.3 The curve

`IR = 0.565308`, `k_w = 1118.51 N/m`, `m_s = 0.310 kg`, `c_crit = 37.242 N·s/m`.

| Shaft v (mm/s) | F_orifice (N) | F_linear (N) | F (N) | c_damper (N·s/m) | c_wheel (N·s/m) | ζ |
|---|---|---|---|---|---|---|
| 5 | 0.0132 | 4.060 | 0.0132 | 2.64 | 0.84 | 0.023 |
| 20 | 0.2113 | 4.240 | 0.2113 | 10.56 | 3.38 | 0.091 |
| 50 | 1.3205 | 4.600 | 1.3205 | 26.41 | 8.44 | 0.227 |
| 99.1 | 5.191 | 5.191 | 5.191 | 52.38 | 16.74 | 0.450 |
| 200 | 21.13 | 6.400 | 6.400 | 32.00 | 10.23 | 0.275 |
| 500 | 132.05 | 10.000 | 10.000 | 20.00 | 6.39 | 0.172 |

Worked for 50 mm/s:

```
F = 528.20 × (0.050)² = 528.20 × 0.0025 = 1.3205 N
c_damper = 1.3205/0.050 = 26.41 N·s/m
c_wheel  = 26.41 × 0.565308² = 26.41 × 0.31957 = 8.439 N·s/m
ζ        = 8.439/37.242 = 0.2266
```

**Read the shape, not the values.** ζ peaks at ~0.45 near blow-off and falls to 0.17 at 500 mm/s.
That hump is what "digressive" feels like: a firm car in body motions that goes soft over kerbs. If
the app showed a single ζ it would hide the only interesting thing about the damper.

### 6.4 Motion ratio

Same damper, laid down so that IR drops from 0.565 to 0.500 (−11.5%):

```
k_w:    1118.51 × (0.500/0.565308)² = 1118.51 × 0.78226 = 874.9 N/m
c_wheel at 50 mm/s: 26.41 × 0.500² = 6.603 N·s/m
c_crit: 2·√(874.9 × 0.310) = 32.94 N·s/m
ζ:      6.603/32.94 = 0.2005        (was 0.2266, −11.5%)
```

Wheel rate −21.7%, damping ratio −11.5%. The ratio of the two changes is exactly IR, which is §3.4
made concrete and is why "move the shock" is not the same as "change the spring".

### 6.5 Temperature

20 °C → 30 °C with `B = 1200 K`:

```
µ(30)/µ(20) = exp[1200 × (1/303.15 − 1/293.15)] = exp(−0.13501) = 0.8737
```

so `F_bo` and `c_post` drop by 12.6%. At 50 mm/s the force is still orifice-dominated (1.32 N vs a
4.6 N cap), so **the model's answer at 50 mm/s barely moves** — while a real damper's force there
would drop by roughly the same 12.6%. That gap is the honest state of v1: it will tell the user
"hot oil is softer" in the blow-off regime and understate it below blow-off.

---

## 7. Golden test cases

| ID | Input | Expected | Origin |
|---|---|---|---|
| G07.1 | §6.1 geometry | K_h = 528.20 N·(s/m)² ± 0.5 | hand calc §6.1 |
| G07.2 | §6.2 blow-off parameters | v_bo = 0.09913 m/s ± 1e-4 | hand calc §6.2 |
| G07.3 | v = 50.0 mm/s | F = 1.3205 N ± 1e-3; ζ = 0.2266 ± 5e-4 | hand calc §6.3 |
| G07.4 | v = 200.0 mm/s | F = 6.400 N ± 1e-3 (blow-off regime) | hand calc §6.3 |
| G07.5 | v = 5.0 mm/s | ζ = 0.0227 ± 5e-4 | hand calc §6.3 |
| G07.6 | IR 0.565308 → 0.500, v = 50 mm/s | ζ = 0.2005 ± 1e-3; k_w = 874.9 N/m | hand calc §6.4 |
| G07.7 | `A_h = 0` | `Undefined(outOfDomain)`, no infinity | spec §5 |
| G07.8 | `v = 0` | F = 0, ζ = 0, no NaN | spec §5 |
| G07.9 | T = 30 °C vs 20 °C at v = 200 mm/s | F(30)/F(20) = 0.874 ± 0.002 | hand calc §6.5 (via (7.9)) |

Tolerances as stated; all values are hand calculations printed in §6.

---

## 8. What the UI must not do

- Do not show a single damping ratio. Show the curve with the reference speed marked.
- Do not show ζ to three decimals. Two is already generous; the input uncertainty is ±20%.
- Do not compare a modelled curve with a manufacturer's published dyno plot and call it validation.
  Manufacturers publish at 25 °C nominal with proprietary oil; the comparison needs the same oil,
  the same temperature and the same piston.
- Do not let a user "tune C_d" to match a feel. It is a physical constant, and the moment it becomes
  a fudge factor every other number in the module loses its provenance.
