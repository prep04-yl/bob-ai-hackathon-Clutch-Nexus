# Clutch Nexus – L2 Supply Chain Disruption Assistant & Fleet Utilisation Optimizer

> **IBM Bob Hackathon 2026** — Demo scenario: Mumbai Port Trust partial closure (Berths 1–8)

## Overview

A full-stack prototype that combines real-time supply chain disruption monitoring, impact cascade analysis, OR-Tools fleet redeployment optimization, cold-chain temperature excursion detection, and a what-if scenario simulator.

## Architecture

```
src/
├── backend/                  ← FastAPI + Python 3.11+
│   ├── app/
│   │   ├── models.py         ← SQLAlchemy ORM models
│   │   ├── schemas.py        ← Pydantic request/response models
│   │   ├── database.py       ← SQLite engine + session
│   │   ├── seed_data.py      ← Deterministic synthetic data (Mumbai scenario)
│   │   ├── optimiser.py      ← OR-Tools CP-SAT fleet optimizer
│   │   └── routes/           ← API route handlers
│   │       ├── dashboard.py  ← KPIs, charts data
│   │       ├── shipments.py  ← Shipment CRUD + cold-chain logs
│   │       ├── disruptions.py← Disruption list + impact cascade
│   │       ├── fleet.py      ← Fleet management + optimisation
│   │       ├── cold_chain.py ← Temperature excursion tracking
│   │       ├── whatif.py     ← Scenario comparison
│   │       └── network.py    ← Ports, routes, topology
│   ├── main.py               ← FastAPI app + CORS + startup
│   └── requirements.txt
│
├── frontend/                 ← Next.js 14 + TypeScript + Tailwind
│   └── src/
│       ├── app/              ← Next.js App Router pages
│       │   ├── page.tsx      ← Dashboard
│       │   ├── shipments/    ← Shipment table + detail
│       │   ├── disruptions/  ← Disruption list + cascade
│       │   ├── fleet/        ← Fleet + OR-Tools results
│       │   ├── cold-chain/   ← Temperature monitor
│       │   ├── whatif/       ← Scenario simulator
│       │   └── network/      ← Leaflet map + port table
│       ├── components/       ← Reusable UI components
│       │   ├── Sidebar.tsx
│       │   ├── KPICard.tsx
│       │   ├── ShipmentTable.tsx
│       │   ├── NetworkMap.tsx
│       │   └── MapInner.tsx
│       └── lib/
│           ├── api.ts        ← Axios client + TypeScript types
│           └── utils.ts      ← Formatters, color helpers
│
├── start_backend.sh / .ps1   ← Backend startup scripts
└── start_frontend.sh / .ps1  ← Frontend startup scripts
```

## Quick Start

### Prerequisites
- Python 3.11+ with `pip`
- Node.js 18+ with `npm`

### Backend

**Linux/macOS:**
```bash
cd src
bash start_backend.sh
```

**Windows (PowerShell):**
```powershell
cd src
.\start_backend.ps1
```

The backend auto-creates `supply_chain.db` and seeds all synthetic data on first run.

- API base: `http://localhost:8000`
- Swagger docs: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### Frontend

In a **second terminal:**

**Linux/macOS:**
```bash
cd src
bash start_frontend.sh
```

**Windows (PowerShell):**
```powershell
cd src
.\start_frontend.ps1
```

App: `http://localhost:3000`

## Features

| View | Description |
|------|-------------|
| **Dashboard** | KPI cards, status donut, risk histogram, fleet utilisation bar, category value bar, active disruptions |
| **Shipments** | Searchable/filterable table of 30 shipments with detail panel showing cold-chain info |
| **Disruptions** | Impact cascade: disruption → shipments → routes → vehicles → risk metrics |
| **Fleet** | Vehicle registry, utilisation charts, OR-Tools CP-SAT redeployment recommendations |
| **Cold Chain** | Temperature telemetry chart with excursion overlay, per-shipment excursion log |
| **What-If** | 6 recovery scenarios, side-by-side comparison, per-shipment action table |
| **Network** | Leaflet map (dark tile, port markers, coloured route polylines) + port/route tables |

## Demo Scenario: Mumbai Port Closure

The main scenario simulates a warehouse fire at Mumbai Port Trust closing Berths 1–8:
- **18 shipments affected** across pharma, automotive, electronics, food, chemicals
- **$127M financial impact** estimated
- Critical cold-chain shipments (vaccines, oncology drugs, frozen foods) at risk
- 3 active disruptions including Arabian Sea cyclone and Kolkata port strike
- OR-Tools optimizer recommends rerouting via JNPT, Chennai, and air freight

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, Recharts, Leaflet |
| Backend | FastAPI, Python 3.11, Uvicorn |
| Database | SQLite (dev) via SQLAlchemy ORM |
| Validation | Pydantic v2 |
| Optimisation | Google OR-Tools CP-SAT solver |
| Data | Pandas, NumPy (available for extensions) |

## watsonx.ai Integration (Future)

The backend is architected for easy watsonx.ai integration:
- Add `POST /api/v1/ai/explain-disruption` using IBM Granite for NL explanations
- Add `POST /api/v1/ai/recommend-action` for LLM-backed recommendations
- Environment variables `WATSONX_API_KEY`, `WATSONX_PROJECT_ID`, `WATSONX_URL` are pre-configured in `.env.example`
