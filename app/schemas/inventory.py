from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from decimal import Decimal


class InventoryPeriodItemCreate(BaseModel):
    supply_id: UUID
    initial_stock: Decimal = Decimal("0")
    entries: Decimal = Decimal("0")
    adjustments: Decimal = Decimal("0")


class InventoryPeriodItemUpdate(BaseModel):
    entries: Optional[Decimal] = None
    adjustments: Optional[Decimal] = None
    final_stock_physical: Optional[Decimal] = None


class SupplyBrief(BaseModel):
    id: UUID
    name: str
    unit: str
    model_config = {"from_attributes": True}


class InventoryPeriodItemResponse(BaseModel):
    id: UUID
    period_id: UUID
    supply_id: UUID
    supply: Optional[SupplyBrief] = None
    initial_stock: Decimal
    entries: Decimal
    adjustments: Decimal
    final_stock_physical: Optional[Decimal] = None
    theoretical_consumption: Decimal
    difference: Optional[Decimal] = None
    deviation_pct: Optional[float] = None
    model_config = {"from_attributes": True}


class InventoryPeriodCreate(BaseModel):
    contract_id: UUID
    sede_id: Optional[UUID] = None
    workstation: Optional[str] = None
    period_label: str        # "2026-06"
    period_start: datetime
    period_end: datetime
    period_type: str = "monthly"
    notes: Optional[str] = None
    items: List[InventoryPeriodItemCreate] = []


class InventoryPeriodResponse(BaseModel):
    id: UUID
    contract_id: UUID
    sede_id: Optional[UUID] = None
    workstation: Optional[str] = None
    period_label: str
    period_start: datetime
    period_end: datetime
    period_type: str
    status: str
    notes: Optional[str] = None
    created_by_id: UUID
    closed_by_id: Optional[UUID] = None
    created_at: datetime
    closed_at: Optional[datetime] = None
    items: List[InventoryPeriodItemResponse] = []
    model_config = {"from_attributes": True}


class ReconcileRequest(BaseModel):
    """Ingreso del stock físico final por insumo para conciliación."""
    items: List[dict]   # [{supply_id: uuid, final_stock_physical: decimal}]


class ServiceCostWeightCreate(BaseModel):
    formula_version: str
    service_type: str
    weight: Decimal
    notes: Optional[str] = None


class ServiceCostWeightResponse(BaseModel):
    id: UUID
    formula_version: str
    service_type: str
    weight: Decimal
    is_active: bool
    notes: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}


class CostCalculationResult(BaseModel):
    period_label: str
    contract_id: UUID
    total_supply_cost: Decimal
    total_operational_cost: Decimal
    total_services: int
    avg_cost_per_service: Decimal
    breakdown_by_type: List[dict]
