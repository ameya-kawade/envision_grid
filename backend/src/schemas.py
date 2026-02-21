"""
ENVISIONGRID — Pydantic Schemas
Strict validation for every data contract.
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


# ═══════════════════════════════════════════════════════════════════════
# INGESTION
# ═══════════════════════════════════════════════════════════════════════

class ViolationEvent(BaseModel):
    violation_id: str
    timestamp: str  # ISO 8601
    lat: float
    lon: float
    violation_type: str
    severity: int = Field(..., ge=1, le=5)
    description: Optional[str] = None
    source: Optional[str] = None


class ComplaintEvent(BaseModel):
    complaint_id: str
    timestamp: str
    lat: float
    lon: float
    complaint_type: str
    intensity: int = Field(..., ge=1, le=5)


class SensorReading(BaseModel):
    sensor_id: str
    timestamp: str
    grid_id: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    aqi: float = Field(..., ge=0)
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    gas_index: Optional[float] = None


# ═══════════════════════════════════════════════════════════════════════
# PREDICTION
# ═══════════════════════════════════════════════════════════════════════

class PredictionRequest(BaseModel):
    risk_type: str = "all"
    horizon_hours: int = 72
    threshold: float = 0.6
    use_sensors: bool = True
    date_range_days: Optional[int] = None


class ActionRecommendation(BaseModel):
    action: str
    rationale: str
    effort_level: str  # LOW / MED / HIGH
    expected_impact_score: float = Field(..., ge=0, le=1)


class PredictionResult(BaseModel):
    grid_id: str
    risk_type: str
    horizon_hours: int
    risk_score: float
    confidence: float
    uncertainty: float
    drivers: List[str]
    actions: List[ActionRecommendation]
    sensor_validated: bool = False


# ═══════════════════════════════════════════════════════════════════════
# ALERTS & CASES
# ═══════════════════════════════════════════════════════════════════════

class AlertCreate(BaseModel):
    grid_id: str
    risk_score: float
    risk_type: str
    horizon_hours: int
    drivers: List[str]
    actions: List[Dict[str, Any]]


class CaseCreate(BaseModel):
    alert_id: str  # MongoDB ObjectId string
    assigned_to: Optional[str] = None
    notes: Optional[str] = None


class CaseUpdate(BaseModel):
    status: Optional[str] = None
    assigned_to: Optional[str] = None
    notes: Optional[str] = None


# ═══════════════════════════════════════════════════════════════════════
# SIMULATION
# ═══════════════════════════════════════════════════════════════════════

class SimulationAdjustment(BaseModel):
    grid_id: str
    violation_type: Optional[str] = None
    factor: float = Field(1.0, ge=0.0, le=2.0)
    window_days: int = 7


class SimulationRequest(BaseModel):
    risk_type: str = "all"
    horizon_hours: int = 72
    adjustments: List[SimulationAdjustment]


class SimulationResult(BaseModel):
    grid_id: str
    original_risk: float
    simulated_risk: float
    delta: float
    original_drivers: List[str]
    simulated_drivers: List[str]
    original_actions: List[Dict[str, Any]]
    simulated_actions: List[Dict[str, Any]]


# ═══════════════════════════════════════════════════════════════════════
# CASCADING ENGINE
# ═══════════════════════════════════════════════════════════════════════

class CascadeRequest(BaseModel):
    risk_type: str = "all"
    horizon_hours: int = 72
    threshold: float = 0.4
    use_sensors: bool = True
    save_results: bool = True


class CascadeImpact(BaseModel):
    type: str
    score: float
    source: str
    path: str


class CascadeResult(BaseModel):
    grid_id: str
    primary_risk_score: float
    cascade_score: float
    primary_risks: Dict[str, float]
    secondary_impacts: List[Dict[str, Any]]
    tertiary_impacts: List[Dict[str, Any]]
    propagation_trace: List[str]
    final_scores: Dict[str, float]


# ═══════════════════════════════════════════════════════════════════════
# INTERVENTION SIMULATION
# ═══════════════════════════════════════════════════════════════════════

class InterventionRequest(BaseModel):
    intervention_type: str   # e.g. "reduce_burning"
    percentage_reduction: float = Field(..., ge=0, le=100)
    target_risk: str         # e.g. "air_quality"
    duration_days: int = 7
    grid_ids: Optional[List[str]] = None  # None = all active grids
    use_sensors: bool = True


# ═══════════════════════════════════════════════════════════════════════
# CASE CLOSE (with memory update)
# ═══════════════════════════════════════════════════════════════════════

class CaseClose(BaseModel):
    resolution_notes: Optional[str] = None
    risk_type: str = "all"         # for memory routing
    risk_score: float = 0.5        # used to compute severity weight
