# Round 4 review — stack-switch audit (Flutter → React/TypeScript PWA per D-19)

Reviewer: Kimi. Scope: every document against D-19 (`docs/decisions.md:104-126`).
Verdict up front: **no implementation should start.** D-19 exists only in `docs/decisions.md`;
every normative document still specifies Flutter, Dart, Android and Google Play, and several
R1 MUST acceptance criteria are now unsatisfiable by construction. The physics corpus is the
only part that survives untouched — which is exactly what D-19:121-122 promises.

---

## 1. Every stack residue, by file

### 1.1 `AGENTS.md` — contradicts D-19 on almost every operative line

- `AGENTS.md:3` — "Setup Lab: a free Flutter app that calculates RC car setup physics."
  → "a free reactive web app (React + TypeScript PWA)".
- `AGENTS.md:18` — "app/ Flutter app: lib/ (ui), packages/setup_physics (pure Dart, no Flutter)"
  → new layout: `app/` Vite project, `packages/setup_physics` pure TS (no DOM, no React),
  `packages/setup_data` pure TS.
- `AGENTS.md:19` — "app/test/ unit + golden tests" — golden *numeric* tests survive;
  "golden" as a Flutter test type does not. Reword to "unit + golden numeric tests".
- `AGENTS.md:30` — skill routing "| Flutter feature work (TDD) | `test-driven-development` |"
  → rename the stage to "Web app feature work (TDD)"; the skill can stay.
- `AGENTS.md:38` — "cd app && dart run tool/gate.dart   # the one gate: analyse + test across
  all packages, schema checks" → `npm run gate` (D-19:114).
- `AGENTS.md:41-43` — "`gate.dart` is the published gate … It runs, per package, exactly
  `dart analyze` and `dart test`" → typecheck (tsc) + unit tests per package, plus the
  schema/migration checks. The *contract* (one command, no package skipped) survives; the
  implementation does not.
- `AGENTS.md:64` — "Dart `double` is not a CAD kernel" — the warning survives (JS `number`
  is the same IEEE-754 binary64); the word "Dart" must go.

### 1.2 `README.md`

- `README.md:5` — "a free, cross-platform (Flutter) workbench" → React/TS PWA.
- `README.md:31` — "| Flutter app | `app/` | not started |" → "Web app (React + TS, PWA)".
- `README.md:51` — "app/ Flutter application (analyze + test are the gates)" → Vite app,
  `npm run gate` is the gate.

### 1.3 `docs/decisions.md` — internally inconsistent after its own edit

- D-19 is inserted **out of order**: it sits at `docs/decisions.md:104`, *before* D-18 at
  line 128, despite the header (line 3) saying "Ordered by number." Move D-19 after D-18.
- `docs/decisions.md:8-10` — D-09 still rules the gate is `dart run tool/gate.dart`.
  D-19:114-115 says `npm run gate` "replaces" it. D-09 must be annotated *superseded by
  D-19* (the gate-command principle stands; the tool does not), not left reading as live.
- `docs/decisions.md:14-17` — D-10 ("iOS is deferred; Android first … Flutter stays") is
  declared superseded at D-19:117-118 but the entry itself carries no marker, and its
  rationale ("Flutter stays (a single codebase keeps iOS a later build target)") is now
  void. Annotate superseded and record the new rationale (one URL serves both platforms).
- `docs/decisions.md:85` — D-16: "Prose tables and the generated Dart table are *views*"
  → "generated TypeScript table".

### 1.4 `docs/intent.md`

- `intent.md:51` — "**Flutter**, single codebase, targeting Android/iOS first
  (store-shippable), then desktop" — the intent's own platform sentence. Rewrite as
  React/TS PWA; note D-19 made the store path *less* relevant, not more.
- `intent.md:54` — "**Physics is a pure Dart package** with no UI dependency" → pure
  TypeScript package with no DOM dependency. The principle (headless-testable) survives.

