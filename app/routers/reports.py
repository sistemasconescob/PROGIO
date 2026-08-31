from typing import Optional, List
from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.service import Service, ServiceStatus
from app.models.vehicle import Vehicle
from app.models.user import User
from app.models.contract import ContractSede
from app.services.report_service import build_csv, build_pdf
from app.services.indicator_service import calculate_environmental_impact, get_environmental_config
from app.dependencies import require_permission

router = APIRouter(prefix="/reports", tags=["Reportes"])


def _ev(v) -> str:
    return v.value if hasattr(v, "value") else str(v)


def _fmt(v) -> str:
    if v is None:
        return ""
    if isinstance(v, datetime):
        return v.strftime("%Y-%m-%d %H:%M")
    return str(v)


@router.get("/services", summary="Reporte de servicios")
async def report_services(
    contract_id: Optional[UUID] = None,
    sede_id: Optional[UUID] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    format: str = Query("json", enum=["json", "csv", "pdf"]),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("report:services")),
):
    query = select(Service)
    if contract_id:
        query = query.where(Service.contract_id == contract_id)
    if sede_id:
        query = query.where(Service.sede_id == sede_id)
    if date_from:
        query = query.where(Service.created_at >= date_from)
    if date_to:
        query = query.where(Service.created_at <= date_to)

    result = await db.execute(query.order_by(Service.created_at.desc()))
    services = result.scalars().all()

    rows_data = []
    for svc in services:
        duration = None
        if svc.started_at and svc.finished_at:
            duration = round((svc.finished_at - svc.started_at).total_seconds() / 60, 1)
        rows_data.append({
            "Código": svc.code,
            "Fecha": _fmt(svc.created_at),
            "Tipo": _ev(svc.service_type),
            "Estado": _ev(svc.status),
            "Cumplimiento": "Sí" if svc.compliance_format_completed else "No",
            "Duración (min)": duration or "",
        })

    columns = ["Código", "Fecha", "Tipo", "Estado", "Cumplimiento", "Duración (min)"]
    rows = [[r[c] for c in columns] for r in rows_data]

    if format == "csv":
        data = build_csv("Reporte de Servicios PROGIO", columns, rows)
        return Response(content=data, media_type="text/csv; charset=utf-8-sig",
                        headers={"Content-Disposition": "attachment; filename=reporte_servicios.csv"})
    if format == "pdf":
        data = build_pdf("Reporte de Servicios PROGIO", columns, rows)
        return Response(content=data, media_type="application/pdf",
                        headers={"Content-Disposition": "attachment; filename=reporte_servicios.pdf"})
    return {"total": len(services), "rows": rows_data}


@router.get("/economic", summary="Reporte económico global")
async def report_economic(
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    format: str = Query("json", enum=["json", "csv", "pdf"]),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("report:income")),
):
    from app.models.financial import PreFactura, PreFacturaStatus
    from app.models.contract import Contract

    now = datetime.now()
    start = date_from or now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    end = date_to or now

    contracts_res = await db.execute(select(Contract))
    contracts = contracts_res.scalars().all()

    rows_data = []
    for contract in contracts:
        svc_res = await db.execute(
            select(func.count(Service.id)).where(
                Service.contract_id == contract.id,
                Service.created_at >= start,
                Service.created_at <= end,
            )
        )
        svc_count = svc_res.scalar_one() or 0

        pf_res = await db.execute(
            select(func.sum(PreFactura.total_amount)).where(
                PreFactura.contract_id == contract.id,
                PreFactura.status == PreFacturaStatus.APPROVED,
                PreFactura.period_start >= start,
                PreFactura.period_end <= end,
            )
        )
        total_income = float(pf_res.scalar_one() or 0)

        rows_data.append({
            "Contrato": contract.name,
            "Código": contract.code,
            "Servicios": svc_count,
            "Ingresos aprobados ($)": round(total_income, 2),
        })

    columns = ["Contrato", "Código", "Servicios", "Ingresos aprobados ($)"]
    rows = [[r[c] for c in columns] for r in rows_data]

    if format == "csv":
        data = build_csv("Reporte Económico PROGIO", columns, rows)
        return Response(content=data, media_type="text/csv; charset=utf-8-sig",
                        headers={"Content-Disposition": "attachment; filename=reporte_economico.csv"})
    if format == "pdf":
        data = build_pdf("Reporte Económico PROGIO", columns, rows)
        return Response(content=data, media_type="application/pdf",
                        headers={"Content-Disposition": "attachment; filename=reporte_economico.pdf"})
    return {"rows": rows_data}


