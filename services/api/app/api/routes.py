import logging
import time
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

from documind_core.db import ChunkRow, ConversationRow, DocumentRow, MessageRow
from documind_core.indexing import index_document
from fastapi import APIRouter, BackgroundTasks, Depends, File, Header, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.schemas import (
    ChatRequest,
    ChatResponse,
    ChunkOut,
    CitationOut,
    ConfigOut,
    DocumentDetail,
    DocumentOut,
    UploadResponse,
)
from app.config import Settings, get_settings
from app.deps import (
    get_db,
    get_dense,
    get_providers,
    get_session_factory,
    get_sparse,
    get_store,
    get_vision_provider,
)
from app.llm.base import LLMError, QuotaExceededError
from app.services.answering import answer_question
from app.services.lite_parser import UploadRejectedError, parse_upload
from app.services.quota import QuotaError, check_and_increment
from app.services.retrieval import retrieve

log = logging.getLogger(__name__)
router = APIRouter()


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def visible_documents(session_id: str | None):
    owner = DocumentRow.source == "sample"
    if session_id:
        owner = or_(owner, DocumentRow.owner_session == session_id)
    return select(DocumentRow).where(owner)


def _doc_out(row: DocumentRow) -> DocumentOut:
    return DocumentOut(
        id=row.id,
        title=row.title or row.filename,
        filename=row.filename,
        source=row.source,
        pipeline=row.pipeline,
        parser=row.parser,
        status=row.status,
        error=row.error,
        page_count=row.page_count,
        created_at=row.created_at,
        expires_at=row.expires_at,
    )


def _get_visible(db: Session, document_id: str, session_id: str | None) -> DocumentRow:
    row = db.scalars(visible_documents(session_id).where(DocumentRow.id == document_id)).first()
    if row is None:
        raise HTTPException(404, "Document not found")
    return row


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}


@router.get("/config", response_model=ConfigOut)
def config(settings: Settings = Depends(get_settings)) -> ConfigOut:
    return ConfigOut(
        llm_provider=settings.llm_provider,
        vision_enabled=get_vision_provider() is not None,
        uploads_enabled=settings.uploads_enabled,
        max_upload_mb=settings.max_upload_mb,
        max_upload_pages=settings.max_upload_pages,
        uploads_per_ip_per_day=settings.uploads_per_ip_per_day,
        chats_per_ip_per_day=settings.chats_per_ip_per_day,
        upload_ttl_hours=settings.upload_ttl_hours,
    )


@router.get("/documents", response_model=list[DocumentOut])
def list_documents(
    db: Session = Depends(get_db), x_session_id: str | None = Header(None)
) -> list[DocumentOut]:
    rows = db.scalars(
        visible_documents(x_session_id).order_by(DocumentRow.source, DocumentRow.created_at)
    ).all()
    return [_doc_out(r) for r in rows]


@router.get("/documents/{document_id}", response_model=DocumentDetail)
def get_document(
    document_id: str, db: Session = Depends(get_db), x_session_id: str | None = Header(None)
) -> DocumentDetail:
    row = _get_visible(db, document_id, x_session_id)
    return DocumentDetail(**_doc_out(row).model_dump(), pages=row.pages or [], chunk_count=len(row.chunks))


@router.get("/documents/{document_id}/file")
def get_file(
    document_id: str,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    session: str | None = None,
) -> FileResponse:
    # <iframe>/pdf.js requests can't set headers, so the session id may come as a query param.
    _get_visible(db, document_id, session)
    path = Path(settings.files_dir) / f"{document_id}.pdf"
    if not path.exists():
        raise HTTPException(404, "File is no longer available")
    return FileResponse(path, media_type="application/pdf")


@router.get("/documents/{document_id}/chunks", response_model=list[ChunkOut])
def get_chunks(
    document_id: str,
    page: int | None = None,
    chunk_type: str | None = None,
    db: Session = Depends(get_db),
    x_session_id: str | None = Header(None),
) -> list[ChunkOut]:
    _get_visible(db, document_id, x_session_id)
    q = select(ChunkRow).where(ChunkRow.document_id == document_id)
    if page is not None:
        q = q.where(ChunkRow.page_number == page)
    if chunk_type:
        q = q.where(ChunkRow.chunk_type == chunk_type)
    return [ChunkOut(**r.to_chunk().model_dump(mode="json")) for r in db.scalars(q.order_by(ChunkRow.id))]


