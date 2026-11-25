"""Grounded answering: retrieve -> prompt with tagged sources -> validate citations.

The model only sees short source ids (S1, S2, ...). Any citation whose id was
not retrieved, or whose quote does not appear in that source, is discarded.
"""

import json
import logging
import re
import time
from dataclasses import dataclass, field
from difflib import SequenceMatcher

from documind_core.schemas import Chunk

from app.llm.base import LLMError, LLMProvider, LLMRequest, QuotaExceededError

log = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are DocuMind, a document question-answering assistant.
Answer ONLY from the numbered sources provided. Never use outside knowledge.
Return JSON: {"answer": string, "found": boolean, "citations": [{"source_id": "S1", "quote": string}]}
Rules:
- Every factual claim must be supported by at least one citation.
- "quote" must be copied verbatim from the cited source (a short span, max ~200 characters).
- If the sources do not contain the answer, return {"answer": "", "found": false, "citations": []}.
- Keep the answer concise. Use Markdown lists or tables when helpful."""

NOT_FOUND = "I couldn't find this in the selected documents."
MIN_QUOTE_MATCH = 0.85


@dataclass
class ValidatedCitation:
    chunk_id: str
    document_id: str
    page_number: int
    quote: str
    bboxes: list[dict] = field(default_factory=list)


@dataclass
class AnswerResult:
    answer: str
    found: bool
    citations: list[ValidatedCitation]
    provider: str
    model: str
    latency_ms: int
    chunks_considered: int
    dropped_citations: int = 0
    warning: str | None = None


def build_prompt(question: str, chunks: list[Chunk], titles: dict[str, str]) -> str:
    sources = []
    for i, c in enumerate(chunks, start=1):
        title = titles.get(c.document_id, c.document_id)
        header = f'<source id="S{i}" document="{title}" page="{c.page_number}" type="{c.chunk_type}">'
        sources.append(f"{header}\n{c.content}\n</source>")
    return "SOURCES:\n" + "\n\n".join(sources) + f"\n\nQUESTION: {question}\n"


def answer_question(
    question: str,
    chunks: list[Chunk],
    titles: dict[str, str],
    providers: list[LLMProvider],
) -> AnswerResult:
    if not chunks:
        return AnswerResult(NOT_FOUND, False, [], "none", "none", 0, 0)

    request = LLMRequest(system=SYSTEM_PROMPT, prompt=build_prompt(question, chunks, titles))
    start = time.perf_counter()
    response = None
    last_error: Exception | None = None
    for provider in providers:
        try:
            response = provider.generate(request)
            break
        except (QuotaExceededError, LLMError) as exc:
            log.warning("LLM %s/%s failed, trying next: %s", provider.name, provider.model, str(exc)[:200])
            last_error = exc
    if response is None:
        raise last_error or LLMError("No LLM provider configured")
    latency_ms = int((time.perf_counter() - start) * 1000)

    payload = parse_json(response.text)
    citations, dropped = validate_citations(payload.get("citations") or [], chunks)
    answer = str(payload.get("answer") or "").strip()
    found = bool(payload.get("found")) and bool(answer)

    warning = None
    if found and not citations:
        warning = "The model's answer could not be matched to the documents, so it was withheld."
        answer, found = NOT_FOUND, False
    elif not found:
        answer = NOT_FOUND

    return AnswerResult(
        answer=answer,
        found=found,
        citations=citations,
        provider=response.provider,
        model=response.model,
        latency_ms=latency_ms,
        chunks_considered=len(chunks),
        dropped_citations=dropped,
        warning=warning,
    )


def parse_json(text: str) -> dict:
    cleaned = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.M).strip()
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, re.S)
        if not match:
            return {}
        try:
            data = json.loads(match.group(0))
        except json.JSONDecodeError:
            return {}
    return data if isinstance(data, dict) else {}


def validate_citations(raw: list, chunks: list[Chunk]) -> tuple[list[ValidatedCitation], int]:
    by_ref = {f"S{i}": c for i, c in enumerate(chunks, start=1)}
    valid: list[ValidatedCitation] = []
    seen: set[tuple[str, str]] = set()
    dropped = 0
    for item in raw:
        if not isinstance(item, dict):
            dropped += 1
            continue
        chunk = by_ref.get(str(item.get("source_id", "")).strip())
        quote = str(item.get("quote", "")).strip()
        if chunk is None or not quote or not quote_supported(quote, chunk.content):
            dropped += 1
            continue
        key = (chunk.chunk_id, quote)
        if key in seen:
            continue
        seen.add(key)
        valid.append(
            ValidatedCitation(
                chunk_id=chunk.chunk_id,
                document_id=chunk.document_id,
                page_number=chunk.page_number,
                quote=quote,
                bboxes=[b.model_dump() for b in chunk.bboxes],
            )
        )
    return valid, dropped


def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower()).strip()


def quote_supported(quote: str, source: str) -> bool:
    q, s = _norm(quote), _norm(source)
    if q in s:
        return True
    if len(q) < 12:
        return False
    match = SequenceMatcher(None, s, q, autojunk=False).find_longest_match(0, len(s), 0, len(q))
    if match.size / len(q) >= MIN_QUOTE_MATCH:
        return True
    window = s[max(0, match.a - match.b) : match.a - match.b + len(q) + 10]
    return SequenceMatcher(None, window, q, autojunk=False).ratio() >= MIN_QUOTE_MATCH
