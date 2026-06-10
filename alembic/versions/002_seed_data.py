"""Seed data — permisos, roles y usuario admin inicial

Revision ID: 002
Revises: 001
Create Date: 2026-04-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
import uuid
import bcrypt

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def _hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt(rounds=12)).decode()

# ──────────────────────────────────────────────
# Permisos definidos en core/permissions.py
# ──────────────────────────────────────────────
PERMISSIONS = {
    "user:create": ("Crear usuarios", "users"),
    "user:read": ("Ver usuarios", "users"),
    "user:update": ("Actualizar usuarios", "users"),
    "user:deactivate": ("Desactivar usuarios", "users"),
    "user:revoke_access": ("Revocar acceso a contratos", "users"),
    "role:create": ("Crear roles", "roles"),
    "role:read": ("Ver roles", "roles"),
    "role:update": ("Actualizar roles", "roles"),
    "role:delete": ("Eliminar roles", "roles"),
    "contract:create": ("Crear contratos", "contracts"),
    "contract:read": ("Ver contratos", "contracts"),
    "contract:update": ("Actualizar contratos", "contracts"),
    "contract:manage_users": ("Gestionar usuarios en contratos", "contracts"),
    "contract:manage_costs": ("Gestionar costos operativos", "contracts"),
    "service:create": ("Crear servicios", "services"),
    "service:read": ("Ver servicios", "services"),
    "service:start": ("Iniciar servicios", "services"),
    "service:pause": ("Pausar/Reanudar servicios", "services"),
    "service:assign_operator": ("Asignar operario", "services"),
    "service:supervise": ("Supervisar servicios", "services"),
    "service:complete_compliance": ("Completar formato de cumplimiento", "services"),
    "service:finish": ("Cerrar servicios", "services"),
    "service:cancel": ("Cancelar servicios", "services"),
    "service:reprocess": ("Reprocesar servicios", "services"),
    "vehicle:create": ("Crear vehículos", "vehicles"),
    "vehicle:read": ("Ver vehículos", "vehicles"),
    "vehicle:update": ("Actualizar vehículos", "vehicles"),
    "vehicle:config": ("Configurar límites de servicio por contrato", "vehicles"),
    "client:create": ("Crear clientes", "clients"),
    "client:read": ("Ver clientes", "clients"),
    "client:update": ("Actualizar clientes", "clients"),
    "supply:create": ("Crear insumos", "supplies"),
    "supply:read": ("Ver insumos", "supplies"),
    "supply:update": ("Actualizar insumos", "supplies"),
    "supply:use": ("Registrar uso de insumos", "supplies"),
    "prefactura:create": ("Crear prefacturas", "financial"),
    "prefactura:read": ("Ver prefacturas", "financial"),
    "prefactura:approve": ("Aprobar prefacturas", "financial"),
    "indicator:read_financial": ("Ver indicadores financieros y económicos", "financial"),
    "cost:read": ("Ver costos operativos", "financial"),
    "cost:create": ("Registrar costos operativos", "financial"),
    "report:environmental": ("Reporte ambiental", "reports"),
    "report:operations": ("Reporte de operaciones", "reports"),
    "report:productivity": ("Reporte de productividad por operador", "reports"),
    "report:income": ("Reporte de ingresos (sensible)", "reports"),
    "report:services": ("Reporte por tipo de servicio", "reports"),
    "report:times": ("Reporte de tiempos promedio", "reports"),
    "audit:read": ("Ver registros de auditoría", "audit"),
    "fleet:create": ("Crear flotas", "fleets"),
    "fleet:read": ("Ver flotas", "fleets"),
    "fleet:update": ("Actualizar flotas", "fleets"),
    "env_config:manage": ("Gestionar configuración ambiental", "config"),
}

ROLE_PERMISSIONS = {
    "Administrador General": list(PERMISSIONS.keys()),
    "Administrador de Contrato": [
        "user:read", "user:create", "user:update", "user:revoke_access",
        "contract:read", "contract:update", "contract:manage_users", "contract:manage_costs",
        "service:create", "service:read", "service:start", "service:pause",
        "service:assign_operator", "service:supervise", "service:complete_compliance",
        "service:finish", "service:cancel", "service:reprocess",
        "vehicle:create", "vehicle:read", "vehicle:update", "vehicle:config",
        "client:create", "client:read", "client:update",
        "supply:create", "supply:read", "supply:update", "supply:use",
        "prefactura:create", "prefactura:read", "prefactura:approve",
        "indicator:read_financial", "cost:read", "cost:create",
        "report:environmental", "report:operations", "report:productivity",
        "report:income", "report:services", "report:times",
        "audit:read", "fleet:create", "fleet:read", "fleet:update",
    ],
    "Coordinador de Operaciones": [
        "user:read", "contract:read",
        "service:create", "service:read", "service:start", "service:pause",
        "service:assign_operator", "service:supervise", "service:complete_compliance",
        "service:finish", "service:cancel",
        "vehicle:read", "vehicle:config",
        "client:create", "client:read", "client:update",
        "supply:read", "supply:use",
        "prefactura:read", "indicator:read_financial", "cost:read",
        "report:environmental", "report:operations", "report:productivity",
        "report:services", "report:times", "audit:read", "fleet:read",
    ],
    "Supervisor": [
        "service:read", "service:supervise", "service:complete_compliance", "service:pause",
        "service:assign_operator", "vehicle:read", "client:read", "supply:read",
        "report:environmental", "report:operations", "report:productivity",
        "report:services", "report:times", "audit:read", "fleet:read",
    ],
    "Operario": [
        "service:read", "service:start", "service:pause",
        "service:complete_compliance", "supply:use", "vehicle:read", "client:read",
    ],
    "Interventor": [
        "service:read", "vehicle:read", "client:read", "supply:read",
        "prefactura:read", "audit:read", "report:environmental", "report:operations",
        "report:productivity", "report:services", "report:times",
        "fleet:read", "contract:read",
    ],
}

# Configuraciones ambientales iniciales: co2_per_km en kg/km
ENV_CONFIGS = [
    ("sedan", "gasoline", 0.170, 150.0, 10.0),
    ("sedan", "diesel", 0.155, 150.0, 10.0),
    ("sedan", "electric", 0.025, 150.0, 10.0),
    ("sedan", "hybrid", 0.080, 150.0, 10.0),
    ("suv", "gasoline", 0.210, 180.0, 10.0),
    ("suv", "diesel", 0.190, 180.0, 10.0),
    ("suv", "electric", 0.030, 180.0, 10.0),
    ("suv", "hybrid", 0.110, 180.0, 10.0),
    ("pickup", "gasoline", 0.260, 200.0, 10.0),
    ("pickup", "diesel", 0.230, 200.0, 10.0),
    ("bus", "diesel", 0.620, 400.0, 10.0),
    ("truck", "diesel", 0.850, 500.0, 10.0),
    ("motorcycle", "gasoline", 0.090, 80.0, 10.0),
    ("van", "gasoline", 0.220, 220.0, 10.0),
    ("van", "diesel", 0.200, 220.0, 10.0),
]


def upgrade() -> None:
    conn = op.get_bind()

    # ── Insertar permisos ──
    perm_ids = {}
    for code, (desc, module) in PERMISSIONS.items():
        perm_id = uuid.uuid4()
        perm_ids[code] = perm_id
        conn.execute(
            sa.text("INSERT INTO permissions (id, code, description, module) VALUES (:id, :code, :desc, :module)"),
            {"id": perm_id, "code": code, "desc": desc, "module": module},
        )

    # ── Insertar roles e IDs ──
    role_ids = {}
    for role_name in ROLE_PERMISSIONS:
        role_id = uuid.uuid4()
        role_ids[role_name] = role_id
        conn.execute(
            sa.text("INSERT INTO roles (id, name, is_system, created_at) VALUES (:id, :name, true, now())"),
            {"id": role_id, "name": role_name},
        )

    # ── Asignar permisos a roles ──
    for role_name, perms in ROLE_PERMISSIONS.items():
        role_id = role_ids[role_name]
        for perm_code in perms:
            if perm_code in perm_ids:
                conn.execute(
                    sa.text("INSERT INTO role_permissions (id, role_id, permission_id) VALUES (:id, :role_id, :perm_id)"),
                    {"id": uuid.uuid4(), "role_id": role_id, "perm_id": perm_ids[perm_code]},
                )

    # ── Usuario administrador inicial ──
    admin_id = uuid.uuid4()
    hashed = _hash_password("Admin1234!")
    conn.execute(
        sa.text("""
            INSERT INTO users (id, email, username, hashed_password, full_name, is_active, failed_attempts, created_at)
            VALUES (:id, :email, :username, :pwd, :name, true, 0, now())
        """),
        {"id": admin_id, "email": "admin@progio.co", "username": "admin", "pwd": hashed, "name": "Administrador PROGIO"},
    )

    # ── Configuraciones ambientales ──
    for vtype, ftype, co2, water, km in ENV_CONFIGS:
        conn.execute(
            sa.text("""
                INSERT INTO environmental_configs
                (id, vehicle_type, fuel_type, co2_per_km, water_saved_per_wash, standard_km, is_active, created_at)
                VALUES (:id, :vt, :ft, :co2, :water, :km, true, now())
            """),
            {"id": uuid.uuid4(), "vt": vtype, "ft": ftype, "co2": co2, "water": water, "km": km},
        )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("DELETE FROM environmental_configs"))
    conn.execute(sa.text("DELETE FROM users WHERE username = 'admin'"))
    conn.execute(sa.text("DELETE FROM role_permissions"))
    conn.execute(sa.text("DELETE FROM roles WHERE is_system = true"))
    conn.execute(sa.text("DELETE FROM permissions"))
