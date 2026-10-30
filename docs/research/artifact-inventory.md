# Artifact inventory — RC Crew Chief V4.3.2 (from the outside)

What the shipped product *is*, deduced from its file list, its public documentation and the
community's install reports. Written before we designed anything, because an installable file
list is a free architecture document — and because the successor needs to know which features
were load-bearing and which were merely present.

**No binary was decompiled, disassembled or executed to produce this.** Sources: the public
re-upload's file tree (`github.com/rcstar6696/RCCrewChief_ReUpload`, tag V4.3.2), the vendor
listing on Softpedia (v4.3.2.12, March 2022, 459 KB executable, publisher *Wright Engineering
& Design*), and the RC Tech support thread (`docs/research/forum/rctech-thread.md`).

## What ships

| Item | Reading |
|---|---|
| `RCCrewChief V4.3.exe`, `.exe.config`, `.manifest`, `.cdf-ms` | A .NET Framework WinForms application. `.cdf-ms` files are **ClickOnce** manifests — the installer downloaded its payload at run time. That is the mechanism that killed the product: when the site went dark, the installer kept "working" and installed nothing. |
| `Microsoft.VisualBasic.PowerPacks.Vs.dll` (+ manifest) | Visual Basic .NET, using the classic VB PowerPacks line/shape controls — i.e. the suspension diagrams are *drawn as vector shapes on a form*, not rendered from a graphics engine. |
| `x86/`, `AMD64/` | Two architectures, i.e. a native or mixed-mode dependency (SQL Server Compact) rather than pure managed code. |
| `RCCarV2.sdf` | SQL Server **Compact** database — the car/chassis model library. |
| `DamperList.sdf` | Damper (shock) model library. |
| `Dyno.sdf` | Motor dyno models. |
| `NitroMotor.sdf` | Nitro engine models — a whole propulsion domain, separate from electric. |
| `Dynamic.sdf` | Vehicle-dynamics data (mass, CG, load transfer working data). |
| `Units.sdf` | Unit conversions and physical constants, as data. |
| `HelpFiles/` | The feature inventory in the author's own words. |
| `Graphics/DCAD/` | Vector assets for the geometry drawings (double-wishbone / camber-link views). |
| `Icon.ico`, `RCCCicon.ico`, `RCCCIcon4.ico` | Brand assets — estate property, explicitly not reused. |

## What that tells us about the domain model

One database per concept is the whole design in miniature:

- **Cars/chassis** are *data*, not code — a community-contributed library, exactly as we plan.
- **Dampers** are a first-class library, separate from cars: a shock model is portable across
  chassis, and Bob validated his damper model against dyno data (his own videos say so).
- **Motors and nitro engines** are separate libraries with their own curves — the dyno module was
  a parallel product, not an afterthought.
- **Units as data** implies a display-unit layer over SI-ish internals — the same split we chose.
- **Dynamics** as its own store suggests persistent derived state (corner weights, load transfer),
  not pure on-the-fly calculation.

## What it needed to run, and why that killed it

From the support thread: SQL Server Compact 3.5 SP2 (x86 **and** x64, installed before first run),
.NET Framework, administrator rights, and — after the site died — Windows 8 compatibility mode on
Windows 11. The community's workaround was a repackaged single executable. Three years of posts are
people helping each other install a calculator.

**Successor rule:** no installer-hosted dependencies, no server, no runtime download, no
architecture-specific native dependency. A single artifact that runs on a phone.

## Feature inventory implied by the artifact

- Setup entry and storage, per car, with a printable/exportable setup sheet
- Suspension geometry modelling from measured hardpoints (double-wishbone and camber-link views in `Graphics/DCAD`)
- Handling analysis: camber change, weight transfer, roll centre, roll stiffness, damping
- Damper modelling and comparison (a library of dampers, not a single curve)
- Motor dyno modelling (electric) and nitro engine modelling
- Unit conversion across the whole app
- Import/export of models and setups between users

## What the corpus says was missing

Straight from the thread, in users' words: no tyre model, no track-surface or temperature inputs,
no diff-height effect, no multi-level shock mounting points, droop-stop modelling arrived late, and
"print your setup" took a year of asking. These are the successor's differentiators, in that order.

## Counterpart check

A commercial competitor exists (*The Digital Race Engineer*), positioned as a modern web app. The
successor's differentiator is therefore not "prettier" — it is **free, offline, community-owned
model data, and the maths shown**. That is the claim the app must earn in every screen.
