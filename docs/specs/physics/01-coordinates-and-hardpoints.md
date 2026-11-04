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
- **Origin**: the **top surface of the chassis plate**, at the rear axle centre-line, on the vehicle
  centre plane. `z = 0` there, not at the road.

The ground plane is derived from the plate, not assumed:

```
z_ground        = −(chassis_thickness + reference_ride_height)
z_contact_patch = z_ground
```

`reference_ride_height` keeps its meaning — ground clearance under the **bottom** of the plate — and
is no longer the datum. In the chassis frame the reference car has `z_ground = −7.0 mm` (2.0 mm plate
+ 5.0 mm ride height). The physics package continues to work in the ground frame; the one adapter in
`packages/data` adds `(thickness + ride_height)` to every stored `z` when it builds solver input, so
every equation below is unchanged and every ground-frame golden value is unchanged.

**This is the single frame for the physics package and it is not negotiable per document.** Round 1
found the requirements document using y-right with a mid-wheelbase origin, which put a developer
128 mm and 257 mm away from a developer following this file, silently and plausibly. The ruling:

> **R-1.** ISO 8855 — x forward, y left, z up, origin on the **top surface of the chassis plate** at
> the rear axle centre. The ground plane is derived below it by the plate thickness plus ride height.
> Per-wheel quantities (camber, toe) are **per-wheel signed and are not negated by mirroring**:
> positive camber = top outboard, positive toe = toe-in, and a symmetric car stores the same camber
> and the same toe on both sides. The conversion to a global-frame angle is done once, inside the
> solver, by the side factor `s = ±1` (§3.1). Car-level quantities (roll-centre height, load transfer)
> are frame-free and are never signed per side.

`docs/specs/spec.md` §4.2, §2.4 and §7.1 say per-wheel quantities "are negated on mirroring". That
sentence is superseded by ruling **D-17** (2026-10-31) and the correction is one sentence in `spec.md`,
not a sign table here: negating a stored toe on the mirrored corner puts 1.0° of total toe on a
straight car, which is the same class of silent sign error round 1 was convened to find. A model file
written by the app must satisfy this section.

Because z is measured from the **top of the plate**, a ride-height or plate-thickness change moves
the derived ground plane, not the stored hardpoints. The model stores hardpoints in the chassis
frame, and a ride-height change is a rigid translation of the chassis-side points followed by a
re-solve (§6.2). The derived ground plane is reported wherever a height above the road is shown, and
the drawing labels it as derived.

### 2.1 Chassis values and the wheel-diameter consistency check

The Chassis panel exposes the two numbers the ground plane depends on, per vehicle rather than per
axle:

| Value | Field | Default | Meaning |
|---|---|---|---|
| Ride height | `body.reference_ride_height` | 5.0 mm | clearance under the **bottom** of the plate |
| Plate thickness | `body.chassis.thickness` | 2.0 mm | the plate itself |
| Wheel diameter | **derived, never stored** | 64 mm on the reference car | `2 × (wc.z − z_ground)` |

`thickness + ride_height` is the only route into the ground plane. Neither value moves a stored
hardpoint, changes camber gain, changes wheel rate, or changes ride frequency; both move the reported
roll-centre height above ground by the same amount, per axle. The contact patch stays on the derived
ground plane and the drawing's ground line moves with it.

The wheel diameter is a **check, not an override**. The solver's stored wheel centre and the derived
ground plane imply a radius:

```text
implied_tyre_radius = wc.z − z_ground
```

Compare it with the radius recorded at `axles.<axle>.tyre_radius`. At or below 0.5 mm they agree. Above
0.5 mm the app states both numbers and both possible causes — the ride height is the mismatch higher
or lower than measured, or the wheel centre is that far low or high — and never corrects either value.
No hardpoint is rewritten and the ground plane is not moved to make the wheel fit. The drawing and the
reported heights keep using the plate-derived ground.

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
right, because "toward the centreline" is itself mirrored — and because the stored number is a
property of the wheel, not of the car's axes (D-17). Round 1's mirror rule negated toe as well as
camber, which turned a symmetric car into one with 1.0° of total toe error in the one code path every
right-hand corner takes. Camber is genuinely antisymmetric *in the global frame* (outboard flips
sides), but the **stored** camber is the per-wheel signed value and is copied unchanged by
`mirror_of`; KPI and scrub radius likewise keep their per-wheel value and their sign.

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
| `arb.bar_diameter` d | mm | 0 – 2.5 | `REFUSE` where `arb.type` is `torsion_bar`; a car with no bar says `arb.type: none` (the retired `bar_diameter: 0` case) | k_bar → k_φ → balance |
| `arb.span` L_bar | mm | 50 – 120 | `REFUSE` roll stiffness | k_bar |
| `arb.arm_length` a_arm | mm | 12 – 30 | `REFUSE` roll stiffness | k_bar |
| `arb.drop_radius` r_d | mm | derived from `arb_drop` | derived | IR_arm |
| `arb.material` / `arb.shear_modulus` G | — / GPa | steel 79.3, Ti 41 | `ASSUME(79.3, flag assumedMaterial)` | k_θ |
| `arb.rate_at_link` (bench-measured alternative) | N/mm | 0 – 5 | optional; overrides the geometry path | k_bar directly |
| `spring.rate` k_s | N/mm | 1.5 – 6.0 | `REFUSE` wheel rate and everything above it | k_w, f, k_φ |

