# 05 — Rates: installation ratio, wheel rate, anti-roll bar, roll stiffness, ride frequency

Build order: 5 of 9. Depends on module 2 (the carrier and arm motion) and module 1 (spring/damper
geometry, bar geometry, sprung mass).

---

## 1. Purpose

Convert what a racer buys (a spring of "3.5", a 1.5 mm bar) into what the car feels (wheel rate,
roll stiffness, ride frequency). The bridge between the setup sheet and module 6.

| Output | Symbol | Unit |
|---|---|---|
| Installation (motion) ratio at a corner | IR | — |
| Wheel rate | k_w | N/mm |
| Anti-roll bar rate at the wheel | k_bar | N/mm |
| Axle roll stiffness | k_φ | N·m/rad |
| Total roll stiffness | k_φ,total | N·m/rad |
| Ride frequency per axle | f | Hz |
| Critical damping (feeds module 7) | c_crit | N·s/m |

**Three things changed in round 2:** the IR sign (B4), the units in (5.7)–(5.9) (A4), and the
reference-car sprung masses (B1), which move every frequency and critical damping in this module and
every damping ratio in module 7.

---

## 2. Inputs

| Input | Symbol | Unit | Range (1/10 TC) | Source |
|---|---|---|---|---|
| spring rate (at the spring) | k_s | N/mm | 1.5 – 6.0 | setup / axle field |
| spring, progressive? | — | flag | false | setup |
| lower damper mount | D_lo | mm | on the lower **arm** | module 1 (`damper_lo`) |
| upper damper mount | D_up | mm | chassis | module 1 (`damper_up`) |
| ARB bar diameter | d | mm | 0 – 2.5 | axle field (§01 §4.4) |
| ARB bar span between bearings | L_bar | mm | 50 – 120 | axle field |
| ARB arm length (bar axis to drop link) | a_arm | mm | 12 – 30 | axle field |
| ARB drop-link attachment on the arm | A_drop | mm | on the lower arm, radius r_d | module 1 (`arb_drop`) |
| ARB shear modulus | G | GPa | steel 79.3, Ti-6Al-4V 41 | **assumed** unless stated |
| blade type? | — | flag | false | setup |
| **sprung mass per corner** | m_s | kg | 0.20 – 0.45 | **module 6 §6.1** (derived from corner weights) |

`G = 79.3 GPa` is the shear modulus of spring steel — an engineering constant, not a measurement of
the car, labelled `assumed`. Titanium is **41 GPa** (round 1's table said 26 and its own note said 41;
41–43 is right for Ti-6Al-4V). Carbon bars are not modelled.

Spring rates: touring-car springs are sold as a rate in N/mm or as a "lb" number that is really lb/in.
The importer must ask which. A 3.5 N/mm spring is 20 lb/in; a "3.5 lb" spring at 3.5 lb/in would be
0.61 N/mm and give a 4 Hz car, which is not what anyone races.

**Sprung corner mass comes from module 6, not module 1.** Round 1 sourced it to module 1, which stores
only `mass_total` and `mass_unsprung`; the per-corner split is derived in module 6 from the corner
weights. That mis-sourcing is how the wrong numbers below survived.

---

## 3. Model

### 3.1 Installation ratio

**Definition.**

```
IR = −dL_spring / dz_wheel          (positive in compression)                    (5.1)
```

IR > 0 means the spring compresses as the wheel rises. The minus sign exists because the damper's
length *decreases* in bump; it is harmless for rates (squared) and fatal for damping direction.

**Reference implementation — differentiate the geometry.**

```
L_d(θ) = |D_up − D_lo(θ)|,     z_w(θ) = W(θ).z
IR = − (dL_d/dθ) / (dz_w/dθ)                                                    (5.2)
```

Round 1's (5.2) dropped the minus while (5.1) had it. On this car `dL_d/dθ = −27.557 mm/rad` and
`dz_w/dθ = +48.748 mm/rad`, so the literal (5.2) gives **IR = −0.5653**, and §5 maps `IR ≤ 0` to
`Undefined(outOfDomain)` — a package in which **every car is undefined**, failing in a way that looks
like a bad model rather than a bad equation. Its own worked example applied the missing minus and got
+0.5653, which is why nobody noticed.

Central difference with `h = 0.001 rad` on θ. This is the number the app ships, because it is correct
for any linkage, including one where the damper is mounted on the carrier rather than the arm, and
including the change of IR with travel.

