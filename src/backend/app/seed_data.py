"""
Deterministic synthetic supply-chain data seeder.
Mumbai Port closure scenario as main demo.
"""
import random
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app import models

random.seed(42)

# ── Ports ────────────────────────────────────────────────────────────────────
PORTS = [
    # Indian sub-continent
    dict(code="INBOM", name="Mumbai Port Trust", city="Mumbai", country="India",
         lat=18.9220, lng=72.8347, type="sea", capacity_teu=750_000),
    dict(code="INJNP", name="Jawaharlal Nehru Port", city="Navi Mumbai", country="India",
         lat=18.9490, lng=72.9560, type="sea", capacity_teu=5_400_000),
    dict(code="INCCU", name="Kolkata Port", city="Kolkata", country="India",
         lat=22.5726, lng=88.3639, type="sea", capacity_teu=600_000),
    dict(code="INCHP", name="Chennai Port", city="Chennai", country="India",
         lat=13.0827, lng=80.2707, type="sea", capacity_teu=1_500_000),
    dict(code="INDEL", name="Tughlakabad ICD", city="Delhi", country="India",
         lat=28.6139, lng=77.2090, type="rail", capacity_teu=None),
    # Gulf
    dict(code="AEJEA", name="Jebel Ali Port", city="Dubai", country="UAE",
         lat=24.9857, lng=55.0617, type="sea", capacity_teu=19_600_000),
    dict(code="AEAUH", name="Abu Dhabi Port", city="Abu Dhabi", country="UAE",
         lat=24.4539, lng=54.3773, type="sea", capacity_teu=1_800_000),
    # Asia
    dict(code="SGSIN", name="Port of Singapore", city="Singapore", country="Singapore",
         lat=1.2897, lng=103.8501, type="sea", capacity_teu=37_200_000),
    dict(code="CNSHA", name="Port of Shanghai", city="Shanghai", country="China",
         lat=31.2304, lng=121.4737, type="sea", capacity_teu=47_300_000),
    dict(code="HKHKG", name="Port of Hong Kong", city="Hong Kong", country="China",
         lat=22.3193, lng=114.1694, type="sea", capacity_teu=18_300_000),
    # Europe
    dict(code="NLRTM", name="Port of Rotterdam", city="Rotterdam", country="Netherlands",
         lat=51.9225, lng=4.4792, type="sea", capacity_teu=15_300_000),
    dict(code="DEHAM", name="Port of Hamburg", city="Hamburg", country="Germany",
         lat=53.5753, lng=9.9820, type="sea", capacity_teu=9_000_000),
    # Americas
    dict(code="USLAX", name="Port of Los Angeles", city="Los Angeles", country="USA",
         lat=33.7294, lng=-118.2617, type="sea", capacity_teu=9_200_000),
    dict(code="USNYK", name="Port of New York", city="New York", country="USA",
         lat=40.6901, lng=-74.0468, type="sea", capacity_teu=4_800_000),
    # Air hubs (India)
    dict(code="INBOM_AIR", name="Chhatrapati Shivaji Int'l", city="Mumbai", country="India",
         lat=19.0896, lng=72.8656, type="air", capacity_teu=None),
    dict(code="INDEL_AIR", name="Indira Gandhi Int'l", city="Delhi", country="India",
         lat=28.5562, lng=77.1000, type="air", capacity_teu=None),
]

