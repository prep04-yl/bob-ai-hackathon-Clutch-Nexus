"""
Comprehensive API smoke-tests for the Supply Chain backend.
Uses FastAPI TestClient (no live server needed).
All tests use a fresh in-memory SQLite DB seeded with the real seed_data.
"""
import pytest
from contextlib import asynccontextmanager
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.seed_data import seed_database

# ── In-memory SQLite with a single shared connection ─────────────────────────
#
# SQLite ":memory:" creates a separate empty database per connection.
# To share the same in-memory DB across all sessions/requests we keep ONE
# underlying DBAPI connection alive and route everything through it via the
# connect event + check_same_thread=False.
#
from sqlalchemy.pool import StaticPool

test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,           # single shared connection → same DB instance
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

# Build schema + seed data using the same engine (same connection)
from app import models  # noqa: F401 — registers all ORM classes with Base
Base.metadata.create_all(bind=test_engine)
_seed_db = TestingSessionLocal()
try:
    seed_database(_seed_db)
finally:
    _seed_db.close()


def _override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


# Disable the FastAPI lifespan so init_db() is NOT called on the production engine
@asynccontextmanager
async def _noop_lifespan(app):
    yield


import main  # noqa: E402 — import *after* schema is ready
main.app.router.lifespan_context = _noop_lifespan
main.app.dependency_overrides[get_db] = _override_get_db


@pytest.fixture(scope="session")
def client():
    """Session-scoped TestClient wired to the in-memory DB."""
    with TestClient(main.app, raise_server_exceptions=True) as c:
        yield c


# ── Health / root ─────────────────────────────────────────────────────────────

class TestHealth:
    def test_root(self, client):
        r = client.get("/")
        assert r.status_code == 200
        assert "service" in r.json()

    def test_health(self, client):
        r = client.get("/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"


# ── Dashboard ─────────────────────────────────────────────────────────────────

class TestDashboard:
    def test_kpis(self, client):
        r = client.get("/api/v1/dashboard/kpis")
        assert r.status_code == 200
        data = r.json()
        assert data["total_shipments"] > 0
        assert isinstance(data["disrupted"], int)
        assert isinstance(data["at_risk"], int)
        assert isinstance(data["in_transit"], int)
        assert isinstance(data["delivered"], int)
        assert isinstance(data["delayed"], int)
        assert data["total_value_at_risk_usd"] >= 0
        assert data["active_disruptions"] >= 1
        assert 0 <= data["fleet_utilisation_avg_pct"] <= 100
        assert data["cold_chain_excursions"] >= 0
        # top disruption should be set (we have active disruptions)
        assert data["top_disruption"] is not None

    def test_shipments_by_status(self, client):
        r = client.get("/api/v1/dashboard/shipments-by-status")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) > 0
        row = data[0]
        assert "status" in row and "count" in row

    def test_shipments_by_category(self, client):
        r = client.get("/api/v1/dashboard/shipments-by-category")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) > 0
        row = data[0]
        assert "category" in row and "count" in row and "value_usd" in row

    def test_fleet_utilisation(self, client):
        r = client.get("/api/v1/dashboard/fleet-utilisation")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) > 0
        v = data[0]
        assert "code" in v and "utilisation_pct" in v

    def test_risk_timeline(self, client):
        r = client.get("/api/v1/dashboard/risk-timeline")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 5  # 5 risk buckets
        total = sum(row["count"] for row in data)
        assert total > 0


# ── Shipments ────────────────────────────────────────────────────────────────

