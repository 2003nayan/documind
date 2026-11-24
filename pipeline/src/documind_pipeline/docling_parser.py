"""Docling -> canonical ParsedDocument.

Runs offline (laptop / CI) because Docling's layout, table and OCR models need
far more memory than a free 512 MB host provides.
"""

import logging
import time
from pathlib import Path

import pypdfium2 as pdfium
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling_core.types.doc import DocItem, DocItemLabel, DoclingDocument, PictureItem, TableItem
from docling_core.types.doc.base import BoundingBox
from documind_core.ids import document_id_for, sha256_bytes
from documind_core.schemas import BBox, Block, BlockType, Page, ParsedDocument, ParserName

log = logging.getLogger(__name__)

TEXT_LAYER_MIN_CHARS = 20

LABEL_MAP: dict[str, BlockType] = {
    DocItemLabel.TITLE: BlockType.TITLE,
    DocItemLabel.SECTION_HEADER: BlockType.HEADING,
    DocItemLabel.TEXT: BlockType.TEXT,
    DocItemLabel.PARAGRAPH: BlockType.TEXT,
    DocItemLabel.FOOTNOTE: BlockType.TEXT,
    DocItemLabel.FORMULA: BlockType.TEXT,
    DocItemLabel.CODE: BlockType.TEXT,
    DocItemLabel.REFERENCE: BlockType.TEXT,
    DocItemLabel.LIST_ITEM: BlockType.LIST_ITEM,
    DocItemLabel.CAPTION: BlockType.CAPTION,
    DocItemLabel.TABLE: BlockType.TABLE,
    DocItemLabel.DOCUMENT_INDEX: BlockType.TEXT,
    DocItemLabel.PICTURE: BlockType.FIGURE,
    DocItemLabel.CHART: BlockType.FIGURE,
}
# Page furniture repeats on every page and only adds retrieval noise.
SKIP_LABELS = {DocItemLabel.PAGE_HEADER, DocItemLabel.PAGE_FOOTER}


def build_converter(ocr: bool = True, num_threads: int = 4) -> DocumentConverter:
    opts = PdfPipelineOptions(do_ocr=ocr, do_table_structure=True)
    opts.accelerator_options.num_threads = num_threads
    return DocumentConverter(format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=opts)})


def text_layer_pages(data: bytes) -> dict[int, bool]:
    pdf = pdfium.PdfDocument(data)
    try:
        out: dict[int, bool] = {}
        for i in range(len(pdf)):
            textpage = pdf[i].get_textpage()
            out[i + 1] = len(textpage.get_text_range().strip()) >= TEXT_LAYER_MIN_CHARS
        return out
    finally:
        pdf.close()


def parse_pdf(path: Path, converter: DocumentConverter | None = None) -> ParsedDocument:
    data = path.read_bytes()
    sha = sha256_bytes(data)
    converter = converter or build_converter()
    start = time.perf_counter()
    result = converter.convert(path)
    log.info("docling converted %s in %.1fs (%s)", path.name, time.perf_counter() - start, result.status)
    return to_parsed_document(
        result.document,
        filename=path.name,
        sha256=sha,
        text_layers=text_layer_pages(data),
        ocr_enabled=bool(getattr(converter, "_ocr", True)),
    )


def to_parsed_document(
    doc: DoclingDocument,
    *,
    filename: str,
    sha256: str,
    text_layers: dict[int, bool] | None = None,
    ocr_enabled: bool = True,
) -> ParsedDocument:
    text_layers = text_layers or {}
    heights = {no: p.size.height for no, p in doc.pages.items()}
    pages = [
        Page(
            page_number=no,
            width=p.size.width,
            height=p.size.height,
            has_text_layer=text_layers.get(no, True),
            ocr_used=ocr_enabled and not text_layers.get(no, True),
        )
        for no, p in sorted(doc.pages.items())
    ]

    blocks: list[Block] = []
    section: str | None = None
    for item, _level in doc.iterate_items():
        if not isinstance(item, DocItem):
            continue
        label = item.label
        if label in SKIP_LABELS or label not in LABEL_MAP or not item.prov:
            continue
        prov = item.prov[0]
        block_type = LABEL_MAP[label]
        bbox = _to_top_left(prov.bbox, heights.get(prov.page_no))

        if isinstance(item, TableItem):
            markdown = item.export_to_markdown(doc).strip()
            if not markdown:
                continue
            try:
                csv = item.export_to_dataframe(doc).to_csv(index=False)
            except Exception:
                csv = None
            caption = item.caption_text(doc).strip()
            blocks.append(
                Block(
                    type=block_type,
                    text=caption,
                    page_number=prov.page_no,
                    bbox=bbox,
                    section=section,
                    table_markdown=markdown,
                    table_csv=csv,
                )
            )
            continue

        if isinstance(item, PictureItem):
            caption = item.caption_text(doc).strip()
            blocks.append(
                Block(type=block_type, text=caption, page_number=prov.page_no, bbox=bbox, section=section)
            )
            continue

        text = _clean(getattr(item, "text", ""))
        if sum(ch.isalnum() for ch in text) < 2:  # OCR specks like "-" or "·"
            continue
        if block_type in (BlockType.TITLE, BlockType.HEADING):
            section = text
        blocks.append(Block(type=block_type, text=text, page_number=prov.page_no, bbox=bbox, section=section))

    return ParsedDocument(
        document_id=document_id_for(sha256),
        filename=filename,
        sha256=sha256,
        parser=ParserName.DOCLING,
        pages=pages,
        blocks=blocks,
    )


def _to_top_left(bbox: BoundingBox, page_height: float | None) -> BBox | None:
    if page_height is None:
        return None
    tl = bbox.to_top_left_origin(page_height=page_height)
    return BBox(left=tl.l, top=tl.t, right=tl.r, bottom=tl.b)


def _clean(text: str) -> str:
    # Docling keeps raw bullet glyphs (e.g. \x07) from some PDFs.
    return "".join(ch for ch in text if ch == "\n" or ch >= " ").strip()
