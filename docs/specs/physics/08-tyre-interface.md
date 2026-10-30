# 08 — Tyre interface (v1: deliberately absent)

Build order: 8 of 9. Nothing depends on it.

---

## 1. Purpose

This module exists to answer one question and one only: **does v1 ship a grip model?** The answer is
no, and this file records why, what the app is allowed to say instead, and what would have to be
true before the answer changes. It is a scope decision written down so that it cannot be quietly
reversed by someone adding "grip" to a chart.

The intent document already flags this as an open question. This is the answer, and it is a
recommendation to Dave for approval rather than a physics derivation.

---

## 2. What a grip model would need

A lateral force model good enough to turn load transfer and camber into a handling prediction needs
all of the following, and none of them exists for RC tyres in a form we can cite.

### 2.1 Load sensitivity

Grip per unit load falls as load rises — the single most important nonlinearity in load transfer:

```
µ(F_z) = µ₀·[1 − k_z·(F_z/F_z0 − 1)]         k_z ≈ 0.1 … 0.3 for a road tyre   (8.1)
F_y,max = µ(F_z)·F_z                                                            (8.2)
```

`µ₀` and `k_z` are **fit parameters**, not constants. Without (8.1), module 6's balance number can
only say "more load moved to the front"; with it, the app could say "and the front axle lost 4% of
its grip". The gap between those two sentences is the whole value of a tyre model, and it is a gap
we cannot cross without data.

### 2.2 Slip angle

