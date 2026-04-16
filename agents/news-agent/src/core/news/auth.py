"""Authentication and API key handling."""

import json
import os
from typing import Dict, Optional, Tuple

from fastapi import Header, HTTPException


def _service_key() -> str:
    return os.environ.get("AGENT_API_KEY") or os.environ.get("NEWSAGENTS_API_KEY", "")


def verify_auth(authorization: Optional[str] = Header(None)) -> str:
    """Verify the Bearer token. Returns the token if valid."""
    service_key = _service_key()
    if not service_key:
        return ""  # No auth configured, allow all

    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid Authorization format. Use: Bearer <key>")

    token = authorization[7:]
    if token != service_key:
        raise HTTPException(status_code=401, detail="Invalid API key")

    return token


def parse_source_keys(x_source_keys: Optional[str] = Header(None, alias="X-Source-Keys")) -> Dict[str, str]:
    """Parse the X-Source-Keys header containing data source API keys.

    Expected format: JSON object, e.g.:
    {"SCRAPECREATORS_API_KEY": "xxx", "EXA_API_KEY": "xxx"}
    """
    if not x_source_keys:
        return {}
    try:
        keys = json.loads(x_source_keys)
        if not isinstance(keys, dict):
            raise HTTPException(status_code=400, detail="X-Source-Keys must be a JSON object")
        return keys
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="X-Source-Keys must be valid JSON")
