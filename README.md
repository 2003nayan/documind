# DocuMind: grounded Q&A over complex PDFs

Ask questions about technical manuals, scanned reports and table-heavy documents, and get answers whose
citations point to the exact page and region, **verified server-side** against the retrieved text.

Runs on free tiers only: no paid services, no credit card.

## Architecture

```
            OFFLINE (laptop, 14 GB RAM, CPU)                       ONLINE (free tiers)
 ┌──────────────────────────────────────────────┐   ┌───────────────────────────────────────────┐
 │ PDF ─► Docling (layout, TableFormer, OCR)    │   │ Next.js (Vercel) ─► /api proxy            │
 │     ─► canonical blocks (page + bbox)        │   │        │                                  │
 │     ─► page-aware chunks                     │   │ FastAPI (512 MB host)                     │
 │     ─► bge-small dense + BM25 sparse ────────┼──►│   hybrid search (Qdrant RRF) ─► LLM       │
 │     ─► Qdrant Cloud + Neon Postgres          │   │   ─► citation validation ─► answer        │
 └──────────────────────────────────────────────┘   │ Live uploads: PyMuPDF (+ Gemini vision)   │
                                                    └───────────────────────────────────────────┘
```

**Why split?** Docling's layout/table/OCR models need several GB of RAM; free hosts give 512 MB.
The curated corpus is processed offline with the full pipeline; the server only embeds queries,
searches and calls the LLM. Live uploads use a lightweight PyMuPDF path, with a vision LLM for scanned pages.

### Grounding contract
1. Retrieved chunks are shown to the model as `S1..Sn`; it must return JSON with `source_id` + verbatim `quote`.
2. The server drops citations whose id was not retrieved or whose quote is not in that chunk
   (whitespace/OCR-tolerant fuzzy match, threshold 0.85).
3. An answer with no surviving citation is withheld and replaced with "not found".

## Repository layout

| Path | What |
|---|---|
| `packages/core` | Shared schema, chunking, embeddings, Qdrant + SQL storage, indexing |
| `pipeline` | Offline Docling parser and `documind-pipeline` CLI |
| `services/api` | FastAPI serving API, LLM providers (Gemini / OpenRouter / extractive), lite upload parser, quotas |
| `apps/web` | Next.js UI: document list, chat, PDF viewer with citation highlights |
| `eval` | Gold questions and evaluation runner |
| `datasets/samples.json` | Public-domain demo corpus (pinned SHA-256) |

## Local setup

Requires [uv](https://docs.astral.sh/uv/), Node 22 and Docker (or free Qdrant Cloud + Neon URLs in `.env`).

```bash
cp .env.example .env
docker compose up -d                       # Postgres + Qdrant
uv sync                                    # Python 3.12 workspace (CPU torch)
uv run python scripts/fetch_samples.py     # download demo PDFs
uv run documind-pipeline ingest-samples    # Docling parse + index (~3-5 min on 8 CPU cores)

cd services/api && uv run uvicorn app.main:app --port 8000
cd apps/web && npm install && npm run dev  # http://localhost:3000
```

Without an API key `LLM_PROVIDER=extractive` answers by quoting the best retrieved sentence, so the full
flow works offline. Set `LLM_PROVIDER=gemini` and `GEMINI_API_KEY` (free from Google AI Studio) for real answers.

## Tests and evaluation

```bash
uv run pytest -q                     # core + API (in-memory Qdrant, SQLite, no downloads)
uv run python eval/run_eval.py       # Recall@5, MRR@10 on eval/gold.jsonl
uv run python eval/run_eval.py --answers --sleep 6   # + answer match, citation page accuracy, abstention
```

## Results

29 hand-labelled questions over the 3 sample PDFs (`eval/gold.jsonl`: scanned, text, table, figure and
3 unanswerable). Raw outputs are in `eval/results/`.

| Metric | Extractive stand-in | Gemini 3.5 Flash-Lite |
|---|---|---|
| Recall@5 (gold page retrieved) | 100% | 100% |
| MRR@10 | 0.81 | 0.83 |
| Answer contains expected fact | 65% | 92% |
| Unanswerable questions refused | 1 / 3 | 3 / 3 |
| Cited page is a gold page | 77% | 83% |
| Retrieval p50 / LLM p50 | 8 ms / - | 15 ms / 0.9 s |

Caveat: the gold set is small and was written from the documents, so retrieval scores are optimistic.

## Free-tier limits

| Service | Free tier | Used for |
|---|---|---|
| Qdrant Cloud | 1 GB RAM cluster | vectors |
| Neon | 0.5 GB Postgres | documents, chunks, chats, quotas |
| Gemini API | per-model RPM/RPD caps | answers, vision OCR for uploads |
| Render / Koyeb | 512 MB, sleeps when idle | FastAPI |
| Vercel Hobby | static + proxy | frontend |

Demo guardrails: 10 MB / 20 pages per upload, 3 uploads and 30 questions per IP per day, 400 questions/day
globally, uploads deleted after 24 h. Free-tier Gemini traffic may be used by Google to improve its
products, so don't upload private documents to the public demo.
