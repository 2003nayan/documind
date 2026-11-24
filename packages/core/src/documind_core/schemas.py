"""Canonical document model shared by the offline pipeline and the serving API.

Coordinates are PDF points with a top-left origin so the frontend can overlay
highlights directly on a rendered page.
"""

from datetime import UTC, datetime
from enum import StrEnum

from pydantic import BaseModel, Field


class BlockType(StrEnum):
    TITLE = "title"
    HEADING = "heading"
    TEXT = "text"
    LIST_ITEM = "list_item"
    TABLE = "table"
    FIGURE = "figure"
    CAPTION = "caption"


class ChunkType(StrEnum):
    TEXT = "text"
    TABLE = "table"
    FIGURE = "figure"


class ParserName(StrEnum):
    DOCLING = "docling"
    PYMUPDF = "pymupdf"
    GEMINI_VISION = "gemini_vision"


class BBox(BaseModel):
    left: float
    top: float
    right: float
    bottom: float


class Block(BaseModel):
    type: BlockType
    text: str
    page_number: int = Field(ge=1)
    bbox: BBox | None = None
    section: str | None = None
    table_markdown: str | None = None
    table_csv: str | None = None


class Page(BaseModel):
    page_number: int = Field(ge=1)
    width: float
    height: float
    has_text_layer: bool = True
    ocr_used: bool = False


class ParsedDocument(BaseModel):
    document_id: str
    filename: str
    sha256: str
    parser: ParserName
    pages: list[Page]
    blocks: list[Block]
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    @property
    def page_count(self) -> int:
        return len(self.pages)


class Chunk(BaseModel):
    chunk_id: str
    document_id: str
    page_number: int = Field(ge=1)
    chunk_type: ChunkType
    section: str | None = None
    content: str
    bboxes: list[BBox] = Field(default_factory=list)

    def embedding_text(self) -> str:
        """Text used for embeddings: section context improves retrieval of short chunks."""
        if self.section:
            return f"{self.section}\n{self.content}"
        return self.content