Corner level (`corners.<c>.damper.*`), required by module 7 — **v1**, as an **estimate** (owner
decision 2026-10-30: damping ratio ships, with a band and an `estimated` badge; the direction of
change must be trustworthy even where the magnitude is banded):

| Field | Unit | Range | tolerance | on_absence | Consumed by |
|---|---|---|---|---|---|
| `damper.piston_bore` | mm | 8 – 12 | ±0.05 mm (±0.5 %) | `REFUSE` ζ | A_p |
| `damper.shaft_dia` | mm | 2 – 4 | ±0.05 mm (±2 %) | `REFUSE` ζ | A_p |
| `damper.piston_holes` n | count | 2 – 8 | 0 (countable) | `REFUSE` ζ | A_h |
| `damper.piston_hole_dia` d_h | mm | 0.4 – 1.2 | **±0.02 mm (±3.3 % on 0.60)** | `REFUSE` ζ | A_h |
| `damper.oil_cst` | cSt | 200 – 900 | ±60 %, or ±5 % from the bottle label | `ASSUME(500, flag assumedOil)` | ν, and the label only |
| `damper.oil_temp` | °C | 5 – 60 | ±2 °C | `ASSUME(20, flag assumedTemp)` | ν(T) |
| `damper.f_blowoff` F_bo | N | 2 – 10 | **±50 %** (dyno-only) | **`ASSUME(4.0, flag estimatedDamper)`** | force cap |
| `damper.c_post` | N·s/m | 5 – 40 | **±50 %** (dyno-only) | **`ASSUME(12, flag estimatedDamper)`** | force cap |

**The tolerance column is part of the contract, not a display nicety.** Every one of these fields
feeds the computed ζ band (07 §6.6): the band is ζ re-run with each value moved to the ends of its own
tolerance, so a field without one contributes no uncertainty and the band silently understates. An
estimated field stores it as `tolerance_pct` (00 §5); a measured field stores the gauge tolerance in
its own unit. **No field in `fields.yaml` can carry either yet** — the value object is
`{value, source}` — which is item 1 of the contract-deltas table in `00` §11. The field *names* here
map to disk paths in §5.1; where the two disagree, §5.1 and `fields.yaml` win.

The split matters: the four geometry fields are things a racer can measure or read off a drawing, so
their absence is a refusal; the two dyno-only fields are assumed with a flag *and a tolerance*, and
the output that consumes them carries the `estimated` badge and 07 §6.6's computed band. Round 1
refused all six, which made ζ uncomputable from every file that existed, and separately advertised ζ
as a v1 output.

> **Policy delta against `spec.md` §4.3.1.** The requirements make `damper_blowoff_force`
> `on_absence: REFUSE`; this table makes it `ASSUME(4.0)` with a ±50 % tolerance. Both cannot be
> normative, and the reason the physics side assumes is C1: a REFUSE means ζ is refused for every
> file a racer can actually produce from a caliper and a bottle label, which deletes the one output
> D-13 says ships. `spec.md` §4.8 already describes the blow-off force as "an `estimated` value with a
> `basis` and a `tolerance_pct`", so the §4.3.1 row is the sentence to change. Recorded as a policy
> delta, not silently reconciled (00 §11).

Vehicle level, required by modules 6 and 10:

