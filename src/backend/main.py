# Load .env before importing any app modules so that os.getenv() calls in
# those modules see the populated environment.  override=False means that
# real environment variables (e.g. from a container/CI) are never shadowed.
from dotenv import load_dotenv
load_dotenv(override=False)

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.database import init_db, SessionLocal
from app.seed_data import seed_database
from app.routes import dashboard, shipments, disruptions, fleet, whatif, cold_chain, network, ai


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: init DB and seed
    init_db()
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="Supply Chain Disruption Assistant & Fleet Utilisation Optimizer",
    description="L2 Supply Chain API – Mumbai Port Closure Demo",
    version="1.0.0",
    lifespan=lifespan,
)

# Build CORS origin list.
# FRONTEND_URL env var allows Render to inject the Vercel production URL at
# deploy time without requiring a code change.  Localhost origins are always
# included so local development continues to work without any .env entry.
_extra_origins = [o.strip() for o in os.getenv("FRONTEND_URL", "").split(",") if o.strip()]
_cors_origins = ["http://localhost:3000", "http://127.0.0.1:3000"] + _extra_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(shipments.router, prefix="/api/v1")
app.include_router(disruptions.router, prefix="/api/v1")
app.include_router(fleet.router, prefix="/api/v1")
app.include_router(whatif.router, prefix="/api/v1")
app.include_router(cold_chain.router, prefix="/api/v1")
app.include_router(network.router, prefix="/api/v1")
app.include_router(ai.router, prefix="/api/v1")


@app.get("/")
def root():
    return {
        "service": "Supply Chain Disruption Assistant",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health")
def health():
    return {"status": "ok"}
