from typing import List, Optional
from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.database import get_db
from app.models.consulting import (
    Consultant, ConsultantDocument, Assignment, AssignmentEvent,
    ClosureReport, ClosureReportAttachment,
    AssignmentStatus,
)
from app.models.user import User
from app.schemas.consulting import (
    ConsultantCreate, ConsultantUpdate, ConsultantResponse,
    ConsultantDocumentCreate, ConsultantDocumentResponse,
    AssignmentCreate, AssignmentUpdate, AssignmentResponse,
    AssignmentStatusChange,
    ClosureReportCreate, ClosureReportUpdate, ClosureReportResponse,
    ClosureReportValidate,
    ClosureReportAttachmentCreate, ClosureReportAttachmentResponse,
)
from app.core.audit_logger import log_action
from app.dependencies import require_permission

router = APIRouter(prefix="/consulting", tags=["Consultoría"])

# ────────────────────────────────────────────────
# CONSULTANTS
# ────────────────────────────────────────────────

@router.post("/consultants", response_model=ConsultantResponse, status_code=201, summary="Registrar consultor")
async def create_consultant(
    body: ConsultantCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("consultant:create")),
):
    consultant = Consultant(**body.model_dump())
    db.add(consultant)
    await db.flush()
    await log_action(db, "consultant_created", "consultant", str(consultant.id), user_id=current_user.id)
    await db.refresh(consultant)
    return consultant


@router.get("/consultants", response_model=List[ConsultantResponse], summary="Listar consultores")
async def list_consultants(
    q: Optional[str] = Query(None),
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("consultant:read")),
):
    query = select(Consultant)
    filters = []
    if active_only:
        filters.append(Consultant.is_active == True)
    if q:
        filters.append(Consultant.full_name.ilike(f"%{q}%"))
    if filters:
        query = query.where(and_(*filters))
    result = await db.execute(query.order_by(Consultant.full_name))
    return result.scalars().all()


@router.get("/consultants/{consultant_id}", response_model=ConsultantResponse, summary="Obtener consultor")
async def get_consultant(
    consultant_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("consultant:read")),
):
    result = await db.execute(select(Consultant).where(Consultant.id == consultant_id))
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Consultor no encontrado")
    return c


@router.put("/consultants/{consultant_id}", response_model=ConsultantResponse, summary="Actualizar consultor")
async def update_consultant(
    consultant_id: UUID,
    body: ConsultantUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("consultant:update")),
):
    result = await db.execute(select(Consultant).where(Consultant.id == consultant_id))
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Consultor no encontrado")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(c, field, val)
    await log_action(db, "consultant_updated", "consultant", str(consultant_id), user_id=current_user.id)
    return c


@router.post("/consultants/{consultant_id}/documents", response_model=ConsultantDocumentResponse, status_code=201, summary="Agregar documento al dossier")
async def add_document(
    consultant_id: UUID,
    body: ConsultantDocumentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("consultant:update")),
):
    result = await db.execute(select(Consultant).where(Consultant.id == consultant_id))
    if not result.scalar_one_or_none():
        raise HTTPException(404, "Consultor no encontrado")

    doc = ConsultantDocument(
        consultant_id=consultant_id,
        uploaded_by_id=current_user.id,
        **body.model_dump(),
    )
    db.add(doc)
    await db.flush()
    await log_action(db, "consultant_document_added", "consultant_document", str(doc.id), user_id=current_user.id)
    await db.refresh(doc)
    return doc


