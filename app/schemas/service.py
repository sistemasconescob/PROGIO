from pydantic import BaseModel
from typing import Optional, List, Any, Dict
from uuid import UUID
from datetime import datetime
from app.models.service import ServiceStatus, ServiceType, EventType


class ServiceCreate(BaseModel):
    contract_id: UUID
    sede_id: UUID
    vehicle_id: UUID
    client_id: Optional[UUID] = None
    service_type: ServiceType
    notes: Optional[str] = None


class ServiceEventResponse(BaseModel):
    id: UUID
    event_type: EventType
    user_id: UUID
    role_at_time: Optional[str] = None
    description: Optional[str] = None
    event_metadata: Optional[Dict[str, Any]] = None
    environmental_impact: Optional[Dict[str, Any]] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ServiceResponse(BaseModel):
    id: UUID
    code: str
    contract_id: UUID
    sede_id: UUID
    vehicle_id: UUID
    client_id: Optional[UUID] = None
    service_type: ServiceType
    status: ServiceStatus
    operator_id: Optional[UUID] = None
    supervisor_id: Optional[UUID] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    compliance_format_completed: bool
    block_reason: Optional[str] = None
    notes: Optional[str] = None
    created_by_id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    events: List[ServiceEventResponse] = []

    model_config = {"from_attributes": True}


class ServiceStartRequest(BaseModel):
    operator_id: UUID


class ServicePauseRequest(BaseModel):
    reason: Optional[str] = None


class ServiceResumeRequest(BaseModel):
    pass


class ServiceAssignOperatorRequest(BaseModel):
    operator_id: UUID


class ServiceSuperviseRequest(BaseModel):
    notes: Optional[str] = None


class ServiceCompleteComplianceRequest(BaseModel):
    notes: Optional[str] = None


class ServiceFinishRequest(BaseModel):
    notes: Optional[str] = None


class ServiceCancelRequest(BaseModel):
    reason: str


class ServiceReprocessRequest(BaseModel):
    reason: str


class ServiceAddNoteRequest(BaseModel):
    note: str


class ServiceFilter(BaseModel):
    contract_id: Optional[UUID] = None
    sede_id: Optional[UUID] = None
    vehicle_id: Optional[UUID] = None
    status: Optional[ServiceStatus] = None
    service_type: Optional[ServiceType] = None
    operator_id: Optional[UUID] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
