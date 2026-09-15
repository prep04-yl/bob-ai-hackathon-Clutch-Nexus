# Solution Overview

## What We Built

**Clutch Nexus** is an executive Supply Chain Control Tower designed to transform chaotic network disruptions into rapid, data-driven operational recovery. The platform connects real-time disruption monitoring directly to automated impact analysis, constraint-based fleet redeployment, cold-chain telemetry monitoring, and scenario simulation.

By replacing slow manual processes with a deterministic **Impact Cascade Engine** and **Google OR-Tools CP-SAT** mathematical solver, Clutch Nexus allows logistics dispatchers and executives to protect stranded cargo, eliminate cold-chain thermal damage, and optimize unallocated fleet capacity within seconds.

---

## How It Works

The platform operates through a closed-loop 5-step operational workflow:

1. **Disruption Ingestion & Node Isolation:** The system continuously monitors network nodes (16 ports and air hubs) and multi-modal routes (20 lanes). When an incident occurs (such as the Mumbai Port Trust warehouse fire, DIS-2026-001), the engine isolates affected network nodes.
2. **Impact Cascade Calculation:** The platform automatically calculates the cascading downstream impact across 30 monitored shipments:
   - `Disruption` (Berths 1–8 closure)
   - `→ Affected Shipments` (20 consignments impacted)
   - `→ Routes & Nodes` (INBOM routes R001–R005 disrupted)
   - `→ Fleet Assets` (idle container ships, trucks, aircraft)
   - `→ Cold-Chain Risk` (thermal integrity of bio-pharma and food)
   - `→ Financial Exposure` ($78.845M cargo value at risk, $127M total network impact)
   - `→ Recovery Action` (solver recommendations).
3. **Mathematical Fleet Optimization:** The **Google OR-Tools CP-SAT** constraint solver evaluates available vehicles against stranded cargo requirements. It optimizes across weight capacity, container volume, origin proximity, cold-chain capability, and shipment priority (P1–P4) to generate concrete vehicle assignment recommendations (e.g. redeploying vessel CS-JNPT-01 from JNPT and chartering air freight AF-MUM-01 for P1 vaccines).
4. **Cold-Chain IoT Telemetry Monitoring:** IoT sensors continuously stream temperature and humidity readings. If a thermal threshold is breached (e.g. shipment SHP-2026-0026 frozen poultry warming to -11.2°C vs -18.0°C target), the system triggers an urgent excursion alert with recommended corrective re-icing/re-routing actions.
5. **What-If Scenario Simulation & Executive Decision:** Executives simulate alternative recovery strategies (e.g., JNPT Port Rerouting vs. Air Freight Charter vs. Direct Storage) to evaluate delay reduction (108h reduced to 36h), cost deltas (+$1.2M), and overall risk reduction (42%) before committing capital.

---

## Architecture Diagram

> See [`architecture.md`](architecture.md) for the detailed architectural blueprint.

```
[IoT Telemetry / Disruption Data] 
               │
               ▼
   ┌──────────────────────┐
   │ Next.js 14 Frontend  │ ── (Leaflet Map & Recharts Dashboard)
   └──────────┬───────────┘
              │ REST API
              ▼
   ┌──────────────────────┐
   │   FastAPI Backend    │
   └──────┬────────┬──────┘
          │        │
          │        ├──► [Google OR-Tools CP-SAT Solver] ──► (Fleet Recommendations)
          │        ├──► [What-If Simulator Engine]      ──► (Scenario Deltas)
          │        └──► [Gemini 3.6 / watsonx AI API]    ──► (NL Copilot / Fallback)
          ▼
   ┌──────────────────────┐
   │ SQLite / SQLAlchemy  │ ── (Deterministic Seeded Network Data)
   └──────────────────────┘
```

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| **Impact Cascade Pipeline Architecture** | Connects root-cause port closures directly to downstream financial and fleet metrics, preventing alert fatigue and giving dispatchers instant situational awareness. |
| **Google OR-Tools CP-SAT Solver** | Enables exact, multi-constraint mathematical fleet matching in < 1 second; includes a graceful greedy heuristic fallback if solver binaries are missing. |
| **Grounded AI with Rule-Based Fallback** | Integrates Gemini 3.6 Flash / watsonx.ai for natural language copilot Q&A while maintaining a 100% deterministic rule-based fallback when live cloud API keys are unconfigured. |
| **Separation of Computation & Intelligence** | Risk calculations, solver math, and simulation deltas run purely in Python deterministic logic—never relying on LLM arithmetic—guaranteeing 100% data fidelity. |

---

## AI & Development Technologies Used

- **IBM Bob:** Used as the primary **AI-assisted development tool** during the hackathon, aiding in rapid full-stack scaffolding, component structuring, and API design.
- **Gemini 3.6 Flash:** Architected as the **generative-AI layer** for natural language disruption explanations, risk score narratives, and copilot Q&A. Because live API keys are currently unconfigured in the local environment, the application transparently serves responses using its **deterministic rule-based intelligence fallback**.
- **watsonx.ai / IBM Granite:** REST API handlers (`watsonx.py`, `routes/ai.py`) are fully scaffolded in the backend for IBM Granite model integration when credentials are added.

