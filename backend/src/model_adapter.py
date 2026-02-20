"""
ENVISIONGRID — Model Adapter + Placeholder Risk Model
Clean interface: swap PlaceholderRiskModel for a trained artifact later.
"""
from abc import ABC, abstractmethod
from typing import Dict, List, Tuple
import numpy as np

from src.config import (
    MODEL_WEIGHTS, HORIZON_MULTIPLIERS, SIGMOID_CENTER,
    SENSOR_RISK_BOOST, SENSOR_CONFIDENCE_BOOST,
)
from src.utils import sigmoid, clamp
from src.explain import generate_drivers
from src.actions import generate_actions


class ModelAdapter(ABC):
    """
    Abstract interface for risk models.
    To integrate a trained model later:
      1) Subclass ModelAdapter
      2) Load your .pkl / .joblib artifact in __init__
      3) Implement predict()
      4) Register it in api.py
    """

    @abstractmethod
    def predict(self, features: Dict, risk_type: str, horizon: int,
                use_sensors: bool = True) -> Dict:
        """
        Returns dict with:
          risk_score, confidence, uncertainty, drivers, actions, sensor_validated
        """
        pass


class PlaceholderRiskModel(ModelAdapter):
    """
    Deterministic heuristic model that mimics trained behaviour.
    Produces stable, reproducible risk scores from features.
    """

    # Feature normalization constants (expected ranges for demo data)
    FEATURE_NORMS = {
        "severity_weighted_score_3d": 50.0,  # sum of severity² can be large
        "recency_decay_score":       10.0,
        "neighbor_spillover_3d":     30.0,
        "complaint_trend":            2.0,   # already roughly [0,2]
        "repeat_offender_score_7d":   1.0,   # already [0,1]
        "violation_diversity":        5.0,
    }

    def predict(self, features: Dict, risk_type: str, horizon: int,
                use_sensors: bool = True) -> Dict:

        # ── 1. Normalize + weighted raw score ─────────────────────────
        raw = 0.0
        for feat_name, weight in MODEL_WEIGHTS.items():
            val = features.get(feat_name, 0)
            if isinstance(val, str):
                continue
            # Normalize to ~[0,1] range
            norm = self.FEATURE_NORMS.get(feat_name, 1.0)
            normalized = min(float(val) / norm, 1.5)  # soft cap at 1.5
            # Apply horizon-specific multiplier
            multiplier = HORIZON_MULTIPLIERS.get(horizon, {}).get(feat_name, 1.0)
            raw += weight * normalized * multiplier

        # raw now in ~[0, 1.5] range; scale to sigmoid input
        sigmoid_input = (raw * 8.0) - SIGMOID_CENTER

        # ── 2. Sigmoid → risk_score ───────────────────────────────────
        risk_score = sigmoid(sigmoid_input)

        # ── 3. Sensor validation adjustment ───────────────────────────
        sensor_validated = False
        if use_sensors and features.get("sensor_spike_flag", 0) == 1:
            risk_score = clamp(risk_score + SENSOR_RISK_BOOST)
            sensor_validated = True

        risk_score = round(clamp(risk_score), 4)

        # ── 4. Confidence ─────────────────────────────────────────────
        confidence = self._compute_confidence(features, use_sensors)

        # ── 5. Uncertainty band ───────────────────────────────────────
        base_uncertainty = 0.15  # 15% at zero confidence
        uncertainty = round((1 - confidence) * base_uncertainty, 4)

        # ── 6. Drivers & Actions ──────────────────────────────────────
        drivers = generate_drivers(features, risk_type, sensor_validated)
        actions = generate_actions(features, drivers, risk_type)

        return {
            "risk_score": risk_score,
            "confidence": confidence,
            "uncertainty": uncertainty,
            "drivers": drivers,
            "actions": actions,
            "sensor_validated": sensor_validated,
        }

    def _compute_confidence(self, features: Dict, use_sensors: bool) -> float:
        """
        Data-density–based confidence.
        More data + sensor alignment = higher confidence.
        """
        v7 = features.get("violation_count_7d", 0)
        c7 = features.get("complaint_count_7d", 0)
        data_points = v7 + c7

        if data_points == 0:
            conf = 0.30
        elif data_points < 3:
            conf = 0.50
        elif data_points < 8:
            conf = 0.65
        elif data_points < 15:
            conf = 0.75
        else:
            conf = 0.85

        # Sensor boost
        if use_sensors and features.get("sensor_coverage_flag", 0) == 1:
            conf = clamp(conf + SENSOR_CONFIDENCE_BOOST)
            # Signal agreement boost
            if features.get("sensor_spike_flag", 0) == 1 and v7 > 2:
                conf = clamp(conf + 0.05)

        return round(clamp(conf), 2)
