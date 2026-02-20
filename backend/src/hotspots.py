"""
ENVISIONGRID — Hotspot Detection
Identifies top risk zones by composite score.
"""
from typing import List, Dict
from src.db import get_all_grid_ids
from src.features import compute_features, compute_neighbor_spillover
from src.model_adapter import PlaceholderRiskModel

_model = PlaceholderRiskModel()


def get_hotspots(limit: int = 15, use_sensors: bool = True) -> List[Dict]:
    """
    Score every active grid and return top N by risk.
    """
    grids = get_all_grid_ids()
    results = []

    for gid in grids:
        feats = compute_features(gid, use_sensors=use_sensors)
        # Skip grids with zero activity
        if feats.get("violation_count_7d", 0) == 0:
            continue

        feats["neighbor_spillover_3d"] = compute_neighbor_spillover(gid, use_sensors)
        pred = _model.predict(feats, "all", 72, use_sensors)

        results.append({
            "grid_id": gid,
            "risk_score": pred["risk_score"],
            "confidence": pred["confidence"],
            "uncertainty": pred["uncertainty"],
            "drivers": pred["drivers"],
            "violation_count_7d": feats.get("violation_count_7d", 0),
            "sensor_validated": pred["sensor_validated"],
        })

    results.sort(key=lambda x: x["risk_score"], reverse=True)
    return results[:limit]
