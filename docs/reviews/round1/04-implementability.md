# 04 — Implementability review: physics contract → Dart

Reviewer: independent (no author contact). Round 1.
Scope: `docs/specs/physics/00`–`09`, `99`, `docs/specs/spec.md`, `docs/specs/architecture.md`.
Question asked: **could a competent Dart/Flutter developer implement `app/packages/setup_physics` from
these documents alone, without guessing?**

---

## 0. Method, and the one thing that should reassure the author

Reading cannot tell you whether a physics spec is implementable. So I re-implemented it.

I wrote an independent solver (~120 lines of Python) from the prose of modules 2, 3, 4, 5, 6 and 7
only — no access to any code, and no values copied from the golden tables except where noted — then
compared its output against every `G` case. Results are in §2. Short version:

- **The physics is sound and the arithmetic is mostly right.** Module 2's four-bar, module 5's
  rates, module 6's transfer algebra and module 7's damper all reproduce to the last digit
  (G02.1, G02.2, G02.3, G02.5, G02.6, G02.9, G02.10, G05.1–G05.5, G06.1–G06.5, G06.8, G07.1–G07.5,
  G07.9 all match). That is a genuinely good draft.
- **The defects are almost all at the boundaries** — frame, units, sign conventions, result type,
  who owns a derived quantity — and in four golden cases that cannot be reproduced as written.
- **One module's construction (03) is undefined for the reference car it is demonstrated on,** and
  its headline number turns out to be an artefact of an arbitrary input choice. That is the finding
  I would most want the author to see first after the frame question.

Verdict: the package is buildable, but **not from these documents alone in their current state**. A
developer starting today would make about nine decisions the documents do not make for them, at least
five of which produce plausible-looking wrong numbers rather than errors.

---

## 1. What "cannot be implemented" means here

Three distinct failure classes, and they need different fixes:

| Class | Failure | Count |
|---|---|---|
| **Undecidable** | Two documents give different answers; the developer must pick | 10 |
| **Underdetermined** | A method is named but not specified; the developer invents it | 8 |
| **Untestable** | The golden case cannot be reproduced as written | 5 |

An undecidable is worse than an underdetermined because the developer will follow whichever document
they read second, and the reviewer will follow the other one.

---

## 2. Golden-case audit (independently computed)

`✓` = my from-scratch implementation reproduces the asserted value inside the stated tolerance.
`✗` = it does not, or the case cannot be expressed as written.

| ID | Asserted | I compute | |
|---|---|---|---|
| G02.1 | IC (−435.691, 60.509); z_rc 9.9749 | (−435.691, 60.509); 9.9749 | ✓ |
| G02.2 | κ = −0.10982 °/mm | −0.109816 | ✓ |
| G02.3 | Uₒ (72.8018, 45.9419); γ −8.2515°; W (86.0544, 34.0) | exact | ✓ |
| G02.4 | y_rc +18.550 ± 0.002 | **+18.550** (solver) / **+18.530** (§6.6 printed arithmetic) | ✗ |
| G02.5 | −0.1648 / +0.8352 °/° | −0.16480 / +0.83520 | ✓ |
| G02.6 | KPI 8.0000, caster 7.6961, trail 2.9459, scrub 7.0162 | exact | ✓ |
| G02.7 | parallel → flag, z_rc = 0 | z_rc = 0 ✓, but y_rc has no defined value (§4.3 silent) | ✗ (partly) |
| G02.8 | bump +50 → `Undefined(outOfTravel)` | unreachable ✓, but a bracket-expanding solver returns `noIntersection` first | ✗ |
| G02.9 | buggy IC (−281.391, 131.565), z_rc 36.976, κ −0.14639 | exact | ✓ |
| G02.10 | heave +3 → z_rc 5.936 | 5.936 | ✓ |
| G03.1 | θ_r 23.963°, 407.9% | 23.963°, 407.9% | ✓ |
| G03.2 | SVIC (142, 72), 316.1% | 316.1% **only** with the undocumented x = 250 for the lower link | ✗ |
| G03.3 | 298.9% | 299.0% | ✓ |
| G03.4 | parallel → `parallelLinks` | ✓ (but slope form breaks on vertical arms) | ✓ |
| G03.5 | 100.0% with θ = 6.218° | 100.0% **only if K_bf = 1.0**, absent from the input column | ✗ |
| G04.1 | δ_left −7.603, δ_right −8.563 | −7.603 ✓; +7.603 **if you implement (4.4) as written** | ✗ |
| G04.2 | Ackermann 127.0 ± 0.2 | 127.06 with t = 172; **138.35** with steering-axis track | ✓ (t pinned silently) |
| G04.4 | τ(−2..+4) per table | exact — **once the carrier transform is invented**; 0.430 / 1.112 with the naive one | ✓ (by luck) |
| G04.5 | +0.162 ± 0.002 | +0.16248 both by chord and by FD at ±0.2 mm | ✓ (its printed ±0.0325 are not what the equations give — see NIT) |
| G04.6 | 0.000 ± 0.001 | 0.000 | ✓ |
| G04.7 | rack +40 → `noIntersection` | right side fails ✓, **left side returns +222.97°** | ✗ |
| G04.8 | rack +0.3 → Ackermann suppressed | \|δ_inner\| = 1.209° > 0.5° threshold, so not suppressed | ✗ |
| G05.1–5 | IR 0.565308, k_w 1.11851, f 9.560, k_bar 0.70067, k_φ 37.274 | exact | ✓ |
| G06.1–5, 8 | 2.9798/3.6420 N, 2.1435 N, 0.20476°, 56.14%, −1.23% | exact to 1e-3 | ✓ |
| G07.1–5, 9 | K_h 528.20, v_bo 0.09913, ζ 0.2266 at 50 mm/s, 0.8737 | 528.195, 0.09912, 0.2266, 0.8737 | ✓ |

**15 of 26 numeric cases reproduce exactly. 4 do not. 3 cannot be written as stated. 1 is right by
coincidence.** The four failures are all fixable in an hour of spec editing; none is a physics error.

---

## 3. BLOCKER

### B1 — Two incompatible coordinate frames, and the requirements document wins by its own rule

**Where:** `spec.md` §4.2 (frame + example model) vs `01` §2, `01` §8, and every equation in
`02`, `03`, `04`, `06`.

`spec.md` §4.2: *"Frame: right-handed, **X forward, Y to the right, Z up**; origin on the flat-plate
surface at the **midpoint of the two axle centrelines**."*
`01` §2: *"**y** positive to the **left** … Origin … at the **rear axle line**."*

`architecture.md` says *"the spec wins where they disagree"*, which by that rule selects the frame
that every physics document contradicts. Concretely, with Y right and the origin at mid-wheelbase:

- `02` (2.9)/(2.10) put the left contact patch at +t/2 and the right at −t/2. That is Y-left.
- `02` (2.11) `bump_left = −(t/2)·φ` is derived for φ>0 = left-side-up in a Y-left frame.
- `03` (3.2)/(3.3) hard-code `x_cp,front = l`, `x_cp,rear = 0` — a rear-axle origin.
- `06` (6.4) interpolates the roll axis with `x_cg` measured *from the rear axle*.
- `01` §8.3 derives wheelbase as `257 − 0`, only true with the rear axle at x = 0.

