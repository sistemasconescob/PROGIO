from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.routers import auth, users, roles, contracts, clients, vehicles, services, supplies, prefactura, reports, audit
from app.routers.prefactura import env_router
from app.routers import inventory, consulting

# Import models so SQLAlchemy picks them up for migrations
import app.models.inventory  # noqa: F401
import app.models.consulting  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(
    title="PROGIO",
    description="Procesos de Gestión Integrado Online — Sistema de gestión de servicios de lavado de vehículos",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(roles.router)
app.include_router(contracts.router)
app.include_router(clients.router)
app.include_router(vehicles.router)
app.include_router(services.router)
app.include_router(supplies.router)
app.include_router(prefactura.router)
app.include_router(env_router)
app.include_router(reports.router)
app.include_router(audit.router)
app.include_router(inventory.router)
app.include_router(consulting.router)


@app.get("/", tags=["Health"])
async def root():
    return {"status": "ok", "system": "PROGIO", "version": "1.0.0"}


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "healthy"}
