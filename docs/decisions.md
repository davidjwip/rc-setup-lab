# Decisions

Ordered by number. Each entry: what was decided, by whom, on what date, and what it forecloses.
Anything that is a *proposal* lives in the backlog, not here.

---


---

**D-09 — Gate command is `dart run tool/gate.dart`.** Dave, 2026-10-30. It runs `dart analyze`
and `dart test` per package plus schema/migration checks. Forecloses: nothing; the two individual
commands still work locally, they simply are not the gate.

**Superseded in form by D-19** (the stack moved to React): the gate is now `npm run gate`. The
*contract* — one command, every package, a stage that cannot silently skip a package — stands.

---

---

**D-10 — iOS is deferred; Android first.** Dave, 2026-10-30. No Apple Developer enrolment, no Mac
purchase, no iOS signing work in v1. Flutter stays (a single codebase keeps iOS a later build
target, not a rewrite), but the v1 release path is Android only. Revisit when Dave says so; the
decision that cannot be retrofitted is *individual vs organisation enrolment*, and it stays open.

**Superseded by D-19.** There is no native iOS build to defer: one web URL serves both phones, so
the enrolment question is closed rather than deferred.

---

---

**D-11 — v1 ships with an honest validity chip, not with bench validation.** Dave, 2026-10-30.
Each computed property carries its evidence level (`computed, not yet validated`), and the app
says so in the number's own detail panel. Bench validation (L2 in `docs/specs/physics/99-validation.md`)
proceeds in parallel and upgrades the chip per property, property by property. Forecloses: any
marketing claim of accuracy before a property is measured.

---

---

**D-12 — v1 scope: geometry, balance, static damping ratio.** Dave, 2026-10-30. Motor/ESC dyno,
acceleration simulation, tyre model and composite grip scores are out of v1. Damping ratio is in —
as an **estimate with a band, never as a validated number** (see D-13): `ζ` is reported at two
stated shaft speeds, its signed *change* between sheets leads, and it is never presented as
measured. The requirements now carry it as R1/E3.6 with the schema fields it needs (piston bore,
shaft diameter, hole diameter, hole count, oil viscosity, blow-off force).

---

---

---

**D-13 — Damping ratio ships in v1 as an estimate, and the trend is the product.** Dave, 2026-10-30.
ζ is computed with a **computed** band and an `estimated`/`inferred` badge; the absolute value is
explicitly not accurate. The band is not a fixed label: it is produced by re-running the model at each
input's stored tolerance and taking the union (physics/07 §6.6). On the reference car that gives
**−40/+15 % at 20–50 mm/s** (hole diameter sets the low side, discharge coefficient the high),
**−50/+4 % at 99 mm/s**, and **±50 % at 200–500 mm/s** (blow-off force and post-blow-off rate
dominate) — and **no band at all below 20 mm/s**, where stiction dominates and the model does not
apply. What must be trustworthy is the *direction*: heavier oil damps more; laying a shock down
reduces the motion ratio and therefore the wheel-level damping; more or larger piston holes reduce
low-speed force; hotter oil damps less.

> **Correction (this entry was wrong twice).** It first listed "a stiffer spring raises ζ" as a
> direction to trust — backwards: ζ = c / (2√(k·m)), so +20% spring rate gives **−8.7%** ζ for the
> same damper. It then carried a fixed ±30 %/±50 % band, which the requirements explicitly refuse: a
> band that ignores which input dominates tells the user nothing about what to measure next. Both are
> fixed above. The lesson is the standing one: directions and bands are only trustworthy once the
> equation has been written down.

Forecloses: nothing — the drop-test workflow (§3 option 3 of `docs/reviews/round1/CONSOLIDATED.md`)
remains the route to a measured ζ later, and upgrades this badge per property when it lands.

---

---

