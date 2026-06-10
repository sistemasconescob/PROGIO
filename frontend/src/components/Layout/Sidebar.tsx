import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Car, FileText, Users, Package,
  BarChart3, Shield, LogOut, ChevronRight, Droplets,
  ClipboardList, UserCheck, Receipt, Leaf,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import clsx from 'clsx'

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/services', label: 'Servicios', icon: ClipboardList },
  { to: '/contracts', label: 'Contratos', icon: FileText },
  { to: '/vehicles', label: 'Vehículos', icon: Car },
  { to: '/clients', label: 'Clientes', icon: UserCheck },
  { to: '/users', label: 'Usuarios', icon: Users },
  { to: '/supplies', label: 'Insumos', icon: Package },
  { to: '/prebilling', label: 'Pre-Facturación', icon: Receipt },
  { to: '/env-config', label: 'Indicadores Eco.', icon: Leaf },
  { to: '/reports', label: 'Reportes', icon: BarChart3 },
  { to: '/audit', label: 'Auditoría', icon: Shield },
]

export default function Sidebar() {
  const { user, logout } = useAuth()

  return (
    <aside className="flex h-screen w-64 flex-col bg-progio-800 text-white shadow-2xl flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-progio-700">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 shadow-inner">
          <Droplets className="w-5 h-5 text-progio-200" />
        </div>
        <div>
          <p className="text-base font-bold tracking-wide">PROGIO</p>
          <p className="text-[10px] text-progio-300 uppercase tracking-widest leading-none">Gestión de Lavado</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => clsx(
              'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
              isActive
                ? 'bg-white/20 text-white shadow-sm'
                : 'text-progio-200 hover:bg-white/10 hover:text-white'
            )}
          >
            <Icon className="w-4.5 h-4.5 flex-shrink-0" size={18} />
            <span className="flex-1">{label}</span>
            <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-60 transition-opacity" size={14} />
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-progio-700 px-4 py-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
            {user?.full_name?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{user?.full_name}</p>
            <p className="text-[11px] text-progio-300 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-progio-300 hover:bg-white/10 hover:text-white transition-all"
        >
          <LogOut size={16} />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  )
}
