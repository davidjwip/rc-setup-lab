# Round 1 reconciliation — where the independent drafts disagree

Five agents worked blind of each other: requirements, physics, visual design, UX flows,
architecture. Their documents contradict each other in eight places. This file records each
conflict, the decision taken, the reason, and what it costs to reverse. Anything marked
**OWNER** is Dave's call and is escalated rather than decided.

Status: decisions below are provisional until the review round lands and Dave signs the spec.

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

## D-07 Two pure packages or one — decided: **two**

`setup_physics` (no Flutter, no JSON, no I/O) and `setup_data` (document model, schema,
migrations, the single unit-conversion site). Two pubspecs make the "no Flutter" wall a build
error rather than a review note, and make schema-migration tests fast.

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
2. **Mac access for iOS builds.** A used Mac mini, or macOS CI minutes per release. Android can
   ship without either.
3. **Validation depth before first release.** Does a number need bench evidence (L2) before v1
   ships, or does the app launch with an explicit "computed, not yet validated" chip? This is
   open question 1 in `docs/specs/physics/99-validation.md` and it changes both schedule and
   marketing.
4. **v1 depth.** Geometry + balance + static damping ratio, with the motor dyno deferred — the
   requirements spec recommends it; confirmation needed because it is a public-scope decision.
