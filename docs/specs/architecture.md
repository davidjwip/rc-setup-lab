# Architecture — Setup Lab

Status: revised after round 1. Decisions applied: **D-09** (one gate command), **D-10** (Android v1,
iOS deferred), **D-11** (honest validity chip), **D-12** (v1 = geometry + balance, with the owner's
2026-10-30 amendment), **D-01** (three navigation destinations), **R-1** (ISO 8855 frame), **R-2**
(mm/g/deg on disk, one conversion site). **Owner decisions, 2026-10-30:** every value carries
provenance *and* a tier; the physics API returns an estimated value together with its band and an
inferred claim together with its basis (so the UI can print "all else equal"); damping ratio ships as
an estimate with a computed band; CG height is inferred, never a measured input; the release path is
unchanged — Android only. Those land in requirements §4.4.1 (eight states), §4.11 (three tiers) and
§4.8 (the band), and this document defers to those names rather than coining a second set. Companions: `docs/intent.md`, `docs/specs/spec.md` (v0.2),
`docs/specs/physics/00`–`99`, `docs/design/flows.md`. Toolchain: Flutter 3.47.9 / Dart 3.13.7
(Oct 2026).

## Precedence, stated once

The old draft said "the spec wins where they disagree", and by its own rule selected the coordinate
frame that every physics equation contradicts (B1). Precedence is therefore per subject:

| Subject | Authority | Why |
|---|---|---|
| Frame, sign conventions, the result type, the tier/reason/flag vocabularies, tolerances | `physics/01` §2, `physics/00` §4 (to be extended with the tier enum), owner decisions of 2026-10-30 | eleven equations in modules 2–6 were derived in that frame and against that vocabulary; re-deriving them to satisfy a prose sentence is the expensive direction |
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
`FieldRef` and `setup_data` owns the ref → document-path table the UI renders (§4.2). The reverse
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
| `/car/:carId` (+ `/edit`, `/geometry`, `/geometry/wizard/:groupId`) | Garage | car detail, geometry editor, measurement wizard |
| `/car/:carId/setups`, `/car/:carId/setup/:setupId` | Garage | setup list, setup sheet |
| `…/setup/:setupId/analysis`, `…/analysis/:propertyId` | Garage | analysis, per-property detail |
| `/compare?a=&b=`, `/compare/pick/:slot` | Compare | side-by-side, slot picker |
| `/learn/path`, `/learn/:conceptId` | Learn | learning path, concept |
| `/welcome`, `/settings/**` | above the shell | no bottom bar |

The paths are `docs/design/flows.md` §2.3's, unchanged; the branch column is this document's
contribution, and it is the thing D-01 decided. `/car/…` sits *inside* the Garage branch rather than at
the root, so a deep link resolves to a branch and a stack position without the router guessing — the
path prefix (`/car` vs `/garage/car`) was considered and rejected as churn: it would change every
shared link for a routing intuition nobody sees. *Cost:* the route tree must be read with the branch
structure beside it, which is why the table above has the column.

`indexedStack` keeps each branch's stack alive, so switching tabs mid-edit returns you where you
were. **Android back** pops within the branch; at a branch root it returns to Garage; at Garage's
root it exits. That is an explicit `PopScope` rule, not a default. **No `canPop: false`, no "discard
changes?" dialog:** every edit autosaves within 500 ms, so there is nothing to guard. That
constraint is held now, for the deferred iOS build (§11), because it costs one rule today and
retrofitting a save model behind a navigation guard is a rewrite of every edit path.

### 3.1 Deep-link contract

- `/car/:carId/setup/:setupId/analysis` and `/learn/:conceptId?car=&setup=&from=` are the shareable
  strings; a future URI scheme reuses them unchanged.
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

