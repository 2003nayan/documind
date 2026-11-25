"""Download the public sample PDFs listed in datasets/samples.json.

The resulting PDFs are committed to git (document ids are content hashes, and upstream
files can change), so builds never download them; this script documents their provenance.
Page-range truncation is deterministic (no random PDF /ID, no timestamps).

    uv run python scripts/fetch_samples.py
    uv run python scripts/fetch_samples.py --files-dir data/files   # also stage files for the API
"""

import argparse
import hashlib
import json
import shutil
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


def truncate(data: bytes, first: int, last: int) -> bytes:
    src = pymupdf.open(stream=data, filetype="pdf")
    out = pymupdf.open()
    out.insert_pdf(src, from_page=first - 1, to_page=min(last, src.page_count) - 1)
    out.set_metadata({})
    return out.tobytes(garbage=3, deflate=True, no_new_id=True)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--files-dir", type=Path, help="Also copy PDFs here as <document_id>.pdf")
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    mismatches = 0
    for item in json.loads(MANIFEST.read_text()):
        dest = OUT_DIR / f"{item['slug']}.pdf"
        if dest.exists():
            print(f"skip   {dest.name} (exists)")
        else:
            data = fetch(item["url"])
            if item.get("pages"):
                data = truncate(data, *item["pages"])
            dest.write_bytes(data)
        sha = hashlib.sha256(dest.read_bytes()).hexdigest()
        expected = item.get("sha256")
        status = "ok" if not expected or expected == sha else f"MISMATCH (expected {expected[:12]})"
        mismatches += status != "ok"
        print(f"{dest.name}  {dest.stat().st_size / 1e6:.1f} MB  sha256:{sha[:12]}  {status}")
        if args.files_dir:
            args.files_dir.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(dest, args.files_dir / f"doc_{sha[:16]}.pdf")
    return 1 if mismatches else 0


if __name__ == "__main__":
    sys.exit(main())
