from pydantic import BaseModel, EmailStr
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from app.models.client import ClientType, DocumentType


class ClientCreate(BaseModel):
    type: ClientType = ClientType.OCCASIONAL
    document_type: Optional[DocumentType] = None
    document_number: Optional[str] = None
    full_name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    company_name: Optional[str] = None


class ClientUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    company_name: Optional[str] = None
    type: Optional[ClientType] = None


class ClientResponse(BaseModel):
    id: UUID
    type: ClientType
    document_type: Optional[DocumentType] = None
    document_number: Optional[str] = None
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    company_name: Optional[str] = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
