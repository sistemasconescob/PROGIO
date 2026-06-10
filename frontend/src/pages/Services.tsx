import { useEffect, useState, useCallback } from 'react'
import { Plus, Search, ChevronDown, Play, Pause, RotateCcw, CheckCheck, X, Eye } from 'lucide-react'
import Header from '../components/Layout/Header'
import { Card } from '../components/ui/Card'
import { StatusBadge } from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Spinner from '../components/ui/Spinner'
import { getServices, createService, startService, pauseService, resumeService, finishService, cancelService, completeCompliance } from '../api/services'
import { getContracts } from '../api/contracts'
import { getVehicles } from '../api/misc'
import { apiError } from '../api/errorMessage'
import { useToast } from '../hooks/useToast'
import { useAuth } from '../contexts/AuthContext'
import type { Service, Contract, Vehicle, ServiceStatus } from '../types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const serviceTypeLabel: Record<string, string> = {
  basic_wash: 'Básico', full_wash: 'Completo', premium_wash: 'Premium',
  engine_wash: 'Motor', interior_detail: 'Interior', full_detail: 'Detallado',
}

const statusOptions: { value: ServiceStatus | ''; label: string }[] = [
  { value: '', label: 'Todos los estados' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'in_process', label: 'En proceso' },
  { value: 'on_hold', label: 'En espera' },
  { value: 'finished', label: 'Finalizado' },
  { value: 'cancelled', label: 'Cancelado' },
  { value: 'blocked', label: 'Bloqueado' },
]

