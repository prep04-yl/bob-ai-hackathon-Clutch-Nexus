from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session, joinedload
from typing import List
from app.database import get_db
from app import models
from app.schemas import VehicleOut, OptimiseRequest, FleetRecommendationOut
from app import optimiser

router = APIRouter(prefix="/fleet", tags=["fleet"])


@router.get("/", response_model=List[VehicleOut])
def list_vehicles(db: Session = Depends(get_db)):
    return (
        db.query(models.Vehicle)
        .options(joinedload(models.Vehicle.current_port))
        .order_by(models.Vehicle.status, models.Vehicle.utilisation_pct.desc())
        .all()
    )


@router.get("/summary")
def fleet_summary(db: Session = Depends(get_db)):
    vehicles = db.query(models.Vehicle).all()
    by_type: dict = {}
    for v in vehicles:
        t = v.type
        if t not in by_type:
            by_type[t] = {"count": 0, "available": 0, "total_capacity_tonnes": 0.0,
                          "avg_utilisation": 0.0, "cold_chain": 0}
        by_type[t]["count"] += 1
        if v.status == "available":
            by_type[t]["available"] += 1
        by_type[t]["total_capacity_tonnes"] += v.capacity_tonnes
        by_type[t]["avg_utilisation"] += v.utilisation_pct
        if v.has_cold_chain:
            by_type[t]["cold_chain"] += 1
    for t in by_type:
        cnt = by_type[t]["count"]
        by_type[t]["avg_utilisation"] = round(by_type[t]["avg_utilisation"] / cnt, 1)
    return by_type


@router.post("/optimise", response_model=List[dict])
def optimise_fleet(req: OptimiseRequest, db: Session = Depends(get_db)):
    disruption = db.query(models.Disruption).filter(
        models.Disruption.id == req.disruption_id
    ).first()
    if not disruption:
        raise HTTPException(status_code=404, detail="Disruption not found")

    # Get affected (disrupted/at_risk) shipments
    affected_shipments = (
        db.query(models.Shipment)
        .options(
            joinedload(models.Shipment.origin_port),
            joinedload(models.Shipment.destination_port),
        )
        .filter(
            models.Shipment.disruption_id == req.disruption_id,
            models.Shipment.status.in_(["disrupted", "at_risk"]),
        )
        .all()
    )
    if not affected_shipments:
        return []

    # Get available vehicles (prefer nearby)
    vehicles_db = (
        db.query(models.Vehicle)
        .options(joinedload(models.Vehicle.current_port))
        .filter(models.Vehicle.status == "available")
        .all()
    )
    routes_db = (
        db.query(models.Route)
        .options(
            joinedload(models.Route.origin_port),
            joinedload(models.Route.destination_port),
        )
        .filter(models.Route.is_active == True)
        .all()
    )

    # Convert to dicts for optimiser
    vehicle_dicts = [
        {
            "id": v.id, "code": v.code, "type": v.type,
            "cap_tonnes": v.capacity_tonnes, "cap_teu": v.capacity_teu or 0,
            "port_lat": v.current_port.lat if v.current_port else 18.92,
            "port_lng": v.current_port.lng if v.current_port else 72.83,
            "port_code": v.current_port.code if v.current_port else "",
            "status": v.status,
            "has_cold_chain": v.has_cold_chain,
            "utilisation_pct": v.utilisation_pct,
        }
        for v in vehicles_db
    ]
    shipment_dicts = [
        {
            "id": s.id, "tracking_id": s.tracking_id,
            "weight_tonnes": s.weight_tonnes,
            "requires_cold_chain": s.requires_cold_chain,
            "priority": s.priority, "value_usd": s.value_usd,
            "origin_lat": s.origin_port.lat if s.origin_port else 18.92,
            "origin_lng": s.origin_port.lng if s.origin_port else 72.83,
            "origin_code": s.origin_port.code if s.origin_port else "",
            "dest_lat": s.destination_port.lat if s.destination_port else 51.92,
            "dest_lng": s.destination_port.lng if s.destination_port else 4.48,
            "dest_code": s.destination_port.code if s.destination_port else "",
        }
        for s in affected_shipments
    ]
    route_dicts = [
        {
            "id": r.id, "code": r.code,
            "origin": r.origin_port.code if r.origin_port else "",
            "dest": r.destination_port.code if r.destination_port else "",
            "days": r.transit_days, "cost": r.cost_per_unit, "mode": r.mode,
        }
        for r in routes_db
    ]

    results = optimiser.optimise_fleet(vehicle_dicts, shipment_dicts, route_dicts, req.objective)

    # Persist recommendations
    for rec in results:
        existing = db.query(models.FleetRecommendation).filter(
            models.FleetRecommendation.disruption_id == req.disruption_id,
            models.FleetRecommendation.vehicle_id == rec["vehicle_id"],
        ).first()
        if not existing:
            fr = models.FleetRecommendation(
                disruption_id=req.disruption_id,
                vehicle_id=rec["vehicle_id"],
                shipment_ids=rec["shipment_ids"],
                recommended_route_id=rec.get("route_id"),
                action=rec["action"],
                priority_score=rec["priority_score"],
                capacity_match_pct=rec["capacity_match_pct"],
                cost_delta_usd=rec["cost_delta_usd"],
                time_delta_hours=rec["time_delta_hours"],
                rationale=rec["rationale"],
            )
            db.add(fr)
    db.commit()

    return results


@router.get("/recommendations/{disruption_id}", response_model=List[FleetRecommendationOut])
def get_recommendations(disruption_id: int, db: Session = Depends(get_db)):
    return (
        db.query(models.FleetRecommendation)
        .options(
            joinedload(models.FleetRecommendation.vehicle)
            .joinedload(models.Vehicle.current_port)
        )
        .filter(models.FleetRecommendation.disruption_id == disruption_id)
        .order_by(models.FleetRecommendation.priority_score.desc())
        .all()
    )