# ── Routes ────────────────────────────────────────────────────────────────────
ROUTES = [
    # Mumbai (INBOM) based
    dict(code="R001", origin="INBOM", dest="AEJEA", dist=1980, days=4, mode="sea", cost=850),
    dict(code="R002", origin="INBOM", dest="SGSIN", dist=3900, days=9, mode="sea", cost=1200),
    dict(code="R003", origin="INBOM", dest="NLRTM", dist=12100, days=22, mode="sea", cost=2200),
    dict(code="R004", origin="INBOM", dest="USLAX", dist=15200, days=28, mode="sea", cost=2800),
    dict(code="R005", origin="INBOM", dest="INCCU", dist=1830, days=5, mode="sea", cost=600),
    # JNPT (alternative to Mumbai)
    dict(code="R006", origin="INJNP", dest="AEJEA", dist=2000, days=4, mode="sea", cost=820),
    dict(code="R007", origin="INJNP", dest="SGSIN", dist=3920, days=9, mode="sea", cost=1180),
    dict(code="R008", origin="INJNP", dest="NLRTM", dist=12150, days=22, mode="sea", cost=2180),
    dict(code="R009", origin="INJNP", dest="USLAX", dist=15250, days=28, mode="sea", cost=2750),
    # Chennai routes
    dict(code="R010", origin="INCHP", dest="SGSIN", dist=3200, days=7, mode="sea", cost=1100),
    dict(code="R011", origin="INCHP", dest="AEJEA", dist=3100, days=7, mode="sea", cost=1050),
    dict(code="R012", origin="INCHP", dest="NLRTM", dist=11800, days=21, mode="sea", cost=2100),
    # Air routes (emergency)
    dict(code="R013", origin="INBOM_AIR", dest="AEJEA", dist=1980, days=1, mode="air", cost=8500),
    dict(code="R014", origin="INDEL_AIR", dest="AEJEA", dist=2250, days=1, mode="air", cost=9000),
    dict(code="R015", origin="INBOM_AIR", dest="NLRTM", dist=7900, days=2, mode="air", cost=15000),
    # Trans-hub
    dict(code="R016", origin="AEJEA", dest="NLRTM", dist=9000, days=16, mode="sea", cost=1400),
    dict(code="R017", origin="SGSIN", dest="CNSHA", dist=3300, days=7, mode="sea", cost=900),
    dict(code="R018", origin="AEJEA", dest="USLAX", dist=18000, days=26, mode="sea", cost=2200),
    # Rail (inland India)
    dict(code="R019", origin="INDEL", dest="INJNP", dist=1400, days=3, mode="rail", cost=400),
    dict(code="R020", origin="INDEL", dest="INCHP", dist=2200, days=4, mode="rail", cost=500),
]

# ── Vehicles ──────────────────────────────────────────────────────────────────
VEHICLES = [
    # Container ships
    dict(code="CS-MUMBAI-01", name="MV Konkan Pride", type="container_ship",
         cap_t=42000, cap_teu=3200, port="INBOM", status="available",
         cold=True, t_min=-25, t_max=25, util=62),
    dict(code="CS-MUMBAI-02", name="MV Sahyadri Star", type="container_ship",
         cap_t=35000, cap_teu=2600, port="INBOM", status="in_transit",
         cold=False, t_min=None, t_max=None, util=88),
    dict(code="CS-JNPT-01", name="MV Gateway Voyager", type="container_ship",
         cap_t=55000, cap_teu=4200, port="INJNP", status="available",
         cold=True, t_min=-18, t_max=25, util=45),
    dict(code="CS-JNPT-02", name="MV Deccan Express", type="container_ship",
         cap_t=48000, cap_teu=3600, port="INJNP", status="available",
         cold=False, t_min=None, t_max=None, util=71),
    dict(code="CS-CHENNAI-01", name="MV Coromandel Carrier", type="container_ship",
         cap_t=38000, cap_teu=2900, port="INCHP", status="available",
         cold=True, t_min=-20, t_max=30, util=55),
    dict(code="CS-DUBAI-01", name="MV Arabian Gulf Star", type="container_ship",
         cap_t=60000, cap_teu=4800, port="AEJEA", status="available",
         cold=False, t_min=None, t_max=None, util=40),
    dict(code="CS-DUBAI-02", name="MV Falaj Express", type="container_ship",
         cap_t=25000, cap_teu=1900, port="AEJEA", status="maintenance",
         cold=True, t_min=-25, t_max=25, util=0),
    dict(code="CS-SG-01", name="MV Singapore Straits", type="container_ship",
         cap_t=70000, cap_teu=5500, port="SGSIN", status="available",
         cold=False, t_min=None, t_max=None, util=33),
    # Trucks (India domestic)
    dict(code="TK-MH-001", name="Truck MH-12-AB-1234", type="truck",
         cap_t=25, cap_teu=None, port="INBOM", status="available",
         cold=True, t_min=2, t_max=8, util=70),
    dict(code="TK-MH-002", name="Truck MH-12-CD-5678", type="truck",
         cap_t=20, cap_teu=None, port="INBOM", status="available",
         cold=False, t_min=None, t_max=None, util=50),
    dict(code="TK-GJ-001", name="Truck GJ-01-XY-9876", type="truck",
         cap_t=25, cap_teu=None, port="INJNP", status="available",
         cold=True, t_min=2, t_max=8, util=60),
    dict(code="TK-TN-001", name="Truck TN-09-EF-3456", type="truck",
         cap_t=22, cap_teu=None, port="INCHP", status="available",
         cold=False, t_min=None, t_max=None, util=45),
    # Rail
    dict(code="TR-KON-01", name="Konkan Railway Block Train 01", type="train",
         cap_t=2200, cap_teu=180, port="INBOM", status="available",
         cold=False, t_min=None, t_max=None, util=55),
    dict(code="TR-KON-02", name="Konkan Railway Block Train 02", type="train",
         cap_t=2200, cap_teu=180, port="INJNP", status="available",
         cold=False, t_min=None, t_max=None, util=40),
    # Air freighters
    dict(code="AF-MUM-01", name="Air Freight B747 MUM-01", type="aircraft",
         cap_t=110, cap_teu=None, port="INBOM_AIR", status="available",
         cold=True, t_min=-20, t_max=25, util=30),
    dict(code="AF-DEL-01", name="Air Freight B777 DEL-01", type="aircraft",
         cap_t=95, cap_teu=None, port="INDEL_AIR", status="available",
         cold=False, t_min=None, t_max=None, util=50),
]

