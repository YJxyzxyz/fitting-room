from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Mapping, Sequence, Tuple

from ..utils.logging import get_logger
from .geometry import Mesh


logger = get_logger(__name__)


@dataclass
class DeformationComponent:
    name: str
    vector: List[List[float]]
    feature_weights: Mapping[str, float]


@dataclass
class GeneratedMesh:
    mesh: Mesh
    metadata: Dict[str, object]


class PretrainedGarmentModel:
    def __init__(
        self,
        model_id: str,
        base_vertices: List[List[float]],
        indices: Sequence[int],
        components: Sequence[DeformationComponent],
        pinned_vertices: Sequence[int],
    ) -> None:
        self.id = model_id
        self.base_vertices = [list(vertex) for vertex in base_vertices]
        self.indices = [int(value) for value in indices]
        self.components = list(components)
        self.pinned_vertices = [int(idx) for idx in pinned_vertices]
        self.base_centroid = _compute_centroid(self.base_vertices)
        self.base_extents = _compute_extents(self.base_vertices)

    @classmethod
    def from_json(cls, path: Path) -> "PretrainedGarmentModel":
        data = json.loads(path.read_text())
        stride = int(data.get("vertex_stride", 3))
        if stride != 3:
            raise ValueError(f"Unsupported vertex stride {stride} in {path}")
        base_vertices = _chunk_vectors(data["base_vertices"], stride)
        component_vectors = []
        for spec in data.get("components", []):
            vectors = _chunk_vectors(spec["vector"], 3)
            if len(vectors) != len(base_vertices):
                raise ValueError(
                    f"Component '{spec.get('name')}' length mismatch for model {data['id']}"
                )
            component_vectors.append(
                DeformationComponent(
                    name=str(spec.get("name", f"component_{len(component_vectors)}")),
                    vector=vectors,
                    feature_weights={str(k): float(v) for k, v in spec.get("feature_weights", {}).items()},
                )
            )
        indices = [int(value) for value in data["indices"]]
        pinned = [int(idx) for idx in data.get("pinned_vertices", [])]
        return cls(data["id"], base_vertices, indices, component_vectors, pinned)

    def synthesize(
        self,
        pose_features: Mapping[str, float],
        target_center: Tuple[float, float, float],
        target_size: Tuple[float, float, float],
        base_color: Tuple[float, float, float, float],
    ) -> GeneratedMesh:
        logger.debug("Synthesizing garment %s with features %s", self.id, pose_features)
        vertices = [list(vertex) for vertex in self.base_vertices]
        for component in self.components:
            weight = _compute_component_weight(component.feature_weights, pose_features)
            if abs(weight) < 1e-6:
                continue
            for idx, delta in enumerate(component.vector):
                vertices[idx][0] += delta[0] * weight
                vertices[idx][1] += delta[1] * weight
                vertices[idx][2] += delta[2] * weight

        scale_vector = _compute_scale_vector(self.base_extents, target_size)
        center = list(target_center)
        for vertex in vertices:
            vertex[0] = (vertex[0] - self.base_centroid[0]) * scale_vector[0] + center[0]
            vertex[1] = (vertex[1] - self.base_centroid[1]) * scale_vector[1] + center[1]
            vertex[2] = (vertex[2] - self.base_centroid[2]) * scale_vector[2] + center[2]

        normals = _compute_vertex_normals(vertices, self.indices)
        colors = _shade_vertices(vertices, normals, base_color, pose_features, target_center)

        mesh = Mesh(
            vertices=[component for vertex in vertices for component in vertex],
            normals=[component for normal in normals for component in normal],
            colors=[component for color in colors for component in color],
            indices=list(self.indices),
        )
        metadata: Dict[str, object] = {
            "pinned_vertices": list(self.pinned_vertices),
            "pose_features": dict(pose_features),
            "vertex_count": len(vertices),
        }
        return GeneratedMesh(mesh=mesh, metadata=metadata)


