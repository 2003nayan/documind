"""Relational metadata (Postgres in production; SQLite works for tests)."""

from datetime import UTC, date, datetime

from sqlalchemy import (
    JSON,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    Text,
    create_engine,
    select,
)
from sqlalchemy.engine import Engine
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    Session,
    mapped_column,
    relationship,
    sessionmaker,
)

from documind_core.schemas import Chunk, ParsedDocument


def _now() -> datetime:
    return datetime.now(UTC)


class Base(DeclarativeBase):
    pass


class DocumentRow(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    filename: Mapped[str] = mapped_column(String(255))
    title: Mapped[str | None] = mapped_column(String(255))
    sha256: Mapped[str] = mapped_column(String(64))
    source: Mapped[str] = mapped_column(String(16))  # demo | upload
    pipeline: Mapped[str] = mapped_column(String(16))  # full | lite
    parser: Mapped[str] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(16), default="READY")
    error: Mapped[str | None] = mapped_column(Text)
    page_count: Mapped[int] = mapped_column(Integer, default=0)
    pages: Mapped[list] = mapped_column(JSON, default=list)
    owner_session: Mapped[str | None] = mapped_column(String(64), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    chunks: Mapped[list["ChunkRow"]] = relationship(back_populates="document", cascade="all, delete-orphan")


class DocumentFileRow(Base):
    """Uploaded PDF bytes. Free hosts have ephemeral disks, so uploads live in the database.

    No FK on purpose: save_document replaces the document row, which must not cascade here.
    """

    __tablename__ = "document_files"

    document_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    data: Mapped[bytes] = mapped_column(LargeBinary)


class ChunkRow(Base):
    __tablename__ = "chunks"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    page_number: Mapped[int] = mapped_column(Integer)
    chunk_type: Mapped[str] = mapped_column(String(16))
    section: Mapped[str | None] = mapped_column(Text)
    content: Mapped[str] = mapped_column(Text)
    bboxes: Mapped[list] = mapped_column(JSON, default=list)

    document: Mapped[DocumentRow] = relationship(back_populates="chunks")

    def to_chunk(self) -> Chunk:
        return Chunk(
            chunk_id=self.id,
            document_id=self.document_id,
            page_number=self.page_number,
            chunk_type=self.chunk_type,  # type: ignore[arg-type]
            section=self.section,
            content=self.content,
            bboxes=self.bboxes or [],
        )


class ConversationRow(Base):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    session_id: Mapped[str] = mapped_column(String(64), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    messages: Mapped[list["MessageRow"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan", order_by="MessageRow.id"
    )


class MessageRow(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    conversation_id: Mapped[str] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(16))
    content: Mapped[str] = mapped_column(Text)
    citations: Mapped[list] = mapped_column(JSON, default=list)
    model: Mapped[str | None] = mapped_column(String(128))
    latency_ms: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    conversation: Mapped[ConversationRow] = relationship(back_populates="messages")


class UsageCounterRow(Base):
    __tablename__ = "usage_counters"

    day: Mapped[date] = mapped_column(Date, primary_key=True)
    subject: Mapped[str] = mapped_column(String(80), primary_key=True)  # ip hash or "global"
    action: Mapped[str] = mapped_column(String(16), primary_key=True)  # chat | upload
    count: Mapped[int] = mapped_column(Integer, default=0)


def make_engine(url: str) -> Engine:
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
    return create_engine(url, pool_pre_ping=True, connect_args=connect_args)


def save_document(
    session: Session,
    doc: ParsedDocument,
    chunks: list[Chunk],
    *,
    source: str,
    pipeline: str,
    title: str | None = None,
    owner_session: str | None = None,
    expires_at: datetime | None = None,
) -> DocumentRow:
    existing = session.get(DocumentRow, doc.document_id)
    if existing is not None:
        session.delete(existing)
        session.flush()
    row = DocumentRow(
        id=doc.document_id,
        filename=doc.filename,
        title=title,
        sha256=doc.sha256,
        source=source,
        pipeline=pipeline,
        parser=doc.parser.value,
        status="READY",
        page_count=doc.page_count,
        pages=[p.model_dump() for p in doc.pages],
        owner_session=owner_session,
        expires_at=expires_at,
    )
    row.chunks = [
        ChunkRow(
            id=c.chunk_id,
            document_id=c.document_id,
            page_number=c.page_number,
            chunk_type=c.chunk_type.value,
            section=c.section,
            content=c.content,
            bboxes=[b.model_dump() for b in c.bboxes],
        )
        for c in chunks
    ]
    session.add(row)
    return row


def load_chunks(session: Session, chunk_ids: list[str]) -> dict[str, Chunk]:
    rows = session.scalars(select(ChunkRow).where(ChunkRow.id.in_(chunk_ids))).all()
    return {r.id: r.to_chunk() for r in rows}


def init_db(engine: Engine) -> None:
    Base.metadata.create_all(engine)


def make_session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(engine, expire_on_commit=False)
