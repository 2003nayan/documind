from documind_core.chunking import chunk_document
from documind_core.db import (
    DocumentRow,
    init_db,
    load_chunks,
    make_engine,
    make_session_factory,
    save_document,
)
from documind_core.schemas import Block, BlockType, Page, ParsedDocument, ParserName


def test_save_and_reload_document_roundtrip() -> None:
    engine = make_engine("sqlite://")
    init_db(engine)
    doc = ParsedDocument(
        document_id="doc_db",
        filename="x.pdf",
        sha256="1" * 64,
        parser=ParserName.PYMUPDF,
        pages=[Page(page_number=1, width=612, height=792)],
        blocks=[Block(type=BlockType.TEXT, text="Rated output is 50 horsepower at 1800 rpm.", page_number=1)],
    )
    chunks = chunk_document(doc)
    factory = make_session_factory(engine)
    with factory() as s:
        save_document(s, doc, chunks, source="upload", pipeline="lite", title="X")
        s.commit()
    with factory() as s:  # re-saving the same document replaces it
        save_document(s, doc, chunks, source="upload", pipeline="lite", title="X2")
        s.commit()
    with factory() as s:
        row = s.get(DocumentRow, "doc_db")
        assert row is not None and row.title == "X2" and row.page_count == 1
        loaded = load_chunks(s, [c.chunk_id for c in chunks])
        assert loaded[chunks[0].chunk_id].content == chunks[0].content
