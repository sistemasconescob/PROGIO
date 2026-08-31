"""Módulos de Inventario por periodo y Consultoría en Hidrocarburos

Revision ID: 005
Revises: 004
Create Date: 2026-06-10
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


# ──────────────────────────────────────────────
# Nuevos permisos
# ──────────────────────────────────────────────
NEW_PERMISSIONS = {
    "inventory:read": ("Ver inventarios por periodo", "inventory"),
    "inventory:manage": ("Gestionar periodos de inventario", "inventory"),
    "consultant:read": ("Ver consultores y dossier HSE", "consulting"),
    "consultant:create": ("Registrar consultores", "consulting"),
    "consultant:update": ("Actualizar consultores y documentos", "consulting"),
    "assignment:read": ("Ver asignaciones/llamados", "consulting"),
    "assignment:create": ("Crear asignaciones", "consulting"),
    "assignment:manage": ("Gestionar ciclo de vida de asignaciones", "consulting"),
    "closure_report:read": ("Ver reportes de cierre", "consulting"),
    "closure_report:create": ("Crear y editar reportes de cierre", "consulting"),
    "closure_report:validate_internal": ("Validar internamente reporte de cierre", "consulting"),
    "closure_report:validate_client": ("Registrar validación del cliente", "consulting"),
}

ADMIN_EXTRA = list(NEW_PERMISSIONS.keys())

CONTRACT_ADMIN_EXTRA = [
    "inventory:read", "inventory:manage",
    "consultant:read", "consultant:create", "consultant:update",
    "assignment:read", "assignment:create", "assignment:manage",
    "closure_report:read", "closure_report:create",
    "closure_report:validate_internal", "closure_report:validate_client",
]

COORDINATOR_EXTRA = [
    "inventory:read",
    "consultant:read",
    "assignment:read", "assignment:create", "assignment:manage",
    "closure_report:read", "closure_report:create",
]


def upgrade() -> None:
    # ── Tablas de inventario ──────────────────────────────────────────
    op.create_table(
        "inventory_periods",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("contract_id", UUID(as_uuid=True), sa.ForeignKey("contracts.id"), nullable=False),
        sa.Column("sede_id", UUID(as_uuid=True), sa.ForeignKey("contract_sedes.id"), nullable=True),
        sa.Column("workstation", sa.String(100), nullable=True),
        sa.Column("period_label", sa.String(10), nullable=False),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("period_type", sa.String(50), server_default="monthly", nullable=False),
        sa.Column("status", sa.String(50), server_default="open", nullable=False),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_by_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("closed_by_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_inventory_periods_contract_id", "inventory_periods", ["contract_id"])
    op.create_index("ix_inventory_periods_status", "inventory_periods", ["status"])

    op.create_table(
        "inventory_period_items",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("period_id", UUID(as_uuid=True), sa.ForeignKey("inventory_periods.id", ondelete="CASCADE"), nullable=False),
        sa.Column("supply_id", UUID(as_uuid=True), sa.ForeignKey("supplies.id"), nullable=False),
        sa.Column("initial_stock", sa.Numeric(15, 4), server_default="0", nullable=False),
        sa.Column("entries", sa.Numeric(15, 4), server_default="0", nullable=False),
        sa.Column("adjustments", sa.Numeric(15, 4), server_default="0", nullable=False),
        sa.Column("final_stock_physical", sa.Numeric(15, 4), nullable=True),
        sa.Column("theoretical_consumption", sa.Numeric(15, 4), server_default="0", nullable=False),
        sa.Column("difference", sa.Numeric(15, 4), nullable=True),
        sa.Column("deviation_pct", sa.Float, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_inventory_period_items_period_id", "inventory_period_items", ["period_id"])

    op.create_table(
        "service_cost_weights",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("formula_version", sa.String(20), nullable=False),
        sa.Column("service_type", sa.String(50), nullable=False),
        sa.Column("weight", sa.Numeric(8, 4), nullable=False, server_default="1.0"),
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("notes", sa.String(255), nullable=True),
        sa.Column("created_by_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── Tablas de consultoría ─────────────────────────────────────────
    op.create_table(
        "consultants",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("document_type", sa.String(50), nullable=True),
        sa.Column("document_number", sa.String(100), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(30), nullable=True),
        sa.Column("specialty", sa.String(255), nullable=True),
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "consultant_documents",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("consultant_id", UUID(as_uuid=True), sa.ForeignKey("consultants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("doc_type", sa.String(50), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("file_url", sa.String(500), nullable=True),
        sa.Column("issued_at", sa.Date, nullable=True),
        sa.Column("expires_at", sa.Date, nullable=True),
        sa.Column("is_critical", sa.Boolean, server_default="false", nullable=False),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("uploaded_by_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_consultant_documents_consultant_id", "consultant_documents", ["consultant_id"])

    op.create_table(
        "assignments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("code", sa.String(50), unique=True, nullable=False),
        sa.Column("contract_id", UUID(as_uuid=True), sa.ForeignKey("contracts.id"), nullable=False),
        sa.Column("consultant_id", UUID(as_uuid=True), sa.ForeignKey("consultants.id"), nullable=False),
        sa.Column("position", sa.String(255), nullable=True),
        sa.Column("location", sa.String(255), nullable=True),
        sa.Column("client_reference", sa.String(255), nullable=True),
        sa.Column("status", sa.String(50), server_default="draft", nullable=False),
        sa.Column("opened_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_by_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_assignments_contract_id", "assignments", ["contract_id"])
    op.create_index("ix_assignments_consultant_id", "assignments", ["consultant_id"])
    op.create_index("ix_assignments_status", "assignments", ["status"])
    op.create_index("ix_assignments_code", "assignments", ["code"], unique=True)

    op.create_table(
        "assignment_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("assignment_id", UUID(as_uuid=True), sa.ForeignKey("assignments.id"), nullable=False),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("event_metadata", JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_assignment_events_assignment_id", "assignment_events", ["assignment_id"])

    op.create_table(
        "closure_reports",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("assignment_id", UUID(as_uuid=True), sa.ForeignKey("assignments.id"), unique=True, nullable=False),
        sa.Column("internal_status", sa.String(50), server_default="pending", nullable=False),
        sa.Column("internal_validated_by_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("internal_validated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("internal_notes", sa.Text, nullable=True),
        sa.Column("client_status", sa.String(50), server_default="pending", nullable=False),
        sa.Column("client_validated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("client_validator_name", sa.String(255), nullable=True),
        sa.Column("client_notes", sa.Text, nullable=True),
        sa.Column("content", JSONB, nullable=True),
        sa.Column("narrative", sa.Text, nullable=True),
        sa.Column("template_version", sa.String(20), server_default="1.0", nullable=False),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_by_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "closure_report_attachments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("report_id", UUID(as_uuid=True), sa.ForeignKey("closure_reports.id", ondelete="CASCADE"), nullable=False),
        sa.Column("file_name", sa.String(255), nullable=False),
        sa.Column("file_url", sa.String(500), nullable=True),
        sa.Column("attachment_type", sa.String(50), server_default="pdf", nullable=False),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("uploaded_by_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── Permisos nuevos ───────────────────────────────────────────────
    conn = op.get_bind()
    perm_ids = {}
    for code, (desc, module) in NEW_PERMISSIONS.items():
        pid = uuid.uuid4()
        perm_ids[code] = pid
        conn.execute(
            sa.text("INSERT INTO permissions (id, code, description, module) VALUES (:id, :code, :desc, :module)"),
            {"id": pid, "code": code, "desc": desc, "module": module},
        )

    # Asignar a Administrador General
    admin_role = conn.execute(sa.text("SELECT id FROM roles WHERE name = 'Administrador General'")).fetchone()
    if admin_role:
        for code in ADMIN_EXTRA:
            if code in perm_ids:
                conn.execute(
                    sa.text("INSERT INTO role_permissions (id, role_id, permission_id) VALUES (:id, :rid, :pid)"),
                    {"id": uuid.uuid4(), "rid": admin_role[0], "pid": perm_ids[code]},
                )

    # Asignar a Administrador de Contrato
    contract_admin = conn.execute(sa.text("SELECT id FROM roles WHERE name = 'Administrador de Contrato'")).fetchone()
    if contract_admin:
        for code in CONTRACT_ADMIN_EXTRA:
            if code in perm_ids:
                conn.execute(
                    sa.text("INSERT INTO role_permissions (id, role_id, permission_id) VALUES (:id, :rid, :pid)"),
                    {"id": uuid.uuid4(), "rid": contract_admin[0], "pid": perm_ids[code]},
                )

    # Asignar a Coordinador de Operaciones
    coordinator = conn.execute(sa.text("SELECT id FROM roles WHERE name = 'Coordinador de Operaciones'")).fetchone()
    if coordinator:
        for code in COORDINATOR_EXTRA:
            if code in perm_ids:
                conn.execute(
                    sa.text("INSERT INTO role_permissions (id, role_id, permission_id) VALUES (:id, :rid, :pid)"),
                    {"id": uuid.uuid4(), "rid": coordinator[0], "pid": perm_ids[code]},
                )

    # Pesos iniciales de costeo por media funcional (versión 1.0)
    DEFAULT_WEIGHTS = [
        ("basic_wash", 1.0),
        ("full_wash", 1.5),
        ("premium_wash", 2.0),
        ("engine_wash", 2.5),
        ("interior_detail", 2.0),
        ("full_detail", 3.0),
    ]
    for stype, weight in DEFAULT_WEIGHTS:
        conn.execute(
            sa.text("""
                INSERT INTO service_cost_weights (id, formula_version, service_type, weight, is_active, created_at)
                VALUES (:id, '1.0', :stype, :weight, true, now())
            """),
            {"id": uuid.uuid4(), "stype": stype, "weight": weight},
        )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("DELETE FROM service_cost_weights"))
    conn.execute(sa.text("""
        DELETE FROM role_permissions rp
        USING permissions p
        WHERE rp.permission_id = p.id AND p.module IN ('inventory', 'consulting')
    """))
    conn.execute(sa.text("DELETE FROM permissions WHERE module IN ('inventory', 'consulting')"))

    op.drop_table("closure_report_attachments")
    op.drop_table("closure_reports")
    op.drop_index("ix_assignment_events_assignment_id", table_name="assignment_events")
    op.drop_table("assignment_events")
    op.drop_index("ix_assignments_code", table_name="assignments")
    op.drop_index("ix_assignments_status", table_name="assignments")
    op.drop_index("ix_assignments_consultant_id", table_name="assignments")
    op.drop_index("ix_assignments_contract_id", table_name="assignments")
    op.drop_table("assignments")
    op.drop_index("ix_consultant_documents_consultant_id", table_name="consultant_documents")
    op.drop_table("consultant_documents")
    op.drop_table("consultants")
    op.drop_table("service_cost_weights")
    op.drop_index("ix_inventory_period_items_period_id", table_name="inventory_period_items")
    op.drop_table("inventory_period_items")
    op.drop_index("ix_inventory_periods_status", table_name="inventory_periods")
    op.drop_index("ix_inventory_periods_contract_id", table_name="inventory_periods")
    op.drop_table("inventory_periods")