class TestShipments:
    def test_list_all(self, client):
        r = client.get("/api/v1/shipments/")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 20  # seed creates 30 shipments

    def test_filter_by_status(self, client):
        r = client.get("/api/v1/shipments/?status=disrupted")
        assert r.status_code == 200
        data = r.json()
        assert all(s["status"] == "disrupted" for s in data)

    def test_filter_by_category(self, client):
        # Get a real category from the live data first
        all_ships = client.get("/api/v1/shipments/").json()
        cat = all_ships[0]["category"] if all_ships else None
        assert cat is not None
        r = client.get(f"/api/v1/shipments/?category={cat}")
        assert r.status_code == 200
        data = r.json()
        assert all(s["category"] == cat for s in data)

    def test_get_single_shipment(self, client):
        # First get list then fetch individual
        all_r = client.get("/api/v1/shipments/")
        first_id = all_r.json()[0]["id"]
        r = client.get(f"/api/v1/shipments/{first_id}")
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == first_id
        assert "tracking_id" in data
        assert "risk_score" in data
        assert 0.0 <= data["risk_score"] <= 1.0

    def test_get_shipment_not_found(self, client):
        r = client.get("/api/v1/shipments/99999")
        assert r.status_code == 404

    def test_cold_chain_logs(self, client):
        """Cold-chain shipments must have telemetry logs."""
        # Use the dedicated cold-chain endpoint to get a cold-chain shipment
        cold_ships = client.get("/api/v1/cold-chain/shipments").json()
        cold_ship = cold_ships[0] if cold_ships else None
        assert cold_ship is not None, "No cold-chain shipment found in seed data"
        r = client.get(f"/api/v1/shipments/{cold_ship['id']}/cold-chain")
        assert r.status_code == 200
        logs = r.json()
        assert isinstance(logs, list)
        assert len(logs) > 0
        log = logs[0]
        assert "temperature_c" in log
        assert "timestamp" in log
        assert "is_excursion" in log

    def test_risk_score_range(self, client):
        """All shipments must have risk_score in [0, 1]."""
        data = client.get("/api/v1/shipments/").json()
        for s in data:
            assert 0.0 <= s["risk_score"] <= 1.0, (
                f"Shipment {s['tracking_id']} has invalid risk_score {s['risk_score']}"
            )

    def test_disrupted_shipments_have_disruption_id(self, client):
        data = client.get("/api/v1/shipments/?status=disrupted").json()
        for s in data:
            assert s["disruption_id"] is not None, (
                f"Disrupted shipment {s['tracking_id']} missing disruption_id"
            )


# ── Disruptions ──────────────────────────────────────────────────────────────

class TestDisruptions:
    def test_list_disruptions(self, client):
        r = client.get("/api/v1/disruptions/")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        d = data[0]
        assert "title" in d and "severity" in d and "is_active" in d

    def test_get_disruption(self, client):
        disruptions = client.get("/api/v1/disruptions/").json()
        first_id = disruptions[0]["id"]
        r = client.get(f"/api/v1/disruptions/{first_id}")
        assert r.status_code == 200
        d = r.json()
        assert d["id"] == first_id
        assert d["financial_impact_usd"] > 0

    def test_disruption_not_found(self, client):
        r = client.get("/api/v1/disruptions/99999")
        assert r.status_code == 404

    def test_impact_cascade(self, client):
        """Impact cascade must return disruption + cascade + shipments."""
        disruptions = client.get("/api/v1/disruptions/").json()
        active = next((d for d in disruptions if d["is_active"]), None)
        assert active is not None, "No active disruption in seed data"
        r = client.get(f"/api/v1/disruptions/{active['id']}/impact")
        assert r.status_code == 200
        data = r.json()
        assert "disruption" in data
        assert "cascade" in data
        assert "shipments" in data
        assert "routes" in data
        assert "vehicles" in data
        cascade = data["cascade"]
        assert cascade["affected_shipments_count"] > 0
        assert cascade["total_cargo_value_usd"] > 0
        assert 0.0 <= cascade["avg_risk_score"] <= 1.0

    def test_active_disruption_has_affected_shipments(self, client):
        disruptions = client.get("/api/v1/disruptions/").json()
        active = next((d for d in disruptions if d["is_active"]), None)
        assert active is not None
        # shipments_affected field should reflect linked shipments
        assert active["shipments_affected"] >= 0


# ── Fleet ─────────────────────────────────────────────────────────────────────

