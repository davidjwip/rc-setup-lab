# Round 4 verdict — checking the conversion against the audit

Reviewer: Kimi (author of `01-kimi-review.md`). Subject: commit `cd02f89` against `2b6de41`,
checked against the audit's §1 (fourteen file-group findings), §3 (eight blockers), and the
acceptance-criteria ledger, verified mechanically against `git show 2b6de41:docs/specs/spec.md`.
D-19 … D-23 are the owner's rulings and are not re-litigated here.

Method note: every criterion id, tag and release marker was extracted from both spec revisions
by script and compared set-wise; the §3 tags were checked against the §8.2 table row for row.
Quotes below are from the current text unless marked `2b6de41:`.

---

## 1. The fourteen file-group findings

| # | Group | Verdict | Evidence / what remains |
|---|---|---|---|
| 1.1 | `AGENTS.md` | **fixed** | Line 3 "a free web app (React + TypeScript, installable as a PWA, fully offline)"; layout block names `web/`, `packages/physics`, `packages/data`; stage table reads "Web app feature work (TDD)"; gates section is `npm run gate` with the one-command contract intact; "A JavaScript `number` is not a CAD kernel" reworded and *strengthened* (the conditioning argument now names the sentinel rule). The no-Dart rule is stated positively (line 26-27). |
| 1.2 | `README.md` | **fixed** | Line 5 "cross-platform **web app** … React + TypeScript"; status table row "Web app (React + TS, PWA) \| `web/`"; repository map names `package.json`, `web/`, `packages/physics/`, `packages/data/`. |
| 1.3 | `docs/decisions.md` | **partially** | D-19 moved after D-18 (now line 140, D-18 at 131) ✓. D-09 annotated "Superseded in form by D-19" (line 15) ✓. D-10 annotated "Superseded by D-19 … the enrolment question is closed" (line 27) ✓. **D-16 unfixed: line 108 still reads "Prose tables and the generated Dart table are *views* of it"** — the audit asked for "generated TypeScript table" and the sentence is written in the present tense as live text, so it does not get historical cover. |
| 1.4 | `docs/intent.md` | **fixed** | Constraints rewritten (lines 51-59): "One web app — React + TypeScript, built with Vite … One URL serves Android, iOS and desktop"; "Physics is a pure TypeScript package with no DOM". The audit's note (D-19 made the store path *less* relevant) is absorbed. |
| 1.5 | `docs/review-rules.md` | **fixed** | Rule 3 is the no-DOM wall in TypeScript terms: `tsconfig.json` omits the `DOM` lib so `document`/`window`/`fetch`/`navigator` are type errors, plus a `package.json` assertion and a grep for React imports. The mechanism changed, the wall survived — exactly what the audit asked. Rule 1's check is now `npm run gate` (line 11). |
| 1.6 | `docs/specs/spec.md` | **fixed** (with two new contradictions, §4 items 1–2) | Every site the audit named is rewritten: §2 re-anchors v1 to "the web release — one URL, installable, working with no network after its first load" (line 141-146) and R1 to "the first public web release. **41 MUSTs**" (line 154); §2.4's decision table leads with D-19 and names the accepted loss ("no file association", line 210); E6.2 drives picker/drop/paste (line 788); the E8 preamble is written against Safari + Chrome as day-one engines (line 942-949); E8.1 is the offline assertion with a seeded off-origin `fetch` (line 951); E8.6 is a browser matrix in CSS px (line 981); E8.9a says "user-facing components" (line 1018); E8.11 is D-21's three budgets and fails the build above them (line 1025); E8.12 kills a transaction, not a rename (line 1035); E8.13 clause (c) is the no-third-party request-log test (line 1048); E9.5 measures from "first page load — or from the home-screen icon" (line 1138); E9.8 is `npm run gate` with `typecheck`/`offline` stage names (line 1157); C-01/C-02 are install-surface and size-measurement items and C-06 is marked SUPERSEDED with its substance re-homed (lines 1203-1208). "dp" is gone from the spec outside physics docs' "4 dp" decimal-places usage. |
| 1.7 | `docs/specs/architecture.md` | **fixed** (one dangling cross-reference, §4 item 7) | Full rewrite as the audit's §2 prescribed: §1 npm workspaces with the no-DOM wall as a *type* error (line 113-119); §2 Zustand with the Riverpod requirements restated as five numbered acceptance criteria on the pick (line 169-187) — the audit's explicit condition; §3 routing with a back/refresh rules table (line 239-247), the iOS edge-swipe stated as uncatchable with two design consequences (line 254-261), and the deep-link missing-car case re-framed as the common case (line 295-302); §4 IndexedDB with the localStorage arithmetic, the transaction-not-rename rule, and the eviction answer on screen (line 336-392); §9 Vitest/Testing Library/Playwright with screenshot baselines not gating (line 1010-1014); §10 the eight-stage gate and the three-job no-secrets CI; §11 static hosting; old §12 deleted with its build-now items re-homed (line 29-31); Risk 3 rewritten (line 1118). The Dart `sealed class` is now a discriminated union with `assertNever` (line 648-669). The duplicated sentence at old :698-699 appears once now (grep count: 1). The `--update-goldens` parenthetical is re-scoped: `vitest -u` banned for numerics, screenshot regeneration allowed in the Playwright suite only (line 919-923). |
| 1.8 | `docs/specs/fields.yaml` | **fixed** | One comment line changed: `tool/gen_schema.dart` → `tool/gen_schema.ts`. Nothing else touched, as instructed. |
| 1.9 | physics `00-overview.md` / `99-validation.md` | **fixed for the five lines; rename residue remains** | The five quoted lines are done, and `08-tyre-interface.md`'s Dart block became a TypeScript interface. **But `00-overview.md:24, :158, :161` still name `setup_physics` and `:336` still names `app/test/golden/`** — the dead package name and dead path in a normative document. These sat inside my "do not touch" boundary, so the residue is my boundary's fault, not the updater's; it still has to go (§4 item 6). |
| 1.10 | `docs/design/design-system.md` | **fixed** (one new internal tension, §4 item 8) | Roboto logic → system stack with the E8.11 zero-bytes argument (line 134-142); `Text` widget → separate `<span>` inside one labelled group (§3.3); `BoxShadow` → "no `box-shadow` anywhere except the sheet scrim" with the reason kept (§6); haptics dropped with an honest paragraph, not a rename (§7, line 289); safe area is `env(safe-area-inset-*)` (line 220); §12 is now a CSS custom-properties map with the M3 role *names* kept and Material-as-mechanism explicitly gone; `<dialog>.showModal()` for sheets. Token tables (§2–§3) are unchanged, as instructed. |
| 1.11 | `docs/design/flows.md`, `screens.md` | **fixed** | flows.md: header names React Router + Zustand and defers to architecture §3 as binding; the `indexedStack` behaviour is re-specified as a remembered-path map (line 38-44); the swipe cautions landed at both flagged spots (baseline long-press, line ~401; Why-sheet scrim+close mandatory, line ~469-472); dp → px at :62, :289, :686; §14 re-anchored to stores/selectors and the `OutOfRange` variant removed *with the reason recorded* (line 755). screens.md: "a floating action button by position and weight, not a Material widget" (line 165-166). |
| 1.12 | Wireframes | **fixed** | `index.html` tokens/footer lines reworded; the visual content untouched. The `'Roboto'` entries in the wireframes' font stacks are CSS fallback lists matching the design system's own stack (design-system.md:137) — not residue. |
| 1.13 | `docs/procedures/` | **untouched, correct** | Not in the diff. Confirmed stack-clean in the audit; still clean. |
| 1.14 | `docs/design/DECISIONS-R1.md` | **fixed** | Historical banner at lines 2-3 ("where this file says 'Flutter' … read the"), plus a per-decision annotation where the reasoning survives (D-07's wall restated for npm/tsconfig, line 92-94). History not rewritten, as instructed. |

**Score: 12 fixed, 1 partially (D-16's "Dart table"), 1 fixed-with-residue (physics package names).**

---

## 2. The §3 blockers, one by one

| # | Blocker | Verdict | Evidence |
|---|---|---|---|
| 1 | R1 MUSTs unsatisfiable by construction (E8.1, E8.13(c), E9.8, E6.2(b), C-01/C-02/C-06) | **answered** | All six rewritten (§1.6 above). Critically, the *enforcement machinery* is now self-consistent: E9.8's stage list names only things that exist, and E9.3 parses a §3.5 whose items are all producible (no store evidence anywhere). The false-green construction is gone. |
| 2 | Persistence decision unmade | **answered** | D-20 rules IndexedDB + the eviction answer; architecture §4 does the arithmetic the audit demanded (200 models × ≤100 KB is "an order of magnitude past" localStorage, line 337-339), rejects OPFS with a reason, splits database-version from `schema_version` (the real trap, line 350-354), re-expresses E8.12 as kill-mid-transaction, and states Safari support exactly with a verification obligation on the reference device (line 381-392). E8.17/E8.18 carry it into requirements. |
| 3 | Back-behaviour and iOS gestures | **answered** | Architecture §3.1 is a rules table, not an inherited widget behaviour: edits push no history entry (autosave 500 ms), Back at first entry leaves the app, a cold deep link gets one synthetic parent so Back lands on Garage (line 241-247). The edge swipe is stated as the browser's uncatchable gesture with two binding design consequences (line 254-261), and flows.md's two swipe sites now say scrim-tap-and-close-button are mandatory. No tab-history trap is specified. |
| 4 | R1 defined as a store submission; D-10 live; Safari markers | **answered, except the marker re-decision — deliberately deferred** | R1 re-anchored (spec.md:141-146, 154); D-10 annotated in both places (decisions.md:27, spec §7.1). The audit said the Safari-relevant markers "must be re-decided, not assumed carried" — the conversion re-decided *that they need an owner scope decision* and recorded it as architecture open question 6 and report item 5.3, changing no markers for that reason. That is a legitimate escalation (Dave owns scope), not a silent carry — but it is **open**, and it should land before the R1 freeze. |
| 5 | 16 ms budget and the chart plan | **answered** | D-21 re-baselines (8 ms p50 / 16 ms p95, provisional, with "a criterion still carrying D-21's estimate after measurement is a review failure", spec.md:586-588); the frame now explicitly carries style/layout/paint (spec.md:2357-2360); Risk 3 names the three real risks in order (re-render containment, chart re-draw, main-thread blocking) with the Web Worker correctly demoted to last resort. Chart plan: visx behind a wrapper, tree-shaken *because of* the budget, no animation during a drag, canvas fallback above a few thousand points, no chart for an unvalued property (architecture §6). |
| 6 | Eight-state / tier / badge vocabulary — do not "fix" | **kept, correctly** | §7/§8 carry the vocabulary with mechanism renames only (`evidence_table.dart` → `evidenceTable.ts`, line 752). The one genuine collision — the design's five badges vs the eight states — is named as a disagreement with an architectural constraint attached rather than erased (architecture.md:823-831). See §4 item 7 for the dangling pointer. |
| 7 | RFC 8785 number-formatting trap | **answered, better than asked** | Architecture §4.2 (line 487-495): RFC 8785's number formatting *is* `Number::toString`, so the hand-written formatter dies with Dart and the risk moves to key-sorting and `meta` exclusion; the published hash fixtures remain the test and are still called "the most valuable files in the migration"; and the new trap the audit did not name — `NaN`/`Infinity` serialising as `null` — is caught by making E3.8's pre-hash validation load-bearing twice. |
| 8 | Smaller contradictions | **mostly answered** | Ordering fixed; duplicate sentence fixed; Roboto fixed; E8.11 has real numbers; the key-decisions table is §2.4 rewritten. Outstanding: D-16's "Dart table" (decisions.md:108), and two *new* contradictions the rewrite created (§4 items 1-2). |

---

## 3. Acceptance-criteria integrity — mechanical result

Extraction: `**E#.#** —` definitions from both spec revisions; markers from the trailing
`**MUST** · **R1**` tags; §8.2 rows parsed and compared id-by-id.

| Claim (02-update-report.md §2) | Measured | Result |
|---|---|---|
| 110 criteria total | 110 definitions, 110 §8.2 rows, no id in one and not the other | **true** |
| v1 = 49 MUSTs (R0 8 + R1 41) | R0 MUST 8, R1 MUST 41 → 49 (was 8 + 38 = 46 at `2b6de41`) | **true** |
| No id vanished without a disposition | 108 old ids all present; zero disappeared | **true** |
| No id duplicated | zero duplicates in either revision | **true** |
| 2 added | exactly E8.17, E8.18, both MUST/R1 | **true** |
| §3 tags match §8.2 row for row | 110/110 tag and release-marker agreement; 7 LATER items consistent in both | **true** |
| 5 marked SUPERSEDED | **4**: C-06 (spec.md:1208), L-05 (:2472), L-10 (:2477), E8.13 clause (c) (:2847). E8.11 is **not** superseded — it is rewritten and *promoted* SHOULD/R2 → MUST/R1 (:2846). | **false — the report miscounts and mischaracterises E8.11** |
| 25 moved to R2 to hold the cap | **0 markers moved this round.** The §8.3 row (spec.md:2859) is *inherited from round 2* — all 23 listed ids were already R2 at `2b6de41`; its reason text was edited 46→49 but the id list was not adjusted. v1 grew 46→49 by promoting E8.11 and adding E8.17/E8.18, not by cutting. | **false — and the row now contradicts the spec (§4 item 2)** |
| E9.11 folded into E8.1 | The fold row exists — but it already existed at `2b6de41` (round 2). The substance (offline assertion in E8.1) is real. | **true in the text; not this round's work** |
| Superseded substance covered | C-06 → E8.13(b) + new clause (c) ✓; L-05 → same-URL desktop, breakpoints in v1 (E8.6, architecture §3.2) ✓; L-10 → E8.6's Safari matrix ✓; E8.13(c) → the no-third-party request-log test ✓. No accepted-loss line is missing. | **true** |

**Integrity verdict: the ledger itself is sound** (no vanished ids, no dupes, tags consistent,
substance covered). **The report's arithmetic about dispositions is wrong in two places** (5→4,
25→0), and one inherited table row now contradicts the body it sits beside.

---

## 4. New problems the rewrite introduced

Each is actionable as written.

1. **`docs/specs/spec.md:200` — §2.3 quotes the old E3.12 budget.** "It must also hold E3.12's
   *recompute* budget (p50 ≤ 16 ms)" — E3.12 is now ≤ 8 ms p50 / ≤ 16 ms p95 (spec.md:579).
   Fix: change "(p50 ≤ 16 ms)" to "(p50 ≤ 8 ms, D-21 provisional)" or drop the number and cite E3.12.
2. **`docs/specs/spec.md:2859` — the "moved to R2" row still lists E8.11**, which is now MUST/R1
   (spec.md:1033) and therefore *does* block v1, flatly contradicting the row's own reason ("do not
   block v1"). Fix: remove `E8.11` from the id list (and note its promotion happened in round 4 in
   the E8.11 row at :2846, which already says so — the two rows just need to agree).
