"""
ENVISIONGRID — FastAPI Application
All endpoints wired to intelligence engine.
"""
from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional

from src import db
from src.db import get_map_data
from src.schemas import (
    ViolationEvent, ComplaintEvent, SensorReading,
    PredictionRequest, PredictionResult, AlertCreate,
    CaseCreate, CaseUpdate, SimulationRequest, SimulationResult,
)
from src import ingest as ingest_module
from src.features import compute_features, compute_neighbor_spillover
from src.model_adapter import PlaceholderRiskModel
from src.hotspots import get_hotspots
from src.coverage import get_coverage_report
from src.simulate import run_simulation
from src.alerts import create_alert_from_prediction, get_all_alerts
from src.cases import open_case, list_cases, patch_case
from src.geo_grid import get_grid_id, grid_info

app = FastAPI(
    title="ENVISIONGRID",
    description="City-Scale Environmental Risk Intelligence Platform",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

_model = PlaceholderRiskModel()


# ═══════════════════════════════════════════════════════════════════════
# LIFECYCLE
# ═══════════════════════════════════════════════════════════════════════

@app.on_event("startup")
def startup():
    db.init_db()


@app.get("/health")
def health():
    return {"status": "ok", "engine": "ENVISIONGRID v1.0"}


# ═══════════════════════════════════════════════════════════════════════
# GEO-GRID
# ═══════════════════════════════════════════════════════════════════════

@app.get("/grid/preview")
def grid_preview(lat: float = Query(...), lon: float = Query(...)):
    gid = get_grid_id(lat, lon)
    return grid_info(gid)


# ═══════════════════════════════════════════════════════════════════════
# INGESTION
# ═══════════════════════════════════════════════════════════════════════

@app.post("/ingest/violation-event")
def ingest_violation_event(event: ViolationEvent):
    ok, grid_id = ingest_module.ingest_violation_event(event.dict())
    return {"status": "ingested", "grid_id": grid_id}


@app.post("/ingest/violations")
async def ingest_violations_csv(file: UploadFile = File(...)):
    contents = await file.read()
    result = ingest_module.ingest_violations_csv(contents)
    return result


@app.post("/ingest/complaints")
async def ingest_complaints_csv(file: UploadFile = File(...)):
    contents = await file.read()
    result = ingest_module.ingest_complaints_csv(contents)
    return result


@app.post("/ingest/sensor")
def ingest_sensor(reading: SensorReading):
    grid_id = ingest_module.ingest_sensor_event(reading.dict())
    return {"status": "ingested", "grid_id": grid_id}


@app.post("/ingest/sensors")
async def ingest_sensors_csv(file: UploadFile = File(...)):
    contents = await file.read()
    result = ingest_module.ingest_sensors_csv(contents)
    return result


# ═══════════════════════════════════════════════════════════════════════
# PREDICTION
# ═══════════════════════════════════════════════════════════════════════

@app.post("/predict")
def run_predict(req: PredictionRequest):
    grids = db.get_all_grid_ids()
    if not grids:
        return {"status": "no_data", "predictions": []}

    results = []
    for gid in grids:
        feats = compute_features(gid, use_sensors=req.use_sensors)
        if feats.get("violation_count_7d", 0) == 0:
            continue
        feats["neighbor_spillover_3d"] = compute_neighbor_spillover(gid, req.use_sensors)
        pred = _model.predict(feats, req.risk_type, req.horizon_hours, req.use_sensors)

        result = {
            "grid_id": gid,
            "risk_type": req.risk_type,
            "horizon_hours": req.horizon_hours,
            "risk_score": pred["risk_score"],
            "confidence": pred["confidence"],
            "uncertainty": pred["uncertainty"],
            "drivers": pred["drivers"],
            "actions": pred["actions"],
            "sensor_validated": pred["sensor_validated"],
        }
        db.save_prediction(result)

        # Auto-create alert if above threshold
        if pred["risk_score"] >= req.threshold:
            create_alert_from_prediction(result)

        results.append(result)

    results.sort(key=lambda x: x["risk_score"], reverse=True)
    return {"status": "success", "count": len(results), "predictions": results}


@app.get("/predictions")
def get_predictions(
    risk_type: Optional[str] = None,
    horizon: Optional[int] = None,
    limit: int = 100,
):
    return db.get_predictions(risk_type, horizon, limit)


# ═══════════════════════════════════════════════════════════════════════
# ALERTS & CASES
# ═══════════════════════════════════════════════════════════════════════

@app.get("/alerts")
def list_alerts():
    return get_all_alerts()


@app.post("/alerts/from-prediction")
def create_alert(data: AlertCreate):
    alert_id = create_alert_from_prediction(data.dict())
    return {"status": "created", "alert_id": alert_id}


@app.post("/cases")
def create_case(data: CaseCreate):
    case_id = open_case(data.alert_id, data.assigned_to, data.notes)
    return {"status": "created", "case_id": case_id}


@app.get("/cases")
def get_cases():
    return list_cases()


@app.patch("/cases/{case_id}")
def update_case(case_id: str, data: CaseUpdate):
    patch_case(case_id, data.dict(exclude_none=True))
    return {"status": "updated", "case_id": case_id}


# ═══════════════════════════════════════════════════════════════════════
# ANALYTICS
# ═══════════════════════════════════════════════════════════════════════

@app.get("/hotspots")
def hotspots_endpoint(limit: int = 15, use_sensors: bool = True):
    return get_hotspots(limit, use_sensors)


@app.get("/coverage")
def coverage_endpoint():
    return get_coverage_report()


# ══════════════════════════════════════════════════════════════════════
# MAP DATA (deck.gl)
# ══════════════════════════════════════════════════════════════════════

@app.get("/map-data")
def map_data_endpoint(
    risk_type: Optional[str] = None,
    limit: int = Query(500, ge=1, le=5000),
):
    """
    Bulk map-ready data for deck.gl rendering.
    Returns [{grid_id, lat, lon, risk_score, risk_type, confidence}] —
    one entry per grid cell (latest prediction), sorted by risk_score desc.
    """
    return get_map_data(risk_type=risk_type, limit=limit)


# ═══════════════════════════════════════════════════════════════════════
# SIMULATION
# ═══════════════════════════════════════════════════════════════════════

@app.post("/simulate")
def simulate_endpoint(req: SimulationRequest):
    results = []
    for adj in req.adjustments:
        res = run_simulation(
            adj.grid_id, req.risk_type, req.horizon_hours,
            {"violation_type": adj.violation_type,
             "factor": adj.factor,
             "window_days": adj.window_days},
        )
        results.append(res)
    return {"status": "success", "results": results}
