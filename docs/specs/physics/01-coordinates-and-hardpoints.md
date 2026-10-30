# 01 — Coordinate system, hardpoint schema and the physics input contract

Build order: 1 of 9. Nothing else in the package can be written before this module is settled,
because every later equation indexes into the point set this module defines.

---

## 1. Purpose

Turn "a chassis someone measured with a caliper" into a validated, unit-safe model that the rest of
the physics can index into without ever asking "which point did you mean?". This module owns:

- the axis system and every sign convention (**normative for the whole physics package**);
- the named hardpoint set for a touring car and for a double-wishbone buggy;
- the physics input contract: every field modules 2–10 consume, with its unit, range and absence
  policy;
- validation, mirroring, ride-height handling and derived distances;
- the failure modes of a bad measurement.

It computes no suspension physics. That starts in module 2.

---

## 2. Axis system (ruling R-1 — normative)

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
- **y** positive to the **left** of the car, looking in the +x direction.
- **z** up, positive away from the road.
- **Origin**: the intersection of the ground plane with the vehicle centre plane, **at the rear axle
  line**.

So: rear contact patches at `x = 0, y = ±t_r/2, z = 0`; front contact patches at
`x = wheelbase, y = ±t_f/2, z = 0`; the centre plane is `y = 0`; the road is `z = 0`.

**This is the single frame for the physics package and it is not negotiable per document.** Round 1
found the requirements document using y-right with a mid-wheelbase origin, which put a developer
128 mm and 257 mm away from a developer following this file, silently and plausibly. The ruling:

> **R-1.** ISO 8855 — x forward, y left, z up, origin on the ground plane at the rear axle centre.
> Per-wheel quantities (camber, toe) are per-wheel signed: positive camber = top outboard, positive
> toe = toe-in, negated where mirroring requires it. Car-level quantities (roll-centre height, load
> transfer) are frame-free and are never signed per side.

`docs/specs/spec.md` §4.2 is being brought into line by the requirements revision (R2-B). Until that
lands, **this section wins** for anything the physics package computes, and a model file written by
the app must satisfy it. If a future reader finds the two documents disagreeing again, the bug is in
`spec.md`, and the fix is one edit there, not a sign table here.

Because z is measured from the road, **ride-height changes move every hardpoint in z**. The model
stores hardpoints at the ride height they were measured at (`measured_at_ride_height`), and a ride
height change is a rigid translation of the chassis-side points followed by a re-solve (§6.4).

---

## 3. Sign conventions

All of these are stored signed and displayed signed. The UI shows the racer's magnitude ("2.0°
negative") but the number in the model is the signed quantity below.

| Quantity | Symbol | Positive means | Scope |
|---|---|---|---|
| Camber | γ | top of the wheel leans **outboard** | **per wheel** |
| Toe | τ | wheel front edge toward the **centreline** (toe-in) | **per wheel** |
| Kingpin inclination | KPI | steering axis leans **inboard** at the top | **per wheel** |
| Scrub radius | r_s | steering-axis ground point **inboard** of the contact patch | **per wheel** |
| Caster | — | steering axis leans **rearward** at the top | per wheel (x-based, so mirror-invariant) |
| Trail | — | steering-axis ground point **ahead** of the contact patch | per wheel (x-based) |
| Bump | — | wheel moves **up** relative to the chassis | axle |
| Chassis roll | φ | **left side up** | car |
| Anti-dive / anti-squat | — | the linkage **reduces** dive / squat | car |
| Roll-centre height, load transfer, balance | z_rc, ΔW | never signed per side — one number for the car | car |

### 3.1 The side sign `s` — how "per wheel" is implemented

Every per-wheel y-signed quantity is evaluated with a side sign, because y points left and the two
corners are mirror images:

```
s = +1  on the left        s = −1  on the right
γ_pw   = s · atan2(Uₒ.y − Lₒ.y, Uₒ.z − Lₒ.z)          per wheel, + = top outboard
KPI_pw = s · atan(−(Uₒ.y − Lₒ.y)/(Uₒ.z − Lₒ.z))
scrub  = s · (y_cp − y_g)
```

Round 1 wrote the camber angle as a bare `atan2` and called it "positive = top outboard". On the
left corner that returns −8.0000° for a car with 8° of KPI and 2° of static camber; on the mirrored
right corner the same formula returns **+8.0000°**, so the app printed camber gain with opposite
signs on the two sides and KPI and scrub radius flipped. Every formula in modules 2 and 4 now
carries `s`. The golden case that would have caught it is G01.9.

