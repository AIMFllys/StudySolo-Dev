"""CLI entrypoint registered as ``studysolo``."""

from studysolo_cli.app import app


def main() -> None:
    app()


if __name__ == "__main__":
    main()
