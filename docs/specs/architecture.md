# Architecture — Setup Lab

Status: proposal. v1 targets Android and iOS; desktop and web follow from the same source.
Companions: `docs/intent.md`, `docs/specs/spec.md`, `docs/specs/plan.md`; the spec wins where they
disagree. `Ex.y` and `P-nn` references below are spec requirements and performance targets, not new
decisions. Toolchain: Flutter 3.47.9 / Dart 3.13.7 (Oct 2026).

## Thesis

**The solver is pure Dart**: SI in, SI out, no JSON, no widgets. **The on-disk document is the
truth, never regenerated from computed values**: solving is one-way, document → SI → result. **The
UI renders solved scenes and formatted numbers**: no trigonometry in a widget.

The failure modes this is built against are the predecessor's: a 2019 poster reported every save shaving 0.2 mm
off rear track width, cumulatively; another lost shock mounting positions by zooming
(`docs/research/forum/rctech-thread.md`). Both are state-boundary bugs, not maths bugs.

## 1. Repository and package layout

```
app/
├── pubspec.yaml, .flutter-version   # workspace root = app package; pinned toolchain
├── lib/main.dart, lib/app.dart      # MaterialApp.router, theme, text scaling
├── lib/src/{router,state}/          # route tree and shell; every Riverpod provider
├── lib/src/features/                # garage / setup / results / compare / learn / settings
├── lib/src/{units,io,widgets}/      # format+parse; DocumentStore/share/pick; chart wrappers
├── assets/models/                   # bundled chassis JSON (CC BY 4.0)
├── test/                            # widget, golden-image, semantics tests
├── tool/gate.dart                   # the single gate command (§8)
└── packages/
    ├── setup_physics/               # pure Dart: lib/src/{geometry,axle,vehicle,result}, test/
    └── setup_data/                  # pure Dart: lib/src/{document,schema,migrate,adapter}, test/
```

| Package | Depends on | Never imports | Enforced by |
|---|---|---|---|
| `setup_physics` | `meta` | Flutter, `dart:io`, `dart:ui`, `setup_data` | pubspec test (review rule 3) |
| `setup_data` | `setup_physics` | Flutter, `dart:io` | same |
| app | both | — | — |

**Why three.** Physics must be JSON-free or it becomes untestable headless and grows compatibility
shims; data must be Flutter-free because its migration tests churn most. `adapter/` is the one place
mm becomes metres — review rule 6, made structural.

**One resolution.** All three are pub workspace members: one lockfile, one `pub get`. Verified on
Dart 3.13.7 — `dart analyze` from the workspace root reports errors inside `packages/setup_physics`,
so the existing gate command covers the pure packages. Whether `flutter test` walks members' `test/`
trees is unproven; assume not (§8 makes it moot).

**Models are validated assets:** a test walks `assets/models/*.json` through the importer's schema
and fails on any measurement without a `source` (review rule 1, mechanised).

*Cost:* a physics change touches two pubspecs. *Revisit:* if `adapter/` stays under ~300 lines after
v1, fold `setup_data` into the app.

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
`ref.watch(x.select(...))` so a roll-centre readout does not rebuild when a spring rate changes. DI
is free: `DocumentStore` is a provider override in tests, no `BuildContext`.

**Containment is the risk control:** Riverpod types appear only under `lib/src/state/`. **Coalesce,
never debounce:** mutations land immediately, a `Ticker` marks the solve dirty once per frame, only
the newest value is solved — debounce would show stale numbers.

*Cost:* the provider graph is the least obvious of the three to a generalist. *Revisit:* if a feature
needs real async streams (BLE timing, lap timer) — Bloc's home turf.

## 3. Routing and information architecture

**Pick: `go_router` 18.x, `StatefulShellRoute.indexedStack`, four branches — Garage, Setup, Results,
Learn.**

