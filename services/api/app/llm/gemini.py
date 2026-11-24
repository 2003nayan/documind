from app.llm.base import LLMError, LLMRequest, LLMResponse, QuotaExceededError


class GeminiProvider:
    name = "gemini"
    supports_vision = True

    def __init__(self, api_key: str, model: str) -> None:
        from google import genai
        from google.genai import types

        self._client = genai.Client(
            api_key=api_key,
            # Fail fast and let the provider chain fall back instead of retrying on a 512 MB host.
            http_options=types.HttpOptions(timeout=30_000, retry_options=types.HttpRetryOptions(attempts=1)),
        )
        self.model = model

    def generate(self, request: LLMRequest) -> LLMResponse:
        from google.genai import errors, types

        parts: list[types.Part] = [
            types.Part.from_bytes(data=img.data, mime_type=img.mime_type) for img in request.images
        ]
        parts.append(types.Part.from_text(text=request.prompt))
        config = types.GenerateContentConfig(
            system_instruction=request.system,
            temperature=request.temperature,
            response_mime_type="application/json" if request.json_output else "text/plain",
        )
        try:
            resp = self._client.models.generate_content(
                model=self.model, contents=[types.Content(role="user", parts=parts)], config=config
            )
        except errors.APIError as exc:
            if exc.code == 429:
                raise QuotaExceededError(str(exc)) from exc
            raise LLMError(str(exc)) from exc
        return LLMResponse(text=resp.text or "", provider=self.name, model=self.model)
