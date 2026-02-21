"""
ENVISIONGRID — Cascade-Aware Simulation Engine
Extends the basic simulate.py with cascade propagation.

Intervention flow:
  1. Compute baseline features & risks per affected grids.
  2. Apply intervention (reduce a violation type by a factor).
  3. Re-compute features with adjustment.
  4. Run cascade engine on BOTH baseline and simulated states.
  5. Return full before/after delta including cascade scores.

For single-grid interventions the cascade delta shows how stopping
a local pollutant chain also reduces downstream vector_health risk etc.
"""
import logging
from typing import Dict, List, Any, Optional

logger = logging.getLogger("envisiongrid.simulation")


def run_intervention(
    intervention_type: str,
    percentage_reduction: float,      # 0–100
    target_risk: str,                  # e.g. "air_quality"
    duration_days: int = 7,
    grid_ids: Optional[List[str]] = None,
    use_sensors: bool = True,
) -> Dict[str, Any]:
    """
    Cascade-aware intervention simulation.

    Args:
        intervention_type: Human-readable label, e.g. "reduce_burning"
        percentage_reduction: 0–100 how much to reduce violations.
        target_risk: Primary risk type being targeted.
        duration_days: Simulation window.
        grid_ids: Grid cells to apply the intervention to.
                  If None, uses all active grids from DB.
        use_sensors: Whether to include sensor data.

    Returns:
        {
          intervention_type, target_risk, percentage_reduction,
          affected_grids: int,
          before_risk: {grid_id: {risk_type: score}},
          after_risk:  {grid_id: {risk_type: score}},
          cascade_difference: {grid_id: {risk_type: delta}},
          policy_impact_score: float,    # aggregate reduction
          grid_results: [per-grid detail]
        }
    """
    from src import db
    from src.services.feature_cache import cached_compute_features
    from src.services.cascading_engine import run_cascade_for_grid
    from src.services.risk_memory import enrich_features_with_memory
    from src.features import compute_neighbor_spillover
    from src.model_adapter import PlaceholderRiskModel

    model = PlaceholderRiskModel()
    factor = 1.0 - (percentage_reduction / 100.0)

    # Resolve grid list
    if not grid_ids:
        grid_ids = db.get_all_grid_ids()
    if not grid_ids:
        return {"status": "no_data", "policy_impact_score": 0.0}

    # ── Map violation_type from target_risk ───────────────────────────
    _risk_to_vtype = {
        "air_quality":     "burning",
        "waste":           "dumping",
        "flood":           "drainage",
        "infrastructure":  "illegal_construction",
        "water_stagnation":"sewage",
    }
    violation_type = _risk_to_vtype.get(target_risk, target_risk)

    adjustments = {
        "violation_type": violation_type,
        "factor": factor,
        "window_days": duration_days,
    }

    before_risk: Dict[str, Dict] = {}
    after_risk:  Dict[str, Dict] = {}
    cascade_diff: Dict[str, Dict] = {}
    grid_results = []

    for gid in grid_ids:
        # ── Baseline ──────────────────────────────────────────────────
        base_feats = cached_compute_features(gid, use_sensors=use_sensors)
        base_feats["neighbor_spillover_3d"] = compute_neighbor_spillover(gid, use_sensors)
        base_feats = enrich_features_with_memory(base_feats, gid, target_risk)
        base_pred = model.predict(base_feats, target_risk, 72, use_sensors)
        base_cascade = run_cascade_for_grid(
            gid, base_pred["risk_score"], target_risk, use_sensors, save_result=False
        )

        # ── Simulated ─────────────────────────────────────────────────
        sim_feats = cached_compute_features(
            gid, use_sensors=use_sensors, simulation_adjustments=adjustments
        )
        sim_feats["neighbor_spillover_3d"] = compute_neighbor_spillover(gid, use_sensors)
        sim_feats = enrich_features_with_memory(sim_feats, gid, target_risk)
        sim_pred = model.predict(sim_feats, target_risk, 72, use_sensors)
        sim_cascade = run_cascade_for_grid(
            gid, sim_pred["risk_score"], target_risk, use_sensors, save_result=False
        )

        # ── Deltas ────────────────────────────────────────────────────
        base_final = base_cascade["final_scores"]
        sim_final  = sim_cascade["final_scores"]
        diff = {rt: round(sim_final[rt] - base_final[rt], 4) for rt in base_final}

        before_risk[gid] = base_final
        after_risk[gid]  = sim_final
        cascade_diff[gid] = diff

        grid_results.append({
            "grid_id":         gid,
            "original_risk":   base_pred["risk_score"],
            "simulated_risk":  sim_pred["risk_score"],
            "risk_delta":      round(sim_pred["risk_score"] - base_pred["risk_score"], 4),
            "cascade_delta":   round(sim_cascade["cascade_score"] - base_cascade["cascade_score"], 4),
            "before_cascade":  base_cascade["cascade_score"],
            "after_cascade":   sim_cascade["cascade_score"],
            "original_drivers":  base_pred["drivers"],
            "simulated_drivers": sim_pred["drivers"],
        })

    # ── Policy impact score: average risk reduction across all grids ──
    all_deltas = [r["risk_delta"] for r in grid_results if r["risk_delta"] < 0]
    if all_deltas:
        avg_reduction = abs(sum(all_deltas) / len(all_deltas))
        # Normalize: a 0.3 reduction on a 0–1 scale = 100% policy impact
        policy_impact_score = round(min(avg_reduction / 0.3, 1.0), 4)
    else:
        policy_impact_score = 0.0

    return {
        "intervention_type":    intervention_type,
        "target_risk":          target_risk,
        "percentage_reduction": percentage_reduction,
        "affected_grids":       len(grid_ids),
        "before_risk":          before_risk,
        "after_risk":           after_risk,
        "cascade_difference":   cascade_diff,
        "policy_impact_score":  policy_impact_score,
        "grid_results":         grid_results,
    }
