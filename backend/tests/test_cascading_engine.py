"""
Unit tests for the Cascading Risk Engine.
Run with:  uv run pytest tests/test_cascading_engine.py -v
"""
import pytest
from src.services.cascading_engine import (
    propagate,
    _build_graph,
    ALL_RISK_TYPES,
    DEFAULT_EDGES,
)


# ── Graph helpers ─────────────────────────────────────────────────────

class TestBuildGraph:
    def test_builds_adjacency_list(self):
        g = _build_graph()
        assert "flood" in g
        assert "infrastructure" in g
        assert isinstance(g["flood"], list)

    def test_custom_edges(self):
        g = _build_graph([("foo", "bar", 0.5)])
        assert "foo" in g
        assert g["foo"][0] == ("bar", 0.5)


# ── Core propagation ──────────────────────────────────────────────────

class TestPropagate:
    def test_empty_scores_returns_zeroes(self):
        result = propagate({})
        assert result["cascade_score"] == 0.0
        for v in result["final_scores"].values():
            assert v == 0.0

    def test_single_source_propagates(self):
        """flood=0.8 should cascade into water_stagnation and vector_health."""
        result = propagate({"flood": 0.8})
        assert result["final_scores"]["flood"] == 0.8
        assert result["final_scores"]["water_stagnation"] > 0.0
        assert result["final_scores"]["vector_health"] > 0.0

    def test_cascade_score_positive_when_risks_present(self):
        result = propagate({"flood": 1.0, "waste": 0.8})
        assert result["cascade_score"] > 0.0

    def test_final_scores_capped_at_one(self):
        result = propagate({rt: 1.0 for rt in ALL_RISK_TYPES})
        for v in result["final_scores"].values():
            assert v <= 1.0, f"Uncapped score: {v}"

    def test_secondary_impacts_non_empty(self):
        result = propagate({"flood": 0.9})
        assert len(result["secondary_impacts"]) > 0

    def test_propagation_trace_contains_arrows(self):
        result = propagate({"flood": 0.8})
        for path in result["propagation_trace"]:
            assert "→" in path

    def test_no_cycles_in_trace(self):
        """No propagation trace should visit the same node twice."""
        result = propagate({rt: 0.7 for rt in ALL_RISK_TYPES})
        for path in result["propagation_trace"]:
            nodes = path.split("→")
            assert len(nodes) == len(set(nodes)), f"Cycle detected in: {path}"

    def test_depth_limit_respected(self):
        """With max_depth=1, tertiary_impacts should be empty."""
        result = propagate({"flood": 1.0}, max_depth=1)
        assert len(result["tertiary_impacts"]) == 0

    def test_hop_decay_applied(self):
        """Second-hop score should be less than first-hop score for the same chain."""
        result = propagate({"flood": 1.0})
        # flood→water_stagnation (depth 0, weight 0.8) → vector_health (depth 1)
        sec_scores = {i["type"]: i["score"] for i in result["secondary_impacts"]}
        tert_scores = {i["type"]: i["score"] for i in result["tertiary_impacts"]}
        if "water_stagnation" in sec_scores and "vector_health" in tert_scores:
            assert tert_scores["vector_health"] < sec_scores["water_stagnation"]

    def test_known_chain_flood_to_vector(self):
        """
        Chain: flood(0.6) → water_stagnation(weight 0.8) = 0.48
               water_stagnation → vector_health(weight 0.7) = 0.48*0.7*0.65 = 0.218...
        """
        result = propagate({"flood": 0.6}, hop_decay=0.65)
        ws = result["final_scores"]["water_stagnation"]
        vh = result["final_scores"]["vector_health"]
        assert ws > 0.3, f"water_stagnation={ws}"
        assert vh > 0.05, f"vector_health={vh}"
        assert ws > vh, "water_stagnation should be stronger than vector_health (farther hop)"

    def test_custom_edges(self):
        custom = [("a", "b", 1.0)]
        result = propagate({"a": 0.5}, edges=custom)
        assert result["final_scores"].get("a", 0) <= 1.0


# ── Feature cache ─────────────────────────────────────────────────────

class TestFeatureCache:
    def test_cache_miss_returns_none(self):
        from src.services.feature_cache import get_cached_features, clear_all
        clear_all()
        assert get_cached_features("G_NONEXISTENT", True) is None

    def test_set_and_get(self):
        from src.services.feature_cache import (
            get_cached_features, set_cached_features, clear_all
        )
        clear_all()
        feats = {"violation_count_7d": 5, "recency_decay_score": 3.2}
        set_cached_features("G_TEST", True, feats, ttl=60)
        cached = get_cached_features("G_TEST", True)
        assert cached == feats

    def test_expiry(self):
        import time
        from src.services.feature_cache import (
            get_cached_features, set_cached_features, clear_all
        )
        clear_all()
        set_cached_features("G_TTL", True, {"x": 1}, ttl=0)
        time.sleep(0.01)  # tiny sleep to exceed 0-second TTL
        assert get_cached_features("G_TTL", True) is None

    def test_invalidate(self):
        from src.services.feature_cache import (
            get_cached_features, set_cached_features, invalidate, clear_all
        )
        clear_all()
        set_cached_features("G_INV", True, {"x": 1}, ttl=60)
        invalidate("G_INV")
        assert get_cached_features("G_INV", True) is None


# ── Risk memory (unit-level, mocking db) ─────────────────────────────

class TestRiskMemory:
    def test_enrich_features_adds_key(self):
        from unittest.mock import patch
        from src.services.risk_memory import enrich_features_with_memory
        with patch("src.services.risk_memory.get_memory_boost", return_value=0.3):
            result = enrich_features_with_memory({"a": 1}, "G_X", "all")
        assert "recurrence_memory_weight" in result
        assert result["recurrence_memory_weight"] == 0.3

    def test_enrich_features_boost_applied(self):
        from unittest.mock import patch
        from src.services.risk_memory import enrich_features_with_memory
        with patch("src.services.risk_memory.get_memory_boost", return_value=0.5):
            base = {"recency_decay_score": 2.0}
            result = enrich_features_with_memory(base, "G_X", "all")
        # boost = 0.5, so recency_decay_score += 0.5 * 3.0 = 1.5 → 3.5
        assert result["recency_decay_score"] == pytest.approx(3.5, rel=1e-4)
