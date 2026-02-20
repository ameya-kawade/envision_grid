"""
ENVISIONGRID — Database Layer (MongoDB Atlas)
All collection operations: inserts, queries, aggregations.
"""
from pymongo import MongoClient, DESCENDING, GEOSPHERE
from datetime import datetime
from typing import List, Dict, Any, Optional
import json

from src.config import MONGO_URI, MONGO_DB_NAME, VIOLATION_RISK_MAP
from src.geo_grid import parse_grid_id

# ── Connection ────────────────────────────────────────────────────────
_client = None
_db = None


def get_db():
    """Lazy-init MongoDB connection."""
    global _client, _db
    if _db is None:
        _client = MongoClient(MONGO_URI)
        _db = _client[MONGO_DB_NAME]
    return _db


def init_db():
    """Create indexes for performance (compound + geospatial)."""
    db = get_db()

    # ── violations ────────────────────────────────────────────────────
    db.violations.create_index("violation_id", unique=True)
    db.violations.create_index([("grid_id", 1), ("timestamp", DESCENDING)])  # compound
    db.violations.create_index([("location", GEOSPHERE)])                    # 2dsphere
    db.violations.create_index("risk_type")

    # ── complaints ────────────────────────────────────────────────────
    db.complaints.create_index("complaint_id", unique=True)
    db.complaints.create_index([("grid_id", 1), ("timestamp", DESCENDING)])  # compound
    db.complaints.create_index([("location", GEOSPHERE)])                     # 2dsphere

    # ── sensors ───────────────────────────────────────────────────────
    db.sensors.create_index([("grid_id", 1), ("timestamp", DESCENDING)])      # compound
    db.sensors.create_index([("location", GEOSPHERE)])                        # 2dsphere

    # ── predictions ──────────────────────────────────────────────────
    db.predictions.create_index([("grid_id", 1), ("run_timestamp", DESCENDING)])  # compound
    db.predictions.create_index([("center", GEOSPHERE)])                          # 2dsphere
    db.predictions.create_index("risk_type")

    # ── alerts ───────────────────────────────────────────────────────
    db.alerts.create_index("grid_id")
    db.alerts.create_index([("resolved", 1), ("created_at", DESCENDING)])     # filter+sort
    db.alerts.create_index([("center", GEOSPHERE)])                           # 2dsphere

    # ── cases ────────────────────────────────────────────────────────
    db.cases.create_index("alert_id")


# ── Insert helpers ────────────────────────────────────────────────────

def _make_point(lat: float, lon: float) -> Dict[str, Any]:
    """Build a GeoJSON Point document."""
    return {"type": "Point", "coordinates": [lon, lat]}


def insert_violation(data: Dict[str, Any], grid_id: str) -> bool:
    db = get_db()
    doc = {**data, "grid_id": grid_id}
    # ── GeoJSON location ─────────────────────────────────────────────
    try:
        lat, lon = float(doc["lat"]), float(doc["lon"])
        doc["location"] = _make_point(lat, lon)
    except (KeyError, TypeError, ValueError):
        pass
    # ── Denormalise risk_type ────────────────────────────────────────
    if "risk_type" not in doc:
        doc["risk_type"] = VIOLATION_RISK_MAP.get(
            str(doc.get("violation_type", "")).lower(), "all"
        )
    try:
        db.violations.update_one(
            {"violation_id": doc["violation_id"]},
            {"$set": doc},
            upsert=True
        )
        return True
    except Exception:
        return False


def insert_complaint(data: Dict[str, Any], grid_id: str) -> bool:
    db = get_db()
    doc = {**data, "grid_id": grid_id}
    # ── GeoJSON location ─────────────────────────────────────────────
    try:
        lat, lon = float(doc["lat"]), float(doc["lon"])
        doc["location"] = _make_point(lat, lon)
    except (KeyError, TypeError, ValueError):
        pass
    try:
        db.complaints.update_one(
            {"complaint_id": doc["complaint_id"]},
            {"$set": doc},
            upsert=True
        )
        return True
    except Exception:
        return False


def insert_sensor(data: Dict[str, Any], grid_id: str):
    db = get_db()
    doc = {**data, "grid_id": grid_id}
    # ── GeoJSON location (only when coordinates are available) ────────
    try:
        lat, lon = float(doc["lat"]), float(doc["lon"])
        doc["location"] = _make_point(lat, lon)
    except (KeyError, TypeError, ValueError):
        pass
    db.sensors.insert_one(doc)


def save_prediction(pred: Dict[str, Any]):
    db = get_db()
    doc = {**pred, "run_timestamp": datetime.utcnow().isoformat()}
    # ── GeoJSON center derived from grid_id ───────────────────────────
    grid_id = doc.get("grid_id", "")
    if grid_id:
        lat, lon = parse_grid_id(grid_id)
        doc["center"] = _make_point(lat, lon)
    db.predictions.insert_one(doc)


