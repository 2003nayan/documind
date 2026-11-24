import httpx

from app.llm.base import LLMError, LLMRequest, LLMResponse, QuotaExceededError

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


class OpenRouterProvider:
    """OpenAI-compatible fallback for text-only questions (free model variants)."""

    name = "openrouter"
    supports_vision = False

    def __init__(self, api_key: str, model: str) -> None:
        self._api_key = api_key
        self.model = model

    def generate(self, request: LLMRequest) -> LLMResponse:
        if request.images:
            raise LLMError("OpenRouter fallback is configured as text-only")
        body: dict = {
            "model": self.model,
            "temperature": request.temperature,
            "messages": [
                {"role": "system", "content": request.system},
                {"role": "user", "content": request.prompt},
            ],
        }
        if request.json_output:
            body["response_format"] = {"type": "json_object"}
        try:
            resp = httpx.post(
                OPENROUTER_URL,
                json=body,
                headers={"Authorization": f"Bearer {self._api_key}"},
                timeout=60,
            )
        except httpx.HTTPError as exc:
            raise LLMError(str(exc)) from exc
        if resp.status_code == 429:
            raise QuotaExceededError(resp.text)
        if resp.status_code >= 400:
            raise LLMError(f"OpenRouter {resp.status_code}: {resp.text[:300]}")
        text = resp.json()["choices"][0]["message"]["content"] or ""
        return LLMResponse(text=text, provider=self.name, model=self.model)
