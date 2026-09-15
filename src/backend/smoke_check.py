"""Quick smoke-check script -- runs via TestClient, no live server needed."""
import sys
sys.stdout.reconfigure(encoding='utf-8')
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from contextlib import asynccontextmanager
from app.database import Base, get_db
from app import models
from app.seed_data import seed_database

eng = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
Sess = sessionmaker(bind=eng)
Base.metadata.create_all(bind=eng)
db = Sess(); seed_database(db); db.close()

def _db():
    s = Sess()
    try: yield s
    finally: s.close()

@asynccontextmanager
async def noop(app): yield

import main
main.app.router.lifespan_context = noop
main.app.dependency_overrides[get_db] = _db

with TestClient(main.app) as c:
    kpis = c.get("/api/v1/dashboard/kpis").json()
    print(f"Total shipments:       {kpis['total_shipments']}")
    print(f"Active disruptions:    {kpis['active_disruptions']}")
    print(f"Disrupted:             {kpis['disrupted']}")
    print(f"At risk:               {kpis['at_risk']}")
    print(f"Value at risk:         ${kpis['total_value_at_risk_usd']:,.0f}")
    print(f"Fleet avg util:        {kpis['fleet_utilisation_avg_pct']}%")
    print(f"Cold-chain excursions: {kpis['cold_chain_excursions']}")
    print()

    cc = c.get("/api/v1/cold-chain/summary").json()
    print(f"Cold-chain total:      {cc['total_cold_chain_shipments']}")
    print(f"In excursion:          {cc['shipments_in_excursion']}")
    print(f"Excursion events:      {cc['total_excursion_events']}")
    print()

    dis = [d for d in c.get("/api/v1/disruptions/").json() if d["is_active"]]
    print(f"Active disruptions:    {len(dis)}")
    print(f"  Top: {dis[0]['title'] if dis else 'none'}")
    print()

    opt = c.post("/api/v1/fleet/optimise", json={"disruption_id": dis[0]["id"], "objective": "minimize_delay"})
    recs = opt.json()
    print(f"Fleet recommendations: {len(recs)} vehicle(s) assigned")
    if recs:
        r = recs[0]
        print(f"  Vehicle ID: {r['vehicle_id']}, Shipments: {r['shipment_ids']}")
        print(f"  Rationale: {r['rationale'][:100]}...")

    print()
    topo = c.get("/api/v1/network/topology").json()
    print(f"Network topology:      {len(topo['nodes'])} nodes, {len(topo['edges'])} edges")
    disrupted_nodes = [n for n in topo["nodes"] if n["is_disrupted"]]
    print(f"Disrupted ports:       {[n['code'] for n in disrupted_nodes]}")

    print()
    print("ALL CHECKS PASSED")
