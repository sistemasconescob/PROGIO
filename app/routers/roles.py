from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.database import get_db
from app.models.role import Role, Permission, RolePermission
from app.models.user import User
from app.schemas.role import RoleCreate, RoleUpdate, RoleResponse, PermissionResponse
from app.core.audit_logger import log_action
from app.dependencies import require_permission

router = APIRouter(prefix="/roles", tags=["Roles y Permisos"])


@router.get("/permissions", response_model=List[PermissionResponse], summary="Listar todos los permisos")
async def list_permissions(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("role:read")),
):
    result = await db.execute(select(Permission).order_by(Permission.module, Permission.code))
    return result.scalars().all()


@router.post("", response_model=RoleResponse, status_code=status.HTTP_201_CREATED, summary="Crear rol")
async def create_role(
    body: RoleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("role:create")),
):
    existing = await db.execute(select(Role).where(Role.name == body.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ya existe un rol con ese nombre")

    role = Role(name=body.name, description=body.description)
    db.add(role)
    await db.flush()

    if body.permission_codes:
        perms = await db.execute(select(Permission).where(Permission.code.in_(body.permission_codes)))
        for perm in perms.scalars().all():
            db.add(RolePermission(role_id=role.id, permission_id=perm.id))

    await log_action(db, "role_created", "role", str(role.id), user_id=current_user.id)
    await db.refresh(role)
    return role


@router.get("", response_model=List[RoleResponse], summary="Listar roles")
async def list_roles(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("role:read")),
):
    result = await db.execute(select(Role).order_by(Role.name))
    return result.scalars().all()


@router.get("/{role_id}", response_model=RoleResponse, summary="Obtener rol")
async def get_role(
    role_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("role:read")),
):
    result = await db.execute(select(Role).where(Role.id == role_id))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rol no encontrado")
    return role


@router.put("/{role_id}", response_model=RoleResponse, summary="Actualizar rol")
async def update_role(
    role_id: UUID,
    body: RoleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("role:update")),
):
    result = await db.execute(select(Role).where(Role.id == role_id))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rol no encontrado")

    if body.name:
        role.name = body.name
    if body.description is not None:
        role.description = body.description

    if body.permission_codes is not None:
        await db.execute(
            delete(RolePermission).where(RolePermission.role_id == role_id)
        )
        perms = await db.execute(select(Permission).where(Permission.code.in_(body.permission_codes)))
        for perm in perms.scalars().all():
            db.add(RolePermission(role_id=role.id, permission_id=perm.id))

    await log_action(db, "role_updated", "role", str(role_id), user_id=current_user.id)
    await db.refresh(role)
    return role


@router.delete("/{role_id}", summary="Eliminar rol")
async def delete_role(
    role_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("role:delete")),
):
    result = await db.execute(select(Role).where(Role.id == role_id))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rol no encontrado")
    if role.is_system:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No se puede eliminar un rol del sistema")
    await db.delete(role)
    await log_action(db, "role_deleted", "role", str(role_id), user_id=current_user.id)
    return {"message": "Rol eliminado"}
