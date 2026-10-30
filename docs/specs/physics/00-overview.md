# 00 — Physics & calculator specification: overview

Status: draft for review. No Dart has been written against this document yet.
Audience: the Flutter developer implementing `app/packages/setup_physics`, a physics-competent
reviewer, and Dave (owner).

This spec is the contract for the pure-Dart physics package. It is deliberately arithmetic-heavy:
every number the app displays must be reproducible from this document by hand, and every claim
about a model's validity is paired with the case where it fails.

---

## 1. What the package computes

Given a **chassis model** (hardpoint coordinates, spring rates, bar sizes, damper data, masses,
tyre radius) and a **setup** (ride height, shims, spring and bar choices, oil, piston, droop), the
package computes properties. Nothing else. It does not simulate a lap, does not predict grip, and
does not pick a setup for you.

| Module | File | Produces | Confidence in the physics |
|---|---|---|---|
| 1 | `01-coordinates-and-hardpoints.md` | A validated, unit-safe chassis model | High — it is bookkeeping |
| 2 | `02-front-view-kinematics.md` | Instant centre, roll centre height/lateral position/migration, camber gain, scrub radius, KPI, caster, trail | High for statics; medium for migration |
| 3 | `03-side-view-antidive.md` | Anti-dive, anti-squat, side-view swing-arm angle | Low at 1/10 scale — diagnostic only |
| 4 | `04-steering.md` | Steering angles, Ackermann, bump steer, toe curve | Medium — plan-view projection method |
| 5 | `05-rates.md` | Motion/installation ratio, wheel rate, ARB rate, roll stiffness, ride frequency | High — closed-form mechanics |
| 6 | `06-load-transfer.md` | Corner weights, total lateral load transfer, front/rear balance, geometric vs elastic split, roll angle | High for the algebra; the *split* is an idealisation |
| 7 | `07-damping.md` | Critical damping, damping ratio vs shaft speed, orifice/blow-off damper model, temperature effect | Medium — needs a dyno to be called calibrated |
| 8 | `08-tyre-interface.md` | Nothing in v1. Defines what a grip model would need | n/a — deliberately absent |
| 9 | `09-motor-dyno.md` | Outline of the phase-3 motor/ESC model | Not built |

The build order is the file order. Module 5 depends on module 2's geometry output; module 6
depends on 2 and 5; module 7 depends on 5. Module 4 depends on 2. Nothing depends on 3, 8 or 9,
which is why they can slip without blocking a release.

---

## 2. Unit policy

There are exactly two unit systems in the product and one conversion point.

| Layer | Units | Why |
|---|---|---|
| Chassis/vehicle JSON on disk | **SI**: m, kg, N/m, N·s/m, rad | One canonical form; a file shared between users cannot be misread |
| Geometry inside the physics package | **SI** (m) | `AGENTS.md`: SI inside `setup_physics` |
| Equations *in this document* | **mm, g, N/mm, °** | These are the units a racer measures and reads on a setup sheet. Mixing them with SI in prose makes every worked example unreadable |
| UI | mm, g, N/mm, °, deg/mm | Display only, converted once at the widget boundary |

**The trap this creates, and how we close it.** This document works in mm and the package works in
metres, so every equation below carries an implicit 10⁻³. Section 3 of each module states the units
of every symbol so the implementer can convert mechanically. A worked example in mm and a golden test
in SI must produce the same *physical* number: the reference roll-centre height is 9.9749 mm in
`02`'s worked example and 0.0099749 m in the package, and `G02.1` is asserted in both so that a
10⁻³ scaling slip fails a test rather than a user's setup.

Angles are radians inside the package, degrees in this document and in the UI. The one place this
bites is trigonometric inverses of *slopes* (camber gain, caster, KPI): a slope in mm/mm is
dimensionless, so those are safe; but `atan2` over metre-valued coordinates returns radians and
must be converted once, not twice.

---

## 3. Notation