@router.get("/pre_billing", summary="Reporte de pre-facturación")
async def report_pre_billing(
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    format: str = Query("json", enum=["json", "csv", "pdf"]),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("report:services")),
):
    from app.models.financial import PreFactura, PreFacturaStatus
    from app.models.contract import Contract

    now = datetime.now()
    start = date_from or now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    end = date_to or now

    query = select(PreFactura).where(
        PreFactura.created_at >= start,
        PreFactura.created_at <= end,
    ).order_by(PreFactura.created_at.desc())

    result = await db.execute(query)
    prefacturas = result.scalars().all()

    contracts_res = await db.execute(select(Contract))
    contracts_map = {c.id: c.code for c in contracts_res.scalars().all()}

    rows_data = []
    for pf in prefacturas:
        rows_data.append({
            "Código": pf.code,
            "Contrato": contracts_map.get(pf.contract_id, ""),
            "Período inicio": _fmt(pf.period_start),
            "Período fin": _fmt(pf.period_end),
            "Total ($)": float(pf.total_amount),
            "Estado": _ev(pf.status),
        })

    columns = ["Código", "Contrato", "Período inicio", "Período fin", "Total ($)", "Estado"]
    rows = [[r[c] for c in columns] for r in rows_data]

    if format == "csv":
        data = build_csv("Reporte Pre-Facturación PROGIO", columns, rows)
        return Response(content=data, media_type="text/csv; charset=utf-8-sig",
                        headers={"Content-Disposition": "attachment; filename=reporte_prefacturacion.csv"})
    if format == "pdf":
        data = build_pdf("Reporte Pre-Facturación PROGIO", columns, rows)
        return Response(content=data, media_type="application/pdf",
                        headers={"Content-Disposition": "attachment; filename=reporte_prefacturacion.pdf"})
    return {"total": len(prefacturas), "rows": rows_data}


@router.get("/environmental", summary="Reporte ambiental")
async def report_environmental(
    contract_id: Optional[UUID] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    format: str = Query("json", enum=["json", "csv", "pdf"]),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("report:environmental")),
):
    query = (
        select(Service)
        .where(Service.status == ServiceStatus.FINISHED)
        .options(selectinload(Service.vehicle))
    )
    if contract_id:
        query = query.where(Service.contract_id == contract_id)
    if date_from:
        query = query.where(Service.created_at >= date_from)
    if date_to:
        query = query.where(Service.created_at <= date_to)

    result = await db.execute(query.order_by(Service.created_at))
    services = result.scalars().all()

    rows_data = []
    total_water = 0.0
    total_co2 = 0.0

    for svc in services:
        impact = await calculate_environmental_impact(db, svc)
        w = impact.get("water_saved_liters", 0)
        c = impact.get("co2_avoided_kg", 0)
        total_water += w
        total_co2 += c
        rows_data.append({
            "Código": svc.code,
            "Fecha": _fmt(svc.created_at),
            "Tipo vehículo": impact.get("vehicle_type", ""),
            "Combustible": impact.get("fuel_type", ""),
            "Agua ahorrada (L)": round(w, 2),
            "CO2 evitado (kg)": round(c, 4),
        })

    columns = ["Código", "Fecha", "Tipo vehículo", "Combustible", "Agua ahorrada (L)", "CO2 evitado (kg)"]
    rows = [[r[c] for c in columns] for r in rows_data]

    if format == "csv":
        data = build_csv("Reporte Ambiental PROGIO", columns, rows)
        return Response(content=data, media_type="text/csv; charset=utf-8-sig",
                        headers={"Content-Disposition": "attachment; filename=reporte_ambiental.csv"})
    if format == "pdf":
        data = build_pdf("Reporte Ambiental PROGIO", columns, rows)
        return Response(content=data, media_type="application/pdf",
                        headers={"Content-Disposition": "attachment; filename=reporte_ambiental.pdf"})

    return {
        "total_services": len(services),
        "total_water_saved_liters": round(total_water, 2),
        "total_co2_avoided_kg": round(total_co2, 4),
        "rows": rows_data,
    }


