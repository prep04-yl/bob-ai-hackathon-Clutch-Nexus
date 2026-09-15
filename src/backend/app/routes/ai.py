"""
AI route handlers — all generative-AI work is delegated to gemini.py.

Existing endpoints are preserved with identical response shapes so the
frontend requires zero breaking changes.  New endpoint:
  POST /ai/copilot  — free-text supply-chain Q&A with full context injection
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app import models
from app import gemini

router = APIRouter(prefix="/ai", tags=["ai"])


def _model_display() -> str:
    """Return a display name for the current Gemini model (resolved at call time)."""
    return f"Gemini ({gemini._model()})"


# ── Response / request schemas ─────────────────────────────────────────────────

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


# ── Status ─────────────────────────────────────────────────────────────────────

@router.get("/status")
def ai_status():
    """Check whether Gemini credentials are configured."""
    configured = gemini.is_configured()
    model_name = gemini._model()
    return {
        "configured": configured,
        "model": model_name,
        "provider": "Google Gemini",
        "message": (
            f"Gemini API key present — live AI enabled ({model_name})."
            if configured
            else "No GEMINI_API_KEY found. Add it to .env to enable live AI."
        ),
    }


# ── Disruption explain ─────────────────────────────────────────────────────────

@router.get("/disruptions/{disruption_id}/explain", response_model=AIResponse)
def explain_disruption(disruption_id: int, db: Session = Depends(get_db)):
    """
    AI-powered executive summary of a disruption and its cascade impact.
    Falls back to a deterministic rule-based summary when Gemini is unavailable.
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
    cascade = _build_cascade(disruption, affected_shipments)
    disruption_dict = _disruption_to_dict(disruption)

    if gemini.is_configured():
        try:
            text = gemini.explain_disruption(disruption_dict, cascade)
            return AIResponse(text=text, model=_model_display(), configured=True)
        except Exception as exc:
            text = _rule_based_disruption_summary(disruption_dict, cascade)
            return AIResponse(
                text=f"{text}\n\n[Gemini error: {exc}]",
                model="rule-based", configured=True, fallback=True,
            )

    return AIResponse(
        text=_rule_based_disruption_summary(disruption_dict, cascade),
        model="rule-based", configured=False, fallback=True,
    )


# ── Disruption recommend ───────────────────────────────────────────────────────

@router.get("/disruptions/{disruption_id}/recommend", response_model=AIResponse)
def recommend_actions(disruption_id: int, db: Session = Depends(get_db)):
    """
    AI-generated prioritised recovery action recommendations.
    """
    disruption = db.query(models.Disruption).filter(
        models.Disruption.id == disruption_id
    ).first()
    if not disruption:
        raise HTTPException(status_code=404, detail="Disruption not found")

    affected = (
        db.query(models.Shipment)
        .filter(models.Shipment.disruption_id == disruption_id)
        .order_by(models.Shipment.priority, models.Shipment.risk_score.desc())
        .all()
    )
    cascade = {"affected_shipments_count": len(affected),
               "total_cargo_value_usd": sum(s.value_usd for s in affected)}
    disruption_dict = {"title": disruption.title,
                       "severity": disruption.severity,
                       "type": disruption.type}
    top_shipments = [
        {"tracking_id": s.tracking_id, "category": s.category,
         "priority": s.priority, "value_usd": s.value_usd, "status": s.status}
        for s in affected[:8]
    ]

    if gemini.is_configured():
        try:
            text = gemini.recommend_actions(disruption_dict, cascade, top_shipments)
            return AIResponse(text=text, model=_model_display(), configured=True)
        except Exception as exc:
            text = _rule_based_recommendations(disruption.type, len(affected))
            return AIResponse(
                text=f"{text}\n\n[Gemini error: {exc}]",
                model="rule-based", configured=True, fallback=True,
            )

    return AIResponse(
        text=_rule_based_recommendations(disruption.type, len(affected)),
        model="rule-based", configured=False, fallback=True,
    )


# ── Shipment risk narrative ────────────────────────────────────────────────────

