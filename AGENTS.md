# Repository Guidelines

## Project Structure

- `packages/core/src/documind_core/` holds shared schemas, chunking, embeddings, indexing, and storage.
- `pipeline/src/documind_pipeline/` contains the Docling parser and offline ingestion CLI. `services/api/app/` contains FastAPI routes, retrieval, upload parsing, and LLM providers.
- `apps/web/src/` contains Next.js routes, React components, and the API client. Static assets live in `apps/web/public/`.
- Python tests live in `packages/core/tests/` and `services/api/tests/`. Demo PDFs and their checksum manifest live in `datasets/`. The evaluation runner and gold questions live in `eval/`.

## Local Development and CI

- Use Python 3.12 with `uv`, Node 22, and Docker. From the root, run `cp .env.example .env`, `docker compose up -d` to start Postgres and Qdrant, and `uv sync` to install the Python workspace.
- Run `uv run documind-pipeline ingest-samples` to parse and index the bundled PDFs. From `services/api/`, run `uv run uvicorn app.main:app --port 8000` to serve the API.
- From `apps/web/`, run `npm ci` to install locked dependencies, `npm run dev` to start Next.js, `npm run lint` to check ESLint, and `npm run build` to verify the production build.
- For CI-style Python checks, run `uv sync --frozen --package documind-api --group dev`, then use `uv run --no-sync` with `ruff check .`, `ruff format --check .`, and `mypy packages/core/src services/api/app`.

## Coding Style

Use four spaces and `snake_case` for Python modules and functions. Ruff formats at 110 columns. Follow the existing two-space TypeScript style and use `PascalCase` for React components such as `PdfViewer.tsx`.

## Testing

Name pytest files and functions `test_*.py` and `test_*`. Run `uv run --no-sync pytest -q packages/core/tests services/api/tests` after the CI-style sync. Tests use SQLite and in-memory Qdrant. CI sets no coverage threshold. For retrieval changes, run `uv run python eval/run_eval.py` against the indexed samples.

## Commits and Pull Requests

Use short, action-oriented subjects, such as `Accept plain postgresql:// URLs from hosted Postgres`. Describe the change and checks run in the PR, link related issues when available, and include screenshots for visible UI changes.
