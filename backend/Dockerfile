FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:0.11.7 /uv /uvx /bin/
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-install-project
COPY . .
RUN uv sync --locked

ENV PATH="/app/.venv/bin:$PATH"
CMD ["uvicorn", "vacation_window_planner.main:app", "--host", "0.0.0.0", "--port", "8000"]
