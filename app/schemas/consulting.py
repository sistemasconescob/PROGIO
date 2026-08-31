from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime, date


class ConsultantDocumentCreate(BaseModel):
    doc_type: str
    name: str
    file_url: Optional[str] = None
    issued_at: Optional[date] = None
    expires_at: Optional[date] = None
    is_critical: bool = False
    notes: Optional[str] = None


class ConsultantDocumentResponse(BaseModel):
    id: UUID
    consultant_id: UUID
    doc_type: str
    name: str
    file_url: Optional[str] = None
    issued_at: Optional[date] = None
    expires_at: Optional[date] = None
    is_critical: bool
    notes: Optional[str] = None
    uploaded_by_id: UUID
    created_at: datetime
    model_config = {"from_attributes": True}


class ConsultantCreate(BaseModel):
    full_name: str
    document_type: Optional[str] = None
    document_number: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    specialty: Optional[str] = None
    user_id: Optional[UUID] = None
    notes: Optional[str] = None


class ConsultantUpdate(BaseModel):
    full_name: Optional[str] = None
    document_type: Optional[str] = None
    document_number: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    specialty: Optional[str] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class ConsultantResponse(BaseModel):
    id: UUID
    full_name: str
    document_type: Optional[str] = None
    document_number: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    specialty: Optional[str] = None
    is_active: bool
    user_id: Optional[UUID] = None
    notes: Optional[str] = None
    created_at: datetime
    documents: List[ConsultantDocumentResponse] = []
    model_config = {"from_attributes": True}


class AssignmentCreate(BaseModel):
    code: str
    contract_id: UUID
    consultant_id: UUID
    position: Optional[str] = None
    location: Optional[str] = None
    client_reference: Optional[str] = None
    notes: Optional[str] = None


class AssignmentUpdate(BaseModel):
    position: Optional[str] = None
    location: Optional[str] = None
    client_reference: Optional[str] = None
    notes: Optional[str] = None


class AssignmentStatusChange(BaseModel):
    notes: Optional[str] = None


class AssignmentEventResponse(BaseModel):
    id: UUID
    assignment_id: UUID
    event_type: str
    user_id: UUID
    description: Optional[str] = None
    event_metadata: Optional[dict] = None
    created_at: datetime
    model_config = {"from_attributes": True}


class ClosureReportBrief(BaseModel):
    id: UUID
    internal_status: str
    client_status: str
    created_at: datetime
    model_config = {"from_attributes": True}


class AssignmentResponse(BaseModel):
    id: UUID
    code: str
    contract_id: UUID
    consultant_id: UUID
    position: Optional[str] = None
    location: Optional[str] = None
    client_reference: Optional[str] = None
    status: str
    opened_at: datetime
    closed_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_by_id: UUID
    created_at: datetime
    events: List[AssignmentEventResponse] = []
    closure_report: Optional[ClosureReportBrief] = None
    model_config = {"from_attributes": True}


class ClosureReportAttachmentCreate(BaseModel):
    file_name: str
    file_url: Optional[str] = None
    attachment_type: str = "pdf"
    notes: Optional[str] = None


class ClosureReportAttachmentResponse(BaseModel):
    id: UUID
    report_id: UUID
    file_name: str
    file_url: Optional[str] = None
    attachment_type: str
    notes: Optional[str] = None
    uploaded_by_id: UUID
    created_at: datetime
    model_config = {"from_attributes": True}


class ClosureReportCreate(BaseModel):
    assignment_id: UUID
    content: Optional[dict] = None
    narrative: Optional[str] = None
    notes: Optional[str] = None
    template_version: str = "1.0"


class ClosureReportUpdate(BaseModel):
    content: Optional[dict] = None
    narrative: Optional[str] = None
    notes: Optional[str] = None


class ClosureReportValidate(BaseModel):
    notes: Optional[str] = None
    validator_name: Optional[str] = None   # para validación cliente externo


class ClosureReportResponse(BaseModel):
    id: UUID
    assignment_id: UUID
    internal_status: str
    internal_validated_by_id: Optional[UUID] = None
    internal_validated_at: Optional[datetime] = None
    internal_notes: Optional[str] = None
    client_status: str
    client_validated_at: Optional[datetime] = None
    client_validator_name: Optional[str] = None
    client_notes: Optional[str] = None
    content: Optional[dict] = None
    narrative: Optional[str] = None
    template_version: str
    notes: Optional[str] = None
    created_by_id: UUID
    created_at: datetime
    updated_at: datetime
    attachments: List[ClosureReportAttachmentResponse] = []
    model_config = {"from_attributes": True}