| Route | Screen |
|---|---|
| `/garage`, `/garage/car/:carId` | car list, car detail |
| `/car/:carId/setup/:setupId` | setup sheet — where users live |
| `…/results`, `…/results/:propertyId` | computed properties; each row expands to its equation; deep-linkable from lessons |
| `/compare?a=&b=`, `/learn/:lessonId`, `/import` | side-by-side, lessons, file-open target |

`indexedStack` keeps each branch's stack alive, so switching tabs mid-edit returns you where you
were. **Android back** pops within the branch, then switches to Garage, then exits — an explicit
`PopScope` rule, not a default. **iOS swipe-back keeps working** because every edit autosaves within
500 ms: nothing to discard, so no guard and no `canPop: false`. Lesson → `/results/:propertyId` is
intent item 4 (teaching at the point of use) as a routing decision.

*Cost:* go_router ships frequent majors; the tree is one file with hand-written typed builders.
*Revisit:* if tablets want two independent panes, that is a `Navigator` per pane; the shell branches
are the right seam.

## 4. Persistence

**Pick: one versioned JSON file per document, written atomically, under
`getApplicationSupportDirectory()/setuplab/`.**

```
setuplab/
├── models/<model_id>/<content_hash>.json   # immutable revisions (spec §4.1.6)
├── models/<model_id>/current               # one line: the live hash
├── setups/<setup_id>.json                  # references (model_id, content_hash)
└── .trash/
```

Model revisions are immutable and setups address one by hash, so editing a model cannot silently
change what a saved setup meant (E2.7). The filename drops the `sha256:` prefix, which some
filesystems reject. `current` is a pointer, not a copy — if it is lost, the library rebuilds it by
scanning the directory.

Application Support, not Documents, on iOS: backed up, app-managed, and not advertising files to
Files.app that the user cannot usefully open. Sharing is export. Writes are atomic — `*.json.tmp`,
flush, rename — because a partial write on a phone that dies at the track is a lost car model.

**Why not drift / Isar / sqflite.** Three queries over a few small files. A database adds a second
migration language, codegen, platform channels and all-or-nothing corruption, and turns a community
contribution from a readable diff into a binary. Models are data and must outlive the app: RC3's
library died inside a proprietary engine.

*Cost:* listing means parsing files. A startup-built in-memory index covers it, and deliberately no
index *file* — a second source of truth is a consistency bug. *Revisit:* P-05 (open a model, ≤300 ms)
or P-06 (200 models scrolling at 60 fps) missed on the reference device, or full-text search over
setup notes.

```json
{ "schema_version": "1.0.0", "kind": "car_model", "id": "mdl_8f2c41",
  "units": { "length": "mm", "angle": "deg", "mass": "g" },
  "sources": { "s1": { "type": "measured", "method": "digital caliper", "by": "DW" } },
  "axles": { "front": { "corners": { "left": { "lower_arm":
      { "outboard": { "v": [0.0, -80.0, 10.5], "s": "s1" } } } } } } }
```

- **Document units are mm / g / deg; solver units are m / kg / rad.** `0.042` is unreadable in a PR; a
  millimetre is what a caliper says.
- **Every value is `{"v": number, "s": sourceId}`**, resolving into the document's `sources` map; a
  whole caliper session is one source (§4.1.2). `x_`-prefixed keys we do not understand are preserved
  and written back. A greater `schema_version` **major** is refused with a plain message, never parsed
  best-effort — silent degradation is how the 0.2 mm bug happened.
- **Export** via `share_plus` 13.x shares the file itself (AirDrop, email, Files). **Import** via
  `file_picker` 13.x plus OS file-open handling so tapping a model in Mail opens the app
  (`CFBundleDocumentTypes` on iOS, an `<intent-filter>` on Android; `*.model.json` / `*.setup.json`
  keeps filters precise, since `kind` already tells them apart).
- **The interface is bytes, not paths**: web has no paths, Linux has no share sheet, and keeping
  paths out now is what makes §10 cheap. Import never merges — an id collision gets a new id, the
  file's own `sources` travel with it, and the UI previews what will be added.

