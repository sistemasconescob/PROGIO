import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Date, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import enum
from app.database import Base


class AssignmentStatus(str, enum.Enum):
    DRAFT = "draft"
    PENDING_DOCS = "pending_docs"
    INTERNAL_VALIDATION = "internal_validation"
    SENT_TO_CLIENT = "sent_to_client"
    PENDING_CLIENT = "pending_client"
    APPROVED = "approved"
    IN_OPERATION = "in_operation"
    PENDING_CLOSURE = "pending_closure"
    FINALIZED = "finalized"
    SUSPENDED = "suspended"
    CANCELLED = "cancelled"


class DocType(str, enum.Enum):
    CV = "cv"
    CERTIFICATION = "certification"
    PROFESSIONAL_CARD = "professional_card"
    MANDATORY_COURSE = "mandatory_course"
    MEDICAL_EXAM = "medical_exam"
    VACCINE = "vaccine"
    ARL = "arl"
    LEGAL_DOC = "legal_doc"


class ValidationStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class Consultant(Base):
    __tablename__ = "consultants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name = Column(String(255), nullable=False)
    document_type = Column(String(50), nullable=True)   # cc, ce, passport
    document_number = Column(String(100), nullable=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(30), nullable=True)
    specialty = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id])
    documents = relationship("ConsultantDocument", back_populates="consultant", lazy="selectin", cascade="all, delete-orphan")
    assignments = relationship("Assignment", back_populates="consultant")


class ConsultantDocument(Base):
    """Dossier HSE del consultor con control de vigencias."""
    __tablename__ = "consultant_documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    consultant_id = Column(UUID(as_uuid=True), ForeignKey("consultants.id", ondelete="CASCADE"), nullable=False)
    doc_type = Column(String(50), nullable=False)
    name = Column(String(255), nullable=False)
    file_url = Column(String(500), nullable=True)
    issued_at = Column(Date, nullable=True)
    expires_at = Column(Date, nullable=True)
    is_critical = Column(Boolean, default=False, nullable=False)
    notes = Column(Text, nullable=True)
    uploaded_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    consultant = relationship("Consultant", back_populates="documents")
    uploaded_by = relationship("User", foreign_keys=[uploaded_by_id])


class Assignment(Base):
    """Llamado / Asignación — unidad operativa central del módulo de consultoría."""
    __tablename__ = "assignments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(50), unique=True, nullable=False, index=True)
    contract_id = Column(UUID(as_uuid=True), ForeignKey("contracts.id"), nullable=False)
    consultant_id = Column(UUID(as_uuid=True), ForeignKey("consultants.id"), nullable=False)
    position = Column(String(255), nullable=True)          # cargo/rol del consultor
    location = Column(String(255), nullable=True)          # campo/pozo/ubicación
    client_reference = Column(String(255), nullable=True)  # referencia/orden del cliente
    status = Column(String(50), default="draft", nullable=False)
    opened_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    contract = relationship("Contract")
    consultant = relationship("Consultant", back_populates="assignments")
    created_by = relationship("User", foreign_keys=[created_by_id])
    events = relationship("AssignmentEvent", back_populates="assignment", order_by="AssignmentEvent.created_at", lazy="selectin")
    closure_report = relationship("ClosureReport", back_populates="assignment", uselist=False, lazy="selectin")


class AssignmentEvent(Base):
    """Registro inmutable de eventos del llamado — auditoría total."""
    __tablename__ = "assignment_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    assignment_id = Column(UUID(as_uuid=True), ForeignKey("assignments.id"), nullable=False)
    event_type = Column(String(100), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    description = Column(Text, nullable=True)
    event_metadata = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    assignment = relationship("Assignment", back_populates="events")
    user = relationship("User", foreign_keys=[user_id])


class ClosureReport(Base):
    """Reporte de cierre — obligatorio para finalizar un llamado. Requiere validación dual."""
    __tablename__ = "closure_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    assignment_id = Column(UUID(as_uuid=True), ForeignKey("assignments.id"), unique=True, nullable=False)
    # Validación interna (Ingecoper)
    internal_status = Column(String(50), default="pending", nullable=False)
    internal_validated_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    internal_validated_at = Column(DateTime(timezone=True), nullable=True)
    internal_notes = Column(Text, nullable=True)
    # Validación del cliente
    client_status = Column(String(50), default="pending", nullable=False)
    client_validated_at = Column(DateTime(timezone=True), nullable=True)
    client_validator_name = Column(String(255), nullable=True)  # nombre del validador externo
    client_notes = Column(Text, nullable=True)
    # Contenido del reporte
    content = Column(JSONB, nullable=True)       # campos estructurados
    narrative = Column(Text, nullable=True)       # campos narrativos
    template_version = Column(String(20), default="1.0", nullable=False)
    notes = Column(Text, nullable=True)
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    assignment = relationship("Assignment", back_populates="closure_report")
    internal_validated_by = relationship("User", foreign_keys=[internal_validated_by_id])
    created_by = relationship("User", foreign_keys=[created_by_id])
    attachments = relationship("ClosureReportAttachment", back_populates="report", lazy="selectin", cascade="all, delete-orphan")


class ClosureReportAttachment(Base):
    __tablename__ = "closure_report_attachments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    report_id = Column(UUID(as_uuid=True), ForeignKey("closure_reports.id", ondelete="CASCADE"), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_url = Column(String(500), nullable=True)
    attachment_type = Column(String(50), nullable=False, default="pdf")  # pdf, acta, correo, otro
    notes = Column(Text, nullable=True)
    uploaded_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    report = relationship("ClosureReport", back_populates="attachments")
    uploaded_by = relationship("User", foreign_keys=[uploaded_by_id])
