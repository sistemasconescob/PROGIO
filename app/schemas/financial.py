from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from app.models.financial import PreFacturaStatus


class PreFacturaItemCreate(BaseModel):
    service_id: Optional[UUID] = None
    description: str
    quantity: float
    unit_price: float


class PreFacturaItemResponse(BaseModel):
    id: UUID
    service_id: Optional[UUID] = None
    description: str
    quantity: float
    unit_price: float
    subtotal: float

    model_config = {"from_attributes": True}


class PreFacturaCreate(BaseModel):
    contract_id: UUID
    period_start: datetime
    period_end: datetime
    notes: Optional[str] = None
    items: List[PreFacturaItemCreate] = []


class PreFacturaApprove(BaseModel):
    notes: Optional[str] = None


class PreFacturaResponse(BaseModel):
    id: UUID
    code: str
    contract_id: UUID
    status: PreFacturaStatus
    total_amount: float
    period_start: datetime
    period_end: datetime
    notes: Optional[str] = None
    created_by_id: UUID
    approved_by_id: Optional[UUID] = None
    approved_at: Optional[datetime] = None
    created_at: datetime
    items: List[PreFacturaItemResponse] = []

    model_config = {"from_attributes": True}


class EnvironmentalConfigCreate(BaseModel):
    vehicle_type: str
    fuel_type: str
    co2_per_km: float
    water_saved_per_wash: float = 150.0
    standard_km: float = 10.0


class EnvironmentalConfigResponse(BaseModel):
    id: UUID
    vehicle_type: str
    fuel_type: str
    co2_per_km: float
    water_saved_per_wash: float
    standard_km: float
    is_active: bool

    model_config = {"from_attributes": True}
