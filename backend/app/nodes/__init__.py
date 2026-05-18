"""Node registry — auto-discovers all node implementations.

At import time, this module walks the nodes/ package tree and imports
every `node` submodule. Each node's __init_subclass__ hook automatically
registers it into BaseNode._registry.

Usage:
    from app.nodes import NODE_REGISTRY
    NodeClass = NODE_REGISTRY.get("flashcard")
"""

import importlib
import logging
import pkgutil
from pathlib import Path

logger = logging.getLogger(__name__)


def _import_all_nodes() -> None:
    """Walk all sub-packages and import modules named 'node'.

    This triggers __init_subclass__ in _base.py, which populates
    BaseNode._registry automatically.
    """
    package_dir = Path(__file__).parent

    for finder, name, is_pkg in pkgutil.walk_packages(
        [str(package_dir)], prefix=f"{__package__}."
    ):
        # Only import modules named "node" (e.g., app.nodes.generation.flashcard.node)
        if name.endswith(".node"):
            try:
                importlib.import_module(name)  # nosec B404 # nosemgrep: python.lang.security.audit.non-literal-import.non-literal-import
            except Exception as e:
                logger.warning("Failed to import node module '%s': %s", name, e)


# Run auto-discovery on import
_import_all_nodes()

# Re-export the populated registry
from app.nodes._base import BaseNode  # noqa: E402

NODE_REGISTRY: dict[str, type[BaseNode]] = BaseNode.get_registry()

__all__ = ["NODE_REGISTRY", "BaseNode"]
