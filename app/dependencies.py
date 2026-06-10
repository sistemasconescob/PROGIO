from typing import Optional
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from datetime import datetime, timezone

from app.database import get_db
from app.core.security import decode_token
from app.models.user import User
from app.models.role import UserContractRole, RolePermission, Permission


bearer_scheme = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials
    payload = decode_token(token)

    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido o expirado")

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no encontrado")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuario inactivo")

    now = datetime.now(timezone.utc)
    if user.locked_until and user.locked_until > now:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cuenta bloqueada temporalmente")

    return user


async def get_user_permissions(user: User, db: AsyncSession, contract_id: Optional[UUID] = None) -> set[str]:
    """Retorna los permisos del usuario en el contexto de un contrato específico."""
    query = (
        select(Permission.code)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .join(UserContractRole, UserContractRole.role_id == RolePermission.role_id)
        .where(UserContractRole.user_id == user.id, UserContractRole.is_active == True)
    )
    if contract_id:
        query = query.where(UserContractRole.contract_id == contract_id)

    result = await db.execute(query)
    return {row[0] for row in result.fetchall()}


def require_permission(permission_code: str, contract_id_param: Optional[str] = None):
    """Dependencia de permiso. Verifica que el usuario tenga el permiso requerido."""
    async def checker(
        request: Request,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        contract_id = None
        if contract_id_param:
            raw = request.path_params.get(contract_id_param)
            if raw:
                try:
                    contract_id = UUID(raw)
                except ValueError:
                    pass

        if current_user.is_superuser:
            return current_user

        permissions = await get_user_permissions(current_user, db, contract_id)
        if permission_code not in permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permiso requerido: {permission_code}",
            )
        return current_user

    return checker
