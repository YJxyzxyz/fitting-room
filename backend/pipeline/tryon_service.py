from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict

from ..core.config import settings
from ..utils.io import ensure_directory
from ..utils.logging import get_logger
from .garment import GarmentManager
from .geometry import create_body_mesh
from .pose import PoseEstimator
from .render import combine_meshes, export_gltf, render_preview


logger = get_logger(__name__)


@dataclass
class TryOnArtifacts:
    model_path: Path
    preview_path: Path
    metadata: Dict[str, object]


class TryOnPipeline:
    def __init__(self, assets_root: Path | None = None) -> None:
        self.assets_root = assets_root or settings.assets_dir
        self.pose_estimator = PoseEstimator()
        self.garment_manager = GarmentManager(self.assets_root / "garments")

    def run(self, image_path: Path, output_root: Path, garment_id: str, size: str | None = None, color: str | None = None) -> TryOnArtifacts:
        logger.info("Starting pipeline: image=%s garment=%s size=%s color=%s", image_path, garment_id, size, color)
        pose = self.pose_estimator.estimate(image_path)
        body_mesh = create_body_mesh(pose)
        garment_mesh, colorway = self.garment_manager.build_garment_mesh(pose, garment_id=garment_id, size_id=size, color_id=color)
        combined_mesh = combine_meshes([body_mesh, garment_mesh])
        ensure_directory(output_root)
        model_path = output_root / "scene.gltf"
        preview_path = output_root / "preview.svg"
        export_gltf(combined_mesh, model_path)
        render_preview(pose, colorway.color, preview_path)
        metadata = {
            "garment": {
                "id": garment_id,
                "size": size,
                "color": colorway.id,
                "color_hex": colorway.hex_code,
                "color_name": colorway.name,
            },
            "pose": {
                "keypoints": [
                    {"name": name, "position": list(coords)} for name, coords in pose.ordered_keypoints()
                ],
                "bounding_box": list(map(float, pose.bounding_box)),
                "scale": pose.scale,
            },
        }
        logger.info("Pipeline finished for %s", image_path)
        return TryOnArtifacts(model_path=model_path, preview_path=preview_path, metadata=metadata)


