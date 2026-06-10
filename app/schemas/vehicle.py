from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime
from app.models.vehicle import VehicleType, FuelType, PeriodType


class VehicleCreate(BaseModel):
    plate: str
    brand: str
    model: str
    year: Optional[int] = None
    vehicle_type: VehicleType
    fuel_type: FuelType
    color: Optional[str] = None
    client_id: Optional[UUID] = None
    fleet_id: Optional[UUID] = None


class VehicleUpdate(BaseModel):
    brand: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    vehicle_type: Optional[VehicleType] = None
    fuel_type: Optional[FuelType] = None
    color: Optional[str] = None
    client_id: Optional[UUID] = None
    fleet_id: Optional[UUID] = None


class VehicleResponse(BaseModel):
    id: UUID
    plate: str
    brand: str
    model: str
    year: Optional[int] = None
    vehicle_type: VehicleType
    fuel_type: FuelType
    color: Optional[str] = None
    client_id: Optional[UUID] = None
    fleet_id: Optional[UUID] = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class VehicleContractConfigCreate(BaseModel):
    vehicle_id: UUID
    contract_id: UUID
    max_services_per_period: int = 2
    period_type: PeriodType = PeriodType.MONTHLY


class VehicleContractConfigResponse(BaseModel):
    id: UUID
    vehicle_id: UUID
    contract_id: UUID
    max_services_per_period: int
    period_type: PeriodType
    is_active: bool

    model_config = {"from_attributes": True}
