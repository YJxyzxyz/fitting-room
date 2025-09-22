from __future__ import annotations

import threading
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, Optional

from ..utils.logging import get_logger


logger = get_logger(__name__)


class TaskStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"


@dataclass
class TaskRecord:
    status: TaskStatus = TaskStatus.QUEUED
    result: Dict[str, Any] | None = None
    error: Optional[str] = None


class TaskManager:
    """Thread-safe in-memory task registry."""

    def __init__(self) -> None:
        self._tasks: Dict[str, TaskRecord] = {}
        self._lock = threading.Lock()

    def create(self, task_id: str) -> None:
        with self._lock:
            self._tasks[task_id] = TaskRecord()
            logger.info("created task %s", task_id)

    def start(self, task_id: str) -> None:
        with self._lock:
            record = self._tasks.get(task_id)
            if not record:
                raise KeyError(task_id)
            record.status = TaskStatus.RUNNING
            logger.info("task %s started", task_id)

    def complete(self, task_id: str, result: Dict[str, Any]) -> None:
        with self._lock:
            record = self._tasks.get(task_id)
            if not record:
                raise KeyError(task_id)
            record.status = TaskStatus.DONE
            record.result = result
            record.error = None
            logger.info("task %s completed", task_id)

    def fail(self, task_id: str, error: Exception | str) -> None:
        with self._lock:
            record = self._tasks.get(task_id)
            if not record:
                raise KeyError(task_id)
            record.status = TaskStatus.FAILED
            record.error = str(error)
            logger.exception("task %s failed: %s", task_id, error)

    def get(self, task_id: str) -> TaskRecord | None:
        with self._lock:
            return self._tasks.get(task_id)


task_manager = TaskManager()
