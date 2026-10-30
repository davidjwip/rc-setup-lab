#!/usr/bin/env python3
"""Convert yt-dlp .vtt auto-caption files into clean plain text.

De-duplicates the rolling caption lines that YouTube auto-subs emit, strips cue
timing, and writes <name>.txt next to the .vtt.  Idempotent.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "docs" / "research" / "transcripts"
CUE = re.compile(r"^\d{2}:\d{2}:\d{2}\.\d{3} --> ")
TAGS = re.compile(r"<[^>]+>")
STAMP = re.compile(r"^\d{2}:\d{2}:\d{2}\.\d{3}\s*$")


def clean(vtt: Path) -> str:
    lines, out = vtt.read_text(encoding="utf-8", errors="ignore").splitlines(), []
    for line in lines:
        if not line.strip() or line.startswith(("WEBVTT", "Kind:", "Language:", "NOTE")):
            continue
        if CUE.match(line) or STAMP.match(line) or line.strip().isdigit():
            continue
        text = TAGS.sub("", line).strip()
        if not text:
            continue
        # rolling captions repeat the previous line; keep only new tail text
        if out and (text == out[-1] or text.startswith(out[-1])):
            out[-1] = text
        elif out and out[-1].endswith(text):
            continue
        else:
            out.append(text)
    # join into paragraphs, ending a paragraph on sentence-final punctuation
    paras, buf = [], []
    for line in out:
        buf.append(line)
        if line.endswith((".", "?", "!")) and len(" ".join(buf)) > 320:
            paras.append(" ".join(buf))
            buf = []
    if buf:
        paras.append(" ".join(buf))
    return "\n\n".join(paras)


def main() -> int:
    n = 0
    for vtt in sorted(ROOT.glob("*.en.vtt")):
        if vtt.name.endswith(".en-orig.vtt"):
            continue
        txt = vtt.with_suffix("").with_suffix(".txt")
        txt.write_text(clean(vtt), encoding="utf-8")
        n += 1
    print(f"converted {n} transcripts -> {ROOT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
