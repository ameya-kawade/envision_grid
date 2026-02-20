"""
Seed the ENVISIONGRID database with sample Indian city data.
Run from the backend directory:
    uv run python scripts/seed_data.py
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src import db
from src.ingest import (
    ingest_violations_csv,
    ingest_complaints_csv,
    ingest_sensors_csv,
)

SCRIPTS_DIR = os.path.dirname(__file__)


def main():
    print("Initializing database...")
    db.init_db()

    # Violations
    path = os.path.join(SCRIPTS_DIR, "seed_violations.csv")
    with open(path, "rb") as f:
        res = ingest_violations_csv(f.read())
    print(f"Violations: {res}")

    # Complaints
    path = os.path.join(SCRIPTS_DIR, "seed_complaints.csv")
    with open(path, "rb") as f:
        res = ingest_complaints_csv(f.read())
    print(f"Complaints: {res}")

    # Sensors
    path = os.path.join(SCRIPTS_DIR, "seed_sensors.csv")
    with open(path, "rb") as f:
        res = ingest_sensors_csv(f.read())
    print(f"Sensors: {res}")

    print("\n✅ Seeding complete!")
    print(f"Grid IDs in database: {len(db.get_all_grid_ids())}")


if __name__ == "__main__":
    main()