def create_alert(data: Dict[str, Any]) -> str:
    db = get_db()
    grid_id = data["grid_id"]
    lat, lon = parse_grid_id(grid_id)
    doc = {
        "grid_id": grid_id,
        "center": _make_point(lat, lon),                     # GeoJSON
        "risk_score": data["risk_score"],
        "risk_type": data.get("risk_type", "all"),
        "horizon_hours": data.get("horizon_hours", 72),
        "drivers": data.get("drivers", []),
        "actions": data.get("actions", []),
        "created_at": datetime.utcnow().isoformat(),
        "resolved": False,
    }
    result = db.alerts.insert_one(doc)
    return str(result.inserted_id)


def get_alerts() -> List[Dict]:
    db = get_db()
    rows = db.alerts.find().sort("created_at", DESCENDING).limit(100)
    result = []
    for r in rows:
        d = {**r, "id": str(r["_id"])}
        d.pop("_id", None)
        result.append(d)
    return result


def create_case(alert_id: str, assigned_to: str = None, notes: str = None) -> str:
    db = get_db()
    now = datetime.utcnow().isoformat()
    doc = {
        "alert_id": alert_id,
        "status": "OPEN",
        "assigned_to": assigned_to,
        "notes": notes,
        "created_at": now,
        "updated_at": now,
    }
    result = db.cases.insert_one(doc)
    return str(result.inserted_id)


def get_cases() -> List[Dict]:
    db = get_db()
    rows = db.cases.find().sort("created_at", DESCENDING)
    result = []
    for r in rows:
        d = {**r, "id": str(r["_id"])}
        d.pop("_id", None)
        result.append(d)
    return result


def update_case(case_id: str, updates: Dict[str, Any]):
    from bson import ObjectId
    db = get_db()
    sets = {}
    for k in ["status", "assigned_to", "notes"]:
        if k in updates and updates[k] is not None:
            sets[k] = updates[k]
    if not sets:
        return
    sets["updated_at"] = datetime.utcnow().isoformat()
    db.cases.update_one({"_id": ObjectId(case_id)}, {"$set": sets})


def get_predictions(risk_type: str = None, horizon: int = None, limit: int = 200) -> List[Dict]:
    db = get_db()
    query = {}
    if risk_type and risk_type != "all":
        query["risk_type"] = risk_type
    if horizon:
        query["horizon_hours"] = horizon
    rows = db.predictions.find(query).sort("run_timestamp", DESCENDING).limit(limit)
    result = []
    for r in rows:
        d = {**r, "id": str(r["_id"])}
        d.pop("_id", None)
        result.append(d)
    return result


def get_all_grid_ids() -> List[str]:
    db = get_db()
    return db.violations.distinct("grid_id")


# ── Map / deck.gl ─────────────────────────────────────────────────────

def get_map_data(risk_type: Optional[str] = None, limit: int = 500) -> List[Dict]:
    """
    Return the latest prediction per grid, ready for deck.gl rendering.
    Each element: {grid_id, lat, lon, risk_score, risk_type, confidence}
    Uses an aggregation pipeline to de-duplicate (latest run per grid).
    """
    db = get_db()
    match_stage: Dict[str, Any] = {}
    if risk_type and risk_type != "all":
        match_stage["risk_type"] = risk_type

    pipeline = [
        {"$match": match_stage} if match_stage else {"$match": {}},
        {"$sort": {"run_timestamp": DESCENDING}},
        {"$group": {
            "_id": "$grid_id",
            "risk_score":    {"$first": "$risk_score"},
            "confidence":    {"$first": "$confidence"},
            "risk_type":     {"$first": "$risk_type"},
            "center":        {"$first": "$center"},
            "run_timestamp": {"$first": "$run_timestamp"},
        }},
        {"$limit": limit},
    ]

    results = []
    for row in db.predictions.aggregate(pipeline):
        center = row.get("center") or {}
        coords = center.get("coordinates", [0, 0])   # [lon, lat]
        results.append({
            "grid_id":       row["_id"],
            "lon":           coords[0],
            "lat":           coords[1],
            "risk_score":    row.get("risk_score", 0),
            "risk_type":     row.get("risk_type", "all"),
            "confidence":    row.get("confidence", 0),
            "run_timestamp": row.get("run_timestamp"),
        })

    results.sort(key=lambda x: x["risk_score"], reverse=True)
    return results


def reset_database():
    db = get_db()
    for col in ["violations", "complaints", "sensors", "predictions", "alerts", "cases"]:
        db[col].delete_many({})


def get_violation_count() -> int:
    db = get_db()
    return db.violations.count_documents({})


def get_complaint_count() -> int:
    db = get_db()
    return db.complaints.count_documents({})


def get_sensor_count() -> int:
    db = get_db()
    return db.sensors.count_documents({})
