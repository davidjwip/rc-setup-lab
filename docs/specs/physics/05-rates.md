# 05 — Rates: installation ratio, wheel rate, anti-roll bar, roll stiffness, ride frequency

Build order: 5 of 9. Depends on module 2 (the carrier's motion) and module 1 (spring/damper geometry).

---

## 1. Purpose

Convert what a racer buys (a spring of "3.5", a 1.5 mm bar) into what the car feels (wheel rate,
roll stiffness, ride frequency). This module is the bridge between the setup sheet and module 6.

| Output | Symbol | Unit |
|---|---|---|
| Installation (motion) ratio at a corner | IR | — |
| Wheel rate | k_w | N/mm |
| Anti-roll bar rate at the wheel | k_bar | N/mm |
| Axle roll stiffness | k_φ | N·m/rad |
| Total roll stiffness | k_φ,total | N·m/rad |
| Ride frequency per axle | f | Hz |
| Critical damping (feeds module 7) | c_crit | N·s/m |

---

## 2. Inputs

| Input | Symbol | Unit | Range (1/10 TC) | Source |
|---|---|---|---|---|
| spring rate (at the spring) | k_s | N/mm | 1.5 – 6.0 | setup |
| spring, progressive? | — | flag | false | setup |
| lower damper mount | D_lo | mm | on the lower arm | module 1 |
| upper damper mount | D_up | mm | chassis | module 1 |
| ARB bar diameter | d | mm | 1.0 – 2.5 | setup |
| ARB bar span between bearings | L_bar | mm | 50 – 120 | module 1 (chassis model) |
| ARB arm length (bar axis to drop link) | a_arm | mm | 12 – 30 | module 1 |
| ARB drop-link attachment on the arm | A_drop | mm | on the lower arm, radius r_d | module 1 |
| blade type? | — | flag | false | setup |
| sprung mass per corner | m_s | kg | 0.20 – 0.45 | module 1 |
| shear modulus of the bar | G | GPa | 79.3 (steel), 26 (titanium) | **assumed** |

`G = 79.3 GPa` is the standard shear modulus for spring steel; it is an engineering constant, not a
measurement of the car, and it is labelled `assumed` in the model. If a car uses a titanium bar,
`G = 41 GPa` (Ti-6Al-4V); carbon bars are not modelled.

Spring rates: touring-car springs are sold either as a rate in N/mm or as a "lb" number that is
actually lb/in. The importer must ask which. A 3.5 N/mm spring is 20 lb/in; a "3.5 lb" spring at
3.5 lb/in would be 0.61 N/mm and would give a 4 Hz car, which is not what anyone races.

---

## 3. Model

### 3.1 Installation ratio

**Definition.** The installation ratio (IRC calls it motion ratio; both names are in use) is the
spring's compression per unit wheel bump:

```
IR = −dL_spring / d z_wheel          (positive in compression)            (5.1)
```

Sign convention: IR > 0 means the spring compresses as the wheel rises. The minus sign exists
because the damper's length *decreases* in bump; getting this sign wrong is harmless for rates
(squared) and fatal for damping direction (module 7).

**Reference implementation — differentiate the geometry.** The damper length is a function of the
crank angle θ from module 2, and the wheel's height is too:

```
L_d(θ) = |D_up − D_lo(θ)|,     z_w(θ) = W(θ).z
IR = (dL_d/dθ) / (dz_w/dθ)                                               (5.2)
```

computed by central difference with h = 0.001 rad. This is the number the app ships, because it is
correct for any linkage — including one where the damper is mounted on the carrier rather than the
arm, and including the change of IR with travel.

**Closed form, for the reviewer.** For a damper whose lower eye is on the lower arm at radius r_s
from the hinge:

```
IR = r_s · (ê_s · ê_t) / (dz_w/dθ)                                       (5.3)
```

where `ê_s` is the unit vector along the damper (lower eye → upper eye), `ê_t` the unit tangent to
the arm's rotation at the lower eye, and `dz_w/dθ` the wheel's vertical velocity per radian of crank
rotation. Check on the reference car: r_s = 30.1623, ê_s·ê_t = 0.91364, dz_w/dθ = 48.7475
→ IR = 0.56531, matching (5.2) exactly.

**The closed form a textbook gives, and why it is 1.5% wrong here.** Most texts write

```
IR ≈ (r_s/a) · cos φ
```

where `a` is the arm length and φ the angle between the damper axis and the perpendicular to the
arm. That approximation replaces `dz_w/dθ` with `a·(ê_t·ẑ)` — the *ball joint's* vertical velocity —
and ignores the extra vertical motion the wheel centre gets from the carrier rotating as the wheel
cambes. On the reference car:

```
a·(ê_t·ẑ) = 48.2597 × 0.99462 = 47.999 mm/rad
dz_w/dθ (measured)             = 48.748 mm/rad      → 1.6% more
```

which makes the textbook form give IR = 0.5741 instead of 0.5653, i.e. a **3.1% error in wheel
rate** after squaring. The app uses (5.2); the textbook form is documented here so that a reviewer
who computes it by hand is not surprised by a 3% discrepancy.

**IR changes with travel.** On the reference car: 0.5597 at −5 mm, 0.5653 at 0, 0.5744 at +5 mm.
That is ±1.3%, which is a ±2.6% change in wheel rate and damping ratio — real, but below the
precision of a spring rate marked on a tin. The app reports the value at static ride height and
does not pretend the rate is constant.

**Squared law.** Rates transform with IR²:

```
k_w = k_s · IR²                                                          (5.4)
```

Force transforms with IR (`F_wheel = F_spring · IR`), so energy and stiffness get the square. This
is the most commonly botched equation in RC setup writing, and the squared law is why a 10% change
in shock mounting position (which changes IR by ~5%) changes wheel rate by 10%.

### 3.2 Anti-roll bar rate

**Torsion bar.** For a bar of diameter d and effective length L_bar loaded in torsion between two
bearings:

```
J   = π·d⁴/32                       polar second moment                        (5.5)
k_θ = G·J/L_bar                     N·m per radian of twist                    (5.6)
```

The arm converts twist to wheel travel. With a drop link at arm radius `a_arm` and an arm-to-wheel
installation ratio `IR_arm = d(arm end travel)/d(wheel travel)`:

```
k_bar = k_θ · (IR_arm / a_arm)²     at the wheel, single-wheel rate             (5.7)
```

`IR_arm` is computed the same way as (5.2), from the drop link's attachment point on the lower arm:
if the drop link attaches at radius `r_d` from the hinge and the arm's travel is the ball joint's,
then `IR_arm ≈ r_d/a`. The app computes it from the geometry; a default of 0.8 is used only when the
`arb_drop` point is missing, and then the flag `assumedLinkage` is set.

**In roll the bar contributes twice its single-wheel rate.** Left wheel up by z, right down by z:
the bar twists by 2θ, so the force at each arm is doubled. This matters for roll stiffness and is
the reason (5.9) has a 2 in it.

**Blade-type bar (outline).** A blade bar's stiffness comes from bending a flat blade rather than
twisting a round bar:

```
k_blade = 3·E·I/L³ · (1/n)          n blades in parallel, cantilever                 (5.8)
```

with `I = b·t³/12` for a rectangular blade of width b and thickness t. Rotating the blade changes
its effective `I` (from `b·t³/12` edge-on to `t·b³/12` flat), which is why the adjustment range is
large and non-linear. **v1 does not derive the setting → stiffness curve**: it takes a measured or
manufacturer-supplied multiplier per setting (1.00, 0.85, 0.65, …) as an input, because a cantilever
blade with a tapered root, a clamped end and a hard-setting stop is not a textbook cantilever. State
this in the UI: "blade position 3 = 0.72 × the position-1 rate (supplied by the user)".

### 3.3 Roll stiffness

Per axle, from the springs and bars:

```
k_φ = (k_w/2 + k_bar) · t²        [N·mm/rad ÷ 1000 → N·m/rad]              (5.9)
```

Derivation, so the factor of 2 is not folklore. In pure roll the wheels move
`z = (t/2)·φ`. Each spring contributes a force `F = k_w·z` at a moment arm `t/2`; two wheels give
a moment `2·k_w·(t/2)φ·(t/2) = k_w·t²·φ/2`. Each bar arm sees twice its single-wheel rate, because
one wheel going up and the other going down twists the bar by 2θ; so the bar contributes
`2·k_bar·(t/2)φ·(t/2) = k_bar·t²·φ`. Adding:

```
k_φ = (k_w/2 + k_bar)·t²
```

which is (5.9), in N·mm per radian; divide by 1000 for N·m per radian.

Total:

```
k_φ,total = k_φ,f + k_φ,r                                                 (5.10)
```

### 3.4 Ride frequency

```
ω_n = √(k_w / m_s)     [rad/s]      f = ω_n/2π     [Hz]                   (5.11)
```

with `k_w` in N/m and `m_s` the **sprung** mass carried by that corner. Using total corner mass
(including the wheel, hub and upright) is a common error and inflates the frequency by 5–10%.

Critical damping, precomputed here because module 7 needs it:

```
c_crit = 2·m_s·ω_n = 2·√(k_w·m_s)                                         (5.12)
```

### 3.5 What the numbers mean at 1/10 scale

| Quantity | 1/10 TC | 1/8 buggy |
|---|---|---|
| Ride frequency | 8–12 Hz | 4–6 Hz |
| Wheel rate, front | 1.0 – 1.6 N/mm | 3 – 6 N/mm |
| IR | 0.5 – 0.7 | 0.5 – 0.8 |
| Roll stiffness, per axle | 25 – 50 N·m/rad | 60 – 120 N·m/rad |

The ride frequencies are 3–5× a road car's, which is what makes an RC car feel "nervous" and what
makes the damper's high-speed behaviour so important. It also means the ride-frequency number is
*not* comparable to anything a road-car engineer would quote.

---

## 4. Assumptions and where this breaks

1. **Linear springs.** Progressive springs (common on buggies) have a rate that is a function of
   travel. v1 models them as linear at the static point and flags `progressiveSpring`. A proper
   treatment needs a rate-vs-travel table as input.
2. **The spring acts along the damper axis.** On a car where the spring and damper are coaxial (most
   RC), fine. Where a rocker separates them, the spring's own IR must be computed from its own
   geometry — the schema has one `damper_*` pair, so rocker cars are modelled as if the spring were
   on the damper. Flagged `rockerApproximated`.
3. **No friction.** Pivot-ball stiction, shock-shaft friction and seal drag are not modelled. On a
   1/10 car these are a significant fraction of the low-speed damper force (module 7 §6).
4. **No droop stops or bump stops in the rate calculation.** A car sitting on its droop screws has
   infinite rate in that direction. v1 reports rates for the free range only.
5. **The bar is a straight torsion bar between rigid bearings.** Real bars have bends, a centre
   section that is loaded differently, and compliant bushings. Expect 10–20% error against a bench
   measurement of the bar alone.
6. **The bar's installation ratio is taken as constant.** It changes with travel like any other IR,
   and more so on a car whose drop links are short.

---

## 5. Degenerate cases

| Condition | Behaviour |
|---|---|
| `damper_lo == damper_up` | `degenerateGeometry` at load |
| `dz_w/dθ` ≈ 0 (damper axis perpendicular to the arm's motion) | `Undefined(noMotionRatio)` — the spring does nothing; almost always a mis-typed point |
| `IR ≤ 0` (damper inverted relative to wheel travel) | `Undefined(outOfDomain)` with the sign explained — this is a modelling error, not a car |
| `k_s ≤ 0` | validation error at entry |
| bar diameter 0 or bar absent | `k_bar = 0`, no flag |
| `arb_drop` missing | `IR_arm = 0.8`, `flags: [assumedLinkage]` |
| `m_s ≤ 0` | validation error |

---

## 6. Worked example

Reference car, front corner.

### 6.1 Installation ratio

Damper geometry (front view, y–z): `D_lo = (60.00, 8.875)`, `D_up = (44.00, 58.00)`.

Lower-eye radius from the hinge:

```
r_s = |(60.00 − 30.00, 8.875 − 12.00)| = |(30.00, −3.125)| = √(900.00 + 9.766) = 30.1623 mm
```

Static damper length:

```
L_d = |(44.00 − 60.00, 58.00 − 8.875)| = |(−16.00, 49.125)| = √(256.00 + 2413.27) = 51.6649 mm
```

Central difference on (5.2) with h = 1 mm of wheel travel:

```
bump = +1.000 mm:  L_d = 51.0989 mm,   z_w = 33.000 mm
bump = −1.000 mm:  L_d = 52.2295 mm,   z_w = 31.000 mm
dL_d/dz_w = (51.0989 − 52.2295)/2.000 = −0.56530
IR = 0.56530   (positive in compression)
```

At the static point with a finer step (h = 1 × 10⁻³ rad on θ) the reference implementation returns
**IR = 0.565308**. Evaluating the same central difference at ±5 mm instead of at static gives 0.55973
and 0.57442 — so IR varies by ±1.3% over ±5 mm of travel, which is a ±2.6% variation in wheel rate.
Small, but it is why the app reports IR at the ride height it was measured at.

Closed-form cross-check (5.3):

```
θ₀ = −5.94686°,  ê_t = (−sin θ₀, cos θ₀) = (0.10361, 0.99462)
ê_s = (D_up − D_lo)/L_d = (−0.30969, 0.95084)
ê_s·ê_t = (−0.30969)(0.10361) + (0.95084)(0.99462) = −0.03209 + 0.94572 = 0.91363
dz_w/dθ = 48.7475 mm/rad
IR = 30.1623 × 0.91363 / 48.7475 = 0.56532   ✓
```

### 6.2 Wheel rate and ride frequency

Spring 3.50 N/mm, sprung corner mass 0.310 kg:

```
k_w = 3.50 × 0.565308² = 3.50 × 0.319573 = 1.11851 N/mm = 1118.51 N/m
ω_n = √(1118.51/0.310) = √3608.1 = 60.067 rad/s
f   = 60.067/(2π) = 9.560 Hz
c_crit = 2 × √(1118.51 × 0.310) = 2 × 18.621 = 37.242 N·s/m
```

9.6 Hz is a normal touring-car front frequency.

### 6.3 Anti-roll bar

Front bar: d = 1.50 mm, L_bar = 90.0 mm, a_arm = 20.0 mm, IR_arm = 0.80, G = 79.3 GPa.

```
J   = π × (1.50 × 10⁻³)⁴/32 = π × 5.0625 × 10⁻¹²/32 = 4.9701 × 10⁻¹³ m⁴
k_θ = 79.3 × 10⁹ × 4.9701 × 10⁻¹³ / 0.090 = 0.43792 N·m/rad
k_bar = 0.43792 × (0.80/0.020)² = 0.43792 × 1600 = 700.67 N/m = 0.7007 N/mm
```

Compare with the spring's wheel rate of 1.12 N/mm: the bar is 63% of the spring rate at the wheel,
which is a strong front bar. (Rear bar, d = 1.20 mm, same geometry: k_bar = 0.2870 N/mm.)

### 6.4 Roll stiffness

Front, t = 172 mm:

```
k_φ,f = (1.11851/2 + 0.7007) × 172² / 1000
      = (0.55926 + 0.7007) × 29584 / 1000
      = 1.25996 × 29.584 = 37.274 N·m/rad
```

Rear, t = 174 mm, k_w = 1.3000 N/mm, k_bar = 0.2870 N/mm:

```
k_φ,r = (0.65000 + 0.2870) × 174² / 1000 = 0.93700 × 30.276 = 28.369 N·m/rad
```

Total **65.64 N·m/rad**. Front share 56.8%.

### 6.5 Rear ride frequency

Rear spring 2.60 N/mm, IR_r = 0.7071, sprung rear corner 0.400 kg:

```
k_w = 2.60 × 0.7071² = 2.60 × 0.50000 = 1.3000 N/mm
ω_n = √(1300/0.400) = √3250 = 57.009 rad/s,  f = 9.073 Hz
c_crit = 2 × √(1300 × 0.400) = 45.607 N·s/m
```

Front 9.56 Hz, rear 9.07 Hz — a 5% split, which is a deliberate, small front bias.

---

## 7. Golden test cases

| ID | Input | Expected | Origin |
|---|---|---|---|
| G05.1 | reference front damper geometry | IR = 0.565308 ± 1e-5 | hand calc §6.1 (closed form agrees) |
| G05.2 | k_s = 3.50 N/mm, IR = 0.565308 | k_w = 1.11851 N/mm | hand calc §6.2 |
| G05.3 | k_w = 1.11851 N/mm, m_s = 0.310 kg | f = 9.560 Hz, c_crit = 37.242 N·s/m | hand calc §6.2 |
| G05.4 | bar d = 1.50, L = 90, a = 20, IR_arm = 0.80, G = 79.3 GPa | k_bar = 0.70067 N/mm | hand calc §6.3 |
| G05.5 | front axle, §6.4 data | k_φ,f = 37.274 N·m/rad | hand calc §6.4 |
| G05.6 | rear, §6.5 data | f = 9.073 Hz | hand calc §6.5 |
| G05.7 | damper axis exactly perpendicular to the arm's motion (D_up placed 90° from ê_t) | `Undefined(noMotionRatio)` | spec §5 |
| G05.8 | k_s = 0 | validation error, no computation | spec §5 |

Tolerances: 1 × 10⁻⁵ on IR (it is a smooth derivative), 1 × 10⁻⁴ relative on rates and
frequencies.

**Origins:** every value is a hand calculation in §6. G05.1 is the only one where an independent
check exists (the closed form (5.3) reproduces the numerical derivative to 5 significant figures),
and that agreement is the reason to trust the implementation of (5.2).

---

## 8. Sensitivity notes for the UI

| Change | Effect on wheel rate |
|---|---|
| IR ±1% (shock mounting position) | ±2% |
| spring rate ±5% | ±5% |
| bar diameter ±0.05 mm on a 1.5 mm bar | ±14% (d⁴ law!) |
| bar arm length ±1 mm on 20 mm | ±10% |

The d⁴ and 1/a² laws are why a bar change feels so much bigger than a spring change on an RC car,
and why the app should show the bar's contribution as a percentage of the total roll stiffness
rather than as an isolated number.
