from typing import List
from uuid import UUID
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models.financial import PreFactura, PreFacturaItem, PreFacturaStatus, EnvironmentalConfig
from app.models.user import User
from app.schemas.financial import (
    PreFacturaCreate, PreFacturaApprove, PreFacturaResponse,
    EnvironmentalConfigCreate, EnvironmentalConfigResponse,
)
from app.core.audit_logger import log_action
from app.dependencies import require_permission
from app.services.contract_rules import generate_prefactura_code

router = APIRouter(prefix="/prefacturas", tags=["Prefacturación"])


@router.post("", response_model=PreFacturaResponse, status_code=status.HTTP_201_CREATED, summary="Crear prefactura")
async def create_prefactura(
    body: PreFacturaCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("prefactura:create")),
):
    from app.models.contract import Contract
    contract_result = await db.execute(select(Contract).where(Contract.id == body.contract_id))
    contract = contract_result.scalar_one_or_none()
    if not contract:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contrato no encontrado")

    seq_result = await db.execute(
        select(func.count(PreFactura.id)).where(PreFactura.contract_id == body.contract_id)
    )
    seq = (seq_result.scalar_one() or 0) + 1
    code = generate_prefactura_code(contract.code, seq)

    total = sum(item.quantity * item.unit_price for item in body.items)
    pf = PreFactura(
        code=code,
        contract_id=body.contract_id,
        period_start=body.period_start,
        period_end=body.period_end,
        notes=body.notes,
        total_amount=total,
        created_by_id=current_user.id,
    )
    db.add(pf)
    await db.flush()

    for item_data in body.items:
        subtotal = item_data.quantity * item_data.unit_price
        db.add(PreFacturaItem(
            prefactura_id=pf.id,
            service_id=item_data.service_id,
            description=item_data.description,
            quantity=item_data.quantity,
            unit_price=item_data.unit_price,
            subtotal=subtotal,
        ))

    await log_action(db, "prefactura_created", "prefactura", str(pf.id), user_id=current_user.id)
    await db.refresh(pf)
    return pf


@router.get("", response_model=List[PreFacturaResponse], summary="Listar prefacturas")
async def list_prefacturas(
    contract_id: UUID = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("prefactura:read")),
):
    query = select(PreFactura)
    if contract_id:
        query = query.where(PreFactura.contract_id == contract_id)
    result = await db.execute(query.order_by(PreFactura.created_at.desc()))
    return result.scalars().all()


@router.get("/{pf_id}", response_model=PreFacturaResponse, summary="Obtener prefactura")
async def get_prefactura(
    pf_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("prefactura:read")),
):
    result = await db.execute(select(PreFactura).where(PreFactura.id == pf_id))
    pf = result.scalar_one_or_none()
    if not pf:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prefactura no encontrada")
    return pf


@router.post("/{pf_id}/approve", response_model=PreFacturaResponse, summary="Aprobar prefactura")
async def approve_prefactura(
    pf_id: UUID,
    body: PreFacturaApprove,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("prefactura:approve")),
):
    result = await db.execute(select(PreFactura).where(PreFactura.id == pf_id))
    pf = result.scalar_one_or_none()
    if not pf:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prefactura no encontrada")
    if pf.status != PreFacturaStatus.DRAFT:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Solo se pueden aprobar prefacturas en borrador")

    pf.status = PreFacturaStatus.APPROVED
    pf.approved_by_id = current_user.id
    pf.approved_at = datetime.now(timezone.utc)
    if body.notes:
        pf.notes = (pf.notes or "") + f"\n[Aprobación] {body.notes}"

    await log_action(db, "prefactura_approved", "prefactura", str(pf_id), user_id=current_user.id)
    return pf


@router.post("/{pf_id}/cancel", response_model=PreFacturaResponse, summary="Cancelar prefactura")
async def cancel_prefactura(
    pf_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("prefactura:approve")),
):
    result = await db.execute(select(PreFactura).where(PreFactura.id == pf_id))
    pf = result.scalar_one_or_none()
    if not pf:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prefactura no encontrada")
    if pf.status == PreFacturaStatus.BILLED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="No se puede cancelar una prefactura ya facturada")
    before = {"status": pf.status.value}
    pf.status = PreFacturaStatus.CANCELLED
    await log_action(db, "prefactura_cancelled", "prefactura", str(pf_id), user_id=current_user.id, before_state=before)
    return pf


# Configuración ambiental
env_router = APIRouter(prefix="/environmental-config", tags=["Configuración Ambiental"])


@env_router.post("", response_model=EnvironmentalConfigResponse, status_code=status.HTTP_201_CREATED, summary="Crear configuración ambiental")
async def create_env_config(
    body: EnvironmentalConfigCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("env_config:manage")),
):
    config = EnvironmentalConfig(**body.model_dump())
    db.add(config)
    await db.flush()
    await log_action(db, "env_config_created", "environmental_config", str(config.id), user_id=current_user.id)
    return config


@env_router.get("", response_model=List[EnvironmentalConfigResponse], summary="Listar configuraciones ambientales")
async def list_env_configs(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("report:environmental")),
):
    result = await db.execute(select(EnvironmentalConfig).where(EnvironmentalConfig.is_active == True))
    return result.scalars().all()
