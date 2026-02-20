"""
ENVISIONGRID — Synthetic Demo Data Generator
Produces realistic violations, complaints, and sensor CSVs.
"""
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random
import os
import json

np.random.seed(42)
random.seed(42)

# ── Configuration ─────────────────────────────────────────────────────
BASE_LAT, BASE_LON = 40.7128, -74.0060  # NYC-ish

CLUSTERS = [
    {"name": "Industrial Zone A", "offset": (0.01, 0.01),
     "types": ["industrial_emission", "illegal_burning"], "severity_bias": 4},
    {"name": "Waterfront B", "offset": (-0.02, 0.01),
     "types": ["sewage_discharge", "chemical_spill"], "severity_bias": 3},
    {"name": "Residential C", "offset": (0.00, -0.02),
     "types": ["illegal_dumping", "dumping"], "severity_bias": 2},
    {"name": "Suburb D", "offset": (0.03, -0.01),
     "types": ["vehicle_emission", "noise_violation"], "severity_bias": 2},
]

SOURCES = [f"Facility_{i:02d}" for i in range(1, 25)]
REPEAT_OFFENDER = "Facility_13"  # intentional repeat offender


def generate_violations(n: int = 300) -> pd.DataFrame:
    rows = []
    for i in range(n):
        cluster = random.choice(CLUSTERS)
        lat = BASE_LAT + cluster["offset"][0] + np.random.normal(0, 0.003)
        lon = BASE_LON + cluster["offset"][1] + np.random.normal(0, 0.003)
        v_type = random.choice(cluster["types"])

        # Severity distribution biased by cluster
        severity = min(5, max(1, int(np.random.normal(cluster["severity_bias"], 0.8))))

        # Time: last 30 days, with clustering in recent days
        days_ago = int(np.random.exponential(5))  # more recent events more likely
        days_ago = min(days_ago, 30)
        hours_offset = random.randint(0, 23)
        ts = datetime.utcnow() - timedelta(days=days_ago, hours=hours_offset)

        source = random.choice(SOURCES)
        # Make repeat offender appear frequently in cluster A
        if cluster["name"] == "Industrial Zone A" and random.random() < 0.3:
            source = REPEAT_OFFENDER
            severity = 5
            v_type = "industrial_emission"

        rows.append({
            "violation_id": f"V_{i:05d}",
            "timestamp": ts.isoformat(),
            "lat": round(lat, 5),
            "lon": round(lon, 5),
            "violation_type": v_type,
            "severity": severity,
            "description": f"{v_type.replace('_', ' ').title()} near {source}",
            "source": source,
        })

    return pd.DataFrame(rows)


def generate_complaints(n: int = 120) -> pd.DataFrame:
    rows = []
    for i in range(n):
        cluster = random.choice(CLUSTERS[:3])  # complaints from populated areas
        lat = BASE_LAT + cluster["offset"][0] + np.random.normal(0, 0.005)
        lon = BASE_LON + cluster["offset"][1] + np.random.normal(0, 0.005)

        days_ago = int(np.random.exponential(4))
        days_ago = min(days_ago, 30)
        ts = datetime.utcnow() - timedelta(days=days_ago, hours=random.randint(0, 23))

        rows.append({
            "complaint_id": f"C_{i:05d}",
            "timestamp": ts.isoformat(),
            "lat": round(lat, 5),
            "lon": round(lon, 5),
            "complaint_type": random.choice(["bad_smell", "smoke", "noise", "water_color", "dust"]),
            "intensity": random.randint(1, 5),
        })

    return pd.DataFrame(rows)


