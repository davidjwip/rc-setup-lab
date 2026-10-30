# Architecture — Setup Lab

Status: revised after round 1. Decisions applied: **D-09** (one gate command), **D-10** (Android v1,
iOS deferred), **D-11** (honest validity chip), **D-12** (v1 = geometry + balance; damping ratio
contested, §8), **D-01** (three navigation destinations), **R-1** (ISO 8855 frame), **R-2** (mm/g/deg
on disk, one conversion site).
Companions: `docs/intent.md`, `docs/specs/spec.md`, `docs/specs/physics/00`–`99`,
`docs/design/flows.md`. Toolchain: Flutter 3.47.9 / Dart 3.13.7 (Oct 2026).

## Precedence, stated once

The old draft said "the spec wins where they disagree", and by its own rule selected the coordinate
frame that every physics equation contradicts (B1). Precedence is therefore per subject:

| Subject | Authority | Why |
|---|---|---|
| Frame, sign conventions, the result type, the reason vocabulary, tolerances | `physics/01` §2, `physics/00` §4 | eleven equations in modules 2–6 were derived in that frame and against that vocabulary; re-deriving them to satisfy a prose sentence is the expensive direction |
| Document model — kinds, field semantics, units on disk, provenance, hash | `spec.md` §4 with R-1/R-2 | it is the public file interface, and it is what a reviewer tests |
| Package layout, gate, presentation boundary, release path | this document | nobody else specifies them |

*Cost of being wrong:* physics outranks a requirements sentence here, so a requirements edit that
flips y can produce documents this build refuses to load. That is deliberate — the loader names the
mismatch (§5) instead of reinterpreting signs, because silent reinterpretation is the same failure
class as the 0.2 mm-per-save bug, one order of magnitude worse.

## Thesis

**The solver is pure Dart**: SI in, SI out, no JSON, no widgets. **The on-disk document is the
truth, never regenerated from computed values**: solving is one-way, document → SI → result. **The
UI renders solved scenes and formatted numbers**: no trigonometry in a widget, and no widget ever
receives a bare number for a computed value.

The failure modes this is built against are the predecessor's: a 2019 poster reported every save
shaving 0.2 mm off rear track width, cumulatively; another lost shock mounting positions by zooming
(`docs/research/forum/rctech-thread.md`). Both are state-boundary bugs, not maths bugs. Round 1 found
three of the same class *inside the drafts*: storage units specified three ways, two coordinate
frames, and three result shapes. This revision gives each of those facts exactly one owner — §4 for
the document, §5 for frame and units, §7 for the result type.

## 1. Repository and package layout

```
app/
├── pubspec.yaml, .flutter-version   # workspace root = app package; pinned toolchain
├── lib/main.dart, lib/app.dart      # MaterialApp.router, theme, text scaling
├── lib/src/{router,state}/          # route tree and shell; every Riverpod provider
├── lib/src/features/                # garage / setup / analysis / compare / learn / settings
├── lib/src/{units,io,widgets}/      # format+parse; DocumentStore / share / pick; chart wrappers
├── assets/models/                   # bundled chassis JSON (CC BY 4.0)
├── test/                            # widget, golden-image, semantics tests
├── tool/gate.dart                   # the single gate command (§10)
└── packages/
    ├── setup_physics/               # pure Dart, SI only
    │   └── lib/src/{geometry,axle,vehicle,result,evidence}, test/
    └── setup_data/                  # pure Dart, no I/O
        └── lib/src/{document,schema,migrate,hash,adapter}, test/
```

`lib/src/features/` follows *screens*, not the navigation tree: the setup sheet and the analysis
screen are shipped as `features/setup/` and `features/analysis/` and are *routed* inside the Garage
branch (§3). Directory layout and route ownership are separate decisions and should not be made to
agree.

| Package | Depends on | Never imports | Enforced by |
|---|---|---|---|
| `setup_physics` | `meta` | Flutter, `dart:io`, `dart:ui`, `setup_data` | pubspec test |
| `setup_data` | `setup_physics` | Flutter, `dart:io`, `dart:ui` | same |
| app | both | — | — |

**Why three (D-07).** Physics must be JSON-free or it becomes untestable headless and grows
compatibility shims; data must be Flutter-free because its migration tests churn most, and because
"no Flutter" as a build error is stronger than "no Flutter" as a review note.

**The dependency points one way: app → `setup_data` → `setup_physics`.** `setup_data` depends on
physics because the adapter's output *is* a physics input struct. The consequence is load-bearing:
the physics package cannot name a document field, so a missing-input report travels as a physics
`FieldRef` and `setup_data` owns the ref → document-path table the UI renders (§4.4). The reverse
edge would put document ids and schema versions inside the solver.

**One resolution.** All three are pub workspace members: one lockfile, one `pub get`. `dart analyze`
from the workspace root reports errors inside `packages/setup_physics`; whether `flutter test` walks
members' `test/` trees is unproven, and §10 makes it moot rather than depending on it.

**Models are validated assets:** a test walks `assets/models/*.json` through the schema manifest and
fails on any measurement without a resolvable `source`.

*Cost:* a physics change touches two pubspecs, and a document-model change touches one that a
physics contributor may not have opened. *Revisit:* if `adapter/` stays under ~300 lines after v1,
fold `setup_data` into the app — but not before, because the migration fixtures are the tests that
would be lost first.

## 2. State management

**Pick: Riverpod 3 (`flutter_riverpod` 3.4.x), hand-written providers, no codegen.**

The load-bearing requirement is the drag path: users asked for a weight-distribution slider to see
what moving a few grams would do, so one gesture produces 60–120 document mutations a second, each
needing a re-solve and repaint.

| | Rebuild granularity | Boilerplate/feature | Testing without widgets | Drag-path cost |
|---|---|---|---|---|
| **Riverpod 3** | per provider; `select` to a leaf | low; top-level finals | `ProviderContainer`, pure Dart | one derive per frame, N readers |
| Bloc 9 | per state object | high: event + state + mapper | `blocTest`, but coarse | stream hop per mutation |
| ChangeNotifier | per notifier scope | lowest at first | `pumpWidget` or manual wiring | wakes every dependent |

