"""Keep all backend tests offline even when developer credentials are configured."""

import pydantic_ai.models

pydantic_ai.models.ALLOW_MODEL_REQUESTS = False
