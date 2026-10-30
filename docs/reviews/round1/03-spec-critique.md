# Spec critique — `docs/specs/spec.md` v0.1

**Reviewer:** adversarial review, round 1
**Date:** 2026-10-30
**Scope of review:** the 94 acceptance criteria in §3, the data model in §4, FR/NFR maps in §5, scope in §2/§6, decisions in §7, traceability in §8.
**Counter-evidence read:** `docs/intent.md`, `AGENTS.md`, `docs/review-rules.md`, `docs/LICENSING.md`, `docs/design/screens.md`, `docs/specs/physics/00-overview.md`, `01-coordinates-and-hardpoints.md`, `07-damping.md`.

**Verdict.** The document is stronger than most v0.1 specs: the AC set is numbered, tagged, mostly given/when/then, and the traceability table is complete (94 rows, 94 ACs, no orphan rows, no dead rows, no tag mismatches — verified mechanically). It is not yet buildable. It fails in three places: (a) the *absence policy* — what happens when a measurement is missing — is written three different ways and the app cannot satisfy all three; (b) the *persistence contract* — canonical form, hash scope, number format, and a second, contradictory schema in `physics/01` — makes E1.7, E2.1, E2.7 and E7.1 unimplementable as written; (c) a MUST output (damping ratio) has no input in the schema. 74 MUSTs with no cut line is a fourth, scheduling problem.

Counts used below: 94 ACs = 74 MUST / 13 SHOULD / 7 LATER. 15 ACs are verified at least partly by a scripted manual check (`M`), 5 of those are MUST with *no* automated verification at all (E1.5, E8.2, E8.8, E8.10, E9.3). 37 of 94 ACs are cited by no FR row.

---

## 1. BLOCKER

### B1 — The absence policy is three rules, and they disagree
**Sections:** §4.1 rule 3, §4.2.1, §4.3.1, **E1.8**, **E1.9**, **E2.4**, **E1.2**.

E1.8: missing unsprung mass → compute anyway, flag "assumes unsprung mass = 0". E1.9: missing ride height → *refuse* to compute. E2.4: missing setup field → "either marked 'assumes …' … or reported as not computable". E1.2 forbids "a placeholder number". A value produced from an assumed zero *is* a placeholder number wearing a badge, so E1.2 and E1.8 contradict each other on the same screen. Two implementers will produce two apps, and no test can arbitrate because no document says which field takes which policy.

**Fix.** Add a mandatory `on_absence` column to the field tables in §4.2.1 and §4.3.1 with exactly three legal values — `ASSUME(value, flag)` / `REFUSE` / `OMIT` — and delete the prose policies from E1.8/E1.9/E2.4, replacing them with "the behaviour in the field table's `on_absence` column is what is displayed". Then E1.2 becomes a generated test: for each field in the table, delete it from the fixture and assert the documented outcome. Unsprung mass should be `ASSUME(0, flag)`; ride height should be `REFUSE`; and E1.2 must then say "not measured" ≠ "assumed".

### B2 — Setups contain geometry, and §4.3 says they never do
**Sections:** §4.3 preamble, §4.3.1 (`upper_link_inner_shims`, `upper_link_outer_shims`, `wheel_offset`), **E2.1**, **E2.7**, §4.4.

§4.3: "it references a model revision by hash; it never contains geometry." §4.3.1: shims are "consumed by — changes hardpoint positions, therefore geometry", and `wheel_offset` "changes track". So a setup silently rewrites the model geometry that E2.1 hashed and that E2.7 compares. Worse, nothing states the *axis and direction* of a shim change: +1 mm of upper-link inner shim moves the inner pivot in Y (camber link length), or in X (anti-dive), or along the link axis? That single ambiguity changes camber gain and roll-centre migration, i.e. every headline output, differently in each implementation.

**Fix.** Either (a) drop shims from the setup and model them as discrete alternative mount positions on the model (`upper_link.inboard: [{…p1}, {…p2}]` with the setup selecting an index), or (b) keep them and add a §4.3.2 "geometry transform pipeline" that names, per adjustment, the base field, the axis, the sign convention and the units, plus a statement that the model hash identifies the *base* revision while the hash of the derived geometry identifies the *input actually used*, and E7.1 asserts equality of the derived-geometry hash. Also state whether a shim change invalidates E2.7's "model changed" notice (it must not).

### B3 — Canonical form is unspecified, so `content_hash` is not reproducible
**Sections:** §4.1 rule 5, **E1.7**, **E2.1**, **E7.1**, §4.1 rule 6.

Rule 5 says the hash covers "the canonical form of the document body: UTF-8, keys sorted, no insignificant whitespace, `meta` excluded". That leaves open: whether `schema_version`, `id`, `name` and `content_hash` itself are in the body; whether "sorted" means byte order or Unicode collation; how numbers are written (`5` vs `5.0` vs `5e0`, `-0.0`, how many decimals for a mm value that came from 3.0/2); and whether `x_*` keys (E7.2's preserved unknowns) are hashed. Different answers give different hashes for the same car, so E2.1's "linked to the content hash" breaks across two installs and E7.1's "every computed output agrees to 1e-9" cannot even be attempted. E1.7 compounds it by demanding "the persisted bytes of the model body are identical … including field order and float representation" — a serialiser property, not a product property, and one that E7.2's unknown-key preservation can defeat.

**Fix.** Specify canonicalisation by reference (RFC 8785 JCS), state exactly which top-level keys are excluded (`meta`, `content_hash`), pin number formatting ("shortest decimal that round-trips to the same IEEE-754 double; integral values written with a trailing `.0`; `-0.0` normalised to `0.0`; no exponent form for |v| in [1e-4, 1e16)"), pin the sort as UTF-8 code-unit order, and ship two fixture files with their expected hashes in `docs/specs/` so a second implementation can prove agreement. Replace E1.7 with "hash(model) is unchanged after load→save, and `content_hash` re-computed from the exported file equals the stored one" — that is the property the user actually needs, and it survives a serialiser rewrite.

### B4 — E3.6 (damping ratio) has no input in the schema
**Sections:** **E3.6**, §4.3.1, §4.1 rule 1, `physics/07-damping.md` §2–§3.

E3.6: "Given a model, a setup and a **damper curve** … the damper curve's source named." No document kind in §4 holds a curve, no model or setup field holds one, and §4 opens with "**Two** document kinds". Meanwhile `physics/07` computes damping from an orifice model (`A_p`, `n`, `d_h`, `ν_ref`, `C_d`, `F_bo`) — the schema carries `damper_piston_holes` (a count) and `damper_oil_cst` but not hole diameter, piston bore, shaft diameter, or blow-off force. So the MUST output cannot be computed from a valid file, and the two specs describe different products. §4.1 rule 1 additionally promises "damper forces in N at a shaft speed in m/s" as a declared dimension — for a curve that does not exist.

**Fix.** Pick one. If the orifice model (recommended, it is the one that has a golden case): add per corner `damper.piston_holes`, `piston_hole_dia_mm`, `piston_bore_mm`, `shaft_dia_mm`, and `oil_cst` + `oil_temp_c`, mark them `on_absence = REFUSE` for damping ratio, and rewrite E3.6 in those terms with the *model* named (`orifice_single_piston_v1`) plus its validity range. If a curve: add a third document kind `damper_curve` with `points: [{shaft_speed_m_s, force_n}]`, a `source`, and an AC that a curve is required. Either way delete the word "curve" from E3.6 if the model is analytic.

### B5 — `spec.md` §4.2 and `physics/01` define the same file incompatibly
**Sections:** §4.2, §4.2.1 vs `docs/specs/physics/01-coordinates-and-hardpoints.md` §4–§6.

Four independent contradictions on the same artifact:

| | `spec.md` §4.2 | `physics/01` |
|---|---|---|
| origin | flat plate, **mid-wheelbase**, centreline | rear axle line (`front contact patches x = wheelbase`) |
| units in file | `"units": {"length": "mm", …}` | `"units": "SI"` |
| `schema_version` | `"1.0.0"` (semver string) | `1` (integer) |
| tie-rod field | `steering.tie_rod_inboard` | `tie_in` ("rack end", with a rack the spec has no field for) |

Both claim to own the on-disk schema; D6 and §4.1 argue mm-in-file at length, and the physics spec writes SI. A developer reads `physics/01` first (it is titled "the on-disk schema") and builds the wrong frame — a 128 mm Z shift and a 257 mm X shift on every hardpoint, which is silent, plausible and catastrophic.

**Fix.** Declare §4.2 the single normative schema; rewrite `physics/01` §4 to say "field names, units and frame are defined in `docs/specs/spec.md` §4.2" and delete its JSON example and field table, keeping only the *derived* quantities and the validation rules. Fix the frame explicitly: mid-wheelbase origin is correct for roll-centre work; state that contact-patch positions are derived, not stored, and that `x = ±wheelbase/2`.

### B6 — A setup shared to another user cannot be opened, and no AC says what happens
**Sections:** §4.1 rule 6, §4.3, **E6.2**, **E7.1**, **E6.5**.

A setup references `(model_id, content_hash)`. E6.4 shares "a model or setup" as "a single self-contained JSON file". A setup file is therefore *not* self-contained: the recipient has neither the id nor the hash nor the old revision, and §4.1 rule 6 says setups do not embed model copies. E7.1's "exported and imported on a different device → every computed output agrees to 1e-9" is unsatisfiable for the setup half of its own sentence. E6.5 validates imports and would accept the file, then have nothing to compute against. This is the primary community use case (a faster driver's sheet) and it dead-ends.

