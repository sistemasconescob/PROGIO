import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, Integer, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum
from app.database import Base


class VehicleType(str, enum.Enum):
    SEDAN = "sedan"
    SUV = "suv"
    PICKUP = "pickup"
    BUS = "bus"
    TRUCK = "truck"
    MOTORCYCLE = "motorcycle"
    VAN = "van"
    OTHER = "other"


class FuelType(str, enum.Enum):
    GASOLINE = "gasoline"
    DIESEL = "diesel"
    ELECTRIC = "electric"
    HYBRID = "hybrid"
    GAS = "gas"


class PeriodType(str, enum.Enum):
    WEEKLY = "weekly"
    BIWEEKLY = "biweekly"
    MONTHLY = "monthly"
    BIMONTHLY = "bimonthly"


class Vehicle(Base):
    __tablename__ = "vehicles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plate = Column(String(20), unique=True, nullable=False, index=True)
    brand = Column(String(100), nullable=False)
    model = Column(String(100), nullable=False)
    year = Column(Integer, nullable=True)
    vehicle_type = Column(String(50), nullable=False)
    fuel_type = Column(String(50), nullable=False)
    color = Column(String(50), nullable=True)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=True)
    fleet_id = Column(UUID(as_uuid=True), ForeignKey("fleets.id"), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    client = relationship("Client", back_populates="vehicles")
    fleet = relationship("Fleet", back_populates="vehicles")
    contract_configs = relationship("VehicleContractConfig", back_populates="vehicle")
    services = relationship("Service", back_populates="vehicle")


class VehicleContractConfig(Base):
    """Configuración por vehículo en contrato In House: límite de servicios por periodo."""
    __tablename__ = "vehicle_contract_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False)
    contract_id = Column(UUID(as_uuid=True), ForeignKey("contracts.id", ondelete="CASCADE"), nullable=False)
    max_services_per_period = Column(Integer, nullable=False, default=2)
    period_type = Column(String(50), default="monthly", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    __table_args__ = (UniqueConstraint("vehicle_id", "contract_id", name="uq_vehicle_contract"),)

    vehicle = relationship("Vehicle", back_populates="contract_configs")
    contract = relationship("Contract", back_populates="vehicle_configs")