| Symbol | Meaning | Unit in this doc |
|---|---|---|
| x, y, z | vehicle axes; x forward, y left, z up (ISO 8855) | mm |
| ᵢ, ₒ | inner / outer end of a link | — |
| γ | camber, upright/wheel plane angle to vertical, **positive = top outboard** | ° |
| φ | chassis roll, **positive = left side up** | ° or rad |
| δ | steer angle of a wheel, positive = wheel points left | ° |
| τ | toe angle, **positive = toe-in** | ° |
| θ_vsa | side-view swing-arm angle from horizontal | ° |
| IR | installation (motion) ratio = spring/damper travel ÷ wheel travel | — |
| k_s, k_w | spring rate, wheel rate | N/mm |
| k_φ | roll stiffness of an axle | N·m/rad |
| ζ | damping ratio | — |
| h | centre-of-gravity height | mm |
| m, m_s, m_u | total, sprung, unsprung mass | kg |
| F_z | vertical load on a wheel | N |
| ΔW | lateral load transfer, per axle, total across the axle | N |

Suffixes: `f`, `r` for axles; `L`, `R` for sides; `_rc` roll centre; `_cg` centre of gravity;
`_kpi`, `_cas` for kingpin inclination and caster.

---

## 4. Failure is a value, not an exception

`AGENTS.md` and review rule 4: degenerate geometry must be handled, not crashed. The package
therefore returns a sealed result type for every geometric query:

```text
Result<T> = Ok(value, flags) | Undefined(reason, inputs)
```

`Undefined` reasons, used consistently by every module:

| Reason | Trigger | What the UI says |
|---|---|---|
| `parallelLinks` | the two arm lines have no finite intersection (‖cross‖ below tolerance) | "instant centre at infinity — parallel links" |
| `noIntersection` | a circle–circle solve has no real solution | "this geometry cannot reach that travel" |
| `coincidentPoints` | two hardpoints that must differ are within 1 µm | "two hardpoints coincide: <names>" |
| `outOfTravel` | requested bump is outside the solved travel range | "outside the modelled travel" |
| `incompleteModel` | a required hardpoint is missing | "model incomplete: <list>" |
| `outOfDomain` | non-physical input (negative rate, zero mass) | validation error, refused at entry |

Rules:

1. **No `NaN` and no `Infinity` may cross a public API boundary.** A property test over randomised
   geometry asserts this (review rule 4).
2. `parallelLinks` is not an error. Parallel arms are a legitimate touring-car design and the
   classic answer to "where is the roll centre?" is "at ground level". Module 2 returns
   `Ok(rollCentre = 0 mm, flags = [parallelLinks])` by taking the limit, and says so in the UI.
3. Tolerances are explicit constants, not magic numbers in the code:
   `kParallelTol = 1e-9` on the normalised cross product, `kCoincidentTol = 1e-9` m, `kCircleTol = 1e-9` m.

---

## 5. Every input carries its provenance

Review rule 1: no number without a source. Every input field in the model has, in addition to its
value, a `source` and a `confidence`:

| confidence | Meaning | UI treatment |
|---|---|---|
| `measured` | the user measured this with a caliper/setup station | normal |
| `manufacturer` | published by the chassis maker | normal |
| `estimated` | borrowed from a similar car, or scaled | shown with a tilde: `~78.0` |
| `assumed` | a modelling assumption, not a measurement (e.g. `C_d` of an orifice) | shown with a warning dot |

Physics constants that are *not* measurements of the car (fluid density, discharge coefficient,
steel shear modulus, gravity) appear in each module's input table with a default and a range, and
are labelled `assumed`. **No constant is invented silently.** Where we could not find a defensible
default, the field is required from the user and the model is marked incomplete without it.

---

## 6. What the predecessor computed, and what is ours

This matters for honesty in the UI and for the "our additions" column required in module 6.
RC Crew Chief (RC3) computed, on the evidence of the *Science of Setup* article index and the
video walkthroughs in `docs/research/`:

- roll centre height and camber gain, and how they interact;
- a "chassis roll sensitivity" figure (roll per unit lateral acceleration);
- total lateral load transfer and its front/rear split ("weight transfer balance");
- wheel rates, motion ratios, overall suspension stiffness, ride frequency;
- damping ratio as a **function of wheel velocity**, from a piston-hole model with oil viscosity,
  temperature, shock position and piston configuration as inputs, validated by its author against
  third-party shock-dyno data;
