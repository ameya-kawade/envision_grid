"""
ENVISIONGRID — FastAPI Application
All endpoints wired to intelligence engine.
"""
from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from datetime import datetime as _dt

from src import db
from src.db import (
    get_map_data, get_analytics_summary,
    get_all_cascade_results, get_cascade_result,
)
from src.schemas import (
    ViolationEvent, ComplaintEvent, SensorReading,
    PredictionRequest, PredictionResult, AlertCreate,
    CaseCreate, CaseUpdate, SimulationRequest, SimulationResult,
    CascadeRequest, InterventionRequest, CaseClose,
)
from src import ingest as ingest_module
from src.features import compute_features, compute_neighbor_spillover
from src.model_adapter import PlaceholderRiskModel
from src.hotspots import get_hotspots
from src.coverage import get_coverage_report
from src.simulate import run_simulation
from src.alerts import create_alert_from_prediction, get_all_alerts
from src.cases import open_case, list_cases, patch_case
from src.geo_grid import get_grid_id, grid_info, parse_grid_id
from src.cron import start_scheduler, stop_scheduler
from src.report_generator import run_daily_report, get_last_run_time, generate_playbook_for_alert
from src.services.cascading_engine import run_cascade_for_grid
from src.services.explainability_engine import explain_grid
from src.services.simulation_engine import run_intervention
from src.services.risk_memory import apply_feedback

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
    start_scheduler()


@app.on_event("shutdown")
def shutdown():
    stop_scheduler()


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


@app.get("/analytics/summary")
def analytics_summary_endpoint():
    """Aggregated statistics from MongoDB for dashboard charts."""
    return get_analytics_summary()


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
# REPORT
# ═══════════════════════════════════════════════════════════════════════

@app.post("/report/trigger")
def trigger_report():
    """Manually trigger the daily risk report (for testing)."""
    result = run_daily_report()
    return result


@app.get("/report/status")
def report_status():
    """Check when the last report was generated."""
    last = get_last_run_time()
    return {"last_run": last, "status": "ready" if last else "never_run"}


@app.post("/report/playbook")
def generate_alert_playbook(data: dict):
    """
    Generate an AI playbook for a single alert on demand.
    Body: { grid_id, risk_score, confidence, drivers }
    """
    playbook = generate_playbook_for_alert(
        grid_id=data.get("grid_id", "unknown"),
        risk_score=float(data.get("risk_score", 0.0)),
        confidence=float(data.get("confidence", 0.0)),
        drivers=data.get("drivers", []),
    )
    return {"grid_id": data.get("grid_id"), "playbook": playbook}



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


# ═══════════════════════════════════════════════════════════════════════
# CASCADING RISK ENGINE
# ═══════════════════════════════════════════════════════════════════════

@app.post("/predict/cascade")
def predict_cascade(req: CascadeRequest):
    """
    Run prediction on all active grids, then propagate cascade for each.
    Returns: {grid_id, primary_risk, cascade_score, secondary_impacts, ...}
    """
    grids = db.get_all_grid_ids()
    if not grids:
        return {"status": "no_data", "results": []}

    results = []
    for gid in grids:
        feats = compute_features(gid, use_sensors=req.use_sensors)
        if feats.get("violation_count_7d", 0) == 0:
            continue
        feats["neighbor_spillover_3d"] = compute_neighbor_spillover(gid, req.use_sensors)
        pred = _model.predict(feats, req.risk_type, req.horizon_hours, req.use_sensors)

        if pred["risk_score"] < req.threshold:
            continue

        cascade = run_cascade_for_grid(
            gid, pred["risk_score"], req.risk_type,
            req.use_sensors, save_result=req.save_results,
        )
        cascade["primary_risk_score"] = pred["risk_score"]
        cascade["confidence"] = pred["confidence"]
        cascade["drivers"] = pred["drivers"]
        results.append(cascade)

    results.sort(key=lambda x: x.get("cascade_score", 0), reverse=True)
    return {"status": "success", "count": len(results), "results": results}