**D-14 — CG height is inferred, never measured.** Dave, 2026-10-30: "we can't really work out CG."
Two derivation routes: a component-mass estimate (motor, battery, electronics, plate, corner
unsprung masses, with positions) and a two-hang plumb-line procedure for a user who wants a real
number. The app must state which outputs are robust to CG error — the front/rear balance split,
because both axles share the same *h* — and which are not: absolute load transfer and roll angle.
Forecloses: any claim of measured accuracy on absolute load-transfer magnitudes.

---

---

**D-15 — Interpreter vocabulary and inputs.** Dave, 2026-10-30. Understeer / oversteer, not
push/loose; phases entry / mid / exit. Sheets record optional conditions — carpet or asphalt,
temperature, humidity, plus room for tyres and motor — and a diff spanning different conditions
says so. **Grip is never measured or computed: it is inference**, and carries its own tier.

---

---

---

**D-16 — One machine-readable schema, and provenance is structural.** Dave's project, ruled
2026-10-31 after the round-2 verifier found two normative car-model files (spec §4.2 and
physics/01 §5) that disagree on schema_version, on nesting and on how a value carries its source.
`docs/specs/fields.yaml` is the single normative definition of every field: type, unit, requiredness,
`on_absence`, plausible range, and which outputs consume it. Prose tables and the generated TypeScript
table are *views* of it, and the gate fails if they diverge. On disk, every **measured** field is a
`{ "value": …, "source": … }` object rather than a bare number: a value without a source becomes a
schema error instead of a review note. Cost: files are more verbose and a hand-written model is
slower to type. Accepted — the alternative is a silent unsourced number, which is the one thing
this project must never ship.

---

---

**D-17 — Camber and toe are per-wheel signed, and mirroring does not negate them.** Ruled
2026-10-31. "Positive camber = top outboard" and "positive toe = toe-in" are statements about the
wheel, not about the car's axes, so a symmetric car has identical stored values left and right, and
`mirror_of` copies them unchanged. Negating on mirror (as the requirements and architecture said)
would put 1.0° of toe on a straight car; leaving them unchanged while the *formula* works in global
coordinates (as physics/01 does, with an explicit side factor s = ±1) is the correct pairing.
Conversion to a global-frame angle happens inside the solver, once, and never in the document.

---

---

**D-18 — CG height keeps 28.0 mm as the stated default, and the band tells the truth.** Ruled
2026-10-31. The reference car's own component build-up gives 18.7 mm, which is 33% away; moving the
goldens to it would swap one unmeasured number for another. So the default stays 28.0 mm, every
consuming output is tiered `inferred`, and the band (±14% on TLLT, ±22% on roll angle, ±0.13 pp on
balance) is displayed rather than hidden. The first plumb-line measurement on a real car replaces it
per model, and the model records which route produced the number.

---

**D-19 — React reactive web app, not Flutter.** Dave, 2026-10-31. The app ships as a **reactive web
application in React + TypeScript**, installable to the home screen (PWA) and working fully offline.
Flutter and Dart are retired from the project completely — no Dart package, no `flutter` command, no
`pubspec.yaml`.

What this changes:

- **Stack:** React 19 + TypeScript + Vite; a pure-TS physics package (no DOM, no React) beside a data
  package that owns the schema and the single unit conversion; Zustand or equivalent for state; a
  router for the three destinations.
- **Gates:** `npm run gate` (typecheck + unit tests + schema/field drift check) replaces
  `dart run tool/gate.dart`. One command, same contract.
- **Distribution:** static hosting, no store. Zero running cost, and no 14-day closed test, no
  Play Console fee, no Apple enrolment — D-10 (deferring iOS) and the store-release ACs are
  superseded: both phone platforms are served by one URL.
- **Offline:** service worker + local storage; the app must open and compute with no network on a
  phone that has never seen it before the first load.
- **The physics does not change.** Units, frame, goldens, bands and the schema are stack-neutral, and
  every physics document survives this decision untouched.

Forecloses: native-store presence without a wrapper (Capacitor/Tauri would be a later addition, not a
rewrite), and any assumption that the first implementation has a native file system — import/export
goes through the browser's file picker and download flow.

