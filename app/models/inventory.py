import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Numeric, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum
from app.database import Base


class PeriodStatus(str, enum.Enum):
    OPEN = "open"
    RECONCILING = "reconciling"
    CLOSED = "closed"


class PeriodType(str, enum.Enum):
    WEEKLY = "weekly"
    BIWEEKLY = "biweekly"
    MONTHLY = "monthly"
    BIMONTHLY = "bimonthly"


class InventoryPeriod(Base):
    __tablename__ = "inventory_periods"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contract_id = Column(UUID(as_uuid=True), ForeignKey("contracts.id"), nullable=False)
    sede_id = Column(UUID(as_uuid=True), ForeignKey("contract_sedes.id"), nullable=True)
    workstation = Column(String(100), nullable=True)
    period_label = Column(String(10), nullable=False)  # e.g. "2026-06"
    period_start = Column(DateTime(timezone=True), nullable=False)
    period_end = Column(DateTime(timezone=True), nullable=False)
    period_type = Column(String(50), default="monthly", nullable=False)
    status = Column(String(50), default="open", nullable=False)
    notes = Column(Text, nullable=True)
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    closed_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    closed_at = Column(DateTime(timezone=True), nullable=True)

    contract = relationship("Contract")
    sede = relationship("ContractSede")
    created_by = relationship("User", foreign_keys=[created_by_id])
    closed_by = relationship("User", foreign_keys=[closed_by_id])
    items = relationship("InventoryPeriodItem", back_populates="period", lazy="selectin", cascade="all, delete-orphan")


class InventoryPeriodItem(Base):
    __tablename__ = "inventory_period_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    period_id = Column(UUID(as_uuid=True), ForeignKey("inventory_periods.id", ondelete="CASCADE"), nullable=False)
    supply_id = Column(UUID(as_uuid=True), ForeignKey("supplies.id"), nullable=False)
    initial_stock = Column(Numeric(15, 4), default=0, nullable=False)
    entries = Column(Numeric(15, 4), default=0, nullable=False)       # ingresos del periodo
    adjustments = Column(Numeric(15, 4), default=0, nullable=False)    # ajustes manuales (+/-)
    final_stock_physical = Column(Numeric(15, 4), nullable=True)       # conteo físico real
    theoretical_consumption = Column(Numeric(15, 4), default=0, nullable=False)  # calculado por sistema
    difference = Column(Numeric(15, 4), nullable=True)   # final_physical - (initial + entries + adjustments - theoretical)
    deviation_pct = Column(Float, nullable=True)          # difference / theoretical * 100
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    period = relationship("InventoryPeriod", back_populates="items")
    supply = relationship("Supply", lazy="selectin")


class ServiceCostWeight(Base):
    """Pesos por tipo de servicio para costeo por media funcional (Sección 5)."""
    __tablename__ = "service_cost_weights"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    formula_version = Column(String(20), nullable=False)
    service_type = Column(String(50), nullable=False)
    weight = Column(Numeric(8, 4), nullable=False, default=1.0)
    is_active = Column(Boolean, default=True, nullable=False)
    notes = Column(String(255), nullable=True)
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    created_by = relationship("User", foreign_keys=[created_by_id])
