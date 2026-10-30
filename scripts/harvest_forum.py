#!/usr/bin/env python3
"""Harvest the RC Tech 'RC Crew Chief Software' thread from Wayback snapshots.

Writes docs/research/forum/rctech-thread.md with one section per page and
per-post blocks (date | author | text).  Idempotent: re-running replaces the file.
"""
import html
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SNAPS = Path("/opt/data/cache/scratch/snapshots.json")
OUT = ROOT / "docs/research/forum/rctech-thread.md"
UA = {"User-Agent": "Mozilla/5.0 (compatible; rc-setup-lab-research/1.0)"}


def strip_tags(s: str) -> str:
    s = re.sub(r"<br\s*/?>", "\n", s, flags=re.I)
    s = re.sub(r"</p>", "\n\n", s, flags=re.I)
    s = re.sub(r'<a [^>]*href="([^"]+)"[^>]*>.*?</a>', r"[\1]", s, flags=re.I | re.S)
    s = re.sub(r"<blockquote.*?</blockquote>", "\n[quote omitted]\n", s, flags=re.I | re.S)
    s = re.sub(r"<[^>]+>", "", s)
    s = html.unescape(s)
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def parse(page_html: str):
    posts = []
    for m in re.finditer(r'id="post_message_(\d+)"[^>]*>(.*?)</div>', page_html, re.S):
        body = strip_tags(m.group(2))
        head = page_html[max(0, m.start() - 9000):m.start()]
        author = re.findall(r'class="bigusername"[^>]*>(.*?)</a>', head, re.S)
        date = re.findall(r"(\d{2}-\d{2}-\d{4},\s*\d{2}:\d{2}\s*[AP]M)", head)
        posts.append({
            "author": html.unescape(strip_tags(author[-1])).strip() if author else "?",
            "date": date[-1] if date else "?",
            "body": body,
        })
    return posts


def main() -> int:
    snaps = json.loads(SNAPS.read_text())
    pages = sorted((int(k), v) for k, v in snaps.items() if v[0] != "ERR")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    chunks = ["# RC Tech thread: 'RC Crew Chief Software'\n",
              "Source: https://www.rctech.net/forum/electric-road/613563-rc-crew-chief-software.html\n",
              "Recovered from Wayback Machine snapshots (Cloudflare blocks direct fetch).\n",
              "Each page block states its snapshot timestamp — treat as historical, not live.\n"]
    ok = fail = 0
    for page, (ts, url) in pages:
        raw = url.replace("/http", "id_/http", 1) if "id_/" not in url else url
        try:
            req = urllib.request.Request(raw, headers=UA)
            with urllib.request.urlopen(req, timeout=60) as r:
                body = r.read().decode("utf-8", "ignore")
        except Exception as exc:                               # noqa: BLE001
            fail += 1
            chunks.append(f"\n## Page {page} — FETCH FAILED ({exc})\n")
            print(f"page {page}: FAIL {exc}", flush=True)
            continue
        posts = parse(body)
        if not posts:
            fail += 1
            chunks.append(f"\n## Page {page} — PARSE EMPTY (snapshot {ts})\n")
            print(f"page {page}: empty parse", flush=True)
            continue
        ok += 1
        chunks.append(f"\n## Page {page}  (snapshot {ts[:4]}-{ts[4:6]}-{ts[6:8]})\n")
        for p in posts:
            if not p["body"]:
                continue
            chunks.append(f"\n### {p['date']} — {p['author']}\n\n{p['body']}\n")
        print(f"page {page}: {len(posts)} posts", flush=True)
        time.sleep(0.5)
    OUT.write_text("\n".join(chunks) + "\n", encoding="utf-8")
    print(f"WROTE {OUT} pages_ok={ok} failed={fail} chars={OUT.stat().st_size}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
