"""
Gemini AI integration for supply-chain natural language generation.

Uses the google-genai SDK (v2+) with the Gemini 3.6 Flash model.
All AI generation is text-only: explanation, summarisation, and copilot Q&A.
Risk calculations, optimisation, and simulation are NOT done here —
those remain in the deterministic engines (optimiser.py, routes/).

Environment variables:
  GEMINI_API_KEY  — Google AI Studio or Vertex AI key (required for live AI)
  GEMINI_MODEL    — override model name (default: gemini-3.6-flash)
"""
import os
from typing import Optional

# Read env vars as properties so they are always resolved from os.environ at
# call time — never captured once at module import time.  This guarantees that
# load_dotenv() in main.py (which runs before the routes are imported) has
# already populated os.environ by the time these values are first needed.
def _api_key() -> str:
    return os.getenv("GEMINI_API_KEY", "")

def _model() -> str:
    return os.getenv("GEMINI_MODEL", "gemini-3.6-flash")

# Expose GEMINI_MODEL as a module-level name (used in ai.py for the status
# response).  This is intentionally just the default; it does not contain the
# key and is safe to display.
GEMINI_MODEL: str = "gemini-3.6-flash"

# Lazy-initialised client — created on first use, never before.
_client = None


def _get_client():
    """Return (and lazily create) the Gemini client using the current API key."""
    global _client
    key = _api_key()
    # Re-initialise if the key changed (e.g. .env was reloaded in tests).
    if _client is None:
        from google import genai  # type: ignore
        _client = genai.Client(api_key=key)
    return _client


def is_configured() -> bool:
    """Return True only when a real API key is present in the environment."""
    key = _api_key()
    return bool(key and key not in ("your_gemini_api_key_here", "your_api_key_here", ""))


def _generate(prompt: str, max_tokens: int = 500) -> str:
    """
    Call Gemini and return the text response.
    Raises on network/API errors — callers must handle and fall back.
    """
    client = _get_client()
    from google.genai import types  # type: ignore

    response = client.models.generate_content(
        model=_model(),
        contents=prompt,
        config=types.GenerateContentConfig(
            max_output_tokens=max_tokens,
            temperature=0.3,          # low temperature for factual supply-chain text
            stop_sequences=["---"],
        ),
    )
    return (response.text or "").strip()


# ── Prompt builders ────────────────────────────────────────────────────────────
# Each function takes structured data dicts assembled by the route handler and
# returns a string. The route handler is responsible for calling is_configured()
# and deciding whether to call these or fall back to rule-based text.

def explain_disruption(disruption: dict, cascade: dict) -> str:
    """
    Executive summary of a disruption and its cascade impact (3–4 sentences).
    """
    prompt = (
        "You are a senior supply-chain operations analyst. "
        "Write a concise executive summary (3–4 sentences) of the following disruption event. "
        "Be factual, professional, and actionable. Do not invent data.\n\n"
        f"Disruption: {disruption['title']}\n"
        f"Type: {disruption['type']}\n"
        f"Severity: {disruption['severity']}\n"
        f"Description: {disruption['description']}\n\n"
        f"Cascade impact:\n"
        f"  - Shipments affected: {cascade['affected_shipments_count']}\n"
        f"  - Cargo value at risk: ${cascade['total_cargo_value_usd']:,.0f}\n"
        f"  - Critical (P1) shipments: {cascade['critical_shipments_count']}\n"
        f"  - Cold-chain shipments at risk: {cascade['cold_chain_shipments_at_risk']}\n"
        f"  - Average risk score: {cascade['avg_risk_score']:.0%}\n"
        f"  - Estimated financial impact: ${cascade.get('financial_impact_usd', 0):,.0f}\n\n"
        "Executive Summary:"
    )
    return _generate(prompt, max_tokens=220)


def recommend_actions(disruption: dict, cascade: dict, top_shipments: list) -> str:
    """
    Prioritised recovery action recommendations (numbered list, 3–5 items).
    """
    shipment_lines = "\n".join(
        f"  {i+1}. {s['tracking_id']} — {s['category']}, P{s['priority']}, "
        f"${s['value_usd']:,.0f}, status: {s['status']}"
        for i, s in enumerate(top_shipments[:8])
    )
    prompt = (
        "You are a logistics recovery specialist. "
        "Provide 3–5 specific, prioritised recovery actions for the supply-chain disruption below. "
        "Format as a numbered list. Be concise and actionable.\n\n"
        f"Disruption: {disruption['title']} (Severity: {disruption['severity']})\n"
        f"Type: {disruption['type']}\n"
        f"Affected shipments: {cascade['affected_shipments_count']} | "
        f"Value at risk: ${cascade['total_cargo_value_usd']:,.0f}\n\n"
        f"Most critical shipments:\n{shipment_lines}\n\n"
        "Prioritised Recovery Actions:\n1."
    )
    text = _generate(prompt, max_tokens=380)
    # Ensure "1." prefix is present (we appended it in the prompt, model continues from there)
    return "1." + text if not text.startswith("1") else text