**Toe is symmetric, not antisymmetric.** 0.5° of toe-in on the left mirrors to 0.5° of toe-in on the
right, because "toward the centreline" is itself mirrored. Round 1's mirror rule negated toe as well
as camber, which turned a symmetric car into one with 1.0° of total toe error in the one code path
every right-hand corner takes. Camber is genuinely antisymmetric (outboard flips sides); toe is not;
KPI and scrub radius are per-wheel quantities and are unchanged in value under mirroring.

Two notes reviewers will query:

- **Camber is the wheel plane, not the kingpin axis.** They differ by the KPI plus the carrier's own
  built-in camber offset. A setup station measures camber relative to the *chassis*; the road sees
  camber relative to the *road*. Module 2 distinguishes γ_b (body) and γ_r (road) and never
  conflates them. Static camber is a **setup input**, not a derived geometric quantity.
- **Roll sign.** φ > 0 means the chassis lifted its **left** side. In a left-hand corner the car
  leans right, which *raises* the left side, so **φ > 0 in a left-hand corner**; the outer (right)
  wheel compresses and the inner (left) wheel droops. Round 1's prose said the opposite of its own
  table, and every equation in module 2 that mixes roll and bump is written for φ > 0 = left up.

---

## 4. What a "hardpoint" is, and the fields modules 2–10 need

A hardpoint is a **joint centre** — the centre of a pivot, ball joint or ball stud — in the vehicle
frame at the ride height the model was measured at. Not the edge of a bracket, not the moulding
line, not the middle of a screw head. Round 1 claimed a 0.5 mm ball-joint error was "worth ~0.08 mm
of roll centre height"; measured on this car it is worth **−0.94 mm** (module 2 §9). The distinction
matters more than the round-1 text admitted.

### 4.1 Touring car: hinge lower arm, camber-link upper

Most 1/10 touring cars have:

- a **lower arm** pivoting about a **fore-aft hinge axis** on the chassis (two pivot blocks or one
  pin), with one **pivot ball** at the outboard end carrying the hub carrier;
- an **upper camber link**: a single turnbuckle from a ball stud on the chassis to a ball stud on
  the carrier — one distance constraint, not an A-arm;
- a **tie rod** from the steering rack to a steering arm on the carrier.

The corner is a five-constraint linkage; module 2 sees it in the transverse plane as a four-bar:
hinge axis → arm → carrier → camber link.

**Required points for a hinge-type lower arm**: two points on the hinge axis (or one point plus a
unit direction; we store two because that is what a racer measures).

The hinge arm has one consequence the whole package must respect: **it has no side-view line.** Its
axis is along x, so the projection onto x–z used by module 3 is degenerate. Module 3 returns
`noSideViewConstruction`; it does not invent an inboard point (round 1 did, and the number it
produced, 316 %, was an artefact of that invention).

### 4.2 Buggy: double wishbone

Two A-arms, each with two chassis pivots and one outer ball joint. The front-view model is the
textbook four-bar; the extra inner pivot does not change the 2D construction (both pivots project
onto the same transverse line) but it matters for the 3D solve v1 does not do. The schema is the
same; only `arm_type` differs: `hinge` or `aal`.

### 4.3 Per-corner point set

"Req" = required for the module(s) in brackets.

| Key | Meaning | Req |
|---|---|---|
| `lca_in_a`, `lca_in_b` | two points on the lower hinge axis | Req [2] |
| `lca_out` | lower ball joint centre | Req [2] |
| `uca_in` | upper camber link inner ball stud (single link) | Req [2] |
| `uca_in_a`, `uca_in_b` | upper A-arm pivots (buggy) — replaces `uca_in` | Req [2] if `arm_type.upper = aal` |
| `uca_out` | upper ball stud on the carrier | Req [2] |
| `tie_in` | inner tie-rod ball (rack end) | Req [4] |
| `tie_out` | outer tie-rod ball (steering arm) | Req [4] |
| `wc` | wheel centre at ride height | Req [2,5,6] |
| `damper_lo` | lower damper eye (or spring seat) | Req [5] |
| `damper_up` | upper damper eye | Req [5] |
| `arb_drop` | ARB drop-link attachment on the lower arm | Req [5] when a bar is fitted |
| `droop_stop`, `bump_stop` | stop contact points | Opt (not modelled in v1) |

### 4.4 Axle- and corner-level fields — the physics input contract (closes C1)

Round 1's blocker C1: modules 5 and 7 needed eleven numbers the document format did not carry, so
two of the twelve advertised outputs could not be computed from a file that validated. They are now
named fields. **Ownership:** `docs/specs/spec.md` §4.2/§4.3 owns the on-disk document layout; *this
table owns the physics contract* — the field name, unit, range, absence policy and which outputs
consume it. A field missing from either place is a defect; the `spec.md` edit travels in R2-B.

