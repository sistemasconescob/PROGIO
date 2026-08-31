import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum
from app.database import Base


class ContractType(str, enum.Enum):
    IN_HOUSE = "in_house"
    SERVICE_POINT = "service_point"


class ContractStatus(str, enum.Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    EXPIRED = "expired"
    BLOCKED = "blocked"


class CostType(str, enum.Enum):
    RENT = "rent"
    UTILITIES = "utilities"
    OPERATIONAL = "operational"


class Contract(Base):
    __tablename__ = "contracts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False)
    # Identificación del cliente
    nit = Column(String(30), nullable=True)
    business_name = Column(String(255), nullable=True)
    economic_group = Column(String(255), nullable=True)
    client_company = Column(String(255), nullable=True)
    status = Column(String(50), default="active", nullable=False)
    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=False)
    description = Column(Text, nullable=True)
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    sedes = relationship("ContractSede", back_populates="contract", lazy="selectin")
    contacts = relationship("ContractContact", back_populates="contract", lazy="selectin", cascade="all, delete-orphan")
    fleets = relationship("Fleet", back_populates="contract")
    user_roles = relationship("UserContractRole", back_populates="contract")
    services = relationship("Service", back_populates="contract")
    vehicle_configs = relationship("VehicleContractConfig", back_populates="contract")
    prefacturas = relationship("PreFactura", back_populates="contract")
    operational_costs = relationship("OperationalCost", back_populates="contract")
    created_by = relationship("User", foreign_keys=[created_by_id])


class ContractContact(Base):
    """Personas de contacto asociadas al contrato."""
    __tablename__ = "contract_contacts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contract_id = Column(UUID(as_uuid=True), ForeignKey("contracts.id", ondelete="CASCADE"), nullable=False)
    full_name = Column(String(255), nullable=False)
    position = Column(String(100), nullable=True)
    phone = Column(String(30), nullable=True)
    email = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    contract = relationship("Contract", back_populates="contacts")


class ContractSede(Base):
    __tablename__ = "contract_sedes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contract_id = Column(UUID(as_uuid=True), ForeignKey("contracts.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    address = Column(String(500), nullable=True)
    city = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    contract = relationship("Contract", back_populates="sedes")
    services = relationship("Service", back_populates="sede")
    operational_costs = relationship("OperationalCost", back_populates="sede")


class Fleet(Base):
    __tablename__ = "fleets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contract_id = Column(UUID(as_uuid=True), ForeignKey("contracts.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    contract = relationship("Contract", back_populates="fleets")
    vehicles = relationship("Vehicle", back_populates="fleet")


class OperationalCost(Base):
    __tablename__ = "operational_costs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contract_id = Column(UUID(as_uuid=True), ForeignKey("contracts.id", ondelete="CASCADE"), nullable=False)
    sede_id = Column(UUID(as_uuid=True), ForeignKey("contract_sedes.id", ondelete="CASCADE"), nullable=True)
    cost_type = Column(String(50), nullable=False)
    description = Column(String(255), nullable=False)
    amount = Column(Numeric(15, 2), nullable=False)
    period = Column(String(7), nullable=False)
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    contract = relationship("Contract", back_populates="operational_costs")
    sede = relationship("ContractSede", back_populates="operational_costs")
    created_by = relationship("User", foreign_keys=[created_by_id])
