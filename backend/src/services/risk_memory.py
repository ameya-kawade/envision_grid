"""
ENVISIONGRID — Risk Memory & Feedback Loop
When a case is closed, this module updates the grid's recurrence weight.
The weight feeds back into future risk scoring as an additive feature boost.

Schema (MongoDB `risk_memory` collection):
  { grid_id, risk_type, recurrence_weight, event_count, updated_at }
"""
import logging
from datetime import datetime
from typing import Dict, Optional

logger = logging.getLogger("envisiongrid.risk_memory")

LEARNING_RATE = 0.15          # how much each closure shifts the weight
MAX_WEIGHT = 1.0              # hard cap
HIGH_SEVERITY_THRESHOLD = 0.7 # risk scores above this count as "high severity"
DECAY_RATE = 0.02             # per-day passive decay when weights are read


def apply_feedback(
    grid_id: str,
    risk_type: str,
    risk_score: float,
) -> float:
    """
    Called when a case is CLOSED.
    Updates recurrence_weight and returns the new value.

    recurrence_weight += learning_rate * severity_factor
    where severity_factor = 1.0 for high severity, 0.3 for low.
    """
    from src import db  # deferred import

    severity_factor = 1.0 if risk_score >= HIGH_SEVERITY_THRESHOLD else 0.3
    delta = LEARNING_RATE * severity_factor

    new_weight = db.upsert_risk_memory(grid_id, risk_type, delta)
    logger.info(
        f"Risk memory updated for {grid_id}/{risk_type}: "
        f"delta={delta:.3f} → weight={new_weight:.3f}"
    )
    return new_weight


def get_memory_boost(grid_id: str, risk_type: str = "all") -> float:
    """
    Return the current recurrence_weight for a grid, applying passive
    time-decay. Returns 0.0 if no memory exists.
    """
    from src import db  # deferred import

    mem = db.get_risk_memory(grid_id, risk_type)
    if not mem:
        return 0.0

    weight = mem.get("recurrence_weight", 0.0)
    updated_at = mem.get("updated_at")

    # Apply passive daily decay
    if updated_at:
        try:
            if isinstance(updated_at, str):
                updated_at = datetime.fromisoformat(updated_at)
            days_elapsed = (datetime.utcnow() - updated_at).total_seconds() / 86400.0
            weight = max(weight - DECAY_RATE * days_elapsed, 0.0)
        except Exception:
            pass

    return round(weight, 4)


def enrich_features_with_memory(features: Dict, grid_id: str,
                                  risk_type: str = "all") -> Dict:
    """
    Non-destructively add recurrence memory as a feature.
    Called inside the prediction pipeline before model.predict().
    """
    boost = get_memory_boost(grid_id, risk_type)
    features = dict(features)
    features["recurrence_memory_weight"] = boost
    # Additively boost the recency decay score so the model picks it up
    if boost > 0:
        features["recency_decay_score"] = features.get("recency_decay_score", 0.0) + (boost * 3.0)
        logger.debug(f"Applied memory boost {boost:.3f} to {grid_id}")
    return features
