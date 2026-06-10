import { useEffect, useState, useCallback } from 'react'
import { Search, Shield } from 'lucide-react'
import Header from '../components/Layout/Header'
import { Card } from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import { getAuditLogs } from '../api/misc'
import type { AuditLog } from '../types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const actionColors: Record<string, string> = {
  create: 'text-emerald-600 bg-emerald-50',
  update: 'text-blue-600 bg-blue-50',
  delete: 'text-red-600 bg-red-50',
  login: 'text-violet-600 bg-violet-50',
  logout: 'text-slate-500 bg-slate-100',
  status_change: 'text-orange-600 bg-orange-50',
}

export default function Audit() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [entityFilter, setEntityFilter] = useState('')
  const [page, setPage] = useState(0)
  const PAGE = 50

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getAuditLogs({ limit: PAGE, offset: page * PAGE })
      setLogs(res.data)
    } finally { setLoading(false) }
  }, [page])

  useEffect(() => { load() }, [load])

  const entities = [...new Set(logs.map(l => l.entity_type))].sort()

  const filtered = logs.filter(l => {
    const matchSearch = !search || l.action.includes(search.toLowerCase()) || l.entity_type.includes(search.toLowerCase())
    const matchEntity = !entityFilter || l.entity_type === entityFilter
    return matchSearch && matchEntity
  })

  return (
    <div>
      <Header title="Auditoría" subtitle="Registro inmutable de acciones del sistema" />
      <div className="p-6 space-y-4">

        <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <Shield size={15} className="text-slate-400 mt-0.5" />
          <p className="text-xs text-slate-500">
            El registro de auditoría es inmutable. Ninguna entrada puede ser modificada o eliminada.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Buscar acción..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="select w-44" value={entityFilter} onChange={e => setEntityFilter(e.target.value)}>
            <option value="">Todos los módulos</option>
            {entities.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>

        {loading ? <Spinner /> : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Fecha', 'Acción', 'Módulo', 'Entidad ID', 'Usuario', 'IP'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0
                    ? <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">No hay registros</td></tr>
                    : filtered.map(log => (
                      <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                          {format(new Date(log.created_at), 'dd/MM/yy HH:mm:ss', { locale: es })}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${actionColors[log.action] || 'text-slate-500 bg-slate-100'}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs">{log.entity_type}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-400">{log.entity_id?.slice(0, 8)}…</td>
                        <td className="px-4 py-3 text-slate-600 text-xs">{log.user_id ? log.user_id.slice(0, 8) + '…' : '—'}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-400">{log.ip_address || '—'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-50">
              <p className="text-xs text-slate-400">{filtered.length} registros</p>
              <div className="flex gap-2">
                <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                  className="text-xs px-3 py-1 rounded-lg border border-slate-200 text-slate-500 disabled:opacity-40 hover:bg-slate-50 transition-colors">
                  Anterior
                </button>
                <span className="text-xs text-slate-400 flex items-center px-2">Pág. {page + 1}</span>
                <button disabled={logs.length < PAGE} onClick={() => setPage(p => p + 1)}
                  className="text-xs px-3 py-1 rounded-lg border border-slate-200 text-slate-500 disabled:opacity-40 hover:bg-slate-50 transition-colors">
                  Siguiente
                </button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
