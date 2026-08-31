from typing import List, Optional
from uuid import UUID
from decimal import Decimal
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.database import get_db
from app.models.inventory import InventoryPeriod, InventoryPeriodItem, ServiceCostWeight
from app.models.supply import Supply
from app.models.user import User
from app.schemas.inventory import (
    InventoryPeriodCreate, InventoryPeriodResponse,
    InventoryPeriodItemUpdate, InventoryPeriodItemResponse,
    ServiceCostWeightCreate, ServiceCostWeightResponse,
    CostCalculationResult,
)
from app.core.audit_logger import log_action
from app.dependencies import require_permission

router = APIRouter(prefix="/inventory", tags=["Inventarios"])


@router.post("/periods", response_model=InventoryPeriodResponse, status_code=201, summary="Crear periodo de inventario")
async def create_period(
    body: InventoryPeriodCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("inventory:manage")),
):
    period = InventoryPeriod(
        contract_id=body.contract_id,
        sede_id=body.sede_id,
        workstation=body.workstation,
        period_label=body.period_label,
        period_start=body.period_start,
        period_end=body.period_end,
        period_type=body.period_type,
        notes=body.notes,
        created_by_id=current_user.id,
    )
    db.add(period)
    await db.flush()

    for item_data in body.items:
        db.add(InventoryPeriodItem(
            period_id=period.id,
            supply_id=item_data.supply_id,
            initial_stock=item_data.initial_stock,
            entries=item_data.entries,
            adjustments=item_data.adjustments,
        ))

    await log_action(db, "inventory_period_created", "inventory_period", str(period.id), user_id=current_user.id)
    await db.refresh(period)
    return period


@router.get("/periods", response_model=List[InventoryPeriodResponse], summary="Listar periodos")
async def list_periods(
    contract_id: Optional[UUID] = Query(None),
    sede_id: Optional[UUID] = Query(None),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("inventory:read")),
):
    q = select(InventoryPeriod)
    filters = []
    if contract_id:
        filters.append(InventoryPeriod.contract_id == contract_id)
    if sede_id:
        filters.append(InventoryPeriod.sede_id == sede_id)
    if status:
        filters.append(InventoryPeriod.status == status)
    if filters:
        q = q.where(and_(*filters))
    q = q.order_by(InventoryPeriod.period_label.desc())
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/periods/{period_id}", response_model=InventoryPeriodResponse, summary="Obtener periodo")
async def get_period(
    period_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("inventory:read")),
):
    result = await db.execute(select(InventoryPeriod).where(InventoryPeriod.id == period_id))
    period = result.scalar_one_or_none()
    if not period:
        raise HTTPException(404, "Periodo no encontrado")
    return period


@router.post("/periods/{period_id}/items", response_model=InventoryPeriodItemResponse, status_code=201, summary="Agregar insumo al periodo")
async def add_item(
    period_id: UUID,
    supply_id: UUID,
    initial_stock: Decimal = Decimal("0"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("inventory:manage")),
):
    result = await db.execute(select(InventoryPeriod).where(InventoryPeriod.id == period_id))
    period = result.scalar_one_or_none()
    if not period:
        raise HTTPException(404, "Periodo no encontrado")
    if period.status != "open":
        raise HTTPException(400, "Solo se pueden agregar insumos a periodos abiertos")

    item = InventoryPeriodItem(period_id=period_id, supply_id=supply_id, initial_stock=initial_stock)
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return item


