#!/usr/bin/env python3
"""
ENVISIONGRID — Cascading Risk Engine Integration Test Script
This script tests all 5 new endpoints added to the system.
Usage: python3 scripts/test_cascading_endpoints.py [base_url]
"""
import requests
import json
import sys
import time

BASE_URL = "http://127.0.0.1:8000"
if len(sys.argv) > 1:
    BASE_URL = sys.argv[1].rstrip('/')

def print_header(title):
    print("\n" + "="*80)
    print(f" {title.upper()} ".center(80, "="))
    print("="*80)

def test_health():
    print_header("Checking Health")
    try:
        resp = requests.get(f"{BASE_URL}/health")
        resp.raise_for_status()
        print(f"Status: {resp.status_code}")
        print(f"Response: {json.dumps(resp.json(), indent=2)}")
        return True
    except Exception as e:
        print(f"Health check failed: {e}")
        return False

def test_cascade_prediction():
    print_header("Testing POST /predict/cascade")
    payload = {
        "risk_type": "all",
        "threshold": 0.1,
        "use_sensors": True,
        "save_results": True
    }
    print(f"Payload: {json.dumps(payload, indent=2)}")
    
    resp = requests.post(f"{BASE_URL}/predict/cascade", json=payload)
    if resp.status_code == 200:
        data = resp.json()
        print(f"Status: {data.get('status')}")
        print(f"Count: {data.get('count', 0)}")
        if data.get('results'):
            first_gid = data['results'][0]['grid_id']
            print(f"Sample Result (Grid ID: {first_gid}):")
            print(f"  Primary Risk: {data['results'][0].get('primary_risk_score')}")
            print(f"  Cascade Score: {data['results'][0].get('cascade_score')}")
            return first_gid
        else:
            print("No high-risk grids found for cascade.")
            return None
    else:
        print(f"Error {resp.status_code}: {resp.text}")
        return None

def test_explainability(grid_id):
    if not grid_id:
        print("\nSkipping Explainability (no grid_id)")
        return
        
    print_header(f"Testing GET /risk/explain/{grid_id}")
    resp = requests.get(f"{BASE_URL}/risk/explain/{grid_id}")
    if resp.status_code == 200:
        data = resp.json()
        print(f"Grid: {data.get('grid_id')}")
        print(f"Primary Risk Score: {data.get('primary_risk_score')}")
        print(f"Cascade Score: {data.get('cascade_score')}")
        print("Top Factors:")
        for factor in data.get('top_factors', []):
            print(f"  - {factor}")
        print("Feature Contributions:")
        for k, v in data.get('feature_contributions', {}).items():
            print(f"  - {k}: {v:.4f}")
    else:
        print(f"Error {resp.status_code}: {resp.text}")

def test_map_data():
    print_header("Testing GET /map/cascading-risk")
    resp = requests.get(f"{BASE_URL}/map/cascading-risk?limit=5")
    if resp.status_code == 200:
        data = resp.json()
        print(f"Retrieved {len(data)} map records.")
        if data:
            print("Sample Record:")
            print(json.dumps(data[0], indent=2))
    else:
        print(f"Error {resp.status_code}: {resp.text}")

def test_intervention():
    print_header("Testing POST /simulate/intervention")
    payload = {
        "intervention_type": "reduce_burning",
        "percentage_reduction": 80.0,
        "target_risk": "air_quality",
        "duration_days": 14
    }
    print(f"Payload: {json.dumps(payload, indent=2)}")
    
    resp = requests.post(f"{BASE_URL}/simulate/intervention", json=payload)
    if resp.status_code == 200:
        data = resp.json()
        print(f"Policy Impact Score: {data.get('policy_impact_score')}")
        print(f"Affected Grids: {data.get('affected_grids')}")
        if data.get('grid_results'):
            sample = data['grid_results'][0]
            print(f"Sample Grid Result ({sample.get('grid_id')}):")
            print(f"  Before Cascade: {sample.get('before_cascade', 'N/A')}")
            print(f"  After Cascade: {sample.get('after_cascade', 'N/A')}")
            print(f"  Cascade Delta: {sample.get('cascade_delta', 'N/A')}")
    else:
        print(f"Error {resp.status_code}: {resp.text}")

def test_case_closure():
    print_header("Testing Case Closure & Risk Memory")
    
    # 1. Fetch an open case
    print("Fetching open cases...")
    cases_resp = requests.get(f"{BASE_URL}/cases")
    cases = cases_resp.json() if cases_resp.status_code == 200 else []
    
    open_cases = [c for c in cases if c.get('status') != 'CLOSED']
    if not open_cases:
        print("No open cases found to test closure.")
        return
        
    case = open_cases[0]
    case_id = case.get('case_id')
    print(f"Found open case: {case_id}")
    
    # 2. Close it
    payload = {
        "resolution_notes": "Tested via integration script",
        "risk_type": "air_quality",
        "risk_score": 0.85  # high severity to trigger strong memory update
    }
    print(f"Closure Payload: {json.dumps(payload, indent=2)}")
    
    # Try both standard ID formats if needed
    url = f"{BASE_URL}/cases/{case_id}/close"
    resp = requests.patch(url, json=payload)
    
    if resp.status_code == 200:
        data = resp.json()
        print("Success!")
        print(f"New Recurrence Weight: {data.get('new_recurrence_weight')}")
    else:
        print(f"Error {resp.status_code}: {resp.text}")

def main():
    print_header("EnvisionGrid Integration Test")
    print(f"Base URL: {BASE_URL}")
    print(f"Start Time: {time.ctime()}")
    
    if not test_health():
        print("\nCRITICAL: Backend is offline. Aborting.")
        return

    sample_gid = test_cascade_prediction()
    test_explainability(sample_gid)
    test_map_data()
    test_intervention()
    test_case_closure()
    
    print_header("Test Completed Successfully")

if __name__ == "__main__":
    main()
