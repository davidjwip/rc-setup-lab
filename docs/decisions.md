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
acceleration simulation, tyre model and composite grip scores are out of v1. Static damping ratio
is in, which means the damper model must produce a defensible ζ from geometry and published
damper data, not a full curve fit.

---

**D-13 — Damping ratio ships in v1 as an estimate, and the trend is the product.** Dave, 2026-10-30.
ζ is computed with a stated band and an `estimated` badge; the absolute value is explicitly not
accurate. What must be trustworthy is the *direction*: heavier oil damps more, laying a shock down
reduces the motion ratio and therefore the wheel-level damping, a stiffer spring raises ζ for the
same damper. The app leads with the change between two sheets and the reason, not with the numeral.
Forecloses: nothing — the drop-test workflow (§3 option 3 of `docs/reviews/round1/CONSOLIDATED.md`)
remains the route to a measured ζ later, and upgrades this badge when it lands.

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
