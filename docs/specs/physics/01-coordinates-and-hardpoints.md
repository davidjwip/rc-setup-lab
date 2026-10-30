# 01 — Coordinate system and hardpoint schema

Build order: 1 of 9. Nothing else in the package can be written before this module is settled,
because every later equation indexes into the point set this module defines.

---

## 1. Purpose

Turn "a chassis someone measured with a caliper" into a validated, unit-safe model that the rest
of the physics can index into without ever asking "which point did you mean?". This module owns:

- the axis system and every sign convention;
- the named hardpoint set for a touring car and for a double-wishbone buggy;
- the on-disk schema;
- validation, mirroring and derived distances;
- the failure modes of a bad measurement.

It computes no suspension physics. That starts in module 2.

---

## 2. Axis system

**ISO 8855 vehicle axes**, right-handed:

```
        z (up)
        │
        │        x (forward)
        │      ╱
        │    ╱
        └──────── y (left)
      origin
```

- **x** forward, positive toward the front of the car.
- **y** positive to the **left** of the car, when looking in the +x direction.
- **z** up, positive away from the road.

A right-handed system with z up forces y to the left. That is worth stating loudly, because half
the world's spreadsheet suspension models use y-to-the-right and every sign error in camber,
toe and roll traces back to it.

**Origin**: the intersection of the ground plane with the vehicle centre plane, at the **rear axle
line**. So:

| Point | Coordinate |
|---|---|
| Rear wheel contact patches | x = 0, y = ±half-rear-track, z = 0 |
| Front wheel contact patches | x = wheelbase, y = ±half-front-track, z = 0 |
| Vehicle centre plane | y = 0 |
| Road | z = 0 |

Putting the origin at the **rear** axle means the front axle sits at x = +wheelbase and every
x coordinate in a real measurement (which a racer takes from the front of the car) has to be
flipped once, in the importer. The alternative — origin at the front axle, x positive rearward —
contradicts "x is forward" and causes exactly the confusion this document exists to prevent. We
take the flip.

Because z is measured from the road, **ride height changes move every hardpoint in z**. The model
stores hardpoints at the ride height they were measured at (`measured_at_ride_height`), and a ride
height change applies a rigid translation of the chassis-side points only (see §7.3).

---

## 3. Sign conventions

All of these are stored signed and displayed signed. The UI shows the racer's magnitude ("2.0°
negative") but the number in the model is the signed quantity in the table.

| Quantity | Symbol | Positive means | Convention source |
|---|---|---|---|
| Camber | γ | top of the wheel leans **outboard** | ISO/SAE wheel alignment; "−2°" on a setup sheet = γ = −2° |
| Toe (per wheel) | τ | wheel front edge toward the **centreline** (toe-in) | as above |
| Caster | — | steering axis leans **rearward** at the top | SAE |
| Kingpin inclination (KPI) | — | steering axis leans **inboard** at the top | SAE |
| Scrub radius | r_s | steering-axis ground point **inboard** of the contact-patch centre | SAE |
| Trail | — | steering-axis ground point **ahead** of the contact-patch centre | SAE |
| Bump | — | wheel moves **up** relative to the chassis | practice |
| Droop | — | wheel moves **down** relative to the chassis (negative bump) | practice |
| Chassis roll | φ | **left side up** | this document |
| Anti-dive / anti-squat | — | positive = the linkage **reduces** dive / squat | Gillespie |

Two of these deserve a note because they are the ones reviewers will query:

- **Camber is the wheel plane, not the kingpin axis.** The two differ by the KPI plus the hub
  carrier's own camber offset. A setup station measures camber relative to the *chassis*; the
  road sees camber relative to the *road*. Module 2 distinguishes γ_b (body) and γ_r (road) and
  never conflates them. Static camber is a **setup input**, not a derived geometric quantity.
- **Roll sign.** φ > 0 means the chassis lifted its left side. In a left-hand corner the car rolls
  right, so φ < 0; the outer (right) wheel compresses and the inner (left) wheel droops. Every
  equation in module 2 that mixes roll and bump has been written against this convention and
  checked numerically in the module's worked example (§6.4).

