from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable, List, Sequence, Tuple

from ..utils.logging import get_logger
from .pose import PoseResult


logger = get_logger(__name__)


@dataclass
class Mesh:
    vertices: List[float] = field(default_factory=list)
    normals: List[float] = field(default_factory=list)
    colors: List[float] = field(default_factory=list)
    indices: List[int] = field(default_factory=list)

    def merge(self, other: "Mesh") -> None:
        offset = len(self.vertices) // 3
        self.vertices.extend(other.vertices)
        self.normals.extend(other.normals)
        self.colors.extend(other.colors)
        self.indices.extend([index + offset for index in other.indices])

    @property
    def vertex_count(self) -> int:
        return len(self.vertices) // 3


def create_body_mesh(pose: PoseResult) -> Mesh:
    keypoints = pose.keypoints
    shoulder_width = abs(keypoints["shoulder_r"][0] - keypoints["shoulder_l"][0]) or 0.6 * pose.scale
    torso_height = keypoints["neck"][1] - keypoints["pelvis"][1]
    torso_depth = shoulder_width * 0.45
    torso_center = _midpoint(keypoints["neck"], keypoints["pelvis"])
    components = [
        create_box(torso_center, (shoulder_width * 1.1, torso_height + 0.2 * pose.scale, torso_depth), color=(0.85, 0.67, 0.55, 1.0)),
        create_box(_midpoint(keypoints["head_top"], keypoints["neck"]), (shoulder_width * 0.45, pose.scale * 0.6, shoulder_width * 0.45), color=(0.88, 0.72, 0.6, 1.0)),
    ]
    arm_thickness = shoulder_width * 0.35
    leg_thickness = shoulder_width * 0.4
    for side in ("l", "r"):
        shoulder = keypoints[f"shoulder_{side}"]
        elbow = keypoints[f"elbow_{side}"]
        wrist = keypoints[f"wrist_{side}"]
        hip = keypoints[f"hip_{side}"]
        knee = keypoints[f"knee_{side}"]
        ankle = keypoints[f"ankle_{side}"]
        components.append(_limb_box(shoulder, elbow, thickness=arm_thickness, color=(0.85, 0.67, 0.55, 1.0)))
        components.append(_limb_box(elbow, wrist, thickness=arm_thickness * 0.9, color=(0.85, 0.67, 0.55, 1.0)))
        components.append(_limb_box(hip, knee, thickness=leg_thickness, color=(0.35, 0.35, 0.38, 1.0)))
        components.append(_limb_box(knee, ankle, thickness=leg_thickness * 0.9, color=(0.35, 0.35, 0.38, 1.0)))
    mesh = Mesh()
    for component in components:
        mesh.merge(component)
    return mesh


def _limb_box(start: Tuple[float, float, float], end: Tuple[float, float, float], thickness: float, color: Tuple[float, float, float, float]) -> Mesh:
    center = _midpoint(start, end)
    length = abs(end[1] - start[1]) or 0.3
    size = (thickness * 0.6, length, thickness * 0.6)
    return create_box(center, size, color=color)


def create_box(center: Tuple[float, float, float], size: Tuple[float, float, float], color: Tuple[float, float, float, float]) -> Mesh:
    cx, cy, cz = center
    sx, sy, sz = size
    hx, hy, hz = sx / 2.0, sy / 2.0, sz / 2.0
    faces = [
        ((0.0, 0.0, 1.0), [(-hx, -hy, hz), (hx, -hy, hz), (hx, hy, hz), (-hx, hy, hz)]),
        ((0.0, 0.0, -1.0), [(-hx, -hy, -hz), (-hx, hy, -hz), (hx, hy, -hz), (hx, -hy, -hz)]),
        ((-1.0, 0.0, 0.0), [(-hx, -hy, -hz), (-hx, -hy, hz), (-hx, hy, hz), (-hx, hy, -hz)]),
        ((1.0, 0.0, 0.0), [(hx, -hy, -hz), (hx, hy, -hz), (hx, hy, hz), (hx, -hy, hz)]),
        ((0.0, 1.0, 0.0), [(-hx, hy, -hz), (-hx, hy, hz), (hx, hy, hz), (hx, hy, -hz)]),
        ((0.0, -1.0, 0.0), [(-hx, -hy, -hz), (hx, -hy, -hz), (hx, -hy, hz), (-hx, -hy, hz)]),
    ]
    mesh = Mesh()
    for normal, corners in faces:
        start_index = mesh.vertex_count
        for x, y, z in corners:
            mesh.vertices.extend([cx + x, cy + y, cz + z])
            mesh.normals.extend(list(normal))
            mesh.colors.extend(list(color))
        mesh.indices.extend(
            [
                start_index,
                start_index + 1,
                start_index + 2,
                start_index,
                start_index + 2,
                start_index + 3,
            ]
        )
    return mesh


def _midpoint(a: Tuple[float, float, float], b: Tuple[float, float, float]) -> Tuple[float, float, float]:
    return ((a[0] + b[0]) / 2.0, (a[1] + b[1]) / 2.0, (a[2] + b[2]) / 2.0)


