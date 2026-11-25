"""Offline pipeline CLI.

uv run documind-pipeline parse datasets/samples/doe-motor-handbook.pdf
uv run documind-pipeline index processed/doc_xxx.json --title "DOE Motor Handbook"
uv run documind-pipeline ingest-samples
"""

import json
import logging
import shutil
from pathlib import Path

import typer
from documind_core.config import get_core_settings
from documind_core.db import init_db, make_engine, make_session_factory
from documind_core.embeddings import get_dense_embedder, get_sparse_embedder
from documind_core.ids import document_id_for, sha256_bytes
from documind_core.indexing import index_document
from documind_core.schemas import ParsedDocument
from documind_core.vectorstore import build_vector_store

app = typer.Typer(no_args_is_help=True, add_completion=False)
REPO_ROOT = Path(__file__).resolve().parents[3]
PROCESSED_DIR = REPO_ROOT / "processed"
SAMPLES_DIR = REPO_ROOT / "datasets" / "samples"
MANIFEST = REPO_ROOT / "datasets" / "samples.json"


@app.callback()
def _setup(verbose: bool = typer.Option(False, "--verbose", "-v")) -> None:
    logging.basicConfig(level=logging.DEBUG if verbose else logging.INFO, format="%(levelname)s %(message)s")


def _parse(pdf: Path, ocr: bool, out_dir: Path) -> Path:
    from documind_pipeline.docling_parser import build_converter, parse_pdf

    doc = parse_pdf(pdf, build_converter(ocr=ocr))
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / f"{doc.document_id}.json"
    out.write_text(doc.model_dump_json(indent=1))
    typer.echo(f"{pdf.name}: {doc.page_count} pages, {len(doc.blocks)} blocks -> {out}")
    return out


def _index(parsed: Path, title: str | None, files_dir: Path | None, pdf: Path | None) -> None:
    settings = get_core_settings()
    doc = ParsedDocument.model_validate_json(parsed.read_text())
    engine = make_engine(settings.database_url)
    init_db(engine)
    dense = get_dense_embedder()
    store = build_vector_store(
        settings.qdrant_url, settings.qdrant_api_key, settings.qdrant_collection, dense
    )
    with make_session_factory(engine)() as session:
        chunks = index_document(
            doc,
            session=session,
            store=store,
            dense=dense,
            sparse=get_sparse_embedder(),
            source="sample",
            pipeline="full",
            title=title,
        )
    if files_dir and pdf:
        files_dir.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(pdf, files_dir / f"{doc.document_id}.pdf")
    typer.echo(f"indexed {doc.document_id}: {len(chunks)} chunks")


@app.command()
def parse(
    pdf: Path = typer.Argument(..., exists=True, dir_okay=False),
    ocr: bool = typer.Option(True, help="Run OCR on bitmap regions / scanned pages"),
    out_dir: Path = typer.Option(PROCESSED_DIR),
) -> None:
    """Parse a PDF with Docling and write the canonical JSON."""
    _parse(pdf, ocr, out_dir)


@app.command()
def index(
    parsed: Path = typer.Argument(..., exists=True, dir_okay=False),
    title: str | None = typer.Option(None),
) -> None:
    """Chunk, embed and write a parsed document to Qdrant + Postgres."""
    _index(parsed, title, None, None)


@app.command("ingest-samples")
def ingest_samples(
    ocr: bool = typer.Option(True),
    reparse: bool = typer.Option(False, help="Re-run Docling even if parsed JSON exists"),
    files_dir: Path = typer.Option(REPO_ROOT / "data" / "files", help="Where the API serves PDFs from"),
) -> None:
    """Parse and index every document in datasets/samples.json."""
    for item in json.loads(MANIFEST.read_text()):
        pdf = SAMPLES_DIR / f"{item['slug']}.pdf"
        if not pdf.exists():
            raise typer.BadParameter(f"{pdf} missing; run `uv run python scripts/fetch_samples.py` first")
        sha = sha256_bytes(pdf.read_bytes())
        if item.get("sha256") and item["sha256"] != sha:
            raise typer.BadParameter(
                f"{pdf.name} does not match the pinned sha256; delete it and re-run fetch_samples.py"
            )
        parsed = PROCESSED_DIR / f"{document_id_for(sha)}.json"
        if reparse or not parsed.exists():
            parsed = _parse(pdf, ocr, PROCESSED_DIR)
        _index(parsed, item.get("title"), files_dir, pdf)


if __name__ == "__main__":
    app()
