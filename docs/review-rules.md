# Review rules — Setup Lab

Six rules, each naming the failure it prevents. A rule nobody can fail is decoration, so each
one names the check that enforces it.

1. **No number without a source.** Every constant, coefficient or hardpoint used in physics
   or shipped in a model carries a citation (published equation, measurement record, or
   Bob Wright's worked example) in a comment or the JSON `source` field.
   *Prevents:* confident, unverifiable maths — the failure mode that makes a teaching tool
   worse than no tool.
   *Check:* `flutter test test/traceability_test.dart` fails on any model entry with an empty `source`.

2. **No RC3 derivative material.** No decompiled code, no copied help text, no RC3 icon or
   name. *Prevents:* an IP problem and a broken promise to the family.
   *Check:* reviewer greps the diff for `rccrewchief`, `rc3`, `.sdf`, decompiler output.

3. **Physics has no UI.** `app/packages/setup_physics` must not import Flutter.
   *Prevents:* maths entangled with widgets, which cannot be tested or reused.
   *Check:* `flutter analyze` plus a test that asserts the package's pubspec has no Flutter
   dependency.

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
   once, in the UI layer.
   *Prevents:* the classic 1000× error (mm vs m) that makes a plausible-looking wrong number.
   *Check:* every public physics function has units in its doc comment; the UI converter has
   its own round-trip tests.