Axle level (`axles.<axle>.*`), required by module 5 for roll stiffness and by module 6 for balance:

| Field | Unit | Range (1/10 TC) | on_absence | Consumed by |
|---|---|---|---|---|
| `arb.bar_diameter` d | mm | 0 – 2.5 (0 = no bar) | `ASSUME(0, flag noBar)` | k_bar → k_φ → balance |
| `arb.span` L_bar | mm | 50 – 120 | `REFUSE` roll stiffness | k_bar |
| `arb.arm_length` a_arm | mm | 12 – 30 | `REFUSE` roll stiffness | k_bar |
| `arb.drop_radius` r_d | mm | derived from `arb_drop` | derived | IR_arm |
| `arb.material` / `arb.shear_modulus` G | — / GPa | steel 79.3, Ti 41 | `ASSUME(79.3, flag assumedMaterial)` | k_θ |
| `arb.rate_at_link` (bench-measured alternative) | N/mm | 0 – 5 | optional; overrides the geometry path | k_bar directly |
| `spring.rate` k_s | N/mm | 1.5 – 6.0 | `REFUSE` wheel rate and everything above it | k_w, f, k_φ |

Corner level (`corners.<c>.damper.*`), required by module 7 — **v1**, as an **estimate** (owner
decision 2026-10-30: damping ratio ships, with a band and an `estimated` badge; the direction of
change must be trustworthy even where the magnitude is ±30 %):

| Field | Unit | Range | on_absence | Consumed by |
|---|---|---|---|---|
| `damper.piston_bore` | mm | 8 – 12 | `REFUSE` ζ — measurable with a caliper | A_p |
| `damper.shaft_dia` | mm | 2 – 4 | `REFUSE` ζ — measurable | A_p |
| `damper.piston_holes` n | count | 2 – 8 | `REFUSE` ζ — countable | A_h |
| `damper.piston_hole_dia` d_h | mm | 0.4 – 1.2 | `REFUSE` ζ — pin gauge, or the maker's drawing | A_h |
| `damper.oil_cst` | cSt | 200 – 900 | `ASSUME(500, flag assumedOil)` — printed on the bottle | ν, and the label only |
| `damper.oil_temp` | °C | 5 – 60 | `ASSUME(20, flag assumedTemp)` | ν(T) |
| `damper.f_blowoff` F_bo | N | 2 – 10 | **`ASSUME(4.0, flag estimatedDamper)`** — dyno-only (07 §2.3); bias is low by the stiction term | force cap |
| `damper.c_post` | N·s/m | 5 – 40 | **`ASSUME(12, flag estimatedDamper)`** — dyno-only | force cap |

The split matters: the four geometry fields are things a racer can measure or read off a drawing, so
their absence is a refusal; the two dyno-only fields are assumed with a flag, and the output that
consumes them carries the `estimated` badge and 07 §9's band. Round 1 refused all six, which made ζ
uncomputable from every file that existed, and separately advertised ζ as a v1 output.

Vehicle level, required by modules 6 and 10:

| Field | Unit | Range | on_absence | Consumed by |
|---|---|---|---|---|
| `mass.total` m | g | 1000 – 1600 | `REFUSE` | everything in 6 |
| `mass.unsprung` m_u | g | 160 – 320 | `ASSUME(0, flag)` — round 1's E1.8 | ΔW_u |
| `cg.height` h | mm | 15 – 45 | **never `measured`** — see below; `ASSUME(component estimate, flag cgInferred)` | ΔW, φ |
| `cg.provenance` | enum | `component_estimate` \| `hang_test` \| `assumed` | `ASSUME(assumed)` | the badge on every load number |
| `cg.components[]` | `{mass, x, y, z}` | g, mm | omit → `assumed` | the component route (§4.5) |
| `cg.unsprung_height` h_u | mm | 0.55 – 0.75 × tyre radius | `ASSUME(0.625 R, flag)` | ΔW_u |
| `chassis.material`, `chassis.thickness` | —, mm | see module 10 | omit → rigid chassis | k_ch |
| `chassis.torsion_measured` | N·m/deg | 0.05 – 5 | omit → estimator | balance split |
| `chassis.ride_height_basis` | enum | `underside_clearance` \| `axle_height` | `ASSUME(underside_clearance)` | whether a thickness change moves the car (10 §3.4) |

**Corner weights.** A model that has four measured corner weights uses them; a model that has only
`mass.total` and a weight split derives them (module 6 §3.1) and reports the derived values as
`derived`, not `measured`.

### 4.5 CG height is inferred, never "measured" (decision D-14, 2026-10-30)

