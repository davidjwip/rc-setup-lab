# Round 4 update report — Flutter → React/TypeScript PWA

Work order: `docs/reviews/round4/01-kimi-review.md` (Kimi's stack audit) plus rulings **D-19 … D-23**
in `docs/decisions.md`. This report records what changed, what was deliberately left alone, and what
still needs an owner decision.

The updating agent (deepseek-flash) exhausted its iteration budget before writing this file, so the
report was reconstructed from the diff by Hermes and the last five stack residues were fixed by hand
(§4). Nothing in this file is a claim about work that was not done.

---

## 1. Files changed

| File | Change |
|---|---|
| `docs/specs/architecture.md` | **Rewritten** (1,278 changed lines, now the web architecture): `web/` React+Vite app, `packages/physics` (pure TS, no DOM), `packages/data` (schema, migrations, the single unit conversion), Zustand, three-destination routing with browser history and the `?from=` contract, IndexedDB persistence with the Safari eviction answer, SVG suspension scene, Vitest + Testing Library + Playwright, `npm run gate`, static hosting with a service worker, and re-baselined risks |
| `docs/specs/spec.md` | 556 changed lines: 5 criteria marked `SUPERSEDED by D-19`, 25 moved to R2 to hold v1 at 49 MUSTs, 2 added (E8.17 installability, E8.18 storage durability), E9.11 folded into E8.1, E3.12 rewritten for D-21 budgets, D-19…D-23 recorded in §7.1 |
| `AGENTS.md` | Gates and layout: `npm run gate`, `web/`, `packages/physics`, `packages/data`; the "no Flutter/Dart" rule stated positively so a later agent does not re-introduce it |
| `README.md` | Stack statement and repository map |
| `docs/intent.md` | Constraints updated: React PWA, offline, static hosting |
| `docs/review-rules.md` | Rule 3 re-expressed for TypeScript (the no-DOM wall) instead of "physics has no UI" in Dart terms |
| `docs/design/design-system.md` | 299 changed lines: the Flutter implementation map replaced with CSS custom properties and web component specs; token tables, colour, type scale, badges and value states unchanged |
| `docs/design/flows.md` | Navigation and back behaviour re-stated for browser history; the `OutOfRange` result variant removed in favour of the three-member union plus flags/tier (spec §4.4.1/§4.11 is normative) |
| `docs/design/screens.md`, `wireframe-notes.md`, `DECISIONS-R1.md` | Stack-mechanism references updated; `DECISIONS-R1.md` carries a historical banner because its reasoning survives and its Flutter mechanism names do not |
| `docs/LICENSING.md` | Path fix for the model directory |
| `.gitignore` | Node/TS artefacts replace Flutter/Dart ones |
| `wireframes/index.html` | Stack note only; the wireframes themselves were already HTML and needed no change |

**Not touched, deliberately:** `docs/specs/physics/` (stack-neutral except the five lines fixed in §4),
`docs/specs/fields.yaml` (except one comment), `docs/procedures/`, `docs/research/`, and the visual
content of every wireframe.

## 2. Acceptance criteria

- **110 criteria** total, every one with a release marker.
- **v1 ships 49 MUSTs** — R0's 8 (Slice 0) plus R1's 41.
- **4 marked `SUPERSEDED by D-19`**, with the reason recorded in the superseded table: the store
  data-safety declaration (C-06), desktop/web builds (L-05), iOS (L-10) and the Play data-safety
  clause (E8.13c).
- **2 added**: installation to the home screen (E8.17 — the thing that exempts the library from
  Safari's seven-day eviction) and storage durability (E8.18).
- **1 promoted, not cut**: E8.11's byte budget was re-baselined for the web by D-21 and moved *up*
  into R1 as a first-load gate. Nothing was cut in round 4; the 25-criterion R2 cut was round 2's
  doing and still stands.

> **Correction (this report was wrong on first writing).** It claimed 5 superseded criteria and a
> fresh 25-criterion move to R2. Both were transcription errors: E8.11 was promoted rather than
> superseded, and no markers moved in round 4. Kimi's verdict caught the arithmetic and the stale
> R2 row that had inherited it; both are fixed in `spec.md` §8.3 as well.

## 3. Rulings implemented

| Ruling | Where it landed |
|---|---|
| D-19 React PWA | architecture §1–§4, §9–§12 and Risk 3 rewritten; AGENTS, README, intent, review rules, design map |
| D-20 persistence | architecture §5.3; spec E8.17/E8.18; design storage-state row and export nag |
| D-21 performance budgets | architecture performance section; spec E3.12 rewritten as provisional and marked for re-baselining |
| D-22 import semantics | architecture import/export; spec's file-association criterion marked as an accepted loss |
| D-23 drawing | architecture §7; spec's chart criteria; the "a painter that computes is a review failure" rule kept |

## 4. Stack residues fixed by hand after the agent stopped

The agent ran out of iterations immediately after a licensing path fix, leaving five stale lines it
had correctly refused to edit because they sit in physics files. Each is a stack mention, not physics:

- `docs/specs/physics/00-overview.md` — "No Dart has been written", "the Flutter developer implementing
  `app/packages/setup_physics`", "the pure-Dart physics package", and two `tool/spec_audit.dart`
  references → TypeScript wording, `packages/physics`, `npm run spec:audit`.
- `docs/specs/physics/99-validation.md` — `dart run tool/spec_audit.dart` → `npm run spec:audit`.
- `docs/specs/physics/08-tyre-interface.md` — a `dart` code block and `TyreModel?` → a TypeScript
  interface and `TyreModel | null`.
- `docs/specs/fields.yaml` — the comment naming `tool/gen_schema.dart` → `tool/gen_schema.ts`.

No physics equation, number, unit or golden case was altered.

## 5. Open for the owner

1. **Hosting target and URL.** Cloudflare Pages is assumed. The subdomain is not chosen, and the
   deploy trigger (push to `main` vs tagged release) is not decided.
2. **Chart library vs the D-21 budget.** A chart dependency competes with the 350 KB first-load
   budget; either the library is chosen to fit or the budget moves. To be settled by measurement, not
   by argument.
3. **Safari-relevant criteria in R1.** E8.17/E8.18 are R1 MUSTs; whether the remaining
   storage-related criteria also belong in v1 depends on how much of the audience is on iPhone.
4. **Sharing a setup link across devices.** A web app can hand someone a URL; a file cannot. Whether
   that becomes a feature (export a link with the setup embedded in the fragment) or stays out of
   scope is a product decision nobody has taken.
5. **`fields.yaml` generator.** `tool/gen_schema.ts` does not exist yet, so the tables are currently
   correct but not self-maintaining; E9.10's drift gate depends on it.