The example in `spec.md` §4.2 also contradicts its own header: the **front**-left `lower_arm.inboard_front`
is at `x = −110` with the origin at mid-wheelbase, i.e. behind the origin, which under "X forward" is a
rear-axle point. Whoever wrote the example was working in a rear-axle, x-rearward-positive frame.

**Question the developer must answer:** which frame does the JSON use, and which document do I believe?

**What the spec should state:** one frame, once, in `01` §2, and every other document must be
consistent with it. My recommendation is `01`'s (ISO 8855 Y-left, rear-axle origin), because eleven
physics equations depend on it and `spec.md` §4.2's costs one rewrite of one section. If the answer
is instead `spec.md`'s frame, then `02`/`03`/`04`/`06` each need a stated transform and a re-derived
sign table, and the developer must be told which of (2.9)–(2.16), (3.2)–(3.3), (6.4) change.

### B2 — Storage units are specified three ways, and `01`'s parser is built for the wrong one

**Where:** `00` §2, `01` §5 (`"units": "SI"`, metre values, `|c| > 3` rejection), `spec.md` §4.1.1
and decision **D6**, `architecture.md` §4/§6.

- `00` §2: *"Chassis/vehicle JSON on disk: **SI**: m, kg, N/m, N·s/m, **rad**."*
- `spec.md` §4.1.1 + D6: *"This build writes lengths in **mm**, angles in **degrees**, masses in **g**,
  spring rates in **N/mm**"*, and D6 resolves the question explicitly in favour of mm.
- `architecture.md` §6: Document mm/g/N·mm⁻¹/deg, solver m/kg/N·m⁻¹/rad.
- `01` §5 ships a metre-valued schema with `"units": "SI"` and a `|coordinate| > 3` guard whose entire
  purpose is to catch a millimetre value entered in a metre field.

Worse, inside `01`: `"setup": {"camber": -2.0, "toe": 0.5}` is in **degrees**, in a file that declares
`"units": "SI"`, while `00` §2 says SI includes rad and `01` §3's own table gives camber in °. A
strict reader of `00` must parse −2.0 as −114.6°.

**Question:** is a length in the document metre or millimetre, and is camber rad or deg?

**What the spec should state:** `01` §5 rewritten to the D6 units (`{"length": "mm", "angle": "deg",
"mass": "g"}`), the `|c| > 3` guard deleted and replaced by the §6.4 plausibility ranges (which already
catch a 1000× error: link length 5–120 mm), and one sentence: *"camber and toe are degrees on disk and
in the UI; the adapter converts to radians once, at the `setup_physics` boundary."*

### B3 — Camber's sign is defined three incompatible ways, and camber gain silently flips sign on the right corner

**Where:** `01` §3 (definition), `01` §6.1 (mirror table), `02` §3.6 (2.12)–(2.16), `99` I4.

Three statements that cannot all be true:

1. `01` §3: *"Camber γ — positive means top of the wheel leans **outboard**"* (a **per-wheel** angle:
   outboard is +y on the left and −y on the right).
2. `02` (2.12): `γ_kp = atan2(Uₒ.y − Lₒ.y, Uₒ.z − Lₒ.z)`, *"positive = top outboard"* — a **global-frame**
   angle in which positive means "top toward +y".
3. `01` §6.1: *"Mirroring negates y and nothing else: camber γ → −γ, toe τ → −τ"*, and G01.1 asserts
   −2.0° → +2.0°. But if camber is per-wheel with outboard positive, **mirroring does not change it**;
   the same is true of toe-in, which is symmetric. Under the stated definitions the mirror table's two
   sign flips are both wrong.

This is not cosmetic. I computed both corners:

```
κ_LF (raw (2.12)/(2.14)) = −0.109816 °/mm
κ_RF (mirror of LF)      = +0.109816 °/mm
```

So on the right corner `κ` is **positive**, and `02` (2.16) — `dγ_road/dφ = s·(1 + κ·(t/2)/57.2958)`
with `s = +1` for the right wheel — returns **1.165 °/°** instead of **0.835 °/°**. The outer wheel's
camber behaviour is then reported 40% wrong, on the corner that matters most, with no error and no
flag. `99` I4 (*"κ is the same for the left and mirrored-right corner"*) asserts exactly the opposite
of what (2.14) produces, so the identity test as written fails against a correct implementation of
(2.14) — and passes against an implementation that has quietly applied `|·|` somewhere, in which case
`02` (2.15)/(2.16)'s sign logic is broken instead.

**Question:** is γ a global-frame angle (positive = top toward +y) or per-wheel (positive = top outboard)?

**What the spec should state:** one definition, the mirror consequence in the same paragraph, and then:

- if **global**: say *"positive = top toward +y; the left and right camber values of a symmetric car
  are therefore equal in magnitude and opposite in sign, and κ changes sign between sides; (2.16) uses
  `|κ|` and the side sign `s`"*; G01.1 is right, and `01` §3 is wrong.
- if **per-wheel**: say so, delete the camber/toe sign flips from `01` §6.1, change G01.1, and state
  that (2.12) is evaluated in a per-side frame (`γ_kp = atan2(s·(Uₒ.y − Lₒ.y), Uₒ.z − Lₒ.z)`).

Either way `99` I4 must assert `|κ_L| = |κ_R|` with the side rule stated, not `κ_L = κ_R`.

### B4 — Module 5's installation-ratio equation has the wrong sign, so every car is `outOfDomain`

**Where:** `05` (5.1) and (5.2), `05` §3.1, `05` §5.

(5.1) defines `IR = −dL_spring/dz_wheel (positive in compression)`. (5.2) then writes
`IR = (dL_d/dθ) / (dz_w/dθ)` — **with the minus sign dropped**. On the reference car:

```
dL_d/dθ      = −27.557 mm/rad      (damper shortens in bump)
dz_w/dθ      = +48.748 mm/rad
(5.2) as written → IR = −0.5653
```

`05` §5 then says *"`IR ≤ 0` → `Undefined(outOfDomain)` … this is a modelling error, not a car."*
So an implementer who follows (5.2) literally gets a package in which **every car is undefined**, and
the failure looks like a bad model rather than a bad equation. The worked example in §6.1 computes
`dL_d/dz_w = (51.0989 − 52.2295)/2.000 = −0.56530` and then writes `IR = +0.56530` — it applies the
minus that (5.2) does not show.

**Question:** which sign does the implementation encode?

**What the spec should state:** `IR = −(dL_d/dθ)/(dz_w/dθ)`, i.e. carry (5.1)'s minus into (5.2), and
in §5 distinguish `IR < 0` (a real geometric inversion: damper lengthens in bump) from
`IR = 0` (`noMotionRatio`).

### B5 — The rigid-carrier transform is required by modules 4 and 5 and defined nowhere

**Where:** `02` §3.2 (W only), `01` §6 step 6 (*"the carrier's rigid-body offsets (which module 2
needs)"*), `04` §3.4 (*"z_Tₒ(bump) ← from the module-2 carrier solve"*), `05` (5.2) (damper length),
`05` §3.2 (`arb_drop` travel).

`02` gives the transform for the **wheel centre** and nothing else:

```
ê₁ = (Uₒ − Lₒ)/d,  ê₂ = (−ê₁_z, ê₁_y)
W(θ) = Lₒ + u·ê₁ + v·ê₂                                (2.5)–(2.6)
```