# ── Shipments (30 diverse shipments, many routed through Mumbai) ──────────────
def _dt(days_offset: float, base: datetime) -> datetime:
    return base + timedelta(days=days_offset)

BASE_DATE = datetime(2026, 3, 15, 8, 0, 0)

SHIPMENTS = [
    # Pharma – critical cold-chain
    dict(tid="SHP-2026-0001", desc="Vaccines (COVID booster)", cat="pharma",
         origin="INBOM", dest="NLRTM", weight=8.5, vol=12, value=2_800_000,
         cold=True, t_min=2, t_max=8, temp=4.2,
         status="at_risk", priority=1,
         dep=_dt(-2, BASE_DATE), arr=_dt(20, BASE_DATE), delay=48),
    dict(tid="SHP-2026-0002", desc="Insulin bulk API", cat="pharma",
         origin="INBOM", dest="AEJEA", weight=3.2, vol=5, value=950_000,
         cold=True, t_min=2, t_max=8, temp=7.8,
         status="disrupted", priority=1,
         dep=_dt(-1, BASE_DATE), arr=_dt(3, BASE_DATE), delay=72),
    dict(tid="SHP-2026-0003", desc="Oncology drugs", cat="pharma",
         origin="INBOM", dest="USLAX", weight=2.1, vol=3, value=4_200_000,
         cold=True, t_min=-20, t_max=-15, temp=-18.5,
         status="disrupted", priority=1,
         dep=_dt(1, BASE_DATE), arr=_dt(29, BASE_DATE), delay=96),
    # Automotive
    dict(tid="SHP-2026-0004", desc="Engine components – Toyota", cat="automotive",
         origin="INBOM", dest="NLRTM", weight=180, vol=220, value=1_400_000,
         cold=False, t_min=None, t_max=None, temp=None,
         status="disrupted", priority=2,
         dep=_dt(0, BASE_DATE), arr=_dt(22, BASE_DATE), delay=120),
    dict(tid="SHP-2026-0005", desc="EV battery modules – Tata", cat="automotive",
         origin="INBOM", dest="DEHAM", weight=95, vol=110, value=3_600_000,
         cold=False, t_min=None, t_max=None, temp=None,
         status="at_risk", priority=2,
         dep=_dt(2, BASE_DATE), arr=_dt(24, BASE_DATE), delay=0),
    dict(tid="SHP-2026-0006", desc="Transmission assemblies", cat="automotive",
         origin="INBOM", dest="CNSHA", weight=210, vol=260, value=2_100_000,
         cold=False, t_min=None, t_max=None, temp=None,
         status="disrupted", priority=2,
         dep=_dt(-1, BASE_DATE), arr=_dt(21, BASE_DATE), delay=144),
    # Electronics
    dict(tid="SHP-2026-0007", desc="Semiconductor wafers", cat="electronics",
         origin="INBOM", dest="SGSIN", weight=1.8, vol=2.5, value=8_500_000,
         cold=False, t_min=None, t_max=None, temp=None,
         status="disrupted", priority=1,
         dep=_dt(0, BASE_DATE), arr=_dt(9, BASE_DATE), delay=72),
    dict(tid="SHP-2026-0008", desc="Mobile display panels", cat="electronics",
         origin="INBOM", dest="CNSHA", weight=12, vol=15, value=3_200_000,
         cold=False, t_min=None, t_max=None, temp=None,
         status="at_risk", priority=2,
         dep=_dt(3, BASE_DATE), arr=_dt(24, BASE_DATE), delay=0),
    dict(tid="SHP-2026-0009", desc="PCB assemblies – Foxconn", cat="electronics",
         origin="INBOM", dest="HKHKG", weight=6, vol=8, value=1_800_000,
         cold=False, t_min=None, t_max=None, temp=None,
         status="disrupted", priority=2,
         dep=_dt(-2, BASE_DATE), arr=_dt(18, BASE_DATE), delay=96),
    # Food
    dict(tid="SHP-2026-0010", desc="Basmati rice export", cat="food",
         origin="INBOM", dest="AEJEA", weight=500, vol=650, value=320_000,
         cold=False, t_min=None, t_max=None, temp=None,
         status="delayed", priority=3,
         dep=_dt(1, BASE_DATE), arr=_dt(5, BASE_DATE), delay=36),
    dict(tid="SHP-2026-0011", desc="Frozen seafood (shrimp)", cat="food",
         origin="INBOM", dest="NLRTM", weight=45, vol=55, value=280_000,
         cold=True, t_min=-18, t_max=-12, temp=-15.2,
         status="at_risk", priority=2,
         dep=_dt(0, BASE_DATE), arr=_dt(22, BASE_DATE), delay=48),
    dict(tid="SHP-2026-0012", desc="Mango pulp (canned)", cat="food",
         origin="INBOM", dest="USLAX", weight=120, vol=140, value=185_000,
         cold=False, t_min=None, t_max=None, temp=None,
         status="delayed", priority=4,
         dep=_dt(2, BASE_DATE), arr=_dt(30, BASE_DATE), delay=72),
    # Chemicals
    dict(tid="SHP-2026-0013", desc="Specialty chemicals – pigments", cat="chemicals",
         origin="INBOM", dest="DEHAM", weight=80, vol=95, value=640_000,
         cold=False, t_min=None, t_max=None, temp=None,
         status="disrupted", priority=3,
         dep=_dt(-1, BASE_DATE), arr=_dt(21, BASE_DATE), delay=96),
    dict(tid="SHP-2026-0014", desc="Industrial solvents", cat="chemicals",
         origin="INBOM", dest="SGSIN", weight=200, vol=240, value=420_000,
         cold=False, t_min=None, t_max=None, temp=None,
         status="at_risk", priority=3,
         dep=_dt(1, BASE_DATE), arr=_dt(10, BASE_DATE), delay=0),
    # Via alternative ports (not disrupted)
    dict(tid="SHP-2026-0015", desc="Textile garments – export", cat="textiles",
         origin="INCHP", dest="NLRTM", weight=35, vol=45, value=890_000,
         cold=False, t_min=None, t_max=None, temp=None,
         status="in_transit", priority=3,
         dep=_dt(-3, BASE_DATE), arr=_dt(18, BASE_DATE), delay=0),
    dict(tid="SHP-2026-0016", desc="Yoga apparel", cat="textiles",
         origin="INCHP", dest="USLAX", weight=18, vol=22, value=340_000,
         cold=False, t_min=None, t_max=None, temp=None,
         status="in_transit", priority=4,
         dep=_dt(-5, BASE_DATE), arr=_dt(23, BASE_DATE), delay=0),
    dict(tid="SHP-2026-0017", desc="Steel coils", cat="metals",
         origin="INJNP", dest="AEJEA", weight=800, vol=400, value=560_000,
         cold=False, t_min=None, t_max=None, temp=None,
         status="in_transit", priority=3,
         dep=_dt(-2, BASE_DATE), arr=_dt(2, BASE_DATE), delay=0),
    dict(tid="SHP-2026-0018", desc="Granite slabs", cat="construction",
         origin="INCHP", dest="AEJEA", weight=600, vol=300, value=240_000,
         cold=False, t_min=None, t_max=None, temp=None,
         status="in_transit", priority=4,
         dep=_dt(-1, BASE_DATE), arr=_dt(6, BASE_DATE), delay=0),
    # Already disrupted and rerouted
    dict(tid="SHP-2026-0019", desc="IT hardware – servers", cat="electronics",
         origin="INBOM", dest="NLRTM", weight=8, vol=10, value=5_200_000,
         cold=False, t_min=None, t_max=None, temp=None,
         status="at_risk", priority=1,
         dep=_dt(1, BASE_DATE), arr=_dt(23, BASE_DATE), delay=0),
    dict(tid="SHP-2026-0020", desc="Agro chemicals", cat="chemicals",
         origin="INBOM", dest="HKHKG", weight=75, vol=90, value=380_000,
         cold=False, t_min=None, t_max=None, temp=None,
         status="disrupted", priority=3,
         dep=_dt(0, BASE_DATE), arr=_dt(20, BASE_DATE), delay=120),
    dict(tid="SHP-2026-0021", desc="Luxury watches", cat="luxury",
         origin="INBOM", dest="DEHAM", weight=0.5, vol=1, value=12_000_000,
         cold=False, t_min=None, t_max=None, temp=None,
         status="at_risk", priority=2,
         dep=_dt(2, BASE_DATE), arr=_dt(24, BASE_DATE), delay=0),
    dict(tid="SHP-2026-0022", desc="Ceramic tiles", cat="construction",
         origin="INBOM", dest="AEJEA", weight=450, vol=500, value=210_000,
         cold=False, t_min=None, t_max=None, temp=None,
         status="disrupted", priority=4,
         dep=_dt(-1, BASE_DATE), arr=_dt(3, BASE_DATE), delay=168),
    dict(tid="SHP-2026-0023", desc="Medical devices – MRI parts", cat="medical",
         origin="INBOM", dest="NLRTM", weight=22, vol=28, value=6_800_000,
         cold=False, t_min=None, t_max=None, temp=None,
         status="disrupted", priority=1,
         dep=_dt(0, BASE_DATE), arr=_dt(22, BASE_DATE), delay=96),
    dict(tid="SHP-2026-0024", desc="Processed food – ready meals", cat="food",
         origin="INCHP", dest="SGSIN", weight=90, vol=105, value=195_000,
         cold=True, t_min=2, t_max=6, temp=4.5,
         status="in_transit", priority=3,
         dep=_dt(-3, BASE_DATE), arr=_dt(4, BASE_DATE), delay=0),
    dict(tid="SHP-2026-0025", desc="Cotton bales", cat="textiles",
         origin="INJNP", dest="CNSHA", weight=350, vol=700, value=480_000,
         cold=False, t_min=None, t_max=None, temp=None,
         status="in_transit", priority=4,
         dep=_dt(-4, BASE_DATE), arr=_dt(5, BASE_DATE), delay=0),
    dict(tid="SHP-2026-0026", desc="Frozen chicken", cat="food",
         origin="INBOM", dest="AEJEA", weight=80, vol=90, value=165_000,
         cold=True, t_min=-18, t_max=-12, temp=-10.5,  # ← excursion!
         status="at_risk", priority=2,
         dep=_dt(-1, BASE_DATE), arr=_dt(3, BASE_DATE), delay=36),
    dict(tid="SHP-2026-0027", desc="Rare earth elements", cat="metals",
         origin="INBOM", dest="CNSHA", weight=30, vol=15, value=9_200_000,
         cold=False, t_min=None, t_max=None, temp=None,
         status="disrupted", priority=1,
         dep=_dt(0, BASE_DATE), arr=_dt(21, BASE_DATE), delay=72),
    dict(tid="SHP-2026-0028", desc="Bicycle components", cat="automotive",
         origin="INCHP", dest="USLAX", weight=60, vol=75, value=420_000,
         cold=False, t_min=None, t_max=None, temp=None,
         status="in_transit", priority=4,
         dep=_dt(-6, BASE_DATE), arr=_dt(22, BASE_DATE), delay=0),
    dict(tid="SHP-2026-0029", desc="Defence optics components", cat="defence",
         origin="INBOM", dest="DEHAM", weight=4, vol=5, value=15_000_000,
         cold=False, t_min=None, t_max=None, temp=None,
         status="at_risk", priority=1,
         dep=_dt(1, BASE_DATE), arr=_dt(23, BASE_DATE), delay=0),
    dict(tid="SHP-2026-0030", desc="Spices bulk export", cat="food",
         origin="INBOM", dest="NLRTM", weight=200, vol=250, value=640_000,
         cold=False, t_min=None, t_max=None, temp=None,
         status="delayed", priority=4,
         dep=_dt(0, BASE_DATE), arr=_dt(22, BASE_DATE), delay=60),
]