class PretrainedLibrary:
    def __init__(self, root: Path) -> None:
        self.root = root
        self._cache: Dict[str, PretrainedGarmentModel] = {}

    def has_model(self, garment_id: str) -> bool:
        return self._model_path(garment_id).exists()

    def generate(
        self,
        garment_id: str,
        pose_features: Mapping[str, float],
        target_center: Tuple[float, float, float],
        target_size: Tuple[float, float, float],
        base_color: Tuple[float, float, float, float],
    ) -> GeneratedMesh:
        model = self._load_model(garment_id)
        return model.synthesize(pose_features, target_center, target_size, base_color)

    def _load_model(self, garment_id: str) -> PretrainedGarmentModel:
        if garment_id not in self._cache:
            path = self._model_path(garment_id)
            if not path.exists():
                raise FileNotFoundError(f"No pretrained model available for {garment_id}")
            self._cache[garment_id] = PretrainedGarmentModel.from_json(path)
            logger.info("Loaded pretrained garment model for %s", garment_id)
        return self._cache[garment_id]

    def _model_path(self, garment_id: str) -> Path:
        return self.root / f"{garment_id}.json"


def _compute_component_weight(weights: Mapping[str, float], features: Mapping[str, float]) -> float:
    return float(sum(float(weights.get(name, 0.0)) * float(features.get(name, 0.0)) for name in weights))


def _compute_scale_vector(extents: Sequence[float], target_size: Tuple[float, float, float]) -> List[float]:
    scale = []
    for base, target in zip(extents, target_size):
        base_value = base if base >= 1e-6 else 1.0
        scale.append(float(target) / base_value)
    return scale


def _compute_centroid(vertices: Sequence[Sequence[float]]) -> List[float]:
    if not vertices:
        return [0.0, 0.0, 0.0]
    sums = [0.0, 0.0, 0.0]
    for vx, vy, vz in vertices:
        sums[0] += float(vx)
        sums[1] += float(vy)
        sums[2] += float(vz)
    count = float(len(vertices))
    return [value / count for value in sums]


def _compute_extents(vertices: Sequence[Sequence[float]]) -> List[float]:
    if not vertices:
        return [1.0, 1.0, 1.0]
    min_values = [float(vertices[0][0]), float(vertices[0][1]), float(vertices[0][2])]
    max_values = list(min_values)
    for vx, vy, vz in vertices[1:]:
        min_values[0] = min(min_values[0], float(vx))
        min_values[1] = min(min_values[1], float(vy))
        min_values[2] = min(min_values[2], float(vz))
        max_values[0] = max(max_values[0], float(vx))
        max_values[1] = max(max_values[1], float(vy))
        max_values[2] = max(max_values[2], float(vz))
    extents = [max_values[i] - min_values[i] for i in range(3)]
    return [extent if extent >= 1e-6 else 1.0 for extent in extents]


def _chunk_vectors(values: Sequence[float], stride: int) -> List[List[float]]:
    chunks: List[List[float]] = []
    buffer: List[float] = []
    for value in values:
        buffer.append(float(value))
        if len(buffer) == stride:
            chunks.append(buffer)
            buffer = []
    if buffer:
        raise ValueError("Vector data length must be divisible by stride")
    return chunks


def _compute_vertex_normals(vertices: Sequence[Sequence[float]], indices: Sequence[int]) -> List[List[float]]:
    normals = [[0.0, 0.0, 0.0] for _ in vertices]
    for i in range(0, len(indices), 3):
        i0, i1, i2 = indices[i:i + 3]
        v0 = vertices[i0]
        v1 = vertices[i1]
        v2 = vertices[i2]
        edge1 = [v1[j] - v0[j] for j in range(3)]
        edge2 = [v2[j] - v0[j] for j in range(3)]
        normal = _cross(edge1, edge2)
        length = _length(normal)
        if length < 1e-8:
            continue
        normal = [component / length for component in normal]
        for idx in (i0, i1, i2):
            normals[idx][0] += normal[0]
            normals[idx][1] += normal[1]
            normals[idx][2] += normal[2]
    for idx, normal in enumerate(normals):
        length = _length(normal)
        if length < 1e-8:
            normals[idx] = [0.0, 1.0, 0.0]
        else:
            normals[idx] = [component / length for component in normal]
    return normals


