from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from typing import List
from app.database import get_db
from app import models
from app.schemas import PortOut, RouteOut

router = APIRouter(prefix="/network", tags=["network"])


@router.get("/ports", response_model=List[PortOut])
def list_ports(db: Session = Depends(get_db)):
    return db.query(models.Port).all()


@router.get("/routes", response_model=List[RouteOut])
def list_routes(db: Session = Depends(get_db)):
    return (
        db.query(models.Route)
        .options(
            joinedload(models.Route.origin_port),
            joinedload(models.Route.destination_port),
        )
        .all()
    )


@router.get("/topology")
def network_topology(db: Session = Depends(get_db)):
    """Full network topology for visualization: nodes + edges."""
    ports = db.query(models.Port).all()
    routes = (
        db.query(models.Route)
        .options(
            joinedload(models.Route.origin_port),
            joinedload(models.Route.destination_port),
        )
        .all()
    )
    disruptions = db.query(models.Disruption).filter(
        models.Disruption.is_active == True
    ).all()
    disrupted_port_ids = {d.affected_port_id for d in disruptions if d.affected_port_id}

    nodes = [
        {
            "id": p.id,
            "code": p.code,
            "name": p.name,
            "city": p.city,
            "country": p.country,
            "lat": p.lat,
            "lng": p.lng,
            "type": p.type,
            "is_disrupted": p.id in disrupted_port_ids,
        }
        for p in ports
    ]
    edges = [
        {
            "id": r.id,
            "code": r.code,
            "source": r.origin_port_id,
            "target": r.destination_port_id,
            "source_code": r.origin_port.code if r.origin_port else None,
            "target_code": r.destination_port.code if r.destination_port else None,
            "mode": r.mode,
            "distance_km": r.distance_km,
            "transit_days": r.transit_days,
            "cost_per_unit": r.cost_per_unit,
            "is_active": r.is_active,
        }
        for r in routes
    ]
    return {"nodes": nodes, "edges": edges}