**A setup can arrive without its model** — that is the normal consequence of sharing a setup file
without the car, and the format forbids embedding the model. So `(model_id, content_hash)` has a third
outcome besides "found" and "not found": found-but-different-revision (E2.7's remap prompt) and
missing-entirely. Missing is a *document state*, not an error: the setup opens read-only, every output
is `REFUSED(model_missing)`, and the three recovery actions — import the model, map to a local model,
delete — are the whole screen (requirements §4.6, E6.9). Storing that state costs one nullable
`mapped_at`/`model_ref.state` field; *guessing* it by silently rebinding to the nearest local model
costs the user's trust in every number, which is why the binder never runs without an explicit tap.

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
index *file* — a second source of truth is a consistency bug. *Revisit:* E8.5's ≤300 ms to open a
stored model missed on the reference device, 200 models failing to scroll at 60 fps, or full-text
search over setup notes.

### 4.1 The on-disk shape

```json
{ "schema_version": "1.0.0", "kind": "car_model", "id": "mdl_8f2c41",
  "frame": { "standard": "ISO 8855", "axes": "x forward, y left, z up",
             "origin": "ground plane, rear axle centre, vehicle centreline" },
  "units": { "length": "mm" },
  "sources": { "s1": { "type": "measured", "method": "digital caliper", "by": "DW" } },
  "axles": { "front": { "track": { "value": 172.0, "source": "s1" } } },
  "corners": { "LF": { "points": {
      "lca_out": { "value": [259.0, 78.0, 7.0], "source": "s1" } } } } }
```

The full shape is `docs/specs/fields.yaml`, and spec §4.2 prints the complete
reference model; this snippet exists only to show the three things a reader of the
architecture needs: the value object, the corner key and the frame block.
`units` declares one entry per dimension **actually used** — the snippet above
uses one, so it declares one, and a missing dimension refuses the document.

- **`frame` and `units` are declared and checked on load** (§5). A file that declares a different
  frame or unit system is refused with the mismatch named, never rescaled or reinterpreted.
- **Every value is `{"value": number, "source": sourceId}`** (D-16), resolving into the document's
  `sources` map; a whole caliper session is one source (spec §4.1.2), and a value with no resolvable
  source is a schema error rather than a review note. `x_`-prefixed keys we do not understand are preserved
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
once with `path`, `type`, `unit` (a dimension from the file's own `meta.dimensions`), `req`,
`on_absence ∈ {ASSUME, ESTIMATE, REFUSE, OMIT}`, an `assume` value where the policy is `ASSUME`, an
`estimate` procedure id and `band: true` where the policy is `ESTIMATE`, `plausible` and
`consumed_by`. **`ESTIMATE` is a member of that enum, not a subclass of `ASSUME`**: it is the policy
that carries CG height (D-14) and both unsprung masses, and a validator that accepts three values
either turns an inferred number into an assumed one or refuses a document the spec requires to load.
Three views are generated from it and the gate's schema stage proves they still agree: the Markdown
tables in the requirements, the Dart table the validator reads, and the fixture set. This replaces a hand-written manifest, and the reason is B9 —
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
fixtures (spec §4.5), which is what makes two installs agree. D3 is why it has one owner: divergent hashes
break E1.7, E2.1, E2.7 and E7.1 at once and the failure is invisible until two users exchange files.
*Cost:* RFC 8785's number formatting is stricter than Dart's `toString()` for some doubles, so the
formatter is hand-written and fixture-tested; including `x_` means a foreign tool that adds an
extension key creates a new revision, which is the honest outcome — the meaning may have changed — and
the UI names the new revision.

**Two hashes, one owner.** The base `content_hash` is not the only one: a setup may carry the closed set
of geometry adjustments of requirements §4.3.2 (upper-link shims, wheel offset), and the derived
geometry has its own `geometry_hash` (§4.5.3). Both hashing functions live in `hash/`, and the
*composition* — base model plus adjustments, in the signed order the schema fixes — lives in the
adapter, so the solver receives one compiled geometry and never learns that a shim exists. That is the
same boundary that keeps mm out of physics: the pipeline is arithmetic on document values, so it
belongs with the only code allowed to do arithmetic on document values.

**No file access in the pure packages.** `setup_data` validates, migrates, hashes and composes strings
and maps; the app owns bytes. That is what lets the same migration code serve a web build later with no
platform channel, and it is why `dart:io` is a build error rather than a convention.

## 5. Frame, units and the single conversion site

### 5.1 The frame — ISO 8855 (R-1)

**x forward, y left, z up; origin on the ground plane (flat plate) at the rear axle centre, on the
vehicle centreline.** Left corner positive y, right corner negative y; roll positive with the left
side up.

Four consequences, each of which the old draft left open:

- **Mirroring negates y and nothing else** — not z, not x, and not a stored per-wheel angle (next
  bullet). Wheelbase is the front axle's x, because the rear axle sits at x = 0 — which is what
  modules 3 and 6 assume when they hard-code contact-patch x to `l` and `0` and interpolate the roll
  axis from the rear axle.
- **Camber and toe are per-wheel signed and are NOT negated on mirroring (D-17)**: positive camber =
  top outboard, positive toe = toe-in, both statements about *the wheel*. A symmetric car stores
  identical values left and right, and the mirror path copies them **unchanged** — only point `y` is
  negated. The side factor `s` (`+1` on LF/LR, `−1` on RF/RR) converts a stored per-wheel angle into
  the car frame, **once, inside the solver** (`γ_global = s·γ`, `τ_global = s·τ`), and never in a
  document, a setup, an export or a formatter. Negating on mirror instead puts 1.0° of total toe on a
  straight car — the round-2 A3 defect, one layer out from B3, and silent because the number stays
  plausible. Without `s` at all, κ changes sign between the left and right corner and the outer
  wheel's camber behaviour is reported 40 % wrong on the corner that matters (B3).
  Pinned by `physics/01` §6.1 and golden cases G01.1, G01.8, G01.9 and G01.12, and by `physics/02`
  G02.11.
- **Quantities that belong to the car are frame-free and never signed per side**: roll-centre height,
  load transfer, balance, roll stiffness.
- **Contact patches are derived, never stored** — `(0, ±track/2, 0)` and `(wheelbase, ±track/2, 0)` —
  and the loader asserts the stored `wheelbase` against the front wheel centres to ±3 mm, so the
  origin and the wheelbase cannot drift apart in a hand-edited file (requirements §4.2).

*Why this frame.* ISO 8855 is what the eleven equations in modules 2, 3, 4 and 6 were derived in and
what the published references use; the requirements have specified the same frame since v0.2
(spec §4.2), so there is one convention across the project and no sign table in any module. The
earlier y-right/mid-wheelbase convention is gone from every document and must not be reintroduced
piecemeal: it differed by half a wheelbase in x and a sign in y, which is enough to make a correct
hardpoint set compute a plausible wrong car. *Cost of being wrong:* every hand-entered hardpoint is one sign away from a mirrored car
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
| Damper force / shaft speed | N, m/s | N, m/s | N, mm/s |
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
   `mm * 1e-3` fails 644. `N/mm → N/m` is `* 1000`. Shaft speed arrives in m/s already (requirements
   §4.1 rule 1 — a damper curve is published that way), so speed needs no conversion at the adapter and
   only the *display* converts it to mm/s, which is the unit a racer reads.
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
   build reads mm/g/deg; this file says m/kg/rad". The adapter also rejects any coordinate whose
   magnitude exceeds 3000 mm as a suspected metre value (requirements §4.1 rule 1) — the guard is a
   *validation* rule in the schema layer, not a heuristic in the solver, and E3.8's property test runs
   it with both unit systems.

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

**A chart exists only for a valued property.** The presenter returns a `PropertyView` for the value
(§8) and a `Series` only when that view is `Valued`; `Missing` and `NoAnswer` produce no series at all,
so there is no chart to draw and no `fl_chart` call to make. A banded series (roll-centre migration from
an estimated input, for instance) draws its band as a shaded envelope rather than a second line, and
the caption carries the tier — a chart that hides a band is a chart that lies. And no chart is written
for a quantity the build does not compute: damping ratio ships as an estimated *reading* with its band,
not as a damper curve, because a curve needs a damper document that v1 does not have (§8.6, requirements
§4.8) — so `fl_chart` gains no speculative usage.

At most three files import `fl_chart`, all under `lib/src/widgets/charts/`: single-maintainer package,
history of breaking majors, and a line chart in `CustomPainter` is two days if it dies. It has no log
axis and damper curves want one — transform to `log10` in the presenter. Charts sit behind a
`RepaintBoundary`, animation duration zero during drags.

## 7. One result type, per-field validity

**Pick: one sealed type, `Solved<T>`, defined in `setup_physics`, specified in `physics/00` §4, carrying
value, band, tier and provenance. Three transport states, one reason enum, one flag enum, one
two-value tier. A query returns a struct of `Solved` fields — never a `Solved` of a struct.**

```dart
// setup_physics/lib/src/result/solved.dart — shape only; 00 §4 is the specification.
sealed class Solved<T> { const Solved(); }   // tier lives on Defined: a missing number has no worth to grade

final class Defined<T> extends Solved<T> {
  final T value;                  // SI
  final Tier tier;                // firm | inferred (§4.11); derived, never declared
  final Band? band;               // required when tier is inferred, computed by re-running (§4.8)
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

- **Tier and state answer different questions, and neither vocabulary is invented here.** The
  requirements' tier (`firm` / `inferred` / `speculative`, §4.11) says what a number is worth; the
  requirements' state (eight values, precedence-ordered, §4.4.1) says whether it exists and what is
  missing. The package carries the *inputs* to both — value, band, basis, provenance, quality flags —
  and **`setup_data` derives the state**, because only it knows each consumed field's `on_absence`
  policy and its `plausible` bounds. The app formats. That split is what keeps the state vocabulary in
  one place while keeping the solver JSON-free.
- **Tier is derived, never declared.** The envelope's tier is `firm` when every consumed value carries
  a `measured` source and the equation is used inside its stated domain, and `inferred` otherwise — a
  function does not choose it. `speculative` never appears on a computed value: §4.11 gives it to
  suggested changes (the setup-sheet interpreter), which are advice, not outputs, so the package's enum
  is `firm | inferred` and the app adds `speculative` for advice items only. *Cost:* the adapter must
  carry a source type per input, so `PhysicsInput` fields are wrapped rather than bare doubles.
- **`band` is computed by re-running, not by propagating errors.** Per §4.8 the band is the [min, max]
  of the output recomputed with each `estimated` input at the ends of its own `tolerance_pct`, one input
  at a time — so it moves when the tolerances move, and E3.6(d) makes a constant band a test failure.
  The package therefore needs a banded query (`damperRatioAt(corner, speed, {endpoints})`), not a
  variance formula. *Cost:* N+1 solves per banded output, where N is the number of estimated inputs —
  affordable for one output on demand, not for the whole analysis on every frame, so bands are computed
  when a card is opened and cached with the solve.
- **`basis` is a procedure id plus its inputs, never English.** CG height is `ESTIMATE(two_hang_plumb_line)`
  in the schema (§4.2.1) — never asked for as a measurement, because corner scales cannot locate a CG —
  so the envelope carries `Basis(procedure: 'two_hang_plumb_line', inputs: {…})` and the app's string
  table renders the sentence and appends "all else equal". The physics package is Flutter-free,
  locale-free and copy-free; a sentence inside it would be a translatable string in the one package that
  cannot load the bundle.
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
  it; there is no `ResultDto`. State, tier, reason and flag names persist and travel as *strings*
  (`parallelLinks`, `inferred`), never as enum ordinals, so renaming a Dart case cannot change an export
  or a golden fixture. Within a document major the vocabularies are additive only — which is also what
  lets §4.4.1 gain a ninth state without touching a saved file.
- **Conditioning is a flag.** Whether a defined number is trustworthy is a matter of degree; a third
  tier would imply a categorical boundary the physics does not have. One threshold, defined and
  exported by the physics package; the app's "nearly parallel" copy reads that flag and compares
  against nothing of its own. The 1e-2 / 1e-4 numbers this document used to propose are withdrawn.
- **No nullable darts, and the envelope is never partially filled.** No public function returns
  `double?`, `null` or `NaN`. A property test over 10k seeded geometries asserts every `Defined.value`
  is finite, every envelope with tier `inferred` carries both a band and a procedure, every `Undefined`
  names an enum reason, and every `NotMeasured` names at least one field. A banded claim without its
  band is the same failure as a number without a unit — and worse, because it looks more honest than
  it is.

## 8. The "computed, not yet validated" state

**Decision (D-11 + owner decision, 2026-10-30): every value carries a state, a tier, a band where it is
estimated and a basis where it is inferred, and no surface shows a bare number. Three axes, each owned
by exactly one document:**

| Axis | Values | Authority | Where it is decided |
|---|---|---|---|
| **State** — does the number exist, and what is missing | `UNDEFINED(reason)`, `REFUSED(field)`, `OUT_OF_DOMAIN(bound)`, `COMPUTED_INCOMPLETE(fields)`, `COMPUTED_ASSUMED(fields)`, `INFERRED(procedure, band)`, `ESTIMATED_INPUTS(n)`, `COMPUTED` — in that precedence, highest wins | requirements §4.4.1 | `setup_data`, from `on_absence`, `plausible` and the result envelope |
| **Tier** — how much the number is worth | `firm`, `inferred`, `speculative` | requirements §4.11 | `setup_physics` for the first two (§7); the app adds `speculative` for advice only |
| **Evidence** — how far it has been checked | `validated`, `not_yet_validated` | E3.16 | the app's presenter, from the build's golden inventory **and** the model's recorded measurement check |

Two of these are new since round 1 and both exist because of the owner's 2026-10-30 decision: a number
can be a *claim* rather than a result, and the API has to say which. The reason the state is not
computed in the package is that every one of the eight states except `UNDEFINED` depends on a schema
fact — which field is missing, under which `on_absence` policy, inside which `plausible` bound — and
the package is not allowed to know the schema (§1). This is the same rule that keeps the frame and the
units out of it.

**1. Carried through the API.** The envelope (§7) carries value, band, basis, provenance and tier;
the *state* is derived downstream. Evidence does not travel with the value at all, because it is not a
property of the arithmetic:

- `setup_physics/lib/src/evidence/evidence_table.dart` records, per output id, which golden cases
  exist (E3.11) and their `source_kind`. That is a property of the build.
- the *model's* recorded measurement check (E3.13's measured-vs-computed, with date and car) is a
  property of the user's car, and is stored in the model document. E3.16 makes `validated` conditional
  on it existing for *that model*, and it cannot be inferred from the build.

So the state is a function of (result envelope, the schema's `on_absence`/`plausible` facts) and is
derived in exactly one place — `setup_data`'s adapter — while the display value adds the evidence axis
and is assembled in exactly one other, the presenter. Neither is ever assembled ad hoc on a screen, and
neither package recomputes the other's half.

**2. What is stored, and what is not.** Computed values are never stored (§5 rule 4), so no state is
stored per value either — every one of the eight is reproducible from three things that *are* stored:
the value's `source` (provenance), the **omitted fields** (absence, which the field's `on_absence`
policy turns into `REFUSED`, `COMPUTED_ASSUMED`, `COMPUTED_INCOMPLETE` or `INFERRED`), and the model's
validation record for the evidence axis.

Two consequences, both deliberate:

- **E1.6's "outside the expected range" flag is recomputed, not stored.** The field's `plausible`
  interval lives in `fields.yaml` (E1.6 iterates it), so the flag is a comparison at load time. It
  therefore survives save and reload without a schema field, and it cannot go stale when a range is
  corrected in a later build — whereas a stored boolean would keep asserting a judgement the current
  schema no longer makes. *Cost:* the range check runs on every load, which is microseconds for a few
  hundred values, and a file edited by hand to sit inside the range loses the flag, which is correct.
- **No state is written into a document.** A setup exported in October must not still claim `validated`
  in March after a regression moved the number. The export carries the states as text at export time,
  stamped with the app version, so an old PDF is a historical document — the honest reading of it.

**3. Displayed, through a type that cannot be a bare number.** The presenter maps the envelope, the
build inventory and the model's validation record into one value, and that is the only thing a card
may receive:

```dart
sealed class PropertyView {
  final Claims state;             // one of the eight §4.4.1 states, with its payload
  final Tier tier;                // firm | inferred | speculative (§4.11)
  final Evidence evidence;        // validated | not_yet_validated (E3.16)
}
final class Valued extends PropertyView {
  final String formatted;         // already rounded, with its unit
  final Band? band;               // printed next to the number; required by INFERRED/ESTIMATED_INPUTS
  final String? basisSentence;    // procedure sentence; ends with "all else equal" when behavioural
}
final class Refused  extends PropertyView { final List<String> fields; }   // document paths, no unit
final class NoAnswer extends PropertyView { final String reason, message; } // UNDEFINED
```

- **A banded value is never rendered without its band.** The band comes from the result envelope (§7),
  so a screen cannot drop it: the presenter asserts `band != null` whenever the state is `INFERRED` or
  `ESTIMATED_INPUTS` and the tier is `inferred`, rather than trusting each card to remember.
- **An inferred claim is never rendered without its basis.** `basisSentence` is generated from the
  package's `Basis.procedure` id and the app's string table, and ends with the words "all else equal"
  whenever the claim is about car behaviour (§4.11 makes those words mandatory for inferred
  behaviour claims). CG height is the case that forced it: the field is `ESTIMATE(two_hang_plumb_line)`
  in the schema, so the sentence names the two-hang procedure and the band that came out of it.
  *Cost:* the string table carries one sentence per inference procedure, and each is a claim someone
  must review as copy rather than as maths.
- A widget that renders a computed number accepts `PropertyView` and nothing else. `lib/src/units/` is
  the only place a `double` becomes a `String`; `presenters/` is the only place a `Solved` becomes a
  `PropertyView`. A grep test bans `toStringAsFixed`, `NumberFormat(` and `$`-interpolation of a double
  under `lib/src/features/`, extending E8.9a's no-assembly lint to numbers. Why a test and not a review
  rule: D9's finding is that no acceptance criterion required a per-output state, so an unvalidated
  model rendered `9.97` with a unit and no caveat. *Cost:* every card needs a wrapper, and a quick
  debug print needs a formatter call.
- Marks that come from the *document* — assumed inputs, out-of-range values — are derived from each
  value's `source` and from the field's `plausible` range in `fields.yaml` (recomputed at load, §8.2),
  not from the physics result, so they follow the data through compare, export and reload.
- The chip text and the detail-panel caveat are the two strings `physics/99` §1 mandates; the app does
  not paraphrase them.
- **The design's five badges are not the state vocabulary.** `docs/design/screens.md` §0.2 defines
  *computed / estimated / inherited / missing / undefined*, which is the owner's 2026-10-30 wording.
  The requirements then split that into eight states (§4.4.1) and three tiers (§4.11), and the two
  cannot both be the chip's vocabulary: `INFERRED`, `OUT_OF_DOMAIN`, `COMPUTED_INCOMPLETE` and
  `ESTIMATED_INPUTS` have no badge in the current set. Architecture's position is that the **chip
  renders the state** (eight values) and the **tier rides alongside as a word** (`firm` / `inferred` /
  `speculative`), because the state is the thing that decides whether a number is shown at all. The
  badge component therefore needs a state map, not five more hand-drawn variants; that is a design task
  with an architectural constraint attached, and it is listed in the disagreements.
- **Compare refuses a delta unless both sides carry a number, and labels the two tiers.** Two `Valued`s
  render a delta; anything against `Refused` or `NoAnswer` renders both states and no delta; and a
  delta between an `inferred` and a `firm` value is labelled with both tiers, because "wheel rate up 4%"
  against a banded estimate is a different claim from two firm numbers. For ζ the compare view goes
  further, as §4.8 and E3.6(e) require: the signed direction and magnitude of the change is rendered
  *above* the absolute values, because the change is the trustworthy part.

**4. How evidence moves.** One output at a time: a row in `physics/99` §9's results log, then the
inventory in `evidence_table.dart`, then the chip changes everywhere it showed. The check is a review
rule, not a test — a machine check would have to parse a prose table, which is the circular gate D6
identified. *Cost:* a level could be raised in code with no log row and no test would fail. Mitigation:
the table's doc comment names the log as its only evidence, and a level change is a one-line diff.

**5. Degradation, which is the v1 default path rather than an edge case.**

| Situation | State (§4.4.1) | What the user sees |
|---|---|---|
| Inputs present, geometry degenerate | `UNDEFINED(reason)` | "undefined for this geometry: parallel links", plus the hardpoints responsible |
| A consumed field is absent with `on_absence: REFUSE`, or the setup's model is missing | `REFUSED(field \| model_missing)` | the field named, no number, no unit, no dash; for a missing model, the badge plus the three actions of §4.6 |
| The value is outside `roll_centre_validity` or another declared bound | `OUT_OF_DOMAIN(bound)` | the number *plus* the bound exceeded — a flagged number beats a refusal the user cannot reason about |
| A consumed field is absent with `on_absence: OMIT` | `COMPUTED_INCOMPLETE(fields)` | the number, plus "does not include <field>" |
| A consumed field is absent with `on_absence: ASSUME(v)` | `COMPUTED_ASSUMED(fields)` | the number, plus the field and the assumed value (E1.8, E2.4) |
| A consumed field is absent with `on_absence: ESTIMATE(procedure)`, or the output is itself an inference | `INFERRED(procedure, band)` | the number, its band, the procedure name, and "all else equal" where the claim is about behaviour |
| A consumed value has an `estimated` source | `ESTIMATED_INPUTS(n)` | the number, the count, and each basis one tap away (E2.11) |
| None of the above; a setup's model revision is absent | `COMPUTED` / `REFUSED(model_missing)` | the number; and for the model-missing case, no numbers at all until remapped (§4.6) |
| Output not in this build | no card | the analysis screen's "what this build computes" note names the gap |

Precedence is the requirements' order, highest first, and it is asserted by a test rather than
restated in prose twice: a value that is both out of domain and built on an estimate is
`OUT_OF_DOMAIN`, because the bound is the harder fact.

**6. v1 scope: eleven outputs, three of them not measurements.** Geometry + balance as the requirement
cuts it (requirements §2.1) — motion ratio, wheel rate, ride frequency, roll stiffness, load-transfer
split, roll-centre height and migration, camber gain, camber at roll, bump steer, plus damping ratio as
an estimate — and three quantities the app labels rather than measures:

- **Damping ratio is `INFERRED` in v1**, from the orifice model with a *computed* band (each estimated
  input at the ends of its own `tolerance_pct`, one at a time — E3.6(b), §4.8). Not a fixed ±30%: a
  constant band is a test failure (E3.6(d)). It is never `validated`, never a headline, and the compare
  view leads with the signed change between two sheets, because that is the trustworthy part. This
  reverses round 1's "ζ is out of v1" and it is only implementable because the state and tier axes
  exist: without them, ζ would be a bare number pretending to be a measurement.
- **CG height is `ESTIMATE(two_hang_plumb_line)`**, never requested as a measurement, with a computed
  band; every output that consumes it — the load-transfer split — is `INFERRED` and carries the words
  "all else equal".
- **Grip is not an output at any tier.** No grip value, no composite score, nothing to compute: the
  only permitted sentence is the qualitative `inferred` claim §4.11 allows.

*Cost of being wrong:* a banded ζ is still a claim about damping, and if users read a band as a
tolerance for judging a setup change the chip must get louder (Risk 6). *Revisit:* the day a damper
document exists (§4.8's option 3, the drop test), ζ moves to `firm` for users who run it — the state
machinery is what makes that a data change rather than a rewrite.

## 9. Testing strategy

| Layer | Proves | Volume |
|---|---|---|
| Physics unit (`dart test`) | each formula against a cited hand calc in `docs/specs/physics/` | ≥1 per public function |
| Golden numeric (JSON: input → expected → tolerance → `source`) | no regressions; every expected value traceable | per module + one full vehicle |
| Result type (`dart test`) | every reason code reachable from a fixture; per-field independence (G02.7); `NotMeasured` names ≥1 field; every `inferred` envelope carries a band and a procedure; no `null`/`NaN` at any boundary | one fixture per reason code and per tier |
| State derivation (`dart test`, `setup_data`) | one fixture per §4.4.1 state, and the precedence order: a value that is both out of domain and estimated reads `OUT_OF_DOMAIN`; a missing field under each of the four `on_absence` policies produces its own state | 8 states × 4 policies |
| Property/fuzz (seeded) | no `NaN`/`Inf` escapes; every `Undefined` carries an enum reason; tier propagation never improves an output above its weakest input | 10k cases, <2 s |
| Adapter (`dart test`) | mm/g/deg → SI and back; the 0.1 mm grid sweep; one conversion site; provenance tags survive the round trip | every stored quantity × both directions |
| Document/migration (`dart test`) | assets validate; load→save identity; v(n)→v(n+1) byte fixtures; RFC 8785 hash fixtures; kill between temp write and rename (E8.12) | all assets, all fixtures |
| Presentation (`dart test`, headless) | envelope + schema → `PropertyView` for every state; band present whenever `INFERRED`/`ESTIMATED_INPUTS`; basis sentence ends "all else equal" for behaviour claims; marks derived from provenance and `plausible`; no delta against an absent value; ζ never marked `validated` | per output |
| Gate stages (`tool/gate.dart`'s own tests) | each stage fails on its seeded failure, naming the defect: `@SpecTest` deleted / unknown / LATER-annotated (E9.9); one `on_absence` deleted, unknown `consumed_by`, altered Markdown cell, version without fixture (E9.10); `INTERNET` added to the manifest (E8.1); an analytics package added (E8.13) | one seeded test per stage |
| Gate hygiene (static) | no unit literal in `packages/setup_physics/lib` or `lib/src/features`; no Flutter import in physics; no formatting outside `lib/src/units`; every golden ID has a test | one test each |
| Widget, semantics guidelines, golden image | slider updates the number; equation expands; tap targets hold; painters do not drift; at 2.0 text scale every value's full string is in the semantics tree (E8.7b) | thin, per screen |
| Performance | E3.12: p50 ≤ 16 ms, p99 ≤ 25 ms over 1,000 recomputes; drag: ≥ 95% of 600 frames within 16.7 ms and none over 32 ms. CI emulator proxy p50 ≤ 40 ms / p99 ≤ 80 ms, gated at 2× the target so a real regression trips it and a noisy runner does not | 3 models |

Tolerances live in the fixture, not the test body: 1e-9 relative for closed-form algebra, 1e-6 for
iterative work *with the iteration count and bracket fixed by the spec* (M13 — a tolerance on a
finite-difference or a bisection is meaningless without the step), and absolute only where a value
legitimately approaches zero, with the fixture saying why. A blanket 1e-9 across devices is not
achievable downstream of a bisection and is not what this harness asserts.

`--update-goldens` is forbidden for numeric fixtures (fine for images): a reviewer must be able to
reject a changed expected number whose `source` did not change.

**CI must gate:** zero analyse issues; every layer above. **Must not gate:** coverage percentage or
warning counts. **No retries:** a retried test hides a race.

## 10. GitHub Actions and the gate

**The gate is `cd app && dart run tool/gate.dart` (D-09, recorded in `AGENTS.md`).** One command,
because the convention's rule is that a gate is one exact command and the workspace has three
packages — two of which the app-scoped commands cannot see reliably (`flutter test` in `app/` does not
walk `packages/*/test/`, and `flutter analyze`'s coverage of workspace members is version-dependent).

E9.8 fixes the stage list, and the gate must match it exactly in both directions — a stage in
`gate.dart` with no AC fails the spec audit, and a stage named in E9.8 but missing from `gate.dart`
fails the gate:

| Stage | What it does | AC |
|---|---|---|
| `analyse` | `flutter analyze` in `app`, `dart analyze` per package; zero issues | E9.8 |
| `test` | `flutter test` in `app`, `dart test` per package — including the schema, migration, adapter, tier, presentation and grep tests above | E9.8 |
| `spec-audit` | every MUST id in the requirements has a `@SpecTest('<id>')`, every annotation names a real id with the same tag and release marker, no LATER id is annotated | E9.9 |
| `schema` | `fields.yaml` ↔ Markdown tables ↔ generated Dart table ↔ fixtures: every field once per kind with `on_absence ∈ {ASSUME, ESTIMATE, REFUSE, OMIT}` (`ESTIMATE` with a procedure id and `band: true`; `ASSUME` with a value, which must lie inside the field's own `plausible` interval), every `consumed_by` id exists, one fixture per written `schema_version`, generator output current | E9.10 |
| `ip` | no predecessor names, no `.sdf`/database asset, no 8-word overlap the corpus check rejects | E9.4, E5.4 |
| `manifest` | the merged Android manifest has no `INTERNET` permission and `minSdkVersion ≥ 26` | E8.1 |
| `dependencies` | no analytics, advertising or crash-reporting package in the resolved set; Privacy screen text equals `docs/release/privacy.txt` | E8.13 |
| `strings` | no user-facing string assembled by concatenation; every string resolves from the bundle; no forbidden claim word (grip score, faster, lap time…) | E5.6, E8.9a |

Eight stages, each with its own seeded-failure test: that combination is the answer to D6. The old
draft's single `spec_audit` tool that no AC required is gone — every stage is now named by a criterion,
and the criteria require the stage to fail when the defect is injected.

`gate.dart` runs every stage even after a failure, prints each command and its exit code, and exits
non-zero if any failed: a gate that stops at the first failure costs one round trip per fix. *Cost of
the indirection:* a contributor who runs `flutter test` locally gets a green that is not the gate —
mitigated by `gate.dart` printing what it runs, and by the PR template asking for its output (E9.8
requires the output in the PR).

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
(§11); CI proves the code analyses, tests and builds. A size-diff job (E8.11, warn above 1 MB) joins
when that criterion lands — it is R2, so it is not in v1's workflow.

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
| Minimum OS | minSdk 26 (Android 8.0), asserted by the gate's manifest stage (E8.1) | iOS 15.0 — deferred |
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
   permission, which a reviewer can check. The submitted declaration's public URL is recorded in
   `docs/release/checklist.md` (E8.13c), and the in-app Privacy screen's text is
   `docs/release/privacy.txt` exactly, asserted by the gate's dependency stage.
5. **The content rating questionnaire** (IARC) and the listing assets: icon, feature graphic,
   screenshots, description. The store listing's numbers may not use any figure D-08 marks
   illustrative, and no listing text may carry a claim the string audit rejects (E5.6).
6. **A trademark check on the name** before the listing exists. A listing renamed later loses its
   reviews and its install history.
7. **A release checklist per version** — `docs/release/checklist-<version>.md`, every item of the
   requirements' release checklist present with a reviewer name, a date and an evidence path (E9.3).
   It is the only artefact that records measurements the CI cannot take, including the reference-device
   timings (E3.12) and the AAB download size (E8.11's ≤ 25 MB, R2).

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
  people. *Revisit trigger:* the first output reaching evidence `validated`, or the first request from
  an iOS user,
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

**3. Repeated solves.** A full two-axle analysis is E3.12's p50 ≤ 16 ms budget, and one axle is a
fraction of it; the 60 Hz reference frame is 16.7 ms (8.3 ms on a 120 Hz panel), so the risk is not the
maths but rebuilding widgets and charts around it. In order: derived provider (one solve per frame),
`select` on leaves, `RepaintBoundary` on charts, and only then `Isolate.run` with latest-value-wins —
an isolate hop (~0.2–1 ms plus serialisation) can cost more than the work it offloads. A per-field
result struct carrying a band, a basis and a provenance set makes the payload larger; `select` is what
keeps that from reaching a repaint, and it is why the envelope is built once per solve rather than
per read.

**4. Accessibility** — three specific failures rather than an aspiration: (a) the results table at
200% text scale, designed against `TextScaler` and tested at 2.0, not 1.0; (b) the painter as sole
carrier of information, so every visual has a table equivalent and a `Semantics` label; (c) sliders as
the only input, so every slider has a text-field fallback that also fixes precise entry. Plus 48 dp
targets, 4.5:1 contrast, colour never the only encoding, and a reduce-motion path. The tier and the
band are part of this: state must be readable as text, not only as a colour, a tilde or a chip, which
is why E8.8's semantics assertion names the validation state explicitly.

**5. Two lists checked by people, not by tests.** The generated schema table against the requirements'
Markdown, and the evidence inventory against `99-validation`'s log. The first is partly mechanised
(E9.10 regenerates the Markdown and fails on a hand edit); the second is deliberately not, because a
parser over prose is the circular gate D6 named. Residual risk stated plainly: an evidence level can be
raised in code with no log row, and only a reviewer stops it.

**6. A band is not a tolerance.** Once the app prints a band next to a damping ratio, a user can read
it as "this number is good to this much" — which is true — or as "a change this large is real" — which
is not, because two banded estimates do not have a banded difference of the same width. The mitigation
is one sentence in the band's help text and a compare row that shows both bands rather than one delta;
E3.6(e)'s rule that the compare view leads with the signed change is the same mitigation, seen from the
other end. The cost of getting it wrong is a user tuning to noise with the app's blessing.

## Open questions

1. **Where community chassis models live**: `app/assets/models/` in this repo (reviewable, but model
   PRs inflate app history) or a separate models repo bundled at build time. v1 assumes in-repo.
2. **Are `speculative` advice items the same type as outputs?** §4.11 gives `speculative` to a
   suggested change from the setup-sheet interpreter (E2.13), which is advice rather than a result. Two
   options: reuse `PropertyView` with `tier: speculative` (one type, one renderer, but an advice item
   can then be mistaken for an output by any code that filters on "is a PropertyView"), or a separate
   `AdviceView` that *contains* one (a second type at the boundary, and the export needs both). Not
   decided here because the interpreter is R2; the cost of deciding late is a migration of every
   advice surface, not of the documents.
3. **Does `on_absence` live in `fields.yaml` or only in the requirements tables?** E9.10 now makes the
   YAML normative, so the manifest reading is the default; the open part is whether the *assumption
   marks* and the `missing`/`estimated` mapping are generated from it too or hand-written per field.
4. **iOS enrolment type, when D-10 is revisited**: individual (immediate, personal name on the
   listing) or organisation (D-U-N-S, weeks, not retrofittable). Recorded so it is not re-decided from
   scratch.