@router.delete("/consultants/documents/{doc_id}", status_code=204, summary="Eliminar documento del dossier")
async def delete_document(
    doc_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("consultant:update")),
):
    result = await db.execute(select(ConsultantDocument).where(ConsultantDocument.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "Documento no encontrado")
    await db.delete(doc)
    await log_action(db, "consultant_document_deleted", "consultant_document", str(doc_id), user_id=current_user.id)


# ────────────────────────────────────────────────
# ASSIGNMENTS / LLAMADOS
# ────────────────────────────────────────────────

VALID_TRANSITIONS = {
    "draft": ["pending_docs", "cancelled"],
    "pending_docs": ["internal_validation", "draft", "cancelled"],
    "internal_validation": ["sent_to_client", "pending_docs", "cancelled"],
    "sent_to_client": ["pending_client", "internal_validation", "cancelled"],
    "pending_client": ["approved", "sent_to_client", "cancelled"],
    "approved": ["in_operation", "cancelled"],
    "in_operation": ["pending_closure", "suspended"],
    "pending_closure": ["finalized", "in_operation"],
    "suspended": ["in_operation", "cancelled"],
    "finalized": [],
    "cancelled": [],
}


def _assert_transition(current: str, target: str):
    if target not in VALID_TRANSITIONS.get(current, []):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"No se puede pasar de '{current}' a '{target}'",
        )


@router.post("/assignments", response_model=AssignmentResponse, status_code=201, summary="Crear llamado/asignación")
async def create_assignment(
    body: AssignmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("assignment:create")),
):
    existing = await db.execute(select(Assignment).where(Assignment.code == body.code))
    if existing.scalar_one_or_none():
        raise HTTPException(409, "Código de asignación ya existe")

    assignment = Assignment(
        **body.model_dump(),
        created_by_id=current_user.id,
    )
    db.add(assignment)
    await db.flush()

    db.add(AssignmentEvent(
        assignment_id=assignment.id,
        event_type="created",
        user_id=current_user.id,
        description="Asignación creada en estado borrador",
    ))

    await log_action(db, "assignment_created", "assignment", str(assignment.id), user_id=current_user.id)
    await db.refresh(assignment)
    return assignment


@router.get("/assignments", response_model=List[AssignmentResponse], summary="Listar asignaciones")
async def list_assignments(
    contract_id: Optional[UUID] = Query(None),
    consultant_id: Optional[UUID] = Query(None),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("assignment:read")),
):
    q = select(Assignment)
    filters = []
    if contract_id:
        filters.append(Assignment.contract_id == contract_id)
    if consultant_id:
        filters.append(Assignment.consultant_id == consultant_id)
    if status:
        filters.append(Assignment.status == status)
    if filters:
        q = q.where(and_(*filters))
    result = await db.execute(q.order_by(Assignment.opened_at.desc()))
    return result.scalars().all()


@router.get("/assignments/{assignment_id}", response_model=AssignmentResponse, summary="Obtener asignación")
async def get_assignment(
    assignment_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("assignment:read")),
):
    result = await db.execute(select(Assignment).where(Assignment.id == assignment_id))
    a = result.scalar_one_or_none()
    if not a:
        raise HTTPException(404, "Asignación no encontrada")
    return a


@router.put("/assignments/{assignment_id}", response_model=AssignmentResponse, summary="Actualizar datos básicos de la asignación")
async def update_assignment(
    assignment_id: UUID,
    body: AssignmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("assignment:manage")),
):
    result = await db.execute(select(Assignment).where(Assignment.id == assignment_id))
    a = result.scalar_one_or_none()
    if not a:
        raise HTTPException(404, "Asignación no encontrada")
    if a.status in ("finalized", "cancelled"):
        raise HTTPException(400, "No se puede modificar una asignación finalizada o cancelada")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(a, field, val)
    await log_action(db, "assignment_updated", "assignment", str(assignment_id), user_id=current_user.id)
    return a