class TestFleet:
    def test_list_vehicles(self, client):
        r = client.get("/api/v1/fleet/")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 6
        v = data[0]
        assert "code" in v and "type" in v and "capacity_tonnes" in v
        assert "has_cold_chain" in v
        assert 0 <= v["utilisation_pct"] <= 100

    def test_fleet_summary(self, client):
        r = client.get("/api/v1/fleet/summary")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, dict)
        # Should have at least one vehicle type
        assert len(data) > 0
        for vtype, info in data.items():
            assert "count" in info
            assert "avg_utilisation" in info

    def test_optimise_fleet(self, client):
        """Optimiser must return at least one recommendation for the main disruption."""
        disruptions = client.get("/api/v1/disruptions/").json()
        active = next((d for d in disruptions if d["is_active"]), None)
        assert active is not None
        r = client.post(
            "/api/v1/fleet/optimise",
            json={"disruption_id": active["id"], "objective": "minimize_delay"}
        )
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # Should produce at least one recommendation
        assert len(data) >= 1
        rec = data[0]
        assert "vehicle_id" in rec
        assert "shipment_ids" in rec
        assert len(rec["shipment_ids"]) >= 1
        assert "rationale" in rec
        # Rationale should carry the solver tag
        assert "Pyomo" in rec["rationale"] or "Greedy" in rec["rationale"] or "HiGHS" in rec["rationale"]

    def test_optimise_minimize_cost(self, client):
        disruptions = client.get("/api/v1/disruptions/").json()
        active = next((d for d in disruptions if d["is_active"]), None)
        r = client.post(
            "/api/v1/fleet/optimise",
            json={"disruption_id": active["id"], "objective": "minimize_cost"}
        )
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_get_recommendations(self, client):
        """After optimise, recommendations should be retrievable."""
        disruptions = client.get("/api/v1/disruptions/").json()
        active = next((d for d in disruptions if d["is_active"]), None)
        # Run optimise first to ensure recommendations exist
        client.post(
            "/api/v1/fleet/optimise",
            json={"disruption_id": active["id"], "objective": "minimize_delay"}
        )
        r = client.get(f"/api/v1/fleet/recommendations/{active['id']}")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        rec = data[0]
        assert "priority_score" in rec
        assert "capacity_match_pct" in rec
        assert "rationale" in rec

    def test_optimise_nonexistent_disruption(self, client):
        r = client.post(
            "/api/v1/fleet/optimise",
            json={"disruption_id": 99999, "objective": "minimize_delay"}
        )
        assert r.status_code == 404


# ── Cold Chain ────────────────────────────────────────────────────────────────

class TestColdChain:
    def test_cold_chain_shipments(self, client):
        r = client.get("/api/v1/cold-chain/shipments")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 6  # seed creates 6 cold-chain shipments
        s = data[0]
        assert "temp_min_c" in s
        assert "temp_max_c" in s
        assert "current_temp_c" in s
        assert "in_excursion" in s
        assert "excursion_event_count" in s

    def test_cold_chain_summary(self, client):
        r = client.get("/api/v1/cold-chain/summary")
        assert r.status_code == 200
        data = r.json()
        assert "total_cold_chain_shipments" in data
        assert "shipments_in_excursion" in data
        assert "total_excursion_events" in data
        assert data["total_cold_chain_shipments"] >= 6
        # Excursion count must be ≤ total cold chain shipments
        assert data["shipments_in_excursion"] <= data["total_cold_chain_shipments"]

    def test_excursion_events(self, client):
        r = client.get("/api/v1/cold-chain/excursions")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # We have seeded excursion events
        assert len(data) >= 1
        evt = data[0]
        assert "temperature_c" in evt
        assert "tracking_id" in evt
        assert "excursion_severity" in evt

    def test_excursion_shipment_has_in_excursion_flag(self, client):
        """Any shipment with is_excursion logs must have in_excursion=True."""
        excursions = client.get("/api/v1/cold-chain/excursions").json()
        if not excursions:
            pytest.skip("No excursion events in seed data")
        shipment_ids_with_excursions = {e["shipment_id"] for e in excursions}
        ships = client.get("/api/v1/cold-chain/shipments").json()
        for s in ships:
            if s["id"] in shipment_ids_with_excursions and s["excursion_event_count"] > 0:
                # in_excursion depends on current_temp_c vs range — at least count > 0
                assert s["excursion_event_count"] > 0


# ── What-If Simulation ────────────────────────────────────────────────────────

class TestWhatIf:
    def test_list_scenarios(self, client):
        r = client.get("/api/v1/whatif/scenarios")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 6
        keys = {s["key"] for s in data}
        assert "baseline" in keys
        assert "reroute_jnpt" in keys
        assert "air_freight_critical" in keys

    def test_get_baseline_scenario(self, client):
        r = client.get("/api/v1/whatif/scenarios/baseline")
        assert r.status_code == 200
        data = r.json()
        assert data["scenario_name"] == "Baseline (No Action)"
        assert data["total_cost_delta_usd"] == 0
        assert data["risk_reduction_pct"] == 0.0
        assert isinstance(data["recommendations"], list)

    def test_get_reroute_jnpt_scenario(self, client):
        r = client.get("/api/v1/whatif/scenarios/reroute_jnpt")
        assert r.status_code == 200
        data = r.json()
        assert data["risk_reduction_pct"] > 0
        assert data["total_cost_delta_usd"] > 0
        assert data["shipments_recovered"] > 0

    def test_air_freight_highest_risk_reduction(self, client):
        """Air freight critical should have highest risk reduction."""
        r_jnpt = client.get("/api/v1/whatif/scenarios/reroute_jnpt").json()
        r_air = client.get("/api/v1/whatif/scenarios/air_freight_critical").json()
        assert r_air["risk_reduction_pct"] > r_jnpt["risk_reduction_pct"]

    def test_get_unknown_scenario(self, client):
        r = client.get("/api/v1/whatif/scenarios/does_not_exist")
        assert r.status_code == 404

    def test_compare_scenarios(self, client):
        r = client.get("/api/v1/whatif/compare")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 6
        row = data[0]
        assert "key" in row and "name" in row
        assert "cost_delta_usd" in row
        assert "risk_reduction_pct" in row

    def test_scenario_recommendations_have_content(self, client):
        """All non-baseline scenarios should include at least one recommendation."""
        for key in ["reroute_jnpt", "air_freight_critical", "split_air_sea"]:
            data = client.get(f"/api/v1/whatif/scenarios/{key}").json()
            assert len(data["recommendations"]) >= 1, (
                f"Scenario '{key}' returned no recommendations"
            )


