"""Offline stand-in used when no API key is configured (local dev, tests, CI).

It does not generate language: it quotes the best-matching retrieved sentence,
so the whole pipeline (retrieval -> citation validation -> UI) can be exercised
without spending any LLM quota.
"""

import json
import re

from app.llm.base import LLMRequest, LLMResponse

_WORD = re.compile(r"[a-z0-9]+")


class ExtractiveProvider:
    name = "extractive"
    model = "extractive-baseline"
    supports_vision = False

    def generate(self, request: LLMRequest) -> LLMResponse:
        question = _between(request.prompt, "QUESTION:", "\n") or request.prompt
        q_terms = set(_WORD.findall(question.lower())) - _STOP
        best: tuple[float, str, str] = (0.0, "", "")
        for ref, body in re.findall(r"<source id=\"(S\d+)\"[^>]*>\n(.*?)\n</source>", request.prompt, re.S):
            for sentence in re.split(r"(?<=[.!?])\s+|\n", body):
                terms = set(_WORD.findall(sentence.lower()))
                if not terms:
                    continue
                score = len(q_terms & terms) / (len(q_terms) or 1)
                if score > best[0]:
                    best = (score, ref, sentence.strip())
        if best[0] < 0.2:
            payload = {"answer": "", "found": False, "citations": []}
        else:
            payload = {
                "answer": best[2],
                "found": True,
                "citations": [{"source_id": best[1], "quote": best[2]}],
            }
        return LLMResponse(text=json.dumps(payload), provider=self.name, model=self.model)


def _between(text: str, start: str, end: str) -> str:
    i = text.find(start)
    if i < 0:
        return ""
    j = text.find(end, i + len(start))
    return text[i + len(start) : j if j > 0 else None].strip()


_STOP = {
    "the",
    "a",
    "an",
    "is",
    "are",
    "was",
    "what",
    "which",
    "who",
    "how",
    "of",
    "in",
    "on",
    "for",
    "to",
    "and",
    "or",
    "does",
    "do",
    "it",
    "this",
    "that",
    "with",
    "by",
    "be",
    "at",
    "as",
    "from",
}
