# Review rules — Setup Lab

Six rules, each naming the failure it prevents. A rule nobody can fail is decoration, so each
one names the check that enforces it.

1. **No number without a source.** Every constant, coefficient or hardpoint used in physics
   or shipped in a model carries a citation (published equation, measurement record, or
   Bob Wright's worked example) in a comment or the JSON `source` field.
   *Prevents:* confident, unverifiable maths — the failure mode that makes a teaching tool
   worse than no tool.
   *Check:* `npm run gate` fails on any model entry with an empty `source` (the traceability test runs
   in the `test` stage).

2. **No RC3 derivative material.** No decompiled code, no copied help text, no RC3 icon or
   name. *Prevents:* an IP problem and a broken promise to the family.
   *Check:* reviewer greps the diff for `rccrewchief`, `rc3`, `.sdf`, decompiler output.

3. **Physics has no UI.** `packages/physics` must not import React and must not touch the DOM.
   *Prevents:* maths entangled with components, which cannot be tested or reused.
   *Check:* the package's `tsconfig.json` omits the `DOM` lib, so `document`, `window`, `fetch` and
   `navigator` are type errors in the `typecheck` stage; a test additionally asserts its
   `package.json` declares no UI dependency and greps its source for React imports.

4. **Degenerate geometry is handled, not crashed.** Parallel instant centres, zero-length
   links, coincident hardpoints return a documented result (infinity/undefined flag) and the
   UI says "undefined for this geometry".
   *Prevents:* `NaN` propagating into a chart and looking like a number.
   *Check:* property tests over random geometries assert no `NaN` escapes a public API.

5. **A physics change ships with its golden test.** The expected value comes from outside the
   codebase, and the PR body says where it came from.
   *Prevents:* tests that assert today's output as "correct".
   *Check:* PR template + reviewer; `plan.md` lists the golden cases per module.

6. **Units are explicit at every boundary.** SI in the physics package; conversion happens
   once, in `packages/data`'s adapter, and formatting once, in `web/src/format/`.
   *Prevents:* the classic 1000× error (mm vs m) that makes a plausible-looking wrong number.
   *Check:* every public physics function has units in its doc comment; the UI converter has
   its own round-trip tests.
