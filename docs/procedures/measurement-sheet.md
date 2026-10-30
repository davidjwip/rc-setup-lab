# Measurement sheet — print this

Chassis: ______________________  Variant: ______________________  Class: ______________
Owner / measurer: ______________________  Date: ____________  Caliper zero check: ______ mm
Ride height (as measured): ______ mm   Tyre radius: ______ mm   Tyre pressure: ______
Battery / motor fitted? ____________________  Ambient: ______ °C  Damper oil temp: ______ °C
Plate used: ____________________  Anything not at race spec: ________________________________

---

## Stage 2 — wheelbase, track, tyre

| | x (from rear axle line) | y (from centreline) | z (above plate) |
|---|---|---|---|
| `wc` front-left | | | |
| `wc` front-right | | | |
| `wc` rear-left | | | |
| `wc` rear-right | | | |

Wheelbase = ________  Track = ________  Do `wc.z` and tyre radius agree within 0.5 mm?  ☐ yes ☐ no → cause:

---

## Stage 3 — corner hardpoints

**Measure each point twice.** If the two readings differ by more than 0.3 mm, find the cause before
moving on. Mark a point `?` if you are unsure what it is — `?` is data, a guess is not.

### Front left (`LF`)

| Point | x | y | z | 2nd check (x,y,z) |
|---|---|---|---|---|
| `lca_in_a` | | | | |
| `lca_in_b` | | | | |
| `lca_out` | | | | |
| `uca_in` | | | | |
| `uca_out` | | | | |
| `tie_in` | | | | |
| `tie_out` | | | | |
| `wc` | | | | |
| `damper_lo` | | | | |
| `damper_up` | | | | |
| `arb_drop` | | | | |

### Front right (`RF`)

| Point | x | y | z | 2nd check (x,y,z) |
|---|---|---|---|---|
| `lca_in_a` | | | | |
| `lca_in_b` | | | | |
| `lca_out` | | | | |
| `uca_in` | | | | |
| `uca_out` | | | | |
| `tie_in` | | | | |
| `tie_out` | | | | |
| `wc` | | | | |
| `damper_lo` | | | | |
| `damper_up` | | | | |
| `arb_drop` | | | | |

### Rear left (`LR`) — skip only if you accepted the rear assumptions

| Point | x | y | z | 2nd check (x,y,z) |
|---|---|---|---|---|
| `lca_in_a` | | | | |
| `lca_in_b` | | | | |
| `lca_out` | | | | |
| `uca_in` | | | | |
| `uca_out` | | | | |
| `tie_in` | | | | |
| `tie_out` | | | | |
| `wc` | | | | |
| `damper_lo` | | | | |
| `damper_up` | | | | |
| `arb_drop` | | | | |

### Rear right (`RR`)

| Point | x | y | z | 2nd check (x,y,z) |
|---|---|---|---|---|
| `lca_in_a` | | | | |
| `lca_in_b` | | | | |
| `lca_out` | | | | |
| `uca_in` | | | | |
| `uca_out` | | | | |
| `tie_in` | | | | |
| `tie_out` | | | | |
| `wc` | | | | |
| `damper_lo` | | | | |
| `damper_up` | | | | |
| `arb_drop` | | | | |

---

## Stage 4 — axle parameters

| | Front | Rear |
|---|---|---|
| `spring.rate` (N/mm, and lb/in if marked) | | |
| `arb.bar_diameter` (torsion section) | | |
| `arb.span` (bush centre to bush centre) | | |
| `arb.arm_length` (bar centre to drop-link hole) | | |
| `arb.material` | | |
| `arb.rate_at_link` (only if bench-measured) | | |

Arm length sanity: lower 25–55 mm · upper link 20–45 mm · tie rod 30–70 mm.
Do the uca and lca lines converge? ☐ yes ☐ parallel/undefined (re-check the points first)

---

## Stage 5 — damper, chassis, masses

| Damper field | Front | Rear |
|---|---|---|
| `piston_bore` (mm) | | |
| `shaft_dia` (mm) | | |
| `piston_holes` (count) | | |
| `piston_hole_dia` (pin gauge, mm) | | |
| `oil_cst` (bottle label) | | |

Chassis: material ____________  thickness ______ mm  span ______ mm  rail height ______ mm
Corner weights (if scales): FL ____  FR ____  RL ____  RR ____  g
Unsprung corner mass (if stripped): ______ g   Parts included: ____________________

CG height: **leave blank.** Inferred, not measured — the app asks for the plumb-line route separately.

---

## Stage 6 — photos

☐ LF corner  ☐ RF corner  ☐ LR corner  ☐ RR corner  ☐ chassis edge with caliper  ☐ damper internals

---

## Gaps — what could not be measured, and why

1. ______________________________________________________________________
2. ______________________________________________________________________
3. ______________________________________________________________________

Anything surprising (asymmetry, binding, a bent part, a non-standard build):
________________________________________________________________________
________________________________________________________________________