**`D_lo(θ)` is the arm transform, not the carrier transform:** `D_lo` is bolted to the lower **arm**,
so it rotates by `θ − θ₀` about the hinge point (02 §3.2.3, second rule). Using the carrier rule
instead is a systematic length error of several tenths of a millimetre.

**Closed form, for the reviewer.** For a damper whose lower eye is on the lower arm at radius `r_s`
from the hinge:

```
IR = r_s · (ê_s · ê_t) / (dz_w/dθ)                                              (5.3)
```

with `ê_s` the unit vector along the damper (lower eye → upper eye), `ê_t` the unit tangent to the
arm's rotation at the lower eye, and `dz_w/dθ` the wheel's vertical velocity per radian of crank
rotation. On the reference car: `r_s = 30.1623`, `ê_s·ê_t = 0.91364`, `dz_w/dθ = 48.7475` →
IR = 0.56532, matching (5.2).

**The textbook closed form, and why it is 1.5 % wrong here.** Most texts write `IR ≈ (r_s/a)·cos φ`,
which replaces `dz_w/dθ` with the *ball joint's* vertical velocity `a·(ê_t·ẑ)` and ignores the extra
vertical motion the wheel centre gets from the carrier rotating as the wheel cambers:

```
a·(ê_t·ẑ) = 48.2597 × 0.99462 = 47.999 mm/rad     vs    dz_w/dθ = 48.748 mm/rad  (+1.6 %)
```

so the textbook form gives IR = 0.5741 instead of 0.5653 — a **3.1 % error in wheel rate** after
squaring. The app uses (5.2); the textbook form is documented so a reviewer computing by hand is not
surprised by a 3 % discrepancy.

**IR changes with travel.** 0.5597 at −5 mm, 0.5653 at 0, 0.5744 at +5 mm: **±1.3 %**, which is
±2.6 % in wheel rate and **±1.3 % in damping ratio**, because ζ ∝ IR (module 7 §3.4). Round 1 said
"±2.6 % change in wheel rate and damping ratio"; the damping figure was wrong by a factor of two and
contradicted module 7's own derivation.

**Squared law.**

```
k_w = k_s · IR²                                                                 (5.4)
```

Force transforms with IR, energy and stiffness with its square. This is the most commonly botched
equation in RC setup writing.

### 3.2 Anti-roll bar rate

**Torsion bar.**

```
J   = π·d⁴/32                       polar second moment, d in m                  (5.5)
k_θ = G·J/L_bar                     N·m per radian of twist, L_bar in m          (5.6)
```

The arm converts twist to wheel travel. With a drop link at arm radius `a_arm` and an arm-to-wheel
installation ratio `IR_arm = d(arm end travel)/d(wheel travel)`:

```
k_bar [N/m] = k_θ [N·m/rad] · ( IR_arm / a_arm[m] )²                            (5.7)
```

**The units are the point.** Round 1's version read `k_bar = k_θ · (IR_arm/a_arm)²` with `a_arm`
declared in **mm** in the input table and silently written as `0.020` in the arithmetic. An implementer
following 00 §2's old "implicit 10⁻³" instruction computed `0.43792 × (0.80/20)² = 7.007e-4 N/m` — a
1000× error in every bar rate, every roll stiffness and every balance number. The equation now states
that `a_arm` is in metres and that this is where the millimetres on disk become metres. G05.10 feeds
`a_arm = 20` (mm) and asserts 0.70067 N/mm.

`IR_arm` is computed the same way as (5.2) from the drop link's attachment point: if it attaches at
radius `r_d` from the hinge and the arm's travel is the ball joint's, then `IR_arm ≈ r_d/a`, with
`r_d = |arb_drop − Lᵢ|` projected on the arm line. A default of 0.8 is used only when `arb_drop` is
missing, and then `flags: [assumedLinkage]`.

**In roll the bar contributes twice its single-wheel rate.** Left wheel up by z, right down by z: the
bar twists by 2θ, so the force at each arm is doubled. That is why (5.9) has the `k_bar` term
undoubled but multiplied by `t²`: the doubling is already folded into the moment arm pair, not into a
factor of 2 in front of `k_bar`. (Round 1's §3.2 said "the reason (5.9) has a 2 in it", which points
at the wrong factor — the 2 in (5.9) is `k_w/2`.)

**Blade-type bar.**

```
k_blade = 3·E·I/L³ · n             n identical blades in PARALLEL, cantilever       (5.8)
```