with `(u, v)` *"computed once, at load, by module 1's derived quantities"* — except `01` §6 step 6
names "the carrier's rigid-body offsets" without defining them, so the dependency is circular: `02`
delegates the definition to `01`, `01` delegates the formula to `02`, and neither states it for any
point other than `wc`.

Modules 4 and 5 need it for `tie_out`, `damper_lo` (on the lower arm, not the carrier) and `arb_drop`.
The choice of rotation matters:

```
Tₒ.z at bump +2:  rotate by carrier-axis change (ê₁)  → 33.948  → τ(+2) = +0.484  ✓ G04.4
                  rotate by crank-angle change (θ−θ₀) → 33.783  → τ(+2) = +0.430  ✗ (11% off)
Tₒ.z at bump +4:  35.882 → τ = +1.290  ✓   vs   35.517 → τ = +1.112  (14% off)
```

Both are "rigid carrier" implementations; only one reproduces §6.4, and the document does not say
which. A developer who picks the other one gets a toe curve that looks entirely reasonable, is 11–14%
wrong, and fails G04.4 by 100× its tolerance.

**Question:** for a point rigidly attached to the carrier, what is its position at crank angle θ?

**What the spec should state:** one function, in `02` §3.2, used by 4, 5 and the scene builder:

```
Δ  = atan2(ê₁(θ)) − atan2(ê₁(θ₀))            // carrier rotation, NOT θ − θ₀
P(θ) = Lₒ(θ) + R(Δ)·(P₀ − Lₒ(θ₀))            // R = 2×2 rotation
```

plus: `01` §6 step 6 derives and stores `(P₀ − Lₒ)` for `wc`, `tie_out` and any other carrier-attached
point, and `damper_lo`/`arb_drop` use the same construction about the **lower arm** (`R(θ − θ₀)` about
`Lᵢ`) — which is a different frame, and the spec should say so explicitly, because it is the one place
where the crank angle *is* the arm rotation.

### B6 — There is no single result type, no closed reason vocabulary, and no per-field validity

**Where:** `00` §4, `architecture.md` Risks 2, every module's "Degenerate cases" table,
`spec.md` E1.2/E1.8/E3.8.

Three different shapes are on offer:

| Source | Type |
|---|---|
| `00` §4 | `Result<T> = Ok(value, flags) \| Undefined(reason, inputs)` |
| `architecture.md` Risks 2 | `Solved<T> = Defined(value, conditioning) \| Undefined(reason)` |
| `spec.md` E3.8 | "a typed *undefined* result naming the reason" |

And the reason vocabulary in use across the modules is ~20 names, of which `00` §4's canonical list
contains six:

`parallelLinks`, `noIntersection`, `coincidentPoints`, `outOfTravel`, `incompleteModel`,
`outOfDomain` (in `00`) — plus, used in modules but **absent from `00`**:
`degenerateGeometry` (01 §7, 04 §4, 05 §5), `noAntiGeometry` (03 §7), `noMotionRatio` (05 §5),
`noRollStiffness` (06 §5), `undefinedAtZeroLateral` (06 §5), `ambiguousBranch` (04 §4),
`lowConfidence` (03 §7), `lowAngle` (04 §7), `assumedLinkage` (05 §5), `diagnosticOnly` (03),
`progressiveSpring`, `rockerApproximated`, `symmetricDamper`, `noDamping`, `temperatureInsensitive`
(05/07), `rollCentreAboveCg` (06). Half of these are *flags* and half are *reasons*; the documents
never say which, and `00` §4's `flags` is an untyped list.

The deeper problem is that **every query returns a struct of many fields, and the spec gives no
per-field validity**. `02` §1 lists ten outputs. G02.7 is the proof that they cannot share one
verdict: for parallel arms, `z_rc` is **defined** (0 mm) and `y_rc` is **not** (§4.3 gives no limit
expression for it). `spec.md` E1.2 and E1.8 require the UI to show "not measured" *per output*, and
E3.8 requires "undefined for this geometry" *per output*. A single `Undefined` for the whole struct
forces the UI to discard nine good numbers because the tenth is undefined.

**Question:** what is the return type of `frontViewKinematics(corner, bump)`?

**What the spec should state:** a sealed type, an enum, and per-field wrapping:

```dart
sealed class Solved<T> {}
final class Defined<T>  extends Solved<T> { final T value; final Conditioning cond; final Set<Flag> flags; }
final class Undefined<T> extends Solved<T> { final UndefinedReason reason; final List<HardpointRef> inputs; }

enum UndefinedReason { parallelLinks, noIntersection, coincidentPoints, outOfTravel,
                       incompleteModel, outOfDomain, noAntiGeometry, noMotionRatio,
                       noRollStiffness, degenerateGeometry, ambiguousBranch, zeroLateral }

enum Flag { diagnosticOnly, lowConfidence, assumedLinkage, progressiveSpring, rockerApproximated,
            symmetricDamper, rollCentreAboveCg, temperatureInsensitive, noDamping, lowAngle }
```

and the rule: *"a kinematics result is a struct of `Solved<double>` fields; one undefined field never
invalidates its siblings."* If `conditioning` is kept (architecture Risk 1), its threshold must be
given and `00` §4's `kParallelTol = 1e-9` reconciled with architecture's `1e-2 / 1e-4` — a 10⁵
disagreement about when the same geometry is trustworthy.

### B7 — Ride-height change has no algorithm

