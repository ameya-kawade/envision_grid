"""
ENVISIONGRID — Feature Engineering Pipeline
Computes all features for a grid_id: violations, complaints, sensors, spillover.
"""
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, Optional

from src.db import get_db
from src.geo_grid import get_neighbors
from src.config import FEATURE_WINDOWS, RECENCY_DECAY_LAMBDA, SENSOR_SPIKE_AQI_THRESHOLD


def _load_violations(grid_id: str, days_back: int = 30) -> pd.DataFrame:
    db = get_db()
    cutoff = (datetime.utcnow() - timedelta(days=days_back)).isoformat()
    docs = list(db.violations.find(
        {"grid_id": grid_id, "timestamp": {"$gte": cutoff}},
        {"_id": 0}
    ))
    df = pd.DataFrame(docs) if docs else pd.DataFrame()
    if not df.empty and "timestamp" in df.columns:
        df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    return df


def _load_complaints(grid_id: str, days_back: int = 30) -> pd.DataFrame:
    db = get_db()
    cutoff = (datetime.utcnow() - timedelta(days=days_back)).isoformat()
    docs = list(db.complaints.find(
        {"grid_id": grid_id, "timestamp": {"$gte": cutoff}},
        {"_id": 0}
    ))
    df = pd.DataFrame(docs) if docs else pd.DataFrame()
    if not df.empty and "timestamp" in df.columns:
        df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    return df


def _load_sensors(grid_id: str, days_back: int = 7) -> pd.DataFrame:
    db = get_db()
    cutoff = (datetime.utcnow() - timedelta(days=days_back)).isoformat()
    docs = list(db.sensors.find(
        {"grid_id": grid_id, "timestamp": {"$gte": cutoff}},
        {"_id": 0}
    ))
    df = pd.DataFrame(docs) if docs else pd.DataFrame()
    if not df.empty and "timestamp" in df.columns:
        df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    return df