### 1.5 `docs/review-rules.md`

- Line 11: "`flutter test test/traceability_test.dart` fails on any model entry with an
  empty `source`." → the test survives; the runner is the TS test runner under `npm run gate`.
- Line 17-19: "`app/packages/setup_physics` must not import Flutter … `flutter analyze`
  plus a test that asserts the package's pubspec has no Flutter" → "must not import the DOM
  or React; a lint/build error asserts `packages/setup_physics/package.json` has no UI
  dependency." The wall is still the right idea (architecture.md:76-77); the mechanism changes.

### 1.6 `docs/specs/spec.md` — the largest residue; several ACs are dead, not renamed

- `spec.md:124` — "v1 (R1) is the Android release" → v1 is the PWA release.
- `spec.md:136` — "The rest of v1: the first Android store submission. **38 MUSTs**"
  → there is no store submission. The R1 definition itself must be re-anchored.
- `spec.md:192` — "Flutter, Android first (D-10) … v1 ships Android only; iOS is deferred"
  — superseded by D-19. The 320 dp touch requirement survives as a *viewport width*
  requirement; "dp" is an Android density unit and should become CSS px throughout the spec
  (also E8.6:931-934, E8.7a:937-939, flows.md:55,279,676, design-system.md:270-271).
- `spec.md:195` — "Physics in a pure Dart package" → pure TS.
- `spec.md:202` — "`cd app && dart run tool/gate.dart` is the only entry point CI runs"
  → `npm run gate` (also E9.8:1065, decision table line 2377).
- `spec.md:756` (E6.2) — "a harness can drive (file picker, `ACTION_VIEW` intent,
  share-sheet target)" — `ACTION_VIEW` is an Android intent. A PWA imports through the
  browser `<input type="file">` picker / File System Access API; there is no OS file-open
  intent. Rewrite clause (b).
- `spec.md:904-905` — "v1 ships Android only (D-10), so every criterion here is written
  against the Android artifact; Apple clauses are R2 by construction." — the E8 epic
  preamble is void. Both phone platforms are in scope from day one (D-19:117-118); that
  *widens* the test matrix (Safari/WebKit becomes an R1 concern, not R2).
- `spec.md:908-913` (E8.1, R1 MUST) — "the gate's manifest stage inspects the merged
  manifest … no `INTERNET` permission and a `minSdkVersion` of 26" — **unsatisfiable**:
  there is no Android manifest. The *goal* (offline is enforced, auditable) survives as a
  service-worker test: assert the app shell and all compute complete with the network
  disabled (Playwright offline mode), and that no code path fetches. This is a rewrite, not
  a rename, and E9.8's stage list (`spec.md:1067` "manifest (E8.1)") must change with it.
- `spec.md:931-934` (E8.6) — "a device running Android 8.0 (API 26) or later" → a browser
  support statement (e.g. last-two Safari/Chrome/Firefox). "320/411/1024 dp" → CSS px.
- `spec.md:962` (E8.9a) — "a lint rule on string interpolation inside user-facing widgets"
  → "inside JSX/components". Survives as rename.
- `spec.md:971-975` (E8.11) — "the Android App Bundle download for a phone is ≤ 25 MB and
  the installed footprint is ≤ 60 MB" — **unsatisfiable as written**; there is no bundle.
  Replace with a web budget: total first-load transfer (gzipped) and Cache Storage
  footprint. 25 MB is absurdly generous for the web; a realistic budget (~2–3 MB transfer)
  should be a new decision, not a silent renumbering.
- `spec.md:983-988` (E8.13) — "adding one to `pubspec.yaml` makes the check exit non-zero"
  → `package.json`; "(c) the Play data-safety declaration … with its public URL" —
  **unsatisfiable**: no Play Console exists. Clause (c) is deleted, not rewritten.
- `spec.md:1046` (E9.5) — "measured from app install to the first analysis screen"
  → "from first page load / Add to Home Screen".
