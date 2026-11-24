"""Download the public sample PDFs listed in datasets/samples.json.

PDFs are not committed to git; this script makes the demo corpus reproducible.
Usage: uv run python scripts/fetch_samples.py
"""

import hashlib
import json
import sys
import urllib.request
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "datasets" / "samples.json"
OUT_DIR = ROOT / "datasets" / "samples"


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (DocuMind sample fetcher)"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        return resp.read()


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for item in json.loads(MANIFEST.read_text()):
        dest = OUT_DIR / f"{item['slug']}.pdf"
        if dest.exists():
            print(f"skip   {dest.name} (exists)")
            continue
        data = fetch(item["url"])
        if item.get("pages"):
            first, last = item["pages"]
            src = pymupdf.open(stream=data, filetype="pdf")
            out = pymupdf.open()
            out.insert_pdf(src, from_page=first - 1, to_page=min(last, src.page_count) - 1)
            data = out.tobytes(garbage=3, deflate=True)
        dest.write_bytes(data)
        sha = hashlib.sha256(data).hexdigest()[:12]
        print(f"saved  {dest.name}  {len(data) / 1e6:.1f} MB  sha256:{sha}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
