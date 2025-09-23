from __future__ import annotations

import json
from pathlib import Path

import pytest

from backend.pipeline.tryon_service import TryOnPipeline


@pytest.fixture(scope="module")
def pipeline() -> TryOnPipeline:
    return TryOnPipeline()


def _create_dummy_ppm(image_path: Path, width: int = 160, height: int = 280) -> None:
    with image_path.open("w") as file_obj:
        file_obj.write(f"P3\n{width} {height}\n255\n")
        for _ in range(height):
            row = " ".join(["200 200 200" for _ in range(width)])
            file_obj.write(row + "\n")


def test_pipeline_creates_assets(pipeline: TryOnPipeline, tmp_path: Path) -> None:
    image_path = tmp_path / "dummy.ppm"
    _create_dummy_ppm(image_path)
    output_dir = tmp_path / "result"
    artifacts = pipeline.run(image_path=image_path, output_root=output_dir, garment_id="tshirt_basic", size="M", color="classic-white")
    assert artifacts.model_path.exists()
    assert artifacts.preview_path.exists()
    assert artifacts.simulation_path is not None
    assert artifacts.simulation_path.exists()
    assert artifacts.model_path.suffix == ".gltf"
    assert artifacts.preview_path.suffix == ".svg"
    assert artifacts.simulation_path.suffix == ".json"
    data = artifacts.model_path.read_text()
    assert "meshes" in data
    simulation_payload = json.loads(artifacts.simulation_path.read_text())
    assert simulation_payload["frame_count"] >= 1
    assert simulation_payload["frame_rate"] > 0
    assert simulation_payload["frames"]
    metadata = artifacts.metadata
    assert metadata["garment"]["id"] == "tshirt_basic"
    assert metadata["pose"]["keypoints"]
    generator_meta = metadata["garment"]["generator"]
    assert generator_meta["mode"] == "pretrained"
    assert "pose_features_summary" in generator_meta
    assert metadata["simulation"]["frame_count"] == simulation_payload["frame_count"]
    assert metadata["simulation"]["file"] == artifacts.simulation_path.name
