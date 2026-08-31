from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.contract import Contract, ContractContact, ContractSede, Fleet, OperationalCost
from app.models.user import User
from app.schemas.contract import (
    ContractCreate, ContractUpdate, ContractResponse,
    ContractContactCreate, ContractContactResponse,
    ContractSedeCreate, ContractSedeResponse,
    FleetCreate, FleetResponse,
    OperationalCostCreate, OperationalCostResponse,
)
from app.core.audit_logger import log_action
from app.dependencies import require_permission

router = APIRouter(prefix="/contracts", tags=["Contratos"])


def _ev(v) -> str:
    return v.value if hasattr(v, "value") else str(v)


@router.post("", response_model=ContractResponse, status_code=status.HTTP_201_CREATED, summary="Crear contrato")
async def create_contract(
    body: ContractCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("contract:create")),
):
    existing = await db.execute(select(Contract).where(Contract.code == body.code))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Código de contrato ya existe")

    contract = Contract(
        code=body.code, name=body.name, type=body.type,
        nit=body.nit, business_name=body.business_name,
        economic_group=body.economic_group,
        client_company=body.client_company, start_date=body.start_date,
        end_date=body.end_date, description=body.description,
        created_by_id=current_user.id,
    )
    db.add(contract)
    await db.flush()

    for sede_data in body.sedes:
        db.add(ContractSede(contract_id=contract.id, **sede_data.model_dump()))

    for contact_data in body.contacts:
        db.add(ContractContact(contract_id=contract.id, **contact_data.model_dump()))

    await log_action(db, "contract_created", "contract", str(contract.id), user_id=current_user.id)
    await db.refresh(contract)
    return contract


@router.get("", response_model=List[ContractResponse], summary="Listar contratos")
async def list_contracts(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("contract:read")),
):
    result = await db.execute(select(Contract).order_by(Contract.code))
    return result.scalars().all()


@router.get("/{contract_id}", response_model=ContractResponse, summary="Obtener contrato")
async def get_contract(
    contract_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("contract:read")),
):
    result = await db.execute(select(Contract).where(Contract.id == contract_id))
    contract = result.scalar_one_or_none()
    if not contract:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contrato no encontrado")
    return contract


@router.put("/{contract_id}", response_model=ContractResponse, summary="Actualizar contrato")
async def update_contract(
    contract_id: UUID,
    body: ContractUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("contract:update")),
):
    result = await db.execute(select(Contract).where(Contract.id == contract_id))
    contract = result.scalar_one_or_none()
    if not contract:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contrato no encontrado")
    before = {"status": _ev(contract.status), "name": contract.name}
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(contract, field, val)
    await log_action(db, "contract_updated", "contract", str(contract_id), user_id=current_user.id, before_state=before)
    return contract


@router.post("/{contract_id}/sedes", response_model=ContractSedeResponse, status_code=status.HTTP_201_CREATED)
async def add_sede(
    contract_id: UUID,
    body: ContractSedeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("contract:update")),
):
    sede = ContractSede(contract_id=contract_id, **body.model_dump())
    db.add(sede)
    await db.flush()
    await log_action(db, "sede_added", "contract_sede", str(sede.id), user_id=current_user.id)
    return sede


@router.post("/fleets", response_model=FleetResponse, status_code=status.HTTP_201_CREATED, summary="Crear flota")
async def create_fleet(
    body: FleetCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("fleet:create")),
):
    fleet = Fleet(contract_id=body.contract_id, name=body.name, description=body.description)
    db.add(fleet)
    await db.flush()
    await log_action(db, "fleet_created", "fleet", str(fleet.id), user_id=current_user.id)
    return fleet


@router.get("/{contract_id}/fleets", response_model=List[FleetResponse], summary="Flotas de un contrato")
async def list_fleets(
    contract_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("fleet:read")),
):
    result = await db.execute(select(Fleet).where(Fleet.contract_id == contract_id, Fleet.is_active == True))
    return result.scalars().all()


@router.post("/operational-costs", response_model=OperationalCostResponse, status_code=status.HTTP_201_CREATED, summary="Registrar costo operativo")
async def create_cost(
    body: OperationalCostCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("cost:create")),
):
    cost = OperationalCost(**body.model_dump(), created_by_id=current_user.id)
    db.add(cost)
    await db.flush()
    await log_action(db, "operational_cost_created", "operational_cost", str(cost.id), user_id=current_user.id)
    return cost


@router.get("/{contract_id}/operational-costs", response_model=List[OperationalCostResponse], summary="Costos operativos del contrato")
async def list_costs(
    contract_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("cost:read")),
):
    result = await db.execute(select(OperationalCost).where(OperationalCost.contract_id == contract_id))
    return result.scalars().all()


@router.post("/{contract_id}/contacts", response_model=ContractContactResponse, status_code=status.HTTP_201_CREATED, summary="Agregar contacto al contrato")
async def add_contact(
    contract_id: UUID,
    body: ContractContactCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("contract:update")),
):
    contact = ContractContact(contract_id=contract_id, **body.model_dump())
    db.add(contact)
    await db.flush()
    await log_action(db, "contact_added", "contract_contact", str(contact.id), user_id=current_user.id)
    return contact


@router.delete("/contacts/{contact_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Eliminar contacto")
async def delete_contact(
    contact_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("contract:update")),
):
    result = await db.execute(select(ContractContact).where(ContractContact.id == contact_id))
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contacto no encontrado")
    await db.delete(contact)
    await log_action(db, "contact_deleted", "contract_contact", str(contact_id), user_id=current_user.id)