No instrument a club racer owns locates a CG. Corner scales weigh the car; they do not find where
the mass is. Round 1's example model cited `corner scales` as the source of `cg.height`, which is
physically impossible, and the field was `Req`, so a model could not be "complete" without a number
the user had to guess. The two routes now:

**Route A — component-mass estimate (the default).** The user enters the mass and position of each
major component; the app computes the first moment:

```
h = Σ m_i·z_i / Σ m_i
```

Template and worked example for the reference car (every mass and height here is an **input**, range
in brackets, `assumed` until the user weighs them):

| Component | m (g) | z (mm) | Basis |
|---|---|---|---|
| chassis plate (CFRP 2.0 mm) | 84 [60–120] | 8 [5–12] | module 10 §4 |
| motor + rotor + mount | 190 [150–260] | 22 [18–26] | motor sits on the plate, rotor below axle height |
| battery (2S shorty) | 210 [150–320] | 18 [12–26] | strapped to the plate, in front of or behind the motor |
| ESC + receiver + wiring | 45 [30–70] | 24 [15–30] | on the upper deck |
| servo + saver + linkage | 60 [45–80] | 26 [20–32] | ahead of the axle, above the plate |
| body shell + wing | 85 [60–120] | 36 [28–45] | the highest mass on the car |
| hardware, arms, hubs, bumpers | 436 [380–500] | 14 [10–20] | distributed around axle height |

```
Σ m_s = 1110 g     Σ m_s·z = 20 436 g·mm     h_s = 18.411 mm
h = (1110 × 18.411 + 240 × 20.0)/1350 = (20 436 + 4800)/1350 = 18.693 mm
```

**That is 9.3 mm below the 28.0 mm the reference car has been assuming**, and the gap is not a
rounding difference: it is a 33 % change in every absolute load number (module 6 §6.7). The
conclusion is not that 18.69 is right — it is a table of guesses — but that **28.0 mm was never
supported by anything**, and the app must show this number with its provenance rather than as a
fact. The revision that replaces 28.0 in the golden cases is tracked as an open item in 00 §0, not
silently done here, because it would move eight G06 cases on the strength of another set of assumed
component masses.

**Route B — two-hang plumb line (for a user who wants a real number).** Twenty minutes and a length
of cord:

1. Car complete (battery in, body on), on a level surface. Mark the ground plane under the tyres.
2. Hang the car from a single point at the front (a loop through the front bulkhead), let it settle,
   and hang a plumb line from the same point. Photograph the side view square-on with a ruler in
   frame; record where the plumb line crosses the underside.
3. Repeat from a single point at the rear.
4. The CG lies on both vertical lines. Their intersection, in side view, is the CG; its height above
   the ground plane is `h`, its x position is `x_cg`.
5. Repeat the pair of hangs once. The spread between repeats is the honest uncertainty.

Expected uncertainty ±1.5 mm on a 20–28 mm measurement (±0.5 mm from reading the photograph, ±1 mm
from the car not hanging perfectly free). That beats the component estimate by ~5 mm, which is why it
is worth the twenty minutes — and why `99-validation.md` lists it as the cheapest real improvement to
every load number in the app.

**What this does and does not change.** See module 6 §6.7: the front/rear *balance split* is almost
invariant to `h` (0.14 percentage points across the whole 24–32 mm range, because both axles share
the same `h`), while the absolute total load transfer and the roll angle scale with it linearly. The
UI must therefore badge the load magnitude `cgInferred` and **not** the balance number.

---

## 5. Schema on disk (ruling R-2 — mm, g, deg)