- `spec.md:1065-1070` (E9.8, R1 MUST) — gate command and stage list name `gate.dart` and
  the `manifest` stage. Rewrite per D-19:114.
- `spec.md:1110-1116` (release checklist) — C-01 (store listing/screenshots), C-02
  (`bundletool`/`aapt` output), C-06 (Play data-safety) are all store artifacts. C-01 and
  C-06 must be deleted or replaced (PWA manifest/Install prompt text review; Lighthouse/
  bundle-size output). E9.3's checklist parse will otherwise fail or, worse, be satisfied
  with fabricated store evidence.
- `spec.md:2314-2315` — "(C-02). No bundled model library beyond the example models" —
  fine, but its size rationale is store-shaped; recheck after E8.11's rewrite.
- Note: `spec.md:182` and P-01 (`spec.md:2238`) keep E3.12's 16 ms recompute budget —
  see §2.9 below; that is a *re-validation* item, not residue.

### 1.7 `docs/specs/architecture.md` — effectively a Flutter document; see §2 for the
section-by-section verdict. Residue highlights beyond §2: `:12` "Toolchain: Flutter 3.47.9
/ Dart 3.13.7"; `:49-60` the pubspec/lib/packages layout; `:71-77` "Flutter, `dart:io`,
`dart:ui`" banned-imports table; `:85-92` pub workspace resolution; `:444-460` the
`sealed class Solved<T>` Dart code block; `:510` "renaming a Dart case"; `:517` "No
nullable darts"; `:691` gate-stage seeded failure "`INTERNET` added to the manifest";
`:702` "`--update-goldens` is forbidden for numeric fixtures (fine for images)" — the
numeric rule survives; "images" was Flutter's golden-image mechanism and the parenthetical
should be re-scoped to whatever visual snapshot tool is chosen (or deleted).
Also `:698-699` — a **duplicated sentence**: "achievable downstream of a bisection and is
not what this harness asserts." appears twice; delete one while the file is being rewritten.

### 1.8 `docs/specs/fields.yaml`

- `fields.yaml:8` — "so is the Dart table the validator reads (`tool/gen_schema.dart`)"
  → the TS schema table (`tool/gen_schema.ts` or equivalent). The one-YAML-one-generator
  rule (D-16) is untouched. **Everything else in this file is stack-neutral — units,
  `on_absence`, plausible, `consumed_by`, the `{value, source}` envelope. Do not touch it
  beyond this comment line** (see §4).

### 1.9 `docs/specs/physics/00-overview.md` and `99-validation.md`

- `00-overview.md:3` — "No Dart has been written against this document yet." → now trivially
  true forever; reword to "No code has been written against this document."
- `00-overview.md:4` — "Audience: the Flutter developer implementing
  `app/packages/setup_physics`" → "the TypeScript developer".
- `00-overview.md:7` — "contract for the pure-Dart physics package" → pure-TS.
- `00-overview.md:178` — "`tool/spec_audit.dart` should reject" → the gate's spec-audit
  stage (name the TS tool once chosen).