def _make_transition_router(target_status: str, event_type: str, description_template: str):
    """Factory para los endpoints de transición de estado."""
    async def handler(
        assignment_id: UUID,
        body: AssignmentStatusChange = AssignmentStatusChange(),
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(require_permission("assignment:manage")),
    ):
        result = await db.execute(select(Assignment).where(Assignment.id == assignment_id))
        a = result.scalar_one_or_none()
        if not a:
            raise HTTPException(404, "Asignación no encontrada")

        # Validación especial: para finalizar se requiere reporte de cierre aprobado
        if target_status == "finalized":
            if not a.closure_report:
                raise HTTPException(400, "Se requiere un reporte de cierre antes de finalizar")
            if a.closure_report.internal_status != "approved" or a.closure_report.client_status != "approved":
                raise HTTPException(400, "El reporte de cierre requiere validación interna y del cliente")

        _assert_transition(a.status, target_status)
        before_status = a.status
        a.status = target_status

        if target_status in ("finalized", "cancelled"):
            a.closed_at = datetime.utcnow()

        db.add(AssignmentEvent(
            assignment_id=a.id,
            event_type=event_type,
            user_id=current_user.id,
            description=body.notes or description_template,
            event_metadata={"from": before_status, "to": target_status},
        ))

        await log_action(
            db, f"assignment_{event_type}", "assignment", str(assignment_id),
            user_id=current_user.id,
            before_state={"status": before_status},
            after_state={"status": target_status},
        )
        await db.refresh(a)
        return a
    return handler


@router.post("/assignments/{assignment_id}/submit", response_model=AssignmentResponse, summary="Enviar a revisión de documentos")
async def submit_assignment(
    assignment_id: UUID,
    body: AssignmentStatusChange = AssignmentStatusChange(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("assignment:manage")),
):
    return await _make_transition_router("pending_docs", "submitted", "Asignación enviada a revisión de documentos")(
        assignment_id, body, db, current_user
    )


@router.post("/assignments/{assignment_id}/validate-internal", response_model=AssignmentResponse, summary="Iniciar validación interna")
async def validate_internal(
    assignment_id: UUID,
    body: AssignmentStatusChange = AssignmentStatusChange(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("assignment:manage")),
):
    return await _make_transition_router("internal_validation", "internal_validation_started", "Documentos listos, iniciando validación interna")(
        assignment_id, body, db, current_user
    )


@router.post("/assignments/{assignment_id}/send-to-client", response_model=AssignmentResponse, summary="Enviar al cliente")
async def send_to_client(
    assignment_id: UUID,
    body: AssignmentStatusChange = AssignmentStatusChange(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("assignment:manage")),
):
    return await _make_transition_router("sent_to_client", "sent_to_client", "Asignación enviada al cliente para aprobación")(
        assignment_id, body, db, current_user
    )


@router.post("/assignments/{assignment_id}/pending-client", response_model=AssignmentResponse, summary="Marcar pendiente de aprobación cliente")
async def pending_client(
    assignment_id: UUID,
    body: AssignmentStatusChange = AssignmentStatusChange(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("assignment:manage")),
):
    return await _make_transition_router("pending_client", "pending_client_approval", "Pendiente de aprobación del cliente")(
        assignment_id, body, db, current_user
    )


@router.post("/assignments/{assignment_id}/approve", response_model=AssignmentResponse, summary="Aprobar asignación")
async def approve_assignment(
    assignment_id: UUID,
    body: AssignmentStatusChange = AssignmentStatusChange(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("assignment:manage")),
):
    return await _make_transition_router("approved", "approved", "Asignación aprobada")(
        assignment_id, body, db, current_user
    )


@router.post("/assignments/{assignment_id}/start-operation", response_model=AssignmentResponse, summary="Iniciar operación en campo")
async def start_operation(
    assignment_id: UUID,
    body: AssignmentStatusChange = AssignmentStatusChange(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("assignment:manage")),
):
    return await _make_transition_router("in_operation", "operation_started", "Consultor en operación en campo")(
        assignment_id, body, db, current_user
    )


