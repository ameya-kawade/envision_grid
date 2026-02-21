"""
ENVISIONGRID — Deep Explainability Engine
Extends basic driver generation with:
  - Feature contribution breakdown (normalized weights)
  - Cascade propagation path from cascading_engine
  - Risk memory weight
  - SHAP-style top_factors list
"""
import logging
from typing import Dict, List, Any, Optional

logger = logging.getLogger("envisiongrid.explain")

# Feature normalization constants (same as PlaceholderRiskModel.FEATURE_NORMS)
_FEATURE_NORMS = {
    "severity_weighted_score_3d":    50.0,
    "recency_decay_score":           10.0,
    "neighbor_spillover_3d":         30.0,
    "complaint_trend":                2.0,
    "repeat_offender_score_7d":       1.0,
    "violation_diversity":            5.0,
    "recurrence_memory_weight":       1.0,
    "sensor_aqi_mean_1d":          300.0,
}

# Friendly display names
_FEATURE_LABELS = {
    "severity_weighted_score_3d":   "Severity-weighted violations (72h)",
    "recency_decay_score":          "Recency decay score",
    "neighbor_spillover_3d":        "Neighbor grid spillover",
    "complaint_trend":              "Citizen complaint trend",
    "repeat_offender_score_7d":     "Repeat offender score",
    "violation_diversity":          "Violation type diversity",
    "recurrence_memory_weight":     "Historical recurrence memory",
    "sensor_aqi_mean_1d":           "Sensor AQI (24h mean)",
}


def compute_feature_contributions(features: Dict[str, Any]) -> Dict[str, float]:
    """
    Return normalized contribution weight for each feature in [0, 1].
    Represents each feature's share of the total risk signal.
    """
    raw_contribs = {}
    for feat, norm in _FEATURE_NORMS.items():
        val = features.get(feat, 0)
        if isinstance(val, (int, float)):
            raw_contribs[feat] = min(float(val) / norm, 1.5)

    total = sum(raw_contribs.values())
    if total == 0:
        return {feat: 0.0 for feat in _FEATURE_NORMS}

    return {
        feat: round(raw / total, 4)
        for feat, raw in raw_contribs.items()
    }


def build_top_factors(features: Dict, contributions: Dict[str, float],
                       cascade_trace: List[str], risk_type: str) -> List[str]:
    """
    Merge feature contributions + cascade paths into top-5 plain-English factors.
    """
    from src.explain import generate_drivers
    factors = []

    # Start with existing driver generation (already rich text)
    sensor_validated = bool(features.get("sensor_coverage_flag", 0)
                            and features.get("sensor_aqi_mean_1d", 0) > 50)
    base_drivers = generate_drivers(features, risk_type, sensor_validated)
    factors.extend(base_drivers)

    # Add cascade paths as human-readable factors
    for path in cascade_trace[:3]:
        if "→" in path and len(path.split("→")) >= 2:
            hops = path.split("→")
            factors.append(
                f"Cross-domain cascade: {hops[0].replace('_', ' ')} "
                f"triggering {hops[-1].replace('_', ' ')}"
            )

    # Add memory if significant
    mem_w = features.get("recurrence_memory_weight", 0.0)
    if mem_w > 0.2:
        factors.append(
            f"Historical recurrence pattern active (weight: {mem_w:.2f}) "
            f"— this grid has been a repeat risk zone"
        )

    # Deduplicate while preserving order
    seen = set()
    unique = []
    for f in factors:
        if f not in seen:
            seen.add(f)
            unique.append(f)

    return unique[:5]


def explain_grid(
    grid_id: str,
    risk_type: str = "all",
    use_sensors: bool = True,
) -> Dict[str, Any]:
    """
    Full explainability report for a grid cell.
    Fetches features, runs cascade, computes contributions.

    Returns:
      {
        grid_id, risk_type,
        top_factors: [str],
        feature_contributions: {name: float},
        cascade_path: [str],
        cascade_score: float,
        risk_memory_weight: float,
        primary_risk_score: float,
      }
    """
    from src.services.feature_cache import cached_compute_features
    from src.services.risk_memory import get_memory_boost, enrich_features_with_memory
    from src.services.cascading_engine import propagate
    from src.model_adapter import PlaceholderRiskModel
    from src.features import compute_neighbor_spillover
    from src import db

    # ── 1. Features ────────────────────────────────────────────────────
    feats = cached_compute_features(grid_id, use_sensors=use_sensors)
    feats["neighbor_spillover_3d"] = compute_neighbor_spillover(grid_id, use_sensors)
    feats = enrich_features_with_memory(feats, grid_id, risk_type)

    # ── 2. Primary prediction ─────────────────────────────────────────
    model = PlaceholderRiskModel()
    pred = model.predict(feats, risk_type, horizon=72, use_sensors=use_sensors)
    primary_score = pred["risk_score"]

    # ── 3. Cascade ────────────────────────────────────────────────────
    # Try to load persisted cascade result first
    cached_cascade = db.get_cascade_result(grid_id)
    if cached_cascade:
        cascade_trace = cached_cascade.get("propagation_trace", [])
        cascade_score = cached_cascade.get("cascade_score", 0.0)
    else:
        # Compute on-the-fly
        from src.services.cascading_engine import run_cascade_for_grid
        cascade_result = run_cascade_for_grid(
            grid_id, primary_score, risk_type, use_sensors, save_result=False
        )
        cascade_trace = cascade_result.get("propagation_trace", [])
        cascade_score = cascade_result.get("cascade_score", 0.0)

    # ── 4. Contributions ──────────────────────────────────────────────
    contributions = compute_feature_contributions(feats)

    # ── 5. Top factors ────────────────────────────────────────────────
    top_factors = build_top_factors(feats, contributions, cascade_trace, risk_type)

    # ── 6. Memory weight ──────────────────────────────────────────────
    mem_weight = feats.get("recurrence_memory_weight", 0.0)

    return {
        "grid_id": grid_id,
        "risk_type": risk_type,
        "primary_risk_score": primary_score,
        "top_factors": top_factors,
        "feature_contributions": {
            _FEATURE_LABELS.get(k, k): v
            for k, v in contributions.items()
            if v > 0
        },
        "cascade_path": cascade_trace[:10],
        "cascade_score": cascade_score,
        "risk_memory_weight": mem_weight,
    }
