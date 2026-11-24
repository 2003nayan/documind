import hashlib
import re

import pymupdf
import pytest
from app import deps
from app.config import Settings, get_settings
from app.llm.extractive import ExtractiveProvider
from documind_core.db import init_db, make_engine, make_session_factory
from documind_core.vectorstore import VectorStore
from fastapi.testclient import TestClient
from qdrant_client import QdrantClient, models

_WORD = re.compile(r"[a-z0-9]+")


class HashDense:
    """Deterministic bag-of-words hashing embedder: no model download in tests."""

    name = "test-hash"
    dim = 64

    def _vec(self, text: str) -> list[float]:
        v = [0.0] * self.dim
        for w in _WORD.findall(text.lower()):
            v[int(hashlib.md5(w.encode()).hexdigest(), 16) % self.dim] += 1.0
        return v if any(v) else [1.0] + [0.0] * (self.dim - 1)

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [self._vec(t) for t in texts]

    def embed_query(self, text: str) -> list[float]:
        return self._vec(text)


class HashSparse:
    def _vec(self, text: str) -> models.SparseVector:
        counts: dict[int, float] = {}
        for w in _WORD.findall(text.lower()):
            i = int(hashlib.md5(w.encode()).hexdigest(), 16) % 100_000
            counts[i] = counts.get(i, 0) + 1.0
        return models.SparseVector(indices=list(counts), values=list(counts.values()))

    def embed_documents(self, texts: list[str]) -> list[models.SparseVector]:
        return [self._vec(t) for t in texts]

    def embed_query(self, text: str) -> models.SparseVector:
        return self._vec(text)


def make_pdf(pages: list[str]) -> bytes:
    doc = pymupdf.open()
    for text in pages:
        page = doc.new_page()
        page.insert_text((72, 72), "Section Heading", fontsize=18)
        page.insert_textbox(pymupdf.Rect(72, 100, 520, 700), text, fontsize=11)
    return doc.tobytes()


@pytest.fixture
def client(tmp_path):
    settings = Settings(
        database_url=f"sqlite:///{tmp_path}/test.db",
        files_dir=str(tmp_path / "files"),
        llm_provider="extractive",
        chats_per_ip_per_day=5,
        uploads_per_ip_per_day=2,
    )
    engine = make_engine(settings.database_url)
    init_db(engine)
    factory = make_session_factory(engine)
    dense, sparse = HashDense(), HashSparse()
    store = VectorStore(QdrantClient(":memory:"), "test", dense.name, dense.dim)

    def get_db():
        with factory() as s:
            yield s

    originals = {
        n: getattr(deps, n)
        for n in ("get_session_factory", "get_dense", "get_sparse", "get_store", "get_providers")
    }
    from app.api import routes

    patches = {
        "get_session_factory": lambda: factory,
        "get_dense": lambda: dense,
        "get_sparse": lambda: sparse,
        "get_store": lambda: store,
        "get_providers": lambda: [ExtractiveProvider()],
        "get_vision_provider": lambda: None,
    }
    saved = {n: getattr(routes, n) for n in patches}
    for n, fn in patches.items():
        setattr(routes, n, fn)

    from app.main import create_app

    app = create_app()
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[deps.get_db] = get_db
    with TestClient(app) as c:
        c.headers["X-Session-Id"] = "test-session"
        yield c
    for n, fn in saved.items():
        setattr(routes, n, fn)
    del originals
