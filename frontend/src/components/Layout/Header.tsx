import { Bell } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

interface Props { title: string; subtitle?: string }

export default function Header({ title, subtitle }: Props) {
  const { user } = useAuth()
  const now = new Date()
  const dateStr = now.toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <header className="flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4 shadow-sm">
      <div>
        <h1 className="text-xl font-bold text-slate-800">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-4">
        <span className="hidden md:block text-xs text-slate-400 capitalize">{dateStr}</span>
        <button className="relative rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-progio-600" />
        </button>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-progio-100 text-progio-700 text-xs font-bold">
          {user?.full_name?.charAt(0).toUpperCase()}
        </div>
      </div>
    </header>
  )
}
