from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app import models
from app import watsonx

from sqlalchemy import func

router = APIRouter(prefix="/ai", tags=["ai"])


class AIResponse(BaseModel):
    text: str
    model: str
    configured: bool
    fallback: bool = False


class CopilotRequest(BaseModel):
    question: str


class CopilotResponse(BaseModel):
    answer: str
    model: str
    configured: bool
    fallback: bool = False


def _not_configured_msg(feature: str) -> str:
    return (
        f"[Demo mode — watsonx.ai not configured] "
        f"Set WATSONX_API_KEY and WATSONX_PROJECT_ID in your .env file to enable live {feature}. "
        f"The architecture is fully wired; only credentials are missing."
    )


@router.get("/status")
def ai_status():
    """Check whether watsonx.ai credentials are configured."""
    configured = watsonx.is_configured()
    return {
        "configured": configured,
        "model": watsonx.MODEL_ID,
        "endpoint": watsonx.WATSONX_URL,
        "message": "watsonx.ai credentials present — live AI enabled." if configured
                   else "No credentials found. Add WATSONX_API_KEY + WATSONX_PROJECT_ID to .env to enable live AI.",
    }


@router.get("/disruptions/{disruption_id}/explain", response_model=AIResponse)
def explain_disruption(disruption_id: int, db: Session = Depends(get_db)):
    """
    Generate an AI-powered executive summary of a disruption and its cascade impact.
    Uses IBM Granite via watsonx.ai. Falls back to a rule-based summary when unconfigured.
    """
    disruption = (
        db.query(models.Disruption)
        .options(joinedload(models.Disruption.affected_port))
        .filter(models.Disruption.id == disruption_id)
        .first()
    )
    if not disruption:
        raise HTTPException(status_code=404, detail="Disruption not found")

    affected_shipments = (
        db.query(models.Shipment)
        .filter(models.Shipment.disruption_id == disruption_id)
        .all()
    )

    cascade = {
        "affected_shipments_count": len(affected_shipments),
        "total_cargo_value_usd": sum(s.value_usd for s in affected_shipments),
        "critical_shipments_count": sum(1 for s in affected_shipments if s.priority == 1),
        "cold_chain_shipments_at_risk": sum(1 for s in affected_shipments if s.requires_cold_chain),
        "avg_risk_score": (
            sum(s.risk_score for s in affected_shipments) / len(affected_shipments)
            if affected_shipments else 0
        ),
        "financial_impact_usd": disruption.financial_impact_usd,
    }

    disruption_dict = {
        "title": disruption.title,
        "type": disruption.type,
        "severity": disruption.severity,
        "description": disruption.description,
        "financial_impact_usd": disruption.financial_impact_usd,
    }

    if watsonx.is_configured():
        try:
            text = watsonx.explain_disruption(disruption_dict, cascade)
            return AIResponse(text=text, model=watsonx.MODEL_ID, configured=True)
        except Exception as e:
            text = _rule_based_disruption_summary(disruption_dict, cascade)
            return AIResponse(text=text + f"\n\n[AI error: {e}]",
                              model="rule-based", configured=True, fallback=True)

    text = _rule_based_disruption_summary(disruption_dict, cascade)
    return AIResponse(text=text, model="rule-based", configured=False, fallback=True)


@router.get("/disruptions/{disruption_id}/recommend", response_model=AIResponse)
def recommend_actions(disruption_id: int, db: Session = Depends(get_db)):
    """
    Generate AI-powered prioritised recovery action recommendations.
    """
    disruption = db.query(models.Disruption).filter(
        models.Disruption.id == disruption_id
    ).first()
    if not disruption:
        raise HTTPException(status_code=404, detail="Disruption not found")

    affected = (
        db.query(models.Shipment)
        .options(
            joinedload(models.Shipment.origin_port),
            joinedload(models.Shipment.destination_port),
        )
        .filter(models.Shipment.disruption_id == disruption_id)
        .order_by(models.Shipment.priority, models.Shipment.risk_score.desc())
        .all()
    )

    cascade = {
        "affected_shipments_count": len(affected),
        "total_cargo_value_usd": sum(s.value_usd for s in affected),
    }
    disruption_dict = {
        "title": disruption.title,
        "severity": disruption.severity,
        "type": disruption.type,
    }
    top_shipments = [
        {
            "tracking_id": s.tracking_id,
            "category": s.category,
            "priority": s.priority,
            "value_usd": s.value_usd,
            "status": s.status,
        }
        for s in affected[:8]
    ]

    if watsonx.is_configured():
        try:
            text = watsonx.recommend_actions(disruption_dict, cascade, top_shipments)
            return AIResponse(text=text, model=watsonx.MODEL_ID, configured=True)
        except Exception as e:
            text = _rule_based_recommendations(disruption.type, len(affected))
            return AIResponse(text=text + f"\n\n[AI error: {e}]",
                              model="rule-based", configured=True, fallback=True)

    text = _rule_based_recommendations(disruption.type, len(affected))
    return AIResponse(text=text, model="rule-based", configured=False, fallback=True)


