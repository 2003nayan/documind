from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class DocumentOut(BaseModel):
    id: str
    title: str
    filename: str
    source: str
    pipeline: str
    parser: str
    status: str
    error: str | None = None
    page_count: int
    created_at: datetime
    expires_at: datetime | None = None


class PageOut(BaseModel):
    page_number: int
    width: float
    height: float
    has_text_layer: bool
    ocr_used: bool


class DocumentDetail(DocumentOut):
    pages: list[PageOut]
    chunk_count: int


class ChunkOut(BaseModel):
    chunk_id: str
    document_id: str
    page_number: int
    chunk_type: str
    section: str | None
    content: str
    bboxes: list[dict]


class ChatRequest(BaseModel):
    question: str = Field(min_length=2, max_length=1000)
    document_ids: list[str] | None = None
    conversation_id: str | None = None


class CitationOut(BaseModel):
    index: int
    chunk_id: str
    document_id: str
    document_title: str
    page_number: int
    quote: str
    bboxes: list[dict]


class AnswerSectionOut(BaseModel):
    kind: Literal["document", "background"]
    text: str
    citation_indices: list[int]


class ChatResponse(BaseModel):
    conversation_id: str
    answer: str
    found: bool
    citations: list[CitationOut]
    retrieved: list[ChunkOut]
    provider: str
    model: str
    latency_ms: int
    retrieval_ms: int
    warning: str | None = None
    sections: list[AnswerSectionOut] = Field(default_factory=list)


class UploadResponse(BaseModel):
    document: DocumentOut
    warnings: list[str] = []


class ConfigOut(BaseModel):
    llm_provider: str
    vision_enabled: bool
    uploads_enabled: bool
    max_upload_mb: int
    max_upload_pages: int
    uploads_per_ip_per_day: int
    chats_per_ip_per_day: int
    upload_ttl_hours: int