def _shade_vertices(
    vertices: Sequence[Sequence[float]],
    normals: Sequence[Sequence[float]],
    base_color: Tuple[float, float, float, float],
    pose_features: Mapping[str, float],
    target_center: Tuple[float, float, float],
) -> List[List[float]]:
    if not vertices:
        return []
    base_rgb = [float(base_color[0]), float(base_color[1]), float(base_color[2])]
    alpha = float(base_color[3])
    heights = [vertex[1] for vertex in vertices]
    min_h = min(heights)
    max_h = max(heights)
    span = max(max_h - min_h, 1e-5)
    drape_factor = float(pose_features.get("torso_length", 0.0)) * 0.25
    movement = float(pose_features.get("movement_intensity", 0.0))
    occlusion_left = float(pose_features.get("occlusion_left", 0.0))
    occlusion_right = float(pose_features.get("occlusion_right", 0.0))
    center_x = float(target_center[0])

    colors: List[List[float]] = []
    for vertex, normal in zip(vertices, normals):
        normalized_height = (vertex[1] - min_h) / span
        shading = 0.72 + 0.25 * (1.0 - normalized_height) + drape_factor
        shading += 0.08 * max(normal[2], 0.0)
        wrinkle = 0.12 * movement * abs(normal[0])
        shading = _clamp(shading, 0.4, 1.3)
        rgb = [
            _clamp(base_rgb[0] * shading + wrinkle, 0.0, 1.0),
            _clamp(base_rgb[1] * shading + wrinkle, 0.0, 1.0),
            _clamp(base_rgb[2] * shading + wrinkle, 0.0, 1.0),
        ]
        if vertex[0] < center_x and occlusion_left:
            factor = max(0.0, 1.0 - 0.15 * occlusion_left)
            rgb = [_clamp(channel * factor, 0.0, 1.0) for channel in rgb]
        elif vertex[0] >= center_x and occlusion_right:
            factor = max(0.0, 1.0 - 0.15 * occlusion_right)
            rgb = [_clamp(channel * factor, 0.0, 1.0) for channel in rgb]
        rgb.append(alpha)
        colors.append(rgb)
    return colors


def compute_pose_features(keypoints: Mapping[str, Sequence[float]], scale: float) -> Dict[str, float]:
    def vec(name: str) -> Tuple[float, float, float]:
        value = keypoints[name]
        return (float(value[0]), float(value[1]), float(value[2]))

    shoulder_l = vec("shoulder_l")
    shoulder_r = vec("shoulder_r")
    neck = vec("neck")
    pelvis = vec("pelvis")
    wrist_l = vec("wrist_l")
    wrist_r = vec("wrist_r")

    shoulder_width = _distance(shoulder_l, shoulder_r)
    if shoulder_width <= 1e-6:
        shoulder_width = max(scale * 0.6, 1e-4)

    torso_length = _distance(neck, pelvis)
    if torso_length <= 1e-6:
        torso_length = scale or 1.0
    torso_length_norm = min(1.2, torso_length / ((scale or 1.0) * 1.2))

    arm_extension = (
        _distance(wrist_l, shoulder_l) + _distance(wrist_r, shoulder_r)
    ) / (shoulder_width * 2.0)
    arm_extension = _clamp(arm_extension, 0.0, 1.4)

    wrist_span = _distance(wrist_l, wrist_r)
    movement_intensity = _clamp(wrist_span / (shoulder_width * 2.2 + 1e-5), 0.0, 1.0)

    torso_center_x = (shoulder_l[0] + shoulder_r[0]) * 0.5
    occlusion_left = _clamp(1.0 - abs(wrist_l[0] - torso_center_x) / (shoulder_width * 1.4 + 1e-5), 0.0, 1.0)
    occlusion_right = _clamp(1.0 - abs(wrist_r[0] - torso_center_x) / (shoulder_width * 1.4 + 1e-5), 0.0, 1.0)

    return {
        "torso_length": torso_length_norm,
        "arm_extension": arm_extension,
        "movement_intensity": movement_intensity,
        "occlusion_left": occlusion_left,
        "occlusion_right": occlusion_right,
    }


def summarize_features(features: Mapping[str, float]) -> Dict[str, float]:
    return {name: round(float(value), 4) for name, value in features.items()}


def _cross(a: Sequence[float], b: Sequence[float]) -> List[float]:
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]


def _length(vec: Sequence[float]) -> float:
    return math.sqrt(vec[0] * vec[0] + vec[1] * vec[1] + vec[2] * vec[2])


def _distance(a: Sequence[float], b: Sequence[float]) -> float:
    return math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)


def _clamp(value: float, minimum: float, maximum: float) -> float:
    return min(max(value, minimum), maximum)

