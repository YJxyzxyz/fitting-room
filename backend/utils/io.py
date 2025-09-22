from __future__ import annotations

import shutil
import uuid
from pathlib import Path
from .logging import get_logger


logger = get_logger(__name__)


def generate_task_id() -> str:
    return uuid.uuid4().hex


def ensure_directory(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def clear_directory(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True, exist_ok=True)


def relative_to(path: Path, root: Path) -> str:
    return str(path.relative_to(root)).replace("\\", "/")


