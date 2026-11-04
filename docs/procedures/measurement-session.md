# Measurement session — one touring car, one afternoon

For Dave, on a real chassis. Everything here produces values in the units the file wants
(**millimetres, from the top surface of the chassis plate at the rear axle centre**, ISO 8855: x
forward, y left, z up — ruling R-1). Record the plate thickness and the ride height under the bottom
of the plate; together they derive the ground plane. Print `measurement-sheet.md` and fill it in by hand as you go; transcribe once at the end.

Expect **70–90 minutes** for a whole car, **25 minutes** for the front axle only. The front axle is
where the numbers a racer argues about come from (roll centre, camber gain, bump steer), so if time
is short, stop after stage 4 and you still have a usable model.

---

## 0. Tools

| Needed | Why |
|---|---|
| Digital calipers, 150 mm, 0.01 mm resolution | every hardpoint |
| Steel rule, 300 mm | offsets the calipers can't reach |
| Flat plate — granite, glass, or a checked setup board | z datum; a warped bench silently biases every vertical number by its warp |
| Height gauge or a depth bar on the calipers | wheel-centre and ball-joint heights from the plate |
| Two straight edges or a laser level | projecting a point onto the plate and onto the centreline |
| Plumb bob + thread | marking the rear axle line and the car centreline on the plate |
| Marker tape | labelling the plate: RL, RR, FL, FR axes |
| Pin gauges, 0.4–1.2 mm (or the maker's drawing) | piston hole diameter — otherwise ζ refuses |
| Kitchen scales, 0.1 g | unsprung mass, if you strip a corner |
| Phone | one photo per corner, see stage 6 |
| This sheet, printed | do not type while measuring; you will transpose digits |

**Calipers zero check first**, and write the reading down even if it is 0.00. A 0.2 mm bias is 4% of
camber gain and, once the session is over, invisible.

---

## 1. Set the car up as raced (10 min)

1. Tyres at race pressure, or the pressure you will model. Write it down — it changes tyre radius.
2. Battery, motor, ESC and body fitted, or note exactly what is missing and its mass.
3. Ride height set to your race setting with the car on the plate. Record it as `ride_height`.
4. Shocks at ride height, droop set as raced. Do not move them during the session.
5. Mark the plate: rear axle line (plumb from the rear wheel centres, both sides), car centreline
   (midway between the wheel centre marks), and the front axle line.

**What this gives you:** the datum every coordinate is measured from. If you skip it, everything
downstream is shifted and nothing looks obviously wrong.

---

## 2. Wheelbase, track, tyre (5 min)

| Field | How | Sanity check |
|---|---|---|
| `wc` front/rear, x | distance from the rear axle line along the plate | wheelbase 240–270 mm on a 1/10 TC |
| `wc` y | distance from the centreline to the wheel centre mark | track 160–180 mm |
| `wc` z | wheel centre height above the plate | equals tyre radius if the tyre is round — a 0.5 mm mismatch means the tyre is loaded or flat-spotted |
| `tyre_radius` | measured, not from the maker | 30–33 mm |

If `wc.z` and `tyre_radius` disagree by more than 0.5 mm, stop and find out why. That disagreement
is the car telling you the corner is preloaded.

---

## 3. Front corner hardpoints (25 min, both sides)

Measure **both sides**, even if the car should be symmetric. Asymmetry is data — it is how a tweaked
car gets modelled, and how a bent component shows up. Measure each point **twice, from two
directions** (e.g. x once with calipers off the hinge block and once off the plate mark); if the two
readings differ by more than 0.3 mm, find the cause before moving on.

For each corner (`LF`, `RF`, `LR`, `RR`) record x, y, z of:

| Point | What it actually is | Measuring note |
|---|---|---|
| `lca_in_a`, `lca_in_b` | the two ends of the lower-arm **hinge axis** — pivot block centres | the axis, not the arm; if there is one pin, the two ends of the pin |
| `lca_out` | **centre** of the lower pivot ball | not the top of the ball stud, not the moulding line |
| `uca_in` | centre of the upper camber-link **inner ball stud** | on a hinge-arm car this is a single link, not an A-arm |
| `uca_out` | centre of the upper ball stud on the carrier | |
| `tie_in` | inner tie-rod ball (rack end) | usually needs the top deck or bumper off — this is the one that decides whether bump steer ships |
| `tie_out` | outer tie-rod ball on the steering arm | |
| `wc` | wheel centre | mark it with a plumb line onto the plate first |
| `damper_lo` | lower damper eye centre | |
| `damper_up` | upper damper eye centre | with the car at ride height, not hanging |
| `arb_drop` | ARB drop-link attachment on the lower arm | only if a bar is fitted |

**Sanity checks as you go** — if one fails, the point is wrong, not the car:

- lower arm length (`lca_in_a`→`lca_out`) between **25 and 55 mm**; upper link **20–45 mm**; tie rod
  **30–70 mm**
- the uca line and the lca line must converge somewhere sensible. If they are parallel to within
  0.5°, the roll centre is undefined at that ride height — worth knowing, and you should re-check the
  points before blaming the geometry
- `lca_in_a` and `lca_in_b` must differ: if they are within 0.001 mm the hinge axis has no direction
  and the file will be rejected

---

## 4. Front axle parameters (10 min)

| Field | How | Note |
|---|---|---|
| `spring.rate` | printed on the spring, or a bench check | N/mm; if the maker quotes lb/in, convert and note both |
| `arb.bar_diameter` | calipers across the **torsion section**, not the arm | 0 = no bar |
| `arb.span` | between the bush centres, along the bar | the judgement call — write down how you defined it |
| `arb.arm_length` | from bar centre to the drop-link hole in use | |
| `arb.material` | steel, titanium, or "unknown" | unknown = the default is flagged in the file |
| `arb.rate_at_link` | only if you have a bench measurement | overrides the geometry path entirely — prefer it if you have it |

Repeat stages 3–4 for the **rear axle** if you have time (another 30 min). The reference rear corner
is modelled, so a measured session replaces the modelled damper mount and the modelled roll-centre
height, and turns the rear installation ratio from derived-from-a-model into measured.

---

## 5. Damper, chassis, masses (20 min)

**Per corner, from one damper** (they are usually identical; note it if not):

| Field | How |
|---|---|
| `damper.piston_bore` | calipers inside the body |
| `damper.shaft_dia` | calipers on the shaft |
| `damper.piston_holes` | count, with the damper open |
| `damper.piston_hole_dia` | pin gauge, or the maker's drawing, or leave blank — ζ then refuses, which is honest |
| `damper.oil_cst` | printed on the bottle; if you changed oil, say what is in it |

Record oil temperature and ambient at the time — a value measured at 12 °C is not the value on a
30 °C afternoon.

**Chassis:**

| Field | How |
|---|---|
| `chassis.material` | carbon / aluminium / steel / other |
| `chassis.thickness` | calipers, at a clean edge away from a cut-out |
| `chassis.span` | across the widest part of the plate |
| `chassis.rail_height` | side-rail or top-deck standoff, if fitted |

**Masses:** corner weights on scales if you have them, otherwise a kitchen scale for one corner's
unsprung parts (hub, carrier, axle, wheel, tyre) with everything else off. Leave `cg.height` blank —
it is inferred, not measured, and the app asks for the plumb-line route separately.

---

## 6. Photos (10 min)

One photo per corner, from outside and slightly above, with the plate marks visible. Then one of the
chassis edge with the caliper jaws on it, and one of the damper internals if you opened a damper.
Photos are what makes a model reviewable by someone who has never seen the car — the review bar for
community models requires them.

---

## 7. What to do with the numbers

1. Transcribe the sheet into a model file (the schema lives in `docs/specs/fields.yaml`; a template
   ships with the app). Every value carries its source: `caliper 2026-11-02`.
2. Run the app's own loader — it will warn on any point whose value looks implausible for a 1/10 car
   (link 5–120 mm, track 100–350 mm, wheelbase 150–400 mm). A warning is nearly always a unit slip or
   a mis-marked point, not an unusual car.
3. Record what you could not measure, and why. A model with three known gaps is worth more than a
   model with three invented numbers.
4. Bring it back here; the golden cases get re-derived against a real car and the reference-car
   assumptions get replaced one at a time.

**The assumptions this session is meant to kill:** the modelled rear damper mount (the derived 0.689
installation ratio), the modelled rear roll-centre height (17.9 mm), and CG height (assumed 28.0 mm
against a component estimate of 18.7 mm). Any one of them measured properly is worth more than
another review round.