with `I = b·t³/12` for a rectangular blade of width b and thickness t. Round 1 wrote `· (1/n)`, which
is the **series** formula: n identical cantilevers in parallel share the load, each sees F/n, so the
total stiffness is `n · 3EI/L³`. v1 does not derive the setting → stiffness curve; it takes a measured
or manufacturer-supplied multiplier per setting, because a cantilever blade with a tapered root, a
clamped end and a hard stop is not a textbook cantilever. The UI says "blade position 3 = 0.72 × the
position-1 rate (supplied by the user)".

### 3.3 Roll stiffness

```
k_φ [N·m/rad] = (k_w[N/mm]/2 + k_bar[N/mm]) · t[mm]² / 1000                     (5.9)
```

Derivation, so the factors are not folklore. In pure roll the wheels move `z = (t/2)·φ`. Each spring
contributes `F = k_w·z` at moment arm `t/2`; two wheels give `k_w·t²·φ/2`. Each bar arm sees twice its
single-wheel rate, giving `k_bar·t²·φ`. Adding: `k_φ = (k_w/2 + k_bar)·t²` in N·mm/rad, and the
`/1000` converts to N·m/rad. **The `/1000` is written into the equation**, as round 1's did; what
round 1 lacked was the same treatment in (5.7) and in module 6.

```
k_φ,total = k_φ,f + k_φ,r                                                      (5.10)
```

### 3.4 Ride frequency

```
ω_n = √(k_w/m_s)  [rad/s]     f = ω_n/2π  [Hz]                                 (5.11)
c_crit = 2·m_s·ω_n = 2·√(k_w·m_s)  [N·s/m]                                     (5.12)
```

with `k_w` in N/m and `m_s` the **sprung** mass carried by that corner. Using total corner mass
inflates the frequency by 5–10 %.

### 3.5 What the numbers mean at 1/10 scale

| Quantity | 1/10 TC | 1/8 buggy |
|---|---|---|
| Ride frequency | 8–12 Hz | 4–6 Hz |
| Wheel rate, front | 1.0 – 1.6 N/mm | 3 – 6 N/mm |
| IR | 0.5 – 0.7 | 0.5 – 0.8 |
| Roll stiffness, per axle | 25 – 50 N·m/rad | 60 – 120 N·m/rad |

These bands are priors, not results: no source and no derivation. The one piece of evidence that they
are right is that the corrected reference car (10.78 Hz) sits inside the band while round 1's
arithmetic (9.56 Hz) also did — which is exactly why the band could not catch the mass error.

---

## 4. Assumptions and where this breaks

1. **Linear springs.** Progressive springs are modelled as linear at the static point, flagged
   `progressiveSpring`.
2. **The spring acts along the damper axis.** True on most RC cars (coaxial). Where a rocker separates
   them, the schema has one `damper_*` pair, so rocker cars are modelled as if the spring were on the
   damper: `rockerApproximated`.
3. **No friction.** Pivot-ball stiction, shaft friction and seal drag are not modelled; on a 1/10 car
   they are a significant fraction of low-speed damper force (module 7 §4.2).
4. **No droop or bump stops.** A car on its droop screws has infinite rate in that direction; v1
   reports the free range only.
5. **The bar is a straight torsion bar between rigid bearings.** Real bars have bends and compliant
   bushings: expect 10–20 % against a bench measurement of the bar alone.
6. **IR_arm is taken as constant** with travel.

---

## 5. Degenerate cases

