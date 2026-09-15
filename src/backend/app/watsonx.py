"""
watsonx.ai integration using IBM Granite via the watsonx.ai Inference REST API.
No additional SDK needed — uses httpx (already in requirements).
"""
import os
import httpx
from typing import Optional

WATSONX_URL = os.getenv("WATSONX_URL", "https://us-south.ml.cloud.ibm.com")
WATSONX_API_KEY = os.getenv("WATSONX_API_KEY", "")
WATSONX_PROJECT_ID = os.getenv("WATSONX_PROJECT_ID", "")

# Model IDs — Granite is IBM's recommended model for structured reasoning
MODEL_ID = "ibm/granite-3-8b-instruct"

# IAM token cache (simple in-process; fine for prototype)
_iam_token: Optional[str] = None


def _get_iam_token() -> str:
    """Exchange API key for a short-lived IAM bearer token."""
    global _iam_token
    if _iam_token:
        return _iam_token
    resp = httpx.post(
        "https://iam.cloud.ibm.com/identity/token",
        data={
            "grant_type": "urn:ibm:params:oauth:grant-type:apikey",
            "apikey": WATSONX_API_KEY,
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=15,
    )
    resp.raise_for_status()
    _iam_token = resp.json()["access_token"]
    return _iam_token


def _generate(prompt: str, max_tokens: int = 400) -> str:
    """Call watsonx.ai text generation endpoint."""
    token = _get_iam_token()
    payload = {
        "model_id": MODEL_ID,
        "project_id": WATSONX_PROJECT_ID,
        "input": prompt,
        "parameters": {
            "decoding_method": "greedy",
            "max_new_tokens": max_tokens,
            "stop_sequences": ["---"],
            "repetition_penalty": 1.1,
        },
    }
    resp = httpx.post(
        f"{WATSONX_URL}/ml/v1/text/generation?version=2023-05-29",
        json=payload,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        timeout=30,
    )
    resp.raise_for_status()
    results = resp.json().get("results", [{}])
    return results[0].get("generated_text", "").strip()


def is_configured() -> bool:
    """Return True only when real credentials are present."""
    return bool(WATSONX_API_KEY and WATSONX_PROJECT_ID)


# ── Prompt builders ────────────────────────────────────────────────────────────

def explain_disruption(disruption: dict, cascade: dict) -> str:
    """
    Generate a plain-English executive summary of the disruption and its cascade impact.
    """
    prompt = f"""You are a supply chain operations analyst. Write a concise executive summary (3-4 sentences) for the following disruption event. Be factual and professional.

Disruption: {disruption['title']}
Type: {disruption['type']}
Severity: {disruption['severity']}
Description: {disruption['description']}

Impact:
- Shipments affected: {cascade['affected_shipments_count']}
- Cargo value at risk: ${cascade['total_cargo_value_usd']:,.0f}
- Critical shipments: {cascade['critical_shipments_count']}
- Cold-chain shipments at risk: {cascade['cold_chain_shipments_at_risk']}
- Average risk score: {cascade['avg_risk_score']:.0%}
- Financial impact: ${disruption.get('financial_impact_usd', 0):,.0f}

Executive Summary:"""
    return _generate(prompt, max_tokens=200)


def recommend_actions(disruption: dict, cascade: dict, top_shipments: list) -> str:
    """
    Recommend prioritised recovery actions given a disruption context.
    """
    shipment_lines = "\n".join(
        f"  - {s['tracking_id']} ({s['category']}, priority P{s['priority']}, "
        f"value ${s['value_usd']:,.0f}, status: {s['status']})"
        for s in top_shipments[:8]
    )
    prompt = f"""You are a logistics recovery specialist. Based on the supply chain disruption below, provide 3-5 specific, prioritised recovery actions. Format as a numbered list.

Disruption: {disruption['title']} (Severity: {disruption['severity']})
Affected shipments: {cascade['affected_shipments_count']} | Value at risk: ${cascade['total_cargo_value_usd']:,.0f}

Most critical shipments:
{shipment_lines}

Prioritised Recovery Actions:
1."""
    text = _generate(prompt, max_tokens=350)
    # Ensure the "1." we prepended is part of the response
    return "1." + text if not text.startswith("1") else text


def score_risk_narrative(shipment: dict) -> str:
    """
    Generate a transparent explanation of a shipment's risk score.
    """
    factors = []
    if shipment.get("status") in ("disrupted", "at_risk"):
        factors.append(f"status is '{shipment['status']}'")
    if shipment.get("delay_hours", 0) > 0:
        factors.append(f"delayed by {shipment['delay_hours']} hours")
    if shipment.get("requires_cold_chain") and shipment.get("current_temp_c") is not None:
        t = shipment["current_temp_c"]
        t_max = shipment.get("temp_max_c", 0)
        t_min = shipment.get("temp_min_c", 0)
        if t > t_max + 1 or t < t_min - 1:
            factors.append(f"temperature excursion ({t}°C outside {t_min}–{t_max}°C range)")
    if shipment.get("priority", 3) == 1:
        factors.append("classified as critical priority (P1)")
    if shipment.get("value_usd", 0) > 1_000_000:
        factors.append(f"high cargo value (${shipment['value_usd']:,.0f})")

    factors_text = "; ".join(factors) if factors else "standard operational conditions"
    prompt = f"""You are a supply chain risk analyst. In 2 sentences, explain why shipment {shipment.get('tracking_id','N/A')} carrying {shipment.get('description','goods')} has a risk score of {shipment.get('risk_score', 0):.0%}. Key contributing factors: {factors_text}.

Risk explanation:"""
    return _generate(prompt, max_tokens=120)


def analyse_cold_chain_excursion(shipment: dict, logs: list) -> str:
    """
    Analyse a temperature excursion and recommend corrective actions.
    """
    excursion_logs = [l for l in logs if l.get("is_excursion")]
    temps = [l["temperature_c"] for l in logs[-6:]]
    trend = "rising" if len(temps) > 1 and temps[-1] > temps[0] else "stable or falling"
    prompt = f"""You are a cold-chain compliance officer. A shipment has a temperature excursion.

Shipment: {shipment.get('tracking_id')} — {shipment.get('description')}
Required range: {shipment.get('temp_min_c')}°C to {shipment.get('temp_max_c')}°C
Current temperature: {shipment.get('current_temp_c')}°C
Temperature trend: {trend}
Excursion events in last 12h: {len(excursion_logs)}
Recent readings (°C): {temps}

In 2-3 sentences, assess product integrity risk and recommend immediate corrective actions:"""
    return _generate(prompt, max_tokens=180)