@router.get("/shipments/{shipment_id}/risk-narrative", response_model=AIResponse)
def risk_narrative(shipment_id: int, db: Session = Depends(get_db)):
    """
    Transparent explanation of a shipment's risk score.
    """
    shipment = (
        db.query(models.Shipment)
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

    if gemini.is_configured():
        try:
            text = gemini.score_risk_narrative(shipment_dict)
            return AIResponse(text=text, model=_model_display(), configured=True)
        except Exception as exc:
            text = _rule_based_risk_narrative(shipment_dict)
            return AIResponse(
                text=f"{text}\n\n[Gemini error: {exc}]",
                model="rule-based", configured=True, fallback=True,
            )

    return AIResponse(
        text=_rule_based_risk_narrative(shipment_dict),
        model="rule-based", configured=False, fallback=True,
    )


# ── Cold-chain analysis ────────────────────────────────────────────────────────

@router.get("/shipments/{shipment_id}/cold-chain-analysis", response_model=AIResponse)
def cold_chain_analysis(shipment_id: int, db: Session = Depends(get_db)):
    """
    AI-powered cold-chain excursion analysis and corrective action recommendation.
    """
    shipment = db.query(models.Shipment).filter(
        models.Shipment.id == shipment_id
    ).first()
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
        {"temperature_c": l.temperature_c,
         "is_excursion": l.is_excursion,
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

    if gemini.is_configured():
        try:
            text = gemini.analyse_cold_chain_excursion(shipment_dict, logs_list)
            return AIResponse(text=text, model=_model_display(), configured=True)
        except Exception as exc:
            text = _rule_based_cold_chain(shipment_dict, logs_list)
            return AIResponse(
                text=f"{text}\n\n[Gemini error: {exc}]",
                model="rule-based", configured=True, fallback=True,
            )

    return AIResponse(
        text=_rule_based_cold_chain(shipment_dict, logs_list),
        model="rule-based", configured=False, fallback=True,
    )


# ── Supply-chain copilot ───────────────────────────────────────────────────────

@router.post("/copilot", response_model=CopilotResponse)
def copilot(body: CopilotRequest, db: Session = Depends(get_db)):
    """
    Free-text supply-chain Q&A copilot.

    Injects a full operations snapshot (KPIs, disruptions, top shipments by risk,
    fleet summary, cold-chain status) into the Gemini prompt so the model can
    answer questions grounded in live backend data.

    All deterministic calculations (risk scores, fleet optimisation, etc.) remain
    in the existing engines — Gemini only generates the natural-language answer.
    """
    question = body.question.strip()
    if not question:
        raise HTTPException(status_code=422, detail="Question must not be empty")

    context = _build_copilot_context(db)

    if gemini.is_configured():
        try:
            answer = gemini.copilot_answer(question, context)
            return CopilotResponse(answer=answer, model=_model_display(), configured=True)
        except Exception as exc:
            answer = _rule_based_copilot_answer(question, context)
            return CopilotResponse(
                answer=f"{answer}\n\n[Gemini error: {exc}]",
                model="rule-based", configured=True, fallback=True,
            )

    answer = _rule_based_copilot_answer(question, context)
    return CopilotResponse(
        answer=answer, model="rule-based", configured=False, fallback=True,
    )


# ── Context builders ───────────────────────────────────────────────────────────

def _build_cascade(disruption, affected_shipments: list) -> dict:
    return {
        "affected_shipments_count": len(affected_shipments),
        "total_cargo_value_usd": sum(s.value_usd for s in affected_shipments),
        "critical_shipments_count": sum(1 for s in affected_shipments if s.priority == 1),
        "cold_chain_shipments_at_risk": sum(
            1 for s in affected_shipments if s.requires_cold_chain
        ),
        "avg_risk_score": (
            sum(s.risk_score for s in affected_shipments) / len(affected_shipments)
            if affected_shipments else 0.0
        ),
        "financial_impact_usd": disruption.financial_impact_usd,
    }


def _disruption_to_dict(disruption) -> dict:
    return {
        "title": disruption.title,
        "type": disruption.type,
        "severity": disruption.severity,
        "description": disruption.description,
        "financial_impact_usd": disruption.financial_impact_usd,
    }


def _build_copilot_context(db: Session) -> dict:
    """Assemble a compact operations snapshot for the copilot prompt."""
    from app.routes.dashboard import get_kpis

    # KPIs
    kpis_obj = get_kpis(db)
    kpis = kpis_obj.model_dump()

    # Active disruptions
    disruptions_raw = (
        db.query(models.Disruption)
        .filter(models.Disruption.is_active == True)  # noqa: E712
        .all()
    )
    disruptions = [
        {
            "title": d.title,
            "severity": d.severity,
            "type": d.type,
            "shipments_affected": d.shipments_affected,
            "financial_impact_usd": d.financial_impact_usd,
        }
        for d in disruptions_raw
    ]

    # Top shipments by risk score (up to 15)
    top_ships_raw = (
        db.query(models.Shipment)
        .filter(models.Shipment.status.in_(["disrupted", "at_risk", "delayed"]))
        .order_by(models.Shipment.risk_score.desc())
        .limit(15)
        .all()
    )
    shipments = [
        {
            "tracking_id": s.tracking_id,
            "description": s.description,
            "category": s.category,
            "status": s.status,
            "priority": s.priority,
            "risk_score": s.risk_score,
            "delay_hours": s.delay_hours,
            "value_usd": s.value_usd,
            "requires_cold_chain": s.requires_cold_chain,
        }
        for s in top_ships_raw
    ]

    # Fleet summary (reuse existing route logic inline to avoid HTTP round-trip)
    vehicles = db.query(models.Vehicle).all()
    fleet: dict = {}
    for v in vehicles:
        t = v.type
        if t not in fleet:
            fleet[t] = {"count": 0, "available": 0, "avg_utilisation": 0.0,
                        "cold_chain": 0, "_util_sum": 0.0}
        fleet[t]["count"] += 1
        fleet[t]["_util_sum"] += v.utilisation_pct
        if v.status == "available":
            fleet[t]["available"] += 1
        if v.has_cold_chain:
            fleet[t]["cold_chain"] += 1
    for t in fleet:
        n = fleet[t]["count"]
        fleet[t]["avg_utilisation"] = round(fleet[t]["_util_sum"] / n, 1) if n else 0
        del fleet[t]["_util_sum"]

    # Cold-chain summary
    cold_ships = (
        db.query(models.Shipment)
        .filter(models.Shipment.requires_cold_chain == True)  # noqa: E712
        .all()
    )
    in_excursion = sum(
        1 for s in cold_ships
        if s.current_temp_c is not None
        and s.temp_max_c is not None
        and s.temp_min_c is not None
        and (s.current_temp_c > s.temp_max_c + 1 or s.current_temp_c < s.temp_min_c - 1)
    )
    total_excursion_events = (
        db.query(models.ColdChainLog)
        .filter(models.ColdChainLog.is_excursion == True)  # noqa: E712
        .count()
    )
    cold_chain = {
        "total_cold_chain_shipments": len(cold_ships),
        "shipments_in_excursion": in_excursion,
        "total_excursion_events": total_excursion_events,
    }

    return {
        "kpis": kpis,
        "disruptions": disruptions,
        "shipments": shipments,
        "fleet": fleet,
        "cold_chain": cold_chain,
    }


# ── Rule-based fallbacks ───────────────────────────────────────────────────────
# Used when GEMINI_API_KEY is absent or when an API error occurs.
# These produce deterministic, structured text so the UI is never empty.

def _rule_based_disruption_summary(disruption: dict, cascade: dict) -> str:
    sev = disruption["severity"].upper()
    n = cascade["affected_shipments_count"]
    val = cascade["total_cargo_value_usd"]
    crit = cascade["critical_shipments_count"]
    cold = cascade["cold_chain_shipments_at_risk"]
    fin = cascade.get("financial_impact_usd", 0)
    return (
        f"[{sev}] {disruption['title']} is currently active and has disrupted "
        f"{n} shipment(s) with a combined cargo value of ${val:,.0f}. "
        f"{crit} critical-priority shipment(s) require immediate intervention, "
        f"including {cold} cold-chain consignment(s) at excursion risk. "
        f"Total estimated financial impact is ${fin:,.0f}. "
        f"Immediate rerouting via JNPT or air freight is recommended for P1/P2 cargo. "
        f"[Add GEMINI_API_KEY to .env to enable live Gemini analysis.]"
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
            f"5. Issue delay notifications to {n_affected} consignees and update ETA in TMS.\n\n"
            "[Add GEMINI_API_KEY to .env to enable live Gemini recommendations.]"
        )
    elif disruption_type == "weather":
        return (
            "1. Reroute vessels via southern deviation around the cyclone track.\n"
            "2. Delay departure of next-sailing vessels until advisory is lifted.\n"
            "3. Notify consignees of 24–48 hour ETA extension.\n"
            "4. Monitor IMO weather advisories every 6 hours.\n\n"
            "[Add GEMINI_API_KEY to .env to enable live Gemini recommendations.]"
        )
    else:
        return (
            "1. Assess alternative port/routing options immediately.\n"
            "2. Prioritise critical (P1/P2) shipments for earliest available capacity.\n"
            "3. Communicate ETA revisions to all affected consignees.\n"
            "4. Review insurance and force-majeure clauses for affected cargo.\n\n"
            "[Add GEMINI_API_KEY to .env to enable live Gemini recommendations.]"
        )


def _rule_based_risk_narrative(shipment: dict) -> str:
    score = shipment.get("risk_score", 0)
    pct = f"{score:.0%}"
    parts = []
    if shipment.get("status") == "disrupted":
        parts.append("the shipment is actively disrupted")
    elif shipment.get("status") == "at_risk":
        parts.append("it is flagged at-risk due to an ongoing disruption")
    if shipment.get("delay_hours", 0) > 0:
        parts.append(f"a delay of {shipment['delay_hours']} hours")
    if shipment.get("priority") == 1:
        parts.append("critical P1 classification")
    if shipment.get("requires_cold_chain") and shipment.get("current_temp_c") is not None:
        t = shipment["current_temp_c"]
        t_max = shipment.get("temp_max_c") or 0
        if t > t_max + 1:
            parts.append(f"an active temperature excursion at {t}°C")
    reason = "; ".join(parts) if parts else "a combination of status, priority, and delay factors"
    return (
        f"Shipment {shipment.get('tracking_id')} carries a risk score of {pct} driven by: "
        f"{reason}. "
        f"{'Immediate escalation is recommended.' if score >= 0.7 else 'Monitoring is advised.'} "
        f"[Add GEMINI_API_KEY to .env to enable live Gemini analysis.]"
    )


def _rule_based_cold_chain(shipment: dict, logs: list) -> str:
    excursions = [l for l in logs if l.get("is_excursion")]
    t_now = shipment.get("current_temp_c", 0) or 0
    t_max = shipment.get("temp_max_c", 0) or 0
    t_min = shipment.get("temp_min_c", 0) or 0
    if t_now > t_max + 1:
        direction = "above maximum"
        action = "activate emergency cooling; consider product quarantine pending quality assessment"
    else:
        direction = "below minimum"
        action = "check heating/insulation; verify reefer unit is functioning"
    return (
        f"Shipment {shipment.get('tracking_id')} is experiencing a cold-chain excursion: "
        f"current temperature {t_now}°C is {direction} allowed range ({t_min}–{t_max}°C). "
        f"{len(excursions)} excursion event(s) recorded — "
        f"product integrity may be compromised. Recommended: {action}. "
        f"[Add GEMINI_API_KEY to .env to enable live Gemini analysis.]"
    )


def _rule_based_copilot_answer(question: str, context: dict) -> str:
    kpis = context.get("kpis", {})
    disruptions = context.get("disruptions", [])
    cold = context.get("cold_chain", {})
    q_lower = question.lower()

    if any(w in q_lower for w in ("disruption", "disrupted", "closure", "strike")):
        dis_names = ", ".join(d["title"] for d in disruptions[:3]) or "none active"
        return (
            f"There are currently {len(disruptions)} active disruption(s): {dis_names}. "
            f"Total value at risk: ${kpis.get('total_value_at_risk_usd', 0):,.0f}. "
            f"[Add GEMINI_API_KEY to .env to enable live Gemini copilot answers.]"
        )
    if any(w in q_lower for w in ("cold", "temperature", "excursion", "freeze", "reefer")):
        return (
            f"Cold-chain status: {cold.get('total_cold_chain_shipments', 0)} monitored shipments, "
            f"{cold.get('shipments_in_excursion', 0)} currently in excursion, "
            f"{cold.get('total_excursion_events', 0)} total excursion events. "
            f"[Add GEMINI_API_KEY to .env to enable live Gemini copilot answers.]"
        )
    if any(w in q_lower for w in ("fleet", "vehicle", "ship", "truck", "aircraft")):
        return (
            f"Fleet average utilisation is {kpis.get('fleet_utilisation_avg_pct', 0)}%. "
            f"[Add GEMINI_API_KEY to .env to enable live Gemini copilot answers.]"
        )
    # Generic fallback
    return (
        f"Operations snapshot: {kpis.get('total_shipments', 0)} total shipments, "
        f"{kpis.get('disrupted', 0)} disrupted, {kpis.get('at_risk', 0)} at risk, "
        f"${kpis.get('total_value_at_risk_usd', 0):,.0f} value at risk. "
        f"[Add GEMINI_API_KEY to .env to enable live Gemini copilot answers.]"
    )