| Field | Unit | Range | on_absence | Consumed by |
|---|---|---|---|---|
| `mass.total` m | g | 1000 – 1600 | `REFUSE` | everything in 6 |
| `mass.unsprung` m_u | g **per axle** | 80 – 160 per axle (160 – 320 per car) | `ESTIMATE(unsprung_corner_weighing)`, default 120 g/axle — rows `unsprung_front` / `unsprung_rear` on disk (§5.1); the retired `ASSUME(0)` was outside the range and cost the front ride frequency 15 % | ΔW_u |
| `cg.height` h | mm | 15 – 45 | **never `measured`** — see below; `ESTIMATE(two_hang_plumb_line)`, default 28.0. `ASSUME` on this field is a schema error | ΔW, φ |
| `cg.provenance` | enum | `two_hang_plumb_line` \| `component_mass_moment` | **derived, not stored** — the `method` of the source on `cg.height` | the badge on every load number |
| `cg.components[]` | `{mass, x, y, z}` | g, mm | `OMIT` → the component route is unavailable | the component route (§4.5) |
| `cg.unsprung_height` h_u | mm | 0.55 – 0.75 × tyre radius | `ASSUME(0.625 R, flag)` | ΔW_u |
| `chassis.material`, `chassis.thickness` | —, mm | see module 10 | `OMIT` → rigid chassis | k_ch |
| `chassis.span` w / `chassis.rail_factor` κ_rail | mm / — | 70 – 110 / 1.0 – 3.0 | `OMIT` / `ASSUME(1.0)` | J, k_ch |
| `chassis.torsion_measured` | N·m/deg | 0.05 – 5 | `OMIT` → estimator | balance split |
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

## 5. The model file — the same file as `spec.md` §4.2

**This section used to print a different document.** It declared `schema_version` `1.1.0`,
stored bare numbers, nested points under `vehicle`/`corners.LF.points`, and carried a
`mirror_of` key — while `spec.md` §4.2 printed `1.0.0`, `{v, s}` objects and
`body.axles.front.corners.left.lower_arm.inboard_front`. Two files, both labelled
normative, neither able to load the other. The ruling (`docs/decisions.md` D-16): one
schema, defined in `docs/specs/fields.yaml`, and every document that prints a model
prints **that** file.

So the block below is the reference car of §8 as it exists on disk. It is the same file —
value for value — as the example in `spec.md` §4.2, and if the two ever disagree the
`fields.yaml` definition and the spec's table win and this block is the bug. Every key
below appears in `fields.yaml`; the mapping from the input names this module's §4.4 uses
to the paths below is at the end of this section.

