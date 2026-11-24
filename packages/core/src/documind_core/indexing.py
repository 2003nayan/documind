"""Shared indexing step used by both the offline pipeline and lite uploads."""

from datetime import datetime

from sqlalchemy.orm import Session

from documind_core.chunking import chunk_document
from documind_core.db import save_document
from documind_core.embeddings import Bm25Sparse, DenseEmbedder
from documind_core.schemas import Chunk, ParsedDocument
from documind_core.vectorstore import VectorStore


def index_document(
    doc: ParsedDocument,
    *,
    session: Session,
    store: VectorStore,
    dense: DenseEmbedder,
    sparse: Bm25Sparse,
    source: str,
    pipeline: str,
    title: str | None = None,
    owner_session: str | None = None,
    expires_at: datetime | None = None,
) -> list[Chunk]:
    chunks = chunk_document(doc)
    texts = [c.embedding_text() for c in chunks]
    dense_vectors = dense.embed_documents(texts) if texts else []
    sparse_vectors = sparse.embed_documents(texts) if texts else []
    store.ensure_collection()
    store.delete_document(doc.document_id)
    if chunks:
        store.upsert(chunks, dense_vectors, sparse_vectors)
    save_document(
        session,
        doc,
        chunks,
        source=source,
        pipeline=pipeline,
        title=title,
        owner_session=owner_session,
        expires_at=expires_at,
    )
    session.commit()
    return chunks
