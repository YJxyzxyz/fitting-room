from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Sequence, Tuple

from ..utils.logging import get_logger
from .geometry import Mesh


logger = get_logger(__name__)


@dataclass
class ClothSimulationFrame:
    time: float
    vertices: List[float]


@dataclass
class ClothSimulation:
    frames: List[ClothSimulationFrame]
    frame_rate: float
    pinned_vertices: Sequence[int]


class ClothSimulator:
    def __init__(
        self,
        time_step: float = 1.0 / 30.0,
        steps: int = 28,
        damping: float = 0.92,
        stiffness: float = 14.0,
    ) -> None:
        self.time_step = time_step
        self.steps = steps
        self.damping = damping
        self.stiffness = stiffness

    def simulate(
        self,
        mesh: Mesh,
        indices: Sequence[int],
        pinned_vertices: Sequence[int],
        pose_features: Dict[str, float],
    ) -> ClothSimulation:
        if not mesh.vertices or not indices:
            frame = ClothSimulationFrame(time=0.0, vertices=list(mesh.vertices))
            return ClothSimulation(frames=[frame], frame_rate=0.0, pinned_vertices=list(pinned_vertices))

        positions = _chunk_vectors(mesh.vertices, 3)
        base_positions = [vertex[:] for vertex in positions]
        velocities = [[0.0, 0.0, 0.0] for _ in positions]

        springs = _build_springs(indices)
        rest_lengths = _compute_rest_lengths(springs, base_positions)

        pinned_idx = [idx for idx in pinned_vertices if 0 <= idx < len(positions)]

        gravity_strength = 0.38 + 0.25 * float(pose_features.get("torso_length", 0.0))
        wind_strength = 0.1 + 0.22 * float(pose_features.get("movement_intensity", 0.0))
        sway_bias = float(pose_features.get("arm_extension", 0.0))

        frames: List[ClothSimulationFrame] = []
        for step in range(self.steps):
            forces = [[0.0, 0.0, 0.0] for _ in positions]
            phase = step / max(self.steps - 1, 1)
            gust = math.sin(math.pi * phase * (1.15 + sway_bias * 0.3))
            lateral = math.cos(math.pi * phase) * wind_strength * 0.18 * sway_bias
            for force in forces:
                force[1] -= gravity_strength
                force[2] += wind_strength * gust
                force[0] += lateral

            for idx, (i, j) in enumerate(springs):
                delta = [positions[j][axis] - positions[i][axis] for axis in range(3)]
                length = _length(delta)
                if length < 1e-6:
                    continue
                direction = [component / length for component in delta]
                displacement = length - rest_lengths[idx]
                force = [self.stiffness * displacement * component for component in direction]
                for axis in range(3):
                    forces[i][axis] += force[axis]
                    forces[j][axis] -= force[axis]

            for idx in range(len(positions)):
                velocity = velocities[idx]
                force = forces[idx]
                for axis in range(3):
                    velocity[axis] += force[axis] * self.time_step
                    velocity[axis] *= self.damping
                    positions[idx][axis] += velocity[axis] * self.time_step

            for idx in pinned_idx:
                positions[idx][0] = base_positions[idx][0]
                positions[idx][1] = base_positions[idx][1]
                positions[idx][2] = base_positions[idx][2]
                velocities[idx] = [0.0, 0.0, 0.0]

            frame_vertices = [round(component, 6) for vertex in positions for component in vertex]
            frames.append(ClothSimulationFrame(time=step * self.time_step, vertices=frame_vertices))

        frame_rate = 1.0 / self.time_step if self.time_step else 0.0
        logger.debug("Generated %d simulation frames (frame_rate=%.2f)", len(frames), frame_rate)
        return ClothSimulation(frames=frames, frame_rate=frame_rate, pinned_vertices=pinned_idx)


def export_simulation(simulation: ClothSimulation, output_path: Path) -> None:
    payload = {
        "frame_rate": simulation.frame_rate,
        "frame_count": len(simulation.frames),
        "pinned_vertices": list(simulation.pinned_vertices),
        "frames": [
            {"time": round(frame.time, 4), "vertices": frame.vertices}
            for frame in simulation.frames
        ],
    }
    output_path.write_text(json.dumps(payload))
    logger.info("Cloth simulation exported to %s (%d frames)", output_path, len(simulation.frames))


def _build_springs(indices: Sequence[int]) -> List[Tuple[int, int]]:
    springs = set()
    for i in range(0, len(indices), 3):
        tri = indices[i:i + 3]
        if len(tri) < 3:
            continue
        i0, i1, i2 = int(tri[0]), int(tri[1]), int(tri[2])
        springs.add(tuple(sorted((i0, i1))))
        springs.add(tuple(sorted((i1, i2))))
        springs.add(tuple(sorted((i2, i0))))
    return sorted(springs)


def _compute_rest_lengths(springs: Sequence[Tuple[int, int]], positions: Sequence[Sequence[float]]) -> List[float]:
    lengths: List[float] = []
    for i, j in springs:
        lengths.append(_distance(positions[i], positions[j]))
    return lengths


def _chunk_vectors(values: Sequence[float], stride: int) -> List[List[float]]:
    vertices: List[List[float]] = []
    buffer: List[float] = []
    for value in values:
        buffer.append(float(value))
        if len(buffer) == stride:
            vertices.append(buffer)
            buffer = []
    if buffer:
        raise ValueError("Vertex data length must be divisible by stride")
    return vertices


def _length(vector: Sequence[float]) -> float:
    return math.sqrt(vector[0] * vector[0] + vector[1] * vector[1] + vector[2] * vector[2])


def _distance(a: Sequence[float], b: Sequence[float]) -> float:
    return math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)

