"""
ENVISIONGRID — Feature Cache
TTL in-memory cache for compute_features() results.
Prevents redundant DB queries during cascade propagation across neighbor grids.
"""
import time
import threading
from typing import Dict, Optional, Tuple

# Default TTL in seconds
_DEFAULT_TTL = 60

_cache: Dict[str, Tuple[float, dict]] = {}  # key → (expires_at, features)
_lock = threading.Lock()


def _cache_key(grid_id: str, use_sensors: bool) -> str:
    return f"{grid_id}::{use_sensors}"


def get_cached_features(grid_id: str, use_sensors: bool = True) -> Optional[dict]:
    """Return cached features if still valid, else None."""
    key = _cache_key(grid_id, use_sensors)
    with _lock:
        entry = _cache.get(key)
        if entry and entry[0] > time.time():
            return entry[1]
        if entry:
            del _cache[key]
    return None


def set_cached_features(grid_id: str, use_sensors: bool, features: dict,
                         ttl: int = _DEFAULT_TTL) -> None:
    """Store features in cache with TTL."""
    key = _cache_key(grid_id, use_sensors)
    with _lock:
        _cache[key] = (time.time() + ttl, features)


def invalidate(grid_id: str) -> None:
    """Evict all entries for a grid_id (both sensor modes)."""
    with _lock:
        for suffix in ["::True", "::False"]:
            _cache.pop(f"{grid_id}{suffix}", None)


def clear_all() -> None:
    """Flush entire cache (e.g., after a bulk ingest)."""
    with _lock:
        _cache.clear()


def cached_compute_features(grid_id: str, use_sensors: bool = True,
                              simulation_adjustments=None) -> dict:
    """
    Wrapper around compute_features() with transparent caching.
    Bypasses cache when simulation_adjustments are provided (non-deterministic).
    """
    from src.features import compute_features  # deferred to avoid circular import

    if simulation_adjustments is not None:
        # Never cache simulated results
        return compute_features(grid_id, use_sensors=use_sensors,
                                simulation_adjustments=simulation_adjustments)

    cached = get_cached_features(grid_id, use_sensors)
    if cached is not None:
        return cached

    feats = compute_features(grid_id, use_sensors=use_sensors)
    set_cached_features(grid_id, use_sensors, feats)
    return feats
