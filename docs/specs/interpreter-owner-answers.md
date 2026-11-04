## Owner answers, 2026-10-30

Recorded from Dave. These are now requirements, not questions.

**1. Vocabulary** — understeer / oversteer. Phases: entry / mid / exit.

**2. Conditions on a sheet** — all optional, and they matter: surface (carpet / asphalt / other),
temperature, humidity, plus free room for tyres and motor. A diff that spans different conditions
must say so loudly, because the difference in the car may be the difference in the day.

**3. Grip** — "Grip can't be measured imo — inferred." Agreed, and it is now a rule: grip is never
computed, never a number, and never presented as measurement. It carries its own tier
(`inferred`) with the basis named ("front roll-stiffness share rose 8%, so the front axle is more
heavily loaded and the car will likely understeer mid-corner, all else equal").

**Consequence for the interpreter spec:** the Firm tier is geometry and rates only. Understeer and
oversteer statements live in Inferred, with `all else equal` printed. Entry/exit asymmetry stays
Speculative until a measured damper model exists — which is exactly what D-13 is building toward.

## Tier contract (v1 implementation, 2026-11-04)

The web interpreter renders **three** tiers, and this list is the contract the UI test counts:

1. **mechanism** — arithmetic from the measured model (springs, bars, roll-centre height, ride
   height). The Firm tier.
2. **direction** — steady-state reasoning from those numbers. The Inferred tier; a claim about
   understeer or oversteer belongs here and says "all else equal".
3. **illustrative** — an entry/exit effect that needs a transient model the app does not hold. The
   Speculative tier. Damping-rate claims at entry and exit use it, and it never carries a number.

A rule with no tier does not ship. The tier is rendered as a word and a border style, never as a
colour or a quality score.