---

## 4. What a "hardpoint" is

A hardpoint is a **joint centre** — the centre of a pivot, ball joint or ball stud — expressed in
the vehicle frame at the ride height the model was measured at. Not the edge of a bracket, not the
moulding line, not the middle of a screw head. The distinction matters: a 0.5 mm error in a ball
joint centre is a 0.5 mm error in every downstream number, and in the touring-car geometry below
it is worth ~0.08 mm of roll centre height.

### 4.1 Touring car: pivot-ball lower arm, camber-link upper

Most 1/10 touring cars have:

- a **lower wishbone** that pivots about a **fore-aft hinge axis** on the chassis (often two
  separate pivot blocks or a single pin), with one **pivot ball** at the outboard end carrying the
  hub carrier;
- an **upper camber link**: a single turnbuckle from a ball stud on the chassis (bulkhead or upper
  deck) to a ball stud on the hub carrier. A single link is not an A-arm: it constrains one
  distance, so the carrier's rotation about the lower ball joint is what the *tie rod* and the
  camber link jointly determine.
- a **tie rod** from the steering rack to a steering arm on the carrier.

So a touring-car corner is a five-constraint linkage, and the front-view model in module 2 sees it
as a four-bar: hinge axis → arm → carrier → camber link.

**Required points for a hinge-type lower arm**: two points on the hinge axis, or one point plus a
unit axis direction. We store two points because that is what a racer can measure (the two pivot
screws) and because it makes the axis direction unambiguous.

### 4.2 Buggy: double wishbone

A buggy typically has two **A-arms**, each with two chassis pivots and one outer ball joint, and a
damper often mounted on the lower arm with a rocker or directly. The front-view model is the
textbook four-bar; the extra inner pivot does not change the 2D construction (both pivots project
onto the same line in the transverse plane) but it *does* matter for the 3D solve that v1 does not
do (see §9).

The schema is the same; only the `arm_type` differs: `hinge` or `aal`.

### 4.3 Point set

Per corner. "Req" = required for the module(s) in brackets; "Opt" = optional.

| Key | Meaning | Req |
|---|---|---|
| `lca_in_a`, `lca_in_b` | two points on the lower-arm hinge axis | Req [2] |
| `lca_out` | lower ball joint centre | Req [2] |
| `uca_in` | upper camber link inner ball stud (single link) | Req [2] |
| `uca_in_a`, `uca_in_b` | upper A-arm pivots (buggy) — replaces `uca_in` | Req [2] if `arm_type=aal` |
| `uca_out` | upper ball stud on the carrier | Req [2] |
| `tie_in` | inner tie-rod ball (rack end) | Req [4] |
| `tie_out` | outer tie-rod ball (steering arm) | Req [4] |
| `wc` | wheel centre at ride height | Req [2,5,6] |
| `damper_lo` | lower damper eye (or spring seat) | Req [5,7] |
| `damper_up` | upper damper eye | Req [5,7] |
| `arb_drop` | ARB drop-link attachment on the lower arm | Opt [5] |
| `droop_stop` | droop-screw contact point | Opt (not modelled in v1) |
| `bump_stop` | bump-stop contact point | Opt (not modelled in v1) |

Vehicle level: `wheelbase`, `track_front`, `track_rear` (contact-patch centres, so they are
*derived* from the `wc` points and only stored as a cross-check), `tyre_radius_front/rear`,
`mass_total`, `mass_unsprung`, `cg_height`, `cg_x`, and per-corner static camber/toe.

---

## 5. Schema

