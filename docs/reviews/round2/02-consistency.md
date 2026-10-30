# Round 2 — consistency verification

**Scope.** The current files on disk, read after all four revision agents finished:
`docs/specs/spec.md` (2,547 lines, 108 ACs), `docs/specs/architecture.md` (918),
`docs/specs/physics/00–10` + `99-validation.md`, `docs/design/*` (6 files), `docs/decisions.md`,
`wireframes/*.html`. No document was edited by this review.

**Method.** Every numeric claim below was read out of the file, not remembered. Structural checks
were run mechanically (AC extraction, tag/release diff against §8.2, AC-id reference scan across all
documents). Two arithmetic claims were re-derived in Python from the reference car in `01` §8.2:
the roll-centre sensitivity (matches the revised table to four decimals) and the ride-frequency
consequence of the `ASSUME(0)` unsprung-mass policy. Line numbers are from the files as they stood
at this review.

**Headline.** Of the round-1 blockers, **24 of 31 are closed in the current text** — a real
improvement over round 1, and several are closed *well* (B1, B2, B4, B5, B6, D3, D4, D6). Seven are
not, and five of those seven are the same failure as round 1 in a new place: one fact stated in two
documents that were revised in parallel to different vocabularies. The worst is that the project now
has **two normative on-disk schemas** (`spec.md` §4.2 and `physics/01` §5), which is the single
finding that would cost the most to discover during implementation.

---

## A. Frame and units (check 1)

### A.1 The normative statement is now correct everywhere that matters

| Document | Statement | Verdict |
|---|---|---|
| `spec.md` §4.2 (1217) | "Right-handed, **x forward, y to the LEFT, z up**. Origin on the ground plane … at the intersection of the rear axle centreline and the vehicle centreline." | correct |
| `spec.md` header (7) | "**Normative frame and units:** ISO 8855, millimetres, grams, degrees — §4.1, §4.2" | correct |
| `architecture.md` §5.1 (313) | "**x forward, y left, z up; origin on the ground plane (flat plate) at the rear axle centre, on the vehicle centreline.**" | correct |
| `physics/01` §2 (24) | "**ISO 8855 vehicle axes**, right-handed … **Origin**: … **at the rear axle line**." | correct |
| `physics/00` §7 (260) | "Frame \| ISO 8855, y left, origin at the rear axle centre on the ground plane (R-1)" | correct |

Units are unanimous on disk (mm, g, deg) with one adapter boundary: `spec.md` §4.1 rule 1 (1131),
`architecture.md` §5.2 rules 1–2 (344), `physics/00` §2 and §9's diagram (93, 299). The
`|c| > 3000 mm` guard is stated identically in `spec.md` §4.1 rule 1, `spec.md` §4.5.4, `architecture.md`
§5.2 rule 7, `physics/01` §5 and §7. **R-2 is properly closed.**

### A.2 Three documents still describe the requirements as y-right

These sentences are now false, and each tells a reader the opposite of what the file they are
pointing at says:

- `physics/01` §2 (line 56): "`docs/specs/spec.md` §4.2 **is being brought into line** by the
  requirements revision (R2-B). **Until that lands, this section wins** for anything the physics
  package computes…"
- `physics/00` §0 row 1 (line 19): "…with the note that `spec.md` §4.2's **y-right/mid-wheelbase
  frame is superseded** (the `spec.md` edit is R2-B's)."
- `architecture.md` §5.1 (335): "*Why this frame and not the requirements'* (**y right,
  mid-wheelbase origin**)…"

The spec landed. A developer reading `architecture.md` §5.1 is told the requirements use the other
frame and may go looking for a sign table that does not exist. `physics/01` §4.4 (181) has the same
stale tense: "the `spec.md` edit travels in R2-B."

### A.3 The measurement screen still uses a different datum

`wireframes/hardpoints.html` — the screen that tells the user how to enter every hardpoint — states
the frame in the X field's accessible label, in the hint beneath it, in the footnote and in the
footer meta:

> line 457 (X field's `aria-label`): "X, **forward from front axle**, millimetres"
> line 461: "Measure to **pin centre**. **X runs forward from the front axle**, Y out from the
> centreline, Z up from the floor."
> line 500: "**X** forward from the front axle, **Y** outboard from the centreline, **Z** up from
> the ground. Values are stored in millimetres and **converted to SI inside the physics engine**."
> line 591: "Datum rule: **X is measured from the front axle centreline of that end.**"

R-1 puts the origin at the **rear** axle, so on the reference car the front lower-arm pivots are at
x = 238 and 272 mm; the frame shows 12.5 for `lca_out`, whose reference value is 259. A user
following this screen enters numbers a whole wheelbase away from the model, and the 3000 mm guard
will not catch it. The
same footnote also contradicts the single conversion boundary — `architecture.md` §5.2 rule 1 says
the adapter in `setup_data` converts and the solver "takes SI and returns SI", while the wireframe
says conversion happens "inside the physics engine".

### A.4 The two JSON examples do not agree field-for-field

`spec.md` §4.2 (1232) and `physics/01` §5 (301) are both labelled as the on-disk file and they share
almost nothing:

| | `spec.md` §4.2 | `physics/01` §5 |
|---|---|---|
| `schema_version` | `"1.0.0"` | `"1.1.0"` |
| Top-level shape | `body.axles.front.corners.left.lower_arm.inboard_front` | `corners.LF.points.lca_in_a` |
| Numeric values | `{ "v": 46.0, "s": "s1" }` (rule 2) | bare numbers, no source per value |
| Mass | `body.mass.total` 1352 g, per-axle unsprung | `vehicle.mass_total` 1350 g, `mass_unsprung` 240 g |
| CG | `body.cg.height` 38.0 | `vehicle.cg.{x,y,z}` 141.35/0/28.0 |
| Wheelbase | stored, 257.0 | absent; derived in §6 from `wc_front` and `wc_rear` |
| ARB | `arb.rate_at_full_stiff` (blade) | `arb.{bar_diameter, span, arm_length, shear_modulus, rate_at_link}` (torsion bar) |
| Damper | six `damper_*` fields on the corner | `damper.{piston_bore, shaft_dia, piston_holes, piston_hole_dia, oil_cst, oil_temp, f_blowoff, c_post}` |
| Licence / contributors / attribution | present (§4.9) | absent |
| `kind`, `id`, `symmetry`, `sources` map | present | absent (`sources` is per-point prose) |
| Reference car | 1352 g, 163 mm track, 31 mm tyre | 1350 g, 172 mm track, 32 mm tyre |

Units are the one thing that agrees (mm, g, deg), and so does the guard (3000 mm). Two further
defects in `01` §5's example specifically:

- its `units` block declares four dimensions (`length, mass, angle, spring_rate`) but the file also
  carries `f_blowoff` in N and `c_post` in N·s/m, which **violates `spec.md` §4.1 rule 1** ("One
  entry per dimension used; a missing dimension refuses the document");
- it declares `schema_version` `1.1.0` while `spec.md` §4.2 declares `1.0.0`, and `spec.md` §4.7
  requires "one fixture per `schema_version` the app can write". Two versions of the same document
  kind are in circulation with no migration between them.

`spec.md`'s §4 preamble (1125) claims the opposite of what is on disk:

> "**§4.2 is the single normative definition of the on-disk schema.** No other document defines field
> names, units or the frame; `docs/specs/physics/01` §4 defers to this section and keeps only derived
> quantities and validation rules."

`physics/01` §5 is titled "Schema on disk (ruling R-2 — mm, g, deg)", defines field names and units,
and its §2 declares itself normative for the frame ("this section wins"). §4.4 defers to the spec;
§5 does not.

---

## B. Result and state vocabulary (check 2)

### B.1 The eight states agree between the two documents that own them

`spec.md` §4.4.1 (1632) lists eight states with a precedence order; `architecture.md` §8 (504)
reproduces **the same eight names in the same order**, attributes them to §4.4.1, and agrees they are
computed in `setup_data` from `on_absence`, `plausible` and the result envelope. That part is
consistent and well done.

### B.2 The result type is stated with two different arities

`physics/00` §4 (168):

```text
Solved<T> = Defined(value, conditioning, flags) | Undefined(reason, inputs)
```

`architecture.md` §7 (422) says "**Three transport states**" and defines
`Defined(value, tier, band, basis, provenance, flags)`, `NotMeasured(missing)`, `Undefined(reason,
inputs)`. So:

- **count**: 2 cases in the specification, 3 in the consumer — and `NotMeasured` appears nowhere in
  `physics/00`, `01`–`10` or `99` (grep: three hits, all in `architecture.md`);
- **payload**: no `tier`, `band`, `basis` or `provenance` on `00`'s `Defined`, although
  `architecture.md` §7 requires all four and §8 asserts "every envelope with tier `inferred` carries
  both a band and a procedure";
- a missing field is a **reason** in `00` (`incompleteModel`) and a **case** in `architecture`
  (`NotMeasured`), so the same condition has two representations.

`physics/00` §9's data-flow diagram (299) also stops at "value + units + conditioning", with no band
and no tier — the two things §4.8 and E3.16 make mandatory on every surface.

### B.3 Input provenance has two closed sets that do not line up

`physics/00` §5 (219) defines six `confidence` values: `measured`, `manufacturer`, `derived`,
`estimated`, `assumed`, `library`. `spec.md` §4.1 rule 4 (1160) defines eight source `type`s:
`measured`, `estimated`, `manufacturer`, `third_party`, `library`, `derived`, `inferred`,
`unattributed` (plus `unknown` as a user state). The adapter is supposed to map one to the other and
no document says how: `third_party`, `inferred` and `unattributed` have no physics counterpart, and
`assumed` has no schema counterpart. Round 1's P-20 flagged a four-value enum; it is now six values
that still do not match the eight.

### B.4 The five badges map source *types*, not *states*

`docs/design/screens.md` §0.4 (77) has a complete, careful table "Spec source `type` → badge". That
closes the label/round-trip half of the problem and is genuinely good. But the question the
revision was supposed to answer — how do the **eight §4.4.1 states** render as five badges — is not
answered anywhere. Grepping `docs/design/*.md` for `OUT_OF_DOMAIN`, `COMPUTED_INCOMPLETE`,
"outside the range" and "does not include" returns **zero hits**.

Status of the four states the brief asks about:

| State | Badge path | Verdict |
|---|---|---|
| `INFERRED` | `estimated` + mandatory route chip, band, "all else equal" | covered (`screens.md` §0.4, row `inferred`) |
| `ESTIMATED_INPUTS` | `estimated` badge + count in the provenance chip | covered by provenance, but the **count** payload ("2 estimated") exists only in `screens.md` §14's header, not as a state mapping |
| `OUT_OF_DOMAIN` | none | **no badge, no ring, no chip, no copy.** E3.9 (R2) requires "the flag 'outside the range this model is valid for' and the bound that was exceeded"; no design file contains that string |
| `COMPUTED_INCOMPLETE` | none | **no badge.** A number computed with an `OMIT` field renders as a solid `computed` numeral, i.e. the most confident badge available |

`architecture.md` §8 is honest about this and names it a design debt: "the **chip renders the state**
(eight values) … The badge component therefore needs a state map, not five more hand-drawn variants;
that is a design task with an architectural constraint attached". `DECISIONS-R1.md` item 2 (143) says
the same and adds "no requirement references it, so nothing stops a developer inventing a sixth
badge" — still true.

### B.5 The evidence axis has three different arities

- `spec.md` E3.16 (566): "one of `validated` or `not_yet_validated`" — **two**.
- `architecture.md` §8 (508): "**Evidence** — how far it has been checked \| `validated`,
  `not_yet_validated`" — **two**.
- `docs/design/screens.md` §0.2.1 (53): `unvalidated`, `validated`, **`not_validatable`** —
  **three**, and `not_validatable` is assigned to ζ specifically.
- `physics/99` §1 (9): four levels L0–L3 and the instruction "**The UI must show which**" — **four**.

`DECISIONS-R1.md` item 3 predicted exactly this and it is still open. The design's third state is
the physically correct one (ζ has nothing to validate against); the requirements do not name it, so
a literal implementation marks ζ `not_yet_validated`, which promises a validation that will never
arrive.

### B.6 Two reason codes and one flag are outside the closed vocabulary

`physics/00` §4 says of reasons: "Every reason string that appears in any module must be a member of
this table; a spec-audit check enforces it." The scan over all physics files finds:

- `Undefined(zeroSpeed)` — `07` G07.8 and §5, **not in the table**;
- `Undefined(noTimingData)` — `09`, **not in the table**;
- flag `estimatedDamper` — used in `07` §0 and `01` §4.4, **not in the flag list** (`00` §4 lists
  `symmetricDamper`, `temperatureInsensitive`, `noDamping`… but no `estimatedDamper`; `noBar`,
  `assumedOil`, `assumedTemp`, `assumedMaterial`, `cgInferred` used in `01` §4.4 are likewise absent).

The audit check as specified would fail on the documents themselves.

---

## C. Validation policy (check 3)

**D-11** (`decisions.md` 17): "v1 ships with an honest validity chip, **not** with bench validation.
… Bench validation (L2 …) proceeds in parallel and upgrades the chip per property, property by
property."

**`physics/99` §8 still makes bench runs a precondition of release:**

> "## 8. Release gate
> A release may ship when:
> 1. Every golden test in modules 1–10 passes …
> 2. The identity checks I1–I14 pass …
> **3. V1, V2, V7, V8 and V10 have been run once on at least one real car, recorded in §9 with the
> date, the car, and the measured-vs-computed table.**
> 4. Every number still unvalidated at L2 carries its caveat string and its band …"

and §2 (31) reinforces it: "Priorities: **P1** blocks a release …", with V1, V2, V7, V8 and V10 all
marked P1 in the matrix. §9's results log is empty ("Empty, deliberately"), so by 99's own gate v1
cannot ship, and by D-11 it must. **Item 3 is not closed.** Nothing in `spec.md` resolves it either
way: E9.3's checklist (§3.5) has no bench-validation item, and the ACs contain no validation gate —
so the requirements and 99 disagree, and D-11 loses to 99 only because 99 is the file a physicist
reads last.

---

## D. Damping (check 4)

| Requirement | `decisions.md` D-13 | `physics/07` | `spec.md` | Design | Agree? |
|---|---|---|---|---|---|
| (a) estimate, not measured | "ζ is computed with a stated band and an `estimated`/`inferred` badge" | §0 "an **estimate with a band**"; §8 "Do not show a single ζ with no band" | §4.8 "an estimate … never presents it as one"; E3.6(c) "never marked `validated`" | "`~0.42 ±0.06` with the `estimated` badge and the `not_validatable` ring" | **yes**, except `07` §2.3 (90): "A user with a dyno pull enters the two values and **the badge changes from `estimated` to `measured`**" — which contradicts "never presented as measured" |
| (b) two shaft speeds | not named | **50 and 200 mm/s** (G07.3, G07.4, §9 reference corner) | §4.3.1 (1545): "the app's **two stated defaults**" — never stated; §4.8 "the two stated shaft speeds" — never stated | **5 and 300 mm/s** (`screens.md` 494, `design-system.md` 529, `analysis.html` 613–616) | **no** — three answers |
| (c) band only above 20 mm/s | "**no band at all below 20 mm/s**" | §8 (364): "**Do not** show ζ below 20 mm/s **without the `belowFrictionFloor` flag**"; G07.14: "the band is **≥ ±50 %**" | silent; §4.8 says the band is computed and "A fixed '±30%' label is not acceptable" | prints `~0.42 ±0.06` at the **5 mm/s** setting | **no** — D-13/99 §7 say no band, `07` says a ≥±50 % band, the design prints one |
| (d) trend leads | "the **direction** … is the product" | §9 "the direction table (the headline deliverable)" | E3.6(e), §4.8 "direction and sign … promoted above the absolute values" | card leads with `▲ Rear oil 350 → 400 cSt` | **yes** |

Mismatches to fix, named:

1. **The two speeds.** 50/200 in physics, 5/300 in design, unnamed in the requirements. The design's
   low speed (5 mm/s) sits in the one band the physics says is not modelled at all ("At 5 mm/s the
   modelled force is 0.0132 N; the stiction in the same damper is 0.5–2 N — 38× to 150× larger",
   `07` §8).
2. **The sub-20 mm/s band.** `07` G07.14 asserts a ≥±50 % band there; D-13 and `99` §7 assert no
   band at all. Both cannot be the test.
3. **`07` §2.3's "badge changes to measured"** vs D-13/E3.6's "never presented as measured, never
   validated".
4. **`07` §9's amendment note is now stale.** It says "D-13 lists 'a stiffer spring raises ζ' … this
   line is flagged for Dave as an amendment to D-13"; `00` §0 (53) repeats the claim. `decisions.md`
   D-13 has since been corrected in place and no longer contains that clause — the note and the
   bullet now describe a correction that has already landed, and D-13's list does not name spring
   rate at all (so "the corrected direction is in the table above" points at a row that is not
   there).
5. **Where the band comes from.** `07` §2.3: "That assumption [F_bo and c_post at 4.0 N / 12 N·s/m]
   **is** the ±30 % band." `spec.md` §4.8: the band is computed by re-running with each `estimated`
   input at its tolerance ends, and "a fixed ±30 % label is not acceptable". `c_post` has no field
   in §4.3.1, so it can never be in the computed band.

---

## E. Navigation (check 5)

- **Architecture** (`§3`, 125): "Pick: `go_router` 18.x, `StatefulShellRoute.indexedStack`,
  **three branches — Garage, Compare, Learn (D-01)** … a **Setup** destination has no subject until
  a car is chosen … Setup is a push from the car, not a place." Correct and explicit.
- **Design**: `flows.md` §2 (33) "Three-destination bottom navigation"; `design-system.md` (335) "There
  is no Setup destination"; `DECISIONS-R1` D-01 applied.
- **Wireframes**: every frame that draws a bar draws exactly three items —
  `garage.html` 416: `<a …>Garage</a> <a …>Compare</a> <a …>Learn</a>`, identical in
  `analysis.html`, `compare.html`, `learn.html`, `hardpoints.html`. **No wireframe has a fourth tab.**
  `setup-editor.html`, `sheets.html`, `sheet-diff.html` and `export-sheet.html` draw no bar at all,
  which is the push treatment.
- **Requirements: silent.** `spec.md` contains no occurrence of the words "destination",
  "navigation", "shell", "tab" or "tabs" (word-boundary grep: zero hits). The only mention of Garage
  in 2,547 lines is the
  vocabulary row at line 101. **There is no AC for the tab structure**, so nothing in the test suite
  fails if a developer ships four tabs — the decision exists only in design and architecture.

Two smaller inconsistencies inside the design layer:

- `design-system.md` (335) says detail screens under a push — naming **hardpoints** — "drop the
  navigation bar"; `wireframes/hardpoints.html` draws one, as does `analysis.html`.
- `architecture.md` §3's route table omits six routes the design defines: `/car/:carId/chassis`,
  `/car/:carId/mass`, `/car/:carId/sheets`, `/car/:carId/sheets/diff`, `/car/:carId/setup/:setupId/export`,
  `/car/:carId/setups/new`. A router written from the architecture's table cannot reach the chassis
  card or the sheet library.

---

## F. Naming: "sheet" vs "setup" (check 6)

**No normative mapping exists.** `spec.md` §1.4 (91) is the vocabulary bridge and it maps
`setup → "Setup values"` only; it contains no row for *sheet*. What the two layers do:

- `spec.md` uses **setup** for the saved object and **"setup sheet"** for the exported artifact
  (§4.3, E7.4 "exports a setup sheet");
- `docs/design/*` uses **sheet** for the saved object: `screens.md` §12 (419) "Create a sheet fast",
  "**There is no template default.** A new **sheet** starts **empty**"; §27 route
  `/car/:carId/sheets` "Setup-sheet library"; §28 "Sheet diff + interpreter"; `setup-editor.html`
  "New sheet (empty)".

So the same word denotes different objects in the two layers: reading the design, "sheet" is what
the spec calls a "setup"; reading the spec, "setup sheet" is a PDF/JSON export. `DECISIONS-R1.md`
item 4 (180) states it exactly and is still open: "one of them should be renamed before
implementation, **or the mapping written down in the spec**."

---

## G. Counts and cross-references (check 7)

**108 ACs, tags match row-for-row.** Extracted all AC headings from §3 (`**E<n>.<n>[a-d]** —`) and
all rows from §8.2, then compared `(tag, release)` per id:

- 108 ACs in §3, 108 rows in §8.2, **zero** ids in one and not the other, **zero** duplicate ids;
- **zero** tag/release mismatches;
- §3 totals: 84 MUST (8 R0 + 38 R1 + 38 R2), 17 SHOULD (2 R1 + 15 R2), 7 LATER (all R2) — which
  matches §8.2's summary table exactly ("R0 8 / R1 40 / R2 60 / All 108"), and the prose "v1
  therefore ships **46 MUSTs**: 8 … and 38".

This check is clean. It is the strongest part of the revision.

**Dangling cross-references** (excluding `§8.3`, where citing a removed id is the point):

| Reference | Where | Problem |
|---|---|---|
| `E7.1` | `architecture.md` 293 | split into E7.1a/E7.1b; the id no longer exists |
| `E3.6a`/`b`/`c` | design (5 places) | not id-form: E3.6 is one AC with clauses (a)–(f). Readable, but `@SpecTest('E3.6a')` would fail E9.9 |
| `spec.md §4.1.4` | `screens.md` §0.4 | no §4.1.4 exists; §4.1 is a numbered rule list |
| "§4.7's licence rules" | `spec.md` 2219 (D4 status) | licence is §4.9; §4.7 is validation/versioning |
| `docs/release/checklist.md` | E8.13(c) | E9.3 requires `docs/release/checklist-<version>.md` |
| `E8.13c` | `architecture.md` 784 | valid clause reference, but the architecture elsewhere writes clauses as "E8.13 clause (c)" |

**Normative files referenced but absent from disk**: `docs/specs/fields.yaml` (§4.2.1, §4.10, E9.10 —
the source of both field tables and of the schema gate), `docs/specs/procedures/` (§4.1, all
`ESTIMATE` procedures), `docs/specs/worksheet_order.txt` (E1.5), `docs/specs/eval/protocol.md`
(E9.5), `docs/specs/limits.md` (E5.5 requires the block's text to equal it), `docs/release/` (E9.3,
E8.13b–c), `docs/specs/interpreter.md` (flagged missing in
`DECISIONS-R1` item 5). `docs/specs/plan.md` is correctly absent (it is the next artifact).
`fields.yaml` is the load-bearing one: without it the field tables cannot be regenerated, E9.10
cannot run, and the two schema divergences in §A.4 have no mechanical check.

**Internal contradictions found while checking:**

- `spec.md` §4.3.3 (1595) says the torsion-bar fields "do not exist in the v1 schema", while §4.2.1
  (1402) lists `arb.arm_length` as "yes if `type` = `torsion_bar`".
- `spec.md` §7.2 D4 (2219) cites "§4.7's licence rules"; §4.7 has none.
- `wireframe-notes.md` (3) says "**Nine** self-contained HTML files in `wireframes/`"; there are
  eleven, and `index.html` lists nine.
- `spec.md` §8.3 (2434) says E9.5 "moved to R2" — consistent with §3 — but `§3.5` C-05 still calls it
  "the three-user usability session" while E9.5 now specifies **five** participants.

---

## H. The blockers, one by one

The four raw reports label **31** individual blockers (`01` B1–B7, `03` B1–B9, `04` B1–B10, `02`
P-01–P-05). `CONSOLIDATED.md` de-duplicates them to **26** numbered findings (A1–A4, B1–B7, C1–C3,
D1–D9, E1–E3) plus the unnumbered practicability section F, which names five distinct inputs. The
table below covers all 31 (26 numbered + F1–F5), which is every distinct claim in the file. Note:
`CONSOLIDATED.md` line 4 and `physics/00` §0 line 15 both say "**36** blockers", a number that
reconciles with neither 31 nor 26 — stale arithmetic in the document that governs the revision.

Status legend: **closed** = the defect is gone from the current text; **partial** = the mechanism
exists but a contradiction remains; **open** = still a defect.

| # | Blocker (round 1) | Status | Evidence in the current text | What is still missing |
|---|---|---|---|---|
| A1 | Frame differs between documents (y-right/mid-wheelbase vs ISO 8855) | **partial** | Fixed in all four normative docs: `spec.md` §4.2 (1217), `architecture.md` §5.1 (313), `physics/01` §2 (24), `00` §7. …but `hardpoints.html` 457, 461, 500, 591 still says "X runs forward from the front axle", and three docs still *describe* the spec as y-right (`01` 56, `00` 19, `arch` 335) | Fix the wireframe datum; delete the three "until that lands" sentences |
| A2 | Storage units differ three ways; `01` labels itself SI while storing degrees | **closed** | `01` §5 (301) is now `"units": {"length": "mm", "mass": "g", "angle": "deg"}` and the note at 358 says "**Angles are degrees on disk** … round 1's file labelled `"units": "SI"` while storing degrees". Guard 3000 mm in `01` §5, §6, §7; `spec.md` §4.1 rule 1; `arch` §5.2 | — (but see §A.4: the example's `units` block is incomplete for the units it uses) |
| A3 | Camber sign stated three incompatible ways | **open** | Camber itself is fixed: `01` §3.1 (85) applies the side sign `s`, `02` (2.12) carries it, G01.9 asserts γ = −8.0000° on both corners. **But the mirror rule for toe is now stated two opposite ways:** `01` §6.1 (413) "toe τ \| **unchanged** \| symmetric: 'toward the centreline' is mirrored too" vs `spec.md` §4.2 (1228) "Per-wheel quantities are per-wheel signed **and are negated on mirroring**: camber … toe …" (repeated in §2.4 line 198 and §7.1 R-1 line 2128) and `architecture.md` §5.1 (325) "Camber and toe are per-wheel signed … **Both are negated** when a corner is mirrored" | One sentence in three files. A mirrored car gains 1.0° of total toe under the spec's rule and none under the physics rule; G01.1/G01.8 assert the physics answer |
| A4 | 10⁻³ claims false for (5.7), (6.3), (6.7)–(6.9), (9.12) | **closed** | `00` §0 row 4 lists the fixed equations; (6.3) now reads "`TLLT [N] = m·a_y·h / t̄` **with h in metres**, t̄ the MEAN contact-patch track"; (6.7)/(6.8) carry `[N·m/rad]·φ[rad]/t[m]`; (5.2) works in mm/rad with the unit named | — |
| B1 | Reference-car masses inconsistent (1.42 kg vs 1.11 kg); ζ 12.8 % low | **closed** | `01` §8.1 (499) "0.24375 kg per front corner … 0.31125 kg per rear corner; total sprung 1.110 kg"; `05` G05.3/G05.6; `06` §6.1; `07` reference corner `m_s = 0.24375`; f = 10.782/10.286 Hz in all three | — |
| B2 | Anti-dive example uses a point that does not exist | **closed** | `03` §5.2 (176) "Round 1's §5.2 printed `lower: (250.0, 12.0)` … The x = 250 is `uca_in.x` … **That case and its perturbation table are withdrawn.**" | — |
| B3 | Bump-steer sign inverted | **closed** | `04` (4.12) line 147: "`τ(bump) = −( ψ(bump) − ψ(0) )` per wheel, POSITIVE = TOE-IN"; §6.4 reports per-wheel **and** axle total (−0.968°) | — |
| B4 | Motion-ratio sign: every car `outOfDomain` | **closed** | `05` (5.2) line 76 `IR = −(dL_d/dθ)/(dz_w/dθ)`, with the round-1 failure narrated at 78–84; IR = 0.5653 | — |
| B5 | Rigid-carrier transform undefined | **closed** | `02` §3.2.3 (136) "Rigid-carrier transform (new — closes B5)" with the branch rule; `01` §6.3 (437) stores `(u,v)` offsets; G01.10 pins (23.6433, −11.4015) and (25.3078, 0.4421); `01` §6.4 separately handles arm-attached points | — |
| B6 | Ackermann rack sign (127 % → 0 %) | **closed** | `04` §3.2 (64) "**The rack translates as one body** … The `±` in (4.4) is deleted"; the 127 %→0 % failure is printed | — |
| B7 | Side-view construction undefined for a hinge arm | **closed** | `03` §5.2 returns `Undefined(noSideViewConstruction)`; `00` §4 adds the reason; `03` §6 refuses within 8° of x; `01` §7's table agrees | — |
| C1 | Roll stiffness and damping ratio have no inputs | **partial** | `01` §4.4 (177) "closes C1" names ARB and damper fields with units, ranges, `on_absence` and consumers. **But the names and the policies are not the schema's:** `arb.span`/`bar_diameter`/`shear_modulus` are R2-only in `spec.md` §4.3.3, `damper.oil_cst` vs `damper_oil_viscosity`, `damper.f_blowoff` vs `damper_blowoff_force`, `damper.c_post` has no spec field, `chassis.*` (4 fields) and `cg.components[]`/`cg.provenance` have no spec field, `mass.unsprung` is per-axle in the spec and single in `01` | One field table, or a written mapping. As it stands an app validating §4.2.1 cannot construct the `01` §4.4 input |
| C2 | Damping ratio is a leaked MUST | **closed** | D-12/D-13 make it a v1 output *by decision*; E3.6 rewritten (497) to the banded estimate; `§4.8` specifies the six fields and the band; `00` §0 row 13 | — (D-13's own arithmetic disputes are tracked under §D) |
| C3 | Bump steer needs rack-end geometry users cannot measure | **closed** | `spec.md` §4.2.1 (1404) makes `steering.rack` optional with `REFUSE`, and E3.5 (486) requires bump steer to carry `REFUSED(rack geometry not recorded)` and offer the measurement procedure; `04` §3.3 adds a stored mechanical travel limit `s_max` | Measurement procedure still unwritten, tracked as O-2 (§7.2) — an owner question, not a contradiction |
| D1 | Three contradictory absence policies | **partial** | The mechanism is real and good: `spec.md` §4.1 rule 3 (1141) with four policies, a mandatory `on_absence` column in both field tables, tests generated from it (E1.2, E2.4, E9.10). **Two defects:** (i) `architecture.md` §4.2 (274) **and** the gate table (704) say `on_absence ∈ {ASSUME, REFUSE, OMIT}` — **three** values, omitting `ESTIMATE`, which is the policy that carries CG height and therefore D-14; (ii) `body.mass.unsprung_*` is `ASSUME(0)` (1394) while `01` §8.1 (494) uses "240 g, estimated, range 160–320", and rule (iii) says `ASSUME` for an unmeasurable quantity "is a schema error" | Add `ESTIMATE` to the architecture's enum (2 places); decide unsprung mass: with `ASSUME(0)` the reference car's front ride frequency falls from 10.782 to **9.156 Hz** (−15 %), because sprung mass becomes the whole car |
| D2 | Setups contain geometry while §4.3 forbids it | **closed** | `spec.md` §4.3 (1422) "plus a **closed set of geometry adjustments** … It never contains hardpoints"; §4.3.2 (1555) gives three adjustments, one axis, `sgn(y_corner)` sign, `geometry_hash`; E2.1/E2.7/E7.1b reference it | — |
| D3 | `content_hash` canonicalisation undefined | **closed** | §4.5 (1661) "adopts [RFC 8785] **whole**", §4.5.1 scope (body minus `meta`/`content_hash`), §4.5.2 algorithm, §4.5.4 published fixtures; E1.7 asserts them | — |
| D4 | A setup shared to another user cannot be opened | **closed** | §4.6 (1755) four library states (`linked`/`model_missing`/`mapped`/`diverged`), three named actions, `mapped_from`; E6.9 and E7.1b | — |
| D5 | Attribution cannot travel | **closed** | §4.9 (1856) `license`/`contributors[]`/`attribution_text` hashed (§4.5.1), refused at import without them, `derived_from_models[]`; E7.12, E9.6 | — |
| D6 | Release gate circular | **closed** | E9.8 names eight stages, each with its own AC; `architecture.md` §10 (688) tabulates stage→AC in both directions; D-09 fixes the command; E9.9/E9.10 carry seeded-failure semantics | — |
| D7 | 74 MUSTs, no cut line, Slice 0 invisible | **closed** | Every AC carries R0/R1/R2; §2.3 lists Slice 0's exact AC set; §8.2 totals 108 / 84 MUST / R1 38 MUST; §8.3 records 23 ACs moved to R2 | R1 is 38 MUSTs against a stated cap of "~35", explained at 2306 — acceptable, worth a line in `plan.md` |
| D8 | 25 ACs that cannot fail | **closed** | §8.3 (2424) disposes of every one: E3.10 deleted (bit-identical transcendentals), E1.7/E9.3/E3.6/E9.8/E1.4 rewritten, E8.7/E8.9/E7.1 split, E5.9/E8.4/E8.10 deleted, five folded, E8.16a–c added. E9.5 now has n = 5 and a pass rule | — |
| D9 | Evidence ladder absent from the requirements | **closed** | E3.16 (566) is a MUST/R0 that enumerates every output and every surface and fails on a missing state; §4.4.1 defines the states; `architecture.md` §8 gives the presenter/evidence-table split | Residual: `99` §1's four-level ladder still says "The UI must show which" (§B.5) |
| E1 | Design "created from template defaults: every row has a value" | **closed** | `screens.md` §12 (419) "**There is no template default.** A new sheet starts **empty** … The old behaviour … is exactly what E1/E2.4 forbid"; `setup-editor.html` "New sheet (empty)" | — |
| E2 | Blanket ±15 % tolerance | **closed** | `screens.md` §0.2 (44) "**Tolerance is data, not a default** … There is no blanket ±15 %"; `design-system.md` §9; `00` §5 "**No blanket tolerance.**" | — |
| E3 | Library values rendered as solid numerals | **closed** | Fifth badge `inherited` in `screens.md` §0.2 (26) with the source named on the row; `wireframe-notes.md` row C shows `↳12.5 · 40.0 · 56.0` + "Inherited · Mugen MTC2 template v2" | — |
| F1 | CG height cannot be measured | **closed** | D-14; `spec.md` §4.2.1 (1390) `ESTIMATE(two_hang_plumb_line)`, "**Never asked as a measurement**"; `01` §4.5 two routes; V16; design Mass & CG card with the robustness split | Residual contradiction: `01` §8.1 (495) still annotates the reference CG as "assumed, range 15–45 (**no measurement procedure exists**)", which §4.5 and V16 now contradict |
| F2 | Damper blow-off force and post-blow-off rate are dyno-only | **partial** | `07` §2.3 states it plainly and `01` §4.4 flags both `ASSUME(4.0 / 12)`. But: (i) `c_post` has **no field** in `spec.md` §4.3.1, so it cannot carry a tolerance and cannot enter the computed band, while `07` §2.3 says "that assumption **is** the ±30 % band" and `spec.md` §4.8 forbids a fixed ±30 % label; (ii) the badge story differs (`07`: `estimated`→`measured` with dyno values; E3.6c: never validated) | Make `c_post` either an estimated setup field with `tolerance_pct`, or a published constant with its sensitivity in the band |
| F3 | ARB setting→rate curve unpublished on blade bars | **closed** | `spec.md` §4.3.3 (1587) defines `arb_setting` as "a **linear fraction of the link rate** … not a fraction of blade travel", states the assumption on screen ("linear bar assumed"), and defers `setting_table` to R2; open question O-3 | — |
| F4 | Piston hole diameter needs a pin gauge (±0.02 mm = ±13 %) | **partial** | The field is `REFUSE` (spec 1536) and `07` §9 prints the sensitivity ("±0.02 mm is ±13 %, so a pin gauge matters"). But no measurement procedure exists (`docs/specs/procedures/` is absent) and the computed band includes only `estimated` inputs' `tolerance_pct`, so a measured hole diameter contributes **no** uncertainty to the ζ band despite a 13 % lever | A procedure file, and a measurement-tolerance term in the band |
| F5 | Unsprung mass ±20 % realistically | **open** | `spec.md` §4.2.1 (1394) `ASSUME(0)` — "The only `ASSUME` in the model"; `01` §4.4 (222) `ASSUME(0, flag)`; but `01` §8.1 (494) uses **240 g estimated, range 160–320**. 0 is outside the model's own plausible range, rule (iii) forbids `ASSUME` here, and the consequence is material: −15 % ride frequency on the reference car | Change to `ESTIMATE(corner_weighing)` with a band, or at minimum `ASSUME(240)` with the flag |

**Tally: 24 closed, 5 partial, 2 open (A3, F5) — 7 not closed.**

---

## (a) Blockers still open

1. **A1** — frame: fixed in the four normative specs, but `hardpoints.html` still teaches x from the
   front axle, and three documents still describe the spec as y-right.
2. **A3** — toe mirror sign: `01` §6.1 says toe is unchanged by mirroring; `spec.md` §4.2/§2.4/§7.1
   and `architecture.md` §5.1 say it is negated. 1.0° of total toe hangs on it.
3. **C1** — inputs: `01` §4.4 names them differently from `spec.md` §4.2.1/§4.3.1, and `chassis.*`,
   `cg.components[]`, `cg.provenance` and `damper.c_post` exist only in physics.
4. **D1** — absence policy: the architecture's enum has three values where the spec has four
   (`ESTIMATE` missing), and `ASSUME(0)` for unsprung mass breaks rule (iii) and the ride frequency.
5. **F2** — damper: `c_post` has no schema field, so the band E3.6 demands cannot include the
   parameter `07` says dominates it.
6. **F4** — piston hole diameter: no procedure, no measurement-tolerance term in the band.
7. **F5** — unsprung mass: `ASSUME(0)` against a physics value of 240 g ±range.

Separately (not round-1 ids, but release-relevant): **`99-validation.md` §8's release gate still
requires V1/V2/V7/V8/V10 to have been run on a real car**, which D-11 says v1 does not wait for.

## (b) New contradictions introduced by the revision

1. **Two normative on-disk schemas.** `spec.md` §4.2 (schema 1.0.0, `{v,s}` values, `body.axles.…`)
   and `physics/01` §5 (schema 1.1.0, bare numbers, `corners.LF.points.…`) both claim to be the file;
   `spec.md` §4's preamble denies that any other document defines the schema. Introduced by revising
   the two documents against different mental models of the same artifact.
2. **Decision-id collision.** `spec.md` §7.1 assigns D-13 = absence policy, D-14 = RFC 8785 canonical
   form, D-15 = geometry transform; `docs/decisions.md`, `physics/07`, `physics/00`, `01` and
   `screens.md` all use **D-13 = damping ratio, D-14 = CG height, D-15 = interpreter vocabulary**.
   `spec.md` §7.1's D-19 is the one that means "the owner decisions of 2026-10-30". D-09…D-12 line up;
   D-13…D-15 do not. A reader who follows a "D-13" citation has a one-in-two chance of implementing
   the wrong decision.
3. **Ride-height sign in `01` §6.2.** "translate chassis-side points … by +dz — **dz > 0 raises the
   chassis relative to the wheels, i.e. bump**". Raising the chassis while the wheel stays on the
   road is **droop** under `01` §3's own definition ("Bump — wheel moves **up** relative to the
   chassis"). This is the paragraph that claims to fix round 1's "50/50 guess on the sign of dz".
4. **Chassis module shipped without a schema.** `physics/10` computes material/thickness/torsion,
   `99` V15 tests it, and the design ships a Chassis card at `/car/:carId/chassis` — but `spec.md`
   §6.2 L-03 defers "Chassis torsional stiffness" out of v1, `spec.md` §4.2.1 has **no** chassis
   fields, and the only AC that mentions chassis flex (E5.5) lists it as a *limitation to disclose*,
   not a value to compute. The card has nothing to read.
5. **Damping speed pair and sub-floor band** (see §D): 5/300 mm/s in the design vs 50/200 in physics;
   `07` G07.14 asserts a band where D-13 and `99` §7 assert none.
6. **`07` §9 / `00` §0 now argue against a decision that has already been amended** — both say D-13
   lists a spring-rate direction it no longer contains.
7. **`zeroSpeed`, `noTimingData`, `estimatedDamper`** — used in modules 7 and 9, absent from `00` §4's
   closed sets, which the document says a spec-audit check enforces.
8. **Minor, same class:** `architecture.md` §4.2's three-value `on_absence` (vs four);
   `checklist.md` vs `checklist-<version>.md`; `arb.arm_length` "does not exist in the v1 schema"
   (§4.3.3) vs "required if `type` = `torsion_bar`" (§4.2.1); `wireframe-notes.md`'s "nine HTML
   files" against eleven; the missing `fields.yaml` that both field tables claim to be generated from.

## (c) The three most dangerous for a developer, ranked

**1. The two on-disk schemas (`spec.md` §4.2 vs `physics/01` §5).** Everything downstream is built
on this decision: the JSON schema, the validator, `content_hash` fixtures, the migration ladder, the
golden-case input format, and every field name in the UI. A developer who picks `01` §5 builds a
model the requirements' validator refuses (bare numbers, no `{v,s}`, no licence, 1.1.0); a developer
who picks §4.2 builds a model that `01` §4.4's input contract cannot consume (`arb.span`,
`damper.c_post`, `chassis.*`, `cg.components[]`). Discovering this after the first fixture is
written means re-deriving the hash, the fixtures and the goldens. It is also the one contradiction
`fields.yaml` + E9.10 were designed to prevent, and `fields.yaml` does not exist.

**2. `99-validation.md` §8's release gate versus D-11.** One file says a release may ship only when
five bench runs exist on a real car; the owner's decision says v1 ships with a chip and validates in
parallel; the results log is empty. A team that implements to 99 will gate v1 on work that has not
been scheduled; a team that implements to D-11 will fail its own documented gate. This decides
whether there is a v1 at all, and it is invisible from `spec.md`, which is where everyone starts.

**3. The toe mirror rule (`01` §6.1 vs `spec.md` §4.2 and `architecture.md` §5.1).** This is the
A3 bug re-created one layer out. The physics is unambiguous and tested (G01.1, G01.8); the two
normative documents say the opposite in one sentence each. An implementer reading the requirements
negates toe on the mirrored corner and gets 1.0° of total toe on a symmetric car — a plausible
number, no crash, no failing test, and exactly the class of silent error round 1 was convened to
find.

**Runner-up:** the D-13/D-14/D-15 id collision — cheap to fix (one table), expensive to debug,
because the wrong decision is implemented confidently and cited correctly.
