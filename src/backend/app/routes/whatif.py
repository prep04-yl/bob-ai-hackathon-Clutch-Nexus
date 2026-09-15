from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app import models
from app.schemas import WhatIfScenario, WhatIfResult

router = APIRouter(prefix="/whatif", tags=["what-if"])

# Pre-defined scenario definitions
SCENARIOS = {
    "baseline": {
        "name": "Baseline (No Action)",
        "cost_delta": 0,
        "delay_hours": 108,
        "recovered": 0,
        "risk_reduction": 0.0,
    },
    "reroute_jnpt": {
        "name": "Reroute via JNPT",
        "cost_delta": 185_000,
        "delay_hours": 36,
        "recovered": 12,
        "risk_reduction": 42.0,
    },
    "reroute_chennai": {
        "name": "Reroute via Chennai Port",
        "cost_delta": 420_000,
        "delay_hours": 72,
        "recovered": 8,
        "risk_reduction": 28.0,
    },
    "air_freight_critical": {
        "name": "Air Freight (Critical only)",
        "cost_delta": 3_800_000,
        "delay_hours": 6,
        "recovered": 5,
        "risk_reduction": 68.0,
    },
    "split_air_sea": {
        "name": "Split: Air (Priority 1) + JNPT (Priority 2-3)",
        "cost_delta": 2_100_000,
        "delay_hours": 18,
        "recovered": 15,
        "risk_reduction": 58.0,
    },
    "delay_non_critical": {
        "name": "Delay Non-Critical + Reroute Critical via JNPT",
        "cost_delta": 95_000,
        "delay_hours": 48,
        "recovered": 10,
        "risk_reduction": 35.0,
    },
}


@router.get("/scenarios")
def list_scenarios():
    """Return available pre-defined what-if scenario keys."""
    return [
        {"key": k, "name": v["name"]} for k, v in SCENARIOS.items()
    ]


@router.get("/scenarios/{key}")
def get_scenario_result(key: str, db: Session = Depends(get_db)):
    """Return deterministic result for a named scenario."""
    if key not in SCENARIOS:
        raise HTTPException(status_code=404, detail=f"Scenario '{key}' not found")
    s = SCENARIOS[key]

    # Build illustrative recommendations based on scenario
    recommendations = _build_recommendations(key, db)

    return WhatIfResult(
        scenario_name=s["name"],
        total_cost_delta_usd=float(s["cost_delta"]),
        avg_delay_hours=float(s["delay_hours"]),
        shipments_recovered=s["recovered"],
        risk_reduction_pct=float(s["risk_reduction"]),
        recommendations=recommendations,
    )


@router.get("/compare")
def compare_scenarios(db: Session = Depends(get_db)):
    """Compare all scenarios side by side."""
    results = []
    for key, s in SCENARIOS.items():
        results.append({
            "key": key,
            "name": s["name"],
            "cost_delta_usd": s["cost_delta"],
            "avg_delay_hours": s["delay_hours"],
            "shipments_recovered": s["recovered"],
            "risk_reduction_pct": s["risk_reduction"],
        })
    return results


def _build_recommendations(key: str, db: Session) -> list:
    affected = (
        db.query(models.Shipment)
        .filter(models.Shipment.status.in_(["disrupted", "at_risk"]))
        .order_by(models.Shipment.priority)
        .limit(6)
        .all()
    )
    recs = []
    for s in affected:
        if key == "baseline":
            action = "Hold – awaiting port reopening"
            extra_days = 7
            extra_cost = 0
        elif key == "reroute_jnpt":
            action = "Reroute to JNPT, same vessel schedule"
            extra_days = 1.5
            extra_cost = 12000 if s.priority <= 2 else 8000
        elif key == "reroute_chennai":
            action = "Rail to Chennai then sea departure"
            extra_days = 3
            extra_cost = 18000 if s.priority <= 2 else 12000
        elif key == "air_freight_critical":
            if s.priority == 1:
                action = "Air freight via Mumbai Airport"
                extra_days = -20
                extra_cost = 150000
            else:
                action = "Hold – non-critical"
                extra_days = 7
                extra_cost = 0
        elif key == "split_air_sea":
            if s.priority == 1:
                action = "Air freight via Mumbai Airport"
                extra_days = -20
                extra_cost = 120000
            else:
                action = "Reroute via JNPT"
                extra_days = 1.5
                extra_cost = 10000
        elif key == "delay_non_critical":
            if s.priority <= 2:
                action = "Reroute via JNPT (priority)"
                extra_days = 1.5
                extra_cost = 12000
            else:
                action = "Delay 7 days – hold at origin"
                extra_days = 7
                extra_cost = 2000
        else:
            action = "Review"
            extra_days = 0
            extra_cost = 0

        recs.append({
            "tracking_id": s.tracking_id,
            "description": s.description,
            "category": s.category,
            "priority": s.priority,
            "current_status": s.status,
            "action": action,
            "extra_days": extra_days,
            "extra_cost_usd": extra_cost,
        })
    return recs