```json
{
  "schema_version": 1,
  "units": "SI",
  "name": "Reference 1/10 TC",
  "source": "docs/specs/physics/01-coordinates-and-hardpoints.md §8",
  "measured_at_ride_height": 0.005,
  "vehicle": {
    "mass_total": 1.35,
    "mass_unsprung": 0.24,
    "cg": {"x": 0.14135, "y": 0.0, "z": 0.028},
    "tyre_radius_front": 0.032,
    "tyre_radius_rear": 0.032
  },
  "corners": {
    "LF": {
      "arm_type": {"lower": "hinge", "upper": "single_link"},
      "points": {
        "lca_in_a":  [0.238, 0.030, 0.012],
        "lca_in_b":  [0.272, 0.030, 0.012],
        "lca_out":   [0.259, 0.078, 0.007],
        "uca_in":    [0.250, 0.042, 0.045],
        "uca_out":   [0.254, 0.0728, 0.044],
        "tie_in":    [0.225, 0.026, 0.030],
        "tie_out":   [0.24368, 0.07404, 0.032],
        "wc":        [0.257, 0.086, 0.032],
        "damper_lo": [0.257, 0.060, 0.008875],
        "damper_up": [0.257, 0.044, 0.058],
        "arb_drop":  [0.250, 0.055, 0.0094]
      },
      "sources": {"lca_out": "caliper, 2026-10-30", "uca_out": "caliper, 2026-10-30"},
      "setup": {"camber": -2.0, "toe": 0.5}
    },
    "RF": {"mirror_of": "LF"}
  }
}
```

Notes that matter to the implementer:

- Arrays are `[x, y, z]` in **metres**. Not millimetres. This is the only place a 1000× error can
  enter, so the parser rejects any coordinate with `|c| > 3` on `x`/`y`/`z` (a 3 m hardpoint does
  not exist on a 1/10 car) and the error message says "coordinates are metres".
- `"mirror_of": "LF"` generates the right-hand corner by negating **y only**, and negating the
  signs of `camber` and `toe` (they are left/right-asymmetric scalars). It is not a copy.
- A corner may instead carry explicit points. Then the model is flagged `asymmetric` and every
  per-side result is computed per side; nothing is assumed symmetric. This is how a tweaked car
  is modelled, and module 2's roll-centre migration needs it.
- `sources` is a free-form map from point key to prose. Review rule 1 requires it; the app warns
  when a point that feeds a displayed number has no source.

---

## 6. Validation and derived quantities

On load, in this order. The first failure stops the load and returns `incompleteModel` or
`degenerateGeometry` with the offending keys — never a partially valid model.

1. **Presence**: every `Req` key for the declared `arm_type`.
2. **Finiteness**: no `NaN`, no `Inf`, no `|coordinate| > 3 m`.
3. **Coincidence**: `lca_in_a` and `lca_in_b` must differ by > 1 µm (else the hinge axis is
   undefined); `lca_out` ≠ `lca_in_*`; `uca_out` ≠ `uca_in`; `tie_out` ≠ `tie_in`;
   `damper_lo` ≠ `damper_up`.
4. **Plausibility** (warnings, not errors): link length in 5–120 mm; track 100–350 mm; wheelbase
   150–400 mm; tyre radius 15–60 mm; CG height 5–80 mm. These catch a factor-of-1000 or a unit
   mix, not a bad setup.
5. **Consistency**: `|wc.y|` vs the declared track — warn if the declared track differs from
   `2·|wc.y|` by more than 1 mm, because it means the contact patch is not under the wheel centre.
6. **Derive**: wheelbase = `|x(wc_front) − x(wc_rear)|`; track = `2·|y(wc)|`; tyre radius =
   `z(wc)`; every link length; the hinge-axis unit direction; the carrier's rigid-body offsets
   (which module 2 needs).

### 6.1 Mirroring rules

Mirroring negates y and nothing else:

| Quantity | Mirrored value |
|---|---|
| point (x, y, z) | (x, −y, z) |
| camber γ | −γ |
| toe τ | −τ |
| caster, KPI, trail | unchanged (they are defined per wheel, mirrored in y) |
| scrub radius | unchanged in magnitude, sign convention already per-wheel |

### 6.2 Ride-height change

Ride height is a setup input. Changing it translates the **chassis-side** points (the hinge axis
points, `uca_in`, `tie_in`, `damper_up`) by Δz and leaves the wheel/road frame alone — but the
wheel centre, which is measured at the old ride height, must then be re-solved by module 2, not
translated. v1 implements `rideHeightChange(models, dz)` as translating the chassis points only,
then re-running the module-2 solve from the new static state. Any other treatment double-counts.