```json
{
  "schema_version": "1.1.0",
  "units": {"length": "mm", "mass": "g", "angle": "deg", "spring_rate": "N/mm"},
  "name": "Reference 1/10 TC",
  "source": "docs/specs/physics/01-coordinates-and-hardpoints.md §8",
  "measured_at_ride_height": 5.0,
  "vehicle": {
    "mass_total": 1350.0,
    "mass_unsprung": 240.0,
    "cg": {"x": 141.35, "y": 0.0, "z": 28.0},
    "cg_unsprung_height": 20.0,
    "tyre_radius_front": 32.0,
    "tyre_radius_rear": 32.0,
    "chassis": {"material": "cfrp", "thickness": 2.0, "torsion_measured": null}
  },
  "axles": {
    "front": {"track": 172.0, "spring": {"rate": 3.50},
              "arb": {"bar_diameter": 1.50, "span": 90.0, "arm_length": 20.0,
                      "shear_modulus": 79.3, "rate_at_link": null}},
    "rear":  {"track": 174.0, "spring": {"rate": 2.60},
              "arb": {"bar_diameter": 1.20, "span": 90.0, "arm_length": 20.0,
                      "shear_modulus": 79.3, "rate_at_link": null}}
  },
  "corners": {
    "LF": {
      "arm_type": {"lower": "hinge", "upper": "single_link"},
      "points": {
        "lca_in_a":  [238.0, 30.0, 12.0],
        "lca_in_b":  [272.0, 30.0, 12.0],
        "lca_out":   [259.0, 78.0, 7.0],
        "uca_in":    [250.0, 42.0, 45.0],
        "uca_out":   [254.0, 72.8, 44.0],
        "tie_in":    [225.0, 26.0, 30.0],
        "tie_out":   [243.68, 74.04, 32.0],
        "wc":        [257.0, 86.0, 32.0],
        "damper_lo": [257.0, 60.0, 8.875],
        "damper_up": [257.0, 44.0, 58.0],
        "arb_drop":  [250.0, 55.0, 9.40]
      },
      "damper": {"piston_bore": 9.6, "shaft_dia": 2.5, "piston_holes": 3,
                 "piston_hole_dia": 0.60, "oil_cst": 500, "oil_temp": 20.0,
                 "f_blowoff": 4.0, "c_post": 12.0},
      "setup": {"camber": -2.0, "toe": 0.5},
      "sources": {"lca_out": "caliper, 2026-10-30", "uca_out": "caliper, 2026-10-30"}
    },
    "RF": {"mirror_of": "LF"}
  }
}
```

Notes that matter to the implementer:

- Arrays are `[x, y, z]` in **millimetres**. The one 1000× error that used to be possible here was a
  metre-valued coordinate; the parser now rejects any coordinate with `|c| > 3000 mm` (a 3 m
  hardpoint does not exist on a 1/10 car) and the error message says "coordinates are millimetres".
  Round 1's guard was `|c| > 3` on a metre-valued field; the ruling re-expresses it, it does not
  weaken it.
- **Angles are degrees on disk** — including `camber`, `toe` and `oil_temp`, which round 1's file
  labelled `"units": "SI"` while storing degrees. SI inside the package is radians, and the adapter
  is the only place that conversion happens.
- `"mirror_of": "LF"` generates the right-hand corner by **negating y only**. Camber becomes −γ (it
  is antisymmetric); **toe is unchanged** (it is symmetric); KPI, scrub radius, caster and trail are
  unchanged in value because they are per-wheel quantities (§6.1). The mirrored corner's
  provenance is `derived_by_mirror`, not `measured`, and it is *not* re-solved as if it were the
  left corner: its crank angle, branch sign and monotonicity direction are all different (§6.5).
- A corner may carry explicit points instead. Then the model is flagged `asymmetric` and every
  per-side result is computed per side; nothing is assumed symmetric.
- `sources` is a free-form map from key to prose. Review rule 1 requires it; the app warns when a
  key that feeds a displayed number has no source.

---

## 6. Validation, derivation and the transforms later modules depend on

On load, in this order. The first failure stops the load and returns `incompleteModel`,
`degenerateGeometry` or `coincidentPoints` with the offending keys — never a partially valid model.

1. **Presence**: every `Req` key for the declared `arm_type`, plus every field marked `REFUSE` in
   §4.4 for the outputs the caller asked for (completeness is per output, not global).
2. **Finiteness**: no `NaN`, no `Inf`, no `|coordinate| > 3000 mm`.
3. **Coincidence** (`kCoincidentTol = 1e-3 mm` = 1 µm, one constant for the whole package):
   `lca_in_a` ≠ `lca_in_b` (else the hinge axis is undefined); `lca_out` ≠ both inner points;
   `uca_out` ≠ `uca_in`; `tie_out` ≠ `tie_in`; `damper_lo` ≠ `damper_up`.
4. **Plausibility** (warnings, not errors): link length 5–120 mm; track 100–350 mm; wheelbase
   150–400 mm; tyre radius 15–60 mm; CG height 5–80 mm.
5. **Consistency**: the declared track against `2·|y_cp|`, warn above **2 mm** — see the note below.
6. **Derive** (stored, so later modules never recompute them differently):
   - wheelbase = `|x(wc_front) − x(wc_rear)|`; track = `2·|y_cp|`;
   - every link length, and the hinge-axis unit direction `û`;
   - the **carrier rigid-body offsets** of every carrier-attached point (§6.3);
   - the **arm radius** `r_s` of every lower-arm-attached point from the hinge line.

