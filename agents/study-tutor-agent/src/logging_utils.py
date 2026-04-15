import contextvars
import json
import logging
from datetime import datetime, timezone


request_id_var: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "request_id",
    default=None,
)
user_id_var: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "user_id",
    default=None,
)


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "message": record.getMessage(),
            "logger": record.name,
            "request_id": getattr(record, "request_id", None) or request_id_var.get(),
            "user_id": getattr(record, "user_id", None) or user_id_var.get(),
            "agent": getattr(record, "agent", None),
            "duration_ms": getattr(record, "duration_ms", None),
        }
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)


def configure_json_logging() -> None:
    root_logger = logging.getLogger()
    if not root_logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(JsonFormatter())
        root_logger.addHandler(handler)
    else:
        for handler in root_logger.handlers:
            handler.setFormatter(JsonFormatter())
    root_logger.setLevel(logging.INFO)
    logging.getLogger("src").setLevel(logging.INFO)