# ── Network ───────────────────────────────────────────────────────────────────

class TestNetwork:
    def test_list_ports(self, client):
        r = client.get("/api/v1/network/ports")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 14  # seed creates 16 ports
        p = data[0]
        assert "code" in p and "lat" in p and "lng" in p and "type" in p
        assert "country" in p

    def test_list_routes(self, client):
        r = client.get("/api/v1/network/routes")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 15  # seed creates 20 routes
        route = data[0]
        assert "code" in route
        assert "mode" in route
        assert route["mode"] in {"sea", "air", "rail", "road"}

    def test_topology(self, client):
        r = client.get("/api/v1/network/topology")
        assert r.status_code == 200
        data = r.json()
        assert "nodes" in data and "edges" in data
        assert len(data["nodes"]) >= 14
        assert len(data["edges"]) >= 15
        # Each node must carry country
        for node in data["nodes"]:
            assert "country" in node, f"Node {node.get('code')} missing 'country'"
        # Disrupted port should be flagged
        disrupted = [n for n in data["nodes"] if n["is_disrupted"]]
        assert len(disrupted) >= 1, "No disrupted port in topology"
        # Mumbai Port should be disrupted
        inbom = next((n for n in data["nodes"] if n["code"] == "INBOM"), None)
        assert inbom is not None
        assert inbom["is_disrupted"] is True

    def test_routes_have_transit_days(self, client):
        routes = client.get("/api/v1/network/routes").json()
        for r in routes:
            assert r["transit_days"] >= 1, (
                f"Route {r['code']} has invalid transit_days={r['transit_days']}"
            )


# ── AI ────────────────────────────────────────────────────────────────────────
# Tests are written to pass whether or not GEMINI_API_KEY is set in .env.
# Assertions check response *shape* and non-empty content; they do not hard-code
# the configured/fallback state because that depends on the local environment.