## 5. Charting and geometry drawing

| Need | Tool | Why |
|---|---|---|
| Roll angle vs lateral g, CG height vs g, spring force vs g, damper force and damping ratio vs shaft velocity, LLT split vs roll stiffness | `fl_chart` 1.3.x | 10–200 point series, axes, ticks, tooltips, legends, touch. Reimplementing is a week for a worse result. |
| Suspension elevation: hardpoints, links, instant-centre rays, roll centre, contact patch, roll animation | `CustomPainter` + `InteractiveViewer` | A diagram, not a chart. Pinch-zoom and tap-a-hardpoint are requirements. |

**The rule:** every plot consumes a `Series` value object (label, points, axes, unit) from a pure
presenter under `features/results/presenters/`, tested headlessly; every geometry view consumes a
`GeometryScene` computed by `setup_physics`. A painter that calls `atan2` is a review failure.

At most three files import `fl_chart`, all under `lib/src/widgets/charts/`: single-maintainer
package, history of breaking majors, and a line chart in `CustomPainter` is two days if it dies. It
has no log axis and damper curves want one (5–1000 mm/s) — transform to `log10` in the presenter.
Charts sit behind a `RepaintBoundary`, animation duration zero during drags.

## 6. Units and measurement

| Quantity | Document | Solver | Display |
|---|---|---|---|
| Length | mm | m | mm, 1 dp |
| Mass | g | kg | g |
| Spring rate | N/mm | N/m | N/mm |
| Angle | deg | rad | deg, 2 dp |

1. **One conversion point**: `setup_data/lib/src/adapter/units.dart`, once per solve — never in the
   solver, never in a widget.
2. **Divide by 1000; do not multiply by 1e-3.** Across 5,001 mm values on a 0.1 mm grid, `mm / 1000`
   round-trips exactly 4,994 times (worst error 2.8e-14 mm); `mm * 1e-3` fails 644 times. One makes
   strict round-trip tests fail at random, which teaches people to loosen tests.
3. **No computed value is ever written back into a document.** Display rounding is one-way, so files
   only ever contain numbers a human or a caliper produced.
4. **No unit literal in a feature widget**: a test greps `lib/src/features/` for `'mm'`, `' g'`,
   `'deg'` and fails. Metric only in v1, behind `QuantityFormat`: imperial is a US-club reality, and
   adding it must mean adding formatters, not touching the solver.

Round-trip tests at three levels: converter (`mm → m → mm`, tolerance 1e-9), string
(`format(parse(s)) == s` for every string the UI can produce), document (reload and re-save is
byte-identical; `x_` keys survive a fuzz round trip). The string level is the one that would have
caught 0.2 mm per save.

## 7. Testing strategy

| Layer | Proves | Volume |
|---|---|---|
| Physics unit (`dart test`) | each formula against a cited hand calc in `docs/specs/physics/` | ≥1 per public function |
| Golden numeric (JSON: input → expected → tolerance → `source`) | no regressions; every expected value traceable | per module + one full vehicle |
| Property/fuzz (seeded) | no `NaN`/`Inf` escapes; every `Undefined` has a reason | 10k cases, <2 s |
| Document/migration (`dart test`) | assets validate; load→save identity; v(n)→v(n+1) fixtures | all assets |
| Widget, semantics guidelines, golden image | slider updates the number; equation expands; tap targets hold; painters do not drift | thin, per screen |
| Performance | P-01 ≤16 ms and P-03 ≤2 ms on the reference device, gated at 2× the target so a real regression trips it and a noisy runner does not | 3 models |

Tolerances live in the fixture, not the test body: 1e-9 relative for closed-form algebra, 1e-6 for
iterative work, absolute only where a value legitimately approaches zero — and then the fixture says
why. `--update-goldens` is forbidden for numeric fixtures (fine for images): a reviewer must be able
to reject a changed expected number whose `source` did not change.

