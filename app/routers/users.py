from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User
from app.models.role import UserContractRole, Role
from app.schemas.user import UserCreate, UserUpdate, UserResponse, UserDetailResponse, AssignUserContractRole, RevokeUserContractRole
from app.schemas.role import UserContractRoleResponse
from app.core.security import hash_password
from app.core.audit_logger import log_action
from app.dependencies import get_current_user, require_permission
from app.services.auth_service import revoke_all_tokens

router = APIRouter(prefix="/users", tags=["Usuarios"])


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED, summary="Crear usuario")
async def create_user(
    body: UserCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("user:create")),
):
    result = await db.execute(select(User).where((User.email == body.email) | (User.username == body.username)))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email o username ya existe")
    user = User(
        email=body.email,
        username=body.username,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        phone=body.phone,
    )
    db.add(user)
    await db.flush()
    await log_action(db, "user_created", "user", str(user.id))
    return user


@router.get("", response_model=List[UserDetailResponse], summary="Listar usuarios")
async def list_users(
    active_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("user:read")),
):
    q = select(User)
    if active_only:
        q = q.where(User.is_active == True)
    result = await db.execute(q.order_by(User.full_name))
    return result.scalars().all()


@router.get("/{user_id}", response_model=UserDetailResponse, summary="Obtener usuario")
async def get_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("user:read")),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    return user


@router.put("/{user_id}", response_model=UserResponse, summary="Actualizar usuario")
async def update_user(
    user_id: UUID,
    body: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("user:update")),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

    before = {"full_name": user.full_name, "phone": user.phone}
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(user, field, val)
    await log_action(db, "user_updated", "user", str(user_id), user_id=current_user.id, before_state=before)
    return user


@router.patch("/{user_id}/deactivate", summary="Desactivar usuario")
async def deactivate_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("user:deactivate")),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    if user.id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No puede desactivarse a sí mismo")
    user.is_active = False
    await revoke_all_tokens(db, user_id)
    await log_action(db, "user_deactivated", "user", str(user_id), user_id=current_user.id)
    return {"message": "Usuario desactivado"}


@router.patch("/{user_id}/activate", summary="Activar usuario")
async def activate_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("user:update")),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    user.is_active = True
    user.failed_attempts = 0
    user.locked_until = None
    await log_action(db, "user_activated", "user", str(user_id), user_id=current_user.id)
    return {"message": "Usuario activado"}


@router.post("/contract-roles/assign", response_model=UserContractRoleResponse, summary="Asignar rol en contrato")
async def assign_contract_role(
    body: AssignUserContractRole,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("contract:manage_users")),
):
    existing = await db.execute(
        select(UserContractRole).where(
            UserContractRole.user_id == body.user_id,
            UserContractRole.contract_id == body.contract_id,
            UserContractRole.is_active == True,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Usuario ya tiene un rol en este contrato")

    ucr = UserContractRole(user_id=body.user_id, contract_id=body.contract_id, role_id=body.role_id)
    db.add(ucr)
    await db.flush()
    await log_action(db, "role_assigned", "user_contract_role", str(ucr.id), user_id=current_user.id)

    role_result = await db.execute(select(Role).where(Role.id == body.role_id))
    role = role_result.scalar_one()
    return UserContractRoleResponse(
        id=ucr.id, user_id=ucr.user_id, contract_id=ucr.contract_id,
        role_id=ucr.role_id, role_name=role.name, is_active=ucr.is_active, created_at=ucr.created_at,
    )


@router.post("/contract-roles/revoke", summary="Revocar rol en contrato")
async def revoke_contract_role(
    body: RevokeUserContractRole,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("user:revoke_access")),
):
    from datetime import datetime, timezone
    result = await db.execute(
        select(UserContractRole).where(
            UserContractRole.user_id == body.user_id,
            UserContractRole.contract_id == body.contract_id,
            UserContractRole.is_active == True,
        )
    )
    ucr = result.scalar_one_or_none()
    if not ucr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asignación no encontrada")
    ucr.is_active = False
    ucr.revoked_at = datetime.now(timezone.utc)
    await log_action(db, "role_revoked", "user_contract_role", str(ucr.id), user_id=current_user.id)
    return {"message": "Acceso revocado"}
