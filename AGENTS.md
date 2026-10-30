# AGENTS.md — read this first

Setup Lab: a free Flutter app that calculates RC car setup physics. Clean-room successor to
RC Crew Chief (Bob Wright, d. 2023). Read `docs/intent.md` for *why*, `DEDICATION.md` for
*what we may and may not take*.

**The one rule that overrides everything:** no RC3 code, binaries, decompiled output, help
text, icons or names. If a task seems to need them, stop and say so.

## Layout

```
docs/intent.md      why
docs/specs/         spec.md, plan.md — spec-first, reviewed in rounds before code
docs/research/      corpus (forum, transcripts, handbook) — source material, never edited
docs/design/        design language, screen inventory, flows
wireframes/         HTML wireframes / prototypes (throwaway)
app/                Flutter app: lib/ (ui), packages/setup_physics (pure Dart, no Flutter)
app/test/           unit + golden tests
scripts/            research and tooling helpers
```

## Stage → skill routing

Say which skill you loaded. One canonical skill per stage.

| Stage | Load |
|---|---|
| Requirements / spec | `ai-native-sdlc` |
| Flutter feature work (TDD) | `test-driven-development` |
| Design / wireframes | `claude-design` or `sketch` |
| PR before hand-off | `github-code-review`, `pr-review-gate` |
| Retro / closeout | `retro` |

## Gates (exact commands, run them, paste the output)

```bash
cd app && dart run tool/gate.dart   # the one gate: analyse + test across all packages, schema checks
```

`gate.dart` is the published gate (Dave, 2026-10-30). It runs, per package, exactly
`dart analyze` and `dart test`, plus the schema/migration checks — so a green gate cannot skip a
package it does not know about. Individual commands remain valid for a local loop, but the gate
is what CI runs and what a PR reports.

Physics changes additionally require a **golden test**: a case whose expected value comes
from a cited source (published equation, Bob's worked example, a hand calculation in
`docs/specs/physics/`), never from the code's own output.

## Conventions

- One branch per change; never commit to `main`. Dave merges PRs — agents never merge.
- Commit format: `type(scope): imperative summary` (`feat(physics): add roll centre migration`).
- Units: SI inside `setup_physics` (metres, newtons, kilograms, radians). Display units are a
  UI concern only. Every public function documents its units in the doc comment.
- Model data is JSON with a `schema_version` and a `source` field naming where each
  measurement came from. No model ships without a source.
- Corrections that repeat go in this file, not in a chat message.

## Traps

- **Cloudflare** blocks the RC Tech forum for direct fetches; use the harvested corpus in
  `docs/research/` instead of re-fetching.
- **Dart `double` is not a CAD kernel.** Degenerate geometry (zero-length links, parallel
  instant centres) must return a documented sentinel, not `NaN` leaking into the UI.
- **Never invent numbers** to fill a model. Missing hardpoint = model is incomplete and the
  UI says so.
