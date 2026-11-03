> **Historical record — round 1.** This file documents how the round-1 design conflicts were
> resolved *for a Flutter app*. **D-19 superseded the stack**: the project is a React + TypeScript
> PWA, and where this file says "Flutter", "pubspec", `flutter analyze` or `dart run`, read the
> web equivalents in `docs/specs/architecture.md`. The *reasoning* below still stands; the
> mechanism names do not.

# Round 1 reconciliation — where the independent drafts disagree

Five agents worked blind of each other: requirements, physics, visual design, UX flows,
architecture. Their documents contradict each other in eight places. This file records each
conflict, the decision taken, the reason, and what it costs to reverse. Anything marked
**OWNER** is Dave's call and is escalated rather than decided.

Status: D-01 to D-04, D-11 and D-12 are **applied** in the round-1 revision (30 Oct 2026). D-06 and
the Apple/Mac questions remain open. The three owner decisions of 30 Oct 2026 are canonical in
`docs/decisions.md` as **D-13 to D-15**; this file records where each one landed in the design, and
what the design still disagrees with.

---

## D-01 Navigation: three tabs or four? — decided: **three**

- **Flows** (`docs/design/flows.md` §2): Garage · Compare · Learn, each with its own back stack.
- **Wireframes** (`wireframes/*.html`) and **architecture** (`docs/specs/architecture.md`): four
  branches, adding a **Setup** tab.
- **Decision: three.** A Setup destination has no subject until a car is chosen, which
  reintroduces "which car is this tab showing?" — the exact ambiguity the third tab was meant to
  remove. Setup is a push from the car, not a place.
- **Cost to reverse:** one extra `StatefulShellRoute` branch and no screen changes. If the first
  usability test shows people hunting for "Setup", add it and keep the tab's state pinned to the
  last-opened car.
- **Consequence for architecture:** the architecture doc's four-branch sketch must be read as
  three branches plus the `/car/:id/setup` route inside the Garage branch.

## D-02 "Show the maths": bottom sheet or inline? — decided: **inline disclosure**

- **Screens** (`screens.md`): a "Why" bottom sheet.
- **Design** (`wireframes/analysis.html`, `design-system.md` §10): an inline "Show the maths"
  disclosure inside each property card.
- **Decision: inline**, with the sheet reserved for content that needs the full width (worked
  example with a diagram). On a 390-wide screen a sheet covers the number the user is asking
  about; the inline panel leaves the card, the value and the equation visible together.
- **Cost to reverse:** the sheet already exists as a component for other uses; switching a card
  to open it is a one-line change per card.

## D-03 Compare: consequences first, or "what changed" first? — decided: **consequences first**