> **Track-consistency note (round 1 minor, corrected).** Round 1 warned whenever the declared track
> differed from `2·|wc.y|` by more than 1 mm, "because it means the contact patch is not under the
> wheel centre". For a cambered wheel the contact patch is *never* under the wheel centre: at
> γ = −2°, `R·sin γ = 1.12 mm`, already over the threshold. The check must use the cambered contact
> patch, `y_cp = wc.y − R·sin γ` with the side sign applied, or the threshold must be set to
> accommodate the modelled camber. v1 does the former: the check compares the declared track with
> `2·|y_cp|` where `y_cp = s·(|wc.y| − R·sin|γ|)`. If the track was measured between contact patches the
> two agree by construction; if it was taken as `2·|wc.y|` the difference is exactly `R·sin|γ|` (1.12 mm
> at 2°), which is why the tolerance is 2 mm and not the 1 mm round 1 used.

### 6.1 Mirroring rules

Mirroring negates **y** and nothing else. The consequences are not uniform, because the quantities
have different symmetry, and round 1 got two rows of this table wrong:

| Quantity | Under mirroring (y → −y) | Why |
|---|---|---|
| point (x, y, z) | (x, −y, z) | definition |
| camber γ | **−γ** | antisymmetric: outboard flips sides |
| toe τ | **unchanged** | symmetric: "toward the centreline" is mirrored too |
| KPI, scrub radius, trail, caster | **unchanged in value** | per-wheel quantities, evaluated with `s` |
| crank angle θ₀ | different branch, different sign | the mirrored corner has θ₀ = −174.05° against the left's −5.95° |
| dW.z/dθ | **opposite sign** | the mirrored four-bar's wheel rises for decreasing θ |
| `sources` | unchanged (the mirror inherits the left's sources) | the same measurement, both sides |

### 6.2 Ride height — the algorithm round 1 did not specify

`setRideHeight(dz)` is not "translate and hope". After translating the chassis-side points by +dz,
the linkage still has one degree of freedom and nothing about the wheel is determined. The physical
constraint is that **the wheel is still on the road**:

```
1. translate chassis-side points (lca_in_*, uca_in*, tie_in, damper_up) by +dz
   — dz > 0 raises the chassis relative to the wheels, i.e. bump
2. solve θ such that W(θ).z = tyre_radius  (the wheel stays at ride height on the road)
3. re-derive θ₀, (u,v), branch sign and the static Uₒ from that state
4. re-derive everything in §6.6
```

Round 1 said only step 1 plus "re-run the module-2 solve from the new static state", which is
circular: the new static state is what step 2 defines, and a 50/50 guess on the sign of dz inverts
every result.

### 6.3 Rigid-carrier offsets — what module 1 stores and module 2 uses

For every point rigidly attached to the hub carrier (`wc`, `tie_out`, and any `uca_out`-side
accessory), store its components in the static carrier frame:

```
ê₁ = (Uₒ − Lₒ)/d ,  ê₂ = (−ê₁_z, ê₁_y)
(u, v) = ((P₀ − Lₒ)·ê₁, (P₀ − Lₒ)·ê₂)
```

**And nothing else.** Round 1 had `01` §6 delegate the offsets to module 2 and `02` §3.2 delegate the
formula back to `01`, with the result that no document defined the transform for any point other
than the wheel centre — while modules 4 (tie-rod outer ball height) and 5 (damper length) both
needed it. The transform itself lives in `02` §3.2.3 and is **the same function for every
carrier-attached point**; this section only stores the offsets so the two documents cannot drift.

### 6.4 Arm-attached points

`damper_lo` and `arb_drop` are **not** on the carrier: they are on the lower arm, which rotates about
the hinge line. Their transform is a rotation by `θ − θ₀` about the hinge point `Lᵢ` (or about
`lca_in_a` with the rotation axis being the hinge direction, in the general 3D case), which is the
one place in the package where the crank angle *is* the arm rotation. Storing them as carrier-frame
offsets — round 1's implied reading — gives a damper length wrong by several tenths of a millimetre.

---

## 7. Degenerate cases and documented behaviour

| Condition | Detection | Behaviour |
|---|---|---|
| `lca_in_a` == `lca_in_b` | distance < `kCoincidentTol` | `coincidentPoints`, names the pair, load refuses |
| a required point absent | key missing | `incompleteModel`, lists keys |
| coordinate in metres instead of mm | `\|c\| > 3000 mm` | parse error naming the field and the units |
| `uca_out` == `lca_out` | distance < `kCoincidentTol` | `degenerateGeometry` — the carrier has no length |
| `wc.y` on the wrong side for its corner key | sign check per corner against its own key | `degenerateGeometry` |
| asymmetric model with one corner | missing corner | `incompleteModel` |
| hinge axis not along the corner's x direction | `\|û_x\| < 0.99` | accepted; module 3 then *can* build a side-view line |

Structural errors are load-time errors, not compute-time errors. A model that cannot be validated
never reaches module 2.

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
| Mass total | 1350 | g | measured |
| Mass unsprung | 240 | g | estimated (60 g/corner), range 160–320 |
| CG height | 28.0 | mm | assumed, range 15–45 (no measurement procedure exists) |
| Unsprung CG height | 20.0 | mm | estimated, basis 0.625 × tyre radius |
| CG x (from rear axle) | 141.35 | mm | derived from the 45/55 front/rear split |
| Ride height (chassis underside) | 5.0 | mm | measured |

**Sprung mass, which round 1 got wrong in two of three modules.** From the corner weights in module
6 §6.1: `m_s,f = 0.48749 kg` per axle → **0.24375 kg per front corner**; `m_s,r = 0.62249 kg` per axle
→ **0.31125 kg per rear corner**; total sprung 1.110 kg. Module 5's round-1 figures (0.310 front /
0.400 rear) summed to 1.42 kg against a car that has 1.110 kg — and 0.310 is numerically the *rear*
corner's correct value, which is how the slip survived. The identity that catches it is in module 5
§7 (G05.9): `Σ m_s,corner + m_u = m_total` to 1e-9.

