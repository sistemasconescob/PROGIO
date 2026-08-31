"""
Cálculo de indicadores ambientales y económicos (secciones 8.2 y 8.3).
"""
from typing import List, Dict, Any
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime

from app.models.financial import EnvironmentalConfig
from app.models.service import Service, ServiceStatus
from app.models.supply import ServiceSupplyUsage
from app.models.contract import OperationalCost
from app.models.vehicle import Vehicle


def _ev(v) -> str:
    return v.value if hasattr(v, "value") else str(v)


async def get_environmental_config(db: AsyncSession, vehicle_type: str, fuel_type: str) -> EnvironmentalConfig | None:
    result = await db.execute(
        select(EnvironmentalConfig).where(
            EnvironmentalConfig.vehicle_type == vehicle_type,
            EnvironmentalConfig.fuel_type == fuel_type,
            EnvironmentalConfig.is_active == True,
        )
    )
    return result.scalar_one_or_none()


async def calculate_environmental_impact(
    db: AsyncSession, service: Service
) -> Dict[str, Any]:
    """Calcula huella hídrica evitada y huella de carbono para un servicio."""
    if not service.vehicle_id:
        return {}
    vehicle = await db.get(Vehicle, service.vehicle_id)
    if not vehicle:
        return {}

    config = await get_environmental_config(db, _ev(vehicle.vehicle_type), _ev(vehicle.fuel_type))
    if not config:
        return {
            "water_saved_liters": 150.0,
            "co2_avoided_kg": 0.0,
            "standard_km": 10.0,
        }

    co2_avoided = config.co2_per_km * config.standard_km
    return {
        "water_saved_liters": config.water_saved_per_wash,
        "co2_avoided_kg": co2_avoided,
        "standard_km": config.standard_km,
        "vehicle_type": _ev(vehicle.vehicle_type),
        "fuel_type": _ev(vehicle.fuel_type),
    }


async def calculate_service_cost(db: AsyncSession, service_id: UUID) -> Dict[str, Any]:
    """Calcula el costo total de un servicio incluyendo insumos."""
    result = await db.execute(
        select(ServiceSupplyUsage).where(ServiceSupplyUsage.service_id == service_id)
    )
    usages = result.scalars().all()

    supply_cost = sum(float(u.quantity) * float(u.unit_cost_at_time) for u in usages)
    return {
        "supply_cost": supply_cost,
        "total_cost": supply_cost,
    }


async def calculate_period_economic_indicators(
    db: AsyncSession,
    contract_id: UUID,
    period_start: datetime,
    period_end: datetime,
) -> Dict[str, Any]:
    """Indicadores económicos: costo por servicio, costos fijos imputados, margen operativo."""
    services_result = await db.execute(
        select(Service).where(
            Service.contract_id == contract_id,
            Service.created_at >= period_start,
            Service.created_at <= period_end,
            Service.status == ServiceStatus.FINISHED,
        )
    )
    services = services_result.scalars().all()

    total_supply_cost = 0.0
    for svc in services:
        cost = await calculate_service_cost(db, svc.id)
        total_supply_cost += cost["total_cost"]

    costs_result = await db.execute(
        select(func.sum(OperationalCost.amount)).where(
            OperationalCost.contract_id == contract_id,
        )
    )
    fixed_costs = float(costs_result.scalar_one() or 0)

    total_cost = total_supply_cost + fixed_costs
    service_count = len(services)
    cost_per_service = total_cost / service_count if service_count > 0 else 0

    return {
        "service_count": service_count,
        "supply_cost": total_supply_cost,
        "fixed_costs": fixed_costs,
        "total_cost": total_cost,
        "cost_per_service": cost_per_service,
    }