---

## 7. Degenerate cases and documented behaviour

| Condition | Detection | Behaviour |
|---|---|---|
| `lca_in_a` == `lca_in_b` | distance < 1 µm | `degenerateGeometry`, lists the pair, load refuses |
| a required point absent | key missing | `incompleteModel`, lists keys |
| coordinate in mm instead of m | `\|c\| > 3` | parse error naming the field and the units |
| `uca_out` == `lca_out` | distance < 1 µm | `degenerateGeometry` — the carrier has no length, the four-bar is undefined |
| `wc.y` ≤ 0 on the LF corner | sign check | `degenerateGeometry` — the corner is on the wrong side |
| asymmetric model with only one corner | missing corner | `incompleteModel` |

Structural errors are load-time errors, not compute-time errors. A model that cannot be validated
never reaches module 2, so no later function needs to defend against a coincident pair.

---

## 8. Worked example — the reference car

All of modules 2–7 use this car. Every number in those modules traces back to this table.

### 8.1 Vehicle

| Item | Value | Unit | Source |
|---|---|---|---|
| Wheelbase | 257.0 | mm | measured |
| Front track (contact patches) | 172.0 | mm | measured |
| Rear track (contact patches) | 174.0 | mm | measured |
| Tyre radius F/R | 32.0 | mm | measured |
| Mass total | 1.350 | kg | measured |
| Mass unsprung | 0.240 | kg | estimated (0.060 kg/corner) |
| CG height | 28.0 | mm | assumed |
| CG x (from rear axle) | 141.35 | mm | derived from the 45/55 front/rear weight split |
| Ride height (chassis underside) | 5.0 | mm | measured |

### 8.2 Left front corner (x, y, z in mm)

| Point | x | y | z | Note |
|---|---|---|---|---|
| `lca_in_a` | 238.00 | 30.00 | 12.00 | front chassis pivot |
| `lca_in_b` | 272.00 | 30.00 | 12.00 | rear chassis pivot; axis is along x at (y, z) = (30, 12) |
| `lca_out` | 259.00 | 78.00 | 7.00 | lower pivot ball |
| `uca_in` | 250.00 | 42.00 | 45.00 | camber-link inner ball stud |
| `uca_out` | 254.00 | 72.80 | 44.00 | camber-link outer ball stud |
| `tie_in` | 225.00 | 26.00 | 30.00 | rack end |
| `tie_out` | 243.68 | 74.04 | 32.00 | steering arm |
| `wc` | 257.00 | 86.00 | 32.00 | wheel centre |
| `damper_lo` | 257.00 | 60.00 | 8.875 | on the lower arm |
| `damper_up` | 257.00 | 44.00 | 58.00 | chassis |
| `arb_drop` | 250.00 | 55.00 | 9.40 | on the lower arm |

### 8.3 Derived, hand-checked

Lower arm length, front view:

```
a = √((78.00 − 30.00)² + (7.00 − 12.00)²)
  = √(48.00² + (−5.00)²)
  = √(2304.00 + 25.00)
  = √2329.00
  = 48.2597 mm
```

Upper camber link:

```
b = √((72.80 − 42.00)² + (44.00 − 45.00)²)
  = √(30.80² + (−1.00)²)
  = √(948.64 + 1.00)
  = 30.8162 mm
```

Carrier span (lower ball joint to upper ball stud):

```
d = √((72.80 − 78.00)² + (44.00 − 7.00)²)
  = √((−5.20)² + 37.00²)
  = √(27.04 + 1369.00)
  = √1396.04
  = 37.3636 mm
```

Wheelbase from the model: 257.00 − 0.00 = 257.00 mm ✓ matches the declared value.
Front track: 2 × 86.00 = 172.00 mm ✓.

`damper_lo` is on the arm: at y = 60.00 the arm line is z = 12.00 − (5.00/48.00)·30.00 = 8.875 mm ✓.

### 8.4 Buggy corner, same schema

A 1/8 buggy front corner, for contrast. Note the longer arms, the greater travel and the A-arm
upper:

