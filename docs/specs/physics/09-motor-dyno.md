# 09 — Motor and ESC dyno (phase 3, outline only)

Build order: 9 of 9. Nothing depends on it. This file is a feasibility outline, not a specification:
it exists to show that the phase-3 feature has a shape we can build, and to fix the vocabulary and
the few equations that everything else will hang from.

---

## 1. Purpose

Connect a motor's measured torque curve to the car: what the car will accelerate at, what speed a
gearing gives, what ESC timing and boost do to both, and how hot it all gets. The audience is the
racer who has a dyno sheet or a club-mate's, and wants to know what a pinion change does before
soldering.

Non-goals: a full ESC firmware model, a motor-design tool, or a lap-time simulator.

---

## 2. What a dyno pull gives

A dyno (inertial or brake) produces **torque versus speed**, plus voltage and current:

| Channel | Unit | Note |
|---|---|---|
| ω | rad/s (or rpm) | shaft speed |
| T | N·m | shaft torque |
| V | V | terminal voltage (battery, under load) |
| I | A | current |
| T_case | °C | case or oil temperature |

From those, everything else is derived:

```
P_mech = T·ω                                                              (9.1)
P_elec = V·I                                                              (9.2)
η      = P_mech/P_elec                                                    (9.3)
```

The corpus shows the RC dyno community works with exactly these channels and that the interesting
comparisons are between motors at the same voltage and the same gearing, so the data model should
store a pull as a table of (ω, T, V, I) samples with a stated `temperature` and `voltage_nominal`.

---

## 3. The motor model

A brushed-equivalent (or a sensored brushless treated as one, which is what the community does when
comparing "kV") DC machine:

```
V = I·R + k_e·ω                                                           (9.4)
T = k_t·I − T_loss(ω)                                                     (9.5)
k_t = k_e   (SI, N·m/A and V·s/rad)                                       (9.6)
```

with `k_e` from the kV rating:

```
k_e = 60/(2π·kV)     V·s/rad        kV in rpm/V                           (9.7)
```

`T_loss(ω)` lumps iron, windage and friction; fit it as `T_0 + k_ω·ω` from the free-running point and
one loaded point. `R` from a stall or a two-point fit. Neither `R` nor `T_loss` is a constant across
temperature — copper resistance rises 0.4%/K — which is a large part of why a hot motor is slower.

**Where a dyno pull replaces the model.** If the user has a pull, use the tabulated `T(ω)` directly
and use (9.4)–(9.7) only to extrapolate outside the measured range and to answer "what if the
voltage were different". Never fit a curve when a table exists.

---

## 4. Gearing and rollout

```
gear ratio    G   = N_spur/N_pinion                                        (9.8)
rollout       R_o = (N_pinion/N_spur)·π·D_tyre      mm per motor revolution (9.9)
wheel speed   ω_w = ω_motor/G                                              (9.10)
vehicle speed v   = ω_w·r_tyre[m] = ω_motor·R_o[m]/(2π)   m/s              (9.11)
tractive force F  = T·G/r_tyre[m]   [N]                                    (9.12)
```

**Units on (9.9)–(9.12).** `D_tyre` and `r_tyre` are stored in **mm** (R-2) and are converted to metres
inside these equations, explicitly: (9.9) produces millimetres per revolution by construction, and
(9.11)/(9.12) divide by 1000 before use. Round 1 wrote (9.12) as `T·G/r_tyre` with no unit note in a
document where `r_tyre` is in mm, which gives a force 1000× too large — the same defect as module 5's
(5.7). G09.6 asserts the unit path.

Note the direction of (9.8) and (9.9): a **bigger pinion** means a *smaller* gear ratio, a *longer*
rollout and more speed for the same motor rpm. Getting this inverted is the classic error, so the app
computes rollout and shows it next to the tooth counts.

### Worked example (hand-checkable)

Touring car: pinion 20T, spur 84T, tyre diameter 64 mm (r = 32 mm).

```
G   = 84/20 = 4.20
R_o = (20/84) × π × 64 = 0.238095 × 201.062 = 47.872 mm per motor revolution
```

At 20 000 rpm:

```
v = 20 000 × 47.872 mm/min = 957 440 mm/min = 957.44 m/min = 15.957 m/s = 57.4 km/h
```

At a motor torque of 0.150 N·m:

```
F = 0.150 × 4.20/0.032 = 19.69 N
a = F/m = 19.69/1.350 = 14.6 m/s²  ≈ 1.5 g
```

