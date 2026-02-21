"""
ENVISIONGRID — Cascading Risk Engine
Weighted directed dependency graph with BFS propagation.

Risk types that cross-contaminate each other. Edge weight = spillover strength.
Example:  flood (0.8)→ water_stagnation (0.7)→ vector_health

Algorithm:
  1. Start from base_risk_scores (per risk type, per grid).
  2. BFS each edge: propagated_risk += source_risk * weight * decay^depth
  3. Normalize all outputs to [0, 1].
  4. Record propagation traces for explainability.
  5. Depth limit: 3 hops. Loop guard: visited set per traversal path.
"""
import logging
from collections import defaultdict, deque
from typing import Dict, List, Optional, Any

logger = logging.getLogger("envisiongrid.cascade")

# ── Dependency Graph ──────────────────────────────────────────────────
# Each entry: (source, target, weight)
# Configurable: swap this list with DB-loaded edges at runtime.

DEFAULT_EDGES = [
    # Water / flood chain
    ("flood",          "water_stagnation", 0.80),
    ("water_stagnation","vector_health",   0.70),

    # Heat chain
    ("heat",           "power_stress",     0.60),
    ("power_stress",   "air_quality",      0.50),

    # Air & health
    ("air_quality",    "vector_health",    0.40),

    # Waste chain
    ("waste",          "water_stagnation", 0.60),
    ("waste",          "vector_health",    0.45),

    # Infrastructure
    ("infrastructure", "flood",            0.50),
    ("infrastructure", "power_stress",     0.40),

    # Non-obvious cross-domain
    ("heat",           "air_quality",      0.35),
    ("flood",          "infrastructure",   0.30),
]

ALL_RISK_TYPES = [
    "flood", "heat", "air_quality", "waste",
    "infrastructure", "water_stagnation", "vector_health", "power_stress",
]

# ── Graph builder ─────────────────────────────────────────────────────

def _build_graph(edges=None):
    """Adjacency list: source → [(target, weight)]."""
    graph = defaultdict(list)
    for src, tgt, w in (edges or DEFAULT_EDGES):
        graph[src].append((tgt, w))
    return dict(graph)


# ── Core propagation ──────────────────────────────────────────────────

def propagate(
    base_scores: Dict[str, float],
    max_depth: int = 3,
    hop_decay: float = 0.65,
    edges: Optional[List] = None,
) -> Dict[str, Any]:
    """
    Propagate base risk scores through the dependency graph.

    Args:
        base_scores: {risk_type: risk_score} from the primary model.
                     Missing types default to 0.0.
        max_depth:   Maximum cascade hops (default 3).
        hop_decay:   Multiplier applied per hop (default 0.65 → ~43% after 2 hops).
        edges:       Override graph edges (for testing / custom configs).

    Returns:
        {
          "primary_risks":   {type: score},
          "secondary_impacts": [{type, score, source, path}],
          "tertiary_impacts":  [{type, score, source, path}],
          "cascade_score":   float,          # aggregate of propagated energy
          "propagation_trace": [str],        # human-readable paths
          "final_scores":    {type: score},  # primary + cascaded, normalized
        }
    """
    graph = _build_graph(edges)

    # Fill in zeroes for any missing risk type
    scores = {rt: base_scores.get(rt, 0.0) for rt in ALL_RISK_TYPES}

    # Accumulated propagated contributions per target node
    propagated: Dict[str, float] = defaultdict(float)

    secondary_impacts = []
    tertiary_impacts = []
    trace_set = set()
    traces = []

    # BFS: queue items = (source_type, current_score, depth, path_str)
    queue = deque()
    for rtype, score in scores.items():
        if score > 0 and rtype in graph:
            queue.append((rtype, score, 0, rtype))

    while queue:
        src, cur_score, depth, path = queue.popleft()

        if depth >= max_depth:
            continue

        for target, weight in graph.get(src, []):
            # Loop guard: target must not already appear in current path
            path_nodes = set(path.split("→"))
            if target in path_nodes:
                continue

            contribution = cur_score * weight * (hop_decay ** depth)
            propagated[target] += contribution

            new_path = f"{path}→{target}"
            if new_path not in trace_set:
                trace_set.add(new_path)
                traces.append(new_path)

            impact = {
                "type": target,
                "score": round(contribution, 4),
                "source": src,
                "path": new_path,
            }

            if depth == 0:
                secondary_impacts.append(impact)
            else:
                tertiary_impacts.append(impact)

            # Continue propagation
            if target in graph and contribution > 0.01:
                queue.append((target, contribution, depth + 1, new_path))

    # ── Merge base + propagated → final scores ────────────────────────
    final_scores = {}
    for rt in ALL_RISK_TYPES:
        base = scores.get(rt, 0.0)
        added = propagated.get(rt, 0.0)
        final_scores[rt] = min(base + added, 1.0)  # hard cap at 1.0

    # ── Cascade aggregate score ───────────────────────────────────────
    cascade_score = sum(propagated.values())
    # Normalize: max possible is roughly len(nodes) * 1.0
    cascade_score = round(min(cascade_score / max(len(ALL_RISK_TYPES), 1), 1.0), 4)

    # Sort impact lists by score desc
    secondary_impacts.sort(key=lambda x: x["score"], reverse=True)
    tertiary_impacts.sort(key=lambda x: x["score"], reverse=True)

    logger.debug(f"Cascade complete: {len(traces)} paths, cascade_score={cascade_score}")

    return {
        "primary_risks":      {k: round(v, 4) for k, v in scores.items()},
        "secondary_impacts":  secondary_impacts[:10],
        "tertiary_impacts":   tertiary_impacts[:10],
        "cascade_score":      cascade_score,
        "propagation_trace":  traces[:20],
        "final_scores":       {k: round(v, 4) for k, v in final_scores.items()},
    }


def run_cascade_for_grid(
    grid_id: str,
    primary_risk_score: float,
    risk_type: str = "all",
    use_sensors: bool = True,
    save_result: bool = True,
) -> Dict[str, Any]:
    """
    High-level helper: build base_scores for a single grid from its
    latest prediction, run propagation, optionally persist to DB.

    base_scores logic:
      - If risk_type is a specific type, assign the primary score there.
      - If risk_type is "all", distribute the score across the most likely
        active types based on the grid's violations.
    """
    from src.services.feature_cache import cached_compute_features

    feats = cached_compute_features(grid_id, use_sensors=use_sensors)

    # Infer likely risk types from dominant violation
    dom_type = feats.get("dominant_violation_type", "all")

    # Build a realistic base_scores dict
    base_scores: Dict[str, float] = {}

    if risk_type != "all" and risk_type in ALL_RISK_TYPES:
        base_scores[risk_type] = primary_risk_score
    else:
        # Use violation/complaint density to estimate per-type scores
        _type_map = {
            "burning":       "air_quality",
            "dumping":       "waste",
            "drainage":      "flood",
            "noise":         "infrastructure",
            "chemical":      "air_quality",
            "sewage":        "water_stagnation",
            "illegal_construction": "infrastructure",
        }
        mapped_type = _type_map.get(str(dom_type).lower(), "air_quality")
        base_scores[mapped_type] = primary_risk_score

        # Heat proxy from AQI sensor
        aqi = feats.get("sensor_aqi_mean_1d", 0)
        if aqi > 150:
            base_scores["heat"] = min(aqi / 500.0, 0.8)

    result = propagate(base_scores)
    result["grid_id"] = grid_id

    if save_result:
        try:
            from src import db
            db.save_cascade_result(grid_id, result)
        except Exception as e:
            logger.warning(f"Could not persist cascade result for {grid_id}: {e}")

    return result
