#!/bin/bash
# ENVISIONGRID — Cascading Risk Endpoints Test (CURL)

BASE_URL=${1:-"http://127.0.0.1:8000"}

echo "----------------------------------------------------------------"
echo "Testing Health..."
curl -s "$BASE_URL/health" | python3 -m json.tool

echo -e "\n----------------------------------------------------------------"
echo "Testing Predict Cascade..."
curl -s -X POST "$BASE_URL/predict/cascade" \
  -H "Content-Type: application/json" \
  -d '{"threshold": 0.1}' | python3 -m json.tool | head -n 20

echo -e "\n----------------------------------------------------------------"
echo "Testing Risk Explain (Sample Grid G_19_73)..."
curl -s "$BASE_URL/risk/explain/G_19_73" | python3 -m json.tool

echo -e "\n----------------------------------------------------------------"
echo "Testing Map Data..."
curl -s "$BASE_URL/map/cascading-risk?limit=3" | python3 -m json.tool

echo -e "\n----------------------------------------------------------------"
echo "Testing Intervention Simulation..."
curl -s -X POST "$BASE_URL/simulate/intervention" \
  -H "Content-Type: application/json" \
  -d '{"intervention_type":"policy_v1", "percentage_reduction": 50, "target_risk": "air_quality"}' | python3 -m json.tool | head -n 20

echo -e "\n----------------------------------------------------------------"
echo "Testing Case Closure..."
echo "Requires a valid case_id. Run python script for automatic case discovery."