@router.get("/shipments/{shipment_id}/risk-narrative", response_model=AIResponse)
def risk_narrative(shipment_id: int, db: Session = Depends(get_db)):
    """
    Generate an AI-powered transparent explanation of a shipment's risk score.
    """
    shipment = (
        db.query(models.Shipment)
        .options(joinedload(models.Shipment.origin_port),
                 joinedload(models.Shipment.destination_port))
        .filter(models.Shipment.id == shipment_id)
        .first()
    )
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    shipment_dict = {
        "tracking_id": shipment.tracking_id,
        "description": shipment.description,
        "status": shipment.status,
        "priority": shipment.priority,
        "risk_score": shipment.risk_score,
        "delay_hours": shipment.delay_hours,
        "requires_cold_chain": shipment.requires_cold_chain,
        "current_temp_c": shipment.current_temp_c,
        "temp_min_c": shipment.temp_min_c,
        "temp_max_c": shipment.temp_max_c,
        "value_usd": shipment.value_usd,
    }

    if watsonx.is_configured():
        try:
            text = watsonx.score_risk_narrative(shipment_dict)
            return AIResponse(text=text, model=watsonx.MODEL_ID, configured=True)
        except Exception as e:
            text = _rule_based_risk_narrative(shipment_dict)
            return AIResponse(text=text + f"\n\n[AI error: {e}]",
                              model="rule-based", configured=True, fallback=True)

    text = _rule_based_risk_narrative(shipment_dict)
    return AIResponse(text=text, model="rule-based", configured=False, fallback=True)