```json
{
  "schema_version": "1.1.0",
  "kind": "car_model",
  "id": "mdl_ref_1tc",
  "name": "Reference 1/10 TC — measured 2026-10-30",
  "class": "touring_car_1_10",
  "units": {
    "length": "mm", "mass": "g", "angle": "deg", "spring_rate": "N/mm",
    "viscosity": "cSt", "temperature": "°C", "percentage": "%",
    "count": "1", "shear_modulus": "GPa"
  },
  "frame": { "standard": "ISO 8855", "axes": "x forward, y left, z up",
             "origin": "top surface of the chassis plate, rear axle centre, vehicle centreline" },
  "symmetry": true,
  "license": { "id": "CC-BY-4.0", "url": "https://creativecommons.org/licenses/by/4.0/" },
  "contributors": [ { "name": "D. W.", "role": "measured" } ],
  "attribution_text": "Reference 1/10 TC — measured by D. W., 2026-10-30. CC BY 4.0.",
  "meta": { "created": "2026-10-30", "app_version": "0.1.0", "revises": null },

  "sources": {
    "s1": { "type": "measured", "method": "digital caliper 150 mm",
            "datum": "flat plate, hinge-pin centre", "by": "D. W.", "date": "2026-10-30",
            "note": "car on setup stands, wheels off" },
    "s2": { "type": "inferred", "method": "two_hang_plumb_line",
            "basis": "chassis hung from one point at each end, plumb line photographed square-on",
            "tolerance_pct": 15.0, "by": "D. W.", "date": "2026-10-30" },
    "s3": { "type": "estimated", "method": "unsprung_corner_weighing",
            "basis": "wheel, tyre, hub, carrier and outboard link ends on a kitchen scale",
            "tolerance_pct": 20.0, "by": "D. W.", "date": "2026-10-30" },
    "s4": { "type": "derived",
            "from": ["body.mass.total", "body.mass.sprung_front", "body.mass.sprung_rear"],
            "note": "corner weights minus unsprung" },
    "s5": { "type": "measured", "method": "corner scales", "datum": "four pads, ride height 5.0 mm",
            "by": "D. W.", "date": "2026-10-30" },
    "s6": { "type": "manufacturer", "ref": "kit manual p.14, exploded view and spring table" }
  },

  "body": {
    "reference_ride_height": { "value": 5.0,   "source": "s1" },
    "wheelbase":             { "value": 257.0, "source": "s1" },
    "cg": {
      "height":           { "value": 21.0, "source": "s2" },
      "front_mass_share": { "value": 45.0, "source": "s4" },
      "unsprung_height":  { "value": 13.0, "source": "s3" }
    },
    "mass": {
      "total":          { "value": 1350.00, "source": "s5" },
      "sprung_front":   { "value": 487.49,  "source": "s4" },
      "sprung_rear":    { "value": 622.49,  "source": "s4" },
      "unsprung_front": { "value": 120.00,  "source": "s3" },
      "unsprung_rear":  { "value": 120.00,  "source": "s3" }
    },
    "chassis": { "material": "cfrp", "thickness": { "value": 2.0, "source": "s6" } }
  },

  "axles": {
    "front": {
      "track":                { "value": 172.0, "source": "s1" },
      "tyre_radius":          { "value": 32.0,  "source": "s1" },
      "roll_centre_validity": { "value": 40.0,  "source": "s6" },
      "droop_limit_wheel":    { "value": 5.0,   "source": "s6" },
      "bump_limit_wheel":     { "value": 5.0,   "source": "s6" },
      "spring": { "location": "coilover_at_damper", "rate": { "value": 3.50, "source": "s6" } },
      "arb": { "type": "torsion_bar",
               "bar_diameter":  { "value": 1.50, "source": "s6" },
               "span":          { "value": 90.0, "source": "s6" },
               "arm_length":    { "value": 20.0, "source": "s6" },
               "shear_modulus": { "value": 79.3, "source": "s6" } },
      "steering": { "rack": {
        "x":               { "value": 225.0, "source": "s1" },
        "z":               { "value": 23.0,  "source": "s1" },
        "y_left":          { "value": 26.0,  "source": "s1" },
        "y_right":         { "value": -26.0, "source": "s1" },
        "travel_per_turn": { "value": 12.0,  "source": "s6" } } }
    },
    "rear": {
      "track":       { "value": 174.0, "source": "s5" },
      "tyre_radius": { "value": 32.0,  "source": "s1" },
      "spring": { "location": "coilover_at_damper", "rate": { "value": 2.60, "source": "s6" } },
      "arb": { "type": "torsion_bar",
               "bar_diameter":  { "value": 1.20, "source": "s6" },
               "span":          { "value": 90.0, "source": "s6" },
               "arm_length":    { "value": 20.0, "source": "s6" },
               "shear_modulus": { "value": 79.3, "source": "s6" } }
    }
  },

  "corners": {
    "LF": {
      "arm_type": { "lower": "hinge", "upper": "single_link" },
      "points": {
        "lca_in_a":  { "value": [238.00, 30.00,  5.00],  "source": "s1" },
        "lca_in_b":  { "value": [272.00, 30.00,  5.00],  "source": "s1" },
        "lca_out":   { "value": [259.00, 78.00,  0.00],  "source": "s1" },
        "uca_in":    { "value": [250.00, 42.00, 38.00],  "source": "s1" },
        "uca_out":   { "value": [254.00, 72.80, 37.00],  "source": "s1" },
        "tie_in":    { "value": [225.00, 26.00, 23.00],  "source": "s1" },
        "tie_out":   { "value": [243.68, 74.04, 25.00],  "source": "s1" },
        "wc":        { "value": [257.00, 86.00, 25.00],  "source": "s1" },
        "damper_lo": { "value": [257.00, 60.00,  1.875], "source": "s1" },
        "damper_up": { "value": [257.00, 44.00, 51.00],  "source": "s1" },
        "arb_drop":  { "value": [250.00, 55.00,  2.40],  "source": "s1" }
      },
      "damper": {
        "piston_bore":     { "value": 9.6,   "source": "s6" },
        "shaft_dia":       { "value": 2.5,   "source": "s6" },
        "piston_holes":    { "value": 3,     "source": "s6" },
        "piston_hole_dia": { "value": 0.60,  "source": "s6" },
        "oil_cst":         { "value": 500.0, "source": "s6" }
      }
    }
  }
}
```

Notes that matter to the implementer:

- **Values are `{ "value": …, "source": … }` objects, never bare numbers** (D-16). The
  `source` is an id into the document's top-level `sources` map and must resolve; a value
  without a source is a schema error, not a review note. The per-point prose map this
  section used to carry (`"sources": {"lca_out": "caliper, 2026-10-30"}`) is retired —
  provenance that lives in two places is provenance that disagrees with itself.
- **Arrays are `[x, y, z]` in millimetres.** The one 1000× error that used to be possible
  here was a metre-valued coordinate; the parser rejects any coordinate with
  `|c| > 3000 mm` (a 3 m hardpoint does not exist on a 1/10 car) and the error message
  says "coordinates are millimetres". Round 1's guard was `|c| > 3` on a metre-valued
  field; the ruling re-expresses it, it does not weaken it.
