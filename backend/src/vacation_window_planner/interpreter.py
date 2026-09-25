"""Gemini-backed conversion of text into editable structured proposals."""

from typing import Protocol

import httpx
from pydantic import BaseModel, ConfigDict, Field, StrictInt, ValidationError, field_validator

from vacation_window_planner.domain.contracts import YearMonth


class InterpretationError(ValueError):
    """Provider output could not be validated as a search proposal."""


class ConstraintProposalFields(BaseModel):
    model_config = ConfigDict(extra="forbid")

    balance_days: StrictInt | None = Field(default=None, ge=0)
    allowed_negative_days: StrictInt = Field(default=0, ge=0, le=5)
    country_code: str | None = Field(default=None, pattern=r"^[A-Z]{2}$")
    months: tuple[YearMonth, ...] = ()
    preferred_length_days: StrictInt | None = Field(default=None, gt=0)
    weekend_days: frozenset[StrictInt] | None = None

    @field_validator("weekend_days")
    @classmethod
    def weekend_days_must_be_valid(cls, value: frozenset[int] | None) -> frozenset[int] | None:
        if value is not None and any(day < 0 or day > 6 for day in value):
            raise ValueError("weekend days must use Monday=0 through Sunday=6")
        return value


class ConstraintProposal(ConstraintProposalFields):
    source_text: str
    missing_fields: tuple[str, ...]


class GeminiStructuredClient(Protocol):
    def generate_json(self, prompt: str, schema: dict[str, object]) -> str: ...


class _GeminiPart(BaseModel):
    text: str


class _GeminiContent(BaseModel):
    parts: tuple[_GeminiPart, ...] = Field(min_length=1)


class _GeminiCandidate(BaseModel):
    content: _GeminiContent


class _GeminiResponse(BaseModel):
    candidates: tuple[_GeminiCandidate, ...] = Field(min_length=1)


class HttpGeminiStructuredClient:
    """Small REST adapter for Gemini structured JSON output."""

    def __init__(self, *, api_key: str, model: str, timeout_seconds: float = 20.0) -> None:
        self._api_key = api_key
        self._model = model
        self._timeout_seconds = timeout_seconds

    def generate_json(self, prompt: str, schema: dict[str, object]) -> str:
        try:
            response = httpx.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{self._model}:generateContent",
                headers={"x-goog-api-key": self._api_key},
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "responseMimeType": "application/json",
                        "responseJsonSchema": schema,
                    },
                },
                timeout=self._timeout_seconds,
            )
            response.raise_for_status()
            parsed = _GeminiResponse.model_validate(response.json())
            return parsed.candidates[0].content.parts[0].text
        except (httpx.HTTPError, ValidationError, IndexError) as error:
            raise InterpretationError("Gemini interpretation failed") from error


class GeminiConstraintInterpreter:
    def __init__(self, client: GeminiStructuredClient) -> None:
        self._client = client

    def interpret(self, text: str) -> ConstraintProposal:
        prompt = (
            "Extract only editable vacation search fields from the user's text. "
            "Do not search, rank dates, or invent missing values. User text: "
            f"{text}"
        )
        raw = self._client.generate_json(
            prompt,
            ConstraintProposalFields.model_json_schema(),
        )
        try:
            fields = ConstraintProposalFields.model_validate_json(raw)
        except ValidationError as error:
            raise InterpretationError("Gemini output could not be validated") from error

        missing: list[str] = []
        if fields.balance_days is None:
            missing.append("balance_days")
        if fields.country_code is None:
            missing.append("country_code")
        if not fields.months:
            missing.append("months")
        if fields.preferred_length_days is None:
            missing.append("preferred_length_days")
        return ConstraintProposal(
            **fields.model_dump(),
            source_text=text,
            missing_fields=tuple(missing),
        )
