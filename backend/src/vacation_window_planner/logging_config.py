"""Minimal JSON logging for public-POC operational events."""

import json
import logging
from datetime import UTC, datetime


class JsonLogFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "event": record.getMessage(),
        }
        for name in ("http_method", "http_path", "http_status", "duration_ms"):
            if hasattr(record, name):
                payload[name] = getattr(record, name)
        return json.dumps(payload, separators=(",", ":"))


def configure_json_logging() -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(JsonLogFormatter())
    logger = logging.getLogger("vacation_window_planner")
    logger.handlers = [handler]
    logger.setLevel(logging.INFO)
    logger.propagate = False
