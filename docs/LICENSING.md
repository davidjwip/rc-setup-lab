# Licensing

Setup Lab is free and open. The split exists because the three kinds of content have
different provenance.

| Content | Licence | Why |
|---|---|---|
| Code (`app/`, `scripts/`) | **MIT** | Maximum reuse; no reason to restrict a calculator. |
| Documentation, design, wireframes (`docs/`, `wireframes/`) | **CC BY 4.0** | Share and adapt with attribution. |
| Chassis / damper / motor model data (`app/assets/models/`) | **CC BY 4.0**, contributor-attributed | Data outlives code; attribution travels with it. |

## Provenance rules for model data

- Every model file carries `"source"` per measurement: `"measured"`, `"manufacturer"`, or a
  named third party, with a URL or document reference where one exists.
- A model derived from RC Crew Chief's published model list is credited to Bob Wright and the
  original contributor, and is only included if the family's permission covers it.
- No RC3 `.sdf` database file is redistributed in this repository.

## What is explicitly not licensed here

"RC Crew Chief", "RC3", the RC3 iconography and its help text are the work of Bob Wright and
remain with his estate. This project claims none of them.
