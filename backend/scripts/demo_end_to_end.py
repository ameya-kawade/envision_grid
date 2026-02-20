"""
ENVISIONGRID — End-to-End Demo Script
Automated demo: reset → generate → ingest → predict → alert → case → simulate.
Run this to prepare the full demo state.
"""
import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import requests
import time

API = "http://127.0.0.1:8000"
SAMPLE_DIR = os.path.join(os.path.dirname(__file__), "..", "sample_data")


def step(label):
    print(f"\n{'='*60}")
    print(f"  {label}")
    print(f"{'='*60}")


def main():
    # 1. Reset DB
    step("1/7  Resetting Database")
    from src.db import init_db, reset_database
    init_db()
    reset_database()
    print("  ✅ Database cleared")

    # 2. Generate Demo Data
    step("2/7  Generating Synthetic Data")
    from sample_data.generate_demo_data import (
        generate_violations, generate_complaints, generate_sensors, generate_scenario_timeline
    )
    import json

    df_v = generate_violations(300)
    df_v.to_csv(os.path.join(SAMPLE_DIR, "demo_violations.csv"), index=False)
    df_c = generate_complaints(120)
    df_c.to_csv(os.path.join(SAMPLE_DIR, "demo_complaints.csv"), index=False)
    df_s = generate_sensors(100)
    df_s.to_csv(os.path.join(SAMPLE_DIR, "demo_sensors.csv"), index=False)
    timeline = generate_scenario_timeline()
    with open(os.path.join(SAMPLE_DIR, "scenario_timeline.json"), "w") as f:
        json.dump(timeline, f, indent=2)
    print(f"  ✅ Generated {len(df_v)} violations, {len(df_c)} complaints, {len(df_s)} sensor readings")

    # 3. Ingest Violations
    step("3/7  Ingesting Violations")
    with open(os.path.join(SAMPLE_DIR, "demo_violations.csv"), "rb") as f:
        r = requests.post(f"{API}/ingest/violations", files={"file": f})
        print(f"  ✅ {r.json()}")

    # 4. Ingest Complaints
    step("4/7  Ingesting Complaints")
    with open(os.path.join(SAMPLE_DIR, "demo_complaints.csv"), "rb") as f:
        r = requests.post(f"{API}/ingest/complaints", files={"file": f})
        print(f"  ✅ {r.json()}")

    # 5. Ingest Sensors
    step("5/7  Ingesting Sensors")
    with open(os.path.join(SAMPLE_DIR, "demo_sensors.csv"), "rb") as f:
        r = requests.post(f"{API}/ingest/sensors", files={"file": f})
        print(f"  ✅ {r.json()}")

    # 6. Run Prediction
    step("6/7  Running Risk Prediction")
    r = requests.post(f"{API}/predict", json={
        "risk_type": "all", "horizon_hours": 72,
        "threshold": 0.5, "use_sensors": True
    })
    data = r.json()
    preds = data.get("predictions", [])
    print(f"  ✅ {data.get('count', 0)} grids evaluated")
    if preds:
        top = preds[0]
        print(f"\n  🔥 Top Risk: Grid {top['grid_id']}")
        print(f"     Risk Score: {top['risk_score']:.0%}")
        print(f"     Confidence: {top['confidence']:.0%}")
        print(f"     Drivers: {', '.join(top['drivers'][:2])}")

    # 7. Create Case from top alert
    step("7/7  Creating Case from Alert")
    alerts = requests.get(f"{API}/alerts").json()
    if alerts:
        alert_id = alerts[0]["id"]
        r = requests.post(f"{API}/cases", json={
            "alert_id": alert_id,
            "assigned_to": "Inspector Sharma",
            "notes": "Auto-created by demo script. Investigate immediately."
        })
        print(f"  ✅ Case created: {r.json()}")

    # Bonus: Simulation
    step("BONUS  Running Policy Simulation")
    if preds:
        top_grid = preds[0]["grid_id"]
        r = requests.post(f"{API}/simulate", json={
            "risk_type": "all", "horizon_hours": 72,
            "adjustments": [{"grid_id": top_grid, "violation_type": "industrial_emission", "factor": 0.3}]
        })
        sim = r.json().get("results", [{}])[0]
        print(f"  Grid: {sim.get('grid_id')}")
        print(f"  Original Risk: {sim.get('original_risk', 0):.0%}")
        print(f"  Simulated Risk: {sim.get('simulated_risk', 0):.0%}")
        print(f"  Delta: {sim.get('delta', 0):+.1%}")

    print("\n" + "="*60)
    print("  🎉  DEMO READY — Open Streamlit to explore!")
    print("="*60)


if __name__ == "__main__":
    main()