def compute_features(grid_id: str, use_sensors: bool = True,
                     simulation_adjustments: Optional[Dict] = None) -> Dict:
    """
    Full feature vector for a grid cell.
    Returns a dict of named features ready for the model adapter.
    """
    now = datetime.utcnow()
    df_v = _load_violations(grid_id)
    df_c = _load_complaints(grid_id)
    df_s = _load_sensors(grid_id) if use_sensors else pd.DataFrame()

    # ── Simulation adjustment: virtually reduce violations ────────────
    if simulation_adjustments and not df_v.empty:
        v_type = simulation_adjustments.get("violation_type")
        factor = simulation_adjustments.get("factor", 1.0)
        window = simulation_adjustments.get("window_days", 7)
        cutoff = now - timedelta(days=window)
        if v_type and factor < 1.0:
            mask = (df_v["violation_type"] == v_type) & (df_v["timestamp"] >= cutoff)
            n_to_keep = int(mask.sum() * factor)
            drop_indices = df_v[mask].index[n_to_keep:]
            df_v = df_v.drop(drop_indices)

    feats = {}

    # ═══ A) Violation Features ════════════════════════════════════════
    for days in FEATURE_WINDOWS:
        cutoff = now - timedelta(days=days)
        if not df_v.empty:
            window_df = df_v[df_v["timestamp"] >= cutoff]
            feats[f"violation_count_{days}d"] = len(window_df)
            feats[f"severity_sum_{days}d"] = int(window_df["severity"].sum()) if len(window_df) else 0
            feats[f"severity_weighted_score_{days}d"] = float(
                (window_df["severity"] * window_df["severity"]).sum()
            ) if len(window_df) else 0.0
            feats[f"max_severity_{days}d"] = int(window_df["severity"].max()) if len(window_df) else 0
        else:
            feats[f"violation_count_{days}d"] = 0
            feats[f"severity_sum_{days}d"] = 0
            feats[f"severity_weighted_score_{days}d"] = 0.0
            feats[f"max_severity_{days}d"] = 0

    # Recency decay
    if not df_v.empty:
        days_ago = (now - df_v["timestamp"]).dt.total_seconds() / 86400.0
        decay = np.exp(-RECENCY_DECAY_LAMBDA * days_ago)
        feats["recency_decay_score"] = float((df_v["severity"] * decay).sum())
    else:
        feats["recency_decay_score"] = 0.0

    # Violation diversity
    feats["violation_diversity"] = int(df_v["violation_type"].nunique()) if not df_v.empty else 0

    # Dominant violation type
    if not df_v.empty:
        feats["dominant_violation_type"] = df_v["violation_type"].value_counts().index[0]
    else:
        feats["dominant_violation_type"] = "none"

    # ═══ B) Complaint Features ════════════════════════════════════════
    for days in FEATURE_WINDOWS:
        cutoff = now - timedelta(days=days)
        if not df_c.empty:
            window_df = df_c[df_c["timestamp"] >= cutoff]
            feats[f"complaint_count_{days}d"] = len(window_df)
            feats[f"complaint_intensity_sum_{days}d"] = int(window_df["intensity"].sum()) if len(window_df) else 0
        else:
            feats[f"complaint_count_{days}d"] = 0
            feats[f"complaint_intensity_sum_{days}d"] = 0

    # Complaint trend (3d vs 7d normalized)
    c3 = feats.get("complaint_count_3d", 0)
    c7 = feats.get("complaint_count_7d", 0)
    feats["complaint_trend"] = (c3 / max(c7, 1)) * 2.0 if c7 > 0 else (0.5 if c3 > 0 else 0.0)

    # ═══ D) Repeat Offender ═══════════════════════════════════════════
    if not df_v.empty and "source" in df_v.columns:
        source_counts = df_v["source"].dropna().value_counts()
        max_repeat = int(source_counts.max()) if len(source_counts) > 0 else 0
        feats["repeat_offender_score_7d"] = min(max_repeat / 3.0, 1.0)
        feats["repeat_offender_flag"] = 1 if max_repeat >= 3 else 0
        if max_repeat >= 3:
            feats["repeat_offender_source"] = source_counts.index[0]
        else:
            feats["repeat_offender_source"] = ""
    else:
        feats["repeat_offender_score_7d"] = 0.0
        feats["repeat_offender_flag"] = 0
        feats["repeat_offender_source"] = ""

    # ═══ E) Sensor Validation Features ════════════════════════════════
    feats["sensor_coverage_flag"] = 0
    feats["sensor_aqi_mean_1d"] = 0.0
    feats["sensor_aqi_trend_3d"] = 0.0
    feats["sensor_spike_flag"] = 0

    if use_sensors and not df_s.empty:
        feats["sensor_coverage_flag"] = 1
        recent_1d = df_s[df_s["timestamp"] >= (now - timedelta(days=1))]
        if not recent_1d.empty:
            feats["sensor_aqi_mean_1d"] = float(recent_1d["aqi"].mean())
        recent_3d = df_s[df_s["timestamp"] >= (now - timedelta(days=3))]
        if len(recent_3d) >= 2:
            half = len(recent_3d) // 2
            old_mean = recent_3d.iloc[:half]["aqi"].mean()
            new_mean = recent_3d.iloc[half:]["aqi"].mean()
            feats["sensor_aqi_trend_3d"] = float(new_mean - old_mean)
        if not df_s.empty and df_s["aqi"].max() >= SENSOR_SPIKE_AQI_THRESHOLD:
            feats["sensor_spike_flag"] = 1

    return feats


def compute_neighbor_spillover(grid_id: str, use_sensors: bool = True) -> float:
    """Mean severity_weighted_score_3d of 8-connected neighbors."""
    neighbors = get_neighbors(grid_id)
    scores = []
    for ngid in neighbors:
        nf = compute_features(ngid, use_sensors=use_sensors)
        scores.append(nf.get("severity_weighted_score_3d", 0))
    return float(np.mean(scores)) if scores else 0.0


def compute_neighbor_complaints(grid_id: str) -> float:
    """Mean complaint_count_3d of 8-connected neighbors."""
    neighbors = get_neighbors(grid_id)
    vals = []
    for ngid in neighbors:
        nf = compute_features(ngid, use_sensors=False)
        vals.append(nf.get("complaint_count_3d", 0))
    return float(np.mean(vals)) if vals else 0.0
