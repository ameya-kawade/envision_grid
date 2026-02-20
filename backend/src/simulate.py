"""
ENVISIONGRID — What-If Policy Simulation
Recomputes risk with virtual adjustments to features.
"""
from typing import Dict, List
from src.features import compute_features, compute_neighbor_spillover
from src.model_adapter import PlaceholderRiskModel

_model = PlaceholderRiskModel()


def run_simulation(grid_id: str, risk_type: str, horizon: int,
                   adjustments: Dict, use_sensors: bool = True) -> Dict:
    """
    Compare baseline risk vs simulated risk after applying adjustments.
    adjustments: {violation_type, factor, window_days}
    """
    # Baseline
    base_feats = compute_features(grid_id, use_sensors=use_sensors)
    base_feats["neighbor_spillover_3d"] = compute_neighbor_spillover(grid_id, use_sensors)
    base_pred = _model.predict(base_feats, risk_type, horizon, use_sensors)

    # Simulated
    sim_feats = compute_features(grid_id, use_sensors=use_sensors,
                                 simulation_adjustments=adjustments)
    sim_feats["neighbor_spillover_3d"] = compute_neighbor_spillover(grid_id, use_sensors)
    sim_pred = _model.predict(sim_feats, risk_type, horizon, use_sensors)

    delta = round(sim_pred["risk_score"] - base_pred["risk_score"], 4)

    return {
        "grid_id": grid_id,
        "original_risk": base_pred["risk_score"],
        "simulated_risk": sim_pred["risk_score"],
        "delta": delta,
        "original_confidence": base_pred["confidence"],
        "simulated_confidence": sim_pred["confidence"],
        "original_drivers": base_pred["drivers"],
        "simulated_drivers": sim_pred["drivers"],
        "original_actions": base_pred["actions"],
        "simulated_actions": sim_pred["actions"],
    }
