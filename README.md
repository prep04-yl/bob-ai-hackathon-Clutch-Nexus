# 🚀 Clutch Nexus — Supply Chain Disruption Assistant & Fleet Utilisation Optimizer

---

## 👥 Team

| Field | Value |
|---|---|
| **Team Name** | Clutch Nexus |
| **Track** | AI |
| **Team Lead** | Bhargav Zalariya - 25dce125@charusat.edu.in |
| **Members** | Prey Patel, Himesh Male, Kanan Sharma |

---

## 🎯 Problem Statement

Global supply chain disruptions create cascading network impacts across maritime ports, air hubs, and overland logistics corridors. When unexpected events occur—such as berth fires, severe weather, or port strikes—logistics control-tower operators face fragmented telemetry, making it difficult to rapidly assess stranded cargo ($78.845M value at risk), prevent cold-chain thermal degradation (bio-pharma and perishable food), reduce cascading financial exposure ($127M total impact), and redeploy severely under-utilised transport fleets (averaging 52.9% utilisation).

---

## 💡 Solution

Clutch Nexus is an executive Supply Chain Control Tower that connects disruption events directly to automated operational recovery. Through its core **Impact Cascade Engine**, the platform traces port failures through affected shipments, multi-modal routes, vehicle capacity, cold-chain risks, and financial exposure within milliseconds. It then executes a mathematical optimization model powered by **Google OR-Tools CP-SAT** to redeploy idle fleet capacity, offers real-time IoT cold-chain excursion monitoring, and enables What-If scenario simulations to evaluate delay and cost trade-offs before committing capital.

---

## ✨ Key Features

- **Real-Time Disruption & Impact Cascade Engine:** Traces port closures (e.g. Mumbai Port Trust Berths 1–8 fire DIS-2026-001) down to 20 affected shipments, 8 P1 critical consignments, and $78.845M cargo value at risk.
- **Google OR-Tools CP-SAT Fleet Optimizer:** Dynamically solves capacity, priority, location, and temperature constraints to match idle transport assets (ships, trucks, trains, aircraft) with stranded cargo, converting 52.9% baseline utilisation into active recovery.
- **IoT Cold-Chain Telemetry & Excursion Alerting:** Tracks real-time temperature and humidity curves, triggering instant breach alerts (e.g. shipment SHP-2026-0026 frozen poultry warming to -11.2°C vs -18.0°C threshold).
- **What-If Scenario Simulator:** Allows logistics planners to test 6 recovery scenarios (such as JNPT Port rerouting), providing side-by-side comparison of delay reduction (108h reduced to 36h), recovered shipments (12), cost delta (+$1.2M), and net financial risk reduction (42%).
- **Interactive Multimodal Topology Map:** Leaflet-powered dark visualizer rendering 16 global port nodes, 20 shipping/air lanes, and real-time disruption status markers.
- **Grounded AI Copilot & Transparency:** Features an operational Q&A interface with a deterministic rule-based fallback mechanism that provides instant operational intelligence grounded in live database context when external LLM API keys are unconfigured.

---

## 🛠️ Tech Stack

| Category | Technologies |
|---|---|
| **Languages** | TypeScript, Python (3.11+) |
| **Frameworks** | Next.js 14 (App Router), FastAPI, Tailwind CSS |
| **IBM Technologies** | IBM Bob (AI-assisted development tool) |
| **Databases** | SQLite (dev) via SQLAlchemy ORM, Pydantic v2 |
| **Optimization & Analytics** | Google OR-Tools CP-SAT Solver, Pandas, NumPy |
| **UI & Visualization** | Recharts, Leaflet, Lucide Icons |

---

## 📁 Repository Structure

```
├── src/                  # All source code (Next.js frontend + FastAPI backend)
│   ├── backend/          # FastAPI server, OR-Tools optimizer, SQLAlchemy models & routes
│   └── frontend/         # Next.js 14 App Router UI & Leaflet interactive map
├── docs/                 # Written project documentation
│   ├── problem-statement.md
│   ├── solution-overview.md
│   ├── architecture.md
│   └── setup-guide.md
├── demo/                 # Demo artifacts & live URL references
│   ├── screenshots/      # App UI screenshots
│   ├── live-demo-url.txt # Live deployed app link
│   └── demo-video-link.txt # Hosted video link / local recording reference
├── presentation/         # Slide deck and demo recording scripts
└── submission.yaml       # Structured submission metadata
```

---

## ⚡ How to Run

```bash
# 1. Clone the repository
git clone https://github.com/prep04-yl/bob-ai-hackathon-Clutch-Nexus.git
cd bob-ai-hackathon-Clutch-Nexus

# 2. Start Backend (Terminal 1)
cd src
# On Windows PowerShell:
.\start_backend.ps1
# On Linux / macOS:
bash start_backend.sh

# 3. Start Frontend (Terminal 2)
cd src
# On Windows PowerShell:
.\start_frontend.ps1
# On Linux / macOS:
bash start_frontend.sh

# 4. Access the App
# Frontend: http://localhost:3000
# Backend API Docs: http://localhost:8000/docs
```

---

## 🖥️ Demo

| Artifact | Link |
|---|---|
| 📹 Demo Video | [See demo/demo-video-link.txt](demo/demo-video-link.txt) |
| 🌐 Live Demo | [https://frontend-one-topaz-leaz6x1nu0.vercel.app/](demo/live-demo-url.txt) |
| 🖼️ Screenshots | [See demo/screenshots/](demo/screenshots/) |
| 📊 Presentation | [See presentation/slides.pdf](presentation/) |

---

## ⚠️ Known Limitations

- **Prototype Scope:** Operational metrics are demonstrated using a deterministic synthetic dataset containing 30 shipments, 16 network nodes, and 20 routes based on the Mumbai Port closure scenario.
- **Generative AI Layer:** Integration with Gemini 3.6 Flash and watsonx.ai (Granite 3.0) is fully architected and wired; when cloud API keys (`GEMINI_API_KEY` / `WATSONX_API_KEY`) are unconfigured, the system transparently utilizes a deterministic rule-based fallback response engine.
- **Database Engine:** Uses SQLite for local prototype storage; production deployment would transition to PostgreSQL and Redis for real-time pub/sub telemetry streaming.

---

## 🏅 What We're Most Proud Of

Our end-to-end **Impact Cascade Engine** and **Google OR-Tools CP-SAT fleet optimizer**, which seamlessly bridge the gap between high-level disruption alerts and low-level mathematical fleet recovery. In under one second, logistics dispatchers can transform a major maritime port outage into clear, constrained vehicle redeployment recommendations with verified financial risk reduction.

---

