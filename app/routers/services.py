from typing import List, Optional
from uuid import UUID
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models.service import Service, ServiceEvent, ServiceStatus, EventType
from app.models.contract import Contract
from app.models.contract import ContractType
from app.models.user import User
from app.models.role import UserContractRole
from app.schemas.service import (
    ServiceCreate, ServiceResponse,
    ServiceStartRequest, ServicePauseRequest, ServiceAssignOperatorRequest,
    ServiceSuperviseRequest, ServiceCompleteComplianceRequest, ServiceFinishRequest,
    ServiceCancelRequest, ServiceReprocessRequest, ServiceAddNoteRequest,
)
from app.core.audit_logger import log_action
from app.dependencies import require_permission
from app.services.contract_rules import (
    check_in_house_service_limit, validate_contract_active, validate_service_can_close,
    generate_service_code,
)
from app.services.indicator_service import calculate_environmental_impact

router = APIRouter(prefix="/services", tags=["Servicios"])


def _ev(v) -> str:
    """Return enum .value or the string itself — handles both enum members and raw DB strings."""
    return v.value if hasattr(v, "value") else str(v)


async def _get_service_or_404(db: AsyncSession, service_id: UUID) -> Service:
    result = await db.execute(select(Service).where(Service.id == service_id))
    svc = result.scalar_one_or_none()
    if not svc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Servicio no encontrado")
    return svc


async def _get_user_role_name(db: AsyncSession, user_id: UUID, contract_id: UUID) -> Optional[str]:
    result = await db.execute(
        select(UserContractRole).where(
            UserContractRole.user_id == user_id,
            UserContractRole.contract_id == contract_id,
            UserContractRole.is_active == True,
        )
    )
    ucr = result.scalar_one_or_none()
    if ucr:
        return ucr.role.name
    return None


async def _add_event(
    db: AsyncSession, service: Service, event_type: EventType,
    user: User, description: Optional[str] = None,
    event_metadata: Optional[dict] = None, env_impact: Optional[dict] = None,
) -> ServiceEvent:
    role_name = await _get_user_role_name(db, user.id, service.contract_id)
    event = ServiceEvent(
        service_id=service.id,
        event_type=event_type,
        user_id=user.id,
        role_at_time=role_name,
        description=description,
        event_metadata=event_metadata,
        environmental_impact=env_impact,
    )
    db.add(event)
    return event


@router.post("", response_model=ServiceResponse, status_code=status.HTTP_201_CREATED, summary="Crear servicio")
async def create_service(
    body: ServiceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("service:create")),
):
    contract = await validate_contract_active(db, body.contract_id)

    seq_result = await db.execute(
        select(func.count(Service.id)).where(Service.contract_id == body.contract_id)
    )
    seq = (seq_result.scalar_one() or 0) + 1
    code = generate_service_code(contract.code, seq)

    initial_status = ServiceStatus.PENDING
    block_reason = None

    if contract.type == ContractType.IN_HOUSE:
        block_reason = await check_in_house_service_limit(db, body.vehicle_id, body.contract_id)
        if block_reason:
            initial_status = ServiceStatus.BLOCKED

    service = Service(
        code=code,
        contract_id=body.contract_id,
        sede_id=body.sede_id,
        vehicle_id=body.vehicle_id,
        client_id=body.client_id,
        service_type=body.service_type,
        status=initial_status,
        block_reason=block_reason,
        notes=body.notes,
        created_by_id=current_user.id,
    )
    db.add(service)
    await db.flush()

    event_type = EventType.BLOCKED if initial_status == ServiceStatus.BLOCKED else EventType.CREATED
    await _add_event(db, service, event_type, current_user,
                     description=block_reason or "Servicio creado",
                     event_metadata={"service_type": body.service_type.value})

    await log_action(db, "service_created", "service", str(service.id), user_id=current_user.id,
                     after_state={"status": initial_status.value, "code": code})
    await db.refresh(service)
    return service


