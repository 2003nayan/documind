"""Retrieval + answer evaluation against a hand-labelled gold set.

    uv run python eval/run_eval.py                 # retrieval only (no LLM quota used)
    uv run python eval/run_eval.py --answers       # also call the configured LLM

Metrics
- Recall@k: a chunk from an expected page of the expected document is in the top k.
- MRR@10: reciprocal rank of the first such chunk.
- Citation page accuracy: share of validated citations that land on an expected page.
- Answer match: every expected key fact (case-insensitive substring) appears in the answer.
- Abstention: unanswerable questions must come back as not-found.
"""

import argparse
import json
import statistics
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services" / "api"))

from app.config import get_settings  # noqa: E402
from app.deps import get_dense, get_providers, get_session_factory, get_sparse, get_store  # noqa: E402
from app.services.answering import answer_question  # noqa: E402
from app.services.retrieval import retrieve  # noqa: E402
from documind_core.db import DocumentRow  # noqa: E402


def load_gold(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--gold", type=Path, default=ROOT / "eval" / "gold.jsonl")
    parser.add_argument(
        "--answers", action="store_true", help="Also generate answers with the configured LLM"
    )
    parser.add_argument("--k", type=int, default=5)
    parser.add_argument("--out", type=Path, default=ROOT / "eval" / "results")
    parser.add_argument("--sleep", type=float, default=0.0, help="Seconds between LLM calls (free-tier RPM)")
    args = parser.parse_args()

    settings = get_settings()
    gold = load_gold(args.gold)
    session = get_session_factory()()
    docs = {r.id: r for r in session.query(DocumentRow).all()}
    by_slug = {Path(r.filename).stem: r.id for r in docs.values()}
    all_ids = list(docs)

    rows = []
    for g in gold:
        doc_id = by_slug.get(g["document"]) if g.get("document") else None
        scope = [doc_id] if doc_id and not g.get("search_all") else all_ids
        start = time.perf_counter()
        chunks = retrieve(
            g["question"],
            session=session,
            store=get_store(),
            dense=get_dense(),
            sparse=get_sparse(),
            document_ids=scope,
            limit=max(10, settings.retrieval_limit),
        )
        retrieval_ms = (time.perf_counter() - start) * 1000
        pages = set(g.get("pages") or [])
        rank = next(
            (i for i, c in enumerate(chunks, 1) if c.document_id == doc_id and c.page_number in pages), None
        )
        row = {
            "id": g["id"],
            "type": g.get("type", "text"),
            "answerable": bool(pages),
            "pages": sorted(pages),
            "rank": rank,
            "retrieval_ms": round(retrieval_ms, 1),
        }
        if args.answers:
            result = answer_question(
                g["question"],
                chunks[: settings.retrieval_limit],
                {d: docs[d].title or d for d in docs},
                get_providers(),
            )
            facts = [f.lower() for f in g.get("facts", [])]
            row.update(
                found=result.found,
                answer=result.answer,
                citation_pages=[c.page_number for c in result.citations if c.document_id == doc_id],
                citations=len(result.citations),
                dropped=result.dropped_citations,
                answer_match=bool(facts) and all(f in result.answer.lower() for f in facts),
                llm_ms=result.latency_ms,
            )
            if args.sleep:
                time.sleep(args.sleep)
        rows.append(row)
        print(f"{g['id']:>6}  rank={rank}  {row.get('found', '')}")

    summary = summarize(rows, args.k, args.answers)
    args.out.mkdir(parents=True, exist_ok=True)
    stamp = time.strftime("%Y%m%d-%H%M%S")
    (args.out / f"{stamp}.json").write_text(json.dumps({"summary": summary, "rows": rows}, indent=1))
    print(json.dumps(summary, indent=1))
    return 0


def summarize(rows: list[dict], k: int, answers: bool) -> dict:
    answerable = [r for r in rows if r["answerable"]]
    out: dict = {
        "questions": len(rows),
        "answerable": len(answerable),
        f"recall@{k}": _ratio(sum(1 for r in answerable if r["rank"] and r["rank"] <= k), len(answerable)),
        "mrr@10": round(
            sum(1 / r["rank"] for r in answerable if r["rank"] and r["rank"] <= 10) / max(1, len(answerable)),
            3,
        ),
        "retrieval_ms_p50": round(statistics.median(r["retrieval_ms"] for r in rows), 1) if rows else None,
        "by_type": {},
    }
    for t in sorted({r["type"] for r in answerable}):
        sub = [r for r in answerable if r["type"] == t]
        out["by_type"][t] = {
            "n": len(sub),
            f"recall@{k}": _ratio(sum(1 for r in sub if r["rank"] and r["rank"] <= k), len(sub)),
        }
    if answers:
        cited = [(p, r["pages"]) for r in answerable for p in r["citation_pages"]]
        unanswerable = [r for r in rows if not r["answerable"]]
        out.update(
            answer_match=_ratio(sum(1 for r in answerable if r["answer_match"]), len(answerable)),
            answered=_ratio(sum(1 for r in answerable if r["found"]), len(answerable)),
            abstention=_ratio(sum(1 for r in unanswerable if not r["found"]), len(unanswerable)),
            citation_page_accuracy=_ratio(sum(1 for p, pages in cited if p in pages), len(cited)),
            citations_total=len(cited),
            citations_dropped=sum(r["dropped"] for r in rows),
            llm_ms_p50=round(statistics.median(r["llm_ms"] for r in rows), 1) if rows else None,
        )
    return out


def _ratio(num: int, den: int) -> float | None:
    return round(num / den, 3) if den else None


if __name__ == "__main__":
    sys.exit(main())
