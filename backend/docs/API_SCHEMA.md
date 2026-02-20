# ENVISIONGRID — API Schema Reference

## Base URL
`http://localhost:8000`

---

## Health Check
```
GET /health
```
**Response:**
```json
{"status": "ok", "engine": "ENVISIONGRID v1.0"}
```

---

## Grid Preview
```
GET /grid/preview?lat=40.72&lon=-74.01
```
**Response:**
```json
{
  "grid_id": "40.72_-74.01",
  "center_lat": 40.72,
  "center_lon": -74.01,
  "cell_size_deg": 0.01,
  "approx_km": 1.11,
  "neighbors": ["40.71_-74.02", "40.71_-74.01", ...]
}
```

---

## Ingestion

### POST /ingest/violation-event
```json
{
  "violation_id": "V001",
  "timestamp": "2024-03-15T10:00:00",
  "lat": 40.72,
  "lon": -74.01,
  "violation_type": "industrial_emission",
  "severity": 4,
  "description": "Visible emissions from stack",
  "source": "Facility_13"
}
```
**Response:** `{"status": "ingested", "grid_id": "40.72_-74.01"}`

### POST /ingest/violations
Upload CSV with columns: `violation_id, timestamp, lat, lon, violation_type, severity, description, source`

### POST /ingest/complaints
Upload CSV with columns: `complaint_id, timestamp, lat, lon, complaint_type, intensity`

### POST /ingest/sensor
```json
{
  "sensor_id": "CABIN_01",
  "timestamp": "2024-03-15T10:30:00",
  "grid_id": "40.71_-74.01",
  "aqi": 165.0,
  "temperature": 28.5,
  "humidity": 55.0,
  "gas_index": 0.72
}
```

### POST /ingest/sensors
Upload CSV with columns: `sensor_id, timestamp, aqi, lat, lon` (lat/lon or grid_id)

---

## Prediction

### POST /predict
```json
{
  "risk_type": "all",
  "horizon_hours": 72,
  "threshold": 0.6,
  "use_sensors": true
}
```
**Response:**
```json
{
  "status": "success",
  "count": 12,
  "predictions": [
    {
      "grid_id": "40.72_-74.0",
      "risk_type": "all",
      "horizon_hours": 72,
      "risk_score": 0.82,
      "confidence": 0.85,
      "uncertainty": 0.0225,
      "drivers": [
        "Repeat offender detected: 'Facility_13' (6 events in 7d)",
        "Severity-weighted violations surging (2.1× baseline over 72h)",
        "Edge sensor confirmed elevated readings (AQI: 165)"
      ],
      "actions": [
        {"action": "Schedule Factory Compliance Audit", "rationale": "...", "effort_level": "HIGH", "expected_impact_score": 0.90},
        {"action": "Issue Warning / Fine to Repeat Offender", "rationale": "...", "effort_level": "MED", "expected_impact_score": 0.70}
      ],
      "sensor_validated": true
    }
  ]
}
```

### GET /predictions
Query params: `risk_type`, `horizon`, `limit`

---

## Alerts & Cases

### GET /alerts
Returns list of auto-generated alerts.

### POST /cases
```json
{"alert_id": 1, "assigned_to": "Inspector Sharma", "notes": "Investigate immediately"}
```

### GET /cases
Returns all cases.

### PATCH /cases/{case_id}
```json
{"status": "IN_PROGRESS", "notes": "Site visit scheduled"}
```

---

## Analytics

### GET /hotspots
Query: `limit` (default 15), `use_sensors` (default true)

### GET /coverage
Returns coverage status per grid cell: `SENSOR_COVERED`, `ADEQUATE`, `LOW_DATA`, `NO_DATA`

---

## Simulation

### POST /simulate
```json
{
  "risk_type": "all",
  "horizon_hours": 72,
  "adjustments": [
    {"grid_id": "40.72_-74.0", "violation_type": "industrial_emission", "factor": 0.3, "window_days": 7}
  ]
}
```
**Response:**
```json
{
  "status": "success",
  "results": [
    {
      "grid_id": "40.72_-74.0",
      "original_risk": 0.82,
      "simulated_risk": 0.51,
      "delta": -0.31,
      "original_drivers": ["..."],
      "simulated_drivers": ["..."],
      "original_actions": [{"..."}],
      "simulated_actions": [{"..."}]
    }
  ]
}
```
