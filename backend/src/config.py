"""
ENVISIONGRID — Central Configuration
All tunable parameters live here so judges can see what's configurable.
"""
import os

# ── Database (MongoDB Atlas) ──────────────────────────────────────────
MONGO_URI = os.getenv(
    "ENVISIONGRID_MONGO_URI",
    "mongodb://admin:admin123@localhost:27017/"
)
MONGO_DB_NAME = os.getenv("ENVISIONGRID_DB_NAME", "envisiongrid")

# ── Geo-Grid ──────────────────────────────────────────────────────────
GRID_PRECISION = 2          # decimal places for lat/lon rounding
# At 2 decimals: ~1.1 km cells at equator — city-scale granularity

# ── Feature Windows (days) ────────────────────────────────────────────
FEATURE_WINDOWS = [1, 3, 7]
RECENCY_DECAY_LAMBDA = 0.3  # exponential decay rate

# ── Placeholder Model Weights ────────────────────────────────────────
# These mirror what a trained model would learn.
MODEL_WEIGHTS = {
    "severity_weighted_score_3d": 0.30,
    "recency_decay_score":       0.25,
    "neighbor_spillover_3d":     0.15,
    "complaint_trend":           0.10,
    "repeat_offender_score_7d":  0.15,
    "violation_diversity":       0.05,
}

# Horizon multipliers — shorter horizon = more sensitive to recency
HORIZON_MULTIPLIERS = {
    24:  {"recency_decay_score": 1.4, "severity_weighted_score_3d": 1.1},
    72:  {},  # baseline
    168: {"recency_decay_score": 0.6, "severity_weighted_score_3d": 0.8,
          "complaint_trend": 1.3},
}

# Sensor validation
SENSOR_SPIKE_AQI_THRESHOLD = 150.0
SENSOR_RISK_BOOST = 0.05       # small additive boost when sensor confirms
SENSOR_CONFIDENCE_BOOST = 0.10 # confidence increase when sensor aligned

# ── Sigmoid centering ────────────────────────────────────────────────
SIGMOID_CENTER = 3.5           # raw score at which risk = 0.50

# ── Alert threshold default ──────────────────────────────────────────
DEFAULT_ALERT_THRESHOLD = 0.60

# ── API ───────────────────────────────────────────────────────────────
API_HOST = "127.0.0.1"
API_PORT = 8000

# ── Risk types ────────────────────────────────────────────────────────
RISK_TYPES = ["air", "water", "waste", "all"]

# ── Violation type → risk type mapping ────────────────────────────────
VIOLATION_RISK_MAP = {
    "illegal_burning":      "air",
    "industrial_emission":  "air",
    "vehicle_emission":     "air",
    "sewage_discharge":     "water",
    "chemical_spill":       "water",
    "illegal_dumping":      "waste",
    "dumping":              "waste",
    "hazardous_waste":      "waste",
    "noise_violation":      "air",   # fallback
}