- **Angles are degrees on disk** — including `camber`, `toe` and `oil_temp`, which round 1's
  file labelled `"units": "SI"` while storing degrees. SI inside the package is radians,
  and the adapter is the only place that conversion happens.
- **`units` declares every dimension the file uses and nothing else.** This file uses nine;
  its `units` block declares nine. The former §5 declared four (`length, mass, angle,
  spring_rate`) while the body also carried newtons, N·s/m and cSt — a document that
  refused itself under `spec.md` §4.1 rule 1.
- **`schema_version` is `1.1.0`**, the version the app writes (`spec.md` §4.7). `1.0.x`
  documents are migrated on load: every stored `z` becomes
  `z' = z − (chassis_thickness + reference_ride_height)`, the frame origin is rewritten,
  and a `derived` migration record is added to `sources`. Exporting and reloading the
  migrated document does not shift it a second time.
- **`symmetry: true` and no `RF` corner.** The right-hand corner is generated at load by
  **negating y only** — with `derived_by_mirror` provenance, not `measured`, and not
  re-solved as if it were the left corner (its crank angle, branch sign and monotonicity
  direction all differ, §6.5). Camber is antisymmetric and toe is symmetric, but both are
  stored per-wheel and both are **copied unchanged** through the mirror; the side factor
  `s = ±1` (§3.1) is what carries the sign into the car frame, applied once inside the
  solver. This is D-17, and §6.1 plus G01.1, G01.8, G01.9 and G01.12 are what prove it. The
  per-corner `"mirror_of": "LF"` key this section used to carry is retired as a *schema*
  key: the document says `symmetry: true`, one mechanism is enough, and where §6 says
  `mirror_of` it means this derivation — whose source record is `derived_by_mirror`, with
  `from` naming the left corner's field path.
- **What is derived is not stored.** Contact patches (`(0, ±track/2, 0)` and
  `(wheelbase, ±track/2, 0)`), `x_cg` (`wheelbase · (1 − front_mass_share)`, = 141.35 mm
  here), per-corner unsprung mass (half the axle value), the bar's `drop_radius` and every
  link length. §6 derives them once and later modules never recompute them differently.
- **Absence is a missing key**, never `0`, `null` or a sentinel (`spec.md` §4.1 rule 3).
  The rear corners are absent here for the honest reason in §8.4 — they have never been
  measured — and every rear-corner output is `REFUSED` naming `corners.LR.points.*`
  rather than computed from a guess.
- **Three `ESTIMATE` policies carry this file's least certain numbers**, and all three
  produce a band rather than a point: `body.cg.height` (28.0 mm, procedure
  `two_hang_plumb_line`, alt `component_mass_moment`), `body.mass.unsprung_front` and
  `body.mass.unsprung_rear` (120 g per axle, procedure `unsprung_corner_weighing`, ±20 %).
  None of them is `ASSUME`: `ASSUME` on a quantity the bench cannot measure is a schema
  error, and `ASSUME(0)` for unsprung mass — this section's former value — put the car
  outside its own plausible range and cost the front ride frequency 15 %.

### 5.1 The §4.4 contract, mapped to paths

§4.4 names the inputs modules 5–10 consume by their short names. This is where each one
lives in the file above. A field that is in §4.4 and not here is a defect; a field here and
not in `fields.yaml` is a worse one.

