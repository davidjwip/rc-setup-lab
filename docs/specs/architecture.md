# Architecture — Setup Lab

Status: rewritten for the web after round 4. Decisions applied: **D-19** (React + TypeScript PWA,
Flutter and Dart retired), **D-20** (IndexedDB, with the eviction problem answered), **D-21**
(provisional web performance budgets), **D-22** (import/export semantics and the accepted loss of
file association), **D-23** (SVG for the suspension scene, a chart library behind a wrapper, neither
computes physics). Still live from earlier rounds: **D-11** (honest validity chip), **D-12** (v1 =
geometry + balance, with the owner's 2026-10-30 amendment), **D-01** (three navigation destinations),
**R-1** (ISO 8855 frame), **R-2** (mm/g/deg on disk, one conversion site), **D-16** (one schema,
structural provenance), **D-17** (camber and toe are per-wheel signed), **D-18** (CG default and its
band). **D-09** and **D-10** are superseded in form by D-19 and their residue is annotated where it
survives.

**Owner decisions, 2026-10-30, unchanged by the stack switch:** every value carries provenance *and*
a tier; the physics API returns an estimated value together with its band and an inferred claim
together with its basis (so the UI can print "all else equal"); damping ratio ships as an estimate
with a computed band; CG height is inferred, never a measured input; grip is never a number. Those
land in requirements §4.4.1 (eight states), §4.11 (three tiers) and §4.8 (the band), and this
document defers to those names rather than coining a second set.

Companions: `docs/intent.md`, `docs/specs/spec.md` (v0.2), `docs/specs/physics/00`–`99`,
`docs/design/flows.md`. Toolchain: React 19 + TypeScript + Vite, Node LTS pinned by `.nvmrc`, npm
workspaces with one lockfile at the repository root.

**What the stack switch did to this document.** Sections 1–4, 6, 9, 10, 11 and Risk 3 were Dart
documents and are rewritten. Sections 5, 7 and 8 were already stack-neutral — frame, units, the
result type, the state/tier/evidence vocabulary — and are carried across with only the mechanism
names changed, because they are the part of this document that a rewrite would most easily damage.
The old §12 ("Desktop and web, later") is deleted: its premise is inverted, and its three
build-now items (a storage interface, bounded undo, layout breakpoints) are now v1 requirements and
live in §4, §3 and §3.2.

## Precedence, stated once

The old draft said "the spec wins where they disagree", and by its own rule selected the coordinate
frame that every physics equation contradicts (B1). Precedence is therefore per subject:

| Subject | Authority | Why |
|---|---|---|
| Frame, sign conventions, the result type, the tier/reason/flag vocabularies, tolerances | `physics/01` §2, `physics/00` §4, owner decisions of 2026-10-30 | eleven equations in modules 2–6 were derived in that frame and against that vocabulary; re-deriving them to satisfy a prose sentence is the expensive direction |
| Document model — kinds, field semantics, units on disk, provenance, hash | `spec.md` §4 with R-1/R-2 | it is the public file interface, and it is what a reviewer tests |
| Package layout, gate, presentation boundary, release path | this document | nobody else specifies them |

*Cost of being wrong:* physics outranks a requirements sentence here, so a requirements edit that
flips y can produce documents this build refuses to load. That is deliberate — the loader names the
mismatch (§5) instead of reinterpreting signs, because silent reinterpretation is the same failure
class as the 0.2 mm-per-save bug, one order of magnitude worse.

## Thesis

**The solver is pure TypeScript**: SI in, SI out, no JSON, no DOM, no React. **The on-disk document
is the truth, never regenerated from computed values**: solving is one-way, document → SI → result.
**The UI renders solved scenes and formatted numbers**: no trigonometry in a component, and no
component ever receives a bare number for a computed value.

The failure modes this is built against are the predecessor's: a 2019 poster reported every save
shaving 0.2 mm off rear track width, cumulatively; another lost shock mounting positions by zooming
(`docs/research/forum/rctech-thread.md`). Both are state-boundary bugs, not maths bugs. Round 1 found
three of the same class *inside the drafts*: storage units specified three ways, two coordinate
frames, and three result shapes. Round 4 finds the fourth instance of the same class in the stack
switch — a document that names `getApplicationSupportDirectory()` has specified a file system the
browser does not have — and it is answered the same way: one owner per fact, and a mechanism that
fails the build when the owner is bypassed.

## 1. Repository and package layout

```
package.json                  # private workspace root: `workspaces: ["web", "packages/*"]`, one lockfile
.nvmrc                        # pinned Node LTS
packages/
├── physics/                  # pure TS: SI only, no DOM, no React, no JSON, no I/O
│   ├── src/{geometry,axle,vehicle,result,evidence}/
│   └── test/                 # vitest: unit, golden numeric, property/fuzz
└── data/                     # pure TS: no DOM, no React, no I/O
    ├── src/{document,schema,migrate,hash,adapter,state}/
    ├── src/schema/generated/ # fields.yaml → TypeScript table, checked in, never hand-edited
    └── test/fixtures/        # bytes on disk, never regenerated
web/
├── package.json, vite.config.ts, tsconfig.json
├── index.html                # the single entry document
├── public/                   # icons, manifest.webmanifest, offline.html
├── src/main.tsx, src/app.tsx
├── src/routes/               # route tree and shell (§3)
├── src/state/                # every Zustand store — the only place `zustand` is imported
├── src/features/             # garage / setup / analysis / compare / learn / settings
├── src/present/              # envelope + schema → PropertyView (plain TS, no React)
├── src/format/               # the only place a number becomes a string (§5, §8)
├── src/store/                # DocumentStore: IndexedDB, export/import, file access (§4)
├── src/charts/               # the chart wrapper — the only place the chart library is imported
├── src/scene/                # the SVG suspension scene (§6)
├── src/strings/              # the string table (E8.9a)
├── test/                     # vitest + Testing Library
├── e2e/                      # one Playwright path (§9)
└── tool/gate.ts              # the single gate command (§10)
assets/models/                # bundled chassis JSON (CC BY 4.0)
```

`src/features/` follows *screens*, not the navigation tree: the setup sheet and the analysis screen
are shipped as `features/setup/` and `features/analysis/` and are *routed* inside the Garage
destination (§3). Directory layout and route ownership are separate decisions and should not be made
to agree.

| Package | Depends on | Never imports | Enforced by |
|---|---|---|---|
| `@setuplab/physics` | nothing | React, the DOM, `@setuplab/data`, any I/O | `tsconfig.json` without the `DOM` lib; ESLint `no-restricted-imports` |
| `@setuplab/data` | `@setuplab/physics` | React, the DOM, `web/src` | same |
| `web` | both | — | — |

**Why two packages and one app (D-07, restated).** Physics must be JSON-free or it becomes untestable
headless and grows compatibility shims; data must be UI-free because its migration tests churn most,
and because "no DOM" as a *type* error is stronger than "no DOM" as a review note.

**The wall is enforceable by the type system, which is a lift on the Dart arrangement.** Dart's
`setup_physics` had no way to prove at compile time that `dart:ui` was unreachable — the check was a
pubspec assertion plus a review rule. Here `packages/physics/tsconfig.json` sets
`"lib": ["ES2022"]` with no `"DOM"` entry, so `document`, `window`, `localStorage`, `fetch`,
`navigator` and `console` do not exist as types inside the package: a single stray reference fails
`tsc`, which is the gate's first stage. A physics package with no side effects needs none of them —
which is also why the absence of `console` is not a hardship.

**The dependency points one way: `web` → `@setuplab/data` → `@setuplab/physics`.** `data` depends on
physics because the adapter's output *is* a physics input struct. The consequence is load-bearing:
the physics package cannot name a document field, so a missing-input report travels as a physics
`FieldRef` and `data` owns the ref → document-path table the UI renders (§4.2). The reverse edge
would put document ids and schema versions inside the solver.

**One resolution.** npm workspaces at the repository root: one `package-lock.json`, one `npm ci`,
and `npm run gate` from the root typechecks and tests every workspace. `--workspaces` is not relied
on to find test files: the gate names each workspace's script explicitly, per §10.

**Models are validated assets:** a test walks `assets/models/*.json` through the schema table and
fails on any measurement without a resolvable `source`.

*Cost:* a physics change touches two `package.json` files, and a document-model change touches one
that a physics contributor may not have opened. *Revisit:* if `adapter/` stays under ~300 lines
after v1, fold `data` into the app — but not before, because the migration fixtures are the tests
that would be lost first.

**`packages/ui` does not exist in v1, deliberately.** A shared component package earns its place
when a second consumer exists; today there is one app, and a package boundary between a component and
its only caller buys nothing but two build configs. What *would* earn it: a second renderer (a static
site showing the same property cards, a deck), or a component suite large enough that its test config
diverges from the app's. Design tokens do not need it — they are CSS custom properties in
`web/src/theme/tokens.css`, which is the same artefact a second consumer would import. Reusing the
*logic* behind a component does not need it either: `PropertyView` and the formatter are plain TS in
`src/present/` and `src/format/`, and a test proves neither imports React.

## 2. State management

**Pick: Zustand, one store per document domain, with per-leaf selectors.**

The load-bearing requirement is the drag path: users asked for a weight-distribution slider to see
what moving a few grams would do, so one gesture produces 60–120 document mutations a second, each
needing a re-solve and repaint.

| | Re-render granularity | Boilerplate/feature | Testable without a browser | Drag-path cost |
|---|---|---|---|---|
| **Zustand** | per selector; `useStore(s => s.x)` | low; one `create()` per domain | store is consumable as a plain object in Vitest | one derive per frame, N subscribers |
| Redux Toolkit | per connected component; needs `reselect` discipline | high: slice + actions + selectors + store wiring | easy, but the reducer shape is a second vocabulary | every dispatch walks middleware |
| React context + `useReducer` | per provider — every consumer re-renders on any change | lowest to start | reducer alone is pure and testable | one context update re-renders the subtree: the one thing the drag path cannot afford |

Zustand wins on the same criterion Riverpod won on: a `solution` store *derived* from the draft
document, plus selectors narrow enough that a roll-centre readout does not re-render when a spring
rate changes. React context loses on the drag path alone — a context value change re-renders every
consumer, and the analysis screen is the whole consumer set. Redux Toolkit would work; it costs a
slice, an action and a selector per field to buy devtools time-travel that this app does not need and
a store shape that duplicates §7's result type in a second vocabulary.

**What the pick must satisfy, stated as acceptance criteria so the rewrite cannot quietly lose them:**

1. **One derived solve per edit, coalesced to one per animation frame.** Mutations land immediately
   in the draft store; a `requestAnimationFrame` callback marked dirty by the first mutation solves
   once with the newest document and publishes the result. *Coalesce, never debounce* — debounce
   would show stale numbers while the finger is still moving, which is the bug the budget exists to
   prevent (E3.12).
2. **Leaf-level subscription.** A component that renders one property subscribes to one property's
   `PropertyView`, not to the solution object. With ~40 values on the analysis screen this is the
   difference between one re-render per frame and forty.
3. **State types live only under `src/state/`.** Stores hold the draft document, the current
   solution, the library summaries and the UI preferences. A component may not import `zustand`.
   Enforced by an ESLint `no-restricted-imports` rule with a single allow-list — the same shape of
   check that kept Riverpod out of `features/`.
4. **The store is injected, not global, in tests.** `createStore()` returns a store instance; the
   provider passes it down; a test constructs one and calls `getState()` with no renderer at all.
5. **The payload is the per-field struct of §7, not a bag of doubles.** A selector returns one
   `Solved<number>`; the `Solved` → `PropertyView` mapping (§8) happens in `src/present/`, which is
   called from a selector, so a component never formats.

*Cost:* Zustand's store is a mutable object, so "who changed this" is answered by the devtools
middleware rather than by an event log, and a careless `useStore()` with no selector re-renders on
every field. The second is the real risk and it is a review rule plus a lint rule (no bare
`useStore()` outside `src/state/`). *Revisit:* the day a feature needs real async streams (BLE
timing, a lap timer), where a stream-aware library earns its keep; or if a drag-path profile shows
selector overhead, which the measurement in D-21 will settle.

### 2.1 Undo

A bounded undo stack per document: 20 snapshots, not a command pattern, held in memory and discarded
on navigation away. Snapshots are cheap (the documents are small JSON trees) and the alternative — a
command log — needs an inverse for every edit, which is a week of work for a feature nobody asked
for. Undo is not persisted: a reload is a save point.

## 3. Routing and information architecture

**Pick: React Router, three destinations with browser history — Garage, Compare, Learn (D-01).**

Three, not four. A **Setup** destination has no subject until a car is chosen, so it opens either on
a picker or on the last car used, and the user has to hold "which car is this tab showing?" — the
exact ambiguity the third destination was meant to remove. Setup is a push from the car, not a
place. The wireframes' four-item bar is redrawn to three; that is a design task, not a code one.

| Route | Destination | Screen |
|---|---|---|
| `/garage`, `/garage/new`, `/garage/import` | Garage | car list, new model, import |
| `/car/:carId` (+ `/edit`, `/geometry`, `/geometry/wizard/:groupId`) | Garage | car detail, geometry editor, measurement wizard |
| `/car/:carId/setups`, `/car/:carId/setup/:setupId` | Garage | setup list, setup sheet |
| `…/setup/:setupId/analysis`, `…/analysis/:propertyId` | Garage | analysis, per-property detail |
| `/compare?a=&b=`, `/compare/pick/:slot` | Compare | side-by-side, slot picker |
| `/learn/path`, `/learn/:conceptId` | Learn | learning path, concept |
| `/welcome`, `/settings/**` | above the shell | no bottom bar |

The paths are `docs/design/flows.md` §2.3's, unchanged; the destination column is this document's
contribution, and it is the thing D-01 decided. `/car/…` sits *inside* the Garage destination rather
than at the root, so a deep link resolves to a destination and a stack position without the router
guessing — the path prefix (`/car` vs `/garage/car`) was considered and rejected as churn: it would
change every shared link for a routing intuition nobody sees. *Cost:* the route tree must be read
with the destination structure beside it, which is why the table above has the column.

**URLs are now the primary artefact, and that is the single biggest gain from D-19.** Deep links,
refresh, back, bookmark, and "send this to a friend" all come free of a URI-scheme registry, an
intent filter and a store listing — three things the Flutter plan had to build.

### 3.1 Back, forward and refresh — the rules, since the browser owns the gesture

The Flutter design implemented its own back stack and could decide what Back meant. On the web the
Back button is shared with the whole tab: it undoes the last *navigation*, including one that left
the app. So the behaviour is stated as rules rather than inherited from a widget.

| Situation | Behaviour |
|---|---|
| Tap a card, row, chevron or the back chevron | one `push`; Back returns to the previous screen, same scroll offset |
| Switch destination in the bottom bar | one `push` to that destination's **remembered** path (you return to the car you were looking at, not to the car list) |
| Back at the app's first entry | leaves the app — the browser's contract, not an app decision. There is no "exit" to implement and no `PopScope` equivalent to write |
| Edit a field | **no history entry.** Autosave within 500 ms, so there is nothing to guard and no "discard changes?" dialog. One entry per navigation, never one per keystroke |
| Reload (F5, or the OS killing the tab) | the same URL renders from IndexedDB; the document, the setup and the analysis all come back. Transient state — an open sheet, the last scroll offset — is lost, and that is documented rather than papered over |
| Open a deep link cold (`/car/x/setup/y/analysis`) | one synthetic parent entry is pushed underneath (`history.replaceState` then `push`) so Back lands on Garage rather than leaving the app; the second Back leaves |
| Open a deep link into a modal-ish screen | there are no route-level modals: sheets are local state, so nothing is deep-linkable that should not be |

**Cost of the remembered-path rule:** two presses of Back after switching tabs retrace the switch,
which is correct on the web and surprising to someone who learned the app on Android. It is the
honest trade: the alternative is intercepting `popstate` and rewriting history, which breaks the
browser's own contract and the phone's own edge-swipe gesture.

**iOS Safari's edge swipe is the browser's back gesture and cannot be intercepted or styled.** This
is no longer a deferred-platform footnote (D-19 brought iOS into scope): a horizontal drag that
starts within ~20 px of the left edge will navigate away from the app, whatever the app wants. Two
consequences, both acceptance criteria for design rather than implementation: (a) no list row and no
sheet may be dismissible *only* by a horizontal swipe, and no swipe handler may start at the screen
edge — `docs/design/flows.md` §7.1 and §8.3 already say destructive actions are never swipe-only,
and this is the reason to keep saying it; (b) a sheet's scrim tap and close button are mandatory, not
alternatives.

### 3.2 Static hosting means the server must not 404 a deep link

A single-page app served as static files answers a request for `/car/mdl_8f2c41/setup/stp_1/analysis`
with a 404 unless the host rewrites unknown paths to `index.html`. Cloudflare Pages gets one line in
`web/public/_redirects` —

```
/*    /index.html   200
```

— and a Playwright case loads a deep link directly (not by clicking) and asserts the analysis screen
renders, because a rewrite rule that silently stops applying after a config change is invisible until
a shared link fails in someone else's hands. Hashed assets are immutable and cached for a year;
`index.html` and the service worker must never be.

**Two layout breakpoints, decided now, not retrofitted:** 600 px (single column, the phone product)
and 900 px (the compare table may show both slots side by side and the annotation rail appears).
`docs/design/design-system.md` §11 already caps the phone column at 600 and `flows.md` §11.4's
one-handed rules are phone rules; nothing in v1 is two-pane master-detail.

### 3.3 Deep-link contract

- `/car/:carId/setup/:setupId/analysis` and `/learn/:conceptId?car=&setup=&from=` are the shareable
  strings. They are now also *ordinary URLs*, which is why a missing car is a normal case and not an
  edge case (below).
- **`?from=` is origin only.** Values: `analysis`, `compare`, `garage`. It selects the post-back
  treatment (highlight the originating card for 1.5 s) and never changes what is loaded. An unknown
  `from` is ignored, not guessed at; because the ids travel beside it, an origin that no longer
  exists degrades to "no highlight", never to an error.
- **`?returnTo=analysis`** on the measurement detour (missing-input row → wizard → back). This is the
  one place a return target is mandatory: the user must not be stranded in a wizard after a
  twenty-second fix.
- A link naming a car that is **not in this browser's database** opens Garage with a one-line notice
  ("That car isn't on this device"), not an error screen — and, unlike the Android design, this is
  now the *common* case rather than the rare one: a shared link travels between devices, and the
  sender's documents live in the sender's IndexedDB. The notice therefore must also say what to ask
  for ("ask for the car file, then import it"), and E8.18's export nag is the sender's half of the
  same problem. A link that carries a car the recipient cannot have is a design consequence of D-19,
  not a bug; a read-only hosted render or a share-by-link format is out of v1 and listed in the open
  questions.
- A link into Compare or Learn that needs a car and setup **switches destination first** and then
  pushes, so one Back never strands the user in an empty destination. That is the only
  destination-switch the router performs on its own.

*Cost:* Compare and Learn are one tap from anywhere, but Setup is two taps from the Garage root (car
→ setup) and, after a destination switch, analysis is reachable only through its car. That is the
price of removing "which car is this tab showing", and it should be tested in the first usability
session rather than argued. *Revisit (D-01's cost):* if people hunt for "Setup", add the fourth
destination — one route entry, no screen changes, plus the "no car yet" empty state.

## 4. Persistence and the document model

**Pick: IndexedDB for documents, `localStorage` for preferences only, through a small typed
wrapper — one `DocumentStore` interface with one implementation (D-20).**

```
IndexedDB  setuplab (database version N — the *storage* version, not schema_version)
├── models            key [model_id, content_hash] → the document      immutable revisions
├── model_current     key model_id → content_hash                      the live revision pointer
├── setups            key setup_id → {doc, model_ref, ...}             index by model_id
├── quarantine        key [kind, id, at] → {raw, reason}               unreadable documents (E8.15)
└── meta              key 'db' → {created_at, last_sweep_at}           housekeeping only
localStorage
├── setuplab.prefs            theme, display units, the last destination, scroll intent
└── setuplab.lastExportAt     the export nag's clock (E8.18)
```

Model revisions are immutable and setups address one by hash, so editing a model cannot silently
change what a saved setup meant (E2.7). `model_current` is a pointer, not a copy; if it is lost, the
library rebuilds it by scanning `models`. Nothing in the app resolves a path: the interface is
`get(kind, id, hash?)`, `put(doc)`, `list(kind)`, `remove(...)` — **bytes and keys, never paths**,
which was already the right call in the Flutter design and is now the only option.

**Why IndexedDB and not the alternatives.** `localStorage` is synchronous, string-only and capped in
the low single-digit megabytes: the designed library is 200 models plus revisions (E6.3) with a
≤ 100 KB budget per model document (D-21), which is an order of magnitude past what it can hold, and
a synchronous read on the drag path would block the frame the budget is measured against. Cache
Storage is a request/response cache with no query surface — wrong shape. The Origin Private File
System is a real file system in the browser, but support and semantics differ by engine and the app
would gain a second failure mode (a file handle whose permission can be revoked) for no capability
IndexedDB lacks. Records are structured-cloneable, transactions are atomic, and the object stores
above are the directory layout the Flutter design had, minus the paths.

**A small wrapper, not an ORM.** `idb` (a ~1 KB promise wrapper over the raw API) is the whole
dependency: raw IndexedDB's event API is error-prone, and every ORM on top of it brings a schema
language and a migration engine — a second migration language beside `schema_version`, which is
exactly what the predecessor's proprietary database cost the community. *Cost:* the wrapper's
versioning API is not a document migration system, and confusing the two is the trap: **the database
version (`onupgradeneeded`) and the document `schema_version` are different axes and neither implies
the other.** Adding an object store is a database bump; adding a field is a document migration. A
comment at the top of `src/store/db.ts` says so, and a test asserts a document written by schema
1.0.0 loads after a database bump that changed no store.

**Atomicity is a transaction, not a rename.** The Flutter design wrote `*.json.tmp`, flushed, and
renamed, because a partial file on a phone that dies at the track is a lost car model. IndexedDB
gives the same guarantee with a transaction boundary instead of a rename, and it is arguably better:
a `put` of the new revision and a `put` of the `current` pointer commit together or not at all. The
test is E8.12's, re-expressed: **kill the process mid-transaction** — one unit test aborts the
transaction through the wrapper's failure hook and asserts the previous revision is still current and
the half-written one is not offered; one Playwright case closes the tab during a save and reopens the
app. The rule the test protects is unchanged: a crash may lose the last edit, never the last save.

**Eviction is the new data-loss risk, and it is answered on screen rather than in a footnote.**
Browsers evict origin data under storage pressure, and **Safari on iOS is the device that will bite**:
it evicts storage for sites that have not been visited for seven days, and an app installed to the
home screen is exempt. So D-20's three consequences, each with a home:

1. `navigator.storage.persist()` is requested at first run, before the first document is written, and
   its result is recorded. It is a request, not a guarantee; the app does not treat `true` as proof
   and does not treat `false` as an error.
2. **First run offers "Add to Home Screen"**, with the reason stated in one sentence (an installed
   app is not evicted; a bookmark is). On iOS there is no `beforeinstallprompt` — installation is
   Share → Add to Home Screen — so the copy has to be instructions, not a button (§11.2).
3. **Export is the user's real backup, not a nicety (D-22).** The app shows a storage-state row
   (usage and quota from `navigator.storage.estimate()`, the persist result, the date of the last
   export) and **nags for an export when the last one is more than seven days old**. The nag is a
   dismissed-per-session banner, not a modal, and it stops nagging as soon as an export succeeds.

**What Safari on iOS does and does not support — stated exactly, because it is the device in the
pocket.** IndexedDB and `localStorage`: yes. Service workers and an installable home-screen app: yes.
`navigator.storage.estimate()` and `.persist()`: both exposed; the grant is heuristic rather than a
permission prompt, so the app must work either way. **The File System Access API
(`showSaveFilePicker` / `showOpenFilePicker`): not available** — the save flow there is a download and
the open flow is `<input type="file">`. Web Share Level 2 (sharing a file): available, and used where
the user is sharing to another app rather than keeping the file. Storage quota: a fraction of free
disk set by the browser, queried through `estimate()` rather than assumed. Seven-day eviction for
unvisited sites, exemption when installed: as D-20 rules. *Verification obligation:* the exact
behaviour of `persist()` and the quota on the reference device is measured once, on the device, in the
first measurement session and recorded in the release checklist — this paragraph says what the code
may rely on, and a browser that changes one line of it changes one branch of `src/store/capabilities.ts`.

**Where the fallback lives, so no screen branches on a capability.** `src/store/fileAccess.ts`
exposes exactly two operations — `saveBlob(blob, suggestedName)` and `openFiles(accept)` — and picks
its implementation once at startup: File System Access where it exists, an anchor-download and a
hidden `<input type="file">` everywhere else. No feature code asks which path ran; the difference the
user sees is a save dialog versus the browser's download shelf, and both are reported through the
same result type. A mocked capability object makes both backends testable in Vitest.

*Cost:* listing means a cursor over an object store instead of reading a directory, and a startup
in-memory index covers the 200-model case. Deliberately no index *document* — a second source of truth
is a consistency bug. *Revisit:* E8.5's ≤300 ms to open a stored model missed on the reference device,
200 models failing to scroll, or full-text search over setup notes.

### 4.1 The on-disk shape

```json
{ "schema_version": "1.0.0", "kind": "car_model", "id": "mdl_8f2c41",
  "frame": { "standard": "ISO 8855", "axes": "x forward, y left, z up",
             "origin": "ground plane, rear axle centre, vehicle centreline" },
  "units": { "length": "mm" },
  "sources": { "s1": { "type": "measured", "method": "digital caliper", "by": "DW" } },
  "axles": { "front": { "track": { "value": 172.0, "source": "s1" } } },
  "corners": { "LF": { "points": {
      "lca_out": { "value": [259.0, 78.0, 7.0], "source": "s1" } } } }
```

The full shape is `docs/specs/fields.yaml`, and spec §4.2 prints the complete reference model; this
snippet exists only to show the three things a reader of the architecture needs: the value object, the
corner key and the frame block. `units` declares one entry per dimension **actually used** — the
snippet above uses one, so it declares one, and a missing dimension refuses the document.

- **`frame` and `units` are declared and checked on load** (§5). A file that declares a different
  frame or unit system is refused with the mismatch named, never rescaled or reinterpreted.
- **Every value is `{"value": number, "source": sourceId}`** (D-16), resolving into the document's
  `sources` map; a whole caliper session is one source (spec §4.1.2), and a value with no resolvable
  source is a schema error rather than a review note. `x_`-prefixed keys we do not understand are
  preserved and written back. A greater `schema_version` **major** is refused with a plain message,
  never parsed best-effort — silent degradation is how the 0.2 mm bug happened.
- **Export** is a download (or a save dialog, or the share sheet where the user is sending rather than
  keeping). **Import** is a file picker, drag-and-drop onto the app on desktop, or paste-a-document on
  any platform (D-22). **File association is an accepted loss:** a web app cannot be the handler for
  a `.json` tapped in a mail client, so a tapped model opens a text view or nothing at all, and the
  user imports it from inside the app. This is recorded rather than glossed because the Android
  design did have it, and it was the one import path that needed no instruction. `kind` still tells
  the two document kinds apart, which matters for the picker's filter and for a pasted blob whose
  name is unknown.
- **The interface is bytes, not paths**, and import never merges — an id collision gets a new id, the
  file's own `sources` travel with it, and the UI previews what will be added.
- **"Export everything" produces one archive** — a single `.zip` (or a single JSON envelope, decided
  by E7.6's format) containing every model, setup and note plus a per-document SHA-256 of its
  canonical form. The archive is what survives a browser profile, a lost phone and an eviction, and
  it is the thing E8.18 nags about.

### 4.2 Who owns what

| Concern | Lives in | Rule |
|---|---|---|
| Schema: field paths, types, units, required-ness, `on_absence`, `plausible`, `consumed_by` | normative in `docs/specs/fields.yaml`; consumed from `packages/data/src/schema/generated/` | one YAML is the source (E9.10); the TypeScript table is generated from it and checked in; the validator interprets the generated table, and no schema logic lives in the app |
| Migrations and their fixtures | `packages/data/src/migrate/`, `packages/data/test/fixtures/` | one step per version pair; fixtures are bytes on disk, never regenerated |
| Canonical form and `content_hash` | `packages/data/src/hash/` | RFC 8785 (JCS) + SHA-256, `meta` excluded (spec §4.5); nothing else in the repo hashes a document |
| mm/g/deg ↔ SI | `packages/data/src/adapter/units.ts` | the single conversion site (§5) |
| State derivation (`on_absence` + result → one of eight states) | `packages/data/src/state/` | reads the schema table and the envelope; never formats |
| Physics result type, reasons, flags | `packages/physics/src/result/` | specified in `physics/00` §4; imported by the app, never re-declared (§7) |
| Golden-case inventory per output | `packages/physics/src/evidence/` | a property of the build, checked against the golden files (E3.11) |
| Envelope + schema → `PropertyView` | `web/src/present/` | plain TS, no React import, tested in Vitest |
| Number → string | `web/src/format/` | the only formatter; features may not format (§8) |
| Bytes in storage | `web/src/store/` | `DocumentStore` + `fileAccess`; the pure packages take and return `string`/`object` |

**Schema.** `docs/specs/fields.yaml` is normative and machine-readable (E9.10): each field appears
once with `path`, `type`, `unit` (a dimension from the file's own `meta.dimensions`), `req`,
`on_absence ∈ {ASSUME, ESTIMATE, REFUSE, OMIT}`, an `assume` value where the policy is `ASSUME`, an
`estimate` procedure id and `band: true` where the policy is `ESTIMATE`, `plausible` and
`consumed_by`. **`ESTIMATE` is a member of that enum, not a subclass of `ASSUME`**: it is the policy
that carries CG height (D-14) and both unsprung masses, and a validator that accepts three values
either turns an inferred number into an assumed one or refuses a document the spec requires to load.
Three views are generated from it and the gate's schema stage proves they still agree: the Markdown
tables in the requirements, the TypeScript table the validator reads, and the fixture set. This
replaces a hand-written manifest, and the reason is B9 — five required inputs existed in prose and in
no schema, so modules 5 and 7 could not be called with a document that validated. One YAML, one
generator, one gate stage. *Cost:* a codegen step (`tool/gen-schema.ts`, output checked in, gate fails
when stale), and a contributor who edits the generated table by hand fails the gate rather than
shipping a quiet divergence — which is the intended failure.

**Migrations.** One function per (kind, from → to), byte fixtures on both sides, forward only. The
loader migrates in memory and writes nothing; a refused file leaves no partial data (E6.6). *Cost:*
every schema change carries a fixture pair forever, and a fixture is never deleted, only added.

**Hash.** Canonicalisation is `hash/canonical.ts`, and it implements **RFC 8785 JSON
Canonicalisation** rather than a private set of rules: keys sorted by UTF-16 code unit, no
insignificant whitespace, ES6 number formatting, `meta` excluded, `x_` keys included. The spec pins
the reference and publishes fixtures (spec §4.5), which is what makes two installs agree. D3 is why it
has one owner: divergent hashes break E1.7, E2.1, E2.7 and E7.1 at once and the failure is invisible
until two users exchange files.

*Good news, recorded because it is the one place the stack switch makes a rule easier:* RFC 8785's
number formatting **is** ECMAScript's `Number::toString`, which is what `JSON.stringify` emits by
specification (including `-0` → `0`). The Dart implementation had to hand-write that formatter and
fixture-test it against doubles; here the formatter is the platform's, and the risk moves from
"did we implement ES6 formatting" to "did we sort keys and exclude `meta` correctly". The published
hash fixtures are still the test and they are still the most valuable files in the migration — a
single differing byte is the whole failure. `NaN` and `Infinity` serialise as `null` in
`JSON.stringify`, so the validator must reject them *before* hashing rather than relying on the
canonicaliser; that check is E3.8's property test's job and it is now load-bearing twice.

**Two hashes, one owner.** The base `content_hash` is not the only one: a setup may carry the closed
set of geometry adjustments of requirements §4.3.2 (upper-link shims, wheel offset), and the derived
geometry has its own `geometry_hash` (§4.5.3). Both hashing functions live in `hash/`, and the
*composition* — base model plus adjustments, in the signed order the schema fixes — lives in the
adapter, so the solver receives one compiled geometry and never learns that a shim exists. That is the
same boundary that keeps mm out of physics: the pipeline is arithmetic on document values, so it
belongs with the only code allowed to do arithmetic on document values.

**No I/O in the pure packages.** `data` validates, migrates, hashes and composes strings and objects;
the app owns bytes and storage. That is what let the same migration code serve a browser build with
no platform channel — the promise the Flutter design made in the future tense and D-19 collected — and
it is why the DOM is a type error rather than a convention.

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
hardpoint set compute a plausible wrong car. *Cost of being wrong:* every hand-entered hardpoint is
one sign away from a mirrored car that still computes plausible numbers. Three mitigations, all
cheap: the loader refuses a `frame` block that disagrees instead of reinterpreting it;
`symmetry: true` already requires the right corner to equal the mirror of the left within 0.01 mm;
and a golden case asserts κ_R = −κ_L in the global frame and equality per-wheel.

### 5.2 Units

| Quantity | On disk | Inside `packages/physics` | On screen |
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

1. **`packages/physics` takes SI and returns SI; `packages/data` converts; nothing else converts.**
   One function family in `packages/data/src/adapter/units.ts`, called once per solve on the way in
   and once per result on the way out. Not in the solver, not in a component, not in a fixture.
2. **No unit literal or scale factor inside `packages/physics`.** A test greps
   `packages/physics/src` for `mm`, `deg`, `N/mm`, `1000`, `1e-3` and fails (tolerance constants such
   as `1e-9` are dimensionless and allowed). Parameter names carry their unit — `lowerArmOuter_m`,
   `camber_rad` — because a signature is the only place a unit can be checked by reading.
3. **Divide by an exact power of ten where the quantity shrinks; multiply by an integer where it
   grows.** `mm / 1000` round-trips 4,994 of 5,001 values on a 0.1 mm grid (worst 2.8e-14 mm);
   `mm * 1e-3` fails 644. `N/mm → N/m` is `* 1000`. Shaft speed arrives in m/s already (requirements
   §4.1 rule 1 — a damper curve is published that way), so speed needs no conversion at the adapter
   and only the *display* converts it to mm/s, which is the unit a racer reads.
4. **No computed value is ever written back into a document.** Display rounding is one-way, so files
   only ever contain numbers a human or a caliper produced.
5. **No unit literal in a feature component**: a test greps `web/src/features/` for `'mm'`, `' g'`,
   `'deg'` and fails. Formatting goes through `src/format/`, which is also the only place a number
   becomes a string (§8). `toFixed(`, `Intl.NumberFormat(` and template-interpolating a number are
   banned outside `src/format/` by the same lint rule.
6. **Display units are a per-car preference stored in the document, metric default (D-05).** Imperial
   (lb/in, oz, °) is a second formatter set, never a second storage form and never a solver argument,
   so switching it is not a migration and cannot change a number. *Cost:* two formatter sets to test,
   and one easy confusion — a display conversion mistaken for the storage conversion. The test that
   catches it is the document-level round trip, not the format test.
7. **A document declaring different units is refused, not rescaled** (§5.1's sibling rule): "this
   build reads mm/g/deg; this file says m/kg/rad". The adapter also rejects any coordinate whose
   magnitude exceeds 3000 mm as a suspected metre value (requirements §4.1 rule 1) — the guard is a
   *validation* rule in the schema layer, not a heuristic in the solver, and E3.8's property test runs
   it with both unit systems.

Round-trip tests at three levels: converter (`mm → m → mm`, 1e-9 relative, plus the 0.1 mm grid
sweep), string (`format(parse(s)) == s` for every string the UI can produce, in both unit sets),
document (reload and re-save is byte-identical after canonicalisation; `x_` keys survive a fuzz round
trip). The string level is the one that would have caught 0.2 mm per save; the grid sweep is the one
that catches a `1e-3` literal.

## 6. Drawing

**The suspension scene is SVG; series plots go through one chart wrapper; neither computes physics
(D-23).**

| Need | Tool | Why |
|---|---|---|
| Suspension elevation: hardpoints, links, instant-centre rays, roll centre, contact patch, roll animation | **Inline SVG**, authored as React components from a physics-produced scene | crisp at any device pixel ratio, inspectable in devtools, testable against the same numbers the physics returned, readable by a screen reader as a labelled graphic, and no dependency at all |
| Roll angle vs lateral g, CG height vs g, spring force vs g, LLT split vs roll stiffness, camber vs roll, roll-centre migration | **visx** (`shape`, `scale`, `axis`) behind `web/src/charts/` | 10–200 point series, SVG, modular and tree-shaken (the size budget in D-21 is the constraint that rules out a monolithic charting bundle); axes, ticks and a tooltip are the parts worth not writing |
| A series with more than a few thousand points | canvas, behind the same wrapper | an SVG node per point stops being the cheap option; the wrapper switches renderer without the caller knowing |

**The rule, unchanged and now testable in a new way:** every plot and every scene consumes a value
object — `Series` (label, points, axes, unit, evidence) or `GeometryScene` — produced by a pure
presenter or by `packages/physics`. **Anything drawn is a number the physics package produced.** A
renderer may apply one uniform affine view transform (model coordinates → `viewBox`) and nothing
else; a renderer that calls `Math.atan2`, `Math.hypot` or a `sin`/`cos` of a geometry quantity is a
review failure, because it has started computing a second answer to a question the solver already
answered. The one allowed trigonometric use is `Math.log10` in the presenter for a log axis, which is
a display transform on a value rather than a geometric one.

Why SVG here rather than canvas: the scene is a diagram, not a chart — tens of elements, not tens of
thousands — and the accessibility and testability arguments are decisive. An SVG scene exposes each
hardpoint as a DOM node with a `data-field` attribute, so the component test asserts that the circle
for `lca_out` sits at the coordinates the scene object carries (1e-9), and E8.7d's table alternative
and E8.8's spoken sentence are derived from the same objects rather than from a screenshot.

**A chart exists only for a valued property.** The presenter returns a `PropertyView` for the value
(§8) and a `Series` only when that view is `Valued`; `Missing` and `NoAnswer` produce no series at
all, so there is no chart to draw and no axis to invent. A banded series (roll-centre migration from
an estimated input, for instance) draws its band as a shaded envelope rather than a second line, and
the caption carries the tier — a chart that hides a band is a chart that lies. And no chart is written
for a quantity the build does not compute: damping ratio ships as an estimated *reading* with its
band, not as a damper curve, because a curve needs a damper document that v1 does not have (§8.6,
requirements §4.8) — so visx gains no speculative usage.

At most three files import visx, all under `src/charts/`: a single-maintainer-adjacent package with a
history of breaking majors, and the wrapper is what makes replacing it a day's work. It has no log
axis and damper curves want one — transform to `log10` in the presenter. Charts do not animate during
a drag (D-21: dropping frames is a defect), and the band envelope is drawn, not animated.

## 7. One result type, per-field validity

**Pick: one discriminated union, `Solved<T>`, defined in `packages/physics`, specified in `physics/00`
§4, carrying value, band, tier and provenance. Three transport states, one reason enum, one flag enum,
one two-value tier. A query returns a struct of `Solved` fields — never a `Solved` of a struct.**

```ts
// packages/physics/src/result/solved.ts — shape only; 00 §4 is the specification.
export type Solved<T> =
  | {
      readonly kind: 'defined';        // tier lives on 'defined': a missing number has no worth to grade
      readonly value: T;               // SI
      readonly tier: Tier;             // 'firm' | 'inferred' (§4.11); derived, never declared
      readonly band: Band | null;      // required when tier is 'inferred', computed by re-running (§4.8)
      readonly basis: Basis | null;    // required when tier is 'inferred': what the claim rests on
      readonly provenance: ReadonlySet<Ref>;   // opaque tags for every input consumed (source ids)
      readonly flags: ReadonlySet<Flag>;       // conditioning, assumed inputs, out-of-domain
    }
  | { readonly kind: 'notMeasured'; missing: readonly FieldRef[] }   // tier: missing
  | { readonly kind: 'undefined'; reason: UndefinedReason;
      inputs: readonly FieldRef[] };                                 // tier: undefined
```

A `switch` on `kind` is exhaustive and every call site ends with a `default: assertNever(x)` — the
TypeScript equivalent of Dart's sealed-class exhaustive switch, and the reason a new reason code fails
to compile rather than rendering blank (Risk 2). The package compiles with `strict`,
`noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`, so an array read or an optional property
cannot quietly produce `undefined` where the type promises a value.

The contents of `UndefinedReason` and `Flag`, and every tolerance that feeds them, are specified in
`physics/00` §4 and are **not restated here**. Two lists drift, and B6 is what that costs: this
document's old `Solved` against `00`'s `Result`, twenty reason names of which six were canonical, and
a 10⁵ disagreement (1e-2 / 1e-4 against 1e-9) about when the same geometry is trustworthy.

What architecture does own:

- **Tier and state answer different questions, and neither vocabulary is invented here.** The
  requirements' tier (`firm` / `inferred` / `speculative`, §4.11) says what a number is worth; the
  requirements' state (eight values, precedence-ordered, §4.4.1) says whether it exists and what is
  missing. The package carries the *inputs* to both — value, band, basis, provenance, quality flags —
  and **`packages/data` derives the state**, because only it knows each consumed field's `on_absence`
  policy and its `plausible` bounds. The app formats. That split is what keeps the state vocabulary in
  one place while keeping the solver JSON-free.
- **Tier is derived, never declared.** The envelope's tier is `firm` when every consumed value carries
  a `measured` source and the equation is used inside its stated domain, and `inferred` otherwise — a
  function does not choose it. `speculative` never appears on a computed value: §4.11 gives it to
  suggested changes (the setup-sheet interpreter), which are advice, not outputs, so the package's enum
  is `firm | inferred` and the app adds `speculative` for advice items only. *Cost:* the adapter must
  carry a source type per input, so `PhysicsInput` fields are wrapped rather than bare numbers.
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
  table renders the sentence and appends "all else equal". The physics package is React-free,
  locale-free and copy-free; a sentence inside it would be a translatable string in the one package
  that cannot load the string table.
- **`provenance` is opaque to physics.** Values arrive wrapped in a tag the adapter assigns from the
  document's `s` ids; the package never interprets it and returns the set it consumed. That keeps the
  dependency direction of §1 intact — physics still cannot name a document field — while letting the
  "how" view (E3.7) show the provenance of every input behind a number.
- **Per field, never per struct.** `frontViewKinematics` returns ten `Solved<number>`. G02.7 is the
  proof: parallel arms leave `z_rc` defined — at ground level — while `y_rc` has no limit expression,
  and E1.2 and E3.8 both require the UI to speak per output. A struct-level verdict would force the UI
  to discard nine good numbers because the tenth is undefined. *Cost:* callers destructure more, and a
  component that wants "the roll centre" must pick a field and handle its state — which is the point.
- **Not re-declared anywhere.** The app imports the type from `packages/physics`; `packages/data`
  never wraps it; there is no `ResultDto`. State, tier, reason and flag names persist and travel as
  *strings* (`'parallelLinks'`, `'inferred'`), never as numeric enum values, so re-ordering a union
  member cannot change an export or a golden fixture. Within a document major the vocabularies are
  additive only — which is also what lets §4.4.1 gain a ninth state without touching a saved file.
- **Conditioning is a flag.** Whether a defined number is trustworthy is a matter of degree; a third
  tier would imply a categorical boundary the physics does not have. One threshold, defined and
  exported by the physics package; the app's "nearly parallel" copy reads that flag and compares
  against nothing of its own. The 1e-2 / 1e-4 numbers this document used to propose are withdrawn.
- **No nullable numbers, and the envelope is never partially filled.** No public function returns
  `number | null`, `undefined` or `NaN`. A property test over 10k seeded geometries asserts every
  `defined` value is finite, every envelope with tier `inferred` carries both a band and a procedure,
  every `undefined` names a reason code, and every `notMeasured` names at least one field. A banded
  claim without its band is the same failure as a number without a unit — and worse, because it looks
  more honest than it is.

## 8. The "computed, not yet validated" state

**Decision (D-11 + owner decision, 2026-10-30): every value carries a state, a tier, a band where it
is estimated and a basis where it is inferred, and no surface shows a bare number. Three axes, each
owned by exactly one document:**

| Axis | Values | Authority | Where it is decided |
|---|---|---|---|
| **State** — does the number exist, and what is missing | `UNDEFINED(reason)`, `REFUSED(field)`, `OUT_OF_DOMAIN(bound)`, `COMPUTED_INCOMPLETE(fields)`, `COMPUTED_ASSUMED(fields)`, `INFERRED(procedure, band)`, `ESTIMATED_INPUTS(n)`, `COMPUTED` — in that precedence, highest wins | requirements §4.4.1 | `packages/data`, from `on_absence`, `plausible` and the result envelope |
| **Tier** — how much the number is worth | `firm`, `inferred`, `speculative` | requirements §4.11 | `packages/physics` for the first two (§7); the app adds `speculative` for advice only |
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

- `packages/physics/src/evidence/evidenceTable.ts` records, per output id, which golden cases exist
  (E3.11) and their `source_kind`. That is a property of the build.
- the *model's* recorded measurement check (E3.13's measured-vs-computed, with date and car) is a
  property of the user's car, and is stored in the model document. E3.16 makes `validated` conditional
  on it existing for *that model*, and it cannot be inferred from the build.

So the state is a function of (result envelope, the schema's `on_absence`/`plausible` facts) and is
derived in exactly one place — `packages/data`'s state module — while the display value adds the
evidence axis and is assembled in exactly one other, `web/src/present/`. Neither is ever assembled ad
hoc on a screen, and neither package recomputes the other's half.

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

```ts
// web/src/present/propertyView.ts
export interface PropertyViewBase {
  readonly state: Claims;        // one of the eight §4.4.1 states, with its payload
  readonly tier: Tier;           // 'firm' | 'inferred' | 'speculative' (§4.11)
  readonly evidence: Evidence;   // 'validated' | 'not_yet_validated' (E3.16)
}
export type PropertyView =
  | (PropertyViewBase & { kind: 'valued';
      formatted: string;         // already rounded, with its unit
      band: Band | null;         // printed next to the number; required by INFERRED / ESTIMATED_INPUTS
      basisSentence: string | null })   // procedure sentence; ends "all else equal" when behavioural
  | (PropertyViewBase & { kind: 'refused'; fields: readonly string[] })  // document paths, no unit
  | (PropertyViewBase & { kind: 'noAnswer'; reason: string; message: string }); // UNDEFINED
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
- A component that renders a computed number accepts `PropertyView` and nothing else. `src/format/` is
  the only place a number becomes a `string`; `src/present/` is the only place a `Solved` becomes a
  `PropertyView`. A grep test bans `toFixed`, `Intl.NumberFormat(` and template interpolation of a
  number under `src/features/`, extending E8.9a's no-assembly lint to numbers. Why a test and not a
  review rule: D9's finding is that no acceptance criterion required a per-output state, so an
  unvalidated model rendered `9.97` with a unit and no caveat. *Cost:* every card needs a wrapper, and
  a quick debug print needs a formatter call.
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
- **Compare refuses a delta unless both sides carry a number, and labels the two tiers.** Two `valued`
  views render a delta; anything against `refused` or `noAnswer` renders both states and no delta; and
  a delta between an `inferred` and a `firm` value is labelled with both tiers, because "wheel rate up
  4%" against a banded estimate is a different claim from two firm numbers. For ζ the compare view goes
  further, as §4.8 and E3.6(e) require: the signed direction and magnitude of the change is rendered
  *above* the absolute values, because the change is the trustworthy part.

**4. How evidence moves.** One output at a time: a row in `physics/99` §9's results log, then the
inventory in `evidenceTable.ts`, then the chip changes everywhere it showed. The check is a review
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

Precedence is the requirements' order, highest first, and it is asserted by a test rather than restated
in prose twice: a value that is both out of domain and built on an estimate is `OUT_OF_DOMAIN`, because
the bound is the harder fact.

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

Four runners, each with one job, and a rule about which of them may be called from the gate.

| Layer | Runner | Proves | Volume |
|---|---|---|---|
| Physics unit | **Vitest** (`packages/physics`) | each formula against a cited hand calc in `docs/specs/physics/` | ≥1 per public function |
| Golden numeric (JSON: input → expected → tolerance → `source`) | Vitest | no regressions; every expected value traceable | per module + one full vehicle |
| Result type | Vitest | every reason code reachable from a fixture; per-field independence (G02.7); `notMeasured` names ≥1 field; every `inferred` envelope carries a band and a procedure; no `null`/`NaN` at any boundary | one fixture per reason code and per tier |
| State derivation | Vitest (`packages/data`) | one fixture per §4.4.1 state, and the precedence order: a value that is both out of domain and estimated reads `OUT_OF_DOMAIN`; a missing field under each of the four `on_absence` policies produces its own state | 8 states × 4 policies |
| Property/fuzz (seeded) | Vitest + `fast-check` | no `NaN`/`Inf` escapes; every `undefined` carries a reason code; tier propagation never improves an output above its weakest input | 10k cases, <2 s |
| Adapter | Vitest | mm/g/deg → SI and back; the 0.1 mm grid sweep; one conversion site; provenance tags survive the round trip | every stored quantity × both directions |
| Document/migration | Vitest | assets validate; load→save identity; v(n)→v(n+1) byte fixtures; RFC 8785 hash fixtures; a transaction aborted mid-write (E8.12) | all assets, all fixtures |
| Storage | Vitest + `fake-indexeddb` | every `DocumentStore` operation; the `current` pointer rebuilt after loss; quarantine on an unreadable record; both `fileAccess` backends against a mocked capability object | every operation × both backends |
| Presentation | Vitest, headless | envelope + schema → `PropertyView` for every state; band present whenever `INFERRED`/`ESTIMATED_INPUTS`; basis sentence ends "all else equal" for behaviour claims; marks derived from provenance and `plausible`; no delta against an absent value; ζ never marked `validated` | per output |
| Component | **Testing Library** (`web/test`) | a slider updates the number; the equation expands; the SVG scene's nodes sit at the scene's coordinates (1e-9); tap targets hold; at 200% text every value's full string is in the accessibility tree (E8.7b); `axe-core` finds no violation on each route (E8.8) | thin, per screen |
| Gate stages | Vitest (the gate's own suite) | each stage fails on its seeded failure, naming the defect: a `specTest` deleted / unknown / LATER-annotated (E9.9); one `on_absence` deleted, unknown `consumed_by`, altered Markdown cell, version without fixture (E9.10); an off-origin `fetch` added to the bundle (E8.1); an analytics package added to `package.json` (E8.13) | one seeded test per stage |
| Gate hygiene (static) | Vitest + grep | no unit literal in `packages/physics/src` or `web/src/features`; no React or DOM import in either package; no formatting outside `src/format/`; at most three files import the chart library; every golden ID has a test | one test each |
| End-to-end | **Playwright**, Chromium on CI | **one path only:** first load → import the example model → open its setup → drag one slider → read a value → export → reload the page → the value survives → then the same path with the network disabled | 1 spec file, 2 runs (online, offline) |
| Performance | Vitest (compute) + Playwright (frames) | E3.12's recompute budget over 1,000 iterations; a 10 s drag with frame timings. CI hardware proxy gated at 2× the target so a real regression trips it and a noisy runner does not | 3 models |

**One end-to-end test, deliberately.** Playwright is the only runner that needs a browser download, a
server and a real service worker; every additional spec multiplies flakiness against a budget that
runs on every PR. The single path above is the one that exercises the things only a real browser can
prove: the offline shell, the storage surviving a reload, and a download actually producing a file. If
a second path is ever needed, it is a second *run of the same spec* with a different fixture, not a
second file.

Tolerances live in the fixture, not the test body: 1e-9 relative for closed-form algebra, 1e-6 for
iterative work *with the iteration count and bracket fixed by the spec* (M13 — a tolerance on a
finite-difference or a bisection is meaningless without the step), and absolute only where a value
legitimately approaches zero, with the fixture saying why. A blanket 1e-9 across devices is not
achievable downstream of a bisection and is not what this harness asserts.

**No mechanism may rewrite an expected number.** For numeric goldens the fixture is edited by hand, in
a commit that changes the cited `source` or explains why the source now reads differently; `vitest -u`
is never run on a golden file, and the gate fails if a golden's `expected` changed in a commit that did
not touch `source_ref` or the fixture's own justification. Visual snapshots are the exception: a
screenshot baseline may be regenerated, and it lives only in the Playwright suite.

**CI must gate:** zero type errors; every layer above except the ones that need a browser (component,
e2e, frame timing) which run in their own jobs and are required for a merge. **Must not gate:** coverage
percentage or warning counts. **No retries:** a retried test hides a race, and Playwright's `retries` is
0 on CI — flakiness is a defect in the spec, not weather.

## 10. GitHub Actions and the gate

**The gate is `npm run gate` from the repository root (D-19, recorded in `AGENTS.md`).** One command,
because the convention's rule is that a gate is one exact command and the workspace has three packages
— two of which an app-scoped command cannot see at all.

E9.8 fixes the stage list, and the gate must match it exactly in both directions — a stage in
`tool/gate.ts` with no AC fails the spec audit, and a stage named in E9.8 but missing from the gate
fails the gate:

| Stage | What it does | AC |
|---|---|---|
| `typecheck` | `tsc --noEmit` per workspace, with the project references that make `packages/physics` compile without the DOM lib; zero errors | E9.8 |
| `test` | `vitest run` per workspace — including the schema, migration, adapter, tier, state, presentation, storage and grep tests above | E9.8 |
| `spec-audit` | every MUST id in the requirements has a `specTest('<id>')`, every annotation names a real id with the same tag and release marker, no LATER id is annotated | E9.9 |
| `schema` | `fields.yaml` ↔ Markdown tables ↔ generated TypeScript table ↔ fixtures: every field once per kind with `on_absence ∈ {ASSUME, ESTIMATE, REFUSE, OMIT}` (`ESTIMATE` with a procedure id and `band: true`; `ASSUME` with a value, which must lie inside the field's own `plausible` interval), every `consumed_by` id exists, one fixture per written `schema_version`, generator output current | E9.10 |
| `ip` | no predecessor names, no `.sdf`/database asset, no 8-word overlap the corpus check rejects | E9.4, E5.4 |
| `offline` | the built bundle and the service worker's precache manifest: every shell asset is precached, no module calls `fetch`/`XMLHttpRequest`/`WebSocket` to an off-origin URL, no `<script src>` points off-origin, and a seeded off-origin `fetch` makes the stage exit non-zero naming the module | E8.1 |
| `dependencies` | no analytics, advertising or crash-reporting package in the resolved tree; the Privacy screen's text equals `docs/release/privacy.txt`; every dependency's declared purpose is recorded, so E8.13's review is a diff rather than a memory | E8.13 |
| `strings` | no user-facing string assembled by concatenation; every string resolves from the table; no forbidden claim word (grip score, faster, lap time…) | E5.6, E8.9a |

Eight stages, each with its own seeded-failure test: that combination is the answer to D6. Two stage
names changed with the stack — `analyse` became `typecheck` because that is what the TypeScript
compiler does and calling it "analyse" would send a reader looking for a linter — and `manifest`
became `offline`, because the property being asserted survived the switch (the app cannot reach the
network) and the artefact that proved it did not.

`tool/gate.ts` runs every stage even after a failure, prints each command and its exit code, and exits
non-zero if any failed: a gate that stops at the first failure costs one round trip per fix. *Cost of
the indirection:* a contributor who runs `vitest` locally gets a green that is not the gate —
mitigated by the gate printing what it runs, and by the PR template asking for its output (E9.8
requires the output in the PR).

```yaml
name: gates
on: [push, pull_request]
jobs:
  gate:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: npm }
      - run: npm ci
      - run: npm run gate
  build:
    needs: gate
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: npm }
      - run: npm ci
      - run: npm run build --workspace web
      - run: npx size-limit   # E8.11: fails above the D-21 budgets, prints the numbers
      - uses: actions/upload-artifact@v4
        with: { name: dist, path: web/dist }
  e2e:
    needs: build
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: npm }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - uses: actions/download-artifact@v4
        with: { name: dist, path: web/dist }
      - run: npm run e2e
```

**Three jobs, and no secrets in any of them.** There is no signing key, no store credential and no
release token in CI: the artefact is a directory of static files, and the deploy is the host's own
build hook (or a token held by Dave alone, §11). Deleting the Flutter workflow deleted the only reason
this repository ever needed a secret.

The `e2e` job is required for a merge but is deliberately **not** a gate stage: it needs a browser
download and a served build, and a gate that cannot run on a laptop is not the gate a contributor runs
before pushing. `size-limit` is likewise in the build job, not the gate — it needs an artefact.

**No golden-image job for Flutter-vs-Flutter stability.** Screenshot baselines are Playwright's,
compare only against the same pinned Linux image and the same Chromium build that the action installs,
and are never a merge blocker for a non-visual change: unlike Flutter goldens they are not pixel-stable
across OS and font stacks, which is exactly why the pinned-image rationale carries over and the
"image goldens as a gate" idea does not.

Dependabot covers npm and Actions. A monthly PR against `.nvmrc` keeps the Node bump reviewable, and a
Node bump re-runs the build job so the size numbers are re-measured rather than assumed.

## 11. Release path: static hosting, no store

**Decision (D-19): v1 ships as a static site — Cloudflare Pages as the assumed target — installable
to a home screen, with no store account, no signing key and no review cycle.**

| | Web (v1) |
|---|---|
| Identifier | the URL: `setuplab.<domain>` (a subdomain Dave already controls via Cloudflare) |
| Version | `package.json` version + build id stamped into the app shell; tag `v1.2.3` |
| Browser floor | current and previous major version of Safari (iOS and macOS), Chrome (Android, desktop) and Firefox; iOS 16.4+ as the floor for a service worker that can precache the shell |
| Account | Cloudflare (existing), free tier |
| Signing | none — TLS is the host's |
| Artefact | `web/dist/`, an immutable hashed asset tree plus `index.html`, `sw.js`, `manifest.webmanifest` |
| Rollback | redeploy the previous build; the host keeps every deployment addressable |

**What Dave must own now.** A Cloudflare Pages project pointed at this repository, a build command
(`npm run build --workspace web`) and an output directory (`web/dist`); a custom domain or subdomain;
and the decision on whether deploys are automatic from `main` or promoted by hand. Nothing else: no
identity verification, no testers, no upload key, no data-safety form. **That is the whole win of
D-19** — v1's shipping date stops depending on a fortnight of Play's closed test and a US$25 account,
and the maintenance burden stops including a store listing that must be updated when a target API
level rises.

### 11.1 The service worker, and the staleness it creates

The service worker precaches the app shell on install and serves it cache-first; documents are never
cached by the service worker at all (they live in IndexedDB, and a cached HTTP response of a document
would be a second source of truth).

```
install  → precache shell (hashed JS/CSS, index.html, fonts, icons, manifest)
activate → delete every cache whose name is not the current build id
fetch    → navigation requests: cache-first on index.html, network only as a fallback for a
           path the precache does not have; hashed assets: cache-first, immutable
```

**The cost of offline-first is that a user can run a stale app.** The rule, so it is a decision rather
than an accident:

- A new build is **detected, announced, never applied silently**: the new worker installs, then waits,
  and the app shows one line — "A new version is ready" — with a *Reload* action. `skipWaiting()` runs
  only from that action, because swapping the shell under a running tab with hashed chunk names is how
  a SPA shows a blank screen mid-edit.
- `index.html` and `sw.js` are served `no-cache`; hashed assets are `immutable, max-age=31536000`.
  A stale `index.html` pointing at a deleted hash is the failure this rule exists to prevent, and it is
  the one failure mode that only appears *after* a deploy, on someone else's phone.
- The build id is shown on the about screen next to the app version, so a bug report says which shell
  the user was running (E9.1).

### 11.2 Offline-first verification, on a phone, before a release

A checklist item, not a test suite, and it is the only release step that cannot be automated: on the
reference phone, over the real network and then in airplane mode —

1. open the URL cold, install to the home screen, and confirm the icon and the splash behaviour;
2. load one model and one setup, then **turn the radio off** and cold-start from the home-screen icon:
   the app opens, the library shows, the analysis computes, the compare view works;
3. reload *while offline* and confirm the same;
4. export everything, confirm the file lands somewhere the user can find it, then import it on a
   second device and confirm the hashes match (E7.1a's fixture, by hand);
5. leave the app installed and untouched for eight days, then confirm the library is still there — the
   seven-day eviction rule is the thing this step exists to disprove on the installed case.

Steps 1–4 are repeated on iOS Safari and on Android Chrome, because they diverge in exactly the ways
§4 says they do.

### 11.3 What stays free and verifiable

No IAP, no accounts, no analytics or crash SDK, no ads, and **no network requests after the first
load** — making "works offline" a property a reviewer can see in the devtools Network panel and the
gate asserts statically (E8.1's `offline` stage). The claim is "free to use, no account, no server, no
ads" rather than "zero cost to run", which the owner's bank statement would contradict (spec D9). A
static host's bandwidth bill is the one running cost, and it is the host's free tier until the app is
popular enough that it is a good problem.

**App version and document `schema_version` are unrelated.** Conflate them and a bug fix cannot ship
without migrating every saved car. Build ids must increase monotonically per deploy, because a
home-screen app can be running any of them.

## Risks

**1. Precision is not the risk it looks like; conditioning is.** A JavaScript `number` is IEEE-754
binary64, exactly as a Dart `double` was, and a 0.1 mm measurement carries four significant digits
against sixteen available; measured mm→m→mm error across 5,001 values is 2.8e-14 mm. But for a typical
55 mm lower arm the instant-centre distance behaves as ≈ 0.047 / sin(Δθ) metres, Δθ being the angle
between the links: 5.9° gives 0.48 m, 0.9° gives 2.9 m, 0.08° gives 31.5 m — and there a 0.1° change
in link angle moves the instant centre 38 m. No precision fixes that: the *input* resolution does not
support the answer. The solver therefore reports conditioning as a `Flag` with a single threshold
defined in `physics/00` §4, and the UI says the geometry is nearly parallel and the number is not
meaningful. This document no longer proposes its own threshold: it proposed 1e-2 / 1e-4 against 00's
1e-9, and two thresholds for one question is how a user learns to distrust the warning.

**2. Result-type drift.** B6 was three shapes and twenty names; §7 closes it by deferring to one
specification. The residual risk is a developer adding a reason code in the package and a string in the
UI. Mitigation: reason codes are exported as `as const` objects with their wire strings, the app's
message table is an exhaustive `switch` closed by `assertNever`, so a new code fails to typecheck rather
than rendering blank. *Cost:* adding a reason touches two files instead of one, which is the price of the
compile-time check.

**3. Repeated solves — the risk moved from the maths to the browser.** A full two-axle analysis is
E3.12's provisional p50 ≤ 8 ms budget (D-21), and one axle is a fraction of it; a 60 Hz frame is
16.7 ms, and the browser's own work — style, layout, paint — now shares that frame with the solver in a
way the native widget tree did not. The risk is therefore not the arithmetic but three things around
it: React re-rendering more than the one number that changed, the chart re-drawing during a drag, and
the main thread being blocked by a solve long enough to drop input. In order: a derived store with
`requestAnimationFrame` coalescing (one solve per frame), leaf selectors so a drag re-renders one
component, no chart animation and no chart re-layout while dragging, and only then a Web Worker with
latest-value-wins — a worker hop costs more than the work it offloads when the work is a few
milliseconds, and it adds a structured-clone of the result envelope per frame. *Cost of being wrong:*
E3.12 fails on the reference phone and the fix is architectural, which is why D-21 re-baselines after
the first measurement instead of promising the Dart number carried over.

**4. Accessibility** — three specific failures rather than an aspiration: (a) the results table at 200%
text — tested at 200% browser zoom and at a 32 px root font size, not at 100%; (b) the drawing as sole
carrier of information, so every visual has a table equivalent and an `aria-label`, and the SVG scene is
`role="img"` with a spoken summary rather than 40 unlabelled circles; (c) sliders as the only input, so
every slider has a text-field fallback that also fixes precise entry. Plus 44 px targets (CSS px, which
the requirements now say instead of dp), 4.5:1 contrast, colour never the only encoding, and
`prefers-reduced-motion`. The tier and the band are part of this: state must be readable as text, not
only as a colour, a tilde or a chip, which is why E8.8's assertion names the validation state
explicitly.

**5. Two lists checked by people, not by tests.** The generated schema table against the requirements'
Markdown, and the evidence inventory against `99-validation`'s log. The first is partly mechanised
(E9.10 regenerates the Markdown and fails on a hand edit); the second is deliberately not, because a
parser over prose is the circular gate D6 named. Residual risk stated plainly: an evidence level can be
raised in code with no log row, and only a reviewer stops it.

**6. A band is not a tolerance.** Once the app prints a band next to a damping ratio, a user can read it
as "this number is good to this much" — which is true — or as "a change this large is real" — which is
not, because two banded estimates do not have a banded difference of the same width. The mitigation is
one sentence in the band's help text and a compare row that shows both bands rather than one delta;
E3.6(e)'s rule that the compare view leads with the signed change is the same mitigation, seen from the
other end. The cost of getting it wrong is a user tuning to noise with the app's blessing.

**7. Storage is rented, not owned.** The Flutter design could say "kept for as long as they keep the
app" and mean it, because the app owned a directory. Here the browser decides: it evicts under
pressure, Safari evicts the data of unvisited sites after seven days, and a user who clears site data
clears the library. D-20 answers this with persist(), the install nudge and the export nag (§4), and the
honest statement in the spec is that an unexported, uninstalled library is *not* durable. The residual
risk is social rather than technical: users will treat a web app as permanent because every other web
app is, so the nag has to be visible without being a modal, and "export everything" has to produce one
file rather than a folder of them.

**8. Float determinism across JavaScript engines, and the same class of risk in the hash.** V8, JSC and
SpiderMonkey implement `Math.sin`, `Math.cos`, `Math.atan2` and `Math.pow` with different — each
correct-to-spec, not bit-identical — algorithms, so two phones can disagree in the last few ULPs of a
transcendental. That is why E3.10 was deleted in round 2 (bit-agreement across platforms was never a
real requirement) and why every golden carries a tolerance rather than an equality. The hash is the
sharper edge: RFC 8785 pins *number formatting*, not arithmetic, so a `content_hash` only depends on
stored values and is engine-independent — **provided nothing computed is ever written into a document**
(§5 rule 4). That rule was already absolute; in this stack it is also the thing keeping two phones'
hashes equal, and it gets a test that hashes a document after a full solve-and-render cycle and asserts
the hash is unchanged.

## Open questions

1. **Where community chassis models live**: `assets/models/` in this repo (reviewable, but model PRs
   inflate app history) or a separate models repo bundled at build time. v1 assumes in-repo.
2. **Are `speculative` advice items the same type as outputs?** §4.11 gives `speculative` to a suggested
   change from the setup-sheet interpreter (E2.13), which is advice rather than a result. Two options:
   reuse `PropertyView` with `tier: speculative` (one type, one renderer, but an advice item can then be
   mistaken for an output by any code that filters on "is a PropertyView"), or a separate `AdviceView`
   that *contains* one (a second type at the boundary, and the export needs both). Not decided here
   because the interpreter is R2; the cost of deciding late is a migration of every advice surface, not
   of the documents.
3. **Does `on_absence` live in `fields.yaml` or only in the requirements tables?** E9.10 now makes the
   YAML normative, so the manifest reading is the default; the open part is whether the *assumption
   marks* and the `missing`/`estimated` mapping are generated from it too or hand-written per field.
4. **A shared link to a car on another device (new, forced by D-19).** §3.3's notice says "ask for the
   file"; the alternative is a link format that carries the document (a URL fragment with a compressed
   model, ~100 KB, which is at the edge of practical) or a read-only hosted render (a backend, which
   N-05 forbids). Out of v1; recorded because every shared link now raises it.
5. **Hosting and deploy trigger (owner decision).** Cloudflare Pages is assumed throughout §11. What is
   not decided: the subdomain, whether `main` deploys automatically, and whether preview deployments per
   PR are enabled. None of it changes the architecture; all of it changes who can publish.
6. **Do the Safari-relevant ACs move from R2 to R1?** The R0/R1/R2 allocation in `spec.md` §8.2 was
   partly made by platform ("Apple clauses are R2 by construction", spec §8 preamble). D-19 removes
   that rationale: one URL serves both engines from day one. Re-marking is a scope decision, not an
   editorial one, so this round changed no markers for that reason and recorded it instead.