export default function Services() {
  const { user } = useAuth()
  const toast = useToast()
  const [services, setServices] = useState<Service[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ServiceStatus | ''>('')
  const [createOpen, setCreateOpen] = useState(false)
  const [detailSvc, setDetailSvc] = useState<Service | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Create form state
  const [form, setForm] = useState({ contract_id: '', sede_id: '', vehicle_id: '', service_type: 'basic_wash', notes: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { limit: 200 }
      if (statusFilter) params.status = statusFilter
      const [svcRes, cRes, vRes] = await Promise.all([getServices(params), getContracts(), getVehicles()])
      setServices(svcRes.data)
      setContracts(cRes.data)
      setVehicles(vRes.data)
    } finally { setLoading(false) }
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  const filtered = services.filter(s =>
    !search || s.code.toLowerCase().includes(search.toLowerCase())
  )

  const selectedContract = contracts.find(c => c.id === form.contract_id)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createService({ ...form, created_by_id: user?.id })
      toast('success', 'Servicio creado correctamente')
      setCreateOpen(false)
      setForm({ contract_id: '', sede_id: '', vehicle_id: '', service_type: 'basic_wash', notes: '' })
      load()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Error al crear servicio'
      toast('error', msg)
    }
  }

  const action = async (fn: () => Promise<unknown>, successMsg: string, svcId: string) => {
    setActionLoading(svcId)
    try {
      await fn()
      toast('success', successMsg)
      load()
      setDetailSvc(null)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Error al ejecutar acción'
      toast('error', msg)
    } finally { setActionLoading(null) }
  }

  return (
    <div>
      <Header title="Servicios" subtitle="Gestión de servicios de lavado" />
      <div className="p-6 space-y-4">

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex gap-2 flex-1">
            <div className="relative flex-1 max-w-xs">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="input pl-9" placeholder="Buscar por código..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="relative">
              <select className="select pr-8 w-44" value={statusFilter} onChange={e => setStatusFilter(e.target.value as ServiceStatus | '')}>
                {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <Button icon={<Plus size={15} />} onClick={() => setCreateOpen(true)}>Nuevo servicio</Button>
        </div>

        {/* Table */}
        <Card>
          {loading
            ? <Spinner />
            : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {['Código', 'Tipo', 'Estado', 'Cumplimiento', 'Creado', 'Acciones'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0
                      ? <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">No hay servicios</td></tr>
                      : filtered.map(s => (
                        <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">{s.code}</td>
                          <td className="px-4 py-3 text-slate-600">{serviceTypeLabel[s.service_type] || s.service_type}</td>
                          <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-medium ${s.compliance_format_completed ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {s.compliance_format_completed ? '✓ Completo' : '— Pendiente'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-xs">
                            {format(new Date(s.created_at), 'dd MMM yyyy HH:mm', { locale: es })}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <button onClick={() => setDetailSvc(s)} className="rounded-md p-1.5 text-slate-400 hover:bg-progio-50 hover:text-progio-700 transition-colors" title="Ver detalle">
                                <Eye size={14} />
                              </button>
                              {s.status === 'pending' && (
                                <button onClick={() => action(() => startService(s.id, user!.id), 'Servicio iniciado', s.id)}
                                  className="rounded-md p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-700 transition-colors" title="Iniciar">
                                  {actionLoading === s.id ? '...' : <Play size={14} />}
                                </button>
                              )}
                              {s.status === 'in_process' && (
                                <>
                                  {!s.compliance_format_completed && (
                                    <button onClick={() => action(() => completeCompliance(s.id), 'Formato completado', s.id)}
                                      className="rounded-md p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-700 transition-colors" title="Completar formato">
                                      <CheckCheck size={14} />
                                    </button>
                                  )}
                                  {s.compliance_format_completed && (
                                    <button onClick={() => action(() => finishService(s.id), 'Servicio finalizado', s.id)}
                                      className="rounded-md p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-700 transition-colors" title="Finalizar">
                                      <CheckCheck size={14} />
                                    </button>
                                  )}
                                  <button onClick={() => action(() => pauseService(s.id), 'Servicio pausado', s.id)}
                                    className="rounded-md p-1.5 text-slate-400 hover:bg-orange-50 hover:text-orange-700 transition-colors" title="Pausar">
                                    <Pause size={14} />
                                  </button>
                                </>
                              )}
                              {s.status === 'on_hold' && (
                                <button onClick={() => action(() => resumeService(s.id), 'Servicio reanudado', s.id)}
                                  className="rounded-md p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-700 transition-colors" title="Reanudar">
                                  <RotateCcw size={14} />
                                </button>
                              )}
                              {['pending', 'in_process', 'on_hold'].includes(s.status) && (
                                <button onClick={() => action(() => cancelService(s.id, 'Cancelado por usuario'), 'Servicio cancelado', s.id)}
                                  className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700 transition-colors" title="Cancelar">
                                  <X size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
        </Card>

        {/* Summary bar */}
        <div className="flex gap-4 text-xs text-slate-500">
          <span>{filtered.length} servicios</span>
          <span>·</span>
          <span className="text-blue-600 font-medium">{services.filter(s => s.status === 'in_process').length} activos</span>
          <span>·</span>
          <span className="text-red-600 font-medium">{services.filter(s => s.status === 'blocked').length} bloqueados</span>
        </div>
      </div>

      {/* Create modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nuevo Servicio" size="md">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Contrato</label>
            <select className="select" value={form.contract_id} onChange={e => setForm(f => ({ ...f, contract_id: e.target.value, sede_id: '' }))} required>
              <option value="">Seleccionar contrato...</option>
              {contracts.filter(c => c.status === 'active').map(c => (
                <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
              ))}
            </select>
          </div>
          {selectedContract && (
            <div>
              <label className="label">Sede</label>
              <select className="select" value={form.sede_id} onChange={e => setForm(f => ({ ...f, sede_id: e.target.value }))} required>
                <option value="">Seleccionar sede...</option>
                {selectedContract.sedes.filter(s => s.is_active).map(s => (
                  <option key={s.id} value={s.id}>{s.name} {s.city ? `— ${s.city}` : ''}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label">Vehículo</label>
            <select className="select" value={form.vehicle_id} onChange={e => setForm(f => ({ ...f, vehicle_id: e.target.value }))} required>
              <option value="">Seleccionar vehículo...</option>
              {vehicles.filter(v => v.is_active).map(v => (
                <option key={v.id} value={v.id}>{v.plate} — {v.brand} {v.model}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Tipo de servicio</label>
            <select className="select" value={form.service_type} onChange={e => setForm(f => ({ ...f, service_type: e.target.value }))}>
              {Object.entries(serviceTypeLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Notas (opcional)</label>
            <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" type="button" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button type="submit">Crear servicio</Button>
          </div>
        </form>
      </Modal>

      {/* Detail modal */}
      {detailSvc && (
        <Modal open={!!detailSvc} onClose={() => setDetailSvc(null)} title={`Servicio ${detailSvc.code}`} size="lg">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              {[
                ['Estado', <StatusBadge key="s" status={detailSvc.status} />],
                ['Tipo', serviceTypeLabel[detailSvc.service_type] || detailSvc.service_type],
                ['Cumplimiento', detailSvc.compliance_format_completed ? '✓ Completado' : '— Pendiente'],
                ['Creado', format(new Date(detailSvc.created_at), 'dd/MM/yyyy HH:mm', { locale: es })],
                ...(detailSvc.started_at ? [['Inicio', format(new Date(detailSvc.started_at), 'dd/MM/yyyy HH:mm', { locale: es })]] : []),
                ...(detailSvc.finished_at ? [['Fin', format(new Date(detailSvc.finished_at), 'dd/MM/yyyy HH:mm', { locale: es })]] : []),
                ...(detailSvc.block_reason ? [['Motivo bloqueo', detailSvc.block_reason]] : []),
              ].map(([label, value], i) => (
                <div key={i}>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">{label}</p>
                  <div className="mt-1">{value}</div>
                </div>
              ))}
            </div>
            {detailSvc.events.length > 0 && (
              <div>
                <p className="label mb-2">Línea de tiempo</p>
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {[...detailSvc.events].reverse().map(ev => (
                    <div key={ev.id} className="flex gap-3 text-xs">
                      <div className="mt-0.5 h-2 w-2 rounded-full bg-progio-400 flex-shrink-0" />
                      <div>
                        <span className="font-semibold text-slate-700 uppercase">{ev.event_type.replace('_', ' ')}</span>
                        {ev.description && <span className="text-slate-500"> — {ev.description}</span>}
                        <p className="text-slate-400">{format(new Date(ev.created_at), 'dd/MM HH:mm', { locale: es })}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
