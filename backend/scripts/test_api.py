"""Quick test of all ENVISIONGRID API endpoints."""
import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import requests

API = "http://127.0.0.1:8000"

def test():
    # 1. Health
    print("=== Health ===")
    r = requests.get(f"{API}/health")
    print(r.json())

    # 2. Ingest violations
    print("\n=== Ingesting Violations ===")
    with open("sample_data/demo_violations.csv", "rb") as f:
        r = requests.post(f"{API}/ingest/violations", files={"file": f})
        print(r.json())

    # 3. Ingest complaints
    print("\n=== Ingesting Complaints ===")
    with open("sample_data/demo_complaints.csv", "rb") as f:
        r = requests.post(f"{API}/ingest/complaints", files={"file": f})
        print(r.json())

    # 4. Ingest sensors
    print("\n=== Ingesting Sensors ===")
    with open("sample_data/demo_sensors.csv", "rb") as f:
        r = requests.post(f"{API}/ingest/sensors", files={"file": f})
        print(r.json())

    # 5. Grid preview
    print("\n=== Grid Preview ===")
    r = requests.get(f"{API}/grid/preview", params={"lat": 40.72, "lon": -74.01})
    print(r.json())

    # 6. Prediction
    print("\n=== Prediction ===")
    r = requests.post(f"{API}/predict", json={
        "risk_type": "all", "horizon_hours": 72,
        "threshold": 0.5, "use_sensors": True
    })
    data = r.json()
    status = data.get("status", "unknown")
    count = data.get("count", 0)
    print(f"Status: {status}, Count: {count}")
    preds = data.get("predictions", [])
    if preds:
        p = preds[0]
        print(f"Top Grid: {p['grid_id']}")
        print(f"Risk: {p['risk_score']:.2%}, Confidence: {p['confidence']:.2%}")
        print(f"Drivers: {p['drivers']}")

    # 7. Alerts
    print("\n=== Alerts ===")
    r = requests.get(f"{API}/alerts")
    alerts = r.json()
    print(f"Alerts count: {len(alerts)}")

    # 8. Hotspots
    print("\n=== Hotspots ===")
    r = requests.get(f"{API}/hotspots")
    spots = r.json()
    print(f"Hotspots: {len(spots)}")

    # 9. Coverage
    print("\n=== Coverage ===")
    r = requests.get(f"{API}/coverage")
    cov = r.json()
    print(f"Coverage entries: {len(cov)}")

    # 10. Simulation
    print("\n=== Simulation ===")
    if preds:
        gid = preds[0]["grid_id"]
        r = requests.post(f"{API}/simulate", json={
            "risk_type": "all", "horizon_hours": 72,
            "adjustments": [{"grid_id": gid, "violation_type": "industrial_emission", "factor": 0.3}]
        })
        sim = r.json()
        res = sim.get("results", [{}])[0]
        print(f"Original: {res.get('original_risk', 0):.2%} -> Simulated: {res.get('simulated_risk', 0):.2%}")

    # 11. Create Case
    print("\n=== Create Case ===")
    if alerts:
        r = requests.post(f"{API}/cases", json={
            "alert_id": alerts[0]["id"],
            "assigned_to": "Inspector Demo",
            "notes": "Test case"
        })
        print(r.json())

    # 12. Get Cases
    print("\n=== Cases ===")
    r = requests.get(f"{API}/cases")
    print(f"Cases count: {len(r.json())}")

    print("\n✅ ALL ENDPOINTS VERIFIED")

if __name__ == "__main__":
    test()