- Ackermann / dynamic toe.

Our additions, stated as such wherever they appear:

| Property | RC3 | Us | Note |
|---|---|---|---|
| Roll centre **lateral** position and migration with roll | not evidenced in the corpus | yes (module 2) | migration is the interesting half and it is cheap once the four-bar exists |
| Bump steer as a solved toe curve | not evidenced | yes (module 4) | solved from the tie-rod constraint, not a lookup |
| Geometric vs elastic split of load transfer | split only as front/rear | yes (module 6) | labelled idealisation |
| Unsprung mass contribution to transfer | unclear | yes (module 6) | small but not zero at this scale |
| Damper model with explicit blow-off | yes, richer than ours | ours is simpler | we are honest about the ceiling (§7 of module 7) |
| Tyre/grip model | none (deliberate) | none (deliberate) | see module 8 |

We are **not** claiming parity with RC3's damper model. Ours is a two-regime model that can be
fitted to a dyno pull; RC3's was fitted to one. That difference is a validation task, not a
marketing point.

---

## 7. v1 scope decisions (do not relitigate without Dave)

| Decision | Choice | Why |
|---|---|---|
| Front-view model | 2D transverse-plane four-bar, solved by circle intersection + bisection on the lower-arm angle | robust, closed form, testable; a full 3D solve is a v2 upgrade, not a v1 risk |
| Plan-view model | vertical steering axis, rigid knuckle | matches the hand construction every suspension book uses |
| Anti-dive/anti-squat | computed, flagged `diagnosticOnly`, never used in advice | see module 3; the classical formula is scale-hostile |
| Tyre model | none | see module 8 |
| Damper model | orifice + linear blow-off, per-direction | see module 7 |
| Motor dyno | outline only | phase 3 |
| Units in JSON | SI | one canonical form |

---

## 8. Golden tests

Every module ends with a table of golden cases. They are the acceptance criteria for the module
and the source of `app/test/golden/`. Conventions:

- IDs are `G<module>.<n>`, e.g. `G02.3`. The Dart test name contains the ID so
  `dart run tool/spec_audit.dart` can trace spec → test.
- **Tolerances are part of the case.** Geometry: 1 × 10⁻³ mm. Angles: 1 × 10⁻⁴ °. Ratios: 1 × 10⁻⁴
  relative. Damping forces: 1 × 10⁻³ N.
- **Every expected value has a stated origin**: either `hand calc §x.y` (the arithmetic is printed
  in this document and a reviewer can check it with a calculator) or a named published result.
  No expected value is "what the code produced".
- At least one case per module is a **degenerate** case, because that is where implementations
  quietly return `NaN`.

---

## 9. How a number reaches the screen

The UI never computes. For each displayed quantity the flow is:

```text
ChassisModel (SI, validated)  ──┐
Setup (SI, validated)         ──┼──▶ PhysicsInput (SI, resolved, with defaults applied)
Environment (temp, g)         ──┘            │
                                             ▼
                                   module function → Result<T>
                                             │
                       ┌─────────────────────┴────────────────────┐
                       ▼                                          ▼
             value + units                             Undefined(reason)
                       │                                          │
             display conversion (mm, °)              "undefined for this geometry: <reason>"
                       │                                          │
                       └──────────────▶ widget ◀──────────────────┘
```

Anything the user can change on the main setup screen should be recomputed in under 5 ms on a
mid-range phone so the numbers can update live while a slider moves. The four-bar solve is the
only iterative step; it is 40 bisection iterations of a circle intersection and costs microseconds.

---

## 10. Review checklist for this document

- [ ] Every symbol has a unit.
- [ ] Every constant has a default and a range, or is required from the user.
- [ ] Every module has: assumptions, where it breaks, degenerate behaviour, a worked example with
      visible arithmetic, and golden cases with stated origins.
- [ ] No step relies on a number that appears nowhere else.
- [ ] No RC3 text, no invented citations.