3. **`docs/specs/spec.md:2822` — §8.3 is titled "Removed in round 2"** but now holds twelve round-4
   dispositions (E8.1, E8.5, E8.6/7a/7b, E8.11, E8.12, E8.13(c), E6.2(b), E9.8, E3.12 rewrites;
   E8.17/18 additions). Fix: retitle to "Dispositions" (or add a Round column) so the next audit
   does not have to diff to learn which removal is which round's.
4. **`docs/specs/spec.md:1-4` — the header is stale**: still "Requirements Specification v0.2 …
   Status: revised after review round 1 … Date: 2026-10-30", while line 32 announces a round-4
   revision. Fix: bump the status/date lines (v0.3, round 4) — architecture.md:21 cites this
   document as "(v0.2)", so cite consistently whichever number is chosen.
5. **`docs/decisions.md:108` — D-16 still says "the generated Dart table are *views*"** in the
   present tense. Fix: "the generated TypeScript table". (Carried over from finding 1.3 — the one
   audit instruction not executed.)
6. **`docs/specs/physics/00-overview.md:24, 158, 161, 336` — rename inconsistency**: `setup_physics`
   (×3) and `app/test/golden/` (×1) name a package and path that no longer exist anywhere else in
   the repository. Fix: `packages/physics` and `packages/physics/test/golden/`. These were inside my
   audit's do-not-touch boundary; the boundary was about equations, numbers and goldens, and these
   four tokens are neither — the fix is a rename, not a physics edit.