| Condition | Behaviour |
|---|---|
| `damper_lo == damper_up` | `coincidentPoints` at load |
| `dz_w/dθ ≈ 0` (damper axis perpendicular to the arm's motion) | `Undefined(noMotionRatio)` — the spring does nothing; almost always a mistyped point |
| **`IR < 0`** (damper lengthens in bump) | `Defined(negative IR, flags: [lowConfidence])` — this is a **real geometric inversion**, not an error, and the sign must be reported so module 7 can flip the direction. Round 1 mapped `IR ≤ 0` to `outOfDomain`, which conflated a real inversion with its own sign bug. |
| `IR = 0` exactly | `Undefined(noMotionRatio)` |
| `k_s ≤ 0` | validation error at entry |
| bar diameter 0 or no bar | `k_bar = 0`, no flag |
| `arb_drop` missing | `IR_arm = 0.8`, `flags: [assumedLinkage]` |
| `m_s ≤ 0` | validation error |
| `L_bar ≤ 0` or `a_arm ≤ 0` with a bar fitted | `incompleteModel` (not a silent division) |

---

## 6. Worked example

Reference car, front corner.

### 6.1 Installation ratio

`D_lo = (60.00, 8.875)`, `D_up = (44.00, 58.00)` (front view, y–z).

```
r_s = |(60.00 − 30.00, 8.875 − 12.00)| = |(30.00, −3.125)| = 30.1623 mm
L_d = |(44.00 − 60.00, 58.00 − 8.875)| = |(−16.00, 49.125)| = 51.6649 mm
```

Central difference with ±1 mm of wheel travel:

```
bump = +1.000 mm:  L_d = 51.0989 mm,   z_w = 33.000 mm
bump = −1.000 mm:  L_d = 52.2295 mm,   z_w = 31.000 mm
dL_d/dz_w = (51.0989 − 52.2295)/2.000 = −0.56530
IR = +0.56530   (the minus of (5.1) applied)
```

With `h = 1e-3 rad` on θ the reference implementation returns **IR = 0.565308**; the 1 mm wheel-step
value is 0.565331. The pair differs by 4e-6 and G05.1's tolerance is 1e-5, so **state which one is the
contract**: the shipped value is the **θ-step 0.565308**, and the wheel-step number is the reviewer's
check.

At ±5 mm: 0.55973 and 0.57442 → ±1.3 % over ±5 mm, ±2.6 % in wheel rate.

Closed-form cross-check (5.3):

```
θ₀ = −5.94686°,  ê_t = (−sin θ₀, cos θ₀) = (0.10361, 0.99462)
ê_s = (−0.30969, 0.95084)
ê_s·ê_t = −0.03209 + 0.94572 = 0.91364
IR = 30.1623 × 0.91364 / 48.7475 = 0.56532   ✓
```

### 6.2 Wheel rate and ride frequency (corrected — B1)

**Sprung corner mass 0.24375 kg**, from module 6 §6.1 (`m_s,f = 0.48749 kg` per axle). Round 1 used
0.310 kg, which was the *rear* corner's value; the four corners summed to 1.42 kg against a car with
1.110 kg of sprung mass.

```
k_w = 3.50 × 0.565308² = 3.50 × 0.319573 = 1.11851 N/mm = 1118.51 N/m
ω_n = √(1118.51/0.24375) = √4588.8 = 67.741 rad/s
f   = 67.741/(2π) = 10.782 Hz                      (round 1: 9.560 Hz)
c_crit = 2 × √(1118.51 × 0.24375) = 2 × 16.5115 = 33.023 N·s/m   (round 1: 37.242)
```

10.8 Hz is a normal touring-car front frequency, inside §3.5's 8–12 Hz band — as 9.56 Hz also was,
which is why the band could not catch the error.

### 6.3 Anti-roll bar

Front bar: d = 1.50 mm, L_bar = 90.0 mm, a_arm = 20.0 mm, IR_arm = 0.80, G = 79.3 GPa.

```
J    = π × (1.50e-3)⁴/32 = 4.9701e-13 m⁴
k_θ  = 79.3e9 × 4.9701e-13 / 0.090 = 0.43792 N·m/rad
k_bar = 0.43792 × (0.80/0.020)² = 0.43792 × 1600 = 700.67 N/m = 0.70067 N/mm
```

Note `0.020` is `a_arm` **in metres** — that conversion is (5.7)'s, and it is written there now.

Compare with the spring's wheel rate of 1.12 N/mm: the bar is 63 % of it at the wheel, a strong front
bar. Rear bar, d = 1.20 mm, same geometry: `k_bar = 0.28700 N/mm`.

### 6.4 Roll stiffness

```
k_φ,f = (1.11851/2 + 0.70067) × 172²/1000 = 1.25993 × 29.584 = 37.274 N·m/rad
k_φ,r = (1.29998/2 + 0.28700) × 174²/1000 = 0.93699 × 30.276 = 28.368 N·m/rad
k_φ,total = 65.642 N·m/rad       front share 56.78 %
```

### 6.5 Rear ride frequency (corrected — and flagged as assumed input)

**`IR_r = 0.7071` is an assumed input, not a computed value.** The reference car has no rear
hardpoints (module 1 §8.4), so `IR_r`, the rear bar rate and `z_rc,r` are labelled inputs with ranges.
Round 1 presented them as "the same geometry" and quoted every value as a hand calculation; 00 §10's
checklist ("no step relies on a number that appears nowhere else") failed on all three.

```
rear spring 2.60 N/mm, IR_r = 0.7071 (assumed, range 0.60–0.80)
k_w,r = 2.60 × 0.7071² = 2.60 × 0.50000 = 1.30000 N/mm
m_s,r = 0.31125 kg  (module 6 §6.1; round 1 used 0.400 kg)
ω_n = √(1300/0.31125) = √4176.7 = 64.628 rad/s
f   = 10.286 Hz                                    (round 1: 9.073 Hz)
c_crit = 2 × √(1300 × 0.31125) = 2 × 20.115 = 40.230 N·s/m   (round 1: 45.607)
```

Front 10.782 Hz, rear 10.286 Hz — a 4.8 % split with a small front bias. **Both figures inherit the
assumed `IR_r`**: a 10 % error in `IR_r` moves the rear frequency by 5 % and, because the split is the
headline, moves the *relative* front/rear balance of the frequency pair by the same amount.

---

## 7. Golden test cases

| ID | Input | Expected | Origin |
|---|---|---|---|
| G05.1 | reference front damper geometry | IR = 0.565308 ± 1e-5 | hand calc §6.1 (closed form agrees to 5 s.f.) |
| G05.2 | k_s = 3.50 N/mm, IR = 0.565308 | k_w = 1.11851 N/mm | hand calc §6.2 |
| **G05.3** | k_w = 1.11851 N/mm, **m_s = 0.24375 kg** | f = **10.782 Hz**, c_crit = **33.023 N·s/m** | hand calc §6.2 |
| G05.4 | bar d = 1.50, L = 90, a = 20, IR_arm = 0.80, G = 79.3 GPa | k_bar = 0.70067 N/mm | hand calc §6.3 |
| G05.5 | front axle, §6.4 data | k_φ,f = 37.274 N·m/rad; front share 56.78 % | hand calc §6.4 |
| **G05.6** | rear, §6.5 data, **m_s = 0.31125 kg** | f = **10.286 Hz**, c_crit = **40.230 N·s/m** | hand calc §6.5 (IR_r assumed) |
| G05.7 | damper axis exactly perpendicular to the arm's motion | `Undefined(noMotionRatio)` | §5 |
| G05.8 | k_s = 0 | validation error, no computation | §5 |
| **G05.9** | **mass budget**: reference car | `2·m_s,f,corner + 2·m_s,r,corner + m_u = m_total` → 2(0.24375) + 2(0.31125) + 0.240 = 1.350 kg, to 1e-9 | identity, module 6 §6.1 |
| **G05.10** | **unit safety**: `a_arm` fed as 20 (mm), everything else as in G05.4 | k_bar = 0.70067 N/mm; and fed as 0.020 (m) | (5.7) |
| **G05.11** | **IR sign**: damper that lengthens in bump (D_up placed below D_lo) | `Defined` with IR < 0 and `lowConfidence`, **not** `outOfDomain` | §5 |
| **G05.12** | blade bar, n = 2 identical blades | k_blade(2) = 2 × k_blade(1) (parallel), not half | (5.8) |

Tolerances: 1e-5 on IR, 1e-4 relative on rates and frequencies.

**Origins:** every value is a hand calculation in §6. G05.9 is the identity that catches round 1's
class of error and nothing in the round-1 suite made. G05.10 would have caught the 10⁻³ ambiguity; the
`a_arm` in metres and in millimetres are the two halves of the same test.

---

## 8. Sensitivity notes for the UI

| Change | Effect on wheel rate |
|---|---|
| IR ±1 % (shock mounting position) | ±2 % (and ±1 % on ζ) |
| spring rate ±5 % | ±5 % |
| bar diameter ±0.05 mm on a 1.5 mm bar | ±14 % (d⁴ law) |
| bar arm length ±1 mm on 20 mm | ±10 % |
| bar span ±5 mm on 90 mm | ±5.5 % |

The d⁴ and 1/a² laws are why a bar change feels much bigger than a spring change on an RC car, and why
the app should show the bar's contribution as a percentage of total roll stiffness rather than as an
isolated number. The arm-length and span figures are the reason module 6's balance carries a ±1.5 pp
band for a realistic bar measurement (99 §7): ±0.05 mm on a 1.5 mm bar is ±1.2 percentage points
of balance.