@router.get("", response_model=List[ServiceResponse], summary="Listar servicios")
async def list_services(
    contract_id: Optional[UUID] = None,
    sede_id: Optional[UUID] = None,
    status_filter: Optional[ServiceStatus] = Query(None, alias="status"),
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("service:read")),
):
    query = select(Service)
    if contract_id:
        query = query.where(Service.contract_id == contract_id)
    if sede_id:
        query = query.where(Service.sede_id == sede_id)
    if status_filter:
        query = query.where(Service.status == status_filter)
    if date_from:
        query = query.where(Service.created_at >= date_from)
    if date_to:
        query = query.where(Service.created_at <= date_to)
    result = await db.execute(query.order_by(Service.created_at.desc()).limit(limit).offset(offset))
    return result.scalars().all()


@router.get("/{service_id}", response_model=ServiceResponse, summary="Obtener servicio")
async def get_service(
    service_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("service:read")),
):
    return await _get_service_or_404(db, service_id)


@router.post("/{service_id}/start", response_model=ServiceResponse, summary="Iniciar servicio")
async def start_service(
    service_id: UUID,
    body: ServiceStartRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("service:start")),
):
    svc = await _get_service_or_404(db, service_id)
    if svc.status != ServiceStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"El servicio no está pendiente (estado: {_ev(svc.status)})")

    before = {"status": _ev(svc.status)}
    svc.status = ServiceStatus.IN_PROCESS
    svc.operator_id = body.operator_id
    svc.started_at = datetime.now(timezone.utc)
    await _add_event(db, svc, EventType.STARTED, current_user, description="Servicio iniciado",
                     event_metadata={"operator_id": str(body.operator_id)})
    await log_action(db, "service_started", "service", str(service_id), user_id=current_user.id,
                     before_state=before, after_state={"status": _ev(svc.status)})
    return svc


@router.post("/{service_id}/assign-operator", response_model=ServiceResponse, summary="Asignar/reasignar operario")
async def assign_operator(
    service_id: UUID,
    body: ServiceAssignOperatorRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("service:assign_operator")),
):
    svc = await _get_service_or_404(db, service_id)
    if svc.status not in (ServiceStatus.PENDING, ServiceStatus.IN_PROCESS, ServiceStatus.ON_HOLD):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="No se puede asignar operario en este estado")

    event_type = EventType.OPERATOR_REASSIGNED if svc.operator_id else EventType.OPERATOR_ASSIGNED
    svc.operator_id = body.operator_id
    await _add_event(db, svc, event_type, current_user,
                     event_metadata={"operator_id": str(body.operator_id)})
    await log_action(db, "operator_assigned", "service", str(service_id), user_id=current_user.id)
    return svc


@router.post("/{service_id}/pause", response_model=ServiceResponse, summary="Pausar servicio")
async def pause_service(
    service_id: UUID,
    body: ServicePauseRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("service:pause")),
):
    svc = await _get_service_or_404(db, service_id)
    if svc.status != ServiceStatus.IN_PROCESS:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Solo se puede pausar un servicio en proceso")
    before = {"status": _ev(svc.status)}
    svc.status = ServiceStatus.ON_HOLD
    await _add_event(db, svc, EventType.PAUSED, current_user, description=body.reason)
    await log_action(db, "service_paused", "service", str(service_id), user_id=current_user.id,
                     before_state=before, after_state={"status": _ev(svc.status)})
    return svc


@router.post("/{service_id}/resume", response_model=ServiceResponse, summary="Reanudar servicio")
async def resume_service(
    service_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("service:pause")),
):
    svc = await _get_service_or_404(db, service_id)
    if svc.status != ServiceStatus.ON_HOLD:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El servicio no está pausado")
    before = {"status": _ev(svc.status)}
    svc.status = ServiceStatus.IN_PROCESS
    await _add_event(db, svc, EventType.RESUMED, current_user)
    await log_action(db, "service_resumed", "service", str(service_id), user_id=current_user.id,
                     before_state=before, after_state={"status": _ev(svc.status)})
    return svc


