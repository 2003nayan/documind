from documind_core.db import load_chunks
from documind_core.embeddings import Bm25Sparse, DenseEmbedder
from documind_core.schemas import Chunk
from documind_core.vectorstore import VectorStore
from sqlalchemy.orm import Session


def retrieve(
    question: str,
    *,
    session: Session,
    store: VectorStore,
    dense: DenseEmbedder,
    sparse: Bm25Sparse,
    document_ids: list[str] | None,
    limit: int,
) -> list[Chunk]:
    hits = store.hybrid_search(
        dense.embed_query(question), sparse.embed_query(question), document_ids, limit=limit
    )
    by_id = load_chunks(session, [h.chunk_id for h in hits])
    # Qdrant order is the fused rank; drop hits whose metadata row is gone.
    return [by_id[h.chunk_id] for h in hits if h.chunk_id in by_id]
