from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.supply import Supply, ServiceSupplyUsage
from app.models.service import Service, ServiceStatus, ServiceEvent, EventType
from app.models.user import User
from app.schemas.supply import SupplyCreate, SupplyUpdate, SupplyResponse, SupplyUsageCreate, SupplyUsageResponse
from app.core.audit_logger import log_action
from app.dependencies import require_permission

router = APIRouter(prefix="/supplies", tags=["Insumos"])


@router.post("", response_model=SupplyResponse, status_code=status.HTTP_201_CREATED, summary="Crear insumo")
async def create_supply(
    body: SupplyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("supply:create")),
):
    supply = Supply(**body.model_dump())
    db.add(supply)
    await db.flush()
    await log_action(db, "supply_created", "supply", str(supply.id), user_id=current_user.id)
    return supply


@router.get("", response_model=List[SupplyResponse], summary="Listar insumos")
async def list_supplies(
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("supply:read")),
):
    query = select(Supply)
    if active_only:
        query = query.where(Supply.is_active == True)
    result = await db.execute(query.order_by(Supply.name))
    return result.scalars().all()


@router.get("/{supply_id}", response_model=SupplyResponse, summary="Obtener insumo")
async def get_supply(
    supply_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("supply:read")),
):
    result = await db.execute(select(Supply).where(Supply.id == supply_id))
    supply = result.scalar_one_or_none()
    if not supply:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Insumo no encontrado")
    return supply


@router.put("/{supply_id}", response_model=SupplyResponse, summary="Actualizar insumo")
async def update_supply(
    supply_id: UUID,
    body: SupplyUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("supply:update")),
):
    result = await db.execute(select(Supply).where(Supply.id == supply_id))
    supply = result.scalar_one_or_none()
    if not supply:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Insumo no encontrado")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(supply, field, val)
    await log_action(db, "supply_updated", "supply", str(supply_id), user_id=current_user.id)
    return supply


@router.post("/usage", response_model=SupplyUsageResponse, status_code=status.HTTP_201_CREATED, summary="Registrar uso de insumo en servicio")
async def register_usage(
    body: SupplyUsageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("supply:use")),
):
    svc_result = await db.execute(select(Service).where(Service.id == body.service_id))
    svc = svc_result.scalar_one_or_none()
    if not svc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Servicio no encontrado")
    if svc.status not in (ServiceStatus.IN_PROCESS, ServiceStatus.ON_HOLD):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El servicio no está activo")

    supply_result = await db.execute(select(Supply).where(Supply.id == body.supply_id, Supply.is_active == True))
    supply = supply_result.scalar_one_or_none()
    if not supply:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Insumo no encontrado o inactivo")

    event = ServiceEvent(
        service_id=svc.id,
        event_type=EventType.SUPPLY_USED,
        user_id=current_user.id,
        description=f"Insumo usado: {supply.name} x {body.quantity} {supply.unit}",
        event_metadata={"supply_id": str(body.supply_id), "quantity": body.quantity},
    )
    db.add(event)
    await db.flush()

    usage = ServiceSupplyUsage(
        service_id=body.service_id,
        event_id=event.id,
        supply_id=body.supply_id,
        quantity=body.quantity,
        unit_cost_at_time=supply.unit_cost,
    )
    db.add(usage)
    await db.flush()
    await log_action(db, "supply_used", "service_supply_usage", str(usage.id), user_id=current_user.id)
    return usage


@router.get("/usage/service/{service_id}", response_model=List[SupplyUsageResponse], summary="Insumos usados en un servicio")
async def list_service_usages(
    service_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("supply:read")),
):
    result = await db.execute(
        select(ServiceSupplyUsage).where(ServiceSupplyUsage.service_id == service_id)
    )
    return result.scalars().all()
