# Virtual Try-On (Canonical 3D Prototype)

This repository contains a complete, fully test-covered prototype for a browser-based "virtual fitting room". The implementation follows the architecture proposed in the original project outline and focuses on delivering a deterministic, dependency-light workflow that can run in restricted environments while still exposing a clear upgrade path toward production-grade 3D try-on systems.

The current solution features:

- **Canonical body pose estimation** with automatic scaling from the input image dimensions (no heavyweight ML dependencies).
- **Procedural 3D mesh generation** for the human body and garments with per-vertex colours.
- **glTF 2.0 export** and **SVG preview rendering** for quick inspection of results.
- **FastAPI backend** with `/tryon`, `/result/{task_id}`, and `/garments` endpoints.
- **Vanilla JavaScript front-end** (Three.js viewer) capable of uploading images, polling the backend, and inspecting the generated 3D assets.
- **Pytest regression tests** covering the full offline pipeline.

Even though the geometry is synthetic, the code structure mirrors a production pipeline (segmentation → pose → garment fitting → rendering) so that each stage can later be swapped with learned models.

---

## Repository layout

```
fitting-room/
├── backend/
│   ├── app/                    # FastAPI application entry point
│   ├── api/                    # REST routes and task orchestration
│   ├── core/                   # Settings and in-memory task manager
│   ├── pipeline/               # Pose, garment fitting, mesh + rendering utilities
│   ├── tests/                  # Pytest suite validating the pipeline
│   └── pyproject.toml          # Backend dependency definition
├── assets/
│   └── garments/               # Garment manifest and colourways
├── frontend/                   # Static HTML/JS front-end with Three.js viewer
├── docs/                       # Documentation entry point (extend as needed)
└── README.md                   # You are here
```

---

## Quick start

### Prerequisites

- Python **3.11** or later.
- Node.js (optional, only if you plan to run the front-end via a dev server).

### 1. Create a virtual environment & install backend dependencies

```bash
python -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -e backend[dev]
```

> The backend has been intentionally kept free of heavyweight dependencies to support offline execution. Only FastAPI, Uvicorn, and python-multipart are required for serving the API. The pipeline itself depends solely on the Python standard library.

### 2. Run tests

```bash
pytest
```

This runs the canonical pipeline end-to-end on a synthetic PPM image and verifies that:

- A glTF model (`scene.gltf`) is produced.
- An SVG preview (`preview.svg`) is rendered.
- Metadata describing the canonical pose and garment selection is emitted.

### 3. Launch the backend service

```bash
uvicorn backend.app.main:app --reload
```

The server listens on `http://127.0.0.1:8000` by default.

### 4. Use the front-end (optional)

The `frontend/` folder contains a static site that can be served with any HTTP server. With Node.js installed you can run:

```bash
npx serve frontend
```

Then open the printed URL in your browser. The page automatically targets `http://localhost:8000` for API calls. If your API runs elsewhere, open the browser console and execute:

```js
localStorage.setItem('tryon-api-base', 'http://your-api-host:port');
```

Reload the page and the new base URL will be used.

---

## Backend pipeline overview

1. **Image ingestion**
   - The uploaded image is stored for auditing. The pipeline reads the file header (PNG, JPEG, or PPM) to obtain its dimensions — no full decoding required.
   - The image height is used as a scale factor to adapt the canonical skeleton to the person’s size.

2. **Pose estimation** (`backend/pipeline/pose.py`)
   - Returns a deterministic 3D skeleton in a neutral A-pose, scaled using the inferred image size.
   - Provides both an ordered list of joints and edge connectivity information used for preview rendering.

3. **Body mesh generation** (`backend/pipeline/geometry.py`)
   - Procedurally builds a low-poly body mesh (torso, head, limbs) using axis-aligned boxes with skin and clothing colours.
   - Meshes are merged into a single `Mesh` object storing vertex positions, normals, per-vertex RGBA colours, and indices.

4. **Garment fitting** (`backend/pipeline/garment.py`)
   - Loads garment metadata from `assets/garments/garments.json`.
   - Supports size scaling and colourway selection.
   - Creates a garment volume around the torso using the canonical joint positions.

5. **Rendering & export** (`backend/pipeline/render.py`)
   - Merges body and garment meshes, exports a **glTF 2.0** scene with embedded base64 buffers.
   - Generates a lightweight **SVG preview** showing the skeleton and garment silhouette.

6. **Task orchestration** (`backend/api/routes.py`)
   - `/tryon`: accepts an image and garment configuration, returns a task ID.
   - `/result/{task_id}`: reports progress and exposes the preview + model URLs when complete.
   - `/garments`: lists available garment templates for the front-end.

---

## API reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Service health check. |
| `/garments` | GET | Returns the garment catalogue (sizes, colourways). |
| `/tryon` | POST | Accepts a multipart form with fields `image`, `garment_id`, optional `size`, `color`. Responds with `{"task_id": ...}`. |
| `/result/{task_id}` | GET | Polls the status. Once finished returns `preview_url`, `model_url`, and `metadata`. |

The metadata includes pose keypoints (with world-space coordinates), garment selection, and scale factors to support downstream analytics.

---

## Garment catalogue format

`assets/garments/garments.json` hosts all garment definitions. A sample entry:

```json
{
  "id": "tshirt_basic",
  "name": "Essential Crew Tee",
  "category": "top",
  "width_factor": 1.2,
  "height_factor": 1.45,
  "depth": 0.12,
  "sizes": {
    "S": {"scale": 0.92},
    "M": {"scale": 1.0},
    "L": {"scale": 1.08}
  },
  "colorways": [
    {"id": "classic-white", "name": "Classic White", "color": "#f6f6f6"},
    {"id": "sunset-orange", "name": "Sunset Orange", "color": "#f57b42"}
  ]
}
```

Adding new garments only requires editing this JSON file.

---

## Extending the prototype

The codebase has been structured to make upgrades straightforward:

- Replace the canonical pose with an ML-based SMPL/SMPL-X regressor.
- Swap the procedural garment box for a learned deformation network or physics-based cloth simulation.
- Integrate texture maps by extending the glTF exporter to output UV coordinates instead of flat colours.
- Hook the pipeline into a distributed task queue (Celery/RQ) once heavier models are added.
- Enrich the SVG preview with silhouettes generated from segmentation masks.

The included modules (`pose.py`, `geometry.py`, `garment.py`, `render.py`) were intentionally decoupled to support these evolutions.

---

## Limitations & roadmap

- The current body/garment geometry is intentionally stylised and does **not** capture garment draping, wrinkles, or occlusion by limbs and hair.
- No real-time physics or animation support yet.
- FastAPI runs tasks synchronously in background threads; switch to a message queue for scale.
- Front-end uses CDN-hosted Three.js modules — for production you should bundle assets locally.

These limitations are documented in the code comments and README to guide future contributors.

---

## Contributing

1. Run `pytest` before committing.
2. Keep additions dependency-light when possible.
3. Document new garments or pipeline stages under `docs/`.

Feel free to fork and iterate — the project is designed to be a springboard for more advanced research or demos.

---

## License

[Apache](LICENSE)
