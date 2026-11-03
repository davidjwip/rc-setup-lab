# AGENTS.md — read this first

Setup Lab: a free web app (React + TypeScript, installable as a PWA, fully offline) that
calculates RC car setup physics. Clean-room successor to RC Crew Chief (Bob Wright, d. 2023).
Read `docs/intent.md` for *why*, `DEDICATION.md` for *what we may and may not take*.

**The one rule that overrides everything:** no RC3 code, binaries, decompiled output, help
text, icons or names. If a task seems to need them, stop and say so.

## Layout

```
docs/intent.md      why
docs/specs/         spec.md, plan.md — spec-first, reviewed in rounds before code
docs/research/      corpus (forum, transcripts, handbook) — source material, never edited
docs/design/        design language, screen inventory, flows
wireframes/         HTML wireframes / prototypes (throwaway)
package.json        private workspace root: `workspaces: ["web", "packages/*"]`, one lockfile
web/                the app: src/ (routes, state, features, store, charts, scene), test/, e2e/
packages/physics/   pure TS, SI only — no DOM, no React, no JSON, no I/O
packages/data/      schema (generated), migrations, RFC 8785 hash, the one unit conversion
assets/models/      bundled chassis JSON (CC BY 4.0)
scripts/            research and tooling helpers
```

The stack is **D-19** in `docs/decisions.md`. There is no Dart package, no `flutter` command and
no `pubspec.yaml`; a file that appears to need one is a bug in the file.

## Stage → skill routing

Say which skill you loaded. One canonical skill per stage.

| Stage | Load |
|---|---|
| Requirements / spec | `ai-native-sdlc` |
| Web app feature work (TDD) | `test-driven-development` |
| Design / wireframes | `claude-design` or `sketch` |
| PR before hand-off | `github-code-review`, `pr-review-gate` |
| Retro / closeout | `retro` |

## Branches, review and release (agreed 2026-10-31)

Three tiers, one direction of flow:

```
feat/*  ──PR──►  uat  ──PR (Dave only)──►  main
                 │                        │
        rc-setup-uat.zt489.com   rc-setup.zt489.com
```

- **`main` is protected.** Production. Every change arrives by pull request, and **only Dave merges
  `uat` → `main`**, after he has looked at UAT. Agents never merge into `main` and never push to it.
- **`uat` is the integration branch.** Agents *may* open pull requests into it and merge them once
  `npm run gate` is green. Every push deploys `rc-setup-uat.zt489.com`.
- **`feat/*`, `fix/*`, `chore/*` are bite-size.** One concern per branch, one PR, deleted after merge.
  Every branch gets its own Cloudflare Pages preview URL on the pull request.
- Never `git push --force` a shared branch, never rewrite `uat`'s history, and never leave a branch
  merged locally but not pushed — UAT deploys from the remote.

## Hosting (Cloudflare Pages)

| Branch | Pages project | Hostname |
|---|---|---|
| `main` | `rc-setup-lab` | `rc-setup.zt489.com` |
| `uat` | `rc-setup-lab-uat` | `rc-setup-uat.zt489.com` |
| any other | preview deployment | shown on the pull request |

Build: `npm run build` at the **repository root**, output `dist/`. Static hosting only — no server,
no functions, no environment secrets. The deploy is automatic on push; nothing is uploaded by hand.

## Gates (exact commands, run them, paste the output)

```bash
npm ci            # once; one lockfile at the root, workspaces included
npm run gate      # the one gate: typecheck + tests across all workspaces, schema/field drift
```

`npm run gate` is the published gate (Dave; D-09's contract, D-19's tool). It runs, per workspace,
exactly `tsc --noEmit` and `vitest run`, plus the schema/migration checks and the probe of the
service worker's precache manifest — so a green gate cannot skip a workspace it does not know
about. Individual commands remain valid for a local loop (`npm test -w packages/physics`), but the
gate is what CI runs and what a PR reports. The browser-dependent checks — component, one
end-to-end path, frame timing — run in their own CI jobs and are required for a merge; they are
deliberately not gate stages, because a gate that needs a browser download is not the command you
run before pushing. The stage list is fixed by E9.8 and mirrored in `docs/specs/architecture.md` §10.

Physics changes additionally require a **golden test**: a case whose expected value comes
from a cited source (published equation, Bob's worked example, a hand calculation in
`docs/specs/physics/`), never from the code's own output. Numeric fixtures are edited by hand;
`vitest -u` is never run on them.

## Conventions

- One branch per change; never commit to `main`. Dave merges PRs — agents never merge.
- Commit format: `type(scope): imperative summary` (`feat(physics): add roll centre migration`).
- Units: SI inside `packages/physics` (metres, newtons, kilograms, radians). Display units are a
  UI concern only, converted at exactly one site in `packages/data/src/adapter/units.ts`. Every
  public function documents its units in the doc comment.
- Model data is JSON with a `schema_version` and a `source` field naming where each
  measurement came from. No model ships without a source.
- State lives in `web/src/state/`, and only that directory imports the store library. A component
  never formats a number — `web/src/format/` is the only place a number becomes a string.
- A renderer never computes physics: the SVG scene and the charts draw objects the physics
  package returned (D-23).
- Corrections that repeat go in this file, not in a chat message.

## Traps

- **Cloudflare** blocks the RC Tech forum for direct fetches; use the harvested corpus in
  `docs/research/` instead of re-fetching.
- **A JavaScript `number` is not a CAD kernel.** It is IEEE-754 binary64, so precision is fine —
  conditioning is not: nearly parallel links put the instant centre tens of metres away, and a
  0.1° change in a link angle moves it across the room. Degenerate geometry (zero-length links,
  parallel instant centres) must return a documented sentinel, never `NaN` leaking into the UI.
- **Never invent numbers** to fill a model. Missing hardpoint = model is incomplete and the
  UI says so.
- **Never add a network call.** The app must complete every path with the network disabled; an
  off-origin `fetch`, font or script fails the gate's `offline` stage.
- **`index.html` and `sw.js` are never cached immutably.** A stale shell pointing at a deleted
  hash is the one deploy failure that shows up only on someone else's phone.
- **Storage is rented.** Documents live in IndexedDB and the browser may evict them; export is
  the user's real backup (D-20, D-22).