**Where:** `01` §6.2, `02` §3.2, `spec.md` §4.3 (`corners.<c>.ride_height` "yes — static geometry,
roll-centre datum").

`01` §6.2: *"v1 implements `rideHeightChange(models, dz)` as translating the chassis points only, then
re-running the module-2 solve from the new static state. Any other treatment double-counts."*

But **the new static state is not defined**. After translating the chassis-side points, the linkage has
one degree of freedom and nothing in either document pins it: the wheel could be anywhere. The
constraint that makes the physical answer unique is "the wheel is still on the ground", i.e.
`W.z = tyre radius`, and that is never written down. `02` §3.2 then defines bump relative to
`θ₀`, the crank angle of the *measured* geometry, which is stale after translation.

**Question:** after translating the chassis points by dz, what determines the wheel position and hence θ₀?

**What the spec should state:** `setRideHeight(dz)` = translate chassis points by +dz, then solve θ such
that `W(θ).z = measured wc.z` (the wheel stays at ride height on the road), then re-derive θ₀, `(u,v)`
and the static `Uₒ` from that state. Note explicitly that `dz > 0` lowers the chassis relative to the
wheels (bump) — direction is not stated anywhere and is a 50/50 guess that inverts every result.

### B8 — Module 3's construction is undefined for the arm type the reference car has, and its headline number is an artefact

**Where:** `03` §2, §3.1, §5.2, §8 G03.2.

`03` §3.1 projects the corner onto x–z and intersects "the two link lines". For a **fore-aft hinge
axis** — which `01` §4.1 says is what a touring car has, and which the reference car has
(`lca_in_a` x=238, `lca_in_b` x=272, both at (y,z)=(30,12)) — the lower "link" projects to a
**horizontal line at z = 12 mm spanning all x**. It has no inboard point to draw a line from.

§5.2 nevertheless writes `lower: (250.0, 12.0) → (259.0, 7.0)`. The 250.0 is `uca_in.x`, borrowed from
the upper link. Nothing in the document justifies it. Its effect:

| lower inboard x used | SVIC | θ_f | anti-dive |
|---|---|---|---|
| 250.0 (as printed) | (142.0, 72.0) | 32.05° | **316.1%** |
| 238.0 (`lca_in_a.x`, the real hinge) | (3262, −708) | x_ic > x_cp → `noAntiGeometry` | — |
| 272.0 (`lca_in_b.x`, the real hinge) | (315.3, 28.7) | x_ic > x_cp → `noAntiGeometry` | — |
| the axis line itself (z = 12 horizontal) | (382, 12) | x_ic > x_cp → `noAntiGeometry` | — |

Only the arbitrary choice produces a number at all. So G03.2 and G03.3 test a quantity that is not a
function of the chassis model, and §5.2's whole "this construction is degenerate" argument is
accidentally right for a reason the document does not state: **for a hinge-type lower arm the side-view
construction does not exist.**

**Question:** for `arm_type: hinge`, what is the lower link's side-view line — and if the answer is
"there isn't one", what does the module return?

**What the spec should state:** either

- *(recommended)* "Module 3 requires a lower arm with side-view extent. `arm_type=hinge` returns
  `Undefined(noSideViewGeometry)` and the UI omits the diagnostics panel — which is the same outcome as
  §6's 10 mm suppression rule, and consistent with §4's whole argument"; or
- define the inboard point as the hinge-axis midpoint (255.0 mm), state that this is a modelling
  choice for a transverse arm, and **recompute §5.2, the perturbation table, G03.2, G03.3 and G03.5**.

As written, G03.2 cannot be reproduced from the model, and a correct implementation returns
`noAntiGeometry` where the golden test expects 316.1%.

### B9 — Five required inputs have no home in the schema, and the ARB is modelled twice, incompatibly

**Where:** `05` §2 (`L_bar`, `a_arm`, `d`), `07` §2.1 (`A_p`, `n`, `d_h`), `01` §4.3/§5,
`spec.md` §4.2 (`arb: {type, rate_at_full_stiff}`) and §4.3 (`arb_setting: 0–1`).

`05` §2 says the ARB bar span `L_bar` and arm length `a_arm` come from *"module 1 (chassis model)"*.
`01` §4.3's point set contains neither, and `01` §5's JSON contains only `arb_drop`. Module 5 §3.2
needs a **bar diameter d** (1.0–2.5 mm) to compute `k_θ = G·J/L_bar` with `J = πd⁴/32` — also absent.

`spec.md` models the bar completely differently: `arb.type = "blade"`, `arb.rate_at_full_stiff = 0.42`,
and the setup supplies `arb_setting` as a 0–1 fraction. That is a **rate-multiplier model**, not a
torsion-bar model, and the two give different numbers for the same car. `05` §3.2 mentions blade bars
only to defer them (`v1 does not derive the setting → stiffness curve`), which contradicts
`spec.md`'s data model that stores exactly that curve as a single scalar.

Module 7 is worse: `A_p` (displaced area, 45–90 mm²) is sourced as *"module 1 / measured"* and exists
nowhere; the setup document has `damper_piston_holes` (a count) but **no hole diameter and no bore**,
so `K_h = ρA_p³/(2C_d²A_h²)` has three unbound inputs and the module cannot be called.

**Question:** where do bar diameter, bar span, arm length, piston area and hole diameter live, and is
the ARB a torsion bar (`05`) or a stiffness multiplier (`spec.md`)?

**What the spec should state:** add the missing fields to `01` §4.3 (vehicle/axle level: `arb_bar_d`,
`arb_bar_span`, `arb_arm_len`, `shock_bore`, `shock_shaft_d`, `piston_holes`, `piston_hole_d`) or
declare them setup fields; and pick one ARB model. My recommendation: keep `05`'s torsion-bar model for
round bars and treat `spec.md`'s `rate_at_full_stiff` + `arb_setting` as the blade-bar path
(`07`-style "measured multiplier"), with `05` §3.2's blade paragraph promoted from "outline" to a
defined input.

### B10 — `04` (4.4)'s rack displacement sign is wrong, and a literal implementation steers the wheels apart

**Where:** `04` (4.4) vs `04` §6.2.

(4.4): `Tᵢ' = (Tᵢ.x, Tᵢ.y ± s, Tᵢ.z)` — *"+ for the left, − for the right"*.
§6.2: *"Rack +2 mm (moves both inner ends toward +y). Left side: Tᵢ' = (225, 28)"* — i.e. **+2 on both
sides**. §6.2 is physically right: a rack is one bar, so both ends move the same way, and the tie rods
point outboard in opposite directions, which is *what steers the car*.

Implementing (4.4) gives, at rack +2:

```
per (4.4):     δ_left = −7.603°,  δ_right = +7.603°     ← wheels toe apart; Ackermann meaningless
per §6.2:      δ_left = −7.603°,  δ_right = −8.563°     ← G04.1, and Ackermann = 127%
```

The bug is invisible in a plot (both curves still look like steering) and produces a 0% Ackermann car
from one with 127%.

**Question:** does `s` apply with the same sign to both rack ends?

**Answer the spec should state:** *"The rack translates as one body: `Tᵢ'.y = Tᵢ.y + s` on **both**
sides. The sign of `s` is the rack's direction of travel in +y; a positive `s` steers the car right
(δ < 0)."* Delete the `±`.

---

## 4. MAJOR

### M1 — The bump inversion's bracket rule guarantees the wrong failure mode, and the map is not monotone

**Where:** `02` §3.2, §4, G02.8.

Three defects in one paragraph:

1. **The monotonicity claim is left-hand only.** *"`W(θ).z` increases monotonically with θ"* — true
   for the left corner (I measure 32.0 → 34.45 for +0.05 rad). On the **mirrored right corner it
   decreases** (32.0 → 29.58). An implementation whose bracket test assumes increasing (`f(lo) < 0 <
   f(hi)`) fails on every right-hand corner — and the mirror is the recommended construction
   (`01` §5 `"mirror_of"`). The mirror of the left corner also has θ₀ = −174.05°, branch sign −1, so
   nothing about the left corner's parameterisation transfers.
2. **The initial bracket cannot cover the stated input range.** `[θ₀ − 0.4, θ₀ + 0.4]` rad covers
   −18.1 … +19.7 mm on the touring car (input range ±6 ✓) but only **−23.3 … +26.8 mm on the buggy**,
   whose stated travel is ±30 mm (`02` §2) and ±25 mm (`01` §8.4). So the documented initial bracket
   *cannot* reach a legal buggy input, and the unspecified expansion path is mandatory, not optional.
3. **The expansion has no cap, and its first victim is G02.8.** For bump +50 mm on the reference car,
   the bracket must expand; doubling it hits `h² < 0` at span 0.8 rad, so the solve returns
   `noIntersection` before it can conclude `outOfTravel`. G02.8 asserts `outOfTravel`. Worse, beyond
   ±1 rad `W.z` is non-monotone (peaks at 73.88 mm at θ = 53°), so a wide bracket can contain a second
   root and bisect to a **branch-flipped** configuration — the exact bug §3.2 warns about, reintroduced
   by the expansion rule.

**Should state:** the bracket is searched by a *bounded* scan over `θ ∈ [θ₀ − 0.6, θ₀ + 0.6]` in fixed
steps, the monotonicity assumption is asserted per side with its direction, `h² < 0` inside the scan
window is treated as out-of-travel (not as `noIntersection`), and the precedence rule is written:
*"`noIntersection` is a load-time condition only; during bump inversion, any failure returns
`outOfTravel`."* Also state the reachable-travel range as an output, so the UI can say what the range
is rather than only refusing.

### M2 — Branch selection is defined for the happy path only, and the branch is re-derived on every mirror

**Where:** `02` §3.2, `04` §3.2.

*"The branch is fixed at the static state by 'which solution reproduces the measured Uₒ'"* is correct
and well explained — but three cases are undefined:

- **`h = 0`** (the two circles are tangent: `|b − d| = D`). Both branches coincide; "nearest" is
  ambiguous by 0 mm. Legitimate geometry — a carrier at exactly the tangent configuration — and it is
  the configuration that most often occurs at full bump/droop.
- **Neither branch is near the measured Uₒ** (a mis-typed hardpoint, or a carrier length `d` that is
  inconsistent with `|Uₒ − Lₒ|`). The code picks the least-bad and proceeds. Should be
  `Undefined(incompleteModel)` or a `lowConfidence` flag with the residual stated.
- **The mirror.** As M1, the mirrored corner has θ₀ = −174°, so "the branch sign stored at
  construction" is a different sign and a different parameterisation. `01` §5's `"mirror_of"` rule
  (negate y) does not say the branch must be recomputed *after* mirroring; if the store copies the
  left's branch sign, every right-hand corner is wrong.

Also, `04` §3.2 says *"Choose the branch nearest the static Tₒ (and then keep it, as in module 2)"* —
but unlike module 2 it does **not** say to store it, and `04` §4 has a separate rule (*"two solutions
equidistant → take the smaller |ψ|, log `ambiguousBranch`"*) that contradicts "nearest the static
point". Which one wins when they disagree?

### M3 — G02.4's expected value contradicts the arithmetic printed as its own origin

**Where:** `02` §6.6, §8 G02.4, `00` §8 (*"Every expected value has a stated origin: either hand calc
… No expected value is 'what the code produced'"*).

§6.6 prints the hand calculation and gets **y_rc = 18.530 mm** from the ICs rounded to 0.1 mm. The
migration table in the same section (which §8 labels *"hand calc §6.6 (solver table)"* — it is solver
output, not a hand calc) says **18.55**, and G02.4 asserts **18.550 ± 0.002**. My solver gives
18.5500 exactly, so the *number* is right; the *origin chain* is broken in three ways: the tolerance
(±0.002) is 10× smaller than the error in the printed arithmetic (0.020), the cited origin is the one
thing that does not produce the value, and a solver table is not a hand calculation under `00` §8's
own rule. An implementer who round-trips §6.6's arithmetic (the natural thing to do when testing)
fails a test that claims to come from §6.6.

**Fix:** print the intersection to 4 dp (I get y = 18.5501, z = 9.5830 from the unrounded ICs), or
loosen G02.4 to ±0.05 and label it "solver table, ICs quoted to 0.1 mm". Do not leave a golden value
whose stated source contradicts it.

### M4 — Module 5's sprung mass is incompatible with module 6's, and with the car

**Where:** `05` §2, §6.2, §6.5; `06` §6.1; `01` §8.1.

Two worked examples, one car:

| | front | rear | total sprung |
|---|---|---|---|
| `05` per corner ×2 | 0.310 kg | 0.400 kg | **1.42 kg** |
| `06` per axle → per corner | 0.4875/2 = 0.2437 kg | 0.6225/2 = 0.3112 kg | **1.11 kg** |
| car: m − m_u | — | — | **1.11 kg** |

`05`'s masses exceed the entire sprung mass of the car by 28%, and contradict `06` by 27% per corner.
That is not a rounding difference — it changes the headline output:

```
f_front with m_s = 0.310 (as printed):      9.560 Hz    (G05.3)
f_front with m_s = 0.2437 (consistent):    10.782 Hz
```

Every ride frequency, `c_crit` and damping ratio in modules 5 and 7 inherits the error. `01` §8.1
gives only vehicle-level mass and a 0.060 kg/corner unsprung figure — **no per-corner sprung mass
exists anywhere**, so `05` §2's "module 1" source is fiction.

**Should state:** per-corner sprung mass as a derived quantity in module 1 (`m_s,corner =
(F_z,corner − m_u,corner·g)/g` from the corner weights), and §6.2/§6.5 recomputed. Also state which
mass the ride-frequency denominator uses when corner weights are measured rather than split 45/55.

### M5 — Module 6's rear roll-centre height has no source, and no rear geometry exists

**Where:** `06` §6.3, G06.3–G06.8, `01` §8.

*"`z_rc,r = 6.000 mm` (assumed for this example from a similar rear geometry — the app computes it the
same way as the front)"*. `6.000` appears in no chassis model, has no `source`, and is `assumed` in
exactly the sense `00` §5 forbids. Five golden cases (h_ra, M_el, φ, all four ΔW components, balance,
residual) depend on it, so **G06.3–G06.8 are not computable from the documents** — the developer must
invent the number to make the tests pass, which is the one thing the review rules exist to prevent.

Compounding it: `01` §8 gives the LF corner and `"RF": {"mirror_of": "LF"}` and nothing for the rear.
`spec.md` E3.3 requires roll-centre height **per axle** and a migration table per axle. So the reference
car needs a rear corner in `01` §8.4, and `02` needs a sentence saying it is axle-agnostic (it is) and
what differs at the rear (no tie rod; `03` covers anti-squat).

### M6 — Ackermann's `t` is physically wrong and the golden test pins the wrong choice silently

**Where:** `04` (4.9), §2, G04.2.

(4.9) uses `t` = front track = 172 mm (contact-patch track, from `01`). The textbook criterion
`cot δ_o − cot δ_i = t/l` uses **the distance between the steering axes**, which for this car is
`2 × 78.9838 = 157.97 mm` — 8% smaller, because scrub radius is 7 mm per side:

```
t = 172.0  (contact patches)      → Ackermann = 127.06%   ✓ G04.2
t = 157.97 (steering axes)        → Ackermann = 138.35%   ✗ G04.2
```

A physics-competent reviewer will "fix" this to 158 and break the golden test with no way to know
which was intended. (Both are defensible — Milliken uses the steering-axis spacing, many practical
calculators use track — but the document must choose, in the equation, not in the test.)

**Should state:** in (4.9), *"`t` is the distance between the two steering-axis ground points
(`2·|y_g|`), not the contact-patch track; on the reference car 157.97 mm"* and then recompute §6.3 /
G04.2, **or** keep track and add the sentence *"we use contact-patch track, which is why our percentage
differs from Milliken's by ~8%; do not 'correct' it."*

### M7 — Two golden cases cannot trigger the condition they assert

- **G04.8**: *"rack +2 mm, `|δ_inner| < 0.5°` (rack +0.3 mm)"* — the input column gives two different
  rack values, and **neither works**: at rack +0.3 mm I compute δ_left = −1.188°, δ_right = +1.209°,
  so `|δ_inner| = 1.209° ≫ 0.5°` and Ackermann *is* reported. The threshold is crossed below about
  ±0.13 mm of rack travel. **Fix:** rack +0.1 mm, and one input value.
- **G03.5**: expected 100.0% requires `K_bf = 1.0`, but the input column gives only `θ_f = 6.218°`.
  The origin text says `× 0.55 = 0.55` (which is 55%, not 100%) and then appends "requires K_bf = 1.0
  → 100%". The case is un-writable as stated. **Fix:** put `K_bf = 1.0` in the input column.

`G03.2` has the same class of problem from the other side: §7 says the value is suppressed below a
10 mm side-view projection, and the reference car's projections are **9 mm and 4 mm** — both below the
threshold — so per §7 the case's flags must include `lowConfidence`, which G03.2 does not list. Either
the flag or the golden case is wrong.

### M8 — Module 2's sensitivity table is wrong by an order of magnitude and has the wrong sign, and the precision policy rests on it

**Where:** `02` §9, `99` §2.1 (V3), `99` §7.

`02` §9 asserts *"Lₒ.z +0.1 mm → +0.0165 mm (6% of the perturbation)"*. Computing the derivative of
(2.7)–(2.9) with respect to `Lₒ.z` (and re-solving so the wheel stays at ride height):

```
Lₒ.z +0.001 mm → Δz_rc = −0.00186 mm   (ratio −1.86)
Lₒ.z +0.010 mm → Δz_rc = −0.01864 mm   (ratio −1.86)
Lₒ.z +0.100 mm → Δz_rc = −0.18688 mm   (ratio −1.87)
```

**−1.87 mm/mm, not +0.165 mm/mm**, and the sign is opposite. The doc's own claim ("0.16 mm of RC per
mm of hardpoint error") is repeated in `99` §2.1 as the justification for V3's ±2 mm pass mark, and in
`99` §7 as the rationale for displaying roll-centre height to 0.1 mm. At the real sensitivity, a
0.2–0.5 mm measurement error (99 §3.2's own estimate for a caliper session) moves the displayed value
by 0.4–0.9 mm, so **0.1 mm display precision is 5–9× finer than the input supports** — the precision
policy argues itself into the opposite conclusion of the one it states.

The κ sensitivity claim ("~2% per 0.1 mm") is roughly right: I measure −2.6% per 0.1 mm on the TC and
−1.05% on the buggy.

**Should state:** a recomputed table, the perturbation explicitly defined (does `W` move with `Lₒ.z`?),
and a precision policy derived from the corrected number.

### M9 — Camber and roll have no function signature, per-axle aggregation is undefined

**Where:** `spec.md` E3.4, §4.4 ("Camber gain | deg/deg", "Camber at roll | deg"), `02` §3.6.

`spec.md` E3.4 requires: camber gain **per axle** in °/° of roll, and static camber at roll −2.0°, 0.0°
and +2.0° **for each corner**. `02` §3.6 supplies:

- `κ` in **°/mm** (2.14), per corner;
- `dγ_road/dφ` in **°/°** (2.16), per *wheel*, with an `s` that differs per side.

No function takes a roll angle and returns camber. `γ_b(z)` (2.13) needs a `z` that (2.11) derives from
φ, so it is reconstructible — but only by a reader who chains three equations across two sections. And
"per axle" is never defined: mean of the two wheels? the outer wheel? the loaded wheel? On the
reference car `dγ_road/dφ` is +0.835 for the outer and (by symmetry, with the corrected sign rule)
+1.165 or −0.835 for the inner depending on B3's resolution — so the per-axle number can differ by 40%
depending on an unstated choice.

**Should state:** `camberAtRoll(corner, phiDeg) → Solved<Camber>` and `camberGainPerRoll(axle, side)`,
with the aggregation rule named (*"per axle we report the outer wheel's value, because that is the one
the tyre sees"*).

### M10 — Roll-centre sweep granularity: three documents, three answers

**Where:** `spec.md` E3.3, P-01; `02` §3.5; `99` §5.2.

- `spec.md` E3.3 (**MUST**): a migration table at −3.0° to +3.0° in **0.5° steps**, *"with the height at
  each step displayed rather than only drawn"*. P-01 budgets a **13-row** sweep.
- `02` §3.5: *"Report `(y_rc, z_rc)` at φ = 0, ±1°, ±2°"* — 5 points, and *"beyond ±3° treat the number
  as directional"*.
- `99` §5.2: *"show the migration as a line on a chart, **not as a number in a table**"*.

`99` forbids the display that `spec.md` makes mandatory. The API consequence is real: `02`'s five-point
table can be a fixed output struct; `spec.md`'s 13 points require a `rollCentreAt(phi)` query. **Should
state:** a single function `rollCentre(phiDeg)` plus a documented clamp/`Undefined` beyond ±3°, and
delete whichever of the three statements loses.

### M11 — Damping ratio: the MUST contradicts the module's own prohibition

**Where:** `spec.md` E3.6 (**MUST**: *"damping ratio reported per corner at a stated low and a stated
high shaft speed"*), `07` §8 (*"Do not show a single damping ratio. Show the curve"*), `99` §5.3
(*"ship the curve, no headline ζ"*).

The module is right and the requirement is a regression to the thing the module was written to prevent.
But E3.6 is a MUST and therefore a release gate. **Should state:** E3.6 amended to *"the curve, with the
values at the stated low and high shaft speeds marked and readable"* — the data the requirement wants,
without the single-number display it forbids. The API should return `DamperCurve` (sampled) plus the
two reference-speed points, never a bare `zeta`.

### M12 — Degenerate coverage has holes exactly where the documents say it does not

`00` §8: *"At least one case per module is a degenerate case."* Present: G01.6, G02.7, G02.8, G03.4,
G04.7, G05.7, G06.6, G06.7, G07.7. **Absent**, and each is a case the documents themselves flag:

| Missing case | Where it is mandated | Why it matters |
|---|---|---|
| vertical parallel arms (‖d̂_y‖ ≈ 0) | `02` §4.3 (*"valid for \|d̂_y\| > tol"* — and nothing after) | `z_rc = −d̂_z·y_cp/d̂_y` → **±∞ across a public API**, violating `00` §4 rule 1. A trailing-arm or swing-axle buggy hits it. No defined return. |
| `IR < 0` (damper lengthens in bump) | `05` §5 | distinguishes B4's sign bug from a real inversion |
| κ at the travel limit (±0.5 mm difference point out of range) | `02` §3.6 | (2.14) needs `γ_kp(±0.5)`; at full droop one is `outOfTravel`. Returns `Undefined` for κ, or clamps? unstated |
| `k_φ = 0` (no bar, zero rate) | `06` §5 | division by zero in (6.6) |
| zero-length link reaching the API | `00` §4 rule 1, review rule 4 | `01` says loads refuse it; `02` §4 says `noIntersection` "usually a mis-typed hardpoint". Contradictory: which layer defends? |
| `a_y = 0` balance | `06` §5, G06.7 ✓ | present — noted as the model for the others |

`99` I1–I10 covers *identities*, not these. Add them as G-cases; a property test over random geometry
will not reliably generate a vertical-parallel-arm car.

### M13 — Numerical-method choices are not normative, but golden values are pinned to them

**Where:** `02` §3.2 (40 bisections), §3.6 (`h = 0.5 mm`), `04` (4.13) (`±0.2 mm`), `05` §3.1
(`h = 0.001 rad`), `05` §6.1 (`h = 1 mm` of wheel travel), `architecture.md` §7 (tolerances
1e-9 closed-form / 1e-6 iterative), `spec.md` E3.10 (1e-9 cross-device).

- `05` §3.1 and §6.1 use **different differentiators for the same quantity**: "the reference
  implementation" is the θ-step (giving 0.565308) but the worked example is the wheel-step (giving
  0.56530). G05.1's tolerance is 1e-5 and the two values differ by 8e-6 — it passes either way by
  luck, not by design. A developer using a 0.5 mm wheel step (as module 2 does) lands somewhere else
  again. **State one step per derivative and make it part of the contract.**
- `02` (2.14)'s `h = 0.5 mm` is the whole value of G02.2 to 1e-4 relative: an equally valid `h = 0.25`
  gives a different 5th digit. The tolerance is on a *finite-difference approximation*, so the step is
  a test fixture, not an implementation detail.
- **E3.10's 1e-9 cross-device agreement** is stronger than `dart:math`'s `sin`/`cos` guarantee
  (IEEE-754 does not require correctly-rounded transcendentals, and dart2js/JS vs AOT differ by ULPs).
  It is satisfiable for closed-form results but *not* for anything downstream of a bisection root whose
  branch decision can flip on one ULP, nor for the far-IC geometry where a 1e-12 rad change in θ moves
  the IC by ~1e-6 mm. **Restate as:** *"closed-form outputs agree to 1e-9 relative; iterative outputs
  to 1e-6 relative, with the iteration count and bracket fixed by the spec."*
- 60 vs 40 bisections: `02` says "60 is overkill; 40 gives 1e-12 rad" — verified (0.8/2⁴⁰ = 7.3e-13).
  Fine, but the **count is then part of the output value**, so it must be in the API doc, not the prose.

---

## 5. MINOR

| # | Where | Question / issue | Should state |
|---|---|---|---|
| m1 | `00` §4 | `kCoincidentTol = 1e-9 m` (1 **n**m) but the table above it says "within 1 **µ**m", and `01` §7 uses 1 µm | one number; 1e-6 m is the intended value (a 1 nm coincidence test is 1000× stricter than any parser) |
| m2 | `00` §4 rule 2 vs `02` §4.3 | `00` says parallel arms → `rollCentre = 0 mm`; `02` §4.3 says use the limit, which is **non-zero** for inclined parallel arms | `02`'s version is the correct one; fix `00` |
| m3 | `02` §3.6 vs §5.4 | §5.4 assumes "the wheel plane is parallel to the kingpin axis"; §3.6 says γ₀ "differs from it by the KPI plus the carrier's built-in camber offset" and is a free setup input | say γ₀ is a display-only offset that does **not** move `W` or `Uₒ`; otherwise a user changing static camber expects the geometry to move |
| m4 | `02` §6.6 vs `01` §3 | §6.6: "at φ > 0 (left up, **a left-hand corner**)"; `01` §3: "In a **left-hand corner** the car rolls right, so φ < 0" | one of them is inverted, and it decides whether migration toward +y is "inside" or "outside" |
| m5 | `06` §6.5 | "front axle's inner wheel drops to **68%** of its static load" — arithmetic gives 2.3855/2.9798 = **80.1%** (rear 87.3%) | 80%, or recheck which load was divided |
| m6 | `06` §3.2 | heading "For an axle of track t: ΔW = m·a_y·h/t" then text "the whole-car lateral load transfer" — the per-axle form is never given | split into (6.3a) whole car at t̄ and (6.3b) per axle, or delete the per-axle heading |
| m7 | `03` §7 | detects parallelism as `|m₁ − m₂| < 1e-9` on **slopes**, then says "arm exactly vertical in side view: handle explicitly, do not divide by Δx" — the slope test itself divides by Δx | use the same normalised cross product as `02` §4 (`|d₁×d₂| < k·|d₁||d₂|`), and give the vertical case a worked branch |
| m8 | `04` §2 | "steering-arm angle offset — derived from the Tₒ hardpoint; exposed in the UI as Ackermann shim" — no algorithm for rotating `Tₒ` about `A`, and no sign convention for "forward"/"rearward". G04.3 depends on it | `Tₒ(α) = A + R(α)(Tₒ − A)`, α positive = rearward, in plan view |
| m9 | `04` §4 | `ρ < 1 mm` → `degenerateGeometry`, but ρ for the reference car is 17 mm and a buggy's steering arm may legitimately be shorter | justify the threshold or state it as `lowConfidence` |
| m10 | `05` §3.2 | `IR_arm ≈ r_d/a` — `r_d` is described as "radius" but `arb_drop` is a 3-D point, and `a_arm` may be the same quantity | define `r_d = |arb_drop − Lᵢ|` projected on the arm line, and say whether `a_arm` (bar axis → drop link) is the same distance measured at the bar |
| m11 | `07` §3.1 vs §1 | `c_wheel(v) = F_wheel(v)/v = F_damper(v)·IR²/v` — the two forms are equal only if the `v` in `F_wheel(v)/v` is the *wheel* speed and the `v` in the second is the *shaft* speed; same symbol, two meanings in one line | subscript `v_s` and `v_w` |
| m12 | `07` §5 | "`v = 0`: ζ undefined; return `F = 0` and `ζ = 0`" — returns a number for something declared undefined, and `00` §4 forbids the pattern | `Undefined(atZeroSpeed)` for ζ, `F = 0` for force |
| m13 | `02` §2 | lists "x of Lₒ, Uₒ, W — module 1 (for caster/trail)" as a separate input while everything else is (y,z); the 3-D → 2-D projection of a point is never stated as a function | one line: "all 2-D quantities are `(point.y, point.z)`; caster and trail additionally use `point.x`" |
| m14 | `01` §6 step 6 | "tyre radius = `z(wc)`" — true only if the wheel is on the ground *and* camber is ignored; a 3° cambered wheel's centre sits `R(1−cos γ)` ≈ 0.04 mm high | state the approximation, or derive radius from the declared `tyre_radius` instead of `z(wc)` |
| m15 | `01` §7 | checks `wc.y ≤ 0` only "on the LF corner"; no RF check and no rule for which corner is "LF" when the model is asymmetric | check sign per corner against its key |
| m16 | `01` §6.1 | mirroring negates camber and toe (see B3) but leaves `sources` untouched — a mirrored point inherits the left's source, which is right, but the doc does not say so | one sentence |
| m17 | `02` §6.4 | prints `Lₒ = (78.1642, 8.9651)` while §6.4's own arithmetic gives `8.9646`; the doc explains why, but G02.3's 1e-3 mm tolerance then has 0.5e-3 of headroom | quote 4 dp and note the tolerance is 2× the print precision, not 100× |
| m18 | `99` I7 | *"if the tie-rod inner points are moved to the knuckle pivots (ρ → tie rod length), δ_inner = δ_outer"* — this does not follow, and moving `Tᵢ` to the knuckle pivot would make the tie rod zero-length | replace with: "a rack whose inner ends are at infinity (parallel tie rods) gives δ_inner = δ_outer" |
| m19 | `99` I10 | *"elastic + geometric + unsprung = total, per axle, to 1e-9"* — reads as contradicting §3.7's −1.23% residual, because "total" is used for both the per-axle sum and (6.3) | rename: "components sum to the per-axle total by construction; the per-axle total does **not** equal (6.3)" |
| m20 | `00` §3 | `IR` is the only symbol here; `05` calls it "installation ratio (IRC calls it motion ratio)" — "IRC" is an unexplained acronym, and `spec.md` §4.4 calls the same thing "Motion ratio" | one name in the package (`IR`), one display name, and spell out IRC or drop it |

---

## 6. NIT

- `04` §6.4: *"b = [τ(+0.2) − τ(−0.2)]/0.4 = [0.0325 − (−0.0325)]/0.4 ≈ +0.162"* — the two intermediate
  values are not what the model gives (**+0.03403 / −0.03096**, asymmetric because τ is not odd about
  static) although their slope is right. Since `00` §8 says the printed arithmetic is what a reviewer
  checks with a calculator, print the numbers the equations produce.
- `02` §5.1: *"never present roll-centre height to 0.1 mm precision — one decimal, never two"* — 0.1 mm
  **is** one decimal. Presumably "0.01 mm, so one decimal, never two".
- `03` §8 G03.1 origin says `tan θ_r = z_ic/(x_ic − x_cp) = 40/(90 − 0)`; §3.3 (3.3) says the same.
  Fine — but for a pan car the "SVIC is the pivot" claim needs `θ_r` measured from the contact patch,
  which the text says and the formula confirms. No action, noted as the one place the text and the
  formula agree without effort.
- `06` §1 lists corner weights in "N (and g)" — `g` is a mass unit here and the gravity symbol in §2 of
  the same document. Use `gf` or `g_mass`.
- `05` §2: "shear modulus … 79.3 (steel), 26 (titanium)" then §2's note says "titanium `G = 41 GPa`".
  Two values for one material, both labelled assumed. 41–43 GPa is right for Ti-6Al-4V in shear.
- `07` §6.3 table: at 99.1 mm/s it lists `F_orifice = 5.191` and `F_linear = 5.191` and `F = 5.191` —
  consistent, but the row's purpose (the crossover) would be clearer with the two computed to more
  digits, since the case is G07.2's.
- `04` §6.2 shows `δ_left = −7.61°` in the arithmetic and `−7.603°` in the summary two lines later.
  Use one rounding and say which the test asserts.
- `00` §9: *"The four-bar solve … is 40 bisection iterations of a circle intersection and costs
  microseconds"* — it is 40 bisections of a **bump inversion** each requiring a circle intersection per
  evaluation, i.e. 40 intersections per query, and a 13-point roll sweep is 26 corners × (2 sides) ×
  40. Still microseconds, but the sentence understates the work by 40× in a document whose budget
  (P-01/P-03) someone will later hold it to.

---

## 7. The five questions I would send before starting

1. **Which frame and which units does the document use — `01`'s (ISO 8855, y left, origin at the rear
   axle, metres on disk) or `spec.md` §4.2's (y right, origin at mid-wheelbase, millimetres)?**
   `architecture.md` says the requirements document wins where they disagree, and that choice inverts
   every sign in modules 2, 3, 4 and 6. Which document gets rewritten, and by when?

2. **Is camber a global-frame angle (positive = top toward +y) or a per-wheel angle (positive = top
   outboard)?** This decides whether `κ` changes sign between the left and right corners — I measure
   −0.1098 and +0.1098 — and therefore whether (2.16) uses `κ` or `|κ|`, whether `01` §6.1 negates
   camber and toe on mirroring, and whether `99` I4 asserts equality or equality of magnitude.

3. **What is the position of a point rigidly attached to the carrier, and who owns it?** `02` §3.2
   defines it for the wheel centre and hands `(u,v)` to module 1, which does not define it; module 4
   needs it for `tie_out` and module 5 for `damper_lo`. Rotating by the carrier-axis change reproduces
   §6.4's toe table exactly; rotating by the crank angle gives τ(+2) = 0.430 instead of 0.484. Which is
   the contract?

4. **Where do bar diameter, bar span, arm length, piston area and piston-hole diameter live, and is the
   ARB a torsion bar (`05` §3.2: `k_θ = GJ/L`, `J = πd⁴/32`) or a stiffness multiplier (`spec.md`:
   `arb_setting × rate_at_full_stiff`)?** As specified, modules 5 and 7 cannot be called with a
   document that validates against `spec.md` §4.2/§4.3.

5. **Which masses are the reference car's?** `05` uses 0.310 kg front / 0.400 kg rear per corner
   (1.42 kg sprung, against 1.11 kg available); `06` derives 0.4875 / 0.6225 kg per **axle**. Every
   ride frequency and damping ratio in modules 5 and 7 moves by ~13%. And is module 6's
   `z_rc,r = 6.000 mm` a measurement, an assumption to be flagged, or a placeholder to be replaced by
   real rear hardpoints — because five golden cases depend on it and it appears in no chassis model.

---

## 8. Where the implementation time will go

**Module 2 costs the most — not because the physics is hard, but because it is the module where every
undecided convention becomes a number.**

Ranked, with the reason:

| Module | Weight | Why |
|---|---|---|
| **2 — front view** | **1.0** | 10 golden cases; an iterative solve with three unstated rules (bracket, expansion cap, failure precedence); branch storage; mirroring that changes the parameterisation (θ₀ = −174°), the monotonicity direction and the sign of κ; a two-line roll-centre intersection that must stay defined while the IC does not; a 13-point migration sweep; and it is the dependency for 4, 5 and 6. My independent implementation reproduced 9 of its 10 goldens in ~90 lines, so the *coding* is 2 days — the *decisions* are the cost, and every one of them is B1/B3/B5/M1/M2/M4. |
| **4 — steering** | 0.7 | Two circle solves, branch selection with two contradictory tie-break rules, a sign normalisation the text gestures at, an unstated carrier transform (B5 — without it the toe curve is 11–14% wrong and looks fine), and 3 of its 8 golden cases defective (B10, M6, M7). It has the highest ratio of "looks right / is wrong" in the package. |
| **5 — rates** | 0.5 | Mostly closed-form, but the shipped number is a numerical derivative (sign bug B4 makes the whole module degenerate), the ARB needs inputs that do not exist (B9), and IR feeds 6 and 7 so a bug here is a bug everywhere. |
| **6 — load transfer** | 0.4 | Simple algebra, all of which I reproduced to 1e-5 — but it needs z_rc per axle (no rear geometry, M5), per-corner sprung mass (M4), and a residual check whose tolerance is stated as "a few percent" and then asserted at ±0.05. |
| **1 — coordinates** | 0.3 | Bookkeeping, but it is the gate for everything: frame (B1), units (B2), mirroring (B3), the carrier offsets (B5) and ride height (B7) all land here. Cheap to write twice if B1 is answered late. |
| **7 — damping** | 0.3 | One closed-form model and a `min()`; the only cost is the missing schema fields and the ambiguous `v`. |
| **3 — anti-dive** | 0.15 | Should be 2 hours. It becomes a day because the construction is undefined for the reference arm (B8) and the author has to decide whether the module ships at all for hinge arms. |
| **8, 9** | ~0 | Interface stub and an outline. |

**Recommendation to the author, in order:** resolve B1/B2 (one hour of editing, unblocks module 1),
then B3/B4/B5 (they unblock 2, 4 and 5 and are each a paragraph), then either fix B8 or descope module
3 from v1 — it is flagged `diagnosticOnly`, suppressed below 10 mm of projection, and on the reference
car it has nothing to compute, so it is the cheapest thing in the package to defer and the most
expensive to argue about.