- `00-overview.md:337-338` — "The Dart test name contains the ID so `dart run
  tool/spec_audit.dart` can trace spec → test." → the TS test name; the convention survives.
- `99-validation.md:369-370` — "(`dart run tool/spec_audit.dart` is clean)" → gate name.
- All equations, golden cases, tolerances and the L0–L2 ladder in both files: untouched.

### 1.10 `docs/design/design-system.md`

- `:4` — "Applies to: the Flutter app (`app/`)" → the React app.
- `:136` — "**Roboto** (the platform default on Android), delegated through
  `Typography.material2021()` so iOS gets SF Pro" — `Typography.material2021()` is a
  Flutter API. On the web this becomes a system font stack
  (`system-ui, -apple-system, Roboto, sans-serif`); the *decision* (no web fonts, platform
  face) survives verbatim, which is convenient.
- `:173` — "never part of the same `Text` widget — they are a separate span" — `Text`
  widget → `<span>`; the a11y rationale is stack-neutral and already correct for the web.
- `:234,241` — "no `BoxShadow` except the sheet scrim" — `BoxShadow` is a Flutter class;
  becomes CSS `box-shadow`. Rename only.
- `:348` — "a `summary` (web) / `ExpansionTile` (Flutter)" — interesting: this line was
  already web-aware. Under D-19 it collapses to `<details>/<summary>`; delete the Flutter
  half and the `GestureDetector` half.
- `:569-616` — the entire "## 12. Flutter implementation map" section (`:571` and `:598`
  Dart code blocks, `:596` `ThemeExtension`, `:610` `Typography.material2021()`, `:612`
  `CardTheme`/`NavigationBarTheme`/`SliderTheme`/`SnackBarTheme`) — replace with a CSS
  custom-properties map (the token tables in §2-§3 already carry every value; this is a
  mechanical translation, but the section as written is dead). Material 3 *roles* (`:52,78`)
  survive as a token naming scheme; what dies is Material-as-Flutter-mechanism
  (`:334` "Material 3 `NavigationBar`" → a bottom-nav component built to those tokens).
- `:263` — "Haptics: `selectionClick` … `lightImpact`" — Flutter haptic APIs; on the web,
  haptics are essentially unavailable (iOS Safari: none). Mark this line as dropped or
  navigator.vibrate-only (Android Chrome). Needs a sentence of honesty, not a rename.
- `:197,203` safe-area constants — survive via CSS `env(safe-area-inset-*)`.

### 1.11 `docs/design/flows.md` and `screens.md`

- `flows.md:6-7` — "the contract a Flutter developer implements with `go_router` and
  Riverpod" → React Router (or the router D-19 names) and Zustand (D-19:113).
- `flows.md:36` — "`go_router` `StatefulShellRoute.indexedStack`, one `Navigator` per
  branch" → the branch-persistence *behaviour* (each tab keeps its own history stack) must
  be re-specified against browser history; `indexedStack` has no web equivalent. See §2.3.
- `flows.md:394` — "a swipe (destructive-ish actions are never swipe-only)" — the rule is
  good; on mobile web, list-item swipe gestures conflict with the browser's own edge
  gestures (§2.3); flag it rather than forbid it.
- `flows.md:460` — "dismissible by swipe or scrim" (bottom sheet) — same caution; the scrim
  tap and a close button must both exist.
- `flows.md:701` — "Named for a Riverpod/go_router implementation. No UI framework detail
  beyond names." → re-anchor to React Router/Zustand names, or make it genuinely neutral.
- `screens.md:165` — "Add a car (FAB, bottom-right)" — FAB is a Material component; as a
  design element it survives, but say "primary action button, bottom-right" so nobody goes
  looking for a widget.
- `screens.md:185` — "swipe-only" (destructive actions never swipe-only) — survives as a rule.

### 1.12 Wireframes

- `wireframes/index.html:323` — "the type and spacing scales the Flutter theme is built
  from" → "the web theme".
- `wireframes/index.html:326` — "The app's physics lives in a pure Dart package" → pure TS.
- The wireframes are HTML and otherwise the *most* stack-ready artifacts in the repo —
  they are already the web. No other wireframe changes needed (checked `design-notes.html`,
  `analysis.html`: no stack references beyond these).

### 1.13 `docs/procedures/measurement-session.md`

- Stack-clean. `:157` references `docs/specs/fields.yaml` and `:161` the golden cases —
  both survive. Do not touch (§4).

### 1.14 `docs/design/DECISIONS-R1.md`

- `:64-67` — quotes `flutter analyze` / `flutter test` vs `dart run tool/gate.dart` as the
  resolved gate debate — historical record; add a one-line "superseded by D-19" note, do
  not rewrite history.
- `:75-76` — "Two pubspecs make the 'no Flutter' wall a build error" → two package.json
  files, no-DOM lint. The *reasoning* still argues correctly for the new stack.
- `:94` — "Mac access for iOS builds" — dead under D-19 (one URL serves iOS).

---

## 2. `docs/specs/architecture.md` — does each section survive?

| § | Verdict | Detail |
|---|---|---|
| Header / precedence (`:3-28`) | Rename | `:3-4` cites D-10 as applied; `:12` toolchain line. The precedence table itself is stack-neutral and survives. |
| Thesis (`:31-43`) | Survives, reword | "pure Dart" → "pure TypeScript, no DOM". The one-way document → SI → result rule and the two failure-mode stories are the soul of the document; do not rewrite the logic. |
| §1 Package layout (`:46-95`) | **Rewrite** | The entire tree (`:49-60`), the banned-imports table (`:71-72`), the pub-workspace resolution (`:85-92`) and the two-pubspec cost (`:92`) are Dart-shaped. The *decisions* — physics and data as dependency-free packages, "no UI import is a build error", one lockfile — all survive as npm workspaces + lint rules. D-19:111-112 already dictates the answer. |
| §2 State management (`:99-120`) | **Rewrite** | "Pick: Riverpod 3" (`:99`) is dead; D-19:113 names Zustand. The *requirements* that drove the pick — one derived solve per edit, leaf-level subscriptions so a slider re-renders one number, containment of state types to one directory (`:117`) — are stack-neutral and must be restated as acceptance criteria on the new pick, or the rewrite loses them. |
| §3 Routing (`:127-201`) | **Rewrite, with a new decision** | go_router/`StatefulShellRoute` (`:127`) is dead. Three problems the web changes: (a) `:153-156` "Android back pops within the branch … at Garage's root it exits" — there is no app-exit; the browser Back button is *shared* with the whole tab history, and a SPA that pushes per-edit states will trap the user. The autosave argument for "no discard dialog" survives; the back-behaviour rule must be re-derived for `history.pushState`. (b) The iOS swipe-back assumption the section explicitly holds for (`:155-156`) — on iOS *Safari/PWA*, the screen-edge swipe is the **browser's** back gesture and cannot be intercepted or styled; any list-swipe or sheet-dismiss gesture near the left edge will conflict. That constraint is no longer deferred — iOS is in scope now (D-19:117). (c) Deep links (`:158-180`) survive *better* than before — URLs are native to the web — but "opens Garage with a one-line notice" for a missing car (`:172`) now collides with multi-device reality: a link to a car that lives in *another device's* IndexedDB is the normal case, not an edge case. Needs a new decision (share-by-export-link? read-only hosted render? out of scope?). |
| §4 Persistence (`:206-265`) | **Rewrite, with a new decision** | `getApplicationSupportDirectory()` (`:212-216`) does not exist. The replacement is not obvious and D-19 does not choose: **IndexedDB** (universal, awkward), **localStorage** (5–10 MB cap, synchronous — too small and wrong shape for a 200-model library, E6.3), **Cache Storage** (wrong semantics), **OPFS / File System Access API** (Chrome yes, Safari partial since 15.2 with quirks, Firefox partial). The directory layout, immutable revisions, `current` pointer, quarantine (`:206-227`) all map onto IndexedDB stores cleanly; what does *not* map is the atomic `tmp`→rename write (`:218-220`) — IndexedDB gives you transactions instead, which is arguably better, but E8.12's "kill between temp write and rename" test must be rewritten as "kill mid-transaction". Safari's 7-day eviction of website data for non-installed sites is a **new data-loss risk the Flutter design never had** — "kept for as long as they keep the app" (`spec.md:50`) is only guaranteed for the *installed* PWA, and the spec must say so. |
| §4.1 Import/export (`:259-264`) | Rewrite | `share_plus` → Web Share API Level 2 (Safari 15+, Chrome) with download-anchor fallback; `file_picker` → `<input type=file>` / `showOpenFilePicker()`; the `<intent-filter>`/plist file-association is simply gone — **tapping a `.model.json` in a mail client cannot open the PWA**. That is a real capability loss vs the Android design and deserves an explicit accepted-cost line. "The interface is bytes, not paths" (`:264`) — already the right call; it is why this section is a rewrite of mechanism, not of design. |
| §4.2 / §5 / §6 / §7 | Survive | Schema ownership, migrations, RFC 8785, the single unit-conversion site, the `Solved<T>` envelope semantics — all stack-neutral. The Dart code block at `:444-460` needs a TypeScript twin (discriminated union), and `:305` "stricter than Dart's `toString()`" → "than JS's `String(n)`" — but every *rule* stands. |
| §8 States/tiers/evidence (`:521-637`) | Survive | Entirely vocabulary and placement. `:547` and `:634` name `evidence_table.dart`; rename the file, keep the design. |
| §9 Testing (`:681-704`) | **Rewrite** | `dart test` rows → Vitest (or equivalent) — the *layers* (unit, golden numeric, result-type, state-derivation, fuzz, adapter, migration, presentation, gate self-tests) are all stack-neutral and excellent. Dead rows: "Widget, semantics guidelines, golden image" (`:693`) → component tests (Testing Library) + axe-core + a visual-snapshot decision (Playwright screenshots are the usual answer; unlike Flutter goldens they are not pixel-stable across OS, which is why architecture.md:768's pinned-Linux rationale still matters). The performance row's "CI emulator proxy" (`:694`) becomes a browser harness on CI hardware — the 2× gating trick survives. |
| §10 CI / gate (`:710-770`) | **Rewrite** | `subosito/flutter-action`, `dart pub get`, `flutter build apk --debug`, `.flutter-version` (`:748-769`) all die; D-19:114 dictates `npm run gate`. The `build-android` job becomes `build` (vite build) + optionally a Lighthouse/PWA-audit job. Golden-image pinning (`:768`) transfers to the screenshot decision in §9. Dependabot: pub → npm. |
| §11 Release path (`:772-851`) | **Delete and replace** | The whole Google Play table (`:778-786`), account/identity-verification narrative (`:790`), `.aab`/signing, minSdk 26, "thin app rejection" (`:851`), and the deferred-iOS work list (`:820-839`, including the `path_provider`/200%-text QA risk at `:830-831`) — all moot. Replacement section: static hosting (which host is an open question), service-worker update strategy (a *new* problem: users can run a stale cached app — needs a version-prompt policy), the Web App Manifest, and "no store review cycle" as the win. The honest-privacy claims (`:846-849`) survive and get *easier* to evidence (no INTERNET permission → no network calls at all, verifiable in devtools). |
| §12 Desktop/web "later" (`:855-869`) | **Delete** | The entire section's premise — web is a later rendering, "Web never" (`:869`) — is inverted by D-19. Its three build-now items (DocumentStore interface, bounded undo, layout breakpoints) are now simply v1 requirements and should move into §4/§3. The `dart:io`-unreachable and CanvasKit sentences die with Dart. |
| Risks 1, 2, 5, 6 | Survive | Precision/conditioning, result-type drift, the two human-checked lists, band-vs-tolerance: stack-neutral. |
| Risk 3 (`:874-881`) | Rewrite | "16 ms budget … the risk is not the maths but rebuilding widgets and charts" — same risk, new names: React re-render containment, memoised selectors, `requestAnimationFrame` batching. `Isolate.run` → Web Worker with the same "a hop can cost more than the work" caution. |
| Risk 4 accessibility (`:883-889`) | Survive | `TextScaler`→`rem`/200% browser zoom, `Semantics` label → ARIA. The three named failures are platform-universal. |
| Open questions (`:927-937`) | Prune | #4 (iOS enrolment type) is dead — delete. #1 (models in-repo vs separate repo) survives. |

---

## 3. Contradictions and blockers, ranked

1. **R1 MUSTs that cannot pass, blocking any R1 build:** E8.1 (Android manifest stage,
   `spec.md:908-913`), E8.13(c) (Play data-safety, `spec.md:988`), E9.8 (gate named
   `dart run tool/gate.dart` with a `manifest` stage, `spec.md:1065-1069`), E6.2(b)
   (`ACTION_VIEW` intent, `spec.md:756`), and the release-checklist items E9.3 parses
   (C-01 store listing, C-02 bundletool, C-06 Play console, `spec.md:1110-1116`). Because
   E9.3/E9.8 are themselves the enforcement machinery, the spec currently *requires its own
   gate to test artifacts that can no longer exist*. Until these are rewritten, every green
   gate is a false green.
2. **The persistence decision is unmade.** D-19:119 says "service worker + local storage"
   — but localStorage literally cannot hold the designed library (200 models × revisions,
   E6.3, plus the quarantine/trash layout of architecture.md:206-227), and
   architecture.md §4 specifies a filesystem that browsers do not give you. IndexedDB vs
   OPFS, the Safari 7-day eviction exposure, and the loss of OS file-association import are
   open decisions an implementer will otherwise make silently. This is the largest single
   design hole D-19 opens.
3. **Back-behaviour and iOS gestures.** architecture.md:153-156's back-stack rule was
   written for Android's per-app back button and deferred-iOS; D-19 makes iOS Safari's
   edge-swipe an R1 reality and deletes app-exit semantics. flows.md:394,460's swipe
   gestures sit on the collision course. Undecided, an implementer will ship a tab-history
   trap.
4. **R1 is defined as a store submission** (`spec.md:124,136`) and D-10 is still on the
   books unannotated (`decisions.md:14-17`) while D-19:117 declares it superseded. The R0/
   R1/R2 markers on the E8/E9 families were allocated by platform ("Apple clauses are R2 by
   construction", `spec.md:905`) — that allocation logic is gone, so the markers on
   Safari-relevant ACs (E8.6, E8.7b, E8.16a/b) must be re-decided, not assumed carried.
5. **Performance targets unverified on the new stack.** E3.12 (`spec.md:551`): p50 ≤ 16 ms
   full recompute during a slider drag, on the reference device. Dart AOT → JS JIT on a
   mid-range phone browser is not obviously the same budget; the physics is arithmetic and
   will likely be fine, but the chart rendering (fl_chart → SVG/Canvas) inside the same
   16.7 ms frame is the new risk (architecture.md:417-431's chart/painter table is entirely
   Flutter: `fl_chart`, `CustomPainter`, `InteractiveViewer`). Re-baseline before promising
   E3.12/P-01 unchanged.
6. **The eight-state / tier / badge vocabulary: safe — do not "fix" it.** §4.4.1's eight
   states, §4.11's three tiers, the two-value evidence axis (architecture.md:521-545) are
   product vocabulary, not stack mechanism. The only residue is *where* they are computed
   (`setup_data`'s adapter, `evidence_table.dart`) — a rename, not a redesign. Flagging
   this because an over-eager updater will see "chip" and "badge" next to Flutter talk and
   reach for the eraser.
7. **The schema's mm-on-disk and `{value, source}`: safe.** fields.yaml's storage units
   (mm/g/deg, R-2) and the provenance envelope (D-16) are JSON-level decisions; a TS port
   changes nothing. The one trap to carry across: JS `JSON.stringify` number formatting
   differs from Dart's `toString()` for exactly the cases architecture.md:305 warns about —
   the RFC 8785 implementation must be re-validated against the existing hash fixtures, and
   those fixtures therefore become the *most valuable files in the migration*.
8. **Smaller contradictions:** `decisions.md` ordering (D-19 before D-18);
   architecture.md:698-699 duplicated sentence; design-system.md:136's Roboto logic now
   describes the past of a platform we no longer build for; E8.11's 25 MB budget is
   meaningless on the web and needs a real number; spec.md:192/195/202's "key decisions"
   table still lists D-09/D-10 framing as live.

---

## 4. What must NOT be touched

- **`docs/specs/physics/01`–`10` in full**, and everything in `00-overview.md` /
  `99-validation.md` except the five audience/tool-name lines quoted in §1.9. Equations,
  frames, golden cases, tolerances, the L0–L2 ladder: D-19:121-122 explicitly preserves them.
- **`docs/specs/fields.yaml`** except the single comment at line 8. Units policy, mm on
  disk, `on_absence`, `{value, source}`, sign conventions, D1–D9 rulings: stack-neutral.
- **The golden-case convention** (IDs, tolerances-as-part-of-the-case, forbidden
  `--update-goldens` semantics for numerics): the *numeric* goldens port verbatim; only the
  *image* goldens die.
- **The state/tier/evidence vocabularies** (§4.4.1, §4.11, D-11..D-18): product decisions.
- **`docs/procedures/`** (measurement-session, measurement-sheet, community-model-submission):
  calipers and corner weights do not care about the runtime. Verified clean (§1.13).
- **`docs/research/`**, `docs/intent.md`'s *why* (lines other than 51/54), `DEDICATION.md`,
  `docs/LICENSING.md`, the clean-room rule and its gates (E9.4, E5.4): untouched.
- **The design token tables** in design-system.md §2–§3 (hex values, type scale, spacing):
  they are CSS variables waiting to be written down; only the "Flutter implementation map"
  (§12) and API names die.

---

## 5. The smallest correct rewrite (work list, in order)

1. **`docs/decisions.md`** (patch): move D-19 after D-18; annotate D-09 and D-10
   "superseded by D-19" with one line each; fix D-16's "Dart table".
2. **`docs/specs/spec.md`** (targeted rewrite, ~15 sites): E8 preamble, E8.1, E8.6, E8.11,
   E8.13, E9.5, E9.8, E6.2(b), §3.5 C-01/C-02/C-06, and the five prose references
   (`:124,136,192,195,202,2377`). Re-marker Safari-relevant E8 ACs. This file stays
   hand-edited, not find-and-replace — every edit is a re-decision in miniature.
3. **New decisions needed before architecture can be rewritten** (owner input): persistence
   (IndexedDB vs OPFS + Safari eviction answer), back/history model, import without OS
   file-association, visual-snapshot tool, web size budget, hosting. Record as D-20+.
4. **`docs/specs/architecture.md`**: rewrite §1–§4, §9–§12 and Risk 3; keep Thesis,
   precedence, §5–§8, Risks 1/2/4/5/6 with renames only. This is a *rewrite* document —
   half its value is the reasoning, which survives; half its text is Dart.
5. **`AGENTS.md`, `README.md`** (find-and-replace plus the layout block and gate section):
   ten lines between them.
6. **`docs/design/design-system.md`** (patch): §12 replaced with a CSS-properties map;
   lines 4, 136, 173, 234, 263, 348 fixed as quoted in §1.10.
7. **`docs/design/flows.md`, `screens.md`** (patch): lines 6-7, 36, 701, 165; add the
   edge-swipe caution to 394/460.
8. **`docs/review-rules.md`, `docs/intent.md`, `docs/design/DECISIONS-R1.md`,
   `wireframes/index.html`** (one-to-three-line patches each, as quoted).
9. **`docs/specs/physics/00-overview.md`, `99-validation.md`**: the five lines in §1.9.
10. **Do not touch**: physics/01–10, fields.yaml (beyond line 8), procedures/, research/,
    the vocabularies. Last step: grep for `flutter|dart|pubspec|android|play console`
    repo-wide and expect hits only in `docs/research/`, `docs/reviews/round1-3` and
    historical decision text.
