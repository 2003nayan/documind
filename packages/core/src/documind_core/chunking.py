"""Layout-aware chunking.

Rules:
- A chunk never spans pages, so every citation maps to exactly one page.
- Tables and figures become their own chunks.
- Text blocks are packed under their section heading up to ``max_chars``.
"""

from collections.abc import Iterable

from documind_core.ids import chunk_id_for
from documind_core.schemas import BBox, Block, BlockType, Chunk, ChunkType, ParsedDocument

DEFAULT_MAX_CHARS = 1200
MIN_CHARS = 30


def chunk_document(doc: ParsedDocument, max_chars: int = DEFAULT_MAX_CHARS) -> list[Chunk]:
    chunks: list[Chunk] = []
    buffer: list[Block] = []

    def flush() -> None:
        if not buffer:
            return
        text = "\n".join(b.text for b in buffer).strip()
        if len(text) >= MIN_CHARS:
            chunks.append(_make_chunk(doc.document_id, len(chunks), buffer[0], ChunkType.TEXT, text, buffer))
        buffer.clear()

    for block in doc.blocks:
        if block.type in (BlockType.TABLE, BlockType.FIGURE):
            flush()
            content = _special_content(block)
            if content:
                chunk_type = ChunkType.TABLE if block.type == BlockType.TABLE else ChunkType.FIGURE
                chunks.append(_make_chunk(doc.document_id, len(chunks), block, chunk_type, content, [block]))
            continue

        starts_new_group = buffer and (
            block.page_number != buffer[0].page_number
            or block.section != buffer[0].section
            or block.type in (BlockType.TITLE, BlockType.HEADING)
        )
        if starts_new_group:
            flush()

        for piece in _split_long(block, max_chars):
            current = sum(len(b.text) + 1 for b in buffer)
            if buffer and current + len(piece.text) > max_chars:
                flush()
            buffer.append(piece)
    flush()
    return chunks


def _special_content(block: Block) -> str:
    if block.type == BlockType.TABLE:
        body = block.table_markdown or block.text
        return f"{block.text}\n{body}".strip() if block.table_markdown and block.text else body
    return f"[Figure] {block.text}".strip() if block.text else ""


def _split_long(block: Block, max_chars: int) -> Iterable[Block]:
    if len(block.text) <= max_chars:
        yield block
        return
    sentences = block.text.replace("\n", " ").split(". ")
    current = ""
    for sentence in sentences:
        candidate = f"{current}. {sentence}" if current else sentence
        if len(candidate) > max_chars and current:
            yield block.model_copy(update={"text": current})
            current = sentence
        else:
            current = candidate
    if current:
        yield block.model_copy(update={"text": current})


def _make_chunk(
    document_id: str,
    index: int,
    first: Block,
    chunk_type: ChunkType,
    content: str,
    blocks: list[Block],
) -> Chunk:
    bboxes: list[BBox] = [b.bbox for b in blocks if b.bbox is not None]
    return Chunk(
        chunk_id=chunk_id_for(document_id, index),
        document_id=document_id,
        page_number=first.page_number,
        chunk_type=chunk_type,
        section=first.section,
        content=content,
        bboxes=_dedupe(bboxes),
    )


def _dedupe(bboxes: list[BBox]) -> list[BBox]:
    seen: set[tuple[float, float, float, float]] = set()
    out: list[BBox] = []
    for b in bboxes:
        key = (round(b.left), round(b.top), round(b.right), round(b.bottom))
        if key not in seen:
            seen.add(key)
            out.append(b)
    return out
