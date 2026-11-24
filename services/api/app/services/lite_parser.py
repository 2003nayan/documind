"""Lightweight parser for live uploads on a 512 MB host.

PyMuPDF extracts text blocks with coordinates. Pages without a usable text
layer (scans) are transcribed by the vision LLM when one is configured.
"""

import json
import logging

import pymupdf
from documind_core.ids import document_id_for, sha256_bytes
from documind_core.schemas import BBox, Block, BlockType, Page, ParsedDocument, ParserName

from app.llm.base import ImagePart, LLMError, LLMProvider, LLMRequest

log = logging.getLogger(__name__)

TEXT_LAYER_MIN_CHARS = 20
VISION_DPI = 110
VISION_PROMPT = """Transcribe this scanned document page.
Return JSON: {"blocks": [{"type": "heading"|"text"|"table"|"figure", "text": string}]}
- Keep the reading order. For tables, put a GitHub Markdown table in "text".
- For figures/charts, describe what they show in one or two sentences.
- Do not invent content that is not visible."""


class UploadRejectedError(ValueError):
    pass


def parse_upload(
    data: bytes, filename: str, *, max_pages: int, vision: LLMProvider | None
) -> tuple[ParsedDocument, list[str]]:
    try:
        pdf = pymupdf.open(stream=data, filetype="pdf")
    except Exception as exc:
        raise UploadRejectedError("The file is not a readable PDF.") from exc
    if pdf.needs_pass:
        raise UploadRejectedError("Password-protected PDFs are not supported.")
    if pdf.page_count > max_pages:
        raise UploadRejectedError(f"PDF has {pdf.page_count} pages; the demo limit is {max_pages}.")

    sha = sha256_bytes(data)
    pages: list[Page] = []
    blocks: list[Block] = []
    warnings: list[str] = []
    section: str | None = None
    used_vision = False

    for page_index in range(pdf.page_count):
        page = pdf[page_index]
        number = page.number + 1
        text_len = len(page.get_text().strip())
        has_text = text_len >= TEXT_LAYER_MIN_CHARS
        page_blocks: list[Block] = []
        if has_text:
            page_blocks, section = _text_blocks(page, number, section)
            page_blocks += _tables(page, number, section)
        elif vision is not None:
            page_blocks, section = _vision_blocks(page, number, section, vision, warnings)
            used_vision = used_vision or bool(page_blocks)
        else:
            warnings.append(f"Page {number} has no text layer and no vision model is configured; skipped.")
        pages.append(
            Page(
                page_number=number,
                width=page.rect.width,
                height=page.rect.height,
                has_text_layer=has_text,
                ocr_used=not has_text and bool(page_blocks),
            )
        )
        blocks.extend(page_blocks)

    doc = ParsedDocument(
        document_id=document_id_for(sha),
        filename=filename,
        sha256=sha,
        parser=ParserName.GEMINI_VISION if used_vision else ParserName.PYMUPDF,
        pages=pages,
        blocks=blocks,
    )
    return doc, warnings


def _text_blocks(page: pymupdf.Page, number: int, section: str | None) -> tuple[list[Block], str | None]:
    out: list[Block] = []
    data = page.get_text("dict", sort=True)
    sizes = [s["size"] for b in data["blocks"] for line in b.get("lines", []) for s in line["spans"]]
    body_size = sorted(sizes)[len(sizes) // 2] if sizes else 10
    table_rects = [t.bbox for t in _find_tables(page)]
    for b in data["blocks"]:
        if b.get("type") != 0:
            continue
        rect = pymupdf.Rect(b["bbox"])
        if any(rect.intersects(pymupdf.Rect(tr)) for tr in table_rects):
            continue
        spans = [s for line in b["lines"] for s in line["spans"]]
        text = "\n".join("".join(s["text"] for s in line["spans"]) for line in b["lines"]).strip()
        if sum(ch.isalnum() for ch in text) < 2:
            continue
        max_size = max(s["size"] for s in spans)
        bold = all("bold" in s["font"].lower() or s["flags"] & 16 for s in spans)
        is_heading = len(text) < 120 and "\n" not in text and (max_size >= body_size * 1.2 or bold)
        if is_heading:
            section = text
        out.append(
            Block(
                type=BlockType.HEADING if is_heading else BlockType.TEXT,
                text=text,
                page_number=number,
                bbox=BBox(left=rect.x0, top=rect.y0, right=rect.x1, bottom=rect.y1),
                section=section,
            )
        )
    return out, section


def _find_tables(page: pymupdf.Page) -> list:
    try:
        return list(page.find_tables().tables)
    except Exception:
        return []


def _tables(page: pymupdf.Page, number: int, section: str | None) -> list[Block]:
    out: list[Block] = []
    for table in _find_tables(page):
        try:
            markdown = table.to_markdown().strip()
            csv = table.to_pandas().to_csv(index=False)
        except Exception:
            continue
        if not markdown:
            continue
        r = table.bbox
        out.append(
            Block(
                type=BlockType.TABLE,
                text="",
                page_number=number,
                bbox=BBox(left=r[0], top=r[1], right=r[2], bottom=r[3]),
                section=section,
                table_markdown=markdown,
                table_csv=csv,
            )
        )
    return out


_VISION_TYPES = {"heading": BlockType.HEADING, "table": BlockType.TABLE, "figure": BlockType.FIGURE}


def _vision_blocks(
    page: pymupdf.Page, number: int, section: str | None, vision: LLMProvider, warnings: list[str]
) -> tuple[list[Block], str | None]:
    png = page.get_pixmap(dpi=VISION_DPI).tobytes("png")
    try:
        resp = vision.generate(
            LLMRequest(system=VISION_PROMPT, prompt=f"Page {number}.", images=[ImagePart(png)])
        )
        items = json.loads(resp.text).get("blocks", [])
    except (LLMError, json.JSONDecodeError, AttributeError) as exc:
        warnings.append(f"Page {number}: vision transcription failed ({type(exc).__name__}).")
        return [], section
    out: list[Block] = []
    page_box = BBox(left=0, top=0, right=page.rect.width, bottom=page.rect.height)
    for item in items:
        text = str(item.get("text", "")).strip()
        if not text:
            continue
        kind = _VISION_TYPES.get(str(item.get("type")), BlockType.TEXT)
        if kind == BlockType.HEADING:
            section = text
        out.append(
            Block(
                type=kind,
                text="" if kind == BlockType.TABLE else text,
                table_markdown=text if kind == BlockType.TABLE else None,
                page_number=number,
                bbox=page_box,
                section=section,
            )
        )
    return out, section
