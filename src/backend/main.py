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

import os

cors_origins_env = os.getenv("CORS_ORIGINS", "*")
allowed_origins = [o.strip() for o in cors_origins_env.split(",") if o.strip()]
if "*" in allowed_origins or not allowed_origins:
    allowed_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
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