A 0.150 N·m motor torque at low speed gives 1.5 g; the same motor at 20 000 rpm gives 57 km/h. The two
numbers are **not simultaneous** — round 1 quoted them as if they were, and at 20 000 rpm a 0.150 N·m
torque would be 314 W at the shaft and 19.7 N of thrust at 16 m/s, i.e. 1.5 g *and* top speed at once,
which no motor does. Stated separately, the feasibility argument is stronger: a 1.5 g launch and a
57 km/h top speed are both in the right box for a modified touring car, and nothing here needs a fudge
factor.

---

## 5. Timing and boost (outline)

ESC timing advances the commutation point; "boost" is additional timing at high rpm, "turbo" is a
timing ramp triggered by time or throttle. Physically, timing changes the current-to-torque
relationship and the phase of the back-EMF, and the effect is **not derivable from the motor's kV** —
it is an ESC-and-motor interaction.

So the model is a **table, not a formula**: for each timing setting, a torque multiplier versus
speed, entered by the user or taken from dyno pulls at two settings. v1 of this feature should refuse
to extrapolate: "you have not entered timing data for this motor" is a better answer than a modelled
one. What the app *can* say without data, as teaching copy: more timing raises kV slightly and raises
heat and current draw, and beyond a point it costs torque at the top end.

---

## 6. Heat

First-order lumped thermal model:

```
C_th·dT/dt = P_loss − (T − T_amb)/R_th                                    (9.13)
P_loss = I²·R(T) + k_iron·ω                                               (9.14)
R(T)   = R₂₀·[1 + α·(T − 20)],   α = 0.00393 /K for copper               (9.15)
```

`C_th` and `R_th` are per-motor inputs (they can be found from a single heat-up run: time constant
`τ = C_th·R_th` and steady-state rise). This is the only part of the module where a *time* axis
appears, and it is what makes "your gearing will cook the motor in a 5-minute main" answerable.

`α = 0.00393 /K` is a physical constant of copper (labelled `assumed` for the alloy actually used);
`C_th`, `R_th` are inputs.

---

## 7. Degenerate cases

| Condition | Behaviour |
|---|---|
| no dyno data and no kV/R | `incompleteModel` — do not model from a name |
| dyno table has < 3 points | warn `sparseData`, no extrapolation |
| pinion or spur = 0 | validation error |
| tyre diameter 0 | validation error |
| timing requested with no timing table | `Undefined(noTimingData)` |
| `T_amb ≥ T_max` | warn; the thermal model has nothing to say |

---

## 8. Golden test cases

Only the gearing arithmetic is specified now; the torque model waits for phase 3.

| ID | Input | Expected | Origin |
|---|---|---|---|
| G09.1 | 20T/84T, D = 64 mm | G = 4.20, rollout = 47.872 mm/rev | hand calc §4 |
| G09.2 | 20 000 rpm, same gearing | v = 15.957 m/s = 57.4 km/h | hand calc §4 |
| G09.3 | T = 0.150 N·m, same gearing, m = 1.350 kg | F = 19.69 N, a = 14.6 m/s² | hand calc §4 |
| G09.4 | kV = 3200 rpm/V | k_e = 2.9842 × 10⁻³ V·s/rad | hand calc (9.7): 60/(2π×3200) |
| G09.5 | 20T → 22T pinion, same spur | rollout 52.66 mm/rev, +10 % speed, −9.1 % force | hand calc (9.9)/(9.12) |
| **G09.6** | **unit path**: `T = 0.150 N·m`, `G = 4.20`, `r_tyre` fed as **32 mm** | F = 19.69 N (not 19 688 N); the same with `r_tyre = 0.032 m` gives the identical answer | (9.12) — catches a millimetre/metre slip |

G09.5 is the sanity check that catches an inverted tooth ratio: a bigger pinion must make the car
faster and weaker, and the numbers must move by `22/20 = 1.10` and `20/22 = 0.909` respectively.
G09.6 is the unit-safety case; without it a millimetre radius passes every magnitude test in this
module.

---

## 9. Feasibility statement

Feasible, with two honest caveats:

1. **The data does not exist for most motors.** A dyno pull is a per-motor artefact, often measured
   by a hobbyist with an inertial rig and unstated conditions. The app should store the pull as data
   with provenance (who, when, what voltage, what ESC, what temperature) and never blend pulls from
   different sources into one curve.
2. **The interesting part — timing and boost — is exactly the part that cannot be derived.** So the
   feature is a *data organiser with good arithmetic*, not a simulator. That is still worth building:
   rollout, gearing and heat questions are the ones racers actually ask, and the arithmetic is
   unambiguous.

Sequencing: ship after modules 1–7 are validated, because the motor feature's value depends on the
chassis model being trusted first.
