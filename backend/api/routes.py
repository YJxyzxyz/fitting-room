from __future__ import annotations

from pathlib import Path
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from ..core.config import settings
from ..core.tasks import task_manager
from ..pipeline.tryon_service import TryOnPipeline
from ..utils.io import ensure_directory, generate_task_id
from ..utils.logging import get_logger


router = APIRouter()
logger = get_logger(__name__)
pipeline = TryOnPipeline()


@router.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/garments")
def list_garments() -> dict[str, object]:
    return {"garments": pipeline.garment_manager.list_garments()}


@router.post("/tryon")
async def create_tryon(
    background_tasks: BackgroundTasks,
    image: UploadFile = File(...),
    garment_id: str = Form(...),
    size: Optional[str] = Form(None),
    color: Optional[str] = Form(None),
) -> dict[str, str]:
    task_id = generate_task_id()
    task_manager.create(task_id)
    input_dir = ensure_directory(settings.input_dir / task_id)
    input_path = input_dir / image.filename
    with input_path.open("wb") as file_obj:
        file_obj.write(await image.read())
    background_tasks.add_task(_process_tryon_task, task_id, input_path, garment_id, size, color)
    return {"task_id": task_id}


@router.get("/result/{task_id}")
def get_result(task_id: str) -> JSONResponse:
    record = task_manager.get(task_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Task not found")
    payload = {
        "status": record.status.value,
        "error": record.error,
    }
    if record.result:
        payload.update(record.result)
    return JSONResponse(payload)


# ---------------------------------------------------------------------------
def _process_tryon_task(task_id: str, image_path: Path, garment_id: str, size: Optional[str], color: Optional[str]) -> None:
    try:
        task_manager.start(task_id)
        output_dir = settings.result_dir / task_id
        artifacts = pipeline.run(image_path=image_path, output_root=output_dir, garment_id=garment_id, size=size, color=color)
        result_payload = {
            "preview_url": f"/results/{task_id}/preview.svg",
            "model_url": f"/results/{task_id}/scene.gltf",
            "metadata": artifacts.metadata,
        }
        task_manager.complete(task_id, result_payload)
    except Exception as exc:  # pragma: no cover - network/IO errors hard to simulate
        task_manager.fail(task_id, exc)


