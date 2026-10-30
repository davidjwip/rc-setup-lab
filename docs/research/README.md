# Research corpus — provenance and how to use it

Source material for Setup Lab. **Never edit these files**; they are evidence, not drafts.
Ancient, partial and sometimes wrong — the app is built from published physics, and this
corpus tells us what the community actually asked RC3 to do and what it could not do.

| Path | What it is | Provenance |
|---|---|---|
| `forum/rctech-thread.md` | 494 posts from the RC Tech thread "RC Crew Chief Software" (2012–2023), 36 of ~59 pages | Wayback Machine snapshots, harvested 2026-10-30. Page blocks are labelled with their snapshot date. Pages 15–27, 33, 47–49, 51, 53–60 are missing from the archive (Cloudflare blocks live fetches). |
| `handbook/science-of-setup-index.md` | Bob Wright's *Science of Setup* article index (8 chapters + shocks ×3), as preserved on petitrc.com | Copied 2026-10-30. Written by Bob Wright; quoted, not republished. |
| `transcripts/*.txt` | Auto-caption transcripts of Bob's YouTube channel (@RCCrewChief), 56 videos: *Science of Setup* eps 1–10, *Chassis Dyno* eps 1–7, RC3 walkthroughs, MTC2 roll-centre testing | yt-dlp auto-captions, 2026-10-30. Machine transcription: expect misheard terms ("roll center" → "roll centre"/"rolls center", "camber" → "camber"/"camber"). Never quote a number from these without checking it against the forum or the handbook. |

## What the corpus is authoritative for

- **Vocabulary and workflow.** What a racer expects to type in, in what order, and what they
  call it. This is what makes the app feel familiar on the first launch.
- **The list of properties RC3 computed** and the gaps users asked for and did not get:
  no tyre model, no diff-height effect, no track-surface inputs, no dropp-stop modelling
  (added late), no multi-level shock mounts.
- **Failure modes worth designing out:** installer dependency on SQL Server Compact 3.5,
  lost model library, Windows-only, no import/export of other people's setups.

## What it is *not* authoritative for

- Physics. Numbers in these transcripts are demo values with unknown geometry. Equations
  come from published vehicle dynamics; values come from our own worked examples.
- Any wording we ship. Do not copy sentences from the corpus into the app, the store listing
  or the docs. Paraphrase, and cite.