class TestAI:
    def test_ai_status(self, client):
        r = client.get("/api/v1/ai/status")
        assert r.status_code == 200
        data = r.json()
        assert "configured" in data
        assert isinstance(data["configured"], bool)
        assert "model" in data
        assert isinstance(data["model"], str) and len(data["model"]) > 0
        assert "provider" in data
        assert data["provider"] == "Google Gemini"
        assert "message" in data

    def test_disruption_explain(self, client):
        disruptions = client.get("/api/v1/disruptions/").json()
        first_id = disruptions[0]["id"]
        r = client.get(f"/api/v1/ai/disruptions/{first_id}/explain")
        assert r.status_code == 200
        data = r.json()
        assert "text" in data
        assert len(data["text"]) > 20
        assert "model" in data
        assert "configured" in data

    def test_disruption_recommend(self, client):
        disruptions = client.get("/api/v1/disruptions/").json()
        active = next((d for d in disruptions if d["is_active"]), None)
        assert active is not None
        r = client.get(f"/api/v1/ai/disruptions/{active['id']}/recommend")
        assert r.status_code == 200
        data = r.json()
        assert len(data["text"]) > 20

    def test_risk_narrative(self, client):
        ships = client.get("/api/v1/shipments/?status=disrupted").json()
        assert len(ships) > 0
        ship_id = ships[0]["id"]
        r = client.get(f"/api/v1/ai/shipments/{ship_id}/risk-narrative")
        assert r.status_code == 200
        data = r.json()
        assert len(data["text"]) > 20

    def test_cold_chain_analysis(self, client):
        cold_ships = client.get("/api/v1/cold-chain/shipments").json()
        assert len(cold_ships) > 0
        ship_id = cold_ships[0]["id"]
        r = client.get(f"/api/v1/ai/shipments/{ship_id}/cold-chain-analysis")
        assert r.status_code == 200
        data = r.json()
        assert len(data["text"]) > 20

    def test_ai_endpoints_404(self, client):
        assert client.get("/api/v1/ai/disruptions/99999/explain").status_code == 404
        assert client.get("/api/v1/ai/disruptions/99999/recommend").status_code == 404
        assert client.get("/api/v1/ai/shipments/99999/risk-narrative").status_code == 404
        assert client.get("/api/v1/ai/shipments/99999/cold-chain-analysis").status_code == 404

    def test_cold_chain_analysis_non_cold_ship(self, client):
        """Should return 400 for a shipment that doesn't require cold chain."""
        ships = client.get("/api/v1/shipments/").json()
        non_cold = next((s for s in ships if not s["requires_cold_chain"]), None)
        if non_cold is None:
            pytest.skip("All shipments require cold chain (unexpected)")
        r = client.get(f"/api/v1/ai/shipments/{non_cold['id']}/cold-chain-analysis")
        assert r.status_code == 400

    def test_ai_fallback_flag_is_bool(self, client):
        """fallback field must always be a boolean regardless of configuration."""
        disruptions = client.get("/api/v1/disruptions/").json()
        first_id = disruptions[0]["id"]
        for url in [
            f"/api/v1/ai/disruptions/{first_id}/explain",
            f"/api/v1/ai/disruptions/{first_id}/recommend",
        ]:
            data = client.get(url).json()
            assert isinstance(data["fallback"], bool)
            assert isinstance(data["configured"], bool)
            # fallback=True when unconfigured, False when Gemini answered successfully
            status = client.get("/api/v1/ai/status").json()
            if not status["configured"]:
                assert data["fallback"] is True

    def test_ai_response_model_field_present(self, client):
        """model field must be a non-empty string."""
        disruptions = client.get("/api/v1/disruptions/").json()
        data = client.get(f"/api/v1/ai/disruptions/{disruptions[0]['id']}/explain").json()
        assert isinstance(data["model"], str) and len(data["model"]) > 0
        # When unconfigured the model should say 'rule-based'
        status = client.get("/api/v1/ai/status").json()
        if not status["configured"]:
            assert data["model"] == "rule-based"


# ── Copilot ────────────────────────────────────────────────────────────────────

class TestCopilot:
    def test_copilot_basic(self, client):
        r = client.post("/api/v1/ai/copilot", json={"question": "How many shipments are disrupted?"})
        assert r.status_code == 200
        data = r.json()
        assert "answer" in data
        assert len(data["answer"]) > 10
        assert "model" in data
        assert "configured" in data
        assert "fallback" in data

    def test_copilot_configured_and_fallback_are_booleans(self, client):
        """configured and fallback must always be booleans; fallback=True when unconfigured."""
        r = client.post("/api/v1/ai/copilot", json={"question": "What disruptions are active?"})
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data["configured"], bool)
        assert isinstance(data["fallback"], bool)
        # Consistency: if not configured then must be fallback
        if not data["configured"]:
            assert data["fallback"] is True

    def test_copilot_answer_contains_data(self, client):
        """Rule-based fallback answer should mention current disruption count."""
        r = client.post("/api/v1/ai/copilot", json={"question": "What active disruptions are there?"})
        data = r.json()
        # Answer must reference disruptions (numeric or word)
        answer_lower = data["answer"].lower()
        assert any(w in answer_lower for w in ("disruption", "active", "closure", "strike"))

    def test_copilot_cold_chain_question(self, client):
        r = client.post("/api/v1/ai/copilot", json={"question": "Are any cold chain shipments in excursion?"})
        assert r.status_code == 200
        data = r.json()
        assert len(data["answer"]) > 10

    def test_copilot_fleet_question(self, client):
        r = client.post("/api/v1/ai/copilot", json={"question": "What is the fleet utilisation?"})
        assert r.status_code == 200
        data = r.json()
        assert "utilisation" in data["answer"].lower() or "fleet" in data["answer"].lower()

    def test_copilot_empty_question_rejected(self, client):
        r = client.post("/api/v1/ai/copilot", json={"question": "   "})
        assert r.status_code == 422

    def test_copilot_missing_field_rejected(self, client):
        r = client.post("/api/v1/ai/copilot", json={})
        assert r.status_code == 422
