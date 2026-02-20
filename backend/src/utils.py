"""
ENVISIONGRID — Shared Utilities
"""
import numpy as np
from datetime import datetime


def sigmoid(x: float) -> float:
    """Numerically stable sigmoid."""
    x = np.clip(x, -500, 500)
    return float(1.0 / (1.0 + np.exp(-x)))


def parse_iso(ts: str) -> datetime:
    """Parse ISO timestamp flexibly."""
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f",
                "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(ts, fmt)
        except ValueError:
            continue
    # Fallback — strip timezone info if present
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00").replace("+00:00", ""))
    except:
        return datetime.utcnow()


def clamp(value: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, value))