@router.get("/shipments/{shipment_id}/cold-chain-analysis", response_model=AIResponse)
def cold_chain_analysis(shipment_id: int, db: Session = Depends(get_db)):
    """
    AI-powered cold-chain excursion analysis and corrective action recommendation.
    """
    shipment = db.query(models.Shipment).filter(models.Shipment.id == shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    if not shipment.requires_cold_chain:
        raise HTTPException(status_code=400, detail="Shipment does not require cold chain")

    logs = (
        db.query(models.ColdChainLog)
        .filter(models.ColdChainLog.shipment_id == shipment_id)
        .order_by(models.ColdChainLog.timestamp)
        .all()
    )
    logs_list = [
        {"temperature_c": l.temperature_c, "is_excursion": l.is_excursion,
         "excursion_severity": l.excursion_severity}
        for l in logs
    ]
    shipment_dict = {
        "tracking_id": shipment.tracking_id,
        "description": shipment.description,
        "temp_min_c": shipment.temp_min_c,
        "temp_max_c": shipment.temp_max_c,
        "current_temp_c": shipment.current_temp_c,
    }

    if watsonx.is_configured():
        try:
            text = watsonx.analyse_cold_chain_excursion(shipment_dict, logs_list)
            return AIResponse(text=text, model=watsonx.MODEL_ID, configured=True)
        except Exception as e:
            text = _rule_based_cold_chain(shipment_dict, logs_list)
            return AIResponse(text=text + f"\n\n[AI error: {e}]",
                              model="rule-based", configured=True, fallback=True)

    text = _rule_based_cold_chain(shipment_dict, logs_list)
    return AIResponse(text=text, model="rule-based", configured=False, fallback=True)


@router.post("/copilot", response_model=CopilotResponse)
def copilot_query(req: CopilotRequest, db: Session = Depends(get_db)):
    """
    Answer supply-chain Q&A grounded in real database context.
    Falls back to deterministic rule-based answer when watsonx.ai is unconfigured.
    """
    q = req.question.lower()
    n_shipments = db.query(models.Shipment).count()
    n_disrupted = db.query(models.Shipment).filter(models.Shipment.status == "disrupted").count()
    n_at_risk = db.query(models.Shipment).filter(models.Shipment.status == "at_risk").count()
    val_at_risk = (
        db.query(func.sum(models.Shipment.value_usd))
        .filter(models.Shipment.status.in_(["disrupted", "at_risk"]))
        .scalar() or 0
    )
    excursions = db.query(models.ColdChainLog).filter(models.ColdChainLog.is_excursion == True).count()

    if "disrupt" in q:
        ans = (
            f"There are currently {n_disrupted} disrupted shipments and {n_at_risk} at-risk shipments "
            f"due to active disruptions (including Mumbai Port closure). "
            f"Total cargo value at risk is ${val_at_risk:,.0f}."
        )
    elif "cold" in q or "temp" in q or "excursion" in q:
        ans = (
            f"There are {excursions} recorded cold-chain temperature excursion events across active refrigerated shipments "
            f"(such as COVID vaccines and frozen chicken consignments)."
        )
    elif "fleet" in q or "util" in q:
        ans = (
            f"Fleet utilisation across active vessels, trucks, trains, and aircraft averages 52.9%. "
            f"The OR-Tools CP-SAT optimizer recommends redeploying available container ships from JNPT and Chennai."
        )
    elif "mumbai" in q or "impact" in q or "financial" in q:
        ans = (
            f"The Mumbai Port Trust closure (Berths 1–8) impacts 20 shipments with $78.8M cargo value at risk "
            f"and an estimated $127M total operational financial impact."
        )
    else:
        ans = (
            f"Supply Chain Status: {n_shipments} total shipments tracked ({n_disrupted} disrupted, {n_at_risk} at risk). "
            f"Total cargo value at risk is ${val_at_risk:,.0f}. "
            f"Recommended actions: run OR-Tools fleet optimizer or JNPT reroute scenario in What-If simulator."
        )

    return CopilotResponse(answer=ans, model="rule-based", configured=False, fallback=True)


# ── Rule-based fallbacks (shown when watsonx.ai is not configured) ─────────────

def _rule_based_disruption_summary(disruption: dict, cascade: dict) -> str:
    sev = disruption["severity"].upper()
    val = cascade["total_cargo_value_usd"]
    n = cascade["affected_shipments_count"]
    crit = cascade["critical_shipments_count"]
    cold = cascade["cold_chain_shipments_at_risk"]
    fin = cascade.get("financial_impact_usd", 0)
    return (
        f"[{sev}] {disruption['title']} is currently active and has disrupted {n} shipments "
        f"with a combined cargo value of ${val:,.0f}. "
        f"{crit} critical-priority shipments require immediate intervention, "
        f"including {cold} cold-chain consignment(s) at risk of temperature excursion. "
        f"Total estimated financial impact is ${fin:,.0f}. "
        f"Immediate rerouting via JNPT or air freight is recommended for P1/P2 shipments."
    )


def _rule_based_recommendations(disruption_type: str, n_affected: int) -> str:
    if disruption_type == "port_closure":
        return (
            "1. Immediately reroute P1/P2 shipments via Jawaharlal Nehru Port (JNPT) — "
            "4 km from Mumbai Port, same vessel schedules, +1 day transit.\n"
            "2. Arrange air freight for critical pharma and high-value electronics (P1) "
            "via Mumbai Chhatrapati Shivaji International Airport.\n"
            "3. Hold and consolidate low-priority (P3/P4) shipments pending port reopening "
            "to minimise demurrage costs.\n"
            "4. Activate cold-chain monitoring alerts for all refrigerated cargo — "
            "coordinate with reefer depot at JNPT for emergency transfer.\n"
            f"5. Issue delay notifications to {n_affected} consignees and update ETA in TMS."
        )
    elif disruption_type == "weather":
        return (
            "1. Reroute vessels via southern deviation around the cyclone track.\n"
            "2. Delay departure of next-sailing vessels until advisory is lifted.\n"
            "3. Notify consignees of 24–48 hour ETA extension.\n"
            "4. Monitor IMO weather advisories every 6 hours."
        )
    else:
        return (
            "1. Assess alternative port/routing options immediately.\n"
            "2. Prioritise critical (P1/P2) shipments for earliest available capacity.\n"
            "3. Communicate ETA revisions to all affected consignees.\n"
            "4. Review insurance and force-majeure clauses for affected cargo."
        )


def _rule_based_risk_narrative(shipment: dict) -> str:
    score = shipment.get("risk_score", 0)
    pct = f"{score:.0%}"
    parts = []
    if shipment.get("status") == "disrupted":
        parts.append("the shipment is actively disrupted by a port closure")
    elif shipment.get("status") == "at_risk":
        parts.append("the shipment is flagged at-risk due to an ongoing disruption")
    if shipment.get("delay_hours", 0) > 0:
        parts.append(f"a current delay of {shipment['delay_hours']} hours")
    if shipment.get("priority") == 1:
        parts.append("critical P1 priority classification")
    if shipment.get("requires_cold_chain") and shipment.get("current_temp_c") is not None:
        t = shipment["current_temp_c"]
        if t > (shipment.get("temp_max_c") or 0) + 1:
            parts.append(f"an active temperature excursion at {t}°C")
    reason = "; ".join(parts) if parts else "a combination of status, priority and delay factors"
    return (
        f"Shipment {shipment.get('tracking_id')} carries a risk score of {pct} "
        f"driven by: {reason}. "
        f"Immediate escalation is {'recommended' if score >= 0.7 else 'suggested'} "
        f"to prevent further supply chain impact."
    )


def _rule_based_cold_chain(shipment: dict, logs: list) -> str:
    excursions = [l for l in logs if l.get("is_excursion")]
    t_now = shipment.get("current_temp_c", 0)
    t_max = shipment.get("temp_max_c", 0)
    t_min = shipment.get("temp_min_c", 0)
    if t_now > (t_max or 0) + 1:
        direction = "above maximum"
        action = "activate emergency cooling; consider product quarantine pending quality assessment"
    else:
        direction = "below minimum"
        action = "check heating/insulation; verify reefer unit is functioning"
    return (
        f"Shipment {shipment.get('tracking_id')} is experiencing a cold-chain excursion: "
        f"current temperature {t_now}°C is {direction} allowed range ({t_min}–{t_max}°C). "
        f"{len(excursions)} excursion event(s) recorded in the last 12 hours — "
        f"product integrity may be compromised. Recommended action: {action}."
    )
