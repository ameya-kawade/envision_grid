"""
ENVISIONGRID — Coverage Gap Analysis
Identifies grids with low/no data (grey zones).
"""
from typing import List, Dict
from src.db import get_db, get_all_grid_ids
from src.geo_grid import get_neighbors


def get_coverage_report() -> List[Dict]:
    """
    For each known grid: count violations, complaints, sensors.
    Flag low-data grids.
    """
    db = get_db()
    grids = get_all_grid_ids()
    # Also include neighbors of known grids to find grey zones
    all_grids = set(grids)
    for gid in grids:
        for n in get_neighbors(gid):
            all_grids.add(n)

    report = []
    for gid in sorted(all_grids):
        v_count = db.violations.count_documents({"grid_id": gid})
        c_count = db.complaints.count_documents({"grid_id": gid})
        s_count = db.sensors.count_documents({"grid_id": gid})

        total = v_count + c_count + s_count
        if total == 0:
            status = "NO_DATA"
        elif v_count <= 2 and s_count == 0:
            status = "LOW_DATA"
        elif s_count > 0:
            status = "SENSOR_COVERED"
        else:
            status = "ADEQUATE"

        report.append({
            "grid_id": gid,
            "violations": v_count,
            "complaints": c_count,
            "sensor_readings": s_count,
            "total_signals": total,
            "coverage_status": status,
        })

    return report
