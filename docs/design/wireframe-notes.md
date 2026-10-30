# Wireframe notes

Six self-contained HTML files in `wireframes/`, each fixed at **390 × 844** and laid out for a phone. Open them directly from disk — no server, no build step, no network. `wireframes/index.html` lists all six.

Each file has an annotation rail to the right of the phone (hidden under 780 px) with a theme switch and a state toggle. Press **T** anywhere to flip dark ↔ light. The rail also links to `design-notes.html`, which renders the palette with its computed contrast ratios.

Values in the wireframes are illustrative but internally consistent: every equation shown on Analysis and Learn evaluates to the number displayed beside it, so the maths panels can be checked rather than trusted.

---

## A — Garage (`garage.html`)

The landing surface answers one question before the user has scrolled: which car am I working on. Completeness is the second read, because an unmeasured chassis silently ruins every number downstream — so an incomplete car is a first-class card with an honest 31 / 42, not an error toast. Cards carry only what a racer would say out loud: class, when it last ran, and the one number that predicts the car's behaviour. The empty state explains the model-once premise instead of apologising for having no data. "Add a car" sits in a sticky bottom bar so the primary action is under the thumb.

**States to try:** "Empty state" in the rail.

## B — Car model / hardpoints (`hardpoints.html`)

This is the slowest, most error-prone task in the app, so it is the calmest screen. A pinned front-view schematic stays at the top while the fields scroll under it; the row being edited lights its own dot on the drawing, so the value and the part are never separated. Hardpoints are 3D, but the field labels are the three directions a person actually measures — forward from the axle, out from the centreline, up from the floor — with X/Y/Z as secondary notation. One corner is measured and mirrored; progress is stated honestly with a time estimate, because the user needs to know whether to start now or after the next heat.

**States to try:** tap any row to expand it and watch the diagram follow. Row F is present but its dot sits under the tower, which is where the "show me where" copy earns its keep.

## C — Setup editor (`setup-editor.html`)

Four groups, one gesture, no nested navigation. The number is the control: drag the rail or tap the number to type, and there is no duplicate stepper beside the slider. Every rate row prints its consequence underneath — wheel rate, motion ratio, share of roll stiffness — because that is the whole point of the app: the change and its meaning in one glance. Discrete values (oil, piston holes) are chips; continuous values are sliders; the two are never mixed. The save bar states how many changes are pending, so nothing is quietly written over a baseline setup.

**States to try:** drag either spring slider (value, delta and wheel rate all update live), and switch to the Alignment tab for the stepper pattern.

## D — Analysis (`analysis.html`)

The payoff screen: seven properties, front and rear, against a baseline. Load transfer leads, because the split of load transfer is the property that maps most directly onto what the car does — understeer or oversteer — and a racer reads it before any geometry number. Every card below is the same anatomy: label, a `FRONT` and a `REAR` column at equal weight, a delta against the last *saved* setup on each, and a disclosure that opens the equation, its substitution and one sentence of meaning. Nothing routes to another screen to be explained, and there is no eighth card — motion ratio, ride frequency and migration live inside the card they belong to.

**States to try:** open the roll-centre card, then "Missing input" (two cards read *Not computable yet*, header drops to 5 of 7) and "Parallel links" (*Undefined for this geometry*). Only the affected column changes; the loading of the rest of the model is untouched.

## E — Compare (`compare.html`)

A reading instrument, not a diff viewer. Two setup cards establish what is being compared and which one is unsaved; "what changed" lists the three or four parameters that actually moved; the table gives aligned digits down a column. Delta is always the third column, never a colour washed over the value, and it is neutral — up is not better. Unchanged rows are available but behind a "changed only" filter, so nothing is silently hidden. The screen ends in a sentence, because three mechanical changes should resolve into one handling consequence the user can act on.

**States to try:** the swap icon (A and B exchange and every delta flips sign); "Changed only" to reveal the unchanged rows.

## F — Learn (`learn.html`)

One concept, one diagram, one equation, and the user's own number at the end of it. The diagram carries the argument: the same construction in two states, so the reader sees where the roll centre comes from and what happens when the links stop converging. Prose is set at a reading size and measure — deliberately different typography from the dashboards — and the equation block is monospaced with a symbol legend underneath rather than a wall of algebra. The callout ties the concept to this car's actual 22 mm, so the page ends inside the app rather than in theory.

**States to try:** "Links parallel" (in the figure and in the rail) — the construction flattens onto the ground and the roll centre stops following ride height.

---

## What these wireframes deliberately do not do

- **No Flutter code.** Layout, tokens and component behaviour are specified in `docs/design/design-system.md`; these files are the visual reference, not the implementation.
- **No real data layer.** Numbers are chosen so the equations check out, not because a model produced them.
- **No RC3 resemblance.** No borrowed screens, wording, help text or icons. The vocabulary (hardpoint, droop, roll centre, motion ratio, load-transfer split) is the community's, not any one application's.
- **No responsive web design.** The phone is the product. Above 780 px the annotation rail appears beside the frame; below it, the frame fills the viewport.