Riverpod wins on a `solutionProvider` *derived* from the draft document, plus
`ref.watch(x.select(...))` so a roll-centre readout does not rebuild when a spring rate changes. The
provider's payload is the per-field struct of §7, not a bag of doubles: a `select` returns one
`Solved<double>`, and the `Solved` → `PropertyView` mapping (§8) happens in a provider so `build()`
never formats. DI is free: `DocumentStore` is a provider override in tests, no `BuildContext`.

**Containment is the risk control:** Riverpod types appear only under `lib/src/state/`. **Coalesce,
never debounce:** mutations land immediately, a `Ticker` marks the solve dirty once per frame, only
the newest value is solved — debounce would show stale numbers.

*Cost:* the provider graph is the least obvious of the three to a generalist, and a per-field result
struct makes each provider's value type wider than a `double`. *Revisit:* if a feature needs real
async streams (BLE timing, lap timer) — Bloc's home turf.

## 3. Routing and information architecture

**Pick: `go_router` 18.x, `StatefulShellRoute.indexedStack`, three branches — Garage, Compare,
Learn (D-01).**

Three, not four. A **Setup** destination has no subject until a car is chosen, so it opens either on
a picker or on the last car used, and the user has to hold "which car is this tab showing?" — the
exact ambiguity the third destination was meant to remove. Setup is a push from the car, not a
place. The wireframes' four-item bar is redrawn to three; that is a design task, not a code one.

| Route | Branch | Screen |
|---|---|---|
| `/garage`, `/garage/new`, `/garage/import` | Garage | car list, new model, import |
| `/garage/car/:carId` (+ `/edit`, `/geometry`, `/geometry/wizard/:groupId`) | Garage | car detail, geometry editor, measurement wizard |
| `/garage/car/:carId/setups`, `…/setup/:setupId` | Garage | setup list, setup sheet |
| `…/setup/:setupId/analysis`, `…/analysis/:propertyId` | Garage | analysis, per-property detail |
| `/compare?a=&b=`, `/compare/pick/:slot` | Compare | side-by-side, slot picker |
| `/learn/path`, `/learn/:conceptId` | Learn | learning path, concept |
| `/welcome`, `/settings/**` | above the shell | no bottom bar |

**The car routes moved under their branch** (`/car/…` → `/garage/car/…`). A deep link should name
the branch it lands in, or the router has to infer one. Cost: every link changes once, before v1
ships, which is free; after v1 it is a broken-link migration with an install history behind it.

`indexedStack` keeps each branch's stack alive, so switching tabs mid-edit returns you where you
were. **Android back** pops within the branch; at a branch root it returns to Garage; at Garage's
root it exits. That is an explicit `PopScope` rule, not a default. **No `canPop: false`, no "discard
changes?" dialog:** every edit autosaves within 500 ms, so there is nothing to guard. That
constraint is held now, for the deferred iOS build (§11), because it costs one rule today and
retrofitting a save model behind a navigation guard is a rewrite of every edit path.

### 3.1 Deep-link contract

- `/garage/car/:carId/setup/:setupId/analysis` and `/learn/:conceptId?car=&setup=&from=` are the
  shareable strings; a future URI scheme reuses them unchanged.
- **`?from=` is origin only.** Values: `analysis`, `compare`, `garage`. It selects the post-back
  treatment (highlight the originating card for 1.5 s) and never changes what is loaded. An unknown
  `from` is ignored, not guessed at; because the ids travel beside it, an origin that no longer
  exists degrades to "no highlight", never to an error.
- **`?returnTo=analysis`** on the measurement detour (missing-input row → wizard → back). This is the
  one place a return target is mandatory: the user must not be stranded in a wizard after a
  twenty-second fix.
