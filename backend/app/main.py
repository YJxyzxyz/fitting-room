from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from ..api.routes import router
from ..core.config import settings


app = FastAPI(title="Virtual Try-On API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)
app.mount("/results", StaticFiles(directory=settings.result_dir), name="results")
app.mount("/assets", StaticFiles(directory=settings.assets_dir), name="assets")


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "Virtual try-on service is running"}