@router.get("/operations", summary="Reporte de operaciones diarias")
async def report_operations(
    contract_id: Optional[UUID] = None,
    sede_id: Optional[UUID] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    format: str = Query("json", enum=["json", "csv", "pdf"]),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("report:operations")),
):
    query = select(Service)
    if contract_id:
        query = query.where(Service.contract_id == contract_id)
    if sede_id:
        query = query.where(Service.sede_id == sede_id)
    if date_from:
        query = query.where(Service.created_at >= date_from)
    if date_to:
        query = query.where(Service.created_at <= date_to)

    result = await db.execute(query.order_by(Service.created_at.desc()))
    services = result.scalars().all()

    by_status: dict = {}
    by_type: dict = {}
    rows_data = []

    for svc in services:
        by_status[_ev(svc.status)] = by_status.get(_ev(svc.status), 0) + 1
        by_type[_ev(svc.service_type)] = by_type.get(_ev(svc.service_type), 0) + 1

        duration = None
        if svc.started_at and svc.finished_at:
            duration = round((svc.finished_at - svc.started_at).total_seconds() / 60, 1)

        rows_data.append({
            "Código": svc.code,
            "Fecha": _fmt(svc.created_at),
            "Tipo servicio": _ev(svc.service_type),
            "Estado": _ev(svc.status),
            "Duración (min)": duration or "",
        })

    columns = ["Código", "Fecha", "Tipo servicio", "Estado", "Duración (min)"]
    rows = [[r[c] for c in columns] for r in rows_data]

    if format == "csv":
        data = build_csv("Reporte de Operaciones PROGIO", columns, rows)
        return Response(content=data, media_type="text/csv; charset=utf-8-sig",
                        headers={"Content-Disposition": "attachment; filename=reporte_operaciones.csv"})
    if format == "pdf":
        data = build_pdf("Reporte de Operaciones PROGIO", columns, rows)
        return Response(content=data, media_type="application/pdf",
                        headers={"Content-Disposition": "attachment; filename=reporte_operaciones.pdf"})

    return {
        "total_services": len(services),
        "by_status": by_status,
        "by_type": by_type,
        "rows": rows_data,
    }


@router.get("/productivity", summary="Reporte de productividad por operador")
async def report_productivity(
    contract_id: Optional[UUID] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    format: str = Query("json", enum=["json", "csv", "pdf"]),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("report:productivity")),
):
    query = select(Service).where(Service.operator_id != None)
    if contract_id:
        query = query.where(Service.contract_id == contract_id)
    if date_from:
        query = query.where(Service.created_at >= date_from)
    if date_to:
        query = query.where(Service.created_at <= date_to)

    result = await db.execute(query)
    services = result.scalars().all()

    operators: dict = {}
    for svc in services:
        op_id = str(svc.operator_id)
        if op_id not in operators:
            operators[op_id] = {"total": 0, "finished": 0, "durations": []}
        operators[op_id]["total"] += 1
        if svc.status == ServiceStatus.FINISHED:
            operators[op_id]["finished"] += 1
            if svc.started_at and svc.finished_at:
                operators[op_id]["durations"].append(
                    (svc.finished_at - svc.started_at).total_seconds() / 60
                )

    user_ids = [UUID(uid) for uid in operators.keys()]
    users_map = {}
    if user_ids:
        users_result = await db.execute(select(User).where(User.id.in_(user_ids)))
        for u in users_result.scalars().all():
            users_map[str(u.id)] = u.full_name

    rows_data = []
    for op_id, stats in operators.items():
        durs = stats["durations"]
        avg_dur = round(sum(durs) / len(durs), 1) if durs else None
        rows_data.append({
            "Operario ID": op_id,
            "Operario": users_map.get(op_id, "Desconocido"),
            "Total servicios": stats["total"],
            "Finalizados": stats["finished"],
            "Duración promedio (min)": avg_dur or "",
        })

    columns = ["Operario ID", "Operario", "Total servicios", "Finalizados", "Duración promedio (min)"]
    rows = [[r[c] for c in columns] for r in rows_data]

    if format == "csv":
        data = build_csv("Productividad por Operador PROGIO", columns, rows)
        return Response(content=data, media_type="text/csv; charset=utf-8-sig",
                        headers={"Content-Disposition": "attachment; filename=reporte_productividad.csv"})
    if format == "pdf":
        data = build_pdf("Productividad por Operador PROGIO", columns, rows)
        return Response(content=data, media_type="application/pdf",
                        headers={"Content-Disposition": "attachment; filename=reporte_productividad.pdf"})

    return {"rows": rows_data}