**Fix.** Add the missing requirement and its AC: on import of a setup whose `(model_id, content_hash)` is unresolved, the app installs it as **"model missing"**, shows inputs, notes and conditions read-only, computes nothing, and offers (i) import the model from a sibling file chosen in the same flow, (ii) map onto a different model revision with an explicit warning that outputs are not comparable (consistent with E4.3), or (iii) discard. Rewrite E7.1 as two ACs: model export/import (hash equality + output equality) and setup export/import (round-trip equality of every stored value, and the defined behaviour when the model is absent).

### B7 — The licence and attribution cannot travel in the file
**Sections:** **E9.6**, §4.2/§4.3 schema, `docs/LICENSING.md`.

`LICENSING.md` ships model data under **CC BY 4.0, contributor-attributed**. CC BY requires attribution on redistribution. The schema has no `license`, no `contributors[]`, no `attribution` and no `url` on a model; the only place a person appears is the free-text `by` inside a source record, and the only licence statement is a screen (E9.6). E6.2 imports a third-party model, E6.3 lists it in the library, E6.4 re-shares it — and the contributor's name and the licence are gone. E9.6 ("attribution for every shipped model and its contributor") is then satisfiable only for models shipped in the binary, and the licence claim is false for every file that leaves the device.

**Fix.** Add to the model document: `license: {id: "CC-BY-4.0", url}`, `contributors: [{name, role, contact?}]`, `attribution_text` (the exact string a re-sharer must reproduce), and to setups `derived_from_models[]`. Add the AC I propose in §10, and state in §4.1 that these keys are hashed and must survive import/export and the E7.5 conflict flow.

### B8 — The release gate depends on tools no requirement requires
**Sections:** **E9.8**, **E3.11**, **E5.3**, **E5.4**, **E8.1**, **E9.2**, **E9.4**, `AGENTS.md`.

E9.8 is MUST and says "the spec audit reports no untested MUST and no orphaned test". `AGENTS.md` names `dart run tool/spec_audit.dart` with the qualifier "**once it exists**" — no AC requires it to exist, no AC defines its exit codes, and §8.2 says the orphan check "belongs in `spec:audit`". Six other MUSTs are verified "by a build check" that is likewise not itself a requirement: E3.11, E5.3, E5.4, E8.1, E9.2, E9.4. A gate nobody must build is a gate that will be argued about in the release PR, at the worst moment.

**Fix.** Add one AC in E9 per gate: "given the repository at `main`, when `dart run tool/spec_audit.dart --strict` runs in CI, then it exits 0, and when a MUST id is deleted from a test file it exits non-zero naming that id" — and the same seeded-failure clause for the IP check, the term check, the overlap check, the manifest check and the fixture check. Then E9.8 can be reduced to "all gates exit 0 in CI on the release commit".

### B9 — 74 MUSTs, no cut line, and §2.3's slice is invisible to the AC set
**Sections:** §2.3, §3 (all), §8.2.

§2.3 says Slice 0 is the thing that decides whether the spec succeeded, and §10 defers effort estimates to `plan.md`. But no AC carries a release marker: E3.12 (frame timing), E3.13 (measured-vs-predicted wheel rate), E8.9 (RTL + pseudo-locale), E8.11 (25 MB bundle), E9.5 (three external racers) are all MUST and all "block release" (§3 tag definition). A plan cannot be written from an undifferentiated 74-MUST set without silently re-tagging, which is the re-litigation §2.4 exists to prevent.

**Fix.** Add a `Release` column to §8.2 with values `R0` (Slice 0), `R1` (first ship), `R2`; cap R1 at ~35 MUST; mark the six ACs that ride on unbuilt tooling or unrecruited users as R2; and add one AC that the audit fails a MUST with no release marker. E9.5 belongs to R2, not to the first store submission.

---

## 2. MAJOR

**M1 — "complete model" is undefined and, for E3.2, unsatisfiable.** §4.2.1 marks `mass.sprung_front/.sprung_rear` optional; **E3.2** says "given a complete model and setup … ride frequency per axle … reported". Ride frequency needs sprung mass. So a model that is complete by the field table cannot produce a MUST output. *Fix:* define `complete` as `complete_for(output)` — a per-output required-field set generated from §4.2.1 — and make E1.1/E1.2/E6.3 all consume that same set. Then E6.3's "percentage of required fields" has a denominator.

