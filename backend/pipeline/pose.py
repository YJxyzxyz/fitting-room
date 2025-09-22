from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

from ..utils.logging import get_logger
from . import utils


logger = get_logger(__name__)


CANONICAL_POINTS: Dict[str, Tuple[float, float, float]] = {
    "pelvis": (0.0, 0.0, 0.0),
    "spine": (0.0, 0.45, 0.0),
    "neck": (0.0, 0.8, 0.0),
    "head_top": (0.0, 1.1, 0.0),
    "shoulder_l": (-0.28, 0.78, 0.05),
    "shoulder_r": (0.28, 0.78, 0.05),
    "elbow_l": (-0.32, 0.45, 0.02),
    "elbow_r": (0.32, 0.45, 0.02),
    "wrist_l": (-0.32, 0.1, 0.02),
    "wrist_r": (0.32, 0.1, 0.02),
    "hip_l": (-0.2, -0.1, 0.0),
    "hip_r": (0.2, -0.1, 0.0),
    "knee_l": (-0.18, -0.7, 0.03),
    "knee_r": (0.18, -0.7, 0.03),
    "ankle_l": (-0.16, -1.2, 0.03),
    "ankle_r": (0.16, -1.2, 0.03),
}

POSE_EDGES: List[Tuple[str, str]] = [
    ("head_top", "neck"),
    ("neck", "spine"),
    ("spine", "pelvis"),
    ("shoulder_l", "neck"),
    ("shoulder_r", "neck"),
    ("shoulder_l", "elbow_l"),
    ("elbow_l", "wrist_l"),
    ("shoulder_r", "elbow_r"),
    ("elbow_r", "wrist_r"),
    ("pelvis", "hip_l"),
    ("pelvis", "hip_r"),
    ("hip_l", "knee_l"),
    ("knee_l", "ankle_l"),
    ("hip_r", "knee_r"),
    ("knee_r", "ankle_r"),
]


@dataclass
class PoseResult:
    keypoints: Dict[str, Tuple[float, float, float]]
    edges: List[Tuple[str, str]]
    bounding_box: Tuple[float, float, float, float]
    scale: float

    def ordered_keypoints(self) -> List[Tuple[str, Tuple[float, float, float]]]:
        return list(self.keypoints.items())


class PoseEstimator:
    """Canonical pose estimator that scales with the incoming image."""

    def estimate(self, image_path: Path) -> PoseResult:
        width, height = utils.read_image_size(image_path)
        scale = height / 800.0 if height else 1.0
        keypoints = {name: (x * scale, y * scale, z * scale) for name, (x, y, z) in CANONICAL_POINTS.items()}
        bounding_box = self._compute_bounds(keypoints.values())
        logger.info("Pose estimated using canonical skeleton (scale %.3f)", scale)
        return PoseResult(keypoints=keypoints, edges=list(POSE_EDGES), bounding_box=bounding_box, scale=scale)

    def _compute_bounds(self, points: Iterable[Tuple[float, float, float]]) -> Tuple[float, float, float, float]:
        xs = [p[0] for p in points]
        ys = [p[1] for p in points]
        return (min(xs), min(ys), max(xs), max(ys))