---

**D-20 — Persistence: IndexedDB, with the eviction problem answered rather than hoped away.**
Ruled 2026-10-31 after the round-4 review flagged that "local storage" cannot hold a model library.
Documents live in **IndexedDB** (one object store per document kind, content-addressed revisions);
`localStorage` holds UI preferences only; `navigator.storage.persist()` is requested at first run.
The iOS reality is stated on screen, not buried: **Safari evicts storage for sites not visited in
seven days**, and an installed home-screen app is exempt. So the first run offers "add to home
screen", the app shows a storage-state row, and it nags for an export when the last export is more
than seven days old. Export/import is the user's real backup, not a nicety. File System Access API
where the browser has it, download/upload everywhere else.

---

**D-21 — Web performance budgets, re-baselined and provisional.** Ruled 2026-10-31. The 16 ms drag
budget was written for Dart; JavaScript in a browser on a mid-range Android is a different machine.
Provisional budgets until measured on a real device: **first load ≤ 350 KB gzipped JS**, **total
cached assets ≤ 2 MB**, **a model document ≤ 100 KB**, **slider-drag recompute ≤ 8 ms at p50 and
≤ 16 ms at p95**. The app must stay interactive while dragging — dropping frames is a defect, not a
trade-off. These are marked provisional in `spec.md` and re-baselined after the first measurement on
Dave's reference phone; the AC cites the measured number, not this estimate.

---

**D-22 — Import/export semantics, and the one capability we knowingly lose.** Ruled 2026-10-31.
A web app cannot be the handler for a `.json` file tapped in email, so **file association is an
accepted loss**, recorded rather than glossed. The flows that remain: "Open from device" (file
picker), drag-and-drop on desktop, and paste-a-document on any platform. Export is a download, and
"export everything" produces one archive the user can keep. Nothing depends on a native file system.

---

**D-23 — Drawing: SVG for the suspension scene, canvas for series, and neither computes physics.**
Ruled 2026-10-31. The suspension view is **SVG** — crisp at any pixel ratio, inspectable, testable
against the same geometry objects the physics returns, and accessible to a screen reader. Series plots
(damper curves, roll against lateral g, load-transfer split) use a small chart library behind a
wrapper, switching to canvas only above a few thousand points. Any painter or chart component that
calls a trigonometry function is a review failure: it renders numbers the physics package produced.

**D-24 — `arb.blades` exists, and `arb.rate_at_link` means "one blade" only when it does.** Ruled
2026-10-31, after the roll-stiffness slice found that the schema could not express a blade bar while
G05.12 required one. `axles.<axle>.arb.blades` is added (count, `OMIT`). Semantics:
**present** → `rate_at_link` is the rate of a single blade and the bar rate is n × it, in parallel,
never half; **absent** → `rate_at_link` is the rate of the bar as fitted, which is what bench-testing
the assembled bar gives, and is the normal case for a club racer. Torsion bars, `fixed` and `none`
ignore it. Forecloses: nothing — the field is optional and defaults to the behaviour every existing
model already assumed.

---

**D-25 — Corner geometry is split chassis-fixed / hub-fixed, and the hub is derived.** Ruled
2026-11-04. The outboard ball studs (`lca_out`, `uca_out`, `tie_out`) are screwed to the upright, so
they are stored as **offsets from the wheel centre**, not as absolute chassis-frame points. The inner
pivots, the damper mounts and the ARB drop link stay chassis-fixed and absolute. The wheel centre is
**derived, never stored**:

```text
z_ground = -(chassis_thickness + ride_height)
hub.z    = z_ground + wheel_radius
hub.y    = ±track/2
hub.x    = 0 at the rear axle, wheelbase at the front
```

