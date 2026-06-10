"""
Códigos de permisos y definición de permisos iniciales del sistema.
Los roles son parametrizables (requerimiento 5.2).
"""

PERMISSIONS = {
    # Usuarios
    "user:create": ("Crear usuarios", "users"),
    "user:read": ("Ver usuarios", "users"),
    "user:update": ("Actualizar usuarios", "users"),
    "user:deactivate": ("Desactivar usuarios", "users"),
    "user:revoke_access": ("Revocar acceso a contratos", "users"),
    # Roles
    "role:create": ("Crear roles", "roles"),
    "role:read": ("Ver roles", "roles"),
    "role:update": ("Actualizar roles", "roles"),
    "role:delete": ("Eliminar roles", "roles"),
    # Contratos
    "contract:create": ("Crear contratos", "contracts"),
    "contract:read": ("Ver contratos", "contracts"),
    "contract:update": ("Actualizar contratos", "contracts"),
    "contract:manage_users": ("Gestionar usuarios en contratos", "contracts"),
    "contract:manage_costs": ("Gestionar costos operativos", "contracts"),
    # Servicios
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
    # Vehículos
    "vehicle:create": ("Crear vehículos", "vehicles"),
    "vehicle:read": ("Ver vehículos", "vehicles"),
    "vehicle:update": ("Actualizar vehículos", "vehicles"),
    "vehicle:config": ("Configurar límites de servicio por contrato", "vehicles"),
    # Clientes
    "client:create": ("Crear clientes", "clients"),
    "client:read": ("Ver clientes", "clients"),
    "client:update": ("Actualizar clientes", "clients"),
    # Insumos
    "supply:create": ("Crear insumos", "supplies"),
    "supply:read": ("Ver insumos", "supplies"),
    "supply:update": ("Actualizar insumos", "supplies"),
    "supply:use": ("Registrar uso de insumos", "supplies"),
    # Prefacturación (información sensible - requerimiento 5.5)
    "prefactura:create": ("Crear prefacturas", "financial"),
    "prefactura:read": ("Ver prefacturas", "financial"),
    "prefactura:approve": ("Aprobar prefacturas", "financial"),
    # Indicadores financieros (información sensible)
    "indicator:read_financial": ("Ver indicadores financieros y económicos", "financial"),
    "cost:read": ("Ver costos operativos", "financial"),
    "cost:create": ("Registrar costos operativos", "financial"),
    # Reportes
    "report:environmental": ("Reporte ambiental", "reports"),
    "report:operations": ("Reporte de operaciones", "reports"),
    "report:productivity": ("Reporte de productividad por operador", "reports"),
    "report:income": ("Reporte de ingresos (sensible)", "reports"),
    "report:services": ("Reporte por tipo de servicio", "reports"),
    "report:times": ("Reporte de tiempos promedio", "reports"),
    # Auditoría
    "audit:read": ("Ver registros de auditoría", "audit"),
    # Flotas
    "fleet:create": ("Crear flotas", "fleets"),
    "fleet:read": ("Ver flotas", "fleets"),
    "fleet:update": ("Actualizar flotas", "fleets"),
    # Configuración ambiental
    "env_config:manage": ("Gestionar configuración ambiental", "config"),
}

# Permisos por rol inicial (pueden modificarse desde la UI)
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
        "user:read",
        "contract:read",
        "service:create", "service:read", "service:start", "service:pause",
        "service:assign_operator", "service:supervise", "service:complete_compliance",
        "service:finish", "service:cancel",
        "vehicle:read", "vehicle:config",
        "client:create", "client:read", "client:update",
        "supply:read", "supply:use",
        "prefactura:read",
        "indicator:read_financial", "cost:read",
        "report:environmental", "report:operations", "report:productivity",
        "report:services", "report:times",
        "audit:read", "fleet:read",
    ],
    "Supervisor": [
        "service:read", "service:supervise", "service:complete_compliance",
        "service:pause", "service:assign_operator",
        "vehicle:read", "client:read",
        "supply:read",
        "report:environmental", "report:operations", "report:productivity",
        "report:services", "report:times",
        "audit:read", "fleet:read",
    ],
    "Operario": [
        "service:read", "service:start", "service:pause",
        "service:complete_compliance", "supply:use",
        "vehicle:read", "client:read",
    ],
    "Interventor": [
        "service:read", "vehicle:read", "client:read",
        "supply:read", "prefactura:read", "audit:read",
        "report:environmental", "report:operations", "report:productivity",
        "report:services", "report:times",
        "fleet:read", "contract:read",
    ],
}
