"""CLI helper `open <file>` to request opening a file in the web IDE."""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

OPEN_URL = "http://localhost:3000/openRequest"


def main() -> None:
    """Validate target file and send an openRequest POST to workbench-service."""
    if len(sys.argv) < 2:
        print(f"Usage {os.path.basename(sys.argv[0])} <file>")
        sys.exit(1)

    file_path = sys.argv[1]
    if not os.access(file_path, os.F_OK):
        print(f"ENOENT: no such file or directory, access '{file_path}'", file=sys.stderr)
        sys.exit(1)

    if not os.path.isfile(file_path):
        print(f"{file_path} is not a file!", file=sys.stderr)
        sys.exit(1)

    full_path = os.path.abspath(file_path)
    payload = json.dumps({"fullPath": full_path, "path": file_path}).encode("utf-8")
    req = urllib.request.Request(
        OPEN_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status != 200:
                print("Service unavailable", file=sys.stderr)
                sys.exit(1)
    except (urllib.error.URLError, OSError):
        print("Service unavailable", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
