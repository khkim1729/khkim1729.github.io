#!/usr/bin/env python3
"""Keep the bundled portfolio snapshot aligned with the CV fallback."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CV_PATH = ROOT / "assets/data/cv-content.json"
SNAPSHOT_PATH = ROOT / "assets/data/portfolio-data.json"


def main() -> None:
    cv_rows = json.loads(CV_PATH.read_text(encoding="utf-8"))
    snapshot = json.loads(SNAPSHOT_PATH.read_text(encoding="utf-8"))
    snapshot["sheets"]["CV_Content"] = cv_rows
    SNAPSHOT_PATH.write_text(
        json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