def score_risk_narrative(shipment: dict) -> str:
    """
    Transparent 2-sentence explanation of a shipment's risk score.
    """
    factors = []
    if shipment.get("status") in ("disrupted", "at_risk"):
        factors.append(f"status is '{shipment['status']}'")
    if shipment.get("delay_hours", 0) > 0:
        factors.append(f"delayed by {shipment['delay_hours']} hours")
    if shipment.get("requires_cold_chain") and shipment.get("current_temp_c") is not None:
        t = shipment["current_temp_c"]
        t_max = shipment.get("temp_max_c") or 0
        t_min = shipment.get("temp_min_c") or 0
        if t > t_max + 1 or t < t_min - 1:
            factors.append(f"temperature excursion at {t}°C (allowed {t_min}–{t_max}°C)")
    if shipment.get("priority") == 1:
        factors.append("critical P1 priority")
    if shipment.get("value_usd", 0) > 1_000_000:
        factors.append(f"high cargo value (${shipment['value_usd']:,.0f})")
    factors_text = "; ".join(factors) if factors else "standard operational conditions"

    prompt = (
        "You are a supply-chain risk analyst. "
        "In exactly 2 sentences, explain why the following shipment has its current risk score. "
        "Only use the data provided; do not speculate.\n\n"
        f"Shipment: {shipment.get('tracking_id', 'N/A')} — {shipment.get('description', 'goods')}\n"
        f"Risk score: {shipment.get('risk_score', 0):.0%}\n"
        f"Contributing factors: {factors_text}\n\n"
        "Risk explanation:"
    )
    return _generate(prompt, max_tokens=130)


def analyse_cold_chain_excursion(shipment: dict, logs: list) -> str:
    """
    Assess product integrity risk from temperature excursion and recommend immediate actions.
    """
    excursion_logs = [l for l in logs if l.get("is_excursion")]
    temps = [l["temperature_c"] for l in logs[-6:]]
    trend = "rising" if len(temps) > 1 and temps[-1] > temps[0] else "stable or falling"

    prompt = (
        "You are a cold-chain compliance officer. "
        "In 2–3 sentences, assess product integrity risk and recommend immediate corrective actions. "
        "Be specific and urgent. Only use the data provided.\n\n"
        f"Shipment: {shipment.get('tracking_id')} — {shipment.get('description')}\n"
        f"Allowed range: {shipment.get('temp_min_c')}°C to {shipment.get('temp_max_c')}°C\n"
        f"Current temperature: {shipment.get('current_temp_c')}°C\n"
        f"Temperature trend (last 6 readings): {trend}\n"
        f"Excursion events recorded: {len(excursion_logs)}\n"
        f"Recent temperatures (°C): {temps}\n\n"
        "Assessment and recommended actions:"
    )
    return _generate(prompt, max_tokens=200)


def copilot_answer(question: str, context: dict) -> str:
    """
    Supply-chain copilot: answer a free-text question using structured backend data.

    context keys (all optional):
      kpis          — dashboard KPI dict
      disruptions   — list of active disruption dicts
      shipments     — list of shipment dicts (top 15 by risk)
      fleet         — fleet summary dict
      cold_chain    — cold-chain summary dict
    """
    kpis = context.get("kpis", {})
    disruptions = context.get("disruptions", [])
    shipments = context.get("shipments", [])
    fleet = context.get("fleet", {})
    cold = context.get("cold_chain", {})

    # Build a compact context block so the prompt stays within token budget
    dis_lines = "\n".join(
        f"  • {d.get('title')} ({d.get('severity')}, {d.get('shipments_affected')} ships affected, "
        f"${d.get('financial_impact_usd', 0):,.0f} impact)"
        for d in disruptions[:5]
    )
    ship_lines = "\n".join(
        f"  • {s.get('tracking_id')} — {s.get('description')} | "
        f"status: {s.get('status')} | priority: P{s.get('priority')} | "
        f"risk: {s.get('risk_score', 0):.0%} | delay: {s.get('delay_hours', 0)}h"
        for s in shipments[:12]
    )
    fleet_lines = "\n".join(
        f"  • {t}: {v.get('count', 0)} total, {v.get('available', 0)} available, "
        f"avg util {v.get('avg_utilisation', 0)}%"
        for t, v in fleet.items()
    ) if fleet else "  (not loaded)"

    system_ctx = (
        "You are Clutch Nexus — an AI supply-chain operations copilot. "
        "Answer questions using ONLY the structured data provided below. "
        "Be concise, factual, and professional. "
        "If the data does not contain enough information to answer, say so clearly. "
        "Never invent shipment IDs, port names, or figures.\n\n"
        "=== CURRENT OPERATIONS SNAPSHOT ===\n\n"
        f"Dashboard KPIs:\n"
        f"  Total shipments: {kpis.get('total_shipments', 'N/A')}\n"
        f"  Disrupted: {kpis.get('disrupted', 'N/A')} | At risk: {kpis.get('at_risk', 'N/A')}\n"
        f"  In transit: {kpis.get('in_transit', 'N/A')} | Delayed: {kpis.get('delayed', 'N/A')}\n"
        f"  Value at risk: ${kpis.get('total_value_at_risk_usd', 0):,.0f}\n"
        f"  Fleet avg utilisation: {kpis.get('fleet_utilisation_avg_pct', 0)}%\n"
        f"  Cold-chain excursions: {kpis.get('cold_chain_excursions', 0)}\n\n"
        f"Active disruptions ({len(disruptions)}):\n{dis_lines if dis_lines else '  None'}\n\n"
        f"Cold chain: {cold.get('total_cold_chain_shipments', 0)} shipments, "
        f"{cold.get('shipments_in_excursion', 0)} in excursion, "
        f"{cold.get('total_excursion_events', 0)} excursion events\n\n"
        f"Fleet summary:\n{fleet_lines}\n\n"
        f"Top shipments by risk:\n{ship_lines if ship_lines else '  None loaded'}\n\n"
        "=== END SNAPSHOT ===\n\n"
        f"User question: {question}\n\n"
        "Answer:"
    )
    return _generate(system_ctx, max_tokens=450)
