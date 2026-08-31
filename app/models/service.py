import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import enum
from app.database import Base


class ServiceStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROCESS = "in_process"
    ON_HOLD = "on_hold"
    FINISHED = "finished"
    CANCELLED = "cancelled"
    REPROCESSED = "reprocessed"
    BLOCKED = "blocked"


class ServiceType(str, enum.Enum):
    BASIC_WASH = "basic_wash"
    FULL_WASH = "full_wash"
    PREMIUM_WASH = "premium_wash"
    ENGINE_WASH = "engine_wash"
    INTERIOR_DETAIL = "interior_detail"
    FULL_DETAIL = "full_detail"


class EventType(str, enum.Enum):
    CREATED = "created"
    STARTED = "started"
    OPERATOR_ASSIGNED = "operator_assigned"
    OPERATOR_REASSIGNED = "operator_reassigned"
    PAUSED = "paused"
    RESUMED = "resumed"
    SUPPLY_USED = "supply_used"
    SUPERVISED = "supervised"
    COMPLIANCE_COMPLETED = "compliance_completed"
    FINISHED = "finished"
    CANCELLED = "cancelled"
    BLOCKED = "blocked"
    REPROCESSED = "reprocessed"
    CORRECTED = "corrected"
    NOTE_ADDED = "note_added"


class Service(Base):
    __tablename__ = "services"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(50), unique=True, nullable=False, index=True)
    contract_id = Column(UUID(as_uuid=True), ForeignKey("contracts.id"), nullable=False)
    sede_id = Column(UUID(as_uuid=True), ForeignKey("contract_sedes.id"), nullable=False)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.id"), nullable=False)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=True)
    service_type = Column(String(50), nullable=False)
    status = Column(String(50), default="pending", nullable=False)
    operator_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    supervisor_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    finished_at = Column(DateTime(timezone=True), nullable=True)
    compliance_format_completed = Column(Boolean, default=False, nullable=False)
    block_reason = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    contract = relationship("Contract", back_populates="services")
    sede = relationship("ContractSede", back_populates="services")
    vehicle = relationship("Vehicle", back_populates="services")
    client = relationship("Client", back_populates="services")
    operator = relationship("User", foreign_keys=[operator_id], back_populates="operated_services")
    supervisor = relationship("User", foreign_keys=[supervisor_id])
    created_by = relationship("User", foreign_keys=[created_by_id], back_populates="created_services")
    events = relationship("ServiceEvent", back_populates="service", order_by="ServiceEvent.created_at", lazy="selectin")
    supply_usages = relationship("ServiceSupplyUsage", back_populates="service")
    prefactura_items = relationship("PreFacturaItem", back_populates="service")


class ServiceEvent(Base):
    """Registro inmutable de eventos del servicio (requerimiento 6.2)."""
    __tablename__ = "service_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    service_id = Column(UUID(as_uuid=True), ForeignKey("services.id"), nullable=False)
    event_type = Column(String(50), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    role_at_time = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    event_metadata = Column(JSONB, nullable=True)
    environmental_impact = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    service = relationship("Service", back_populates="events")
    user = relationship("User", back_populates="service_events")
    supply_usages = relationship("ServiceSupplyUsage", back_populates="event")
