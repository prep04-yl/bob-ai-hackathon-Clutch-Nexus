from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, ConfigDict


# ── Port ──────────────────────────────────────────────────────────────────────
class PortOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str
    name: str
    city: str
    country: str
    lat: float
    lng: float
    type: str
    capacity_teu: Optional[int]
    is_active: bool


# ── Route ─────────────────────────────────────────────────────────────────────
class RouteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str
    origin_port_id: int
    destination_port_id: int
    distance_km: float
    transit_days: int
    mode: str
    cost_per_unit: float
    is_active: bool
    origin_port: Optional[PortOut] = None
    destination_port: Optional[PortOut] = None


# ── Vehicle ───────────────────────────────────────────────────────────────────
class VehicleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str
    type: str
    name: str
    capacity_tonnes: float
    capacity_teu: Optional[float]
    current_port_id: Optional[int]
    status: str
    has_cold_chain: bool
    min_temp_c: Optional[float]
    max_temp_c: Optional[float]
    utilisation_pct: float
    current_port: Optional[PortOut] = None


# ── Disruption ────────────────────────────────────────────────────────────────
class DisruptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str
    title: str
    description: str
    type: str
    severity: str
    affected_port_id: Optional[int]
    affected_route_ids: List[Any]
    affected_shipment_ids: List[Any]
    started_at: datetime
    estimated_end: Optional[datetime]
    is_active: bool
    financial_impact_usd: float
    shipments_affected: int
    affected_port: Optional[PortOut] = None


# ── Shipment ──────────────────────────────────────────────────────────────────
class ShipmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    tracking_id: str
    description: str
    category: str
    origin_port_id: int
    destination_port_id: int
    route_id: Optional[int]
    vehicle_id: Optional[int]
    weight_tonnes: float
    volume_cbm: float
    value_usd: float
    requires_cold_chain: bool
    temp_min_c: Optional[float]
    temp_max_c: Optional[float]
    current_temp_c: Optional[float]
    status: str
    priority: int
    scheduled_departure: datetime
    scheduled_arrival: datetime
    actual_departure: Optional[datetime]
    estimated_arrival: Optional[datetime]
    delay_hours: float
    disruption_id: Optional[int]
    risk_score: float
    origin_port: Optional[PortOut] = None
    destination_port: Optional[PortOut] = None
    route: Optional[RouteOut] = None
    vehicle: Optional[VehicleOut] = None


# ── ColdChainLog ──────────────────────────────────────────────────────────────
class ColdChainLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    shipment_id: int
    vehicle_id: Optional[int]
    timestamp: datetime
    temperature_c: float
    humidity_pct: Optional[float]
    location_lat: Optional[float]
    location_lng: Optional[float]
    is_excursion: bool
    excursion_severity: Optional[str]


# ── FleetRecommendation ───────────────────────────────────────────────────────
class FleetRecommendationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    disruption_id: int
    vehicle_id: int
    shipment_ids: List[Any]
    from_port_id: Optional[int]
    to_port_id: Optional[int]
    recommended_route_id: Optional[int]
    action: str
    priority_score: float
    capacity_match_pct: float
    cost_delta_usd: float
    time_delta_hours: float
    rationale: str
    created_at: datetime
    vehicle: Optional[VehicleOut] = None


# ── Dashboard KPIs ────────────────────────────────────────────────────────────
class DashboardKPIs(BaseModel):
    total_shipments: int
    disrupted: int
    at_risk: int
    in_transit: int
    delivered: int
    delayed: int
    total_value_at_risk_usd: float
    active_disruptions: int
    fleet_utilisation_avg_pct: float
    cold_chain_excursions: int
    top_disruption: Optional[str]


# ── What-If ───────────────────────────────────────────────────────────────────
class WhatIfScenario(BaseModel):
    disruption_id: int
    reroute_to_port: Optional[str] = None
    use_air_freight: bool = False
    split_shipments: bool = False
    delay_non_critical: bool = False


class WhatIfResult(BaseModel):
    scenario_name: str
    total_cost_delta_usd: float
    avg_delay_hours: float
    shipments_recovered: int
    risk_reduction_pct: float
    recommendations: List[dict]


# ── Fleet Optimisation ────────────────────────────────────────────────────────
class OptimiseRequest(BaseModel):
    disruption_id: int
    objective: str = "minimize_delay"  # minimize_delay | minimize_cost | balance