| §4.4 name | Path in the file | Unit | `on_absence` |
|---|---|---|---|
| `arb.bar_diameter` | `axles.<axle>.arb.bar_diameter` | mm | `REFUSE` (only where `arb.type` is `torsion_bar`) |
| `arb.span` | `axles.<axle>.arb.span` | mm | `REFUSE` (same condition) |
| `arb.arm_length` | `axles.<axle>.arb.arm_length` | mm | `REFUSE` (same condition) |
| `arb.shear_modulus` | `axles.<axle>.arb.shear_modulus` | GPa | `ASSUME(79.3)` |
| `arb.rate_at_link` | `axles.<axle>.arb.rate_at_link` | N/mm | `REFUSE` (only where `arb.type` is `blade` or `fixed`) |
| `arb.drop_radius` | derived from `corners.<corner>.points.arb_drop` | mm | derived, never stored |
| `spring.rate` | `axles.<axle>.spring.rate` (model) / `corners.<corner>.spring_rate` (setup) | N/mm | `REFUSE` / `OMIT` |
| `damper.piston_bore` | `corners.<corner>.damper.piston_bore` | mm | `REFUSE` |
| `damper.shaft_dia` | `corners.<corner>.damper.shaft_dia` | mm | `REFUSE` |
| `damper.piston_holes` | `corners.<corner>.damper.piston_holes` | count | `REFUSE` |
| `damper.piston_hole_dia` | `corners.<corner>.damper.piston_hole_dia` | mm | `REFUSE` |
| `damper.oil_cst` | `corners.<corner>.damper.oil_cst` | cSt | `ASSUME(500)` in the model, `REFUSE` in a setup |
| `damper.oil_temp` | `corners.<corner>.damper.oil_temp` | °C | `ASSUME(20)` |
| `damper.f_blowoff` | `corners.<corner>.damper.f_blowoff` | N | `ASSUME(4.0)` with flag `estimatedDamper` |
| `damper.c_post` | `corners.<corner>.damper.c_post` | N·s/m | `ASSUME(12.0)` with flag `estimatedDamper` |
| `mass.total` | `body.mass.total` | g | `REFUSE` |
| `mass.unsprung` (**per axle**) | `body.mass.unsprung_front`, `body.mass.unsprung_rear` | g per axle | `ESTIMATE(unsprung_corner_weighing)`, default 120 |
| `cg.height` | `body.cg.height` | mm | `ESTIMATE(two_hang_plumb_line)`, default 28.0 |
| `cg.provenance` | derived from the `method` of the source on `body.cg.height` | enum | not stored |
| `cg.components[]` | `body.cg.components[]` | g, mm | `OMIT` |
| `cg.unsprung_height` | `body.cg.unsprung_height` | mm | `ASSUME(0.625 × tyre_radius)` |
| `chassis.material` | `body.chassis.material` | enum | `OMIT` |
| `chassis.thickness` | `body.chassis.thickness` | mm | `OMIT` |
| `chassis.span` | `body.chassis.span` | mm | `OMIT` |
| `chassis.rail_factor` | `body.chassis.rail_factor` | – | `ASSUME(1.0)` |
| `chassis.torsion_measured` | `body.chassis.torsion_measured` | N·m/deg | `OMIT` |
| `chassis.ride_height_basis` | `body.chassis.ride_height_basis` | enum | `ASSUME(underside_clearance)` |

Two of these changed meaning, not just name. `mass.unsprung` was **per car** (240 g) in
this module's §4.4 and is **per axle** (120 g) in the file, because the sprung mass a
corner carries is `corner weight − unsprung at that corner` and the front and rear
unsprung masses are not the same number on any car that has been weighed. `cg.height` was
`ASSUME(component estimate, flag cgInferred)` here and is `ESTIMATE(two_hang_plumb_line)`
in the file: the number carries a band, and `ASSUME` on it is a schema error.

**Where this table and §4.4 disagree, this table and `fields.yaml` are right** — §4.4 is the
module's shopping list and was written before the schema existed; the two rows above are the
places it differs, and `arb.bar_diameter: 0` ("no bar") is a third, since `arb.type: none`
is now the only way to say it. Anything else in §4.4 that contradicts a path here is a
defect to be fixed in §4.4, not a second convention.

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

Mirroring negates **y** and nothing else. Two different quantities are easy to conflate here, so the
table separates them: the **stored** value of a per-wheel quantity (what `mirror_of` copies) and the
**global-frame** angle the solver derives from it (what the display may show in a car-level frame).

| Quantity | Stored value on the mirrored corner | Global-frame angle | Why |
|---|---|---|---|
| point (x, y, z) | (x, −y, z) | — | definition |
| camber γ | **unchanged** (−2.0° stays −2.0°) | **−γ** (+2.0°) | stored: per-wheel signed (D-17). Global: outboard flips sides, so the *frame* angle negates |
| toe τ | **unchanged** (0.5° stays 0.5°) | **unchanged** (+0.5°) | "toward the centreline" is mirrored too, so neither the stored value nor the frame angle changes |
| KPI, scrub radius, trail, caster | **unchanged in value and sign** | unchanged | per-wheel quantities, evaluated with `s` |
| crank angle θ₀ | different branch, different sign | — | the mirrored corner has θ₀ = −174.05° against the left's −5.95° |
| dW.z/dθ | **opposite sign** | — | the mirrored four-bar's wheel rises for decreasing θ |
| `sources` | unchanged (the mirror inherits the left's sources) | — | the same measurement, both sides |

**The rule in one sentence (D-17).** A stored camber or toe is a statement about *the wheel*, not about
the car's axes, so the mirror path (`symmetry: true` in the file; `mirror_of` in this section's prose,
§5) copies it unchanged and the side factor `s = ±1` does the global-frame conversion inside the
solver — once, and never in the document. Consequences: a symmetric car has identical stored camber
and toe left and right, its axle total toe is `2τ` (zero on a straight car), and no code path negates a
stored setup value on the mirror. G01.8, G01.12 and I13 pin it.

