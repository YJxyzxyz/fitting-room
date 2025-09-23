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
from .physics import ClothSimulator, export_simulation
from .render import combine_meshes, export_gltf, render_preview


logger = get_logger(__name__)


@dataclass
class TryOnArtifacts:
    model_path: Path
    preview_path: Path
    simulation_path: Path | None
    metadata: Dict[str, object]


class TryOnPipeline:
    def __init__(self, assets_root: Path | None = None) -> None:
        self.assets_root = assets_root or settings.assets_dir
        self.pose_estimator = PoseEstimator()
        self.garment_manager = GarmentManager(self.assets_root / "garments")
        self.cloth_simulator = ClothSimulator()

    def run(
        self,
        image_path: Path,
        output_root: Path,
        garment_id: str,
        size: str | None = None,
        color: str | None = None,
    ) -> TryOnArtifacts:
        logger.info("Starting pipeline: image=%s garment=%s size=%s color=%s", image_path, garment_id, size, color)
        pose = self.pose_estimator.estimate(image_path)
        body_mesh = create_body_mesh(pose)
        garment_mesh, colorway, garment_metadata = self.garment_manager.build_garment_mesh(
            pose,
            garment_id=garment_id,
            size_id=size,
            color_id=color,
        )
        combined_mesh = combine_meshes([body_mesh, garment_mesh])
        ensure_directory(output_root)
        model_path = output_root / "scene.gltf"
        preview_path = output_root / "preview.svg"
        simulation_path: Path | None = None
        export_gltf(combined_mesh, model_path)
        render_preview(pose, colorway.color, preview_path)

        simulation_metadata: Dict[str, object] | None = None
        if garment_mesh.indices:
            try:
                simulation = self.cloth_simulator.simulate(
                    garment_mesh,
                    indices=garment_mesh.indices,
                    pinned_vertices=garment_metadata.get("pinned_vertices", []),
                    pose_features=garment_metadata.get("pose_features", {}),
                )
                simulation_path = output_root / "cloth_simulation.json"
                export_simulation(simulation, simulation_path)
                simulation_metadata = {
                    "frame_rate": simulation.frame_rate,
                    "frame_count": len(simulation.frames),
                    "pinned_vertices": list(simulation.pinned_vertices),
                    "file": simulation_path.name,
                }
            except Exception as exc:  # pragma: no cover - ensure robustness to physics issues
                logger.warning("Failed to simulate cloth dynamics: %s", exc)

        metadata = {
            "garment": {
                "id": garment_id,
                "size": size,
                "color": colorway.id,
                "color_hex": colorway.hex_code,
                "color_name": colorway.name,
                "generator": garment_metadata,
            },
            "pose": {
                "keypoints": [
                    {"name": name, "position": list(coords)} for name, coords in pose.ordered_keypoints()
                ],
                "bounding_box": list(map(float, pose.bounding_box)),
                "scale": pose.scale,
            },
        }
        if simulation_metadata:
            metadata["simulation"] = simulation_metadata
        logger.info("Pipeline finished for %s", image_path)
        return TryOnArtifacts(
            model_path=model_path,
            preview_path=preview_path,
            simulation_path=simulation_path,
            metadata=metadata,
        )