| Point | x | y | z |
|---|---|---|---|
| `lca_in_a` | 130.00 | 34.00 | 40.00 |
| `lca_in_b` | 196.00 | 34.00 | 40.00 |
| `lca_out` | 162.00 | 96.00 | 22.00 |
| `uca_in_a` | 138.00 | 40.00 | 78.00 |
| `uca_in_b` | 188.00 | 40.00 | 78.00 |
| `uca_out` | 160.00 | 88.00 | 70.00 |
| `wc` | 162.00 | 110.00 | 47.00 |

Lower arm √((96−34)² + (22−40)²) = 64.560 mm, upper arm √((88−40)² + (70−78)²) = 48.662 mm,
carrier span √((88−96)² + (70−22)²) = 48.662 mm. The upper arm is 75% of the lower, the arms are
long relative to the 220 mm track, the lower arm drops 18 mm going outboard (that is what puts the
front-view instant centre inboard and the roll centre up — module 2 §6.5), and travel is ±25 mm
instead of ±5 mm. That last difference — travel — is why the buggy's camber gain matters and the
touring car's barely does (module 2 §7).

---

## 9. Assumptions and where this breaks

1. **Static geometry only.** The model is a rigid-body description at one ride height. Chassis
   flex, arm flex, bushing compliance and tyre deflection are not represented. On a 1/10 car with
   plastic arms and rubber-sealed pivot balls, compliance can easily exceed the geometric camber
   gain, which is one more reason not to over-claim precision (see module 2 §7).
2. **Points are joint centres, not surfaces.** A ball stud's effective pivot centre is at the
   ball, not the top of the stud. A measurement taken to the top of the stud biases the geometry
   by the stud's length.
3. **The chassis is assumed rigid between the four corners.** Real cars tweak; the tweak is not
   modelled, only the static asymmetry it produces.
4. **Two dimensions per view.** Module 2 projects onto the transverse plane, module 3 onto the
   side plane, module 4 onto the plan plane. That is exact for a link whose axis lies in the
   projection plane and approximate otherwise — the error for a touring car (links within ~5° of
   transverse) is small but non-zero, and is the main gap between this model and a 3D one.
5. **The hinge axis must be real.** If a chassis uses a single-pivot lower arm (some pan cars),
   the user must supply the axis direction explicitly; the schema does not guess it.

---

## 10. Golden test cases

| ID | Input | Expected | Origin |
|---|---|---|---|
| G01.1 | mirror the LF corner `lca_out` = (0.259, 0.078, 0.007) | RF `lca_out` = (0.259, −0.078, 0.007); camber −2.0° → +2.0° | hand calc §6.1 (negate y only) |
| G01.2 | parse a coordinate given as `0.078` m | 78.000 mm, round-trip back to 0.078 m exactly | hand calc (SI ↔ mm is ×1000) |
| G01.3 | reference car `wc` points | wheelbase 257.000 mm, front track 172.000 mm, rear track 174.000 mm | hand calc §8.3 |
| G01.4 | reference car LF | a = 48.2597 mm, b = 30.8162 mm, d = 37.3636 mm | hand calc §8.3 |
| G01.5 | model missing `uca_out` | `incompleteModel`, reason lists `LF.uca_out` | spec §7 |
| G01.6 | `lca_in_a` = `lca_in_b` = (0.238, 0.030, 0.012) | `degenerateGeometry`, reason `coincidentPoints`, names both keys | spec §7 |
| G01.7 | coordinate `78.0` (mm typed where m expected) | parse error naming the field; no model is produced | spec §7 |

Tolerances: 1 × 10⁻⁹ m for distances (these are exact arithmetic on three decimal places),
1 × 10⁻⁶ ° for angles.

---

## 11. What to measure on a real car (feeds 99-validation.md)

For each corner: lower-arm pivot screw centres (both), pivot-ball centre (use the ball, measure
from a setup-station pin), camber-link ball studs (both ends), rack end and steering-arm ball,
wheel centre height, and the ride height at the same moment. Record the caliper's zero error once
per session; a systematic 0.2 mm bias shows up as a roll-centre shift and there is no way to tell
it from a real measurement error after the fact.