### 6.2 Ride height — the algorithm round 1 did not specify

`setRideHeight(dz)` is not "translate and hope". After translating the chassis-side points by +dz,
the linkage still has one degree of freedom and nothing about the wheel is determined. The physical
constraint is that **the wheel is still on the road**:

```
1. translate chassis-side points (lca_in_*, uca_in*, tie_in, damper_up) by +dz
   — dz > 0 raises the chassis relative to the wheels, i.e. DROOP of the wheel
2. solve θ such that W(θ).z = tyre_radius  (the wheel stays at ride height on the road)
3. re-derive θ₀, (u,v), branch sign and the static Uₒ from that state
4. re-derive everything in §6.6
```

**Why the label matters, and what it costs to get wrong.** Module 2's convention (02 §2, §3.5) is
`bump = wheel moves up relative to the chassis`. Holding the wheel on the road and raising the chassis
therefore *droops* the wheel; `dz > 0` is droop, not bump. Round 2's step 1 said "i.e. bump", and an
implementer reading it literally inverts every ride-height number: on the reference car +0.5 mm of
chassis translation gives **z_rc = 10.7049 mm** (droop) under this reading and **9.2617 mm** (bump)
under the label's — a 1.44 mm difference against a ±1 mm band. `10` §3.4/§4.3 and G10.7 use 10.7049
and call it droop; this file's label was the only thing wrong.

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
| CG x (from rear axle) | 115.65 | mm | derived: `x_cg = w_f·l = 0.45 × 257.0` |
| Ride height (chassis underside) | 5.0 | mm | measured |

**Sprung mass, which round 1 got wrong in two of three modules.** From the corner weights in module
6 §6.1: `m_s,f = 0.48749 kg` per axle → **0.24375 kg per front corner**; `m_s,r = 0.62249 kg` per axle
→ **0.31125 kg per rear corner**; total sprung 1.110 kg. Module 5's round-1 figures (0.310 front /
0.400 rear) summed to 1.42 kg against a car that has 1.110 kg — and 0.310 is numerically the *rear*
corner's correct value, which is how the slip survived. The identity that catches it is in module 5
§7 (G05.9): `Σ m_s,corner + m_u = m_total` to 1e-9.

**`x_cg` and the weight split, which round 2 got wrong (D-1).** `x_cg` is `w_f · l`: with 45 % of the
weight on the front axle the CG sits 0.45 × 257.0 = **115.65 mm** ahead of the rear axle. Round 2
printed `x_cg = 257 × (1 − 0.45) = 141.35 mm` — the 55 %-front position, 25.7 mm ahead of the 45 %-front
value and 12.9 mm ahead of mid-wheelbase — and inconsistent with the front axle being the lighter one
in module 6 §6.1. The two branches, both computed:

| | `w_f = 0.45`, `x_cg = 115.65` (**taken**) | `w_f = 0.55`, `x_cg = 141.35` (rejected) |
|---|---|---|
| sprung mass per corner F/R | 0.24375 / 0.31125 kg | 0.31125 / 0.24375 kg |
| ride frequency F/R | 10.781 / 10.286 Hz | 9.541 / 11.623 Hz |
| `h_ra` | 7.789 mm | 8.186 mm |
| rigid balance | 56.15 % | 58.90 % |
| consistency residual | −0.055 % | +0.229 % |
| what moves | module 6 §6.3–6.8, module 10 §4.2, G06.3–G06.12 | module 5 §6, all of module 7's ζ and its whole direction table, `00` §5, G05.3, G05.6 |

The second column is the expensive fix: it rewrites the masses that modules 5 and 7 consume, every
frequency, every ζ and the entire damping direction table, to preserve one line of arithmetic. The
45 % front split is also the value the corner weights, the sprung masses, the ride frequencies and the
56 % balance were all built on, so it is the column that keeps the document coherent. `06` §1 records
the choice; G06.12 asserts it.

### 8.2 Left front corner (x, y, z in mm, ground frame)

