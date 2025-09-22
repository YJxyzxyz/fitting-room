from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass
class Settings:
    """Application wide settings.

    The settings object also makes sure that all working directories exist.
    """

    project_root: Path = Path(__file__).resolve().parents[2]

    def __post_init__(self) -> None:
        self.assets_dir = self.project_root / "assets"
        self.data_dir = self.project_root / "backend" / "data"
        self.input_dir = self.data_dir / "inputs"
        self.result_dir = self.data_dir / "results"
        self.log_dir = self.data_dir / "logs"

        for directory in (self.assets_dir, self.data_dir, self.input_dir, self.result_dir, self.log_dir):
            directory.mkdir(parents=True, exist_ok=True)


settings = Settings()
