from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.client import Client
from app.models.user import User
from app.schemas.client import ClientCreate, ClientUpdate, ClientResponse
from app.core.audit_logger import log_action
from app.dependencies import require_permission

router = APIRouter(prefix="/clients", tags=["Clientes"])


@router.post("", response_model=ClientResponse, status_code=status.HTTP_201_CREATED, summary="Crear cliente")
async def create_client(
    body: ClientCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("client:create")),
):
    if body.document_number:
        existing = await db.execute(
            select(Client).where(Client.document_number == body.document_number)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ya existe un cliente con ese documento")

    client = Client(**body.model_dump())
    db.add(client)
    await db.flush()
    await log_action(db, "client_created", "client", str(client.id), user_id=current_user.id)
    return client


@router.get("", response_model=List[ClientResponse], summary="Listar clientes")
async def list_clients(
    q: Optional[str] = Query(None, description="Buscar por nombre o documento"),
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("client:read")),
):
    query = select(Client)
    if active_only:
        query = query.where(Client.is_active == True)
    if q:
        query = query.where(
            Client.full_name.ilike(f"%{q}%") | Client.document_number.ilike(f"%{q}%")
        )
    result = await db.execute(query.order_by(Client.full_name))
    return result.scalars().all()


@router.get("/{client_id}", response_model=ClientResponse, summary="Obtener cliente")
async def get_client(
    client_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("client:read")),
):
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente no encontrado")
    return client


@router.put("/{client_id}", response_model=ClientResponse, summary="Actualizar cliente")
async def update_client(
    client_id: UUID,
    body: ClientUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("client:update")),
):
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente no encontrado")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(client, field, val)
    await log_action(db, "client_updated", "client", str(client_id), user_id=current_user.id)
    return client