@router.get("/income", summary="Reporte de ingresos (información sensible)")
async def report_income(
    contract_id: Optional[UUID] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    format: str = Query("json", enum=["json", "csv", "pdf"]),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("report:income")),
):
    from app.services.indicator_service import calculate_period_economic_indicators
    from app.models.financial import PreFactura, PreFacturaStatus
    from sqlalchemy import select as sa_select

    if not contract_id:
        return {"error": "Se requiere contract_id para el reporte de ingresos"}

    now = datetime.now()
    start = date_from or now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    end = date_to or now

    indicators = await calculate_period_economic_indicators(db, contract_id, start, end)

    pf_result = await db.execute(
        sa_select(func.sum(PreFactura.total_amount)).where(
            PreFactura.contract_id == contract_id,
            PreFactura.status == PreFacturaStatus.APPROVED,
            PreFactura.period_start >= start,
            PreFactura.period_end <= end,
        )
    )
    total_income = float(pf_result.scalar_one() or 0)
    operating_margin = total_income - indicators["total_cost"]
    margin_pct = (operating_margin / total_income * 100) if total_income > 0 else 0

    data = {
        "period_start": _fmt(start),
        "period_end": _fmt(end),
        "total_income": round(total_income, 2),
        "supply_cost": round(indicators["supply_cost"], 2),
        "fixed_costs": round(indicators["fixed_costs"], 2),
        "total_cost": round(indicators["total_cost"], 2),
        "operating_margin": round(operating_margin, 2),
        "margin_pct": round(margin_pct, 2),
        "service_count": indicators["service_count"],
        "cost_per_service": round(indicators["cost_per_service"], 2),
    }

    if format in ("csv", "pdf"):
        columns = list(data.keys())
        rows = [list(data.values())]
        if format == "csv":
            content = build_csv("Reporte de Ingresos PROGIO", columns, rows)
            return Response(content=content,
                            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                            headers={"Content-Disposition": "attachment; filename=reporte_ingresos.csv"})
        content = build_pdf("Reporte de Ingresos PROGIO", columns, rows)
        return Response(content=content, media_type="application/pdf",
                        headers={"Content-Disposition": "attachment; filename=reporte_ingresos.pdf"})

    return data


@router.get("/services-by-type", summary="Reporte por tipo de servicio")
async def report_by_type(
    contract_id: Optional[UUID] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    format: str = Query("json", enum=["json", "csv", "pdf"]),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("report:services")),
):
    query = select(Service.service_type, func.count(Service.id).label("count"))
    if contract_id:
        query = query.where(Service.contract_id == contract_id)
    if date_from:
        query = query.where(Service.created_at >= date_from)
    if date_to:
        query = query.where(Service.created_at <= date_to)
    query = query.group_by(Service.service_type).order_by(func.count(Service.id).desc())

    result = await db.execute(query)
    rows_data = [{"Tipo": _ev(r[0]), "Total": r[1]} for r in result.fetchall()]

    columns = ["Tipo", "Total"]
    rows = [[r[c] for c in columns] for r in rows_data]

    if format == "csv":
        data = build_csv("Servicios por Tipo PROGIO", columns, rows)
        return Response(content=data, media_type="text/csv; charset=utf-8-sig",
                        headers={"Content-Disposition": "attachment; filename=reporte_por_tipo.csv"})
    if format == "pdf":
        data = build_pdf("Servicios por Tipo PROGIO", columns, rows)
        return Response(content=data, media_type="application/pdf",
                        headers={"Content-Disposition": "attachment; filename=reporte_por_tipo.pdf"})
    return {"rows": rows_data}


@router.get("/average-times", summary="Reporte de tiempos promedio")
async def report_times(
    contract_id: Optional[UUID] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    format: str = Query("json", enum=["json", "csv", "pdf"]),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("report:times")),
):
    query = select(Service).where(
        Service.status == ServiceStatus.FINISHED,
        Service.started_at != None,
        Service.finished_at != None,
    )
    if contract_id:
        query = query.where(Service.contract_id == contract_id)
    if date_from:
        query = query.where(Service.created_at >= date_from)
    if date_to:
        query = query.where(Service.created_at <= date_to)

    result = await db.execute(query)
    services = result.scalars().all()

    by_type: dict = {}
    for svc in services:
        t = _ev(svc.service_type)
        dur = (svc.finished_at - svc.started_at).total_seconds() / 60
        if t not in by_type:
            by_type[t] = []
        by_type[t].append(dur)

    rows_data = [
        {"Tipo servicio": t, "Promedio (min)": round(sum(v) / len(v), 1), "Total": len(v)}
        for t, v in by_type.items()
    ]

    columns = ["Tipo servicio", "Promedio (min)", "Total"]
    rows = [[r[c] for c in columns] for r in rows_data]

    if format == "csv":
        data = build_csv("Tiempos Promedio PROGIO", columns, rows)
        return Response(content=data, media_type="text/csv; charset=utf-8-sig",
                        headers={"Content-Disposition": "attachment; filename=reporte_tiempos.csv"})
    if format == "pdf":
        data = build_pdf("Tiempos Promedio PROGIO", columns, rows)
        return Response(content=data, media_type="application/pdf",
                        headers={"Content-Disposition": "attachment; filename=reporte_tiempos.pdf"})
    return {"rows": rows_data}