@router.post("/chat", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    request: Request,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    x_session_id: str | None = Header(None),
) -> ChatResponse:
    visible = {r.id: r for r in db.scalars(visible_documents(x_session_id)).all() if r.status == "READY"}
    doc_ids = [d for d in (body.document_ids or visible.keys()) if d in visible]
    if not doc_ids:
        raise HTTPException(400, "No ready documents selected")
    try:
        check_and_increment(
            db,
            ip=client_ip(request),
            action="chat",
            per_ip=settings.chats_per_ip_per_day,
            global_limit=settings.chats_global_per_day,
        )
    except QuotaError as exc:
        raise HTTPException(429, exc.message) from exc

    start = time.perf_counter()
    chunks = await run_in_threadpool(
        retrieve,
        body.question,
        session=db,
        store=get_store(),
        dense=get_dense(),
        sparse=get_sparse(),
        document_ids=doc_ids,
        limit=settings.retrieval_limit,
    )
    retrieval_ms = int((time.perf_counter() - start) * 1000)
    titles = {d: visible[d].title or visible[d].filename for d in doc_ids}
    try:
        result = await run_in_threadpool(answer_question, body.question, chunks, titles, get_providers())
    except QuotaExceededError as exc:
        raise HTTPException(429, "The free LLM quota is exhausted for now. Please try again later.") from exc
    except LLMError as exc:
        log.exception("LLM failure")
        raise HTTPException(502, "The language model is unavailable right now.") from exc

    citations = [
        CitationOut(index=i, document_title=titles.get(c.document_id, c.document_id), **c.__dict__)
        for i, c in enumerate(result.citations, start=1)
    ]
    conversation_id = body.conversation_id or uuid.uuid4().hex
    conv = db.get(ConversationRow, conversation_id)
    if conv is None:
        conv = ConversationRow(id=conversation_id, session_id=x_session_id or "anonymous")
        db.add(conv)
    conv.messages.append(MessageRow(role="user", content=body.question))
    conv.messages.append(
        MessageRow(
            role="assistant",
            content=result.answer,
            citations=[c.model_dump() for c in citations],
            model=f"{result.provider}:{result.model}",
            latency_ms=result.latency_ms + retrieval_ms,
        )
    )
    db.commit()

    return ChatResponse(
        conversation_id=conversation_id,
        answer=result.answer,
        found=result.found,
        citations=citations,
        retrieved=[ChunkOut(**c.model_dump(mode="json")) for c in chunks],
        provider=result.provider,
        model=result.model,
        latency_ms=result.latency_ms,
        retrieval_ms=retrieval_ms,
        warning=result.warning,
    )


@router.post("/documents", response_model=UploadResponse, status_code=201)
async def upload_document(
    request: Request,
    background: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    x_session_id: str | None = Header(None),
) -> UploadResponse:
    if not settings.uploads_enabled:
        raise HTTPException(403, "Uploads are disabled on this deployment")
    if not x_session_id:
        raise HTTPException(400, "Missing X-Session-Id header")
    data = await file.read(settings.max_upload_mb * 1024 * 1024 + 1)
    if len(data) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(413, f"File exceeds {settings.max_upload_mb} MB")
    if not data.startswith(b"%PDF"):
        raise HTTPException(415, "Only PDF files are supported")

    cleanup_expired(db, settings)
    try:
        check_and_increment(
            db,
            ip=client_ip(request),
            action="upload",
            per_ip=settings.uploads_per_ip_per_day,
            global_limit=None,
        )
    except QuotaError as exc:
        raise HTTPException(429, exc.message) from exc

    filename = Path(file.filename or "upload.pdf").name[:200]
    try:
        doc, warnings = await run_in_threadpool(
            parse_upload, data, filename, max_pages=settings.max_upload_pages, vision=get_vision_provider()
        )
    except UploadRejectedError as exc:
        raise HTTPException(422, str(exc)) from exc
    if not doc.blocks:
        raise HTTPException(422, "No text could be extracted from this PDF. " + " ".join(warnings))

    existing = db.get(DocumentRow, doc.document_id)
    if existing is not None and existing.source == "sample":
        return UploadResponse(document=_doc_out(existing), warnings=["This document is already a sample."])

    files_dir = Path(settings.files_dir)
    files_dir.mkdir(parents=True, exist_ok=True)
    (files_dir / f"{doc.document_id}.pdf").write_bytes(data)
    expires = datetime.now(UTC) + timedelta(hours=settings.upload_ttl_hours)
    row = DocumentRow(
        id=doc.document_id,
        filename=filename,
        title=filename.removesuffix(".pdf"),
        sha256=doc.sha256,
        source="upload",
        pipeline="lite",
        parser=doc.parser.value,
        status="PROCESSING",
        page_count=doc.page_count,
        pages=[p.model_dump() for p in doc.pages],
        owner_session=x_session_id,
        expires_at=expires,
    )
    if existing is not None:
        db.delete(existing)
        db.flush()
    db.add(row)
    db.commit()
    background.add_task(_index_upload, doc, x_session_id, expires)
    return UploadResponse(document=_doc_out(row), warnings=warnings)


def _index_upload(doc, owner_session: str, expires: datetime) -> None:
    with get_session_factory()() as session:
        try:
            index_document(
                doc,
                session=session,
                store=get_store(),
                dense=get_dense(),
                sparse=get_sparse(),
                source="upload",
                pipeline="lite",
                title=doc.filename.removesuffix(".pdf"),
                owner_session=owner_session,
                expires_at=expires,
            )
        except Exception as exc:
            log.exception("indexing failed for %s", doc.document_id)
            session.rollback()
            row = session.get(DocumentRow, doc.document_id)
            if row is not None:
                row.status, row.error = "FAILED", str(exc)[:500]
                session.commit()


@router.delete("/documents/{document_id}", status_code=204)
def delete_document(
    document_id: str,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    x_session_id: str | None = Header(None),
) -> None:
    row = _get_visible(db, document_id, x_session_id)
    if row.source == "sample":
        raise HTTPException(403, "Sample documents cannot be deleted")
    _purge(db, row, settings)


def _purge(db: Session, row: DocumentRow, settings: Settings) -> None:
    get_store().delete_document(row.id)
    (Path(settings.files_dir) / f"{row.id}.pdf").unlink(missing_ok=True)
    db.delete(row)
    db.commit()


def cleanup_expired(db: Session, settings: Settings) -> int:
    now = datetime.now(UTC)
    rows = db.scalars(
        select(DocumentRow).where(DocumentRow.source == "upload", DocumentRow.expires_at.is_not(None))
    ).all()
    expired = [
        r for r in rows if r.expires_at and r.expires_at.replace(tzinfo=r.expires_at.tzinfo or UTC) < now
    ]
    for r in expired:
        _purge(db, r, settings)
    return len(expired)
