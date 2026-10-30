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
