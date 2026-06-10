import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum
from app.database import Base


class ClientType(str, enum.Enum):
    OCCASIONAL = "occasional"
    REGISTERED = "registered"


class DocumentType(str, enum.Enum):
    CC = "cc"
    NIT = "nit"
    CE = "ce"
    PASSPORT = "passport"


class Client(Base):
    __tablename__ = "clients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    type = Column(Enum(ClientType, native_enum=False), default=ClientType.OCCASIONAL, nullable=False)
    document_type = Column(Enum(DocumentType, native_enum=False), nullable=True)
    document_number = Column(String(30), nullable=True, index=True)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(30), nullable=True)
    address = Column(String(500), nullable=True)
    company_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    vehicles = relationship("Vehicle", back_populates="client")
    services = relationship("Service", back_populates="client")
