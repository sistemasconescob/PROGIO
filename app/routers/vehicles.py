from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.vehicle import Vehicle, VehicleContractConfig
from app.models.user import User
from app.schemas.vehicle import VehicleCreate, VehicleUpdate, VehicleResponse, VehicleContractConfigCreate, VehicleContractConfigResponse
from app.core.audit_logger import log_action
from app.dependencies import require_permission

router = APIRouter(prefix="/vehicles", tags=["Vehículos"])


@router.post("", response_model=VehicleResponse, status_code=status.HTTP_201_CREATED, summary="Registrar vehículo")
async def create_vehicle(
    body: VehicleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("vehicle:create")),
):
    existing = await db.execute(select(Vehicle).where(Vehicle.plate == body.plate.upper()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Placa ya registrada")
    vehicle = Vehicle(**{**body.model_dump(), "plate": body.plate.upper()})
    db.add(vehicle)
    await db.flush()
    await log_action(db, "vehicle_created", "vehicle", str(vehicle.id), user_id=current_user.id)
    return vehicle


@router.get("", response_model=List[VehicleResponse], summary="Listar vehículos")
async def list_vehicles(
    q: Optional[str] = Query(None, description="Buscar por placa o marca"),
    fleet_id: Optional[UUID] = None,
    client_id: Optional[UUID] = None,
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("vehicle:read")),
):
    query = select(Vehicle)
    if active_only:
        query = query.where(Vehicle.is_active == True)
    if q:
        query = query.where(Vehicle.plate.ilike(f"%{q}%") | Vehicle.brand.ilike(f"%{q}%"))
    if fleet_id:
        query = query.where(Vehicle.fleet_id == fleet_id)
    if client_id:
        query = query.where(Vehicle.client_id == client_id)
    result = await db.execute(query.order_by(Vehicle.plate))
    return result.scalars().all()


@router.get("/{vehicle_id}", response_model=VehicleResponse, summary="Obtener vehículo")
async def get_vehicle(
    vehicle_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("vehicle:read")),
):
    result = await db.execute(select(Vehicle).where(Vehicle.id == vehicle_id))
    vehicle = result.scalar_one_or_none()
    if not vehicle:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehículo no encontrado")
    return vehicle


@router.put("/{vehicle_id}", response_model=VehicleResponse, summary="Actualizar vehículo")
async def update_vehicle(
    vehicle_id: UUID,
    body: VehicleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("vehicle:update")),
):
    result = await db.execute(select(Vehicle).where(Vehicle.id == vehicle_id))
    vehicle = result.scalar_one_or_none()
    if not vehicle:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehículo no encontrado")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(vehicle, field, val)
    await log_action(db, "vehicle_updated", "vehicle", str(vehicle_id), user_id=current_user.id)
    return vehicle


@router.post("/contract-config", response_model=VehicleContractConfigResponse, status_code=status.HTTP_201_CREATED, summary="Configurar límite de servicios por contrato")
async def configure_vehicle_contract(
    body: VehicleContractConfigCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("vehicle:config")),
):
    existing = await db.execute(
        select(VehicleContractConfig).where(
            VehicleContractConfig.vehicle_id == body.vehicle_id,
            VehicleContractConfig.contract_id == body.contract_id,
        )
    )
    config = existing.scalar_one_or_none()
    if config:
        config.max_services_per_period = body.max_services_per_period
        config.period_type = body.period_type
        config.is_active = True
    else:
        config = VehicleContractConfig(**body.model_dump())
        db.add(config)
    await db.flush()
    await log_action(db, "vehicle_contract_config_set", "vehicle_contract_config", str(config.id), user_id=current_user.id)
    return config


@router.get("/{vehicle_id}/contract-configs", response_model=List[VehicleContractConfigResponse], summary="Configuraciones por contrato del vehículo")
async def list_vehicle_configs(
    vehicle_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("vehicle:read")),
):
    result = await db.execute(
        select(VehicleContractConfig).where(VehicleContractConfig.vehicle_id == vehicle_id)
    )
    return result.scalars().all()
