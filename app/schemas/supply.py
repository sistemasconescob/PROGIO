from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime
from app.models.supply import SupplyCategory


class SupplyCreate(BaseModel):
    name: str
    unit: str
    unit_cost: float
    category: SupplyCategory = SupplyCategory.OTHER
    description: Optional[str] = None


class SupplyUpdate(BaseModel):
    name: Optional[str] = None
    unit: Optional[str] = None
    unit_cost: Optional[float] = None
    category: Optional[SupplyCategory] = None
    description: Optional[str] = None


class SupplyResponse(BaseModel):
    id: UUID
    name: str
    unit: str
    unit_cost: float
    category: SupplyCategory
    description: Optional[str] = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class SupplyUsageCreate(BaseModel):
    service_id: UUID
    supply_id: UUID
    quantity: float


class SupplyUsageResponse(BaseModel):
    id: UUID
    service_id: UUID
    supply_id: UUID
    quantity: float
    unit_cost_at_time: float
    created_at: datetime

    model_config = {"from_attributes": True}