@router.patch("/periods/{period_id}/items/{item_id}", response_model=InventoryPeriodItemResponse, summary="Actualizar insumo del periodo")
async def update_item(
    period_id: UUID,
    item_id: UUID,
    body: InventoryPeriodItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("inventory:manage")),
):
    result = await db.execute(select(InventoryPeriodItem).where(
        InventoryPeriodItem.id == item_id,
        InventoryPeriodItem.period_id == period_id,
    ))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Item no encontrado")

    period_result = await db.execute(select(InventoryPeriod).where(InventoryPeriod.id == period_id))
    period = period_result.scalar_one_or_none()
    if period.status == "closed":
        raise HTTPException(400, "No se puede modificar un periodo cerrado")

    if body.entries is not None:
        item.entries = body.entries
    if body.adjustments is not None:
        item.adjustments = body.adjustments
    if body.final_stock_physical is not None:
        item.final_stock_physical = body.final_stock_physical

    return item


@router.post("/periods/{period_id}/reconcile", response_model=InventoryPeriodResponse, summary="Iniciar conciliación del periodo")
async def start_reconciliation(
    period_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("inventory:manage")),
):
    result = await db.execute(select(InventoryPeriod).where(InventoryPeriod.id == period_id))
    period = result.scalar_one_or_none()
    if not period:
        raise HTTPException(404, "Periodo no encontrado")
    if period.status != "open":
        raise HTTPException(400, f"El periodo está en estado '{period.status}', no se puede iniciar conciliación")

    period.status = "reconciling"
    await log_action(db, "inventory_reconciliation_started", "inventory_period", str(period_id), user_id=current_user.id)
    await db.refresh(period)
    return period


@router.post("/periods/{period_id}/close", response_model=InventoryPeriodResponse, summary="Cerrar periodo (calcula diferencias)")
async def close_period(
    period_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("inventory:manage")),
):
    result = await db.execute(select(InventoryPeriod).where(InventoryPeriod.id == period_id))
    period = result.scalar_one_or_none()
    if not period:
        raise HTTPException(404, "Periodo no encontrado")
    if period.status == "closed":
        raise HTTPException(400, "El periodo ya está cerrado")

    # Calcular diferencias y desviación para cada item
    for item in period.items:
        expected_closing = (
            float(item.initial_stock)
            + float(item.entries)
            + float(item.adjustments)
            - float(item.theoretical_consumption)
        )
        if item.final_stock_physical is not None:
            diff = float(item.final_stock_physical) - expected_closing
            item.difference = Decimal(str(diff))
            if float(item.theoretical_consumption) != 0:
                item.deviation_pct = (diff / float(item.theoretical_consumption)) * 100
            else:
                item.deviation_pct = None
        else:
            item.difference = None
            item.deviation_pct = None

    period.status = "closed"
    period.closed_by_id = current_user.id
    period.closed_at = datetime.utcnow()
    await log_action(db, "inventory_period_closed", "inventory_period", str(period_id), user_id=current_user.id)
    await db.refresh(period)
    return period


# ── Pesos de costeo por media funcional (Sección 5) ──

@router.get("/cost-weights", response_model=List[ServiceCostWeightResponse], summary="Listar pesos de costeo")
async def list_cost_weights(
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("inventory:read")),
):
    q = select(ServiceCostWeight)
    if active_only:
        q = q.where(ServiceCostWeight.is_active == True)
    result = await db.execute(q.order_by(ServiceCostWeight.formula_version, ServiceCostWeight.service_type))
    return result.scalars().all()


@router.post("/cost-weights", response_model=ServiceCostWeightResponse, status_code=201, summary="Crear peso de costeo")
async def create_cost_weight(
    body: ServiceCostWeightCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("inventory:manage")),
):
    cw = ServiceCostWeight(**body.model_dump(), created_by_id=current_user.id)
    db.add(cw)
    await db.flush()
    await db.refresh(cw)
    return cw


@router.delete("/cost-weights/{weight_id}", status_code=204, summary="Desactivar peso de costeo")
async def deactivate_cost_weight(
    weight_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("inventory:manage")),
):
    result = await db.execute(select(ServiceCostWeight).where(ServiceCostWeight.id == weight_id))
    cw = result.scalar_one_or_none()
    if not cw:
        raise HTTPException(404, "Peso no encontrado")
    cw.is_active = False