@router.post("/assignments/{assignment_id}/request-closure", response_model=AssignmentResponse, summary="Solicitar reporte de cierre")
async def request_closure(
    assignment_id: UUID,
    body: AssignmentStatusChange = AssignmentStatusChange(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("assignment:manage")),
):
    return await _make_transition_router("pending_closure", "closure_requested", "Operación completada, pendiente reporte de cierre")(
        assignment_id, body, db, current_user
    )


@router.post("/assignments/{assignment_id}/finalize", response_model=AssignmentResponse, summary="Finalizar asignación")
async def finalize_assignment(
    assignment_id: UUID,
    body: AssignmentStatusChange = AssignmentStatusChange(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("assignment:manage")),
):
    return await _make_transition_router("finalized", "finalized", "Asignación finalizada")(
        assignment_id, body, db, current_user
    )


@router.post("/assignments/{assignment_id}/suspend", response_model=AssignmentResponse, summary="Suspender asignación")
async def suspend_assignment(
    assignment_id: UUID,
    body: AssignmentStatusChange = AssignmentStatusChange(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("assignment:manage")),
):
    return await _make_transition_router("suspended", "suspended", "Asignación suspendida")(
        assignment_id, body, db, current_user
    )


@router.post("/assignments/{assignment_id}/reactivate", response_model=AssignmentResponse, summary="Reactivar asignación suspendida")
async def reactivate_assignment(
    assignment_id: UUID,
    body: AssignmentStatusChange = AssignmentStatusChange(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("assignment:manage")),
):
    return await _make_transition_router("in_operation", "reactivated", "Asignación reactivada")(
        assignment_id, body, db, current_user
    )


@router.post("/assignments/{assignment_id}/cancel", response_model=AssignmentResponse, summary="Cancelar asignación")
async def cancel_assignment(
    assignment_id: UUID,
    body: AssignmentStatusChange = AssignmentStatusChange(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("assignment:manage")),
):
    return await _make_transition_router("cancelled", "cancelled", "Asignación cancelada")(
        assignment_id, body, db, current_user
    )


# ────────────────────────────────────────────────
# CLOSURE REPORTS
# ────────────────────────────────────────────────

@router.post("/closure-reports", response_model=ClosureReportResponse, status_code=201, summary="Crear reporte de cierre")
async def create_closure_report(
    body: ClosureReportCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("closure_report:create")),
):
    # Verificar que la asignación existe y está en pending_closure
    a_result = await db.execute(select(Assignment).where(Assignment.id == body.assignment_id))
    assignment = a_result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(404, "Asignación no encontrada")
    if assignment.status != "pending_closure":
        raise HTTPException(400, f"La asignación debe estar en 'pending_closure', estado actual: {assignment.status}")

    # Solo un reporte por asignación
    existing = await db.execute(select(ClosureReport).where(ClosureReport.assignment_id == body.assignment_id))
    if existing.scalar_one_or_none():
        raise HTTPException(409, "Ya existe un reporte de cierre para esta asignación")

    report = ClosureReport(
        **body.model_dump(),
        created_by_id=current_user.id,
    )
    db.add(report)
    await db.flush()

    db.add(AssignmentEvent(
        assignment_id=body.assignment_id,
        event_type="closure_report_created",
        user_id=current_user.id,
        description="Reporte de cierre creado",
    ))

    await log_action(db, "closure_report_created", "closure_report", str(report.id), user_id=current_user.id)
    await db.refresh(report)
    return report


