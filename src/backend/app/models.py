from datetime import datetime
from typing import Optional
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey, JSON
)
from sqlalchemy.orm import relationship
from app.database import Base


class Port(Base):
    __tablename__ = "ports"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(10), unique=True, index=True)
    name = Column(String(100))
    city = Column(String(100))
    country = Column(String(100))
    lat = Column(Float)
    lng = Column(Float)
    type = Column(String(20))  # sea, air, rail, road
    capacity_teu = Column(Integer, nullable=True)
    is_active = Column(Boolean, default=True)


class Route(Base):
    __tablename__ = "routes"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), unique=True, index=True)
    origin_port_id = Column(Integer, ForeignKey("ports.id"))
    destination_port_id = Column(Integer, ForeignKey("ports.id"))
    distance_km = Column(Float)
    transit_days = Column(Integer)
    mode = Column(String(20))  # sea, air, rail, road, multimodal
    cost_per_unit = Column(Float)
    is_active = Column(Boolean, default=True)
    origin_port = relationship("Port", foreign_keys=[origin_port_id])
    destination_port = relationship("Port", foreign_keys=[destination_port_id])


class Vehicle(Base):
    __tablename__ = "vehicles"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), unique=True, index=True)
    type = Column(String(30))  # container_ship, truck, train, aircraft
    name = Column(String(100))
    capacity_tonnes = Column(Float)
    capacity_teu = Column(Float, nullable=True)
    current_port_id = Column(Integer, ForeignKey("ports.id"), nullable=True)
    status = Column(String(20))  # available, in_transit, maintenance, stranded
    has_cold_chain = Column(Boolean, default=False)
    min_temp_c = Column(Float, nullable=True)
    max_temp_c = Column(Float, nullable=True)
    utilisation_pct = Column(Float, default=0.0)
    current_port = relationship("Port", foreign_keys=[current_port_id])


class Shipment(Base):
    __tablename__ = "shipments"
    id = Column(Integer, primary_key=True, index=True)
    tracking_id = Column(String(30), unique=True, index=True)
    description = Column(String(200))
    category = Column(String(50))  # pharma, automotive, electronics, food, chemicals
    origin_port_id = Column(Integer, ForeignKey("ports.id"))
    destination_port_id = Column(Integer, ForeignKey("ports.id"))
    route_id = Column(Integer, ForeignKey("routes.id"), nullable=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=True)
    weight_tonnes = Column(Float)
    volume_cbm = Column(Float)
    value_usd = Column(Float)
    requires_cold_chain = Column(Boolean, default=False)
    temp_min_c = Column(Float, nullable=True)
    temp_max_c = Column(Float, nullable=True)
    current_temp_c = Column(Float, nullable=True)
    status = Column(String(30))  # scheduled, in_transit, delayed, at_risk, delivered, disrupted
    priority = Column(Integer, default=3)  # 1=critical, 2=high, 3=medium, 4=low
    scheduled_departure = Column(DateTime)
    scheduled_arrival = Column(DateTime)
    actual_departure = Column(DateTime, nullable=True)
    estimated_arrival = Column(DateTime, nullable=True)
    delay_hours = Column(Float, default=0.0)
    disruption_id = Column(Integer, ForeignKey("disruptions.id"), nullable=True)
    risk_score = Column(Float, default=0.0)
    origin_port = relationship("Port", foreign_keys=[origin_port_id])
    destination_port = relationship("Port", foreign_keys=[destination_port_id])
    route = relationship("Route")
    vehicle = relationship("Vehicle")


class Disruption(Base):
    __tablename__ = "disruptions"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(30), unique=True, index=True)
    title = Column(String(200))
    description = Column(Text)
    type = Column(String(30))  # port_closure, weather, strike, geopolitical, equipment_failure
    severity = Column(String(20))  # low, medium, high, critical
    affected_port_id = Column(Integer, ForeignKey("ports.id"), nullable=True)
    affected_route_ids = Column(JSON, default=list)
    affected_shipment_ids = Column(JSON, default=list)
    started_at = Column(DateTime)
    estimated_end = Column(DateTime, nullable=True)
    actual_end = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    financial_impact_usd = Column(Float, default=0.0)
    shipments_affected = Column(Integer, default=0)
    affected_port = relationship("Port", foreign_keys=[affected_port_id])


class ColdChainLog(Base):
    __tablename__ = "cold_chain_logs"
    id = Column(Integer, primary_key=True, index=True)
    shipment_id = Column(Integer, ForeignKey("shipments.id"))
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    temperature_c = Column(Float)
    humidity_pct = Column(Float, nullable=True)
    location_lat = Column(Float, nullable=True)
    location_lng = Column(Float, nullable=True)
    is_excursion = Column(Boolean, default=False)
    excursion_severity = Column(String(20), nullable=True)  # minor, major, critical
    shipment = relationship("Shipment")


class FleetRecommendation(Base):
    __tablename__ = "fleet_recommendations"
    id = Column(Integer, primary_key=True, index=True)
    disruption_id = Column(Integer, ForeignKey("disruptions.id"))
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"))
    shipment_ids = Column(JSON, default=list)
    from_port_id = Column(Integer, ForeignKey("ports.id"), nullable=True)
    to_port_id = Column(Integer, ForeignKey("ports.id"), nullable=True)
    recommended_route_id = Column(Integer, ForeignKey("routes.id"), nullable=True)
    action = Column(String(50))  # redeploy, reroute, consolidate, hold
    priority_score = Column(Float)
    capacity_match_pct = Column(Float)
    cost_delta_usd = Column(Float)
    time_delta_hours = Column(Float)
    rationale = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    disruption = relationship("Disruption")
    vehicle = relationship("Vehicle")
