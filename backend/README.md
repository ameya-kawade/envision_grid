# 🌍 ENVISIONGRID — City-Scale Environmental Risk Intelligence Platform

> **Sensor-Agnostic, Sensor-Enhanced.** Core intelligence from violations + complaints; sensors boost confidence.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ENVISIONGRID                              │
│                                                             │
│  ┌──────────┐   ┌──────────────┐   ┌───────────────────┐   │
│  │ Ingestion ├──►│  Feature Eng  ├──►│ Placeholder Model │   │
│  │ (CSV/JSON)│   │  (Rolling     │   │ (Deterministic    │   │
│  └────┬─────┘   │   Windows)    │   │  Rules + Sigmoid) │   │
│       │         └──────────────┘   └────────┬──────────┘   │
│       │                                      │              │
│  ┌────▼─────┐   ┌──────────────┐   ┌────────▼──────────┐   │
│  │  SQLite   │   │  Simulation  │   │ Alerts + Cases +  │   │
│  │  Storage  │   │  (What-If)   │   │ Actions + Explain │   │
│  └──────────┘   └──────────────┘   └───────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────┐               │
│  │  Optional: Arduino Edge Node → Bridge    │               │
│  │  (Sensor data boosts confidence only)    │               │
│  └──────────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────┘
         ▲                                ▲
         │      FastAPI REST API          │
    ┌────┴──────────────────────────┬─────┴────┐
    │       Streamlit Dashboard      │  curl/SDK │
    │  (6 Tabs: Ingest, Predict,    │           │
    │   Alerts, Simulate, Analytics,│           │
    │   Timeline Demo)              │           │
    └───────────────────────────────┴──────────┘
```

## Quick Start

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Generate demo data
python sample_data/generate_demo_data.py

# 3. Start backend (Terminal 1)
uvicorn src.api:app --reload

# 4. Start frontend (Terminal 2)
streamlit run frontend/app.py

# 5. One-command full demo (backend must be running)
python scripts/demo_end_to_end.py
```

## Repo Structure

```
├── src/
│   ├── api.py              # FastAPI endpoints
│   ├── config.py           # All tunable parameters
│   ├── db.py               # SQLite schema + helpers
│   ├── schemas.py          # Pydantic models
│   ├── geo_grid.py         # lat/lon → grid_id
│   ├── ingest.py           # CSV/JSON ingestion
│   ├── features.py         # Feature engineering pipeline
│   ├── model_adapter.py    # ModelAdapter + PlaceholderRiskModel
│   ├── explain.py          # Human-readable risk drivers
│   ├── actions.py          # Action recommendations
│   ├── alerts.py           # Alert management
│   ├── cases.py            # Case management
│   ├── hotspots.py         # Hotspot detection
│   ├── coverage.py         # Coverage gap analysis
│   └── simulate.py         # Policy what-if simulation
├── frontend/
│   ├── app.py              # Streamlit dashboard (6 tabs)
│   └── ui_components.py    # Reusable UI widgets
├── edge_node/
│   ├── serial_to_api_bridge.py  # Arduino → API bridge
│   ├── arduino_stub.ino         # Reference firmware
│   ├── sensor_payload_example.json
│   ├── wiring_diagram.md
│   └── README_EDGE_NODE.md
├── sample_data/
│   ├── generate_demo_data.py    # Synthetic data generator
│   └── scenario_timeline.json   # Early-signal demo scenario
├── scripts/
│   ├── demo_end_to_end.py       # Full automated demo
│   ├── reset_db.py              # Database reset
│   ├── run_backend.bat
│   └── run_frontend.bat
├── docs/
│   ├── ML_BLUEPRINT.md          # ML logic specification
│   └── API_SCHEMA.md            # API reference
├── requirements.txt
└── README.md
```

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Primary Signal | Violations + Complaints | Available immediately; no hardware needed |
| Sensor Role | Confidence Booster | Validates core predictions; doesn't replace them |
| Model | Deterministic Placeholder | Stable, reproducible; clean interface for future ML |
| Storage | SQLite | Zero setup; single-file DB |
| Geo-Binning | 2-decimal lat/lon | ~1.1km cells; city-scale granularity |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/grid/preview` | Preview grid mapping for lat/lon |
| POST | `/ingest/violation-event` | Single violation JSON |
| POST | `/ingest/violations` | Batch violations CSV |
| POST | `/ingest/complaints` | Batch complaints CSV |
| POST | `/ingest/sensor` | Single sensor JSON |
| POST | `/ingest/sensors` | Batch sensors CSV |
| POST | `/predict` | Run risk prediction |
| GET | `/predictions` | View stored predictions |
| GET | `/alerts` | List alerts |
| POST | `/cases` | Create case from alert |
| GET | `/cases` | List cases |
| PATCH | `/cases/{id}` | Update case |
| GET | `/hotspots` | Top risk zones |
| GET | `/coverage` | Data coverage report |
| POST | `/simulate` | Policy what-if simulation |

## curl Examples

```bash
# Health
curl http://localhost:8000/health

# Ingest single violation
curl -X POST http://localhost:8000/ingest/violation-event \
  -H "Content-Type: application/json" \
  -d '{"violation_id":"V001","timestamp":"2024-03-15T10:00:00","lat":40.72,"lon":-74.01,"violation_type":"industrial_emission","severity":4,"source":"Facility_13"}'

# Upload CSV
curl -X POST http://localhost:8000/ingest/violations -F "file=@sample_data/demo_violations.csv"

# Run prediction
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"risk_type":"all","horizon_hours":72,"threshold":0.5,"use_sensors":true}'

# What-if simulation
curl -X POST http://localhost:8000/simulate \
  -H "Content-Type: application/json" \
  -d '{"risk_type":"all","horizon_hours":72,"adjustments":[{"grid_id":"40.71_-74.01","violation_type":"industrial_emission","factor":0.3}]}'

# Get hotspots
curl http://localhost:8000/hotspots

# Get coverage
curl http://localhost:8000/coverage
```

## License
MIT — Built for InnovateYou Hackathon
