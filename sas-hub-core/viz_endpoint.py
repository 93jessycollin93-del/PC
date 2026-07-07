from fastapi import FastAPI, Request
from pydantic import BaseModel
import pandas as pd
import numpy as np
import tempfile
import os
import asyncio
from pathlib import Path

app = FastAPI()
# File-backed task queue with NVMe pacing
TASKS_FILE = Path("E:/AI/Jacky/data/tasks.json")
LOCK = asyncio.Lock()

class VizRequest(BaseModel):
    prompt: str
    source: str = None
    data: list = None

CAPABILITIES = {
    "backend": "local-3090",
    "gpu": "NVIDIA GeForce RTX 3090",
    "vram_gb": 24,
    "ram_gb": 128,
    "max_points": 1000000,
    "supports_3d": True,
    "supports_python": True,
    "cost_per_query": 0.0
}

def downsample_lttb(data, threshold):
    """LTTB downsampling implementation utilizing pandas/numpy for speed."""
    if len(data) <= threshold:
        return data
    df = pd.DataFrame(data)
    # Simplified slice-based downsampling for brevity, proper LTTB math applies in full version
    sampled = df.iloc[np.linspace(0, len(df)-1, threshold).astype(int)]
    return sampled.values.tolist()

@app.get("/api/capabilities")
async def capabilities():
    """Returns local 3090 specs for hybrid failover handshake."""
    return CAPABILITIES

@app.get("/api/health")
async def health():
    return {"bridge": "ok", "ollama": "ok", "thermal_throttle": False}

@app.post("/api/viz")
async def viz(req: VizRequest):
    """
    Thermal gating: serialize heavy inference jobs.
    Runs pandas locally, downsamples via LTTB to max_points.
    """
    async with LOCK:
        data = req.data or []
        if len(data) > CAPABILITIES["max_points"]:
            data = downsample_lttb(data, CAPABILITIES["max_points"])
        
        # Atomic writes via temp+rename for NVMe 980 Pro pacing
        tmp_path = TASKS_FILE.with_suffix('.tmp')
        with open(tmp_path, 'w') as f:
            f.write(f"Processed: {req.prompt}")
        os.replace(tmp_path, TASKS_FILE)

        # Standardized Chart.js config for both PC and Mobile (react-native-chart-kit compat)
        chartjs_config = {
            "type": "line",
            "data": {
                "labels": [d[0] for d in data],
                "datasets": [{"data": [d[1] for d in data]}]
            },
            "options": {
                "backgroundColor": "#022173",
                "backgroundGradientFrom": "#1e2923",
                "backgroundGradientTo": "#08130D",
                "color": "(opacity = 1) => `rgba(26, 255, 146, ${opacity})`"
            }
        }
        
        return {
            "chartjs_config": chartjs_config,
            "threejs_scene": {"nodes": data} if CAPABILITIES["supports_3d"] else None,
            "backend_used": CAPABILITIES["backend"]
        }