### 8.2 Left front corner (x, y, z in mm)

| Point | x | y | z | Note |
|---|---|---|---|---|
| `lca_in_a` | 238.00 | 30.00 | 12.00 | front chassis pivot |
| `lca_in_b` | 272.00 | 30.00 | 12.00 | rear chassis pivot; axis along x at (y, z) = (30, 12) |
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

Lower arm length in the transverse plane:

```
a = √((78.00 − 30.00)² + (7.00 − 12.00)²) = √(48.00² + (−5.00)²) = √2329.00 = 48.2597 mm
```

Upper camber link:

```
b = √((72.80 − 42.00)² + (44.00 − 45.00)²) = √(30.80² + (−1.00)²) = √949.64 = 30.8162 mm
```

Carrier span (lower ball joint to upper ball stud):

```
d = √((72.80 − 78.00)² + (44.00 − 7.00)²) = √((−5.20)² + 37.00²) = √1396.04 = 37.3636 mm
```

Wheelbase from the model: 257.00 − 0.00 = 257.00 mm ✓. Front track: 2 × 86.00 = 172.00 mm ✓.
`damper_lo` is on the arm: at y = 60.00 the arm line is z = 12.00 − (5.00/48.00)·30.00 = 8.875 mm ✓.

Carrier frame at static (for §6.3):

```
ê₁ = (Uₒ − Lₒ)/d = (−5.20, 37.00)/37.3636 = (−0.139170, 0.990268)
ê₂ = (−ê₁_z, ê₁_y) = (−0.990268, −0.139170)
(wc):      (u, v) = (23.6433, −11.4015)
(tie_out): (u, v) = (25.3078,  0.4421)
```

These four numbers are what makes module 2's carrier transform computable; round 1 stored none of
them and left the formula to two documents that each pointed at the other.

### 8.4 Rear corner — not measured, and that is a debt

The reference car has **no rear hardpoints**. Modules 5 and 6 need a rear installation ratio, a rear
bar rate, a rear roll-centre height and a rear track. In this revision they are **inputs with a
range, labelled `assumed`**, not computed values:

| Rear input | Value used in examples | Range | Where |
|---|---|---|---|
| `IR_r` | 0.7071 | 0.60 – 0.80 | 05 §6.5 |
| rear bar rate k_bar,r (d = 1.20 mm, same geometry) | 0.2870 N/mm | 0.15 – 0.45 | 05 §6.3 |
| rear roll-centre height z_rc,r | 6.000 mm | 0 – 20 | 06 §6.3 |
| rear track | 174.0 mm | measured | 01 §8.1 |

Publishing a rear corner in the same schema is the fix, and it is one measurement session. Until
then the balance number is a computed function of four assumptions, and `99-validation.md` §7 says
so in the precision policy.

### 8.5 Buggy corner, same schema

A 1/8 buggy front corner, for contrast — longer arms, more travel, A-arm upper:

| Point | x | y | z |
|---|---|---|---|
| `lca_in_a` | 130.00 | 34.00 | 40.00 |
| `lca_in_b` | 196.00 | 34.00 | 40.00 |
| `lca_out` | 162.00 | 96.00 | 22.00 |
| `uca_in_a` | 138.00 | 40.00 | 78.00 |
| `uca_in_b` | 188.00 | 40.00 | 78.00 |
| `uca_out` | 160.00 | 88.00 | 70.00 |
| `wc` | 162.00 | 110.00 | 47.00 |

