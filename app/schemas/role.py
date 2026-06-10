from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime


class PermissionResponse(BaseModel):
    id: UUID
    code: str
    description: str
    module: str

    model_config = {"from_attributes": True}


class RoleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    permission_codes: List[str] = []


class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    permission_codes: Optional[List[str]] = None


class RoleResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    is_system: bool
    created_at: datetime
    permissions: List[PermissionResponse] = []

    model_config = {"from_attributes": True}


class UserContractRoleResponse(BaseModel):
    id: UUID
    user_id: UUID
    contract_id: UUID
    role_id: UUID
    role_name: str
    is_active: bool
    created_at: datetime
    revoked_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