**CI must gate:** zero analyse issues; all of the above; the physics-has-no-Flutter pubspec test; the
no-RC3-string grep; asset schema validity. **Must not gate:** coverage percentage or warning counts.
**No retries:** a retried test hides a race.

## 8. GitHub Actions

`tool/gate.dart` exists because the two gate commands are scoped to the app package and the workspace
has three — and the rule is that a gate is one exact command. Three jobs: `gates` (analyse, all
tests, goldens, asset audit; ~2 min, every PR), `build-apk --debug` (~4 min, every PR), `build-ios
--no-codesign` (~8 min at 10× minutes, `main` and tags only).

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
  build-ios:                    # macOS minutes cost ~10x: main and tags only
    if: github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/tags/v')
    needs: gates
    runs-on: macos-15
    steps:
      - uses: actions/checkout@v4
      - uses: subosito/flutter-action@v2
        with: { flutter-version-file: app/.flutter-version, cache: true }
      - run: flutter build ios --no-codesign
        working-directory: app
```

`gate.dart` runs `flutter analyze`, `flutter test`, `dart test` per pure package, the asset audit,
and `spec_audit.dart` once it exists — printing each command so a red build is debuggable. Golden images compare only against the
same pinned Linux image and Flutter version — that pairing is what makes them stable. **No signing
secrets in CI in v1**: builds are unsigned here, signed locally by Dave. Dependabot covers pub and
Actions; a monthly PR against `.flutter-version` keeps the bump reviewable.

## 9. Path to the App Store and Google Play

| | iOS | Android |
|---|---|---|
| Identifier | `io.github.<owner>.setuplab` | same string as `applicationId` |
| Version | `1.2.3+45`, tag `v1.2.3` | same |
| Minimum OS | iOS 15.0 | minSdk 26 (Android 8.0; spec D8, E8.6) |
| Target | iOS 26 SDK (required since 28 Apr 2026) | compile/target 36 (Play floor was API 35 by 31 Aug 2026; rolls each August) |
| Account, signing | Apple Developer Program ($99/yr), Xcode automatic + App Store Connect key | Play Console ($25 once), keystore + Play App Signing |

**Bundle id, decided once.** `io.github.<owner>.setuplab` uses an identifier GitHub already verifies,
needs no domain, and reads cleanly in a listing. Changing it later means a new listing with no
reviews and no install history. **App version and document `schema_version` are unrelated** —
conflate them and you cannot ship a bug fix without migrating every saved car. Build numbers must
increase monotonically on both stores, including re-uploads after rejection.

Dave must own what no contributor can: the **Apple Developer Program** (individual is immediate and
puts his personal name on the listing; organisation needs a D-U-N-S number and weeks, and cannot be
switched retroactively); **a Mac or macOS CI minutes** (iOS builds cannot happen on Linux: a used Mac
mini ≈£400 once, or runners ≈£10–20 per release); the **Play Console**, including for personal
accounts the 12-tester / 14-day closed test before production — a two-week schedule constraint, not
a formality; the **signing keys** (Android keystore, whose loss is unrecoverable); a **privacy policy
URL**, required even when nothing is collected; and a **trademark check** on the name.

What stays free and verifiable: no IAP, no accounts, no analytics or crash SDK, no ads, and an
Android manifest **without the `INTERNET` permission** — making "works offline" a property the OS
enforces and a reviewer can see. The public claim is "free to use, no account, no server, no ads"
rather than "zero cost to run", which the owner's bank statement would contradict (spec D9). Privacy
labels: "Data Not Collected".

*Cost:* "thin app" rejection is the likely failure; equation expansion and lessons are the answer.
*Revisit:* if the family or estate wants any commercial arrangement, "free forever" changes and so
does this section.

## 10. Desktop and web, later, from the same source

| Carries over | Breaks | Fix |
|---|---|---|
| physics, data, tests, routes, features | window sizes | 900 dp breakpoint decided now, not retrofitted |
| charts and painters | wheel/trackpad zoom, keyboard nudge | `Listener` around `InteractiveViewer`; arrow-key nudge |
| JSON documents, export | no `path_provider` (web), no share sheet (Linux) | `DocumentStore` interface + IndexedDB impl |

Three things to build in v1 *because* they are cheap now and expensive later: `DocumentStore` as an
interface with one implementation (a week versus a rewrite); a bounded undo stack (20 snapshots per
document, not a command pattern — desktop expects ⌘Z); and `LayoutBuilder` breakpoints from the first
screen, because phone-only → two-pane re-does the IA.

Web additionally needs `dart:io` unreachable from shared code (already banned in both pure packages)
and CanvasKit trimmed at startup; `dart2js` and wasm doubles are still binary64, so results are
identical. *Revisit:* desktop when someone with a laptop asks. Web never, unless a "try before
install" link turns out to matter.

## Risks

**1. Precision is not the risk it looks like; conditioning is.** `double` is IEEE-754 binary64 on
every target and a 0.1 mm measurement carries four significant digits against sixteen available;
measured mm→m→mm error across 5,001 values is 2.8e-14 mm. But for a typical 55 mm lower arm the
instant-centre distance behaves as ≈ 0.047 / sin(Δθ) metres, Δθ being the angle between the links:
5.9° gives 0.48 m, 0.9° gives 2.9 m, 0.08° gives 31.5 m — and there a 0.1° change in link angle moves
the instant centre 38 m. No precision fixes that: the *input* resolution does not support the answer.
So the solver reports conditioning — `Defined`, `LowConfidence` below |sin Δθ| ≈ 1e-2, `Undefined`
below 1e-4 — and the UI says the geometry is nearly parallel and the number is not meaningful.

**2. Degenerate geometry** — parallel links, zero-length links, coincident hardpoints, crossing links.
A sealed `Solved<T>` result, `Defined(value, conditioning)` or `Undefined(reason)`; no `null`, no
`NaN` at any public boundary. Property tests over 10k seeded geometries assert no `NaN`/`Inf` in any
`Defined`, every `Undefined` carries a reason, and every `Defined` sits in a plausible envelope or is
downgraded. The UI renders `Undefined` as "undefined for this geometry" plus the hardpoints that
caused it — never blank, never zero.

**3. Repeated solves.** A full two-axle analysis is P-01's ≤16 ms budget, and one axle is a fraction
of it; the 60 Hz reference frame is 16.7 ms (8.3 ms on a 120 Hz panel), so the risk is not the maths
but rebuilding widgets and charts around it. In order: derived provider (one solve per frame),
`select` on leaves, `RepaintBoundary` on charts, and only then `Isolate.run` with latest-value-wins —
an isolate hop (~0.2–1 ms plus serialisation) can cost more than the work it offloads.

**4. Accessibility** — three specific failures rather than an aspiration: (a) the results table at
200% text scale, designed against `TextScaler` and tested at 2.0, not 1.0; (b) the painter as sole
carrier of information, so every visual has a table equivalent and a `Semantics` label; (c) sliders
as the only input, so every slider has a text-field fallback that also fixes precise entry. Plus 48
dp targets, 4.5:1 contrast, colour never the only encoding, and a reduce-motion path.

## Open questions

1. **Gate command.** §8 replaces the two exact commands with one (`dart run tool/gate.dart`) to cover
   three packages. Confirm, or name the one to keep verbatim and the third to add.
2. **Three packages or two?** `setup_data` buys fast pure-Dart tests and a hard no-Flutter wall, at
   the cost of one more pubspec for contributors.
3. **Mac access and Apple enrolment type**: used Mac mini or macOS CI minutes; individual (immediate,
   personal name on the listing) or organisation (D-U-N-S, weeks)?
4. **Where community chassis models live**: `app/assets/models/` in this repo (reviewable, but model
   PRs inflate app history) or a separate models repo bundled at build time. v1 assumes in-repo.
5. **Publish measurement uncertainty per result** in v1? Risk 1 makes it nearly free, and no RC tool
   has offered it — but it is scope.
