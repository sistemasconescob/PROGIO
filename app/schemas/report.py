from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime


class ReportFilter(BaseModel):
    contract_id: Optional[UUID] = None
    sede_id: Optional[UUID] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    format: str = "json"


class EnvironmentalReportRow(BaseModel):
    date: str
    service_count: int
    water_saved_liters: float
    co2_avoided_kg: float
    vehicle_type: Optional[str] = None


class EnvironmentalReport(BaseModel):
    period: str
    total_services: int
    total_water_saved_liters: float
    total_co2_avoided_kg: float
    rows: List[EnvironmentalReportRow]


class OperationsReportRow(BaseModel):
    date: str
    service_id: str
    code: str
    vehicle_plate: str
    service_type: str
    status: str
    operator_name: Optional[str] = None
    duration_minutes: Optional[float] = None
    sede_name: str


class OperationsReport(BaseModel):
    period: str
    total_services: int
    by_status: Dict[str, int]
    by_type: Dict[str, int]
    rows: List[OperationsReportRow]


class ProductivityRow(BaseModel):
    operator_id: str
    operator_name: str
    total_services: int
    finished_services: int
    avg_duration_minutes: Optional[float] = None


class ProductivityReport(BaseModel):
    period: str
    rows: List[ProductivityRow]


class IncomeReportRow(BaseModel):
    period: str
    total_income: float
    total_cost: float
    operating_margin: float
    service_count: int


class IncomeReport(BaseModel):
    period: str
    total_income: float
    total_cost: float
    operating_margin: float
    rows: List[IncomeReportRow]