@router.post("/{service_id}/supervise", response_model=ServiceResponse, summary="Supervisar servicio")
async def supervise_service(
    service_id: UUID,
    body: ServiceSuperviseRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("service:supervise")),
):
    svc = await _get_service_or_404(db, service_id)
    if svc.status not in (ServiceStatus.IN_PROCESS, ServiceStatus.ON_HOLD):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El servicio no está activo")
    svc.supervisor_id = current_user.id
    await _add_event(db, svc, EventType.SUPERVISED, current_user, description=body.notes)
    await log_action(db, "service_supervised", "service", str(service_id), user_id=current_user.id)
    return svc


@router.post("/{service_id}/complete-compliance", response_model=ServiceResponse, summary="Completar formato de cumplimiento")
async def complete_compliance(
    service_id: UUID,
    body: ServiceCompleteComplianceRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("service:complete_compliance")),
):
    svc = await _get_service_or_404(db, service_id)
    if svc.status not in (ServiceStatus.IN_PROCESS, ServiceStatus.ON_HOLD):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El servicio debe estar activo")
    svc.compliance_format_completed = True
    await _add_event(db, svc, EventType.COMPLIANCE_COMPLETED, current_user, description=body.notes)
    await log_action(db, "compliance_completed", "service", str(service_id), user_id=current_user.id)
    return svc


@router.post("/{service_id}/finish", response_model=ServiceResponse, summary="Finalizar servicio")
async def finish_service(
    service_id: UUID,
    body: ServiceFinishRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("service:finish")),
):
    svc = await _get_service_or_404(db, service_id)
    if svc.status not in (ServiceStatus.IN_PROCESS, ServiceStatus.ON_HOLD):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El servicio debe estar activo para cerrarse")

    await validate_service_can_close(svc)

    before = {"status": _ev(svc.status)}
    svc.status = ServiceStatus.FINISHED
    svc.finished_at = datetime.now(timezone.utc)

    env_impact = await calculate_environmental_impact(db, svc)

    await _add_event(db, svc, EventType.FINISHED, current_user,
                     description=body.notes, env_impact=env_impact)
    await log_action(db, "service_finished", "service", str(service_id), user_id=current_user.id,
                     before_state=before, after_state={"status": _ev(svc.status)})
    return svc


@router.post("/{service_id}/cancel", response_model=ServiceResponse, summary="Cancelar servicio")
async def cancel_service(
    service_id: UUID,
    body: ServiceCancelRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("service:cancel")),
):
    svc = await _get_service_or_404(db, service_id)
    if svc.status in (ServiceStatus.FINISHED, ServiceStatus.CANCELLED):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El servicio ya fue finalizado o cancelado")
    before = {"status": _ev(svc.status)}
    svc.status = ServiceStatus.CANCELLED
    await _add_event(db, svc, EventType.CANCELLED, current_user, description=body.reason)
    await log_action(db, "service_cancelled", "service", str(service_id), user_id=current_user.id,
                     before_state=before, after_state={"status": _ev(svc.status)})
    return svc


@router.post("/{service_id}/reprocess", response_model=ServiceResponse, summary="Reprocesar servicio")
async def reprocess_service(
    service_id: UUID,
    body: ServiceReprocessRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("service:reprocess")),
):
    svc = await _get_service_or_404(db, service_id)
    if svc.status != ServiceStatus.FINISHED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Solo se pueden reprocesar servicios finalizados")
    before = {"status": _ev(svc.status)}
    svc.status = ServiceStatus.REPROCESSED
    svc.compliance_format_completed = False
    await _add_event(db, svc, EventType.REPROCESSED, current_user, description=body.reason)
    await log_action(db, "service_reprocessed", "service", str(service_id), user_id=current_user.id,
                     before_state=before, after_state={"status": _ev(svc.status)})
    return svc


@router.post("/{service_id}/notes", response_model=ServiceResponse, summary="Agregar nota al servicio")
async def add_note(
    service_id: UUID,
    body: ServiceAddNoteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("service:read")),
):
    svc = await _get_service_or_404(db, service_id)
    await _add_event(db, svc, EventType.NOTE_ADDED, current_user, description=body.note)
    return svc