The standard single-formula description (Pacejka's "magic formula", *Tyre and Vehicle Dynamics*):

```
F_y = D·sin( C·atan[ B·α − E·(B·α − atan(B·α)) ] )                             (8.3)
D = µ(F_z)·F_z,  B = stiffness/(C·D),  C ≈ 1.3,  E ≈ −0.5 … 1
```

Four coefficients per tyre, fitted to force-and-moment rig data at several loads and cambers. RC
tyres have no such published data. Anything we fitted ourselves from a car on a track would be
fitting to lap times, which conflates tyre, chassis, driver and surface — the thing the intent
document explicitly rules out ("not a lap-time simulator").

### 2.3 Camber thrust and camber sensitivity

A cambered tyre generates lateral force at zero slip, and its peak lateral force depends on camber
in a way that has an optimum (typically 2–4° for a radial car tyre, and unknown for a foam or rubber
RC tyre whose carcass is much stiffer relative to its size):

```
F_y(γ) = F_y(0)·[1 − k_γ·(γ − γ_opt)²]   (a shape, not a law)                  (8.4)
```

Module 2 computes camber versus the road precisely. Without (8.4) the app can show the camber curve
but cannot say whether 3° is too much — and "is 3° too much" is the question every racer actually
has.

### 2.4 Surface and scale effects

An RC tyre on asphalt sees aggregate particles that are a substantial fraction of its contact patch,
operates at a much higher frequency of load variation, and runs at a carcass deflection that is a
large fraction of its section height. Full-size tyre models are fitted at 1:1 scale and do not
transfer. This is not a detail — it is the reason a scaled tyre model is not simply "the car model
divided by 10".

### 2.5 Transient behaviour

Relaxation length:

```
σ·dF_y/ds + F_y = F_y,steady(α),      s = distance travelled                     (8.5)
```

This is the one place where the scale argument works *for* a simple model rather than against it: a
1/10 tyre's relaxation length is a few millimetres, so at 10 m/s the lag time constant is under a
millisecond — far faster than any body motion at 10 Hz. A quasi-static force model is therefore
defensible at RC scale, unlike at 1:1 where σ is ~0.5 m and the lag matters. What does *not* scale
away is thermal and wear behaviour: a 1/10 tyre's working temperature changes over a run in a way
that changes grip by more than any setup change being modelled.

### 2.6 What we would need to measure

| Quantity | How | Cost |
|---|---|---|
| µ vs F_z at 2–3 cambers | tyre test rig, or a instrumented single-wheel trailer | £10k+ / a favour |
| Slip stiffness, peak slip angle | same rig | with the above |
| Camber sensitivity | same rig | with the above |
| Temperature and wear sensitivity | repeated runs | time |

None of this is available to a free offline app, and the community has not published it (the corpus
contains no tyre data at all — see `docs/research/README.md`).

---

## 3. v1 decision

**Ship no tyre model.** The physics package exposes no grip function, no friction coefficient, no
"predicted understeer" verdict, and no number with units of force that depends on a tyre
coefficient. Module 6 stops at load transfer, which is a mechanics result and is honest.

### 3.1 What the app may say without a tyre model

| Statement | Basis | Allowed? |
|---|---|---|
| "This moves 3.2 % more load transfer to the front" | module 6 | yes |
| "This plate moves the balance two points rearward but not the roll centre" | module 10 | yes — it is a roll-stiffness statement, not a grip one |
| "ζ is 0.26 here, band 0.18–0.33, estimated" | module 7 | yes, with the band and the badge |
| "Thicker oil will raise your damping ratio" | module 7 §9 | yes — a direction, and the model is monotone in it |
| "Higher front share of load transfer usually means more understeer, all else equal" | textbook | yes, as teaching copy, clearly conditional |
| "Your outer front wheel loses 0.84° of camber per degree of roll" | module 2 | yes |
| "Your camber gain is 0.11°/mm, so at 5 mm of bump you gain 0.5°" | module 2 | yes |
| "This setup will understeer less" | needs a tyre | **no** |
| "Grip is up 4%" | needs a tyre | **no** |
| "This is the faster setup" | needs a lap sim | **no** |

The rule to implement: every string in the UI that contains "grip", "understeer", "oversteer",
"traction" or "faster" must be attached to a `conditional` qualifier or removed. A grep test in CI
can enforce it (`test/no_grip_claims_test.dart` over the UI string tables).

### 3.2 What ships as the seam

So that a future version can add a tyre model without refactoring, the package defines the
interface and nothing else:

```dart
/// Models the tyre's contribution to handling. v1 has no implementation.
abstract class TyreModel {
  /// Lateral force [N] for a vertical load [N] and slip angle [rad].
  double lateralForce({required double fz, required double alpha});
  bool get isCalibrated;
}
```

`setup_physics` returns `TyreModel?` as `null` in v1, and every consumer must handle null by
withholding the derived claim. A test asserts that `null` is the only value the factory can return
until a calibrated model exists.

---

## 4. Recommendation and reasoning

Recommend: **no tyre model in v1, and no "illustrative" grip curve either.**

The case for shipping a rough model is that a wrong number is more useful than no number, because
racers already reason with folklore and a model would at least be consistent folklore. The case
against, which is stronger here:

1. **The app's differentiator is showing the equation behind the number.** A fitted grip curve has
   no equation the user can check — the coefficients are the model. That breaks the product's
   central promise in the one place where users would most want to trust it.
2. **Review rule 1 forbids it.** Every coefficient would be `assumed` with no source, which is the
   failure mode the rule exists to prevent.
3. **The predecessor did not have one.** Its credibility came partly from stopping at mechanics.
   Being the successor that added an unverifiable grip number would be a downgrade.
4. **A wrong direction is worse than no direction.** Load sensitivity is second-order; a model
   without it (the "illustrative" option) would systematically say "stiffer front bar = more
   understeer, always", which is wrong often enough to mislead.

If a rough model is ever wanted, the honest form is a **user-supplied** one: the racer enters peak
grip and peak slip angle for their tyre from a manufacturer's sheet, the app plots the load-transfer
consequences under that model, and the plot is labelled with the user's own coefficients. That is a
v2 feature and it keeps the provenance honest, because the numbers are the user's, not ours.

---

## 5. Degenerate / edge cases

Not applicable in v1 — there is no computation. The only testable behaviour is the *absence*:

| Condition | Behaviour |
|---|---|
| any caller asks for lateral force | `UnsupportedError` or `null`, never 0 — a zero force is a claim |
| UI wants to render a grip-sensitive verdict | the verdict must be absent from the string table |
| a future `TyreModel` is supplied but `isCalibrated == false` | consumers must treat it as absent |

---

## 6. Golden test cases

These are structural, not numeric.

| ID | Input | Expected | Origin |
|---|---|---|---|
| G08.1 | `PhysicsPackage.tyreModel` | returns `null` | spec §3.2 |
| G08.2 | any physics result | no field with units of force depends on a tyre coefficient; grep of the public API for `mu`, `grip`, `friction` returns only the `TyreModel` interface | spec §3 |
| G08.3 | UI string tables | no string containing "grip", "understeer", "oversteer", "traction" without a `conditional` qualifier | spec §3.1 |
| G08.4 | `TyreModel` with `isCalibrated = false` | treated as absent by every consumer | spec §5 |

---

## 7. If this decision is reversed

The first thing to write is not the model. It is a one-page document answering: which tyre, measured
by whom, at what load and camber, on what surface, with what repeatability? Without that sentence the
reversal is a regression, not a feature. Note it in the changelog with the data source, per review
rule 1.