7. **`docs/specs/architecture.md:831` — dangling cross-reference**: "…it is listed in the
   disagreements." No "disagreements" section exists in architecture.md or the design docs (grep:
   the only hit is this sentence). The badge/state-map task it refers to is real (design-system
   §10.13's five badges vs the eight states). Fix: record it as an open question (§Open questions)
   or point the sentence at the existing list.
8. **`docs/design/design-system.md:712-724` — `FormattedValue` contradicts the architecture's
   presentation boundary.** §12's own bullet (line ~688) says a `<Number>` takes a `PropertyView`
   and never a bare number; two paragraphs later the file defines `FormattedValue { value:
   number | null }` plus a five-value `Provenance` type — the nullable number architecture.md:722
   bans and the badge vocabulary architecture.md:823-831 says is insufficient (eight states have no
   badge). Fix: delete the `FormattedValue`/`Inference` type block (or mark it superseded by
   `PropertyView` and keep only the tolerance-null rule, which is a real rule worth keeping).

## 5. The web specifics, judged as engineering

- **SPA deep links on static hosting: answered.** `web/public/_redirects` carries
  `/* /index.html 200` with a Playwright case that loads a deep link *directly* and asserts the
  analysis screen renders (architecture.md:263-276); hashed assets immutable, `index.html` and the
  service worker never. The classic refresh-404 is designed against, and the test is named.
- **Service-worker update path: answered.** Detected, announced, never applied silently; the new
  worker waits, "A new version is ready" carries the only `skipWaiting()`, and the reason is stated
  (swapping a shell with hashed chunk names under a running tab blanks the screen mid-edit)
  (architecture.md:1055-1064). Draft safety is covered by the 500 ms autosave rule (line 244) plus
  E1.13's restore — a Reload tap never loses more than half a second. `no-cache` on
  `index.html`/`sw.js` is the right guard against the deleted-hash failure.
- **IndexedDB sizing and eviction: answered, and honest about what cannot be queried.** 200 models
  at the 100 KB budget is ~20 MB plus revisions — inside any modern quota, past localStorage by an
  order of magnitude, and the document says so with the numbers. The install exemption is *not*
  overstated as verifiable: `persist()`'s result is recorded but "the app does not treat `true` as
  proof" (architecture.md:371-372), the eviction exemption is carried by the install nudge, the
  export nag, E8.18(d)'s eviction-detection, and §11.2 step 5's eight-day device test. That is the
  correct posture for a claim the platform does not expose to `navigator.storage.persisted()`.
- **350 KB vs React: plausible, with the contingency named.** React 19 + React-DOM (~45 KB
  gzipped), React Router (~10-20 KB), Zustand (~1 KB), `idb` (~1 KB), visx modules (tens of KB,
  chosen *because* tree-shakable — the monolithic bundle is explicitly ruled out by the budget,
  architecture.md:610) leaves real headroom. If measurement says otherwise, the named lever is the
  chart library ("either the library is chosen to fit or the budget moves", report §5.2), and
  E8.11 makes the build fail rather than warn. Adequate; the measurement settles it, as D-21 says.
- **Browser determinism: answered.** Risk 8 (architecture.md:1163-1172) names V8/JSC/SpiderMonkey
  transcendental differences, ties them to E3.10's round-2 deletion, keeps per-fixture tolerances,
  and makes the correct hash argument: RFC 8785 pins formatting, not arithmetic, so hashes are
  engine-independent *provided nothing computed is ever written to a document* — and a test now
  hashes after a full solve-and-render cycle to prove exactly that.
- **Accessibility: specified in web terms.** Focus order and switch access (E8.16b), stepped
  alternatives to every drag (E8.16a), the SVG scene as `role="img"` with a spoken summary rather
  than 40 unlabelled circles (Risk 4), one accessible node per compound value with a fixed-order
  spoken sentence (design-system §11), `aria-expanded`/`hidden` agreeing with `display: none`, both
  text-scaling mechanisms tested (E8.7b). No native-control vocabulary remains.

## 6. Residue sweep (`flutter|dart|pubspec`, excluding `docs/reviews/`)

- **(a) legitimately historical:** `docs/research/` transcript hits ("throwing darts");
  decisions.md:11-13 (D-09's original text), :22-25 (D-10's original text), :142-143 and :151
  (D-19's own "retired" sentence and the gate replacement note), :179 (D-21's rationale);
  DECISIONS-R1.md (under its banner); spec.md:2830-2858 (§8.3 disposition rows quoting old text);
  spec.md:2636 (the annotated D8 note).
- **(b) comparative and useful:** AGENTS.md:26-27 (the positive no-Dart rule);
  architecture.md:113-115, :162, :182, :231, :235, :334, :344, :356, :489, :507, :666, :1003,
  :1010-1012, :1101, :1129, :1154 (each explains what the switch changed — the document's stated
  method); design-system.md:139, :289, :697; spec.md:32-40, :2493; flows.md:41, :755.
- **(c) stale, must be fixed:** decisions.md:108 ("generated Dart table", present tense, live
  reading); physics/00-overview.md:24, :158, :161 (`setup_physics`), :336 (`app/test/golden/`).
  Nothing else.

---

## Verdict

**Ready to implement with these 8 fixes** — every audit blocker is answered or deliberately
escalated to the owner, the AC ledger is mechanically sound, and what remains is one stale budget
number, one self-contradicting disposition row, two stale headers/titles, one unfixed audit line
(D-16), four dead package-name tokens in a physics doc, one dangling cross-reference, and one
duelling presentation type in the design system — none of which changes a decision, and all of
which a developer can fix from this file without asking a question. (The Safari-marker re-decision
stays with Dave; it should land before the R1 freeze, not after.)