# ── Disruptions ───────────────────────────────────────────────────────────────
DISRUPTIONS = [
    dict(
        code="DIS-2026-001",
        title="Mumbai Port Trust – Partial Closure (Berths 1-8)",
        description=(
            "Fire in the warehouse complex on the eastern quay has forced closure of Berths 1–8 "
            "at Mumbai Port Trust. All inbound/outbound container operations have been suspended. "
            "JNPT remains operational. Estimated 5–7 day closure pending safety assessment."
        ),
        type="port_closure",
        severity="critical",
        port="INBOM",
        started_at=datetime(2026, 3, 15, 3, 30),
        estimated_end=datetime(2026, 3, 22, 18, 0),
        is_active=True,
        financial_impact_usd=127_000_000,
        shipments_affected=18,
    ),
    dict(
        code="DIS-2026-002",
        title="Arabian Sea Cyclone Advisory – Route R002",
        description=(
            "Cyclone Nilofar intensifying in the Arabian Sea. IMO advisory issued for vessels "
            "on India–Singapore routes. 24–48 hour routing deviation adding 900 nm."
        ),
        type="weather",
        severity="high",
        port=None,
        started_at=datetime(2026, 3, 14, 12, 0),
        estimated_end=datetime(2026, 3, 17, 6, 0),
        is_active=True,
        financial_impact_usd=8_400_000,
        shipments_affected=4,
    ),
    dict(
        code="DIS-2026-003",
        title="Port Workers Strike – Kolkata Port",
        description=(
            "CITU-affiliated dock workers began indefinite strike at Kolkata Port over wage "
            "dispute. All berth operations suspended. Rail connectivity unaffected."
        ),
        type="strike",
        severity="medium",
        port="INCCU",
        started_at=datetime(2026, 3, 13, 0, 0),
        estimated_end=datetime(2026, 3, 20, 0, 0),
        is_active=True,
        financial_impact_usd=3_200_000,
        shipments_affected=2,
    ),
]


