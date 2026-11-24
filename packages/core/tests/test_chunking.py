from documind_core.chunking import chunk_document
from documind_core.ids import chunk_id_for, document_id_for, point_id_for
from documind_core.schemas import BBox, Block, BlockType, ChunkType, Page, ParsedDocument, ParserName


def _doc(blocks: list[Block], pages: int = 2) -> ParsedDocument:
    return ParsedDocument(
        document_id="doc_test",
        filename="t.pdf",
        sha256="0" * 64,
        parser=ParserName.DOCLING,
        pages=[Page(page_number=i, width=612, height=792) for i in range(1, pages + 1)],
        blocks=blocks,
    )


def _text(text: str, page: int = 1, section: str | None = "Intro", kind: BlockType = BlockType.TEXT) -> Block:
    return Block(
        type=kind,
        text=text,
        page_number=page,
        section=section,
        bbox=BBox(left=10, top=10, right=100, bottom=20),
    )


def test_chunks_never_cross_pages() -> None:
    doc = _doc(
        [
            _text("Motor efficiency is the ratio of output power to input power.", 1),
            _text("Premium efficiency motors reduce energy losses significantly.", 2),
        ]
    )
    chunks = chunk_document(doc)
    assert [c.page_number for c in chunks] == [1, 2]


def test_tables_and_figures_are_separate_chunks() -> None:
    table = Block(
        type=BlockType.TABLE,
        text="Table 1-1. Losses",
        page_number=1,
        section="Intro",
        table_markdown="| a | b |\n|---|---|\n| 1 | 2 |",
    )
    figure = Block(type=BlockType.FIGURE, text="Figure 2-1. Efficiency curve", page_number=1)
    doc = _doc([_text("Some introductory text about electric motors and losses."), table, figure])
    chunks = chunk_document(doc)
    assert [c.chunk_type for c in chunks] == [ChunkType.TEXT, ChunkType.TABLE, ChunkType.FIGURE]
    assert "| 1 | 2 |" in chunks[1].content and "Table 1-1" in chunks[1].content
    assert chunks[2].content.startswith("[Figure]")


def test_long_text_is_split_under_limit() -> None:
    long = ". ".join(f"Sentence number {i} about motors" for i in range(200))
    chunks = chunk_document(_doc([_text(long)]), max_chars=400)
    assert len(chunks) > 1
    assert all(len(c.content) <= 400 for c in chunks)


def test_heading_starts_new_chunk_and_tiny_text_dropped() -> None:
    blocks = [
        _text("A paragraph that is long enough to keep around for retrieval."),
        _text("Losses", kind=BlockType.HEADING, section="Losses"),
        _text("Stator and rotor I2R losses dominate in small motors.", section="Losses"),
        _text("ok", section="Losses", page=2),
    ]
    chunks = chunk_document(_doc(blocks))
    assert len(chunks) == 2
    assert chunks[1].content.startswith("Losses\n")
    assert chunks[1].embedding_text().startswith("Losses\n")


def test_ids_are_deterministic() -> None:
    doc_id = document_id_for("ab" * 32)
    assert doc_id == "doc_" + "ab" * 8
    cid = chunk_id_for(doc_id, 3)
    assert cid.endswith("_c0003")
    assert point_id_for(cid) == point_id_for(cid)
