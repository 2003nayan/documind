"""Dense and sparse embedders.

The same dense model must embed both documents and queries; the vector name in
Qdrant is derived from the model so different models can never be mixed.
"""

import re
from functools import lru_cache
from typing import Protocol

from documind_core.config import CoreSettings, get_core_settings


class DenseEmbedder(Protocol):
    name: str
    dim: int

    def embed_documents(self, texts: list[str]) -> list[list[float]]: ...

    def embed_query(self, text: str) -> list[float]: ...


class SparseVector(Protocol):
    indices: list[int]
    values: list[float]


def vector_name(model: str) -> str:
    return "dense_" + re.sub(r"[^a-z0-9]+", "_", model.lower()).strip("_")


class FastEmbedDense:
    """Local ONNX embeddings (no API key). bge models expect a query instruction prefix."""

    def __init__(self, model: str) -> None:
        from fastembed import TextEmbedding

        self._model = TextEmbedding(model_name=model)
        self.name = vector_name(model)
        self.dim = len(next(iter(self._model.embed(["dimension probe"]))))

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [v.tolist() for v in self._model.passage_embed(texts)]

    def embed_query(self, text: str) -> list[float]:
        return next(iter(self._model.query_embed(text))).tolist()


class GeminiDense:
    """Hosted embeddings via the Gemini API free tier (keeps the serving process tiny)."""

    def __init__(self, api_key: str, model: str, dim: int) -> None:
        from google import genai

        self._client = genai.Client(api_key=api_key)
        self._model = model
        self.dim = dim
        self.name = vector_name(f"{model}_{dim}")

    def _embed(self, texts: list[str], task: str) -> list[list[float]]:
        from google.genai import types

        out: list[list[float]] = []
        for start in range(0, len(texts), 100):
            resp = self._client.models.embed_content(
                model=self._model,
                contents=texts[start : start + 100],  # type: ignore[arg-type]
                config=types.EmbedContentConfig(task_type=task, output_dimensionality=self.dim),
            )
            out.extend(list(e.values or []) for e in resp.embeddings or [])
        return out

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return self._embed(texts, "RETRIEVAL_DOCUMENT")

    def embed_query(self, text: str) -> list[float]:
        return self._embed([text], "RETRIEVAL_QUERY")[0]


class Bm25Sparse:
    """Keyword vectors for exact matches (model codes, serial numbers). Qdrant applies IDF."""

    name = "bm25"

    def __init__(self) -> None:
        from fastembed import SparseTextEmbedding

        self._model = SparseTextEmbedding(model_name="Qdrant/bm25")

    def embed_documents(self, texts: list[str]) -> list[SparseVector]:
        return [_sparse(v) for v in self._model.embed(texts)]

    def embed_query(self, text: str) -> SparseVector:
        return _sparse(next(iter(self._model.query_embed(text))))


def _sparse(v: object) -> SparseVector:
    from qdrant_client import models

    return models.SparseVector(
        indices=v.indices.tolist(),  # type: ignore[attr-defined]
        values=v.values.tolist(),  # type: ignore[attr-defined]
    )


def build_dense_embedder(settings: CoreSettings) -> DenseEmbedder:
    if settings.embedding_provider == "gemini":
        if not settings.gemini_api_key:
            raise ValueError("EMBEDDING_PROVIDER=gemini requires GEMINI_API_KEY")
        return GeminiDense(
            settings.gemini_api_key, settings.gemini_embedding_model, settings.gemini_embedding_dim
        )
    if settings.embedding_provider == "fastembed":
        return FastEmbedDense(settings.fastembed_model)
    raise ValueError(f"Unknown EMBEDDING_PROVIDER: {settings.embedding_provider}")


@lru_cache
def get_dense_embedder() -> DenseEmbedder:
    return build_dense_embedder(get_core_settings())


@lru_cache
def get_sparse_embedder() -> Bm25Sparse:
    return Bm25Sparse()
