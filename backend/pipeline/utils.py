from __future__ import annotations

import struct
from pathlib import Path
from typing import Tuple

from ..utils.logging import get_logger


logger = get_logger(__name__)


def read_image_size(path: Path) -> Tuple[int, int]:
    try:
        with path.open("rb") as file_obj:
            signature = file_obj.read(24)
            if signature.startswith(b"\x89PNG\r\n\x1a\n"):
                width, height = struct.unpack(">II", signature[16:24])
                return int(width), int(height)
            if signature[:2] == b"\xff\xd8":
                file_obj.seek(0)
                size = _read_jpeg_size(file_obj)
                if size:
                    return size
            if signature.startswith(b"P6") or signature.startswith(b"P3"):
                file_obj.seek(0)
                size = _read_ppm_size(file_obj)
                if size:
                    return size
    except Exception as exc:  # pragma: no cover - robust to IO issues
        logger.warning("Failed to read image size for %s: %s", path, exc)
    return (512, 800)


def _read_jpeg_size(file_obj) -> Tuple[int, int] | None:
    file_obj.seek(2)
    while True:
        marker_bytes = file_obj.read(2)
        if len(marker_bytes) < 2:
            return None
        marker = struct.unpack(">H", marker_bytes)[0]
        while marker == 0xFFFF:
            marker = struct.unpack(">H", file_obj.read(2))[0]
        if marker in (0xC0, 0xC1, 0xC2, 0xC3):
            length = struct.unpack(">H", file_obj.read(2))[0]
            data = file_obj.read(length - 2)
            height, width = struct.unpack(">HH", data[1:5])
            return int(width), int(height)
        else:
            length = struct.unpack(">H", file_obj.read(2))[0]
            file_obj.seek(length - 2, 1)


def _read_ppm_size(file_obj) -> Tuple[int, int] | None:
    header = file_obj.readline().strip()
    if header not in (b"P3", b"P6"):
        return None
    line = file_obj.readline()
    while line.startswith(b"#"):
        line = file_obj.readline()
    parts = line.strip().split()
    if len(parts) < 2:
        return None
    width, height = int(parts[0]), int(parts[1])
    return width, height


