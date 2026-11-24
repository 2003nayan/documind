import json

from app.llm.base import LLMError, LLMRequest, LLMResponse
from app.llm.extractive import ExtractiveProvider
from app.services.answering import NOT_FOUND, answer_question, parse_json, quote_supported, validate_citations
from documind_core.schemas import Chunk, ChunkType

CHUNKS = [
    Chunk(
        chunk_id="d_c0000",
        document_id="d",
        page_number=3,
        chunk_type=ChunkType.TEXT,
        content="The NEMA Premium efficiency for a 50 hp, 4-pole motor is 95.0 percent.",
    ),
    Chunk(
        chunk_id="d_c0001",
        document_id="d",
        page_number=7,
        chunk_type=ChunkType.TEXT,
        content="Motors should be rewound by qualified service centers to preserve efficiency.",
    ),
]


class Fake:
    name, model, supports_vision = "fake", "fake-1", False

    def __init__(self, payload: dict | str) -> None:
        self.payload = payload

    def generate(self, request: LLMRequest) -> LLMResponse:
        text = self.payload if isinstance(self.payload, str) else json.dumps(self.payload)
        return LLMResponse(text=text, provider=self.name, model=self.model)


class Broken(Fake):
    def generate(self, request: LLMRequest) -> LLMResponse:
        raise LLMError("down")


def test_valid_citation_kept_and_mapped_to_page() -> None:
    res = answer_question(
        "efficiency of 50 hp motor",
        CHUNKS,
        {},
        [
            Fake(
                {
                    "answer": "95.0 percent.",
                    "found": True,
                    "citations": [{"source_id": "S1", "quote": "a 50 hp, 4-pole motor is 95.0 percent"}],
                }
            )
        ],
    )
    assert res.found and res.citations[0].page_number == 3 and res.dropped_citations == 0


def test_hallucinated_source_and_quote_are_dropped() -> None:
    res = answer_question(
        "q",
        CHUNKS,
        {},
        [
            Fake(
                {
                    "answer": "It is 99 percent.",
                    "found": True,
                    "citations": [
                        {"source_id": "S9", "quote": "anything"},
                        {"source_id": "S2", "quote": "the motor is 99 percent efficient always"},
                    ],
                }
            )
        ],
    )
    assert not res.found and res.answer == NOT_FOUND and res.dropped_citations == 2 and res.warning


def test_not_found_and_fallback_provider() -> None:
    res = answer_question(
        "q", CHUNKS, {}, [Broken({}), Fake({"answer": "", "found": False, "citations": []})]
    )
    assert res.provider == "fake" and not res.found and res.answer == NOT_FOUND


def test_no_chunks_short_circuits() -> None:
    assert answer_question("q", [], {}, [Fake({})]).answer == NOT_FOUND


def test_parse_json_handles_fences_and_garbage() -> None:
    assert parse_json('```json\n{"a": 1}\n```') == {"a": 1}
    assert parse_json('Sure! {"a": 2} hope that helps') == {"a": 2}
    assert parse_json("nope") == {}


def test_quote_supported_tolerates_whitespace_and_small_ocr_noise() -> None:
    src = "Rated   output is 50\nhorsepower at 1800 rpm."
    assert quote_supported("rated output is 50 horsepower", src)
    assert quote_supported("Rated output is 5O horsepower at 1800 rpm", src)
    assert not quote_supported("Rated output is 75 kilowatts at 3600 rpm", src)


def test_duplicate_citations_deduplicated() -> None:
    raw = [{"source_id": "S2", "quote": "qualified service centers"}] * 2
    valid, dropped = validate_citations(raw, CHUNKS)
    assert len(valid) == 1 and dropped == 0


def test_extractive_provider_end_to_end() -> None:
    res = answer_question("Who should rewind motors?", CHUNKS, {}, [ExtractiveProvider()])
    assert res.found and res.citations[0].page_number == 7