@app.get("/risk/explain/{grid_id}")
def risk_explain(grid_id: str, risk_type: str = "all", use_sensors: bool = True):
    """
    Deep explainability for a grid: feature contributions + cascade path + memory.
    """
    try:
        result = explain_grid(grid_id, risk_type=risk_type, use_sensors=use_sensors)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/map/cascading-risk")
def map_cascading_risk(
    limit: int = Query(500, ge=1, le=5000),
):
    """
    deck.gl-ready cascade risk data.
    Returns [{lat, lon, grid_id, primary_risk, cascade_score, severity_color_index}]
    """
    raw = get_all_cascade_results(limit=limit)

    out = []
    for r in raw:
        gid = r.get("grid_id", "")
        lat, lon = parse_grid_id(gid)
        cascade_score = r.get("cascade_score", 0.0)
        primary = max(r.get("primary_risks", {}).values(), default=0.0)

        # severity_color_index: 0=low 1=medium 2=high 3=critical
        if cascade_score >= 0.6:
            severity = 3
        elif cascade_score >= 0.4:
            severity = 2
        elif cascade_score >= 0.2:
            severity = 1
        else:
            severity = 0

        out.append({
            "lat": lat,
            "lon": lon,
            "grid_id": gid,
            "primary_risk": round(primary, 4),
            "cascade_score": cascade_score,
            "severity_color_index": severity,
            "propagation_trace": r.get("propagation_trace", [])[:5],
        })

    out.sort(key=lambda x: x["cascade_score"], reverse=True)
    return out


# ═══════════════════════════════════════════════════════════════════════
# INTERVENTION SIMULATION
# ═══════════════════════════════════════════════════════════════════════

@app.post("/simulate/intervention")
def simulate_intervention(req: InterventionRequest):
    """
    Cascade-aware policy simulation.
    Applies intervention, re-runs cascade, returns before/after deltas.
    """
    try:
        result = run_intervention(
            intervention_type=req.intervention_type,
            percentage_reduction=req.percentage_reduction,
            target_risk=req.target_risk,
            duration_days=req.duration_days,
            grid_ids=req.grid_ids,
            use_sensors=req.use_sensors,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════════════
# CASE CLOSE WITH MEMORY FEEDBACK
# ═══════════════════════════════════════════════════════════════════════

@app.patch("/cases/{case_id}/close")
def close_case(case_id: str, data: CaseClose):
    """
    Close a case, add resolution notes, then trigger the risk memory feedback loop.
    This updates the recurrence_weight for the grid and risk_type so future
    predictions for the same location are scored higher.
    """
    # ── 1. Fetch the case to get grid_id ─────────────────────────────
    case_doc = db.get_db().cases.find_one({"case_id": case_id})
    if not case_doc:
        # Also try by MongoDB ObjectId
        case_doc = db.get_db().cases.find_one({"_id": case_id})
    if not case_doc:
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found")

    # ── 2. Close the case ─────────────────────────────────────────────
    update = {
        "status": "CLOSED",
        "resolution_notes": data.resolution_notes,
        "closed_at": _dt.utcnow().isoformat(),
    }
    patch_case(case_id, update)

    # ── 3. Trigger risk memory feedback───────────────────────────────
    # Get grid_id from case → alert → prediction
    grid_id = case_doc.get("grid_id")
    if not grid_id:
        # Try resolving through alert
        alert_id = case_doc.get("alert_id")
        if alert_id:
            alert = db.get_db().alerts.find_one({"alert_id": alert_id}, {"_id": 0})
            if not alert:
                try:
                    from bson import ObjectId as _OId
                    alert = db.get_db().alerts.find_one({"_id": _OId(alert_id)}, {"_id": 0})
                except Exception:
                    pass
            grid_id = (alert or {}).get("grid_id")

    new_weight = 0.0
    if grid_id:
        new_weight = apply_feedback(
            grid_id=grid_id,
            risk_type=data.risk_type,
            risk_score=data.risk_score,
        )

    return {
        "status": "closed",
        "case_id": case_id,
        "grid_id": grid_id,
        "risk_memory_updated": grid_id is not None,
        "new_recurrence_weight": new_weight,
    }