**M2 — `symmetry: true` plus "absence means not measured" leaves the right-hand corner undefined.** §4.2 `symmetry` requires right = mirror of left "within 0.01 mm", the example model omits `corners.right` entirely, §4.1 rule 3 forbids defaults, **E1.4** says entering FL *writes* FR, and **E6.3** counts completeness. Is a left-only model 50% or 100% complete? Does the loader synthesise FR (violating rule 3) or report it missing (violating E1.4's promise)? *Fix:* state that with `symmetry: true` the right corner is never stored and is derived at load into a distinct `derived_by_mirror` provenance, that completeness counts it as measured-by-symmetry, and that `symmetry: false` requires explicit right-hand points. Add the assertion to E1.4.

**M3 — The schema cannot express a single-link camber link without creating the degeneracy E3.8 forbids.** §4.2.1 requires `upper_link.inboard_front` *and* `inboard_rear`. A touring-car camber link is one link with one inner ball stud; a buggy front is a wishbone. To model the TC the user must enter two identical inner points — which is exactly "coincident hardpoints", the degenerate case **E3.8** MUST handle as undefined. *Fix:* add `upper_link.type: "single_link" | "wishbone"` with `inboard` (one point) for single-link and `inboard_front/inboard_rear` for wishbone; assert in E3.1 that a TC fixture with one inner point produces a finite motion ratio.

**M4 — Bump steer's stated dependency does not exist in the schema.** §4.4 lists bump steer as depending on "tie-rod inner and outer positions, lower arm, **rack height**". There is no rack field: only `steering.tie_rod_inboard` per corner. A rack spacer is the most common bump-steer fix a racer makes, and it is unrepresentable, so **E3.5** must be tested on a car that cannot be described. *Fix:* add `steering.rack: {height, x, y_left/y_right, travel_per_turn}`, mark it required for the front axle if bump steer is to be displayed, and make its absence `REFUSE` for that output.

**M5 — E5.4 and E3.11/E9.4 are mutually unsatisfiable.** **E5.4**: no shipped string may share "a run of more than 8 consecutive words with any corpus document", or the build fails. **E3.11** requires a golden case whose expected value comes from a cited external source, and `AGENTS.md` names "Bob's worked example" as a legitimate citation. Quoting the worked example's own sentence in-app or in a test fixture trips E5.4 and E9.4. A term of art ("roll centre height above the ground plane") is also >8 words of unavoidable overlap with the handbook. *Fix:* scope the overlap check to *explanation and help copy only*, exclude `docs/specs/physics/` fixtures and golden values, allow a per-string allowlist file with a reason, and re-word E5.4 as "no shipped explanation or help string shares 8+ consecutive words with the corpus unless listed in `docs/specs/overlap-allowlist.json` with a reason".

**M6 — Nothing persists the work in progress, and the epic says the work cannot be repeated.** §E1 preamble: "a caliper session costs an hour and can never be repeated exactly". **E2.2** keeps edits in "a working copy" but no AC says the working copy survives a process death, and **E5.7** (SHOULD) persists only *tutorial step progress*. A phone call at minute 40 on Android loses the worksheet. *Fix:* add the AC in §10; it is the highest-value missing requirement in the document.

**M7 — E8.9 and §5.4 A-07/A-08/A-09 are three layers of claims with no owner.** **E8.9** requires pseudo-locale and RTL MUST while D10 ships English only; §5.4 claims its nine rows are "the testable subset … (E8.7, E8.8, E8.10)", but A-07 (focus order, switch access), A-08 (no precise dragging; stepped alternative to every slider) and A-09 (no flashing; respect reduced motion) appear in **no** AC. A-08 in particular is load-bearing: the app's central interaction is dragging a slider (E3.12), and a one-handed, gloves-on, sunlight user (§1.2, §E8 preamble) cannot drag precisely. *Fix:* give A-07/A-08/A-09 their own ACs or delete them from §5.4; demote RTL to SHOULD (keep string externalisation MUST) since no RTL locale ships.

**M8 — E3.12 contradicts P-01 and cannot be measured reproducibly.** **E3.12**: "the full analysis recomputes in ≤16 ms per update and ≥95% of frames are presented within 16.7 ms". **P-01**: "≤16 ms typical, **≤25 ms at p99**". If p99 is 25 ms, the absolute assertion in E3.12 fails ~1% of updates by construction. Neither names a warm-up allowance, a percentile for the frame budget across the 10 s drag, or what happens on a CI emulator (which does not exist for iOS). *Fix:* rewrite E3.12 to P-01/P-02's percentiles ("p50 ≤16 ms, p99 ≤25 ms over 1,000 recomputes; ≥95% of the 600 frames in a 10 s drag presented within 16.7 ms, first 30 frames excluded"), and state that the test runs on the physical reference device in the release checklist, with a `flutter drive` timing harness as the pre-release proxy and a stated looser bound for it.

**M9 — E3.10's 1e-9 across "two devices, debug and release" is not achievable for transcendental work.** `sin/cos/atan2/exp` differ between ARM64 and x86_64 libm and between AOT and JIT by more than 1e-9 relative in cancelling expressions (roll-centre height near the instant-centre singularity, migration at ±3°). *Fix:* state the tolerance as `|Δ| ≤ 1e-9·|ref| + 1e-12` at the *fixture* level on one platform, and for cross-platform assert ≤1e-6 relative; or restrict the claim to the same build and platform and drop "two devices".

**M10 — "What happens when a model is wrong" is one AC deep and has no recovery path.** **E3.13** compares predicted wheel rate to a measured one and flags >15% — but the measured value comes from **E1.10**, which is SHOULD, so the only wrong-model detector in a MUST-compliant build may be absent. There is no requirement for: marking a model suspect, bulk-recomputing the N setups built on a corrected revision (E2.7 handles "model changed", not "model was wrong"), or correcting a *shipped* library model when there is no server (only an app update can do it). *Fix:* promote the measured-wheel-rate input to MUST (it is one number the user already has), add an AC for "correct this model" producing a new revision plus a list of the setups affected with their re-computed deltas, and add an errata requirement: a shipped model carries `supersedes`/`superseded_by` and the library row for a superseded model says so.

**M11 — Error and recovery has no ACs; the design assumes they exist.** `screens.md` §8 defines an `error` state ("a saved value fails to persist … a retry on that row only") and §11–§13 rely on it. `spec.md` has **no** AC for: storage full / permission denied on save; a corrupt or unreadable file in the library at launch; a failed export; a failed PDF generation. §5.3 states three data-safety rules in prose (revision retention, confirmed deletion, warning when setups still reference a deleted revision) with no AC id — so they cannot be audited and will not be built. *Fix:* add E8.14 (save failure is reported per-field with retry and no data loss — a widget test with a mocked filesystem that fails the second write), E8.15 (a corrupt file is quarantined and named, the library still opens), E7.11 (export failure leaves the source intact and says why), and give §5.3's three bullets AC ids.

**M12 — Privacy is asserted in the wrong place and one requirement is missing entirely.** **E8.13** requires that "the privacy statement says plainly that no usage data is collected" — no artifact, no screen, no location is named, so it is untestable. Play/App Store submissions additionally require a *data safety declaration* and a privacy-policy URL, and D9's "static hosting only if anything is hosted at all" collides with the URL requirement. And the `sources.<id>.by` field stores a person's name or handle in every file, which E6.4 then shares: no AC says the user is told. *Fix:* add an in-app Privacy screen (golden-string test on the exact text), an AC that the store data-safety declaration is recorded in the release checklist with its URL, and a line in E6.4 that the share preview names the personal fields the file contains.

**M13 — E2.3 is vacuous if v1 ships one unit family, and it is the only unit AC.** §4.1 fixes storage in mm/deg/g/N·mm⁻¹ and D6 fixes exactly one conversion site; nothing requires a second display unit family to exist. With metric-only UI, "every displayed value converts" passes trivially and "stored value unchanged" is untestable. If imperial does ship, "every displayed value" has no enumeration to iterate. *Fix:* name the display unit families that must exist (mm/cm/in for length; °C/°F for temperature; N/mm, lbf/in) or state explicitly that E2.3 is satisfied by the round-trip property test over the converter for the families listed; make the converter's property test the assertion, not the screen.

**M14 — E7.2 forbids the identifier the format depends on.** **E7.2**: the file must contain "no opaque identifier that a reader cannot resolve within the file". A setup's `model_ref.content_hash` is opaque and unresolvable within the file (B6), and `id` is declared "opaque" in §4.2.1. *Fix:* reword to "no binary blob, no base64 payload, and every identifier that names another document is accompanied by that document's human-readable name and, where the referent is not embedded, by a resolvable locator or an explicit `model_missing` marker".

**M15 — Units live in key names, which defeats the `units` object.** `air_temp_c`, `tyre_pressure_kpa`, `damper_oil_cst`, `damping_low_speed_m_s`, `roll_sweep_deg`, `cg.longitudinal_front_pct`, `damper_piston_holes` (count), `arb_setting` (dimensionless). §4.1 rule 1 says units are declared in `units`, and D6's whole mitigation is that "a future inches-native file is unambiguous" — but renaming `air_temp_c` to `air_temp_f` is a schema change, and the `units` map does not even declare dimensions for viscosity, pressure, percentage or count. *Fix:* drop unit suffixes from keys, extend the `units` map to every dimension used (`length, angle, mass, spring_rate, damper_force, damper_speed, viscosity, pressure, temperature, ratio, count, percentage`), and add a test that walks the document and asserts every numeric leaf's dimension is declared.

**M16 — E4.6 (contribution breakdown) specifies an answer, not a method.** "Inputs are ranked by their contribution to the change, with each contribution shown as a value in the output's units" — for a non-linear output (camber gain vs shim, load-transfer split vs ARB) one-at-a-time perturbation is order-dependent and the parts do not sum to the total. Two implementations rank differently. *Fix:* state the method (`one_at_a_time` from the baseline, in the setup field order of §4.3.1), require the residual to be shown as "interaction", and assert in the test that Σ contributions + interaction = total within 1e-12.

**M17 — E3.9 tests a suspension type the schema cannot express.** "instant centre ahead of the axle on a **trailing-arm** rear" — there is no trailing-arm or live-axle representation in §4.2 (no arm pivot, no beam). *Fix:* either add `rear_suspension.type: "independent" | "trailing_arm"` with the fields that implies, or replace the example with a case the schema can build (parallel equal-length links → instant centre at infinity).

---

## 3. MINOR

- **E1.6** names three example implausible ranges and no table; the plausibility bounds therefore live only in code. *Fix:* put the range per field in §4.2.1 (`plausible`) and generate both the UI hint and the test from it.
- **E1.11** ("in the user's own words") has no field to hold the words. *Fix:* add `representation_note` to the model and assert it round-trips into the shared-file summary.
- **E1.5** vs `screens.md` §8: the design shows "9 of 13" steps; §4.2.1 has ~50 required fields across two corners and two axles. The worksheet therefore groups, and E1.5's "exactly one step per required model field" contradicts it. *Fix:* say "one step per *group*; every required field appears in exactly one step; the count is asserted against the field table".
- **E2.5 / §4.3.1**: the field→output map exists in prose twice ("Consumed by an output?" and §4.4 "Depends on"), and E2.5 is MUST on its accuracy. Two tables will drift. *Fix:* one machine-readable map (`docs/specs/fields.yaml`) generating both tables, with a test that every field appears and every referenced output id exists.
- **E2.1/E2.7** use `meta.revises` for models but `parent_id` for setups — two lineage mechanisms. *Fix:* one.
- **`assumptions` is a required setup field "written by the app"** (§4.3.1, E2.4). A hand-written or older file then carries stale assumptions, and E7.3 requires the assumptions block in every export — so which copy wins? *Fix:* store it only in exports, or mark it `generated: true` and require the loader to recompute and warn on mismatch.
- **`unknown` is overloaded.** §4.1: "present in a file but with no recorded origin"; `screens.md` §0.4/§8: a user-facing state meaning "the owner explicitly does not know". The second is a legitimate measurement state and the first is a file defect. *Fix:* rename the file defect to `unattributed` and keep `unknown` for the user-set state.
- **`library` provenance has no schema type.** `screens.md` §9 offers "Use library value" and §0.4 lists a `library` badge; §1.4 claims this maps to `manufacturer`/`third_party`, but a value copied from another chassis's model is neither. E1.3 then rejects the save. *Fix:* add `type: "library"` with `ref` (source model id + field path) and forbid it for values whose provenance chain ends in `estimated`.
- **E7.4** requires the setup sheet "printable on desktop" while L-05 defers desktop to later. *Fix:* "printable where the platform supports printing; shared as PDF everywhere".
- **E8.6** names Android 8.0 / iOS 15 but no AC asserts the built artifacts' `minSdkVersion`/deployment target. *Fix:* fold into E8.1's manifest check.
- **E8.11** 25 MB with no named check; §5.6 repeats the numbers a third time. *Fix:* one home (E8.11) with a CI size-diff job, and delete §5.6's table.
- **§10** says v0.2 will mark "the ACs they [D1–D10] unblock", but no current AC carries a decision dependency, and D4 is already folded into E7.9 without a marker. *Fix:* add a `depends_on` column now for D1, D2, D4, D5, D9.
- **E5.7 + E9.5** — the guided first run is SHOULD while the three-user success test that depends on it is MUST. See §5 below: this is the clearest tag inversion in the document.

---

## 4. NIT

- §1.1, §2.1, FR-05 and §4.4 promise **twelve outputs**; E3.1–E3.6 cover nine. Ackermann and toe-at-roll have no AC (see §6).
- §1.4's provenance mapping is presented as a solved difference; `screens.md` §0.4 resolves it differently (four badges, "from template" collapsing two source types). Two normative tables, two answers.
- §8.2's sentence "every intent statement apart from I8 … is served by at least two ACs" is false for `N2`, which E5.6 alone serves. Say "every I-statement".
- §8.2's verification legend has no entry for "U (perf)".
- `docs/specs/spec.md` §4.2.1 has a malformed row: `| …upper_link.inboard_front / inboard_rear / outboard | point | yes (front), yes (rear) | |` — the unit column holds "yes (front), yes (rear)" and `Req` is empty.
- §4.3's example `conditions.surface` is a string and `tyre.compound` a string, both unprovenanced, while E7.2 says units are declared — fine, but state that enums and strings need no source or the completeness count will be argued.
- E3.12's "≥95% of frames" does not say whether the frames of the drag gesture or of the recompute are counted.
- The traceability table is hand-maintained and correct today; nothing regenerates or checks it (see B8).

---

## 5. Acceptance criteria that fail the testability bar

Classified as: **U** — not independently testable as written; **S** — solution-shaped (names a library, widget, file or design document); **T** — passes trivially; **D** — duplicates another AC.

| AC | Class | Why | 
|---|---|---|
| E1.1 | T | "no output that depends on it is displayed at all" — a blank screen passes. |
| E1.5 | U, S | "in the order the measurements are physically taken" has no oracle; "shows a diagram" is unverifiable; M-only verification for a MUST; contradicts `screens.md`'s 13 steps. |
| E1.7 | U | Byte-identical round trip depends on canonicalisation that B3 shows is unspecified, and is a serialiser property, not a product property. |
| E1.11 | U | "in the user's own words" is not assertable, and there is no field to hold the words. |
| E2.3 | T | Vacuous with one display unit family (M13). |
| E2.5 | S | Rests on a duplicate prose table (§4.3.1) with no machine-readable source. |
| E2.6 | S, U | "the number of taps … is shown in the design's screen inventory and does not grow with model size" — a document, not the app; "does not grow" is unbounded. |
| E3.10 | D, U | Duplicates E7.1's determinism claim; 1e-9 across two platforms is not achievable for transcendental ops (M9). |
| E3.11 | T, U | "at least one golden case exists whose expected value comes from a source outside the codebase" — a comment satisfies it; nothing checks the citation resolves or that the number was not produced by the code. |
| E3.14 | U | "the output change for a stated step" is fine; the step size is "displayed" but never defined per input, so the expected number is unpinned — and it is SHOULD while the MUST success test depends on this capability. |
| E4.2 | T | "unchanged outputs are still listed" passes with a static list; "did not change" has no threshold against display rounding. |
| E4.6 | U | Method unspecified for non-linear outputs (M16). `SHOULD`. |
| E5.3 | U | "every technical term … is defined somewhere" — no term list, no definition of "technical term". |
| E5.4 | S | Names a repo path (`docs/research/`) and a build gate; contradicts E3.11/M5. |
| E5.6 | U | A negative claim about prose ("never presents a composite grip score", "every directional claim … is a claim about a computed quantity") — unfalsifiable by any single test. |
| E5.8 | U | "the vocabulary matches what the community uses … rather than inventing synonyms" — no list, no oracle. `SHOULD`. |
| E6.2 | U | "computes without further input" — which outputs, to what tolerance, on which of three OS entry points? |
| E6.3 | U | Completeness percentage has no denominator until B1/M1 define the required-field set. |
| E7.2 | U | Self-contradictory (M14). |
| E8.4 | D | "data leaves the device only through an action the user started" is checked by E8.1's absent INTERNET permission; nothing else can be verified. |
| E8.7 | U | Five unrelated assertions in one AC plus an unqualified "meeting WCAG 2.2 AA"; no audit method. |
| E8.10 | U, D | "used in direct sunlight" has no protocol; contrast is already E8.7. |
| E8.13 | U, S | "the privacy statement says plainly …" with no named artifact or location. |
| E9.3 | U | A human editorial check of store copy ("checked against the clean-room rule"), no procedure, no evidence artifact beyond "the release checklist". |
| E9.5 | U | n=3 with no pass rule, no protocol for "correctly predicts the direction", no allowance for one failure — and it will block release on one slow user. |
| E9.6 | T | "the dedication [is] readable in-app" is satisfied by a text block. |
| E9.8 | U, S | Circular: depends on an audit tool no AC requires (B8), plus "screenshots have been reviewed". |
| E8.2 | U | M-only for a MUST, and "models a car, enters a setup, computes, compares, reads an explanation and exports" has no acceptance threshold per action. |

### The ten worst, rewritten as testable criteria

**1. E1.5 (was: worksheet ordered "as physically taken", diagram shown)**
> *Given* the example model and the field table in §4.2.1, *when* the measurement worksheet is generated, *then* (a) every field whose `Req` is `yes` appears in exactly one worksheet step, asserted by set equality between the generated step list and the table's required-field set; (b) for each step, the `datum` string shown equals the `datum` recorded in the example model's source `s1` for that field; (c) each step's illustration asset loads, has intrinsic width ≥320 px and non-empty `alt` text; (d) the step order equals the order in `docs/specs/worksheet_order.txt`, and changing that file changes the order without a code change.

**2. E2.6 (was: taps "shown in the design's screen inventory")**
> *Given* a 320 dp device and any model, *when* the test taps from the setup screen to each of the seven setup groups in turn, *then* each group is reached in ≤2 taps from the setup screen, and the tap counts measured with a 1-setup library and a 50-setup library are identical. Asserted by a widget test that drives the real route stack.

**3. E3.11 (was: "a golden case exists … comes from a source outside the codebase")**
> *Given* `app/packages/setup_physics/test/golden/*.json`, *when* the golden suite runs, *then* each file has keys `output_id`, `inputs`, `expected`, `tolerance`, `source_kind` ∈ {`published_equation`, `cited_worked_example`, `hand_calculation`}, and `source_ref`; `source_kind = hand_calculation` requires a PDF or markdown path under `docs/specs/physics/` that exists and contains the `expected` value as a string; `source_kind = cited_worked_example` requires a path under `docs/research/` plus a page/timestamp locator. A file whose `expected` matches the implementation's output when the implementation is deliberately perturbed by 1% fails the suite. Every output id in §4.4 has ≥1 file.

**4. E4.2 (was: "unchanged outputs are still listed and marked unchanged")**
> *Given* two setups that differ only in `corners.fl.spring_rate` (3.10 → 3.40 N/mm), *when* they are compared, *then* the output list has exactly the 12 rows of §4.4, exactly the outputs whose value changes by more than the displayed precision are marked "changed", the changed set includes wheel rate, ride frequency and roll stiffness and excludes roll-centre height, and each "unchanged" row's displayed value equals the baseline's displayed string.

**5. E5.3 (was: "every technical term … is defined somewhere")**
> *Given* `docs/specs/terms.txt` (one term per line) and the localisation bundle, *when* the term check runs, *then* for every term that occurs in any shipped explanation or help string there is a glossary entry with a non-empty definition and at least one inbound link, and for every glossary entry there is at least one shipped string that links to it; the check exits non-zero naming the term and the bundle key when either direction fails. Seeding a new term with no definition turns CI red.

**6. E5.6 (was: "never presents a composite grip or handling score")**
> *Given* the release build, *when* the string audit runs over the localisation bundle and the widget tree of every screen, *then* no user-facing string matches `(?i)\b(grip score|handling score|balance verdict|best setup|faster|lap time)\b`, and every directional string in the analysis, compare and concept screens is resolved from a template whose key is `<output_id>.direction.<rising|falling>`, so that a test can enumerate them. Adding a free-text handling claim fails the check.

**7. E8.7 (was: five assertions plus "meeting WCAG 2.2 AA")**
> Split into four ACs, each mechanically asserted: **E8.7a** every tappable widget node reports a semantic size ≥44×44 dp and ≥8 dp from its nearest neighbour, checked by walking the semantics tree on all routes at 320 dp; **E8.7b** at text scale 2.0 no text node's painted bounds exceed its parent's, and every output value on the analysis screen has non-zero painted height; **E8.7c** every foreground/background pair in both themes is computed from the theme tokens and meets 4.5:1 (body) / 3:1 (≥18.66 px bold or ≥24 px) / 3:1 (non-text), asserted from a token dump; **E8.7d** every chart widget exposes a table alternative reachable in one tap whose row count equals the chart's data-point count.

**8. E9.8 (was: "the release gate runs … and screenshots have been reviewed")**
> *Given* the release commit, *when* CI runs `spec_audit --strict`, *then* it exits 0 only if every MUST id appears in a generated `docs/specs/audit.json` mapped to at least one test path, every test path maps back to a MUST or SHOULD id, and no LATER id has a test; deleting one `@SpecTest('E3.3')` annotation makes it exit non-zero naming `E3.3`. The screenshot review is removed from this AC and stated as a separate pre-submission checklist item with a named reviewer field.

**9. E6.2 (was: "it appears in the library … and computes without further input")**
> *Given* a fixture model file with a complete front axle only, *when* it is installed from each of the three entry points the test harness can drive (file picker, `ACTION_VIEW` intent, share-sheet target), *then* the library row shows its name, class, 12/24 fields and a provenance summary matching the file's `sources` counts, and the analysis screen displays roll-centre height and camber gain for the front axle whose values equal the golden fixture within 1e-9 relative, with zero taps between install and display.

**10. E9.5 (was: three racers, ≤30 minutes, "correctly predicts the direction")**
> *Given* five participants who have not seen the app (recruited per `docs/specs/eval/protocol.md`), *when* each completes the session unaided, *then* (a) ≥4 of 5 produce a model whose required fields are all present within 30 minutes, measured from app install to the first analysis screen with all four corners measured; (b) each participant, shown a camber-link shim change and a roll-centre change, names the direction of the affected output in the same direction the app's own sensitivity output reports (E3.14), before the app shows the delta; (c) every session's timing, failures and any abandoned step are recorded in `docs/specs/eval/run-<date>.md`. Release blocks on (a) and (b) together, not on each individual session.

---

## 6. Coverage: what is missing or thin

**First-run experience — thin (one SHOULD).** E6.1 (example model present) and E5.7 (guided path, SHOULD) are the whole story. No AC covers: the empty library's call to action; what the user sees before any model exists; whether the example model is editable or read-only and what happens when it is edited; how a user with a paper sheet and no caliper is routed. Given E9.5 is a MUST that depends on exactly this, the thinness is load-bearing (see §7).

**Error and recovery — missing.** No AC for: save failure (storage full, permission revoked, write interrupted by unmount); corrupt file at launch; failed export; failed PDF render; a save that succeeds locally but whose file the OS later evicts. `screens.md` §8 defines a per-row "not saved · retry" state that the spec never requires. §5.3 states three data-safety rules in prose with no AC ids, so they are outside the audit and will not be built.

**Data loss and backup — thin, and this is years of work.** E7.6 requires one backup file and a restore preview; nothing requires: that a backup is *verifiable* (hash per document, restore asserts it); that the app ever prompts (a racer who never taps Backup loses everything on a phone replacement); that deleted revisions are recoverable or that deletion is soft for N days; that the backup includes photos referenced by E6.7; what happens when a backup was made by a newer schema. §5.3 says revisions are "retained until the user deletes", which is the opposite of a safety net for a lost phone. A "years of work" asset needs: scheduled default backup on a stated cadence, a restore-verification AC, and an "export everything, then re-import it and assert equality" AC.

**Accessibility beyond lip service.** E8.7 is a grab-bag; E8.8 covers screen-reader value announcements but not the *analysis screen's* navigation (a table of 12 rows × 2 axles, each with a badge and a delta chip); A-07/A-08/A-09 have no AC (M7); nothing covers the one-handed reachability that §1.2's user needs on a 1080×2400 phone (top-of-screen controls), and A-08's stepped alternative matters because the primary interaction is a drag (E3.12). Text scale 200% is asserted but "no loss of a value" (§5.4 A-02) is not — a value can be clipped to "12." and still be "non-clipped" under a naive test.

**Performance under slider drag.** Present (E3.12) but contradicted by P-01 and unmeasurable on iOS (M8); no AC covers the *interaction* cost that matters more than the compute: does the value under the thumb lag the finger (input-to-photon) and does the analysis update without the thumb jumping? No AC covers the drag on a 50-setup library, or recompute latency after a model edit with 200 models in the library (P-06 covers scrolling only).

**App lifecycle and state restore — missing.** No AC for: worksheet draft surviving process death (M6); a working copy surviving kill; resuming after a phone call or camera app during a measurement; orientation change on the analysis screen mid-drag; state restoration after OS memory pressure; deep-link restore to the same field. Only E5.7 (tutorial progress, SHOULD) touches persistence of position.

**Sharing/importing a setup from another user — broken.** B6. Beyond the mechanical failure: no AC covers the social case that motivates the feature — receiving a sheet from a faster driver on a *different but similar* chassis, where the useful output is "these are the inputs he ran, and here is what they'd be on my car's geometry, with the caveat that they are not comparable". E4.3 refuses cross-model comparison of outputs; nothing offers cross-model comparison of *inputs* with per-input feasibility warnings (a 5 mm droop on his car may be impossible on yours), which is what the user actually wants.

**Privacy.** E8.1 (no INTERNET permission), E8.4 (data stays local), E8.13 (no SDKs, statement) is a reasonable skeleton but: no named artifact for the statement; no store data-safety declaration; no treatment of `sources.by` as personal data that travels in a shared file; no statement that crash reporting is absent *because* there is no crash reporter (so a crash produces no report at all — worth stating as a product consequence, and worth an AC that a crash on launch produces a recoverable local log the user can choose to copy, since E9.7 offers a manual bug route with nothing to attach). Also: the requirement "no telemetry" is stated as a *dependency* check (E8.13) rather than as a product requirement; it should be one line in §2.1's "in v1" so that a future contributor adding an analytics plugin is violating a stated requirement, not just failing a grep.

**Licensing/provenance surfacing in the UI.** E9.6 is a credits screen; the schema cannot carry attribution (B7); nothing requires the provenance of the *model being analysed* to be visible on the analysis screen (E6.3 covers the library row only), so a user can compute twelve numbers from a `third_party` model with no idea whose measurements they are. Nothing requires the licence of an individual imported model to be shown, or a warning when a model's licence forbids redistribution.

**What happens when a model is wrong.** M10. Add: a `suspect` state; a correction flow producing a new revision with the setups built on the old one listed; `supersedes`/`superseded_by` for shipped models; and a requirement that a shipped model's correctness claim is bounded by its provenance (a model with an `estimated` hardpoint says so on the analysis screen, not only in the model editor).

**Two outputs with no AC at all.** Ackermann and dynamic toe are promised in §1.1 ("static camber/toe at a given roll angle"), §2.1, FR-05 ("the twelve outputs") and §4.4, and no AC in E3 covers them. They are orphans in the *other* direction from B8's: requirements with no criterion.

---

## 7. JSON schema: sufficient? No

Two real cars, checked against the schema as written:

**Touring car (1/10, carpet).** Blocked by: camber link as a single inner ball stud (M3); shim direction undefined (B2); no rack height for bump steer (M4); no caster in the model while caster drives camber gain (the setup has `caster` and §4.3.1 calls it "reference only in v1", so a caster change will not move any output, which will read as a bug to every TC racer); no per-corner spring rate separate from the model's `spring.rate` (which wins?); no ARB arm/link geometry, so `arb.rate_at_full_stiff` "at the link" cannot become a wheel rate; no drop-link position, which is how ARB rate is actually adjusted on most TCs; no `droop` per corner distinct from the model's `droop_limit_wheel`.

**Buggy (1/10 2WD, dirt).** Blocked by: single-link camber link (front, and the rear is often a link too — M3); shock-tower hole position is *the* most-used buggy adjustment and has no field (only `spring_preload`), which also makes E2.5's "no field is unexplained" moot because the field does not exist; no wing/aero (declared out of scope, fine, but `class: buggy_1_10_2wd` implies nothing and no per-class required set exists); no rear toe-link geometry for a 2WD buggy with rear toe control (the table says "rear uses `toe_link_*` of the same shape" — a field *name pattern* in prose, not a specified field, which is exactly the kind of thing two implementations resolve differently); no diff/gear ratio, no motor position (out of scope, but the class enum promises a car the schema cannot hold); no tyre compound identity beyond a free string, so a `tyre` cannot be referenced across setups.

**Units, optionality, provenance, versioning — verdict.** Units: declared but incomplete, and defeated by unit suffixes in key names (M15). Optionality: not specified per output, so "complete" is undefined (M1) and the absence policy contradicts itself (B1). Provenance: the six source types are the best part of the document, but they cannot express *derivation chains* with a stated method (a `derived` source gives `from` but not the formula or the app version that applied it, so a value derived by an older app cannot be re-derived), cannot express attribution/licence (B7), and lack a `library` type the design already uses. Versioning: a semver string with a "refuse greater major" rule and `x_` preservation, and *nothing* about minor: a 1.1 file read by a 1.0 app has unknown non-`x_` keys and no stated outcome, which means every real field addition needs a major bump and a migration — the exact churn the corpus says users resisted (E9.2 fixtures notwithstanding). Also `schema_version` is contradicted by `physics/01` (B5).

**Would two implementations read the same file identically?** No. Independent of B3's hash problem, they would disagree on: whether an omitted `corners.right` means 50% complete or is mirrored (M2); whether a point with a single `s` may carry three coordinates of differing provenance; whether `damper_piston_holes: 3` is an int or a double (it is wrapped `{v: 3}` — is `3.0` acceptable on read?); whether `arb_setting: 0.6` is a fraction of *rate* or of *blade travel* (non-linear, so these differ by tens of percent); whether `analysis_inputs.roll_sweep_deg` overrides E3.3's fixed −3…+3 range; whether `assumptions` is trusted or recomputed; whether unknown non-`x_` keys inside `corners` are preserved or dropped.

**Fields that will bite, ranked.** `content_hash` scope/canonical form · `symmetry` + omitted right corner · `upper_link.inboard_front/inboard_rear` as a required pair · `upper_link_inner_shims` (direction) · `arb_setting` (fraction of what) + `arb.rate_at_full_stiff` ("at the link", no link geometry) · the missing `damper_curve`/piston fields (B4) · `spring.rate` in both documents · `caster` as reference-only · missing `rack` · `units` map vs unit suffixes in keys · `mass.sprung_*` optional but required by E3.2 · `tyre_radius` (model) vs `tyre.diameter` (setup) · `sources.derived.from` with no formula or app version · `assumptions` stored *and* generated · `schema_version` minor semantics · `class` enum with no per-class required set.

---

## 8. Scope: v1 is not coherent

**Incoherence, stated plainly.** 74 MUSTs across nine epics, including a physics engine (nine modules in `physics/`), a full a11y programme, an RTL-capable localisation harness, three document formats (model, setup, backup), a PDF renderer, a CSV importer, and a three-user field study — for one owner who merges every PR. §2.3 concedes the real product is one screen with three live outputs, and §10 defers effort estimates, so nothing in the document prevents the plan from scheduling all 74. The spec's own premise — "if Slice 0 is not in someone's hands early, the spec has failed" — is not encoded anywhere in §3.

**MUST that belongs in LATER.**
- **E8.9 (RTL + pseudo-locale)** — no RTL locale ships (D10). Keep string externalisation as MUST (it is cheap now, expensive later); demote RTL *layout* to SHOULD, and drop the pseudo-locale from the MUST set to a SHOULD backed by one CI job.
- **E8.11 (25 MB / 40 MB / 60 MB)** — a release-checklist measurement, not a behaviour; make it SHOULD with a CI size-diff warning, or move it wholly into the release checklist and out of §3.
- **E9.3 (store listing copy check)** — editorial process. It cannot be verified in the repo and does not belong among acceptance criteria; keep the check, move it to a checklist section with a named reviewer field.
- **E6.7 (contribution bundle)** — the review path is a repository PR against the model library (D5), so the contributor needs `git`, not an app export. This is a SHOULD that implies an in-app submission flow the spec elsewhere refuses; LATER it.
- **E4.7 (single-page print + chart labelling)** — fold the chart-labelling half into E8.7/A-04 (it is an accessibility property) and LATER the print layout.
- **E3.10** — delete (see §10).

**LATER/SHOULD that is load-bearing for the MUST set.**
- **E3.14 (single-input sensitivity)** — SHOULD, but the product's one-sentence success test ("correctly predicts the direction of a camber-link change") is a direction-of-change question, and E3.14 is the only capability that answers it numerically. Promote to MUST; it is also the cheapest possible implementation of the teaching goal.
- **E5.7 (guided first run)** — SHOULD, while **E9.5** (three unaided racers, 30 minutes) is MUST. Unassisted modelling in 30 minutes *is* the guided path. Promote to MUST.
- **E1.10 (sprung/unsprung measurement procedure)** — SHOULD, and it is the only source for the measured wheel rate that **E3.13** (MUST) compares against, and it is the documented question the corpus shows users asking for a decade (§9 item 2). Promote to MUST or demote E3.13.
- **E1.8's flag** — MUST, but its flag can never be closed without E1.10; as written it is a permanent caveat on every car.
- **E5.8 (glossary)** — SHOULD, while E5.3 (MUST) requires every technical term to be defined "somewhere in the app". The "somewhere" is the glossary. Promote to MUST or the term check has no target.

**Scope that is right and should be defended.** The offline-only constraint, the no-tyre-model decision (D3), the file-format-as-community-feature framing, and E5.6's refusal of a composite score. Those are the document's spine; do not let a reviewer talk you out of them.

---

## 9. Traceability: the table is complete and still misleading

Verified mechanically against §3: 94 rows for 94 ACs; no AC missing from the table; no dead row; every row's tag matches §3; every row has an intent and a verification token. That is better hygiene than most specs achieve. The defects are in what the columns *mean*.

1. **37 of 94 ACs are cited by no FR row** — E1.9, E1.11, E1.12, E2.3–E2.11, E3.10, E3.11, E3.14, E3.15, E4.7, E4.8, E5.4, E5.6, E5.9, E6.5–E6.8, E7.9, E7.10, E8.5, E8.11, E8.12, E9.1–E9.8. The FR list therefore describes a *smaller product* than the AC set: provenance discipline (E2.11), clean-room enforcement (E5.4), the no-score rule (E5.6), schema validation (E6.5, E6.6), the entire release epic (E9) have no capability behind them. *Fix:* add FR-19…FR-24 (validate and version documents; enforce IP cleanliness; assert no composite scores; atomic save and durable drafts; privacy statement and no-telemetry; audit and release gates) and cite them, or add a second column "Capability" generated from the same source as the AC ids.

2. **The intent column is a catch-all.** 34 of 94 rows map to **I1**, including E8.12 (atomic save) and E2.1 (model linking). I1 is "model the chassis once and keep it forever in plain text" — it does not imply atomic writes. 16 map to I6, 17 to I2. Two intents are effectively unserved at criterion level: **I3** ("show the equation behind every number") has 9 ACs but only one (E3.7) that a user would recognise as "the equation", and **I8** has exactly one (E8.13). **I7** (cross-platform, store-shippable) has 3 — E8.6, E8.9, E8.11 — all behavioural platform tests and none of them a store-shippability check despite §5.6. *Fix:* require each intent to have ≥1 AC that fails if the intent is abandoned, and name that AC as the intent's *witness* in §8.1.

3. **"Verification: M" is not verification.** 15 rows carry `M`, five of them MUST with no automated check at all (E1.5, E8.2, E8.8, E8.10, E9.3), and no M row names a procedure, a script or an evidence artifact. Under E9.8 ("no untested MUST"), these five are either tested (by a human, undocumented) or untested — the audit cannot tell. *Fix:* every `M` row must name a procedure file under `docs/specs/checks/` and a place its result is recorded; a MUST may not carry `M` alone unless the AC is inherently observational (E9.5), and then the procedure and pass rule live in the spec, not in someone's head. `U (perf)` needs a legend entry.

4. **No AC → test id.** E9.8's core claim ("no untested MUST and no orphaned test") has no artifact to check, because the arrow from AC id to test path does not exist anywhere in the document or the repo (B8). *Fix:* one annotation per test (`@SpecTest('E3.3')`), a generated `audit.json`, and E9.8 asserts the exit code.

5. **§5.3, §5.4 (A-01…A-09), §5.5, §5.7 contain requirements with no AC id** — three data-safety rules, nine accessibility rules, four localisation rules, four maintainability rules. They are invisible to the intent map, invisible to the audit, and three of the accessibility rules (A-07, A-08, A-09) exist nowhere else. *Fix:* every row in those tables gets an AC id or is deleted; §5 becomes a generated view of §3, not a parallel document.

6. **§4.4 has two orphan outputs** (Ackermann, dynamic toe) and **§2.1 promises "static camber/toe at a given roll angle"** with no criterion. Traceability runs AC→intent but never output→AC. *Fix:* add an output→AC column to §4.4 and make the audit fail an output with no AC.

7. **§8.2's summary sentence is wrong in one place** — `N2` is served by exactly one AC (E5.6) despite "every intent statement apart from I8 … served by at least two ACs". Minor, but it is the kind of claim a reviewer will check once and then distrust the rest of the table.

---

## 10. Five ACs to delete, three to add

**Delete.**

1. **E8.10 (sunlight contrast)** — untestable ("used in direct sunlight" has no protocol), duplicates E8.7c which computes the same ratios from the theme tokens in both themes. If sunlight matters, the testable version is a *luminance* test on captured frames at 100%; as written it will be marked "passed" by looking at a phone.
2. **E1.7 (byte-identical round trip)** — a serialiser property that blocks every legitimate serialiser change, is unsatisfiable alongside E7.2's unknown-key preservation, and rests on canonicalisation the spec does not define (B3). Its real content is covered by the replacement for B3 (hash stability) and E7.1 (value equality after export/import).
3. **E3.10 (1e-9 on two devices, debug and release)** — duplicates E7.1 and demands cross-platform bit-agreement from transcendental functions (M9). Keep one determinism AC at the fixture level, in E3.9's or E7.1's neighbourhood.
4. **E8.4 (data leaves only by a user action)** — the only machine-checkable content is "no INTERNET permission", which is E8.1, and the rest is unprovable from inside the app. Replace with the privacy statement AC (E8.13's fix) plus a named store data-safety artifact (M12).
5. **E5.9 (link out to the corresponding article or video)** — a LATER that ships links to the deceased author's teaching inside a clean-room successor: the single fastest way to turn a respectful project into an accusation, for zero product value. If external links are ever wanted, they belong behind a curated, licence-checked list, and the criteria belong to that list, not to an explanation screen.

**Add.**

1. **E1.13 — the draft survives the session.** *Given* a model in progress at any point in the measurement worksheet with ≥1 confirmed value, *when* the process is killed (force-stop, not backgrounded) at ten randomly chosen points in the worksheet, *then* on relaunch the same field is open, every previously confirmed value is present with its provenance, at most the value being typed at the moment of the kill is lost, and no field has been written with a default. Verified by an integration test that kills the process at each point and reads back the store. *(Why: the epic's own premise is that the hour cannot be repeated.)*

2. **E6.9 — a setup that arrives without its model.** *Given* a setup file whose `(model_id, content_hash)` resolves to nothing in the library, *when* it is imported, *then* it is installed marked "model missing", its inputs, conditions and notes are readable and read-only, no computed output is displayed, and the user is offered: import the referenced model from a file chosen in the same flow; or map the setup onto a named model revision, accepting a stated warning that outputs depend on geometry and are not comparable to the sender's (consistent with E4.3); or discard. Each path is asserted, including that mapping records `mapped_from_model_ref` so the file never claims a provenance it does not have.

3. **E7.12 — attribution survives the file.** *Given* a model file with `license`, `contributors[]` and `attribution_text`, *when* it is imported, listed, analysed, exported and re-shared, *then* every one of those keys is preserved byte-identically through each step, the library row and the analysis screen's provenance line display the licence id and the first contributor, and an export whose `attribution_text` differs from the imported one fails the test. *(Why: CC BY 4.0 in `LICENSING.md` is not satisfiable without this, and E9.6's credits screen cannot cover files that leave the device.)*