- A link naming a car that is not on the device opens Garage with a one-line notice ("That car isn't
  on this device"), not an error screen.
- A link into Compare or Learn that needs a car and setup **switches branch first** and then pushes,
  so one `pop` never strands the user in an empty branch. That is the only branch-switch the router
  performs on its own.

*Cost:* Compare and Learn are one tap from anywhere, but Setup is two taps from the Garage root (car
→ setup) and, after a tab switch, analysis is reachable only through its car. That is the price of
removing "which car is this tab showing", and it should be tested in the first usability session
rather than argued. *Revisit (D-01's cost):* if people hunt for "Setup", add the fourth branch — one
`StatefulShellRoute` entry, no screen changes, plus the "no car yet" empty state.

## 4. Persistence and the document model

**Pick: one versioned JSON file per document, written atomically, under
`getApplicationSupportDirectory()/setuplab/`.**

```
setuplab/
├── models/<model_id>/<content_hash>.json   # immutable revisions (spec §4.1.6)
├── models/<model_id>/current               # one line: the live hash
├── setups/<setup_id>.json                  # references (model_id, content_hash)
├── quarantine/                             # unreadable files, moved not deleted (E8.15)
└── .trash/
```

Model revisions are immutable and setups address one by hash, so editing a model cannot silently
change what a saved setup meant (E2.7). The filename drops the `sha256:` prefix, which some
filesystems reject. `current` is a pointer, not a copy; if it is lost, the library rebuilds it by
scanning the directory. `quarantine/` exists because a corrupt file must not take the library with
it: at launch an unreadable document is moved there, named once with its path, and the rest opens
normally (E8.15).

`getApplicationSupportDirectory()` is app-private on every target (`files/` on Android, Application
Support on iOS): not Downloads, not external storage — the files are app-managed, invisible to the
media scanner, and removed with the app unless the user exports them. Export is therefore the
sharing path, which is the design, not a limitation. Choosing this API is also what keeps the
deferred iOS build free: same call, same layout, no conditional code.

Writes are atomic — `*.json.tmp`, flush, rename — because a partial write on a phone that dies at the
track is a lost car model. The test for it is a kill *between* the temp write and the rename, per
document kind (E8.12): the previous revision must still be readable and the half-written file must
never be offered as valid.

**Why not drift / Isar / sqflite.** Three queries over a few small files. A database adds a second
migration language, codegen, platform channels and all-or-nothing corruption, and turns a community
contribution from a readable diff into a binary. Models are data and must outlive the app: RC3's
library died inside a proprietary engine.

*Cost:* listing means parsing files. A startup-built in-memory index covers it, and deliberately no
index *file* — a second source of truth is a consistency bug. *Revisit:* P-05 (open a model, ≤300 ms)
or P-06 (200 models scrolling at 60 fps) missed on the reference device, or full-text search over
setup notes.

### 4.1 The on-disk shape

```json
{ "schema_version": "1.0.0", "kind": "car_model", "id": "mdl_8f2c41",
  "frame": { "standard": "ISO 8855", "axes": "x forward, y left, z up",
             "origin": "ground plane, rear axle centre, vehicle centreline" },
  "units": { "length": "mm", "angle": "deg", "mass": "g", "spring_rate": "N/mm" },
  "sources": { "s1": { "type": "measured", "method": "digital caliper", "by": "DW" } },
  "axles": { "front": { "corners": { "left": { "lower_arm":
      { "outboard": { "v": [0.0, 80.0, 10.5], "s": "s1" } } } } } } }
```

- **`frame` and `units` are declared and checked on load** (§5). A file that declares a different
  frame or unit system is refused with the mismatch named, never rescaled or reinterpreted.
- **Every value is `{"v": number, "s": sourceId}`**, resolving into the document's `sources` map; a
  whole caliper session is one source (§4.1.2). `x_`-prefixed keys we do not understand are preserved
  and written back. A greater `schema_version` **major** is refused with a plain message, never parsed
  best-effort — silent degradation is how the 0.2 mm bug happened.
- **Export** via `share_plus` 13.x shares the file itself (email, Drive, Files). **Import** via
  `file_picker` 13.x plus OS file-open handling so tapping a model in a file manager or mail client
  opens the app (an `<intent-filter>` for `*.model.json` / `*.setup.json` on Android; the plist
  equivalent is deferred with the rest of iOS, §11 — `kind` already tells the two kinds apart).
- **The interface is bytes, not paths**: web has no paths and Linux has no share sheet, and keeping
  paths out now is what makes §12 cheap. Import never merges — an id collision gets a new id, the
  file's own `sources` travel with it, and the UI previews what will be added.

### 4.2 Who owns what

| Concern | Lives in | Rule |
|---|---|---|
| Schema: field paths, types, units, required-ness, `on_absence`, `plausible`, `consumed_by` | normative in `docs/specs/fields.yaml`; consumed from `setup_data/lib/src/schema/generated/` | one YAML is the source (E9.10); the Dart table is generated from it and checked in; the validator interprets the generated table, and no schema logic lives in the app |
| Migrations and their fixtures | `setup_data/lib/src/migrate/`, `setup_data/test/fixtures/` | one step per version pair; fixtures are bytes on disk, never regenerated |
| Canonical form and `content_hash` | `setup_data/lib/src/hash/` | RFC 8785 (JCS) + SHA-256, `meta` excluded (spec §4.5); nothing else in the repo hashes a document |
| mm/g/deg ↔ SI | `setup_data/lib/src/adapter/units.dart` | the single conversion site (§5) |
| Physics result type, reasons, flags | `setup_physics/lib/src/result/` | specified in `physics/00` §4; imported by the app, never re-declared (§7) |
| Golden-case inventory per output | `setup_physics/lib/src/evidence/` | a property of the build, checked against the golden files (E3.11) |
| Number → string | `app/lib/src/units/` | the only formatter; features may not format (§8) |
| Bytes on disk | `app/lib/src/io/` | `DocumentStore`; the pure packages take and return `String`/`Map` |

**Schema.** `docs/specs/fields.yaml` is normative and machine-readable (E9.10): each field appears
once with `type`, `unit`, `req`, `on_absence ∈ {ASSUME, REFUSE, OMIT}`, an `assume` value where the
policy is `ASSUME`, `plausible` and `consumed_by`. Three views are generated from it and the gate's
schema stage proves they still agree: the Markdown tables in the requirements, the Dart table the
validator reads, and the fixture set. This replaces a hand-written manifest, and the reason is B9 —
five required inputs existed in prose and in no schema, so modules 5 and 7 could not be called with a
document that validated. One YAML, one generator, one gate stage. *Cost:* a codegen step
(`tool/gen_schema.dart`, output checked in, gate fails when stale), and a contributor who edits the
generated Dart by hand fails the gate rather than shipping a quiet divergence — which is the intended
failure.

**Migrations.** One function per (kind, from → to), byte fixtures on both sides, forward only. The
loader migrates in memory and writes nothing; a refused file leaves no partial data (E6.6). *Cost:*
every schema change carries a fixture pair forever, and a fixture is never deleted, only added.

**Hash.** Canonicalisation is `hash/canonical.dart`, and it implements **RFC 8785 JSON
Canonicalisation** rather than a private set of rules: keys sorted by UTF-16 code unit, no
insignificant whitespace, ES6 number formatting (which normalises `-0.0` and refuses `NaN`/`Infinity`
by construction), `meta` excluded, `x_` keys included. The spec pins the reference and publishes
fixtures (§4.5), which is what makes two installs agree. D3 is why it has one owner: divergent hashes
break E1.7, E2.1, E2.7 and E7.1 at once and the failure is invisible until two users exchange files.
*Cost:* RFC 8785's number formatting is stricter than Dart's `toString()` for some doubles, so the
formatter is hand-written and fixture-tested; including `x_` means a foreign tool that adds an
extension key creates a new revision, which is the honest outcome — the meaning may have changed — and
the UI names the new revision.

**No file access in the pure packages.** `setup_data` validates, migrates and hashes strings and
maps; the app owns bytes. That is what lets the same migration code serve a web build later with no
platform channel, and it is why `dart:io` is a build error rather than a convention.

## 5. Frame, units and the single conversion site

### 5.1 The frame — ISO 8855 (R-1)

**x forward, y left, z up; origin on the ground plane (flat plate) at the rear axle centre, on the
vehicle centreline.** Left corner positive y, right corner negative y; roll positive with the left
side up.

Four consequences, each of which the old draft left open:

- **Mirroring negates y and nothing else.** Wheelbase is the front axle's x, because the rear axle
  sits at x = 0 — which is what modules 3 and 6 assume when they hard-code contact-patch x to `l`
  and `0` and interpolate the roll axis from the rear axle.
- **Camber and toe are per-wheel signed**: positive camber = top outboard, positive toe = toe-in.
  Both are negated when a corner is mirrored; module 2's `γ_kp` must therefore be evaluated per side
  (`atan2(s·Δy, Δz)` with the side sign `s`) rather than in the global frame. Without this, κ changes
  sign between the left and right corner and the outer wheel's camber behaviour is reported 40% wrong
  on the corner that matters (B3).
- **Quantities that belong to the car are frame-free and never signed per side**: roll-centre height,
  load transfer, balance, roll stiffness.
- **The requirements' §4.2 example flips sign in y.** With y-left the left corner is +y; every y in
  that block of `spec.md` has the opposite sign from what R-1 requires (reported as a disagreement
  for R2-B, not silently corrected here).

*Why this frame and not the requirements'* (y right, mid-wheelbase origin): eleven equations in
modules 2, 3, 4 and 6 were derived in it and the published references use it, so adopting the other
one costs four re-derivations plus a sign table in each — and buys a convention nothing else in the
project uses. *Cost of being wrong:* every hand-entered hardpoint is one sign away from a mirrored car
that still computes plausible numbers. Three mitigations, all cheap: the loader refuses a `frame`
block that disagrees instead of reinterpreting it; `symmetry: true` already requires the right corner
to equal the mirror of the left within 0.01 mm; and a golden case asserts κ_R = −κ_L in the global
frame and equality per-wheel.

### 5.2 Units

| Quantity | On disk | Inside `setup_physics` | On screen |
|---|---|---|---|
| Length | mm | m | mm, 1 dp |
| Mass | g | kg | g |
| Spring rate | N/mm | N/m | N/mm |
| Damper force / shaft speed | N, mm/s | N, m/s | N, mm/s |
| Angle (camber, toe, KPI, caster, roll) | deg | rad | deg |
| Dimensionless (IR, ζ, balance) | – | – | – |
| Roll stiffness (derived) | N·m/deg | N·m/rad | N·m/deg |

Display *precision* is not decided here: `physics/99` §7 is the precision table, and its numbers are
being re-derived from the corrected roll-centre sensitivity (M8). One precision table, in one place.

1. **`setup_physics` takes SI and returns SI; `setup_data` converts; nothing else converts.** One
   function family in `setup_data/lib/src/adapter/units.dart`, called once per solve on the way in and
   once per result on the way out. Not in the solver, not in a widget, not in a fixture.
2. **No unit literal or scale factor inside `setup_physics`.** A test greps
   `packages/setup_physics/lib` for `mm`, `deg`, `N/mm`, `1000`, `1e-3` and fails (tolerance constants
   such as `1e-9` are dimensionless and allowed). Parameter names carry their unit — `lowerArmOuter_m`,
   `camber_rad` — because a signature is the only place a unit can be checked by reading.
3. **Divide by an exact power of ten where the quantity shrinks; multiply by an integer where it
   grows.** `mm / 1000` round-trips 4,994 of 5,001 values on a 0.1 mm grid (worst 2.8e-14 mm);
   `mm * 1e-3` fails 644. Same rule for `mm/s → m/s`; `N/mm → N/m` is `* 1000`.
4. **No computed value is ever written back into a document.** Display rounding is one-way, so files
   only ever contain numbers a human or a caliper produced.
5. **No unit literal in a feature widget**: a test greps `lib/src/features/` for `'mm'`, `' g'`,
   `'deg'` and fails. Formatting goes through `QuantityFormat` in `lib/src/units/`, which is also the
   only place a `double` becomes a `String` (§8).
6. **Display units are a per-car preference stored in the document, metric default (D-05).**
   Imperial (lb/in, oz, °) is a second formatter set, never a second storage form and never a solver
   argument, so switching it is not a migration and cannot change a number. *Cost:* two formatter sets
   to test, and one easy confusion — a display conversion mistaken for the storage conversion. The
   test that catches it is the document-level round trip, not the format test.
7. **A document declaring different units is refused, not rescaled** (§5.1's sibling rule): "this
   build reads mm/g/deg; this file says m/kg/rad".

Round-trip tests at three levels: converter (`mm → m → mm`, 1e-9 relative, plus the 0.1 mm grid
sweep), string (`format(parse(s)) == s` for every string the UI can produce, in both unit sets),
document (reload and re-save is byte-identical; `x_` keys survive a fuzz round trip). The string
level is the one that would have caught 0.2 mm per save; the grid sweep is the one that catches a
`1e-3` literal.

## 6. Charts and geometry drawing

| Need | Tool | Why |
|---|---|---|
| Roll angle vs lateral g, CG height vs g, spring force vs g, LLT split vs roll stiffness, camber vs roll, roll-centre migration | `fl_chart` 1.3.x | 10–200 point series, axes, ticks, tooltips, legends, touch. Reimplementing is a week for a worse result. |
| Suspension elevation: hardpoints, links, instant-centre rays, roll centre, contact patch, roll animation | `CustomPainter` + `InteractiveViewer` | A diagram, not a chart. Pinch-zoom and tap-a-hardpoint are requirements. |

**The rule:** every plot consumes a `Series` value object (label, points, axes, unit, evidence) from a
pure presenter under `features/analysis/presenters/`, tested headlessly; every geometry view consumes
a `GeometryScene` computed by `setup_physics`. A painter that calls `atan2` is a review failure.

**A chart exists only for a computable property.** The presenter returns a `PropertyView` for the
value (§8) and a `Series` only when that view is `ComputedValue`; a `NotMeasuredValue` or
`UndefinedValue` produces no series at all, so there is no chart to draw and no `fl_chart` call to
make. And no chart is written for a property outside the v1 set: the damper curve chart appears if and
only if damping ratio is in the build (§11), so `fl_chart` gains no speculative usage.

At most three files import `fl_chart`, all under `lib/src/widgets/charts/`: single-maintainer package,
history of breaking majors, and a line chart in `CustomPainter` is two days if it dies. It has no log
axis and damper curves want one — transform to `log10` in the presenter. Charts sit behind a
`RepaintBoundary`, animation duration zero during drags.

## 7. One result type, per-field validity

**Pick: one sealed type, `Solved<T>`, defined in `setup_physics`, specified in `physics/00` §4, carrying
value, band, tier and provenance. Three transport states, one reason enum, one flag enum, one
six-value tier enum. A query returns a struct of `Solved` fields — never a `Solved` of a struct.**

```dart
// setup_physics/lib/src/result/solved.dart — shape only; 00 §4 is the specification.
sealed class Solved<T> { const Solved(); Tier get tier; }

final class Defined<T> extends Solved<T> {
  final T value;                  // SI
  final Tier tier;                // computed | estimated | inherited | inferred
  final Band? band;               // required when tier is estimated, null otherwise
  final Basis? basis;             // required when tier is inferred: what the claim rests on
  final Set<Ref> provenance;      // opaque tags for every input consumed (source ids)
  final Set<Flag> flags;          // conditioning, assumed inputs, out-of-domain
}
final class NotMeasured<T> extends Solved<T> {
  final List<FieldRef> missing;   // tier: missing — an input the document does not have
}
final class Undefined<T> extends Solved<T> {
  final UndefinedReason reason;   // tier: undefined — closed enum, defined in 00 §4
  final List<FieldRef> inputs;    // what to show when the user asks "why"
}
```

The contents of `UndefinedReason` and `Flag`, and every tolerance that feeds them, are specified in
`physics/00` §4 and are **not restated here**. Two lists drift, and B6 is what that costs: this
document's old `Solved` against `00`'s `Result`, twenty reason names of which six were canonical, and
a 10⁵ disagreement (1e-2 / 1e-4 against 1e-9) about when the same geometry is trustworthy.

What architecture does own:

- **Six tiers, three states.** The state says *whether* there is a number; the tier says *what kind of
  claim* the number is. `missing` and `undefined` are the two states with no number; `computed`,
  `estimated`, `inherited` and `inferred` are four kinds of number. The display states of requirements
  §4.4.1 / E3.16 are the product of this tier with the evidence axis (§8) — not a third vocabulary
  invented on the way to the screen.
- **Tier is derived, never declared.** A function does not choose `computed`; it reports its inputs'
  tiers and the package takes the weakest of `computed < estimated < inherited < inferred`, with
  `missing` and `undefined` dominating as terminal states. An output built on a borrowed measurement
  must not read as measured, and a hand-declared tier goes stale the moment an input's provenance
  changes. *Cost:* the adapter propagates a tier per input, so `PhysicsInput` fields carry one; the
  order between `inherited` and `inferred` is a judgement call, fixed here so it is argued once rather
  than per module.
- **`band` is carried, not reconstructed at the UI.** An estimated value returns its half-width
  (relative unless an absolute unit is stated) and the screen prints it. The package computes it
  first-order from the input bands where it has the sensitivities and falls back to the widest input
  band, floored at the model's own band — the damper's ±30% on force is the first case. It is an
  estimate of an estimate, not a confidence interval, and the help text says so: that difference is
  exactly where a measurement tool over-claims.
- **`basis` is an id plus its inputs, never English.** An inferred claim — CG height, which no
  corner-scale session can measure — returns `Basis(id: 'inferred.cgFromCornerWeights', inputs: {…})`,
  and the app's string table renders the sentence and appends "all else equal". The physics package is
  Flutter-free, locale-free and copy-free; a sentence inside it would be a translatable string in the
  one package that cannot load the bundle.
- **`provenance` is opaque to physics.** Values arrive wrapped in a tag the adapter assigns from the
  document's `s` ids; the package never interprets it and returns the set it consumed. That keeps the
  dependency direction of §1 intact — physics still cannot name a document field — while letting the
  "how" view (E3.7) show the provenance of every input behind a number.
- **Per field, never per struct.** `frontViewKinematics` returns ten `Solved<double>`. G02.7 is the
  proof: parallel arms leave `z_rc` defined — at ground level — while `y_rc` has no limit
  expression, and E1.2 and E3.8 both require the UI to speak per output. A struct-level verdict would
  force the UI to discard nine good numbers because the tenth is undefined. *Cost:* callers
  destructure more, and a widget that wants "the roll centre" must pick a field and handle its state —
  which is the point.
- **Not re-declared anywhere.** The app imports the type from `setup_physics`; `setup_data` never wraps
  it; there is no `ResultDto`. Tier, reason and flag names persist and travel as *strings*
  (`parallelLinks`, `estimated`), never as enum ordinals, so renaming a Dart case cannot change an
  export or a golden fixture. Within a document major the vocabularies are additive only.
- **Conditioning is a flag.** Whether a defined number is trustworthy is a matter of degree; a seventh
  tier would imply a categorical boundary the physics does not have. One threshold, defined and
  exported by the physics package; the app's "nearly parallel" copy reads that flag and compares
  against nothing of its own. The 1e-2 / 1e-4 numbers this document used to propose are withdrawn.
- **No nullable darts, and the envelope is never partially filled.** No public function returns
  `double?`, `null` or `NaN`. A property test over 10k seeded geometries asserts every `Defined.value`
  is finite, every `estimated` carries a band, every `inferred` carries a basis, every `Undefined`
  names an enum reason, and every `NotMeasured` names at least one field. An estimate without a band
  is the same failure as a number without a unit.

## 8. The "computed, not yet validated" state

**Decision (D-11): every computed property carries an evidence level; in v1 every level is L0 + L1,
and the app says "computed, not yet validated" in the number's own detail panel. Nothing in v1 is
presented as validated.**

**1. Carried through the API.** `EvidenceLevel` (`L0` arithmetic, `L1` identity, `L2` bench, `L3`
correlated — defined in `physics/99` §1) is a constant per property in
`setup_physics/lib/src/evidence/evidence_table.dart`, reachable from the property descriptor a solve
returns. It is not an argument, not a field on `Solved`, and not derived at runtime: a number is not
computed "at L2" — a *property* is at a level, and the level changes only when the build changes.

**2. Not stored.** Evidence level is never written into a document, and computed values are never
stored at all (§5 rule 4). The level describes how far the physics has been checked, which is a
property of the build, not of the user's car. Persisting it would let a setup exported in October
still claim L2 in March after a regression moved the number, and would make every export a stale
claim. *Cost:* an exported setup sheet carries the level as text at export time, stamped with the app
version — so an old PDF is a historical document, which is the honest reading of it anyway.

**3. Displayed, through a type that cannot be a bare number.** The presenter maps
`Solved` + provenance + evidence to one of three values, and that is the only thing a card may
receive:

```dart
sealed class PropertyView {}
final class ComputedValue  extends PropertyView {
  final String formatted;        // already rounded, with its unit
  final Set<Mark> marks;         // assumedInput, estimatedInput, lowConfidence,
                                 // outOfRange, approximate, notYetValidated
  final EvidenceLevel evidence;
}
final class NotMeasuredValue extends PropertyView { final List<String> fields; }   // document paths
final class UndefinedValue   extends PropertyView { final String reason, message; }
```

- A widget that renders a computed number accepts `PropertyView` and nothing else. `lib/src/units/` is
  the only place a `double` becomes a `String`; `presenters/` is the only place a `Solved` becomes a
  `PropertyView`. A grep test bans `toStringAsFixed`, `NumberFormat(` and `$`-interpolation of a double
  under `lib/src/features/`. Why a test and not a review rule: D9's finding is that no acceptance
  criterion required a per-output validation state, so an unvalidated model rendered `9.97` with a
  unit and no caveat. A type plus a grep is what makes E1.2, E1.8, E2.11 and E3.8 true by
  construction instead of by vigilance. *Cost:* every card needs a wrapper, and a quick debug print
  needs a formatter call.
- Marks that come from the *document* — `estimatedInput`, `assumedInput`, `outOfRange` — are computed
  from each value's `source` type and its plausibility flag, not from the physics result, so they
  follow the data through compare, export and reload.
- The chip text and the detail-panel caveat are the two strings `physics/99` §1 mandates; the app does
  not paraphrase them.
- **Compare refuses a delta against an absent value.** Two `ComputedValue`s render a delta; anything
  against `NotMeasuredValue` or `UndefinedValue` renders both states and no delta. A delta against an
  absent value is the easiest way to fabricate a number in this app, and it is banned in the presenter
  rather than in review.

**4. How a level is raised.** One property at a time: a row in `physics/99` §9's results log (date,
car, measured vs computed), then the constant in `evidence_table.dart`, then the chip disappears
everywhere it showed. The check is a review rule, not a test — a machine check would have to parse a
prose table, which is precisely the circular gate D6 identified. *Cost:* a level could be raised in
code with no log row and no test would fail. The mitigation is that the table's doc comment names the
log as its only evidence, and a level change is a one-line diff a reviewer sees.

**5. Degradation, which is the v1 default path rather than an edge case.**

| Situation | State | What the user sees |
|---|---|---|
| An input is absent | `NotMeasured(fields)` | "not measured: rear lower arm, outboard" — the row stays in place (E1.2 requires the row), and the field is one tap from the geometry editor |
| Inputs present, geometry degenerate | `Undefined(reason)` | "undefined for this geometry: parallel links", plus the hardpoints responsible |
| Inputs valid, model outside its stated domain | `Defined` + `outOfRange` | the number *with* the domain caveat (E3.9): a flagged number beats a refusal the user cannot reason about |
| Inputs absent but an assumption is declared (`on_absence: ASSUME`) | `Defined` + `assumedInput` | the value, with the assumption named and its value shown (E1.8, E2.4) |
| Property not in this build | no card | the analysis screen's "what this build computes" note names the gap; a greyed-out card would be an empty promise |

**v1 scope is geometry + balance**: motion ratio, wheel rate, ride frequency, roll stiffness,
load-transfer split, roll-centre height and migration, camber gain and camber at roll, bump steer,
Ackermann, corner weights. **Damping ratio is contested** — D-12 as written puts static ζ in v1,
CONSOLIDATED §3 shows the inputs for it do not exist in the document model (no bar diameter, no
piston area, no hole diameter, no damper curve kind), and the recommended resolution is option 1,
damping out of v1. The architecture is built so either answer is a card that appears or does not: the
property's presence in `evidence_table.dart` is what makes the card, the chart and the help text exist.
*Cost of the wrong call:* ship ζ without its inputs and the app displays a ±30%-wrong number under an
honest chip; cut it and the release loses one headline property and one chart.

## 9. Testing strategy

| Layer | Proves | Volume |
|---|---|---|
| Physics unit (`dart test`) | each formula against a cited hand calc in `docs/specs/physics/` | ≥1 per public function |
| Golden numeric (JSON: input → expected → tolerance → `source`) | no regressions; every expected value traceable | per module + one full vehicle |
| Result type and validity (`dart test`) | every reason code reachable from a fixture; per-field independence (G02.7); `NotMeasured` names ≥1 field; no `null`/`NaN` at any boundary | one fixture per reason code |
| Property/fuzz (seeded) | no `NaN`/`Inf` escapes; every `Undefined` carries an enum reason | 10k cases, <2 s |
| Adapter (`dart test`) | mm/g/deg → SI and back; the 0.1 mm grid sweep; one conversion site | every stored quantity × both directions |
| Document/migration (`dart test`) | assets validate; load→save identity; v(n)→v(n+1) byte fixtures; hash stability under key reordering | all assets, all fixtures |
| Presentation (`dart test`, headless) | `Solved` → `PropertyView` for all three states; marks derived from provenance; no delta against an absent value | per property |
| Gate hygiene (static) | no unit literal in `packages/setup_physics/lib` or `lib/src/features`; no Flutter import in physics; no formatting outside `lib/src/units`; every golden ID has a test | one test each |
| Widget, semantics guidelines, golden image | slider updates the number; equation expands; tap targets hold; painters do not drift | thin, per screen |
| Performance | P-01 ≤16 ms and P-03 ≤2 ms on the reference device, gated at 2× the target so a real regression trips it and a noisy runner does not | 3 models |

Tolerances live in the fixture, not the test body: 1e-9 relative for closed-form algebra, 1e-6 for
iterative work *with the iteration count and bracket fixed by the spec* (M13 — a tolerance on a
finite-difference or a bisection is meaningless without the step), and absolute only where a value
legitimately approaches zero, with the fixture saying why. The requirements' blanket 1e-9 across
devices is not achievable downstream of a bisection and is not what this harness asserts.

`--update-goldens` is forbidden for numeric fixtures (fine for images): a reviewer must be able to
reject a changed expected number whose `source` did not change.

**CI must gate:** zero analyse issues; every layer above; the physics-has-no-Flutter pubspec test; the
no-unit-literal and no-formatting greps; asset and fixture schema validity; the golden-ID trace.
**Must not gate:** coverage percentage or warning counts. **No retries:** a retried test hides a race.

## 10. GitHub Actions and the gate

**The gate is `cd app && dart run tool/gate.dart` (D-09, recorded in `AGENTS.md`).** One command,
because the convention's rule is that a gate is one exact command and the workspace has three
packages — two of which the app-scoped commands cannot see reliably (`flutter test` in `app/` does not
walk `packages/*/test/`, and `flutter analyze`'s coverage of workspace members is version-dependent).

`gate.dart` runs, per package, exactly:

| Package | Commands |
|---|---|
| `app` | `flutter analyze`, `flutter test` |
| `packages/setup_physics` | `dart analyze`, `dart test` |
| `packages/setup_data` | `dart analyze`, `dart test` |

and nothing else. The schema, migration, adapter, golden-ID and grep checks are **tests inside the
packages**, so `dart test` cannot skip them and there is no second tool to forget to wire in. That is
also the answer to D6: the release gate no longer depends on a `spec_audit` binary that no acceptance
criterion requires — the golden-ID trace is `setup_physics/test/spec_trace_test.dart`, which reads
`docs/specs/physics/*.md` at test time (the `dart:io` ban covers `lib/`; tests may read the spec).

`gate.dart` runs every step even after a failure, prints each command and its exit code, and exits
non-zero if any failed: a gate that stops at the first failure costs one round trip per fix. *Cost of
the indirection:* a contributor who runs `flutter test` locally gets a green that is not the gate —
mitigated by `gate.dart` printing what it runs, and by the PR template asking for its output.

```yaml
name: gates
on: [push, pull_request]
jobs:
  gates:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - uses: subosito/flutter-action@v2
        with: { flutter-version-file: app/.flutter-version, cache: true }
      - run: dart pub get && dart run tool/gate.dart
        working-directory: app
  build-android:
    needs: gates
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - uses: subosito/flutter-action@v2
        with: { flutter-version-file: app/.flutter-version, cache: true }
      - run: flutter build apk --debug
        working-directory: app
```

**Two jobs, not three.** The iOS job is gone with D-10: no macOS runner, no `flutter build ios`, and
no signing secrets in CI at all. Release artefacts (`.aab`) are built and signed locally by Dave
(§11); CI proves the code analyses, tests and builds.

Golden images compare only against the same pinned Linux image and Flutter version — that pairing is
what makes them stable. Dependabot covers pub and Actions; a monthly PR against `.flutter-version`
keeps the bump reviewable.

## 11. Release path: Google Play, Android only

**Decision (D-10): v1 ships on Google Play only.** No Apple Developer enrolment, no Mac, no iOS
signing in v1. Flutter stays, so iOS remains a *build* target rather than a rewrite — the code, the
packages and the tests carry over unchanged. What does not exist is an iOS release path.

| | Android (v1) | iOS (deferred) |
|---|---|---|
| Identifier | `io.github.<owner>.setuplab` as `applicationId` | the same string as `bundleId` |
| Version | `1.2.3+45`, tag `v1.2.3` | same |
| Minimum OS | minSdk 26 (Android 8.0; spec D8, E8.6) | iOS 15.0 — deferred |
| Target | compile/target 36 (Play's required target rises each August) | iOS 26 SDK — deferred |
| Account | Play Console, US$25 once | Apple Developer Program, US$99/yr |
| Signing | upload key + Play App Signing | certificates and provisioning — deferred |
| Artefact | `.aab` for Play, `.apk` for direct install | — |

### 11.1 What Dave must own now

1. **A Play Console account** — US$25 once, plus identity verification (government ID and address;
   days, not minutes). It is the long pole before any upload and blocks nothing else.
2. **The 12-tester / 14-day closed test** that Play requires of new *personal* developer accounts
   before production. This is a calendar constraint, not a form: v1's ship date is at least two weeks
   after the first closed build, the testers must be real accounts that opt in and keep the app
   installed, and if the account is an organisation instead, the org route needs a D-U-N-S number and
   its own weeks. Pick one now; both cost a fortnight, in different places.
3. **An upload key he holds, and Play App Signing** so Google holds the app signing key. A lost upload
   key can be reset through Play support; a lost app signing key cannot be replaced at all, and every
   future update to that listing becomes impossible. *Cost:* one more artefact to back up, and a
   Play-side reset process if it is lost.
4. **A privacy policy URL** (Play requires one even when nothing is collected) and the **Data safety**
   form: "no data collected, no data shared" — consistent with the manifest having no `INTERNET`
   permission, which a reviewer can check.
5. **The content rating questionnaire** (IARC) and the listing assets: icon, feature graphic,
   screenshots, description.
6. **A trademark check on the name** before the listing exists. A listing renamed later loses its
   reviews and its install history.

### 11.2 What is deferred, and what it costs later

- **US$99/yr and an Apple Developer account.** The irreversibility is *individual vs organisation*
  enrolment: it cannot be retrofitted to the same account, and organisation needs a D-U-N-S number and
  weeks. It stays open (D-10) precisely because nothing needs an answer until someone wants the iOS
  listing — and it costs the same in a year as it does today, which is the only reason deferring it is
  free.
- **A Mac or hosted macOS minutes.** No iOS build happens on Linux. A used Mac mini is a one-off
  purchase; hosted runners are a per-release cost. Deferring removes both from v1 entirely.
- **The iOS-only work**, all small, all deferred as *work* rather than as *design*: `CFBundleDocumentTypes`
  for file-open (Android's `<intent-filter>` is the same information in a different file), the iOS
  deployment target, TestFlight, and App Store review — a second review cycle with its own rejection
  risk, where "thin app" is the likely one. The answer to that risk (equation expansion and lessons)
  is in both builds already.
- **A QA pass on a platform that has never run the code.** This is the real cost. Android-only means
  the first iOS build is the first time `path_provider`, file-open and 200% text scaling meet iOS.
  Flutter keeps that a build rather than a rewrite *on the assumption that no Android-specific
  decision has leaked into shared code*, which is a rule this document keeps: file-open goes through
  `file_picker` and `DocumentStore`, never through platform intents; no `Platform.isAndroid` branch
  outside `lib/src/io/`.
- **Audience and discoverability.** Halving the addressable users is the honest price. The public
  claim does not change — "free to use, no account, no server, no ads" — it is simply heard by fewer
  people. *Revisit trigger:* the first property reaching L2, or the first request from an iOS user,
  whichever comes first.

**App version and document `schema_version` are unrelated.** Conflate them and a bug fix cannot ship
without migrating every saved car. Build numbers must increase monotonically on Play, including
re-uploads after a rejection.

What stays free and verifiable: no IAP, no accounts, no analytics or crash SDK, no ads, and an Android
manifest **without the `INTERNET` permission** — making "works offline" a property the OS enforces and
a reviewer can see. The claim is "free to use, no account, no server, no ads" rather than "zero cost to
run", which the owner's bank statement would contradict (spec D9).

*Cost:* a "thin app" rejection on Play is less likely than on the App Store but not impossible;
equation expansion and lessons are the answer. *Revisit:* any commercial arrangement changes this
section, and so does D-10.

## 12. Desktop and web, later, from the same source

| Carries over | Breaks | Fix |
|---|---|---|
| physics, data, schema, migrations, tests, routes, features | window sizes | 900 dp breakpoint decided now, not retrofitted |
| charts and painters | wheel/trackpad zoom, keyboard nudge | `Listener` around `InteractiveViewer`; arrow-key nudge |
| JSON documents, export | no `path_provider` (web), no share sheet (Linux) | `DocumentStore` interface + IndexedDB impl |

Three things to build in v1 *because* they are cheap now and expensive later: `DocumentStore` as an
interface with one implementation (a week versus a rewrite); a bounded undo stack (20 snapshots per
document, not a command pattern — desktop expects ⌘Z); and `LayoutBuilder` breakpoints from the first
screen, because phone-only → two-pane re-does the IA.

Web additionally needs `dart:io` unreachable from shared code (already banned in both pure packages,
and the schema/migration layer takes strings, not files) and CanvasKit trimmed at startup; `dart2js`
and wasm doubles are still binary64, so results are identical. *Revisit:* desktop when someone with a
laptop asks. Web never, unless a "try before you install" link turns out to matter.

## Risks

**1. Precision is not the risk it looks like; conditioning is.** `double` is IEEE-754 binary64 on
every target and a 0.1 mm measurement carries four significant digits against sixteen available;
measured mm→m→mm error across 5,001 values is 2.8e-14 mm. But for a typical 55 mm lower arm the
instant-centre distance behaves as ≈ 0.047 / sin(Δθ) metres, Δθ being the angle between the links:
5.9° gives 0.48 m, 0.9° gives 2.9 m, 0.08° gives 31.5 m — and there a 0.1° change in link angle moves
the instant centre 38 m. No precision fixes that: the *input* resolution does not support the answer.
The solver therefore reports conditioning as a `Flag` with a single threshold defined in `physics/00`
§4, and the UI says the geometry is nearly parallel and the number is not meaningful. This document no
longer proposes its own threshold: it proposed 1e-2 / 1e-4 against 00's 1e-9, and two thresholds for
one question is how a user learns to distrust the warning.

**2. Result-type drift.** B6 was three shapes and twenty names; §7 closes it by deferring to one
specification. The residual risk is a developer adding a reason code in the package and a string in
the UI. Mitigation: reason codes are exported with their wire strings, and the app's message table is
an exhaustive `switch` with no default, so a new code fails to compile rather than rendering blank.
*Cost:* adding a reason touches two files instead of one, which is the price of the compile-time check.

**3. Repeated solves.** A full two-axle analysis is P-01's ≤16 ms budget, and one axle is a fraction
of it; the 60 Hz reference frame is 16.7 ms (8.3 ms on a 120 Hz panel), so the risk is not the maths
but rebuilding widgets and charts around it. In order: derived provider (one solve per frame),
`select` on leaves, `RepaintBoundary` on charts, and only then `Isolate.run` with latest-value-wins —
an isolate hop (~0.2–1 ms plus serialisation) can cost more than the work it offloads. A per-field
result struct makes the payload larger; `select` is what keeps that from reaching a repaint.

**4. Accessibility** — three specific failures rather than an aspiration: (a) the results table at
200% text scale, designed against `TextScaler` and tested at 2.0, not 1.0; (b) the painter as sole
carrier of information, so every visual has a table equivalent and a `Semantics` label; (c) sliders as
the only input, so every slider has a text-field fallback that also fixes precise entry. Plus 48 dp
targets, 4.5:1 contrast, colour never the only encoding, and a reduce-motion path. A validity chip is
part of this: state must be readable as text, not only as a colour or a tilde.

**5. Two lists checked by people, not by tests.** The schema manifest against the requirements field
table, and the evidence table against the validation log. Both are deliberate: a parser over the
requirements prose would recreate the circular gate D6 named. Mitigation: both lists are small, both
are touched in the same PR as the thing they describe, and the fixture tests fail if the manifest and
the code disagree. Residual risk stated plainly: a field added to the requirements without a manifest
entry is caught at review, not by CI.

## Open questions

1. **Where community chassis models live**: `app/assets/models/` in this repo (reviewable, but model
   PRs inflate app history) or a separate models repo bundled at build time. v1 assumes in-repo.
2. **Publish measurement uncertainty per result** in v1? Risk 1 makes it nearly free, and no RC tool
   has offered it — but it is scope, and it is a *different* honesty mechanism from the evidence chip:
   a band is a claim about the number, the chip is a claim about the model, and shipping both at once
   may read as more confidence, not less.
3. **Does `on_absence` live in the schema manifest or only in the requirements table?** If the
   manifest, the import UI, the assumption marks and the three result states all derive from one
   column. If not, the mapping is a hand-written switch, and D1's three contradictory absence policies
   come back one field at a time.
4. **iOS enrolment type, when D-10 is revisited**: individual (immediate, personal name on the
   listing) or organisation (D-U-N-S, weeks, not retrofittable). Recorded so it is not re-decided from
   scratch.
