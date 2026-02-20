"""
ENVISIONGRID — Action Recommendations
Produces 2-4 actionable recommendations based on risk drivers and violation types.
"""
from typing import Dict, List


# Templates keyed by dominant violation type
ACTION_TEMPLATES = {
    "illegal_burning": [
        {"action": "Deploy Air-Quality Patrol Unit",
         "rationale": "Recent illegal burning detected; immediate containment needed.",
         "effort_level": "HIGH", "expected_impact_score": 0.85},
        {"action": "Issue Community Burn-Ban Notice",
         "rationale": "Public awareness reduces recurrence by ~40%.",
         "effort_level": "LOW", "expected_impact_score": 0.50},
        {"action": "Install Temporary Air Monitoring Station",
         "rationale": "Continuous monitoring deters repeat violations.",
         "effort_level": "MED", "expected_impact_score": 0.60},
    ],
    "industrial_emission": [
        {"action": "Schedule Factory Compliance Audit",
         "rationale": "Regulatory inspection addresses root cause.",
         "effort_level": "HIGH", "expected_impact_score": 0.90},
        {"action": "Issue Warning / Fine to Repeat Offender",
         "rationale": "Financial penalty historically reduces violations by 55%.",
         "effort_level": "MED", "expected_impact_score": 0.70},
    ],
    "sewage_discharge": [
        {"action": "Emergency Water Quality Testing",
         "rationale": "Immediate contamination assessment required.",
         "effort_level": "MED", "expected_impact_score": 0.80},
        {"action": "Inspect Sewage Infrastructure",
         "rationale": "Infrastructure failure may be root cause.",
         "effort_level": "HIGH", "expected_impact_score": 0.85},
    ],
    "illegal_dumping": [
        {"action": "Deploy Cleanup Crew",
         "rationale": "Hazardous material removal is time-critical.",
         "effort_level": "HIGH", "expected_impact_score": 0.90},
        {"action": "Install Surveillance Cameras",
         "rationale": "Deterrence reduces dumping recurrence by ~60%.",
         "effort_level": "MED", "expected_impact_score": 0.65},
        {"action": "Increase Patrol Frequency",
         "rationale": "Visible enforcement in hotspot zone.",
         "effort_level": "LOW", "expected_impact_score": 0.45},
    ],
    "dumping": [  # alias
        {"action": "Deploy Cleanup Crew",
         "rationale": "Material removal needed.",
         "effort_level": "HIGH", "expected_impact_score": 0.88},
        {"action": "Community Clean-Up Drive",
         "rationale": "Engages citizens and improves reporting.",
         "effort_level": "LOW", "expected_impact_score": 0.40},
    ],
}

# Fallback generic actions
GENERIC_ACTIONS = [
    {"action": "Increase Monitoring Frequency",
     "rationale": "More data improves early warning accuracy.",
     "effort_level": "LOW", "expected_impact_score": 0.35},
    {"action": "Cross-Agency Coordination Meeting",
     "rationale": "Multi-department response for elevated risk zone.",
     "effort_level": "MED", "expected_impact_score": 0.50},
]

# High-risk supplementary
HIGH_RISK_ACTION = {
    "action": "Activate Emergency Response Protocol",
    "rationale": "Risk score exceeds critical threshold; rapid mobilisation required.",
    "effort_level": "HIGH",
    "expected_impact_score": 0.95,
}


def generate_actions(features: Dict, drivers: List[str],
                     risk_type: str) -> List[Dict]:
    """
    Return 2-4 recommended actions.
    """
    dom_type = features.get("dominant_violation_type", "").lower()
    risk_score_approx = features.get("severity_weighted_score_3d", 0) / 10  # rough proxy

    # Pick template
    actions = list(ACTION_TEMPLATES.get(dom_type, GENERIC_ACTIONS))

    # If no template match, use generic
    if not actions:
        actions = list(GENERIC_ACTIONS)

    # Add repeat-offender specific action
    if features.get("repeat_offender_flag", 0) == 1:
        actions.append({
            "action": "Issue Formal Cease-and-Desist Order",
            "rationale": f"Repeat offender '{features.get('repeat_offender_source', 'N/A')}' requires enforcement escalation.",
            "effort_level": "MED",
            "expected_impact_score": 0.75,
        })

    # Complaint-driven action
    if features.get("complaint_count_3d", 0) > 2:
        any_driver_mentions = any("complaint" in d.lower() for d in drivers)
        if any_driver_mentions:
            actions.append({
                "action": "Community Outreach & Public Hearing",
                "rationale": "Rising citizen complaints indicate public health concern.",
                "effort_level": "LOW",
                "expected_impact_score": 0.40,
            })

    # High risk
    if risk_score_approx > 0.75:
        actions.insert(0, dict(HIGH_RISK_ACTION))

    # Cap at 4
    return actions[:4]
