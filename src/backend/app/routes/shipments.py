from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from app.database import get_db
from app import models
from app.schemas import ShipmentOut

router = APIRouter(prefix="/shipments", tags=["shipments"])


@router.get("/", response_model=List[ShipmentOut])
def list_shipments(
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    priority: Optional[int] = Query(None),
    disruption_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    q = (
        db.query(models.Shipment)
        .options(
            joinedload(models.Shipment.origin_port),
            joinedload(models.Shipment.destination_port),
            joinedload(models.Shipment.route).joinedload(models.Route.origin_port),
            joinedload(models.Shipment.route).joinedload(models.Route.destination_port),
            joinedload(models.Shipment.vehicle).joinedload(models.Vehicle.current_port),
        )
    )
    if status:
        q = q.filter(models.Shipment.status == status)
    if category:
        q = q.filter(models.Shipment.category == category)
    if priority:
        q = q.filter(models.Shipment.priority == priority)
    if disruption_id:
        q = q.filter(models.Shipment.disruption_id == disruption_id)
    return q.order_by(models.Shipment.priority, models.Shipment.risk_score.desc()).all()


@router.get("/{shipment_id}", response_model=ShipmentOut)
def get_shipment(shipment_id: int, db: Session = Depends(get_db)):
    s = (
        db.query(models.Shipment)
        .options(
            joinedload(models.Shipment.origin_port),
            joinedload(models.Shipment.destination_port),
            joinedload(models.Shipment.route).joinedload(models.Route.origin_port),
            joinedload(models.Shipment.route).joinedload(models.Route.destination_port),
            joinedload(models.Shipment.vehicle).joinedload(models.Vehicle.current_port),
        )
        .filter(models.Shipment.id == shipment_id)
        .first()
    )
    if not s:
        raise HTTPException(status_code=404, detail="Shipment not found")
    return s


@router.get("/{shipment_id}/cold-chain")
def get_cold_chain_logs(shipment_id: int, db: Session = Depends(get_db)):
    logs = (
        db.query(models.ColdChainLog)
        .filter(models.ColdChainLog.shipment_id == shipment_id)
        .order_by(models.ColdChainLog.timestamp)
        .all()
    )
    return [
        {
            "id": log.id,
            "timestamp": log.timestamp.isoformat(),
            "temperature_c": log.temperature_c,
            "humidity_pct": log.humidity_pct,
            "is_excursion": log.is_excursion,
            "excursion_severity": log.excursion_severity,
        }
        for log in logs
    ]
