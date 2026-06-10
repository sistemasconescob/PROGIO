"""
Reglas de negocio contractuales críticas (sección 10 del documento).
"""
from datetime import datetime, timezone, timedelta
from typing import Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from fastapi import HTTPException, status

from app.models.vehicle import VehicleContractConfig, PeriodType
from app.models.service import Service, ServiceStatus
from app.models.contract import Contract, ContractStatus


def _get_period_start(period_type: PeriodType) -> datetime:
    now = datetime.now(timezone.utc)
    if period_type == PeriodType.WEEKLY:
        return now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=now.weekday())
    elif period_type == PeriodType.BIWEEKLY:
        day = now.day
        if day <= 15:
            return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        return now.replace(day=16, hour=0, minute=0, second=0, microsecond=0)
    elif period_type == PeriodType.BIMONTHLY:
        if now.month <= 2:
            return now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        elif now.month <= 4:
            return now.replace(month=3, day=1, hour=0, minute=0, second=0, microsecond=0)
        elif now.month <= 6:
            return now.replace(month=5, day=1, hour=0, minute=0, second=0, microsecond=0)
        elif now.month <= 8:
            return now.replace(month=7, day=1, hour=0, minute=0, second=0, microsecond=0)
        elif now.month <= 10:
            return now.replace(month=9, day=1, hour=0, minute=0, second=0, microsecond=0)
        else:
            return now.replace(month=11, day=1, hour=0, minute=0, second=0, microsecond=0)
    else:
        return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


async def check_in_house_service_limit(
    db: AsyncSession,
    vehicle_id: UUID,
    contract_id: UUID,
) -> Optional[str]:
    """
    Verifica el límite de servicios para vehículos en contratos In House.
    Retorna motivo de bloqueo si aplica, None si está permitido.
    """
    result = await db.execute(
        select(VehicleContractConfig).where(
            VehicleContractConfig.vehicle_id == vehicle_id,
            VehicleContractConfig.contract_id == contract_id,
            VehicleContractConfig.is_active == True,
        )
    )
    config = result.scalar_one_or_none()
    if not config:
        return None

    period_start = _get_period_start(config.period_type)

    count_result = await db.execute(
        select(func.count(Service.id)).where(
            Service.vehicle_id == vehicle_id,
            Service.contract_id == contract_id,
            Service.created_at >= period_start,
            Service.status.notin_([ServiceStatus.CANCELLED, ServiceStatus.BLOCKED]),
        )
    )
    count = count_result.scalar_one()

    if count >= config.max_services_per_period:
        return (
            f"Límite de servicios alcanzado: {count}/{config.max_services_per_period} "
            f"en el periodo {config.period_type.value}"
        )
    return None


async def validate_contract_active(db: AsyncSession, contract_id: UUID) -> Contract:
    result = await db.execute(select(Contract).where(Contract.id == contract_id))
    contract = result.scalar_one_or_none()
    if not contract:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contrato no encontrado")
    if contract.status != ContractStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Contrato {contract.code} no está activo (estado: {contract.status.value})",
        )
    return contract


async def validate_service_can_close(service: Service) -> None:
    """Regla: No cerrar servicios sin formato de cumplimiento (requerimiento 10)."""
    if not service.compliance_format_completed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se puede cerrar el servicio sin completar el formato de cumplimiento",
        )


def generate_service_code(contract_code: str, seq: int) -> str:
    return f"{contract_code}-SVC-{seq:06d}"


def generate_prefactura_code(contract_code: str, seq: int) -> str:
    return f"{contract_code}-PF-{seq:05d}"
