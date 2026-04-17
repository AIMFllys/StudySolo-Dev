"""Entry point registered as ``studysolo-mcp``."""

import asyncio

from studysolo_mcp.server import serve


def main() -> None:
    asyncio.run(serve())


if __name__ == "__main__":
    main()
