from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
from app.database import get_db
from app import models
from app.schemas import DisruptionOut

router = APIRouter(prefix="/disruptions", tags=["disruptions"])


@router.get("/", response_model=List[DisruptionOut])
def list_disruptions(db: Session = Depends(get_db)):
    return (
        db.query(models.Disruption)
        .options(joinedload(models.Disruption.affected_port))
        .order_by(models.Disruption.is_active.desc(), models.Disruption.started_at.desc())
        .all()
    )


@router.get("/{disruption_id}", response_model=DisruptionOut)
def get_disruption(disruption_id: int, db: Session = Depends(get_db)):
    d = (
        db.query(models.Disruption)
        .options(joinedload(models.Disruption.affected_port))
        .filter(models.Disruption.id == disruption_id)
        .first()
    )
    if not d:
        raise HTTPException(status_code=404, detail="Disruption not found")
    return d


@router.get("/{disruption_id}/impact")
def get_disruption_impact(disruption_id: int, db: Session = Depends(get_db)):
    """Impact cascade: disruption → shipments → routes → vehicles → risk."""
    d = db.query(models.Disruption).filter(models.Disruption.id == disruption_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Disruption not found")

    affected_shipments = (
        db.query(models.Shipment)
        .options(
            joinedload(models.Shipment.origin_port),
            joinedload(models.Shipment.destination_port),
            joinedload(models.Shipment.vehicle),
        )
        .filter(models.Shipment.disruption_id == disruption_id)
        .all()
    )

    # Cascade: unique routes and vehicles
    route_ids = {s.route_id for s in affected_shipments if s.route_id}
    vehicle_ids = {s.vehicle_id for s in affected_shipments if s.vehicle_id}

    routes = db.query(models.Route).filter(models.Route.id.in_(route_ids)).all()
    vehicles = db.query(models.Vehicle).filter(models.Vehicle.id.in_(vehicle_ids)).all()

    total_value = sum(s.value_usd for s in affected_shipments)
    total_weight = sum(s.weight_tonnes for s in affected_shipments)
    cold_chain_at_risk = sum(1 for s in affected_shipments if s.requires_cold_chain)
    critical_count = sum(1 for s in affected_shipments if s.priority == 1)
    avg_risk = (
        sum(s.risk_score for s in affected_shipments) / len(affected_shipments)
        if affected_shipments else 0
    )

    return {
        "disruption": {
            "id": d.id,
            "code": d.code,
            "title": d.title,
            "type": d.type,
            "severity": d.severity,
            "financial_impact_usd": d.financial_impact_usd,
            "is_active": d.is_active,
        },
        "cascade": {
            "affected_shipments_count": len(affected_shipments),
            "affected_routes_count": len(route_ids),
            "affected_vehicles_count": len(vehicle_ids),
            "total_cargo_value_usd": round(total_value, 2),
            "total_weight_tonnes": round(total_weight, 2),
            "cold_chain_shipments_at_risk": cold_chain_at_risk,
            "critical_shipments_count": critical_count,
            "avg_risk_score": round(avg_risk, 3),
        },
        "shipments": [
            {
                "id": s.id,
                "tracking_id": s.tracking_id,
                "description": s.description,
                "category": s.category,
                "status": s.status,
                "priority": s.priority,
                "risk_score": s.risk_score,
                "value_usd": s.value_usd,
                "delay_hours": s.delay_hours,
                "requires_cold_chain": s.requires_cold_chain,
                "origin": s.origin_port.code if s.origin_port else None,
                "destination": s.destination_port.code if s.destination_port else None,
                "vehicle_code": s.vehicle.code if s.vehicle else None,
            }
            for s in affected_shipments
        ],
        "routes": [
            {"id": r.id, "code": r.code, "mode": r.mode, "transit_days": r.transit_days}
            for r in routes
        ],
        "vehicles": [
            {"id": v.id, "code": v.code, "type": v.type, "status": v.status,
             "utilisation_pct": v.utilisation_pct}
            for v in vehicles
        ],
    }
