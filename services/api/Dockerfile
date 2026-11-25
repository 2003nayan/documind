# Serving image for a free 512 MB host (Render / Koyeb). Build from the repo root:
#   docker build -f services/api/Dockerfile -t documind-api .
FROM python:3.12-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy \
    FASTEMBED_CACHE_PATH=/app/.fastembed
COPY --from=ghcr.io/astral-sh/uv:0.9 /uv /usr/local/bin/uv
WORKDIR /app

COPY pyproject.toml uv.lock ./
COPY packages/core packages/core
COPY services/api services/api
COPY pipeline/pyproject.toml pipeline/pyproject.toml
RUN mkdir -p pipeline/src/documind_pipeline && touch pipeline/src/documind_pipeline/__init__.py \
    && uv sync --frozen --no-dev --package documind-api

# Bake the embedding models and sample PDFs into the image: no downloads on cold start.
COPY datasets datasets
COPY scripts scripts
RUN .venv/bin/python -c "from fastembed import TextEmbedding, SparseTextEmbedding; \
TextEmbedding('BAAI/bge-small-en-v1.5'); SparseTextEmbedding('Qdrant/bm25')" \
    && .venv/bin/python scripts/fetch_samples.py --files-dir data/files

ENV PATH="/app/.venv/bin:$PATH" FILES_DIR=/app/data/files
WORKDIR /app/services/api
EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
