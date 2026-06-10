import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Numeric, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum
from app.database import Base


class SupplyCategory(str, enum.Enum):
    CLEANING_AGENT = "cleaning_agent"
    WATER = "water"
    EQUIPMENT = "equipment"
    PROTECTIVE = "protective"
    OTHER = "other"


class Supply(Base):
    __tablename__ = "supplies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    unit = Column(String(30), nullable=False)
    unit_cost = Column(Numeric(15, 4), nullable=False)
    category = Column(Enum(SupplyCategory, native_enum=False), default=SupplyCategory.OTHER, nullable=False)
    description = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    usages = relationship("ServiceSupplyUsage", back_populates="supply")


class ServiceSupplyUsage(Base):
    """Registro de insumos usados por evento de servicio."""
    __tablename__ = "service_supply_usages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    service_id = Column(UUID(as_uuid=True), ForeignKey("services.id"), nullable=False)
    event_id = Column(UUID(as_uuid=True), ForeignKey("service_events.id"), nullable=True)
    supply_id = Column(UUID(as_uuid=True), ForeignKey("supplies.id"), nullable=False)
    quantity = Column(Numeric(10, 3), nullable=False)
    unit_cost_at_time = Column(Numeric(15, 4), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    service = relationship("Service", back_populates="supply_usages")
    event = relationship("ServiceEvent", back_populates="supply_usages")
    supply = relationship("Supply", back_populates="usages", lazy="selectin")
