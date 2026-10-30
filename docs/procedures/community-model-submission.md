# Community model submission

A chassis model is the most valuable thing anyone can give this project. It cannot be derived from
physics — only from a car and calipers — and unlike code it does not go stale. The library is the part
of RC3 that was lost when a website died, and the whole point of this project is that it never happens
again.

**Submitting takes about 90 minutes with the car and calipers, and one pull request.** The procedure
is [measurement-session.md](measurement-session.md).

---

## What a submission contains

| Item | Required | Why |
|---|---|---|
| A model file (`model.json`) that validates against the schema | yes | the app must be able to open it |
| `source` for every measured value — "caliper, 2026-11-02", "manufacturer drawing", "estimate" | yes | a number without a source is refused by the schema, not by a reviewer |
| The chassis name, class (1/10 TC, FWD, buggy…), and the version/variant modelled | yes | "Xray X4" is not a model; "X4 '24, kit build, aluminium bulkheads" is |
| Photos: one per corner from outside and above, plus the chassis edge with the caliper on it | yes | what makes a model reviewable by someone who has never seen the car |
| Ride height, tyre radius and tyre pressure at the time of measurement | yes | without these the numbers are not reproducible |
| What you could not measure, and why | yes | three honest gaps beat three invented numbers |
| Corner weights (four scales) | optional | replaces two assumptions and tightens the balance band |
| Bench ARB rate, if you have measured one | optional | overrides the whole torsion-bar estimate |

## The review bar

A model is merged when:

1. **It validates.** The schema check is the first gate and it is not negotiable.
2. **Every required point is present** for its `arm_type`, with a source.
3. **The symmetry check passes or is explained.** A car that measures asymmetric is fine — it just
   has to say so, because the app then computes both sides separately.
4. **A second person re-enters three random hardpoints** from the photos and lands within 0.5 mm. This
   catches transcription errors, which are the most common defect and the hardest to see.
5. **The plausibility checks pass** or are explained in the PR (link length, track, wheelbase, tyre
   radius, CG height).

Anything less is a draft, and drafts live in the issue until they are finished. A model nobody can
verify is worse than a model that does not exist: it teaches people to trust numbers with no basis.

## How to submit

- **Fastest:** open a "Chassis model submission" issue using the form. Attach the JSON and photos.
  You do not need to know git.
- **If you do know git:** fork, add `models/<manufacturer>/<chassis>/<variant>.json`, and open a pull
  request. The same review bar applies; the review just happens on the diff.

Either way, the reviewer is named in the model file's `contributors[]`, and your name travels with
the file forever — through the app, through exports, and through anyone else's re-share.

## Licence and credit

Models are published **CC BY 4.0**. You keep the credit; anyone may use the model, including
commercially, as long as they say where it came from. The `contributors[]` and `attribution_text`
fields are hashed into the file's identity, so a re-share that strips your name produces a different
file and is refused at import.

By submitting you confirm: you measured this car yourself or have permission to publish these
numbers, and the model contains no manufacturer's confidential data and no material copied from
RC Crew Chief or any other tool.

## What we will not accept

- A model with no sources.
- A model derived from another app's database. RC Crew Chief's model library belongs to Bob Wright's
  estate; if the family gifts it, it arrives through a different route with its own attribution.
- A model for a car you do not own or have not measured, assembled from forum posts. Half-remembered
  numbers are how a library becomes folklore.
