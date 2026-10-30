# Setup Lab

**Setup physics for RC cars — calculated, drawn, explained.**

Setup Lab is a free, cross-platform (Flutter) workbench for RC car setup: suspension
geometry, roll centres, camber gain, wheel rates, load transfer and damping — the numbers
behind "why does the car do that", with the maths visible instead of hidden.

It is a **clean-room successor** to **RC Crew Chief (RC3)**, the app Bob Wright built and
supported for over a decade. Bob died in 2023. His app is free but was never open source,
his site is gone, and the community keeps it alive by re-uploading a binary that needs a
dead Microsoft database engine to run.

We are not porting his code. We are rebuilding the thing it taught — from his published
teaching, public physics, and our own work — and giving it away.

> **In memory of Bob Wright.** See [DEDICATION.md](DEDICATION.md).

## Status

Pre-spec. This repository currently holds the research corpus, the intent, and the
requirements/design work in progress. Nothing is shippable yet.

| Stage | Artifact | State |
|---|---|---|
| Research corpus | `docs/research/` | harvesting |
| Intent | `docs/intent.md` | draft |
| Spec | `docs/specs/spec.md` | not started |
| Design system + wireframes | `docs/design/`, `wireframes/` | not started |
| Plan | `docs/specs/plan.md` | not started |
| Flutter app | `app/` | not started |

## Principles

1. **Free forever, no account, works offline.** A phone at the track is the target device.
2. **Show the maths.** Every number can be expanded into the equation and the inputs that
   produced it. This is a teaching tool that happens to calculate.
3. **Models are data, not code.** Car/chassis/motor models are versioned JSON, so the
   community can add the chassis that matter to them and nothing is lost when a site dies.
4. **Kind to the original.** No decompiled code, no lifted help text, no passing off. Bob's
   teaching is cited, his family is credited, his name is honoured.

## Repository map

```
docs/intent.md        why this exists
docs/specs/           spec.md, plan.md (spec-first, reviewed in rounds)
docs/research/        corpus: forum thread, transcripts, handbook (read-only source material)
docs/design/          design language, screen inventory, flows
wireframes/           HTML wireframes / visual prototypes
app/                  Flutter application (analyze + test are the gates)
scripts/              research + tooling helpers
AGENTS.md             the brief a coding agent must read first
```

## Contributing

Issues and model contributions are welcome once the spec lands. Chassis models will be
accepted as JSON pull requests with a source for every hardpoint measurement.

## Licence

Code: MIT. Documentation and model data: see [docs/LICENSING.md](docs/LICENSING.md).
"RC Crew Chief" and "RC3" are the work of Bob Wright and his estate; this project is not
affiliated with or endorsed by the estate unless and until the family says otherwise in
writing — credit and dedication are unconditional.
