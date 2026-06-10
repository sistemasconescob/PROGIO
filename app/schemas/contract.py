from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from app.models.contract import ContractType, ContractStatus, CostType


class ContractSedeCreate(BaseModel):
    name: str
    address: Optional[str] = None
    city: Optional[str] = None


class ContractSedeResponse(BaseModel):
    id: UUID
    contract_id: UUID
    name: str
    address: Optional[str] = None
    city: Optional[str] = None
    is_active: bool

    model_config = {"from_attributes": True}


class ContractCreate(BaseModel):
    code: str
    name: str
    type: ContractType
    client_company: Optional[str] = None
    start_date: datetime
    end_date: datetime
    description: Optional[str] = None
    sedes: List[ContractSedeCreate] = []


class ContractUpdate(BaseModel):
    name: Optional[str] = None
    client_company: Optional[str] = None
    status: Optional[ContractStatus] = None
    end_date: Optional[datetime] = None
    description: Optional[str] = None


class ContractResponse(BaseModel):
    id: UUID
    code: str
    name: str
    type: ContractType
    client_company: Optional[str] = None
    status: ContractStatus
    start_date: datetime
    end_date: datetime
    description: Optional[str] = None
    sedes: List[ContractSedeResponse] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class FleetCreate(BaseModel):
    contract_id: UUID
    name: str
    description: Optional[str] = None


class FleetResponse(BaseModel):
    id: UUID
    contract_id: UUID
    name: str
    description: Optional[str] = None
    is_active: bool

    model_config = {"from_attributes": True}


class OperationalCostCreate(BaseModel):
    contract_id: UUID
    sede_id: Optional[UUID] = None
    cost_type: CostType
    description: str
    amount: float
    period: str


class OperationalCostResponse(BaseModel):
    id: UUID
    contract_id: UUID
    sede_id: Optional[UUID] = None
    cost_type: CostType
    description: str
    amount: float
    period: str
    created_at: datetime

    model_config = {"from_attributes": True}