`axles.<axle>.tyre_radius` is an input again (displayed and edited as diameter `2r`); the previous
slice's read-only inferred diameter was correct only while the wheel centre was pinned to the chassis.
The adapter composes `outboard = hub + offset` at one boundary and physics keeps consuming absolute
coordinates, so no equation changes. Consequences: a ride-height rise moves the hub and every outboard
point down in the chassis frame and leaves the inner pivots byte-identical, so the arms rotate and the
front-view outputs change by the geometry rather than by +1 mm; a larger wheel raises the hub and its
outboard points. `schema_version` becomes **1.2.0**; 1.1 documents migrate by `offset = outboard − wc`,
dropping the stored `wc` and storing the radius explicitly, and round-trip to the same absolute
geometry. Forecloses: editing a wheel centre directly (edit the radius, track, wheelbase, thickness or
ride height), and a separate wheel-diameter field (the diameter is the display form of the single
stored `tyre_radius`).

**D-26 — CG height is measurable by raised-axle weighing, and the roll moment uses the sprung CG.**
Ruled 2026-11-04. D-14 said no instrument a club racer owns locates a CG; that was too strong. Bob
Wright's *Creating AE B44.2 Model — Part 1 (Measurement)* documents a garage procedure that does:
weigh the assembled car level on four scales, raise one end by a known height with the scales still
under every wheel, and re-weigh the axle opposite the raised end several times. The route is now
called **`raise_and_weigh`** and is the preferred route for `body.cg.height`:

```text
θ      = asin(h / L)
h_cg   = (W_raised − W_level) / W_total × (L / tan θ) + r_wheel
```

`W_level` and `W_raised` are the axle **opposite** the raised end, so the difference is positive when
raising the car adds load to that axle. The band is the repeat-reading uncertainty of the two
weighings, combined in quadrature:
`±tol × √2 × (L / tan θ) / W_total`; the reference tolerance is ±5 g, and a 5 g error on one reading
moves the height by `5 / W_total × L / tan θ` (2.237 mm on the L = 280 mm, W = 1600 g example).
Route priority is **measured `raise_and_weigh` → component-mass estimate → stated 28.0 mm default**;
the card names which route produced the number.

**The CG remains stored in the chassis frame.** `body.cg.height` is the CG's stored `z`, and the
height above the ground is derived exactly like the hub:
`cg_above_ground = cg.z − z_ground`, with `z_ground = −(thickness + ride_height)`. Raising ride
height moves the chassis and the CG up relative to the ground; the hardpoints and the CG keep their
chassis-frame values. The measured procedure fills that stored `z`; it is not re-derived from the
current ride height on every solve.

**The roll moment uses the sprung CG, never the whole-car CG.** The measured/estimated `h` is the
whole-car CG, which includes the wheels and uprights. The moment arm is
`sprung CG above ground − roll-axis height`, where
`h_s = (m·h − m_u·h_u) / m_s` (physics/06 (6.1)) and `h_ra` is interpolated between the front and
rear roll-centre heights at the CG's longitudinal position. `M = m_s · a_y · (h_s − h_ra)`, and Bob's
**chassis roll sensitivity** is `M / (k_φ,f + k_φ,r)` in degrees per g. Where unsprung masses are
absent the app keeps fields.yaml's 120 g/axle estimate, says so, and widens the band rather than
silently treating the whole-car CG as sprung.

Forecloses the blanket claim that a CG can never be measured (D-14's "never `measured`" sentence is
superseded for this route; the component and default routes stay `inferred`), and forecloses using a
whole-car CG directly in the roll moment.

## Proposals awaiting a decision

- **Setup-sheet library with a change interpreter.** Compare not only two setups but a *sequence*
  of saved sheets, and report for the items that changed: predicted direction of understeer /
  oversteer at entry, mid and exit; movement of roll centre and camber gain; and the driving
  quantity behind each call. Dave's idea, 2026-10-30. Design questions in issue #10.
- **Chassis material and thickness.** Carbon / aluminium / steel, with thickness, feeding mass,
  CG height and torsional stiffness. Dave's idea, 2026-10-30. Scope questions in issue #11.
