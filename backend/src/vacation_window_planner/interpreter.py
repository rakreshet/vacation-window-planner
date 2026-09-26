"""Provider-neutral conversion of text into editable search proposals."""

from pydantic import BaseModel, ConfigDict, Field, StrictInt, field_validator
from pydantic_ai import Agent, ToolOutput
from pydantic_ai.models import Model
from pydantic_ai.models.google import GoogleModel
from pydantic_ai.models.xai import XaiModel
from pydantic_ai.providers.google import GoogleProvider
from pydantic_ai.providers.xai import XaiProvider
from pydantic_ai.settings import ModelSettings

from vacation_window_planner.domain.contracts import YearMonth
from vacation_window_planner.domain.workweek import default_weekend_days
from vacation_window_planner.settings import Settings


class InterpretationError(ValueError):
    """A model request failed or did not yield a valid search proposal."""


class InterpretationInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str = Field(min_length=1, max_length=4000)


class ModelProposalFields(BaseModel):
    """Only fields that the language model may propose."""

    model_config = ConfigDict(extra="forbid")

    balance_days: StrictInt | None = Field(default=None, ge=0)
    allowed_negative_days: StrictInt = Field(default=0, ge=0, le=5)
    country_code: str | None = Field(default=None, pattern=r"^[A-Z]{2}$")
    months: tuple[YearMonth, ...] = ()
    preferred_length_days: StrictInt | None = Field(default=None, gt=0)


class ConstraintProposalFields(ModelProposalFields):
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


class ConstraintInterpreter:
    """One Pydantic AI interpretation path regardless of selected model provider."""

    def __init__(self, model: Model) -> None:
        self._agent = Agent(
            model,
            output_type=ToolOutput(ModelProposalFields),
            instructions=(
                "Extract only editable vacation search fields from the user's text. "
                "Do not search, rank dates, or invent missing values. "
                "Leave a field unset when the user has not supplied it. "
                "Return country_code as an uppercase ISO 3166-1 alpha-2 code when clear. "
                "Do not infer or return working days or weekend days; the application "
                "derives the default workweek from the country."
            ),
            model_settings=ModelSettings(timeout=20),
            retries=1,
        )

    def interpret(self, text: str) -> ConstraintProposal:
        validated_input = InterpretationInput(text=text)
        try:
            fields = self._agent.run_sync(validated_input.text).output
        except Exception:  # Provider SDKs expose different transport exceptions.
            raise InterpretationError("Interpretation provider failed") from None

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
            weekend_days=(
                default_weekend_days(fields.country_code)
                if fields.country_code is not None
                else None
            ),
            source_text=validated_input.text,
            missing_fields=tuple(missing),
        )


def build_interpreter(settings: Settings) -> ConstraintInterpreter | None:
    """Select a Pydantic AI provider; no key leaves structured search intact."""
    model: Model | None
    if settings.interpret_provider == "gemini":
        key = settings.gemini_api_key.get_secret_value() if settings.gemini_api_key else ""
        if key:
            model = GoogleModel(settings.gemini_model, provider=GoogleProvider(api_key=key))
        else:
            model = None
    else:
        key = settings.xai_api_key.get_secret_value() if settings.xai_api_key else ""
        if key:
            model = XaiModel(settings.xai_model, provider=XaiProvider(api_key=key, timeout=20))
        else:
            model = None
    return ConstraintInterpreter(model) if model is not None else None
