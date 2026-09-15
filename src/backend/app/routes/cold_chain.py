from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from typing import List
from app.database import get_db
from app import models
from app.schemas import ColdChainLogOut

router = APIRouter(prefix="/cold-chain", tags=["cold-chain"])


# Excursion threshold — same value used everywhere so summary and shipment list stay consistent.
_EXCURSION_TOLERANCE = 1.0   # °C above/below allowed range before flagging an excursion


@router.get("/excursions")
def list_excursions(db: Session = Depends(get_db)):
    # Single join query — avoids N+1 per log entry.
    logs = (
        db.query(models.ColdChainLog)
        .join(models.Shipment, models.ColdChainLog.shipment_id == models.Shipment.id)
        .options(joinedload(models.ColdChainLog.shipment))
        .filter(models.ColdChainLog.is_excursion == True)  # noqa: E712
        .order_by(models.ColdChainLog.timestamp.desc())
        .all()
    )
    result = []
    for log in logs:
        s = log.shipment
        result.append({
            "id": log.id,
            "shipment_id": log.shipment_id,
            "tracking_id": s.tracking_id if s else None,
            "description": s.description if s else None,
            "timestamp": log.timestamp.isoformat(),
            "temperature_c": log.temperature_c,
            "required_min_c": s.temp_min_c if s else None,
            "required_max_c": s.temp_max_c if s else None,
            "excursion_severity": log.excursion_severity,
            "humidity_pct": log.humidity_pct,
        })
    return result


@router.get("/shipments")
def cold_chain_shipments(db: Session = Depends(get_db)):
    shipments = (
        db.query(models.Shipment)
        .options(
            joinedload(models.Shipment.origin_port),
            joinedload(models.Shipment.destination_port),
        )
        .filter(models.Shipment.requires_cold_chain == True)
        .order_by(models.Shipment.priority)
        .all()
    )
    result = []
    for s in shipments:
        excursion_count = (
            db.query(models.ColdChainLog)
            .filter(
                models.ColdChainLog.shipment_id == s.id,
                models.ColdChainLog.is_excursion == True,
            )
            .count()
        )
        in_excursion = (
            s.current_temp_c is not None and s.temp_max_c is not None
            and (s.current_temp_c > s.temp_max_c + _EXCURSION_TOLERANCE or
                 (s.temp_min_c is not None and
                  s.current_temp_c < s.temp_min_c - _EXCURSION_TOLERANCE))
        )
        result.append({
            "id": s.id,
            "tracking_id": s.tracking_id,
            "description": s.description,
            "category": s.category,
            "status": s.status,
            "priority": s.priority,
            "temp_min_c": s.temp_min_c,
            "temp_max_c": s.temp_max_c,
            "current_temp_c": s.current_temp_c,
            "in_excursion": in_excursion,
            "excursion_event_count": excursion_count,
            "origin": s.origin_port.code if s.origin_port else None,
            "destination": s.destination_port.code if s.destination_port else None,
            "risk_score": s.risk_score,
        })
    return result


@router.get("/summary")
def cold_chain_summary(db: Session = Depends(get_db)):
    total_cold = db.query(models.Shipment).filter(
        models.Shipment.requires_cold_chain == True
    ).count()
    # Count shipments whose current_temp_c is actually outside their allowed range
    cold_shipments = db.query(models.Shipment).filter(
        models.Shipment.requires_cold_chain == True,
        models.Shipment.current_temp_c.isnot(None),
    ).all()
    in_excursion = sum(
        1 for s in cold_shipments
        if s.temp_max_c is not None and (
            s.current_temp_c > s.temp_max_c + _EXCURSION_TOLERANCE
            or (s.temp_min_c is not None and
                s.current_temp_c < s.temp_min_c - _EXCURSION_TOLERANCE)
        )
    )
    total_excursion_events = db.query(models.ColdChainLog).filter(
        models.ColdChainLog.is_excursion == True
    ).count()
    return {
        "total_cold_chain_shipments": total_cold,
        "shipments_in_excursion": in_excursion,
        "total_excursion_events": total_excursion_events,
    }
