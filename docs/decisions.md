# Decisions

Newest last. Each entry: what was decided, by whom, on what date, and what it forecloses.
Anything that is a *proposal* lives in the backlog, not here.

---

**D-09 — Gate command is `dart run tool/gate.dart`.** Dave, 2026-10-30. It runs `dart analyze`
and `dart test` per package plus schema/migration checks. Forecloses: nothing; the two individual
commands still work locally, they simply are not the gate.

**D-10 — iOS is deferred; Android first.** Dave, 2026-10-30. No Apple Developer enrolment, no Mac
purchase, no iOS signing work in v1. Flutter stays (a single codebase keeps iOS a later build
target, not a rewrite), but the v1 release path is Android only. Revisit when Dave says so; the
decision that cannot be retrofitted is *individual vs organisation enrolment*, and it stays open.

**D-11 — v1 ships with an honest validity chip, not with bench validation.** Dave, 2026-10-30.
Each computed property carries its evidence level (`computed, not yet validated`), and the app
says so in the number's own detail panel. Bench validation (L2 in `docs/specs/physics/99-validation.md`)
proceeds in parallel and upgrades the chip per property, property by property. Forecloses: any
marketing claim of accuracy before a property is measured.

**D-12 — v1 scope: geometry, balance, static damping ratio.** Dave, 2026-10-30. Motor/ESC dyno,
acceleration simulation, tyre model and composite grip scores are out of v1. Damping ratio is in —
as an **estimate with a band, never as a validated number** (see D-13): `ζ` is reported at two
stated shaft speeds, its signed *change* between sheets leads, and it is never presented as
measured. The requirements now carry it as R1/E3.6 with the schema fields it needs (piston bore,
shaft diameter, hole diameter, hole count, oil viscosity, blow-off force).

---

**D-13 — Damping ratio ships in v1 as an estimate, and the trend is the product.** Dave, 2026-10-30.
ζ is computed with a stated band and an `estimated`/`inferred` badge; the absolute value is
explicitly not accurate (±30% at ≥ 50 mm/s, ±50% between 20 and 50 mm/s, and **no band at all below
20 mm/s** where stiction dominates and the model does not apply). What must be trustworthy is the
*direction*: heavier oil damps more; laying a shock down reduces the motion ratio and therefore the
wheel-level damping; more or larger piston holes reduce low-speed force; hotter oil damps less.

> **Correction (this entry was wrong on first writing).** It originally listed "a stiffer spring
> raises ζ" as a direction to trust. That is backwards: ζ = c / (2√(k·m)), so a +20% spring rate
> gives **−8.7%** ζ for the same damper. The physics revision caught it; the corrected direction is
> in the table above and in `07-damping.md` §9. The lesson is the standing one: directions are only
> trustworthy once the equation has been written down.

Forecloses: nothing — the drop-test workflow (§3 option 3 of `docs/reviews/round1/CONSOLIDATED.md`)
remains the route to a measured ζ later, and upgrades this badge per property when it lands.

**D-16 — One machine-readable schema, and provenance is structural.** Dave's project, ruled
2026-10-31 after the round-2 verifier found two normative car-model files (spec §4.2 and
physics/01 §5) that disagree on schema_version, on nesting and on how a value carries its source.
`docs/specs/fields.yaml` is the single normative definition of every field: type, unit, requiredness,
`on_absence`, plausible range, and which outputs consume it. Prose tables and the generated Dart
table are *views* of it, and the gate fails if they diverge. On disk, every **measured** field is a
`{ "value": …, "source": … }` object rather than a bare number: a value without a source becomes a
schema error instead of a review note. Cost: files are more verbose and a hand-written model is
slower to type. Accepted — the alternative is a silent unsourced number, which is the one thing
this project must never ship.

**D-17 — Camber and toe are per-wheel signed, and mirroring does not negate them.** Ruled
2026-10-31. "Positive camber = top outboard" and "positive toe = toe-in" are statements about the
wheel, not about the car's axes, so a symmetric car has identical stored values left and right, and
`mirror_of` copies them unchanged. Negating on mirror (as the requirements and architecture said)
would put 1.0° of toe on a straight car; leaving them unchanged while the *formula* works in global
coordinates (as physics/01 does, with an explicit side factor s = ±1) is the correct pairing.
Conversion to a global-frame angle happens inside the solver, once, and never in the document.

**D-14 — CG height is inferred, never measured.** Dave, 2026-10-30: "we can't really work out CG."
Two derivation routes: a component-mass estimate (motor, battery, electronics, plate, corner
unsprung masses, with positions) and a two-hang plumb-line procedure for a user who wants a real
number. The app must state which outputs are robust to CG error — the front/rear balance split,
because both axles share the same *h* — and which are not: absolute load transfer and roll angle.
Forecloses: any claim of measured accuracy on absolute load-transfer magnitudes.

**D-15 — Interpreter vocabulary and inputs.** Dave, 2026-10-30. Understeer / oversteer, not
push/loose; phases entry / mid / exit. Sheets record optional conditions — carpet or asphalt,
temperature, humidity, plus room for tyres and motor — and a diff spanning different conditions
says so. **Grip is never measured or computed: it is inference**, and carries its own tier.

---

## Proposals awaiting a decision

- **Setup-sheet library with a change interpreter.** Compare not only two setups but a *sequence*
  of saved sheets, and report for the items that changed: predicted direction of understeer /
  oversteer at entry, mid and exit; movement of roll centre and camber gain; and the driving
  quantity behind each call. Dave's idea, 2026-10-30. Design questions in issue #10.
- **Chassis material and thickness.** Carbon / aluminium / steel, with thickness, feeding mass,
  CG height and torsional stiffness. Dave's idea, 2026-10-30. Scope questions in issue #11.