- **Screens**: Consequences → What you changed. **Wireframes**: What changed → consequences.
- **Decision: consequences first**, because that is the promise of the app ("what did that shim
  actually do"). The change list stays, collapsed, directly under the compare header — one tap
  away, not one scroll away.
- **Cost to reverse:** reorder two sections.

## D-04 Delta chips: one per card, or one per value? — decided: **one per value**

- Screens assumed a single chip per analysis card; the cards carry a front and a rear value.
- **Decision: one chip per value.** A single chip forces the reader to guess which end it refers
  to, and front/rear asymmetry is exactly what the screen exists to reveal.

## D-05 Display units — decided: **per-car preference, metric default**

- The design wireframes show lb/in (the sample car's owner buys springs that way); screens.md
  headlines N/mm. Both are right, for different users.
- **Decision:** display units are a per-car preference stored in the document. Metric (N/mm,
  kg/mm, mm, °) is the default because that is what the chassis most of our users race are
  specified in; imperial is offered and tested. The physics package never sees either — SI only.

## D-06 Gate command — **OWNER**

- `AGENTS.md` and Dave's convention: `cd app && flutter analyze` and `cd app && flutter test`.
- **Architecture**: a single `dart run tool/gate.dart`, because those two commands cannot see
  three packages in a pub workspace.
- **Recommendation:** adopt `dart run tool/gate.dart` as the published gate, and have it run
  exactly the two commands per package plus the schema checks. One command per check is the
  convention's point; three packages is a new fact the convention did not anticipate.
- **Cost of getting it wrong:** a gate that silently skips a package, i.e. green CI over
  untested physics. This one is worth Dave's explicit yes.

> **Superseded in form by D-19 (2026-10-31).** The debate above is kept as the record of *why*
> one command exists. The command is now `npm run gate` (typecheck + unit + schema/field drift),
> and the platforms it replaces — `flutter analyze`, `flutter test`, `dart run tool/gate.dart` —
> are gone with the stack. The argument transfers unchanged: three workspaces, two of which an
> app-scoped command cannot see.

## D-07 Two pure packages or one — decided: **two**

`setup_physics` (no Flutter, no JSON, no I/O) and `setup_data` (document model, schema,
migrations, the single unit-conversion site). Two pubspecs make the "no Flutter" wall a build
error rather than a review note, and make schema-migration tests fast.

> **Still decided, differently enforced (D-19).** The two packages are now `packages/physics` and
> `packages/data` in an npm workspace, and the wall is *stronger* than a pubspec assertion: the
> physics package's `tsconfig.json` omits the `DOM` lib, so a browser API is a compile error. The
> reasoning below the fold — no UI in the maths, fast migration tests — is unchanged.

## D-08 The wireframe's camber-gain figure is suspect — **open, verify before quoting**

The analysis wireframe's illustrative chain (1.571 mm of wheel travel per degree of roll ×
0.395 °/mm) lands at 3.95 °/10 mm, which is high for a 1/10 touring car. The arithmetic is
self-consistent; the *value* has not been checked against a measured chassis. Until it is, the
wireframe is marked illustrative and no number from it goes into a store listing or the README.

---

## Escalated to Dave (beyond the gate command)

1. **Apple enrolment: individual or organisation.** Individual is immediate and puts a personal
   name on the listing; organisation needs a D-U-N-S number and weeks, and the choice cannot be
   retrofitted to the same account. This decides whether the store shows "Setup Lab" or
   "Dave Ip" as the seller.
2. **Mac access for iOS builds.** ~~A used Mac mini, or macOS CI minutes per release. Android can
   ship without either.~~ **Closed by D-19:** iOS is served by the same URL as Android, so no Mac is
   needed for any build.
3. **Validation depth before first release.** Does a number need bench evidence (L2) before v1
   ships, or does the app launch with an explicit "computed, not yet validated" chip? This is
   open question 1 in `docs/specs/physics/99-validation.md` and it changes both schedule and
   marketing.
4. **v1 depth.** Geometry + balance + static damping ratio, with the motor dyno deferred — the
   requirements spec recommends it; confirmation needed because it is a public-scope decision.

---

## Applied in the round-1 revision (30 Oct 2026)

| Decision | How it landed |
|---|---|
| D-01 three destinations | Every wireframe now draws **Garage · Compare · Learn**; setup, analysis, chassis, sheets and export are pushes inside Garage. `design-system.md` §10.2, `flows.md` §2.1, and the architecture's four-branch sketch read as three branches plus `/car/:carId/*`. |
| D-02 maths inline | Unchanged, and now also carries the validation footer (every expanded card ends with *Computed, not yet validated*). |
| D-03 consequences first | `compare.html` reordered: the "what this does" block sits under the slot cards, "what you changed" is a collapsed list one tap below. |
| D-04 one chip per value | Held everywhere, including the new sheet-diff rows. |
| D-11 validation state | A second mark on every number (§10.14): hollow ring = `computed, not yet validated`, filled = `validated · bench`. v1 ships entirely hollow; the words appear once per surface and on every export. |
| D-12 v1 contents | Damping ratio is designed as an estimate with a band and a direction-led card, and degrades to `missing` with no damper data. Geometry and balance are unaffected by that choice. |

## D-13 to D-15 — owner decisions, 30 Oct 2026

Canonical text: `docs/decisions.md`. This is where each one landed in the design.

**D-13 — damping ratio is an estimate, and the trend is the product.** The card leads with the
**direction** of change between sheets ("heavier oil → more damping at the wheel", "shock laid down →
less"), shows `~ζ ± band` with the `estimated` badge and the damper model's own range, and carries a
*What changes this* panel (oil, piston holes, spring rate, shock angle). No damper data → `missing`,
panel retained, nothing manufactured from a spring rate. Applied in `analysis.html`,
`design-system.md` §10.18, `screens.md` §14, `sheet-diff.html` (the rear-oil row is a direction
claim, not a magnitude).

**D-14 — CG height is inferred, never measured.** Two routes, both first-class: a **component-mass
estimate** and a **two-hang plumb-line** procedure. The route is the headline, the badge follows the
route (`estimated` either way; `inherited` if it came from another car), and CG height **never**
carries `computed`. The card states what is robust to h (the front/rear balance split) against what
is not (absolute load transfer, roll angle). Applied in `hardpoints.html` (Mass & CG card),
`analysis.html` (load-transfer caveat), `design-system.md` §10.19, `screens.md` §26, `flows.md`
§3.1 and §15.

**D-15 — interpreter vocabulary and inputs.** Understeer / oversteer, phases entry / mid / exit; sheets
record optional conditions (surface carpet / asphalt / other, temperature, humidity, free text for
tyres and motor) and a diff spanning different conditions says so loudly, before any claim; **grip is
inference**, never measured or computed, with its own tier treatment and no numeral. Applied in
`sheet-diff.html`, `sheets.html`, `design-system.md` §10.17, `screens.md` §27–28, `flows.md` §11.

## Round-1 design findings — closed

| Finding | Closed by |
|---|---|
| **E1** template defaults on a new setup | A new sheet starts empty: `setup-editor.html`'s "New sheet (empty)" state, `screens.md` §12–13, `flows.md` §7. Every frame that shows numbers is labelled *Example data* inside the frame. |
| **E2** blanket ±15% tolerance | Deleted. A tolerance prints only when the source record stores one; otherwise `~` alone. `design-system.md` §9, `screens.md` §0.2, `flows.md` §6.4, `glossary.md`. |
| **E3** library values rendered as solid numerals | Fifth badge `inherited`, with the source named on the row; demonstrated on the hardpoint (C), the setup row (rear bar), the compare row (motion ratio) and the analysis roll-centre card. |
| **P-02** no validation state on screen | The ring plus the per-surface words, on analysis cards, property detail, compare rows, maths panels, sheet diff and the exported sheet. |
| **#10** sheet library + diff | New wireframes `sheets.html`, `sheet-diff.html`; screens §27–28; the tiered interpreter panel with the three tiers and the *all else equal* rule. |
| **#11** chassis card | New chassis card on the car-model screen (Chassis tab) plus a Mass & CG card; screens §25–26. |

## Where the design and the (revised) requirements still disagree

1. **ζ is per corner × two shaft speeds (E3.6a), the card is front/rear (D-04).** The design shows
   front and rear at 5 mm/s with a speed segmented control, and lists all four corners at both speeds
   in the card's detail. A mirrored car then reads four equal values, which is honest but redundant;
   a genuinely asymmetric car needs the table. If the acceptance criterion checks "four corners
   displayed", the card has to grow a four-column variant — a layout change, not a data change.
2. **Eight source types, five badges.** `spec.md` §4.1.4 stores `measured`, `estimated`,
   `manufacturer`, `third_party`, `library`, `derived`, `inferred`, `unattributed`. The design renders
   five badges and maps them in `screens.md` §0.4, with `inferred` becoming `estimated` + a mandatory
   route chip. The mapping is design-side only; no requirement references it, so nothing stops a
   developer inventing a sixth badge. It needs to be cited from `spec.md` or it will drift.
3. **`not_validatable` is a third validity state the requirements do not name.** D-11 and E3.6c
   together imply it (ζ is inferred and may never be validated), but no AC mentions a state meaning
   "cannot be validated". As written, a literal implementation marks ζ "computed, not yet validated",
   which is worse than saying nothing — it promises a validation that will never come.
4. **`sheet` vs `setup`.** Issue #10 and the interface say *sheet*; `spec.md` §4.3 and every route say
   *setup*. The design keeps `setup` in routes and schema and `sheet` on screen; one of them should be
   renamed before implementation, or the mapping written down in the spec.
5. **The interpreter has no rule table yet.** `docs/specs/interpreter.md` is still missing;
   `interpreter-owner-answers.md` fixes the vocabulary, the conditions rule and the grip rule, but not
   the per-rule tier assignments. The panel is designed to a shape that table has to fill — until it
   exists, "Firm" is a promise rather than a list.
6. **"No conditions recorded" is designed as its own state; E4.9 only defines a warning when
   conditions *differ*.** If absent conditions fall through as "no warning", a diff between two
   unlabelled sheets will read as comparable, which contradicts D-15's "say so loudly". Either E4.9
   gains the third state or the design's third banner is unsupported.
7. **CG's two routes exist in the spec; the UI needs the derived *band* per route.** `spec.md` §4.2.1
   now carries `inferred` with `method: two_hang_plumb_line` and a computed band, which matches the
   card. What is still unspecified is the component-mass route's default part list — the card prints
   a band (±8 mm in the example) that must come from somewhere normative.
