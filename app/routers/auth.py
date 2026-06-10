from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.auth import LoginRequest, TokenResponse, RefreshRequest, PasswordChangeRequest
from app.schemas.user import UserResponse
from app.services.auth_service import authenticate_user, create_tokens, refresh_access_token
from app.dependencies import get_current_user
from app.models.user import User
from app.core.security import hash_password
from app.core.audit_logger import log_action

router = APIRouter(prefix="/auth", tags=["Autenticación"])


@router.post("/login", response_model=TokenResponse, summary="Iniciar sesión")
async def login(
    body: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    ip = request.client.host if request.client else None
    user = await authenticate_user(db, body.username, body.password, ip)
    return await create_tokens(db, user)


@router.post("/refresh", response_model=TokenResponse, summary="Renovar token de acceso")
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    return await refresh_access_token(db, body.refresh_token)


@router.get("/me", response_model=UserResponse, summary="Usuario actual")
async def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/change-password", summary="Cambiar contraseña")
async def change_password(
    body: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.core.security import verify_password
    if not verify_password(body.current_password, current_user.hashed_password):
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Contraseña actual incorrecta")
    current_user.hashed_password = hash_password(body.new_password)
    await log_action(db, "password_changed", "user", str(current_user.id), user_id=current_user.id)
    return {"message": "Contraseña actualizada correctamente"}
