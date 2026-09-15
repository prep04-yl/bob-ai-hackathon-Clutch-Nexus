from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app import models
from app.schemas import DashboardKPIs

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/kpis", response_model=DashboardKPIs)
def get_kpis(db: Session = Depends(get_db)):
    total = db.query(models.Shipment).count()
    disrupted = db.query(models.Shipment).filter(models.Shipment.status == "disrupted").count()
    at_risk = db.query(models.Shipment).filter(models.Shipment.status == "at_risk").count()
    in_transit = db.query(models.Shipment).filter(models.Shipment.status == "in_transit").count()
    delivered = db.query(models.Shipment).filter(models.Shipment.status == "delivered").count()
    delayed = db.query(models.Shipment).filter(models.Shipment.status == "delayed").count()

    value_at_risk = (
        db.query(func.sum(models.Shipment.value_usd))
        .filter(models.Shipment.status.in_(["disrupted", "at_risk"]))
        .scalar() or 0
    )

    active_disruptions = db.query(models.Disruption).filter(
        models.Disruption.is_active == True
    ).count()

    avg_util = (
        db.query(func.avg(models.Vehicle.utilisation_pct))
        .filter(models.Vehicle.status != "maintenance")
        .scalar() or 0
    )

    excursions = db.query(models.ColdChainLog).filter(
        models.ColdChainLog.is_excursion == True
    ).count()

    top_dis = (
        db.query(models.Disruption)
        .filter(models.Disruption.is_active == True)
        .order_by(models.Disruption.financial_impact_usd.desc())
        .first()
    )

    return DashboardKPIs(
        total_shipments=total,
        disrupted=disrupted,
        at_risk=at_risk,
        in_transit=in_transit,
        delivered=delivered,
        delayed=delayed,
        total_value_at_risk_usd=round(value_at_risk, 2),
        active_disruptions=active_disruptions,
        fleet_utilisation_avg_pct=round(float(avg_util), 1),
        cold_chain_excursions=excursions,
        top_disruption=top_dis.title if top_dis else None,
    )


@router.get("/shipments-by-status")
def shipments_by_status(db: Session = Depends(get_db)):
    rows = (
        db.query(models.Shipment.status, func.count(models.Shipment.id))
        .group_by(models.Shipment.status)
        .all()
    )
    return [{"status": r[0], "count": r[1]} for r in rows]


@router.get("/shipments-by-category")
def shipments_by_category(db: Session = Depends(get_db)):
    rows = (
        db.query(models.Shipment.category, func.count(models.Shipment.id),
                 func.sum(models.Shipment.value_usd))
        .group_by(models.Shipment.category)
        .all()
    )
    return [{"category": r[0], "count": r[1], "value_usd": round(float(r[2] or 0), 2)} for r in rows]


@router.get("/fleet-utilisation")
def fleet_utilisation(db: Session = Depends(get_db)):
    vehicles = db.query(models.Vehicle).all()
    return [
        {"code": v.code, "name": v.name, "type": v.type,
         "utilisation_pct": v.utilisation_pct, "status": v.status}
        for v in vehicles
    ]


@router.get("/risk-timeline")
def risk_timeline(db: Session = Depends(get_db)):
    """Shipment risk scores bucketed for visualization."""
    shipments = db.query(models.Shipment).all()
    buckets = {"0-0.2": 0, "0.2-0.4": 0, "0.4-0.6": 0, "0.6-0.8": 0, "0.8-1.0": 0}
    for s in shipments:
        r = s.risk_score
        if r < 0.2:
            buckets["0-0.2"] += 1
        elif r < 0.4:
            buckets["0.2-0.4"] += 1
        elif r < 0.6:
            buckets["0.4-0.6"] += 1
        elif r < 0.8:
            buckets["0.6-0.8"] += 1
        else:
            buckets["0.8-1.0"] += 1
    return [{"range": k, "count": v} for k, v in buckets.items()]