These are the solver's ground-frame values, not the document's stored chassis-frame values. The
document stores each `z` 7.0 mm lower (§5), and the adapter adds that offset back when it builds
solver input; this is why every golden value in modules 2–10 is unchanged by the datum move.

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
ê₁ = (Uₒ − Lₒ)/d = (−5.20, 37.00)/37.3636 = (−0.139173, 0.990268)
ê₂ = (−ê₁_z, ê₁_y) = (−0.990268, −0.139173)
(wc):      (u, v) = (23.6433, −11.4015)
(tie_out): (u, v) = (25.3078,  0.4421)
```

These four numbers are what makes module 2's carrier transform computable; round 1 stored none of
them and left the formula to two documents that each pointed at the other.

### 8.4 Rear corner — modelled, not measured, and still a debt

The reference car carries a **modelled** rear corner (source `s_modelled`), not measured rear
hardpoints. Modules 5 and 6 now compute the rear installation ratio, bar ratio, roll-centre height
and track from that geometry, but the geometry itself is a debt: it is a plausible touring-car
placement, not a measurement.

| Rear input | Value used | Range | Where |
|---|---|---|---|
| `IR_r` (derived from `damper_lo`/`damper_up`) | 0.689205 | 0.55 – 0.80 (Bob: 0.64 Xray, 0.75 Mugen) | 05 §6.5 |
| rear bar rate k_bar,r (d = 1.20 mm, `IR_arm` = 0.54572) | 0.13356 N/mm at the wheel | — | 05 §6.3 |
| rear roll-centre height z_rc,r | 17.899 mm | — | 02/06, from the modelled geometry |
| rear track | 174.0 mm | measured | 01 §8.1 |

The modelled damper mount was placed to give MR ≈ 0.70, consistent with the stated 2.60 N/mm spring
and Bob Wright's published range; the earlier placement gave 0.51 and a 7.4 Hz rear. The front stays
at its spec-derived 0.5653 and is not tuned toward that band.

Publishing a rear corner in the same schema was the first fix; the remaining one is a measurement
session. Until then the balance number is a computed function of modelled geometry, and
`99-validation.md` §7 says so in the precision policy.

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
| G01.1 | mirror the LF corner, stored camber −2.0°, stored toe +0.5° | RF `lca_out` = (259.0, −78.0, 7.0); **stored** camber −2.0° and toe +0.5° (both unchanged, D-17); global-frame camber +2.0° | hand calc §6.1 |
| G01.2 | parse a coordinate given as `78.0` mm | 78.000 mm, round-trip to 0.078 m at the adapter and back exactly | hand calc (mm ↔ m is ÷1000) |
| G01.3 | reference car `wc` points | wheelbase 257.000 mm, front track 172.000 mm, rear track 174.000 mm | hand calc §8.3 |
| G01.4 | reference car LF | a = 48.2597 mm, b = 30.8162 mm, d = 37.3636 mm | hand calc §8.3 |
| G01.5 | model missing `uca_out` | `incompleteModel`, reason lists `LF.uca_out` | §7 |
| G01.6 | `lca_in_a` = `lca_in_b` = (238.0, 30.0, 12.0) | `coincidentPoints`, names both keys | §7 |
| G01.7 | coordinate `78000` (µm typed where mm expected) | parse error naming the field (`\|c\| > 3000`); no model produced | §5 |
| G01.8 | mirror a corner whose stored toe is +0.5° | RF stored toe = **+0.5°**, axle total toe = **+1.000°** (not 0 — a negation-on-mirror implementation reports 0 here and fails) | hand calc §6.1, D-17 |
| G01.9 | mirror the LF corner, evaluate camber, KPI, scrub with `s` | γ_kp = −8.0000° on **both** corners; KPI = +8.0000° on both; scrub = +7.0162 mm on both; the same quantities evaluated **without** `s` on the RF give +8.0000°, −8.0000°, −7.0162 mm | hand calc §3.1, 02 §6.7 |
| G01.10 | reference LF carrier frame | `(u,v)` for wc = (23.6433, −11.4015); for tie_out = (25.3078, 0.4421) | hand calc §8.3 |
| G01.11 | component-mass CG route, §4.5 table | h_est = 18.69 mm from the listed components; `provenance = component_estimate`; every load output carries `flag cgInferred` | hand calc §4.5 |
| **G01.12** | **symmetric car, D-17**: LF stored camber −2.0°, stored toe 0.0°; `mirror_of: LF` for RF | stored camber **−2.0° on both**, stored toe **0.0° on both**, axle total toe **0.000°**; global-frame camber −2.0° (LF) / +2.0° (RF). A symmetric car is therefore *not* changed by the mirror path, and the negation-on-mirror implementation is caught by G01.8 rather than here | §6.1, D-17 |
| **G01.13** | **ride-height sign, D-2**: `setRideHeight(+0.5)` on the reference car (chassis-side points +0.5 mm, wheel held on the road) | **droop**: z_rc = **10.7049 mm** (9.9749 + 0.730), κ and the arm-attached transforms re-derived from that state. A `bump` reading returns 9.2617 mm and fails | hand calc 02 §6.6, 10 §4.3 |

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
