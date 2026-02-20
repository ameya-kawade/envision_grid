"""
ENVISIONGRID — Ingestion Logic
Handles single-event and batch CSV ingestion for violations, complaints, sensors.
"""
import pandas as pd
import io
from typing import Tuple

from src import db
from src.geo_grid import get_grid_id


def ingest_violation_event(data: dict) -> Tuple[bool, str]:
    """Ingest a single violation event."""
    grid_id = get_grid_id(data["lat"], data["lon"])
    db.insert_violation(data, grid_id)
    return True, grid_id


def ingest_violations_csv(file_bytes: bytes) -> dict:
    """Parse CSV and insert violations. Returns stats."""
    df = pd.read_csv(io.StringIO(file_bytes.decode("utf-8")))
    required = {"violation_id", "timestamp", "lat", "lon", "violation_type", "severity"}
    missing = required - set(df.columns)
    if missing:
        return {"status": "error", "message": f"Missing columns: {missing}"}

    ok, skip = 0, 0
    for _, row in df.iterrows():
        try:
            row_dict = row.to_dict()
            grid_id = get_grid_id(float(row["lat"]), float(row["lon"]))
            db.insert_violation(row_dict, grid_id)
            ok += 1
        except Exception:
            skip += 1

    return {"status": "success", "ingested": ok, "skipped": skip}


def ingest_complaints_csv(file_bytes: bytes) -> dict:
    df = pd.read_csv(io.StringIO(file_bytes.decode("utf-8")))
    required = {"complaint_id", "timestamp", "lat", "lon", "complaint_type", "intensity"}
    missing = required - set(df.columns)
    if missing:
        return {"status": "error", "message": f"Missing columns: {missing}"}

    ok, skip = 0, 0
    for _, row in df.iterrows():
        try:
            row_dict = row.to_dict()
            grid_id = get_grid_id(float(row["lat"]), float(row["lon"]))
            db.insert_complaint(row_dict, grid_id)
            ok += 1
        except Exception:
            skip += 1

    return {"status": "success", "ingested": ok, "skipped": skip}


def ingest_sensor_event(data: dict) -> str:
    """Ingest a single sensor reading."""
    grid_id = data.get("grid_id")
    if not grid_id and data.get("lat") and data.get("lon"):
        grid_id = get_grid_id(data["lat"], data["lon"])
    if not grid_id:
        grid_id = "unknown"
    db.insert_sensor(data, grid_id)
    return grid_id


def ingest_sensors_csv(file_bytes: bytes) -> dict:
    df = pd.read_csv(io.StringIO(file_bytes.decode("utf-8")))
    required = {"sensor_id", "timestamp", "aqi"}
    missing = required - set(df.columns)
    if missing:
        return {"status": "error", "message": f"Missing columns: {missing}"}

    ok = 0
    for _, row in df.iterrows():
        try:
            row_dict = row.to_dict()
            grid_id = row_dict.get("grid_id")
            if not grid_id and "lat" in row_dict and "lon" in row_dict:
                grid_id = get_grid_id(float(row["lat"]), float(row["lon"]))
            if not grid_id:
                grid_id = "unknown"
            db.insert_sensor(row_dict, grid_id)
            ok += 1
        except Exception:
            pass

    return {"status": "success", "ingested": ok}
