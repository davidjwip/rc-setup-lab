# Intent — Setup Lab

*One page. If it needs more, it is not intent yet.*

## Problem

RC car setup knowledge is trapped in folklore and in one dead Windows application.

RC Crew Chief (RC3) computed the suspension geometry and handling properties that connect a
setup change to a handling change — roll centre, camber gain, wheel rate, load-transfer
balance, damping ratio. Its author, Bob Wright, died in 2023. The app was free but closed;
his site is gone; the community survives on a re-uploaded binary that needs SQL Server
Compact 3.5 to install, does not run on modern Windows without compatibility shims, cannot
run on macOS, Linux, iOS or Android at all, and loses its chassis model library with every
site that dies.

Meanwhile the same questions get asked every week on forums and answered with "try more
camber link".

## Outcome

A free, offline-first, cross-platform setup workbench that:

1. lets a racer **model their chassis once** (hardpoints, springs, bars, dampers) and keep
   that model forever, in a plain-text format the community can version and share;
2. **calculates** the properties that matter — camber/toe gain, roll centre height and
   migration, bump steer, wheel rates, motion ratios, load-transfer split, damping ratios —
   and shows the equation behind every number;
3. **compares** two setups side by side and says what changed and why it matters;
4. **teaches**: the same concepts Bob taught, in the app, at the point where they are used;
5. runs **on a phone at the track**, with no account, no server, no subscription.

## Users

- **The club racer** (primary): 1/10 touring car or buggy, has a setup sheet and a
  setup station, wants to know what a change will do before spending a meeting on it.
- **The returning racer / autodidact**: watched Bob's videos, wants the tool that goes with
  them and a place to start.
- **The chassis nerd / contributor**: measures a new chassis and wants to add a model that
  everyone can use.

## Non-goals

- A lap-time simulator, a tyre model of record, or a driving game.
- A telemetry platform, a cloud service, an account system, or anything with a subscription.
- Windows-only, installer-only, or dependent on a proprietary database engine.
- Reproducing RC3's UI. The workflows are kept because they are good; the interface is new.

## Constraints

- **Flutter**, single codebase, targeting Android/iOS first (store-shippable), then desktop
  and web from the same source.
- **Offline by default**; any sync is a later, optional, dumb-store layer.
- **Physics is a pure Dart package** with no UI dependency, so it can be unit-tested against
  published values and reused headless.
- **No estate IP**: no decompiled code, no copied help text, no reuse of the RC3 name.
- Zero running cost: static hosting only if anything is hosted at all.

## Open questions

1. **Name.** "Setup Lab" is a working title, chosen to avoid colliding with Jim Britton's
   *CrewChief* (sim racing) and with Bob's own marks. Rename is a one-line change until
   the first release.
2. **Model data.** Will the family gift the RC3 chassis/damper/motor databases? If not, the
   library starts from community re-measurements.
3. **Depth of the first release.** Geometry + balance only (fast, provable, useful), or wait
   for damper and motor-dyno parity with RC3?
4. **Tyre model.** RC3 deliberately had none. Do we ship a crude one (grip vs load and slip
   angle) with a loud health warning, or stay honest and geometry-only for v1?

## Success test

A club racer with a phone, a setup station and one caliper session can model their car in
under 30 minutes, and correctly predict the direction of a camber-link or roll-centre change
before they make it — on a device that did not need installing.
