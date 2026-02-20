"""
ENVISIONGRID — Geo-Grid Mapping
Deterministic lat/lon → grid_id with configurable precision.
"""
from src.config import GRID_PRECISION


def get_grid_id(lat: float, lon: float) -> str:
    """Round lat/lon to configured precision and produce grid_id string."""
    lat_r = round(lat, GRID_PRECISION)
    lon_r = round(lon, GRID_PRECISION)
    return f"{lat_r}_{lon_r}"


def parse_grid_id(grid_id: str):
    """Extract (lat, lon) center from grid_id."""
    parts = grid_id.split("_")
    if len(parts) >= 2:
        try:
            return float(parts[0]), float(parts[1])
        except ValueError:
            pass
    return 0.0, 0.0


def get_neighbors(grid_id: str) -> list:
    """Return 8-connected neighbors of a grid cell."""
    lat, lon = parse_grid_id(grid_id)
    step = 10 ** (-GRID_PRECISION)
    neighbors = []
    for dlat in [-step, 0, step]:
        for dlon in [-step, 0, step]:
            if dlat == 0 and dlon == 0:
                continue
            neighbors.append(get_grid_id(lat + dlat, lon + dlon))
    return neighbors


def grid_info(grid_id: str) -> dict:
    """Return metadata about a grid cell for preview."""
    lat, lon = parse_grid_id(grid_id)
    step = 10 ** (-GRID_PRECISION)
    return {
        "grid_id": grid_id,
        "center_lat": lat,
        "center_lon": lon,
        "cell_size_deg": step,
        "approx_km": round(step * 111, 2),  # rough conversion
        "neighbors": get_neighbors(grid_id),
    }