Lower arm √((96−34)² + (22−40)²) = 64.560 mm; upper arm √((88−40)² + (70−78)²) = 48.662 mm; carrier
span √((88−96)² + (70−22)²) = 48.662 mm. The upper arm is 75 % of the lower, the lower arm drops
18 mm going outboard (which puts the front-view IC inboard and the roll centre up — module 2 §6.8),
and travel is ±25 mm against the touring car's ±5 mm. That last difference is why the buggy's camber
gain matters and the touring car's barely does.

---

## 9. Assumptions and where this breaks

1. **Static geometry only.** One ride height, rigid bodies. Chassis flex, arm flex, bushing
   compliance and tyre deflection are not represented. On a 1/10 car with plastic arms and
   rubber-sealed pivot balls, compliance can exceed the geometric camber gain — one more reason not
   to over-claim precision (module 2 §9, module 10).
2. **Points are joint centres, not surfaces.** A ball stud's pivot centre is at the ball.
3. **The chassis is assumed rigid between the corners** *unless* module 10 is enabled; module 10
   models torsion as a series spring for the balance split, not as a flexible body.
4. **Two dimensions per view.** Module 2 projects onto y–z, module 3 onto x–z, module 4 onto x–y.
   Exact for a link whose axis lies in the projection plane, approximate otherwise. The measured
   consequence for a 10° plan rake is a 1.6 % change in IC distance and a 1.4 % change in
   roll-centre height (module 2 §9), **not** the ~15 % round 1 claimed.
5. **The hinge axis must be real.** A single-pivot lower arm (some pan cars) requires the user to
   supply the axis direction; the schema does not guess it.

---

## 10. Golden test cases

| ID | Input | Expected | Origin |
|---|---|---|---|
| G01.1 | mirror the LF corner, camber −2.0°, toe +0.5° | RF `lca_out` = (259.0, −78.0, 7.0); camber +2.0°; **toe +0.5°** (unchanged) | hand calc §6.1 |
| G01.2 | parse a coordinate given as `78.0` mm | 78.000 mm, round-trip to 0.078 m at the adapter and back exactly | hand calc (mm ↔ m is ÷1000) |
| G01.3 | reference car `wc` points | wheelbase 257.000 mm, front track 172.000 mm, rear track 174.000 mm | hand calc §8.3 |
| G01.4 | reference car LF | a = 48.2597 mm, b = 30.8162 mm, d = 37.3636 mm | hand calc §8.3 |
| G01.5 | model missing `uca_out` | `incompleteModel`, reason lists `LF.uca_out` | §7 |
| G01.6 | `lca_in_a` = `lca_in_b` = (238.0, 30.0, 12.0) | `coincidentPoints`, names both keys | §7 |
| G01.7 | coordinate `78000` (µm typed where mm expected) | parse error naming the field (`\|c\| > 3000`); no model produced | §5 |
| G01.8 | mirror a corner with toe +0.5° | RF toe = +0.5°, axle total toe = +1.0° | hand calc §6.1 |
| G01.9 | mirror the LF corner, evaluate camber, KPI, scrub with `s` | γ_kp = −8.0000° on **both** corners; KPI = +8.0000° on both; scrub = +7.0162 mm on both; the same quantities evaluated **without** `s` on the RF give +8.0000°, −8.0000°, −7.0162 mm | hand calc §3.1, 02 §6.7 |
| G01.10 | reference LF carrier frame | `(u,v)` for wc = (23.6433, −11.4015); for tie_out = (25.3078, 0.4421) | hand calc §8.3 |
| G01.11 | component-mass CG route, §4.5 table | h_est = 18.69 mm from the listed components; `provenance = component_estimate`; every load output carries `flag cgInferred` | hand calc §4.5 |

Tolerances: 1e-6 mm for distances (exact arithmetic on the stored decimals), 1e-6 ° for angles.

G01.9 is the case round 1 lacked: it is the only one that can fail if the side sign is dropped, and
without it the whole right-hand side of the front-end screen can invert while every test passes.

---

## 11. What to measure on a real car (feeds 99-validation.md)

For each corner: the two lower-arm pivot screw centres, the pivot-ball centre (measure to the ball,
from a setup-station pin), both camber-link ball studs, the rack end and the steering-arm ball, the
wheel centre height, and the ride height at the same moment. Record the caliper's zero error once per
session: a systematic 0.2 mm bias moves the roll centre 0.37 mm and camber gain 5.2 % (module 2 §9),
and there is no way to tell it from a real measurement error after the fact.

**Measure both sides, not one.** The mirror path is a convenience for a car that has been checked
symmetric, not a substitute for measuring the corner whose numbers you will act on.
