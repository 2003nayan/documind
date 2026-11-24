"""Qdrant storage and hybrid (dense + BM25) retrieval with reciprocal rank fusion."""

from dataclasses import dataclass

from qdrant_client import QdrantClient, models

from documind_core.embeddings import DenseEmbedder, SparseVector
from documind_core.ids import point_id_for
from documind_core.schemas import Chunk

SPARSE_NAME = "bm25"


@dataclass(frozen=True)
class SearchHit:
    chunk_id: str
    document_id: str
    page_number: int
    score: float


class VectorStore:
    def __init__(self, client: QdrantClient, collection: str, dense_name: str, dim: int) -> None:
        self.client = client
        self.collection = collection
        self.dense_name = dense_name
        self.dim = dim

    def ensure_collection(self) -> None:
        if not self.client.collection_exists(self.collection):
            self.client.create_collection(
                self.collection,
                vectors_config={
                    self.dense_name: models.VectorParams(size=self.dim, distance=models.Distance.COSINE)
                },
                sparse_vectors_config={SPARSE_NAME: models.SparseVectorParams(modifier=models.Modifier.IDF)},
            )
            for field in ("document_id", "chunk_type"):
                self.client.create_payload_index(self.collection, field, models.PayloadSchemaType.KEYWORD)
            return
        info = self.client.get_collection(self.collection)
        vectors = info.config.params.vectors
        if not isinstance(vectors, dict) or self.dense_name not in vectors:
            raise RuntimeError(
                f"Collection '{self.collection}' was built with a different embedding model; "
                f"expected vector '{self.dense_name}'. Re-index or change QDRANT_COLLECTION."
            )

    def upsert(self, chunks: list[Chunk], dense: list[list[float]], sparse: list[SparseVector]) -> None:
        points = [
            models.PointStruct(
                id=point_id_for(c.chunk_id),
                vector={self.dense_name: d, SPARSE_NAME: s},  # type: ignore[dict-item]
                payload={
                    "chunk_id": c.chunk_id,
                    "document_id": c.document_id,
                    "page_number": c.page_number,
                    "chunk_type": c.chunk_type.value,
                    "section": c.section,
                },
            )
            for c, d, s in zip(chunks, dense, sparse, strict=True)
        ]
        for start in range(0, len(points), 128):
            self.client.upsert(self.collection, points[start : start + 128], wait=True)

    def delete_document(self, document_id: str) -> None:
        self.client.delete(
            self.collection,
            points_selector=models.FilterSelector(filter=_doc_filter([document_id])),
            wait=True,
        )

    def hybrid_search(
        self,
        dense_query: list[float],
        sparse_query: SparseVector,
        document_ids: list[str] | None,
        limit: int = 8,
        prefetch_limit: int = 30,
    ) -> list[SearchHit]:
        flt = _doc_filter(document_ids) if document_ids else None
        result = self.client.query_points(
            self.collection,
            prefetch=[
                models.Prefetch(query=dense_query, using=self.dense_name, filter=flt, limit=prefetch_limit),
                models.Prefetch(
                    query=sparse_query,  # type: ignore[arg-type]
                    using=SPARSE_NAME,
                    filter=flt,
                    limit=prefetch_limit,
                ),
            ],
            query=models.FusionQuery(fusion=models.Fusion.RRF),
            limit=limit,
            with_payload=True,
        )
        return [
            SearchHit(
                chunk_id=p.payload["chunk_id"],
                document_id=p.payload["document_id"],
                page_number=int(p.payload["page_number"]),
                score=float(p.score),
            )
            for p in result.points
            if p.payload
        ]


def _doc_filter(document_ids: list[str]) -> models.Filter:
    return models.Filter(
        must=[models.FieldCondition(key="document_id", match=models.MatchAny(any=document_ids))]
    )


def build_vector_store(
    url: str, api_key: str | None, collection: str, embedder: DenseEmbedder
) -> VectorStore:
    client = QdrantClient(url=url, api_key=api_key or None, timeout=30)
    return VectorStore(client, collection, embedder.name, embedder.dim)
