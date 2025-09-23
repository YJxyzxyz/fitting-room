from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Tuple

from ..utils.logging import get_logger
from .geometry import Mesh, create_box
from .pretrained import PretrainedLibrary, compute_pose_features, summarize_features
from .pose import PoseResult


logger = get_logger(__name__)


@dataclass
class GarmentColorway:
    id: str
    name: str
    color: Tuple[float, float, float, float]
    hex_code: str


@dataclass
class GarmentSize:
    id: str
    scale: float


@dataclass
class GarmentDefinition:
    id: str
    name: str
    category: str
    colorways: Dict[str, GarmentColorway]
    sizes: Dict[str, GarmentSize]
    width_factor: float = 1.2
    height_factor: float = 1.4
    depth: float = 0.12


class GarmentManager:
    def __init__(self, garment_root: Path) -> None:
        self.garment_root = garment_root
        self._garments = self._load_garments(garment_root)
        self._pretrained = PretrainedLibrary(garment_root / "models")

    def _load_garments(self, garment_root: Path) -> Dict[str, GarmentDefinition]:
        manifest_path = garment_root / "garments.json"
        data = json.loads(manifest_path.read_text())
        garments: Dict[str, GarmentDefinition] = {}
        for entry in data.get("garments", []):
            colorways: Dict[str, GarmentColorway] = {}
            for color in entry.get("colorways", []):
                rgba = _parse_color(color["color"])
                colorways[color["id"]] = GarmentColorway(
                    id=color["id"],
                    name=color.get("name", color["id"]),
                    color=rgba,
                    hex_code=_normalize_hex(color["color"]),
                )
            sizes = {name: GarmentSize(id=name, scale=float(spec.get("scale", 1.0))) for name, spec in entry.get("sizes", {}).items()}
            garments[entry["id"]] = GarmentDefinition(
                id=entry["id"],
                name=entry.get("name", entry["id"]),
                category=entry.get("category", "unknown"),
                colorways=colorways,
                sizes=sizes,
                width_factor=float(entry.get("width_factor", 1.2)),
                height_factor=float(entry.get("height_factor", 1.4)),
                depth=float(entry.get("depth", 0.12)),
            )
        logger.info("Loaded %d garment definitions", len(garments))
        return garments

    def list_garments(self) -> List[Dict[str, object]]:
        return [
            {
                "id": garment.id,
                "name": garment.name,
                "category": garment.category,
                "sizes": list(garment.sizes.keys()),
                "colorways": [
                    {"id": color.id, "name": color.name, "color": color.hex_code}
                    for color in garment.colorways.values()
                ],
                "supports_physics": self._pretrained.has_model(garment.id),
            }
            for garment in self._garments.values()
        ]

    def build_garment_mesh(
        self,
        pose: PoseResult,
        garment_id: str,
        size_id: str | None,
        color_id: str | None,
    ) -> Tuple[Mesh, GarmentColorway, Dict[str, object]]:
        garment = self._garments[garment_id]
        colorway = self._resolve_colorway(garment, color_id)
        scale = garment.sizes.get(size_id, GarmentSize(id="default", scale=1.0)).scale if garment.sizes else 1.0
        keypoints = pose.keypoints
        shoulder_width = abs(keypoints["shoulder_r"][0] - keypoints["shoulder_l"][0])
        hip_width = abs(keypoints["hip_r"][0] - keypoints["hip_l"][0])
        garment_width = max(shoulder_width, hip_width) * garment.width_factor * scale
        garment_height = (keypoints["hip_l"][1] - keypoints["neck"][1]) * -garment.height_factor * scale
        depth = garment.depth * scale
        center_x = (keypoints["shoulder_r"][0] + keypoints["shoulder_l"][0]) / 2.0
        center_y = (keypoints["neck"][1] + keypoints["hip_l"][1]) / 2.0
        center_z = 0.02 * pose.scale
        pose_features = compute_pose_features(pose.keypoints, pose.scale)
        generator_metadata: Dict[str, object] = {
            "pose_features": dict(pose_features),
            "pose_features_summary": summarize_features(pose_features),
            "center": [center_x, center_y, center_z],
            "size": [garment_width, garment_height, depth],
        }
        if self._pretrained.has_model(garment_id):
            generated = self._pretrained.generate(
                garment_id,
                pose_features=pose_features,
                target_center=(center_x, center_y, center_z),
                target_size=(garment_width, garment_height, depth if depth > 1e-5 else 0.08 * pose.scale),
                base_color=colorway.color,
            )
            mesh = generated.mesh
            generator_metadata.update(generated.metadata)
            generator_metadata["mode"] = "pretrained"
        else:
            mesh = create_box((center_x, center_y, center_z), (garment_width, garment_height, depth), colorway.color)
            generator_metadata["mode"] = "analytic"
            generator_metadata.setdefault("pinned_vertices", [])
            generator_metadata["vertex_count"] = mesh.vertex_count
        return mesh, colorway, generator_metadata

    def _resolve_colorway(self, garment: GarmentDefinition, color_id: str | None) -> GarmentColorway:
        if color_id and color_id in garment.colorways:
            return garment.colorways[color_id]
        if color_id:
            for color in garment.colorways.values():
                if color.name.lower() == color_id.lower():
                    return color
        return next(iter(garment.colorways.values()))


def _parse_color(code: str) -> Tuple[float, float, float, float]:
    code = code.lstrip("#")
    if len(code) not in (6, 8):
        raise ValueError(f"Invalid color code '{code}'")
    r = int(code[0:2], 16)
    g = int(code[2:4], 16)
    b = int(code[4:6], 16)
    a = int(code[6:8], 16) if len(code) == 8 else 255
    return (r / 255.0, g / 255.0, b / 255.0, a / 255.0)


def _normalize_hex(code: str) -> str:
    code = code.lstrip("#")
    if len(code) == 6:
        code += "ff"
    if len(code) != 8:
        raise ValueError(f"Invalid color code '{code}'")
    return "#" + code.lower()


