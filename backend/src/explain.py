"""
ENVISIONGRID — Explainability / Driver Generation
Produces top-3 plain-English reasons for each risk prediction.
"""
from typing import Dict, List


def generate_drivers(features: Dict, risk_type: str,
                     sensor_validated: bool = False) -> List[str]:
    """
    Rank feature contributions and produce human-readable driver strings.
    Top 3 drivers returned.
    """
    candidates = []

    # Severity trend
    sw3 = features.get("severity_weighted_score_3d", 0)
    sw7 = features.get("severity_weighted_score_7d", 0)
    if sw3 > 0:
        ratio = round(sw3 / max(sw7 / 2.33, 0.01), 1)  # 3d vs normalised 7d
        candidates.append((sw3 * 2,
            f"Severity-weighted violations {'surging' if ratio > 1.5 else 'elevated'} "
            f"({ratio}× baseline over 72h)"))

    # Volume trend
    vc3 = features.get("violation_count_3d", 0)
    vc7 = features.get("violation_count_7d", 0)
    if vc7 > 3:
        candidates.append((vc7 * 1.2,
            f"High violation frequency: {vc7} events in 7 days"))
    elif vc3 > 0:
        candidates.append((vc3 * 1.0,
            f"{vc3} violation(s) detected in the last 72 hours"))

    # Recency
    rec = features.get("recency_decay_score", 0)
    if rec > 2:
        candidates.append((rec * 1.5,
            f"Recent high-severity event (recency score: {round(rec, 1)})"))

    # Repeat offender
    if features.get("repeat_offender_flag", 0) == 1:
        src = features.get("repeat_offender_source", "unknown")
        score = features.get("repeat_offender_score_7d", 0)
        candidates.append((score * 8,
            f"Repeat offender detected: '{src}' ({round(score * 3, 0):.0f} events in 7d)"))

    # Complaints
    ct = features.get("complaint_trend", 0)
    cc3 = features.get("complaint_count_3d", 0)
    if cc3 > 0:
        candidates.append((ct * 3,
            f"Citizen complaints trending ({'up' if ct > 0.7 else 'steady'}): "
            f"{cc3} in 3 days"))

    # Spillover
    # (computed externally, passed via features if populated)
    ns = features.get("neighbor_spillover_3d", 0)
    if ns > 0:
        candidates.append((ns * 0.8,
            f"Spillover from adjacent grid cells (neighbor score: {round(ns, 1)})"))

    # Sensor
    if sensor_validated:
        aqi = features.get("sensor_aqi_mean_1d", 0)
        candidates.append((5.0,
            f"Edge sensor confirmed elevated readings (AQI: {round(aqi, 0)})"))

    # Max severity
    ms = features.get("max_severity_3d", 0)
    if ms >= 5:
        candidates.append((ms * 2.5,
            "Critical severity-5 violation recorded in last 72 hours"))

    # Sort by score desc, take top 3
    candidates.sort(key=lambda x: x[0], reverse=True)
    drivers = [c[1] for c in candidates[:3]]

    if not drivers:
        drivers = ["Low activity — insufficient data for strong signal"]

    return drivers