def generate_sensors(n_readings: int = 100) -> pd.DataFrame:
    """Simulate 3 sensor nodes reporting over last 7 days."""
    sensors = [
        {"sensor_id": "SENSOR_A1", "lat": BASE_LAT + 0.01, "lon": BASE_LON + 0.01},
        {"sensor_id": "SENSOR_B1", "lat": BASE_LAT - 0.02, "lon": BASE_LON + 0.01},
        {"sensor_id": "SENSOR_C1", "lat": BASE_LAT + 0.00, "lon": BASE_LON - 0.02},
    ]
    rows = []
    for i in range(n_readings):
        s = random.choice(sensors)
        days_ago = random.uniform(0, 7)
        ts = datetime.utcnow() - timedelta(days=days_ago)

        # AQI baseline with occasional spikes
        base_aqi = np.random.normal(80, 20)
        if s["sensor_id"] == "SENSOR_A1" and days_ago < 2:
            base_aqi += 80  # spike in industrial zone

        rows.append({
            "sensor_id": s["sensor_id"],
            "timestamp": ts.isoformat(),
            "lat": s["lat"],
            "lon": s["lon"],
            "aqi": round(max(10, base_aqi), 1),
            "temperature": round(np.random.normal(25, 5), 1),
            "humidity": round(np.random.normal(60, 15), 1),
            "gas_index": round(max(0, np.random.normal(0.4, 0.2)), 2),
        })

    return pd.DataFrame(rows)


def generate_scenario_timeline():
    """Generate the early-signal vs sensor-lag timeline JSON."""
    return {
        "scenario": "Industrial Emission Incident — Grid 40.71_-74.01",
        "events": [
            {"time": "T+0h", "type": "complaint", "label": "Citizen Complaints Begin",
             "description": "3 complaints about chemical smell reported in neighborhood app."},
            {"time": "T+2h", "type": "complaint", "label": "Complaint Intensity Rises",
             "description": "5 more complaints; intensity 4-5. ENVISIONGRID complaint_trend feature spikes."},
            {"time": "T+4h", "type": "violation", "label": "Inspector Finds Violation",
             "description": "Illegal emission from Facility_13 logged. Severity 5. Repeat offender flagged."},
            {"time": "T+6h", "type": "envisiongrid_alert", "label": "🚨 ENVISIONGRID Alert Triggered",
             "description": "Risk score: 0.82 (CRITICAL). Drivers: repeat offender + complaint surge + severity spike. Case auto-created."},
            {"time": "T+18h", "type": "sensor_spike", "label": "Sensor Detects AQI Spike",
             "description": "SENSOR_A1 reports AQI 185. Confirms prediction from 12 hours ago."},
            {"time": "T+24h", "type": "sensor_spike", "label": "Sensor AQI Peak",
             "description": "AQI reaches 220. ENVISIONGRID confidence boosted to 0.95 with sensor validation."},
            {"time": "T+36h", "type": "incident", "label": "Health Advisory Issued",
             "description": "City issues air quality health advisory. ENVISIONGRID predicted this 30 hours earlier."},
        ],
        "key_insight": "ENVISIONGRID detected risk 18 hours before the sensor spike and 30 hours before the public health advisory, using multi-signal intelligence (complaints + violations + repeat offender patterns)."
    }


if __name__ == "__main__":
    out_dir = os.path.dirname(os.path.abspath(__file__))

    print("Generating violations...")
    df_v = generate_violations(300)
    df_v.to_csv(os.path.join(out_dir, "demo_violations.csv"), index=False)
    print(f"  → {len(df_v)} violations saved")

    print("Generating complaints...")
    df_c = generate_complaints(120)
    df_c.to_csv(os.path.join(out_dir, "demo_complaints.csv"), index=False)
    print(f"  → {len(df_c)} complaints saved")

    print("Generating sensor data...")
    df_s = generate_sensors(100)
    df_s.to_csv(os.path.join(out_dir, "demo_sensors.csv"), index=False)
    print(f"  → {len(df_s)} sensor readings saved")

    print("Generating scenario timeline...")
    timeline = generate_scenario_timeline()
    with open(os.path.join(out_dir, "scenario_timeline.json"), "w") as f:
        json.dump(timeline, f, indent=2)
    print("  → scenario_timeline.json saved")

    print("\n✅ All demo data generated successfully!")
