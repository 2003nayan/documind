"""Process-wide singletons, created lazily so the app boots fast on a cold start."""

from collections.abc import Iterator
from functools import lru_cache

from documind_core.db import init_db, make_engine, make_session_factory
from documind_core.embeddings import Bm25Sparse, DenseEmbedder, build_dense_embedder
from documind_core.vectorstore import VectorStore, build_vector_store
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import Settings, get_settings
from app.llm.base import LLMProvider
from app.llm.factory import build_provider


@lru_cache
def get_engine() -> Engine:
    engine = make_engine(get_settings().database_url)
    init_db(engine)
    return engine


@lru_cache
def get_session_factory() -> sessionmaker[Session]:
    return make_session_factory(get_engine())


def get_db() -> Iterator[Session]:
    with get_session_factory()() as session:
        yield session


@lru_cache
def get_dense() -> DenseEmbedder:
    return build_dense_embedder(get_settings())


@lru_cache
def get_sparse() -> Bm25Sparse:
    return Bm25Sparse()


@lru_cache
def get_store() -> VectorStore:
    s = get_settings()
    return build_vector_store(s.qdrant_url, s.qdrant_api_key, s.qdrant_collection, get_dense())


@lru_cache
def get_providers() -> list[LLMProvider]:
    s: Settings = get_settings()
    providers = [build_provider(s.llm_provider, s), build_provider(s.llm_fallback_provider, s)]
    return [p for p in providers if p is not None]


def get_vision_provider() -> LLMProvider | None:
    return next((p for p in get_providers() if p.supports_vision), None)
