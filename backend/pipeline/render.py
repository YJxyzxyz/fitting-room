from __future__ import annotations

import base64
import json
import struct
from pathlib import Path
from typing import Dict, Iterable, List, Sequence, Tuple

from ..utils.logging import get_logger
from .geometry import Mesh
from .pose import PoseResult


logger = get_logger(__name__)


def combine_meshes(meshes: Sequence[Mesh]) -> Mesh:
    combined = Mesh()
    for mesh in meshes:
        combined.merge(mesh)
    return combined


def export_gltf(mesh: Mesh, output_path: Path) -> None:
    vertex_count = mesh.vertex_count
    if vertex_count == 0:
        raise ValueError("Mesh is empty")
    positions = _pack_floats(mesh.vertices)
    normals = _pack_floats(mesh.normals)
    colors = _pack_floats(mesh.colors)
    index_component_type = 5123 if vertex_count < 65536 else 5125
    index_data = _pack_indices(mesh.indices, use_short=index_component_type == 5123)
    buffer = _align_concat([positions, normals, colors, index_data])
    offsets = _compute_offsets([positions, normals, colors, index_data])
    accessor_min, accessor_max = _compute_min_max(mesh.vertices)
    gltf = {
        "asset": {"version": "2.0", "generator": "virtual-tryon-py"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0}],
        "meshes": [
            {
                "primitives": [
                    {
                        "attributes": {"POSITION": 0, "NORMAL": 1, "COLOR_0": 2},
                        "indices": 3,
                        "mode": 4,
                    }
                ]
            }
        ],
        "buffers": [
            {
                "uri": "data:application/octet-stream;base64," + base64.b64encode(buffer).decode("ascii"),
                "byteLength": len(buffer),
            }
        ],
        "bufferViews": [
            {"buffer": 0, "byteOffset": offsets[0], "byteLength": len(positions), "target": 34962},
            {"buffer": 0, "byteOffset": offsets[1], "byteLength": len(normals), "target": 34962},
            {"buffer": 0, "byteOffset": offsets[2], "byteLength": len(colors), "target": 34962},
            {"buffer": 0, "byteOffset": offsets[3], "byteLength": len(index_data), "target": 34963},
        ],
        "accessors": [
            {
                "bufferView": 0,
                "componentType": 5126,
                "count": vertex_count,
                "type": "VEC3",
                "min": accessor_min,
                "max": accessor_max,
            },
            {"bufferView": 1, "componentType": 5126, "count": vertex_count, "type": "VEC3"},
            {"bufferView": 2, "componentType": 5126, "count": vertex_count, "type": "VEC4"},
            {"bufferView": 3, "componentType": index_component_type, "count": len(mesh.indices), "type": "SCALAR"},
        ],
    }
    output_path.write_text(json.dumps(gltf))
    logger.info("glTF exported to %s (%d vertices)", output_path, vertex_count)


def render_preview(pose: PoseResult, garment_color: Tuple[float, float, float, float], output_path: Path) -> None:
    width, height = 480, 720
    points = {name: _project_to_2d(pos, width, height) for name, pos in pose.keypoints.items()}
    garment_fill = _rgba_to_svg(garment_color)
    lines = [
        f'<line x1="{points[a][0]:.1f}" y1="{points[a][1]:.1f}" x2="{points[b][0]:.1f}" y2="{points[b][1]:.1f}" stroke="#444" stroke-width="4" stroke-linecap="round" />'
        for a, b in pose.edges
    ]
    garment_box = _garment_rectangle(points)
    svg_content = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        '<rect width="100%" height="100%" fill="#f4f4f6" />',
    ]
    if garment_box:
        x, y, w, h = garment_box
        svg_content.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" fill="{garment_fill}" rx="18" ry="18" opacity="0.85" />')
    svg_content.extend(lines)
    svg_content.append('</svg>')
    output_path.write_text("\n".join(svg_content))
    logger.info("Preview SVG saved to %s", output_path)


def _pack_floats(values: Iterable[float]) -> bytes:
    return b"".join(struct.pack("<f", float(value)) for value in values)


def _pack_indices(indices: Iterable[int], use_short: bool) -> bytes:
    if use_short:
        return b"".join(struct.pack("<H", int(index)) for index in indices)
    return b"".join(struct.pack("<I", int(index)) for index in indices)


def _align_concat(parts: Sequence[bytes]) -> bytes:
    chunks = []
    offset = 0
    for part in parts:
        chunks.append(part)
        offset += len(part)
        padding = (4 - (offset % 4)) % 4
        if padding:
            chunks.append(b"\x00" * padding)
            offset += padding
    return b"".join(chunks)


def _compute_offsets(parts: Sequence[bytes]) -> List[int]:
    offsets = []
    current = 0
    for part in parts:
        offsets.append(current)
        current += len(part)
        padding = (4 - (current % 4)) % 4
        current += padding
    return offsets


def _compute_min_max(vertices: Sequence[float]) -> Tuple[list[float], list[float]]:
    xs = vertices[0::3]
    ys = vertices[1::3]
    zs = vertices[2::3]
    return [min(xs), min(ys), min(zs)], [max(xs), max(ys), max(zs)]


def _project_to_2d(point: Tuple[float, float, float], width: int, height: int) -> Tuple[float, float]:
    scale = min(width, height) * 0.35
    x = width / 2 + point[0] * scale
    y = height / 2 - point[1] * scale
    return x, y


def _garment_rectangle(points: Dict[str, Tuple[float, float]]) -> Tuple[float, float, float, float] | None:
    required = ["shoulder_l", "shoulder_r", "hip_l", "hip_r"]
    if not all(name in points for name in required):
        return None
    left = min(points["shoulder_l"][0], points["hip_l"][0])
    right = max(points["shoulder_r"][0], points["hip_r"][0])
    top = min(points["shoulder_l"][1], points["shoulder_r"][1]) - 20
    bottom = max(points["hip_l"][1], points["hip_r"][1]) + 20
    return left, top, right - left, bottom - top


def _rgba_to_svg(color: Tuple[float, float, float, float]) -> str:
    r, g, b, a = [max(0.0, min(1.0, component)) for component in color]
    return f"rgba({int(r * 255)}, {int(g * 255)}, {int(b * 255)}, {a:.2f})"