@router.get("/closure-reports/{report_id}", response_model=ClosureReportResponse, summary="Obtener reporte de cierre")
async def get_closure_report(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("closure_report:read")),
):
    result = await db.execute(select(ClosureReport).where(ClosureReport.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(404, "Reporte no encontrado")
    return report


@router.get("/assignments/{assignment_id}/closure-report", response_model=ClosureReportResponse, summary="Reporte de cierre por asignación")
async def get_closure_by_assignment(
    assignment_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("closure_report:read")),
):
    result = await db.execute(select(ClosureReport).where(ClosureReport.assignment_id == assignment_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(404, "No existe reporte de cierre para esta asignación")
    return report


@router.put("/closure-reports/{report_id}", response_model=ClosureReportResponse, summary="Actualizar reporte de cierre")
async def update_closure_report(
    report_id: UUID,
    body: ClosureReportUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("closure_report:create")),
):
    result = await db.execute(select(ClosureReport).where(ClosureReport.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(404, "Reporte no encontrado")
    if report.internal_status == "approved" and report.client_status == "approved":
        raise HTTPException(400, "No se puede modificar un reporte completamente aprobado")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(report, field, val)
    return report


@router.post("/closure-reports/{report_id}/validate-internal", response_model=ClosureReportResponse, summary="Validación interna del reporte")
async def validate_internal_report(
    report_id: UUID,
    body: ClosureReportValidate,
    approve: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("closure_report:validate_internal")),
):
    result = await db.execute(select(ClosureReport).where(ClosureReport.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(404, "Reporte no encontrado")

    report.internal_status = "approved" if approve else "rejected"
    report.internal_validated_by_id = current_user.id
    report.internal_validated_at = datetime.utcnow()
    if body.notes:
        report.internal_notes = body.notes

    a_result = await db.execute(select(Assignment).where(Assignment.id == report.assignment_id))
    assignment = a_result.scalar_one_or_none()
    db.add(AssignmentEvent(
        assignment_id=report.assignment_id,
        event_type="closure_report_internal_validated",
        user_id=current_user.id,
        description=f"Validación interna: {'aprobado' if approve else 'rechazado'}",
        event_metadata={"result": report.internal_status},
    ))

    await log_action(db, "closure_report_internal_validated", "closure_report", str(report_id), user_id=current_user.id)
    return report


@router.post("/closure-reports/{report_id}/validate-client", response_model=ClosureReportResponse, summary="Validación del cliente del reporte")
async def validate_client_report(
    report_id: UUID,
    body: ClosureReportValidate,
    approve: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("closure_report:validate_client")),
):
    result = await db.execute(select(ClosureReport).where(ClosureReport.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(404, "Reporte no encontrado")
    if report.internal_status != "approved":
        raise HTTPException(400, "Primero se requiere la validación interna")

    report.client_status = "approved" if approve else "rejected"
    report.client_validated_at = datetime.utcnow()
    if body.validator_name:
        report.client_validator_name = body.validator_name
    if body.notes:
        report.client_notes = body.notes

    db.add(AssignmentEvent(
        assignment_id=report.assignment_id,
        event_type="closure_report_client_validated",
        user_id=current_user.id,
        description=f"Validación cliente: {'aprobado' if approve else 'rechazado'}",
        event_metadata={"result": report.client_status},
    ))

    await log_action(db, "closure_report_client_validated", "closure_report", str(report_id), user_id=current_user.id)
    return report


@router.post("/closure-reports/{report_id}/attachments", response_model=ClosureReportAttachmentResponse, status_code=201, summary="Agregar adjunto al reporte")
async def add_attachment(
    report_id: UUID,
    body: ClosureReportAttachmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("closure_report:create")),
):
    result = await db.execute(select(ClosureReport).where(ClosureReport.id == report_id))
    if not result.scalar_one_or_none():
        raise HTTPException(404, "Reporte no encontrado")

    att = ClosureReportAttachment(
        report_id=report_id,
        uploaded_by_id=current_user.id,
        **body.model_dump(),
    )
    db.add(att)
    await db.flush()
    await db.refresh(att)
    return att


@router.delete("/closure-reports/attachments/{att_id}", status_code=204, summary="Eliminar adjunto")
async def delete_attachment(
    att_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("closure_report:create")),
):
    result = await db.execute(select(ClosureReportAttachment).where(ClosureReportAttachment.id == att_id))
    att = result.scalar_one_or_none()
    if not att:
        raise HTTPException(404, "Adjunto no encontrado")
    await db.delete(att)
