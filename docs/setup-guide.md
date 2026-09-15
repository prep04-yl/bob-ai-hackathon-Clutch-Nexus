# Setup Guide

> **This file is read by the automated evaluation pipeline. Be precise and complete.**

## Prerequisites

Before you begin, ensure you have the following installed on your machine:

- [x] Python 3.11+ (with `pip`)
- [x] Node.js 18+ (with `npm`)
- [x] Git
- [x] Web browser (Google Chrome, Microsoft Edge, or Mozilla Firefox)

---

## Environment Variables

Copy `src/.env.example` to `src/backend/.env` (or `src/.env`) if configuring optional cloud API keys:

```bash
cp src/.env.example src/.env
```

| Variable | Description | Required | Default / Fallback Behavior |
|---|---|---|---|
| `GEMINI_API_KEY` | Google Gemini AI Studio API key | No | Uses deterministic rule-based response engine if unconfigured |
| `GEMINI_MODEL` | Override Gemini model name | No | `gemini-3.6-flash` |
| `WATSONX_API_KEY` | IBM watsonx.ai API key | No | Uses deterministic rule-based response engine if unconfigured |
| `WATSONX_PROJECT_ID` | IBM watsonx.ai project ID | No | Uses deterministic rule-based response engine if unconfigured |
| `WATSONX_URL` | IBM Cloud region endpoint | No | `https://us-south.ml.cloud.ibm.com` |
| `DATABASE_URL` | SQLite database URI | No | `sqlite:///./supply_chain.db` |

> ℹ️ **Note:** All core functions (Impact Cascade, OR-Tools CP-SAT fleet solver, Cold Chain excursion monitor, What-If simulator, topology map) operate 100% locally with zero external API credentials required.

---

## Installation

```bash
# 1. Clone the repository
git clone https://github.com/prep04-yl/bob-ai-hackathon-Clutch-Nexus.git
cd bob-ai-hackathon-Clutch-Nexus

# 2. Install backend dependencies
cd src/backend
pip install -r requirements.txt

# 3. Install frontend dependencies
cd ../frontend
npm install
```

---

## Running the Application

### Method A: Automated Helper Scripts

**On Windows (PowerShell):**
```powershell
# Open Terminal 1 (Backend):
cd src
.\start_backend.ps1

# Open Terminal 2 (Frontend):
cd src
.\start_frontend.ps1
```

**On Linux / macOS (Bash):**
```bash
# Open Terminal 1 (Backend):
cd src
bash start_backend.sh

# Open Terminal 2 (Frontend):
cd src
bash start_frontend.sh
```

### Method B: Manual Command Line Execution

**Terminal 1 — FastAPI Backend:**
```bash
cd src/backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
- API Base URL: `http://localhost:8000`
- Interactive Swagger Docs: `http://localhost:8000/docs`
- ReDoc Docs: `http://localhost:8000/redoc`

**Terminal 2 — Next.js Frontend:**
```bash
cd src/frontend
npm run dev
```
- Application Web UI: `http://localhost:3000`

---

## Running Tests

Execute backend test suite via `pytest`:

```bash
cd src/backend
pytest app/tests/ -v
```

---

## Quick Demo

The backend automatically creates and seeds the SQLite database (`supply_chain.db`) with the full Mumbai Port closure scenario on initial startup:

```bash
# Verify backend data seeding:
curl http://localhost:8000/api/v1/dashboard/kpis
```

Access the live interface at `http://localhost:3000` or inspect deployed production demo at `https://frontend-one-topaz-leaz6x1nu0.vercel.app/`.

---

## Troubleshooting

| Issue | Cause | Solution |
|---|---|---|
| `ModuleNotFoundError: No module named 'fastapi'` | Virtual environment not active or dependencies missing | Run `pip install -r src/backend/requirements.txt` |
| `ortools` solver fallback warning | Python version or OS binary mismatch for OR-Tools | App gracefully uses built-in greedy heuristic solver (`optimiser.py`). To enable full CP-SAT, ensure Python 3.11+ and run `pip install ortools`. |
| Port 8000 or 3000 already in use | Another process running on standard dev ports | Free the port or specify custom port: `uvicorn app.main:app --port 8001` or `npm run dev -- -p 3001`. |
| Map tiles fail to render | Offline or restricted internet connection | Ensure internet connectivity for OpenStreetMap / CartoDB dark tiles in Leaflet. |
| AI Copilot returns `[Demo mode]` notice | Cloud AI API keys unconfigured in `.env` | Expected behavior! The system transparently uses its deterministic rule-based intelligence engine. |