def seed_database(db: Session) -> None:
    """Populate SQLite with all synthetic data."""
    # Check if already seeded
    if db.query(models.Port).count() > 0:
        return

    port_map: dict[str, models.Port] = {}
    for p in PORTS:
        port = models.Port(
            code=p["code"], name=p["name"], city=p["city"], country=p["country"],
            lat=p["lat"], lng=p["lng"], type=p["type"],
            capacity_teu=p.get("capacity_teu"),
        )
        db.add(port)
        port_map[p["code"]] = port
    db.flush()

    route_map: dict[str, models.Route] = {}
    for r in ROUTES:
        route = models.Route(
            code=r["code"],
            origin_port_id=port_map[r["origin"]].id,
            destination_port_id=port_map[r["dest"]].id,
            distance_km=r["dist"],
            transit_days=r["days"],
            mode=r["mode"],
            cost_per_unit=r["cost"],
        )
        db.add(route)
        route_map[r["code"]] = route
    db.flush()

    vehicle_map: dict[str, models.Vehicle] = {}
    for v in VEHICLES:
        vehicle = models.Vehicle(
            code=v["code"], name=v["name"], type=v["type"],
            capacity_tonnes=v["cap_t"], capacity_teu=v.get("cap_teu"),
            current_port_id=port_map[v["port"]].id if v["port"] else None,
            status=v["status"],
            has_cold_chain=v["cold"],
            min_temp_c=v.get("t_min"), max_temp_c=v.get("t_max"),
            utilisation_pct=v["util"],
        )
        db.add(vehicle)
        vehicle_map[v["code"]] = vehicle
    db.flush()

    # Disruptions first (shipments reference them)
    disruption_map: dict[str, models.Disruption] = {}
    for d in DISRUPTIONS:
        port_id = port_map[d["port"]].id if d["port"] else None
        dis = models.Disruption(
            code=d["code"], title=d["title"], description=d["description"],
            type=d["type"], severity=d["severity"],
            affected_port_id=port_id,
            started_at=d["started_at"],
            estimated_end=d.get("estimated_end"),
            is_active=d.get("is_active", True),
            financial_impact_usd=d.get("financial_impact_usd", 0),
            shipments_affected=d.get("shipments_affected", 0),
        )
        db.add(dis)
        disruption_map[d["code"]] = dis
    db.flush()

    # Assign routes to shipments based on origin/dest
    def find_route(origin: str, dest: str):
        for r in ROUTES:
            if r["origin"] == origin and r["dest"] == dest:
                return route_map[r["code"]]
        return None

    def find_vehicle(port: str, cold_needed: bool):
        for v in VEHICLES:
            if v["port"] == port and v["status"] == "available":
                if cold_needed and not v["cold"]:
                    continue
                return vehicle_map[v["code"]]
        return None

    mumbai_dis = disruption_map["DIS-2026-001"]
    weather_dis = disruption_map["DIS-2026-002"]

    for s in SHIPMENTS:
        route = find_route(s["origin"], s["dest"])
        vehicle = find_vehicle(s["origin"], s["cold"])
        # Disruption linkage
        dis_id = None
        if s["origin"] == "INBOM" and s["status"] in ("disrupted", "at_risk"):
            dis_id = mumbai_dis.id
        elif s["dest"] == "SGSIN" and s["status"] in ("at_risk",):
            dis_id = weather_dis.id

        # Risk score: severity × priority × delay factor
        base_risk = {"critical": 0.95, "at_risk": 0.75, "delayed": 0.45,
                     "disrupted": 0.90, "in_transit": 0.15, "scheduled": 0.05,
                     "delivered": 0.0}.get(s["status"], 0.3)
        priority_factor = {1: 1.0, 2: 0.8, 3: 0.55, 4: 0.35}.get(s["priority"], 0.55)
        delay_factor = min(s["delay"] / 240.0, 1.0) * 0.3
        cold_factor = 0.15 if s["cold"] and s["temp"] is not None else 0
        if s.get("cold") and s.get("temp") is not None and s.get("t_max") is not None:
            if s["temp"] > s["t_max"] + 1 or s["temp"] < s["t_min"] - 1:
                cold_factor = 0.35
        risk = min(base_risk * 0.6 + priority_factor * 0.25 + delay_factor + cold_factor, 1.0)

        shipment = models.Shipment(
            tracking_id=s["tid"], description=s["desc"], category=s["cat"],
            origin_port_id=port_map[s["origin"]].id,
            destination_port_id=port_map[s["dest"]].id,
            route_id=route.id if route else None,
            vehicle_id=vehicle.id if vehicle else None,
            weight_tonnes=s["weight"], volume_cbm=s["vol"], value_usd=s["value"],
            requires_cold_chain=s["cold"],
            temp_min_c=s.get("t_min"), temp_max_c=s.get("t_max"),
            current_temp_c=s.get("temp"),
            status=s["status"],
            priority=s["priority"],
            scheduled_departure=s["dep"],
            scheduled_arrival=s["arr"],
            actual_departure=s["dep"] if s["status"] in ("in_transit", "delivered") else None,
            estimated_arrival=s["arr"] + timedelta(hours=s["delay"]),
            delay_hours=s["delay"],
            disruption_id=dis_id,
            risk_score=round(risk, 3),
        )
        db.add(shipment)
    db.flush()

    # Cold-chain log entries (excursion for SHP-2026-0026 frozen chicken)
    chicken_ship = db.query(models.Shipment).filter_by(tracking_id="SHP-2026-0026").first()
    vaccine_ship = db.query(models.Shipment).filter_by(tracking_id="SHP-2026-0001").first()
    now = datetime.utcnow()
    cold_logs = []
    if chicken_ship:
        for i in range(12):
            temp = -16.0 + i * 0.5  # warming trend → excursion
            excursion = temp > -12
            cold_logs.append(models.ColdChainLog(
                shipment_id=chicken_ship.id,
                timestamp=now - timedelta(hours=11 - i),
                temperature_c=temp,
                humidity_pct=85,
                is_excursion=excursion,
                excursion_severity="major" if excursion else None,
            ))
    if vaccine_ship:
        for i in range(8):
            temp = 3.5 + random.uniform(-0.3, 0.4)
            cold_logs.append(models.ColdChainLog(
                shipment_id=vaccine_ship.id,
                timestamp=now - timedelta(hours=7 - i),
                temperature_c=round(temp, 2),
                humidity_pct=72,
                is_excursion=False,
            ))
    for log in cold_logs:
        db.add(log)

    db.commit()
