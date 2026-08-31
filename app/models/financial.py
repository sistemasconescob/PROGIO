import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Numeric, Integer, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum
from app.database import Base


class PreFacturaStatus(str, enum.Enum):
    DRAFT = "draft"
    APPROVED = "approved"
    BILLED = "billed"
    CANCELLED = "cancelled"


class PreFactura(Base):
    """Prefacturación obligatoria (requerimiento 7.3)."""
    __tablename__ = "prefacturas"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(50), unique=True, nullable=False, index=True)
    contract_id = Column(UUID(as_uuid=True), ForeignKey("contracts.id"), nullable=False)
    status = Column(String(50), default="draft", nullable=False)
    total_amount = Column(Numeric(15, 2), nullable=False, default=0)
    period_start = Column(DateTime(timezone=True), nullable=False)
    period_end = Column(DateTime(timezone=True), nullable=False)
    notes = Column(String(1000), nullable=True)
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    approved_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    contract = relationship("Contract", back_populates="prefacturas")
    items = relationship("PreFacturaItem", back_populates="prefactura", lazy="selectin")
    created_by = relationship("User", foreign_keys=[created_by_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])


class PreFacturaItem(Base):
    __tablename__ = "prefactura_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    prefactura_id = Column(UUID(as_uuid=True), ForeignKey("prefacturas.id", ondelete="CASCADE"), nullable=False)
    service_id = Column(UUID(as_uuid=True), ForeignKey("services.id"), nullable=True)
    description = Column(String(500), nullable=False)
    quantity = Column(Numeric(10, 2), nullable=False)
    unit_price = Column(Numeric(15, 2), nullable=False)
    subtotal = Column(Numeric(15, 2), nullable=False)

    prefactura = relationship("PreFactura", back_populates="items")
    service = relationship("Service", back_populates="prefactura_items")


class EnvironmentalConfig(Base):
    """Configuración para cálculo de indicadores ambientales (requerimiento 8.2)."""
    __tablename__ = "environmental_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vehicle_type = Column(String(50), nullable=False)
    fuel_type = Column(String(50), nullable=False)
    co2_per_km = Column(Float, nullable=False)
    water_saved_per_wash = Column(Float, nullable=False, default=150.0)
    standard_km = Column(Float, nullable=False, default=10.0)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
