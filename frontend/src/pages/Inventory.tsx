import { useEffect, useState, useCallback } from 'react'
import { Plus, ChevronRight, AlertTriangle, CheckCircle2, Clock, Lock } from 'lucide-react'
import Header from '../components/Layout/Header'
import { Badge } from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Spinner from '../components/ui/Spinner'
import { getPeriods, createPeriod, updatePeriodItem, startReconciliation, closePeriod } from '../api/inventory'
import { getContracts } from '../api/contracts'
import { apiError } from '../api/errorMessage'
import { useToast } from '../hooks/useToast'
import type { InventoryPeriod, InventoryPeriodItem, Contract } from '../types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const statusConfig = {
  open: { label: 'Abierto', icon: Clock, color: 'info' },
  reconciling: { label: 'En conciliación', icon: AlertTriangle, color: 'warning' },
  closed: { label: 'Cerrado', icon: Lock, color: 'default' },
} as const

const periodTypeLabels: Record<string, string> = {
  weekly: 'Semanal',
  biweekly: 'Quincenal',
  monthly: 'Mensual',
  bimonthly: 'Bimestral',
}

export default function Inventory() {
  const toast = useToast()
  const [periods, setPeriods] = useState<InventoryPeriod[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<InventoryPeriod | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [filterContract, setFilterContract] = useState('')

  const [form, setForm] = useState({
    contract_id: '', sede_id: '', workstation: '',
    period_label: '', period_start: '', period_end: '',
    period_type: 'monthly', notes: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [pRes, cRes] = await Promise.all([getPeriods(), getContracts()])
      setPeriods(pRes.data)
      setContracts(cRes.data)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = periods.filter(p =>
    !filterContract || p.contract_id === filterContract
  )

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createPeriod({
        contract_id: form.contract_id,
        sede_id: form.sede_id || undefined,
        workstation: form.workstation || undefined,
        period_label: form.period_label,
        period_start: form.period_start,
        period_end: form.period_end,
        period_type: form.period_type,
        notes: form.notes || undefined,
        items: [],
      })
      toast('success', 'Periodo creado')
      setCreateOpen(false)
      setForm({ contract_id: '', sede_id: '', workstation: '', period_label: '', period_start: '', period_end: '', period_type: 'monthly', notes: '' })
      load()
    } catch (err) {
      toast('error', apiError(err, 'Error al crear periodo'))
    }
  }

  const handleUpdateItem = async (item: InventoryPeriodItem, field: string, value: string) => {
    if (!detail) return
    try {
      await updatePeriodItem(detail.id, item.id, { [field]: parseFloat(value) || 0 })
      const refreshed = (await getPeriods()).data.find(p => p.id === detail.id)
      if (refreshed) { setDetail(refreshed); setPeriods(prev => prev.map(p => p.id === refreshed.id ? refreshed : p)) }
    } catch (err) {
      toast('error', apiError(err, 'Error al actualizar'))
    }
  }

  const handleReconcile = async () => {
    if (!detail) return
    try {
      const res = await startReconciliation(detail.id)
      setDetail(res.data)
      setPeriods(prev => prev.map(p => p.id === res.data.id ? res.data : p))
      toast('success', 'Periodo en conciliación')
    } catch (err) { toast('error', apiError(err, 'Error')) }
  }

  const handleClose = async () => {
    if (!detail) return
    if (!confirm('¿Cerrar el periodo? Se calcularán las diferencias y no se podrá editar.')) return
    try {
      const res = await closePeriod(detail.id)
      setDetail(res.data)
      setPeriods(prev => prev.map(p => p.id === res.data.id ? res.data : p))
      toast('success', 'Periodo cerrado')
    } catch (err) { toast('error', apiError(err, 'Error al cerrar periodo')) }
  }

  const contractName = (id: string) => contracts.find(c => c.id === id)?.name ?? id.slice(0, 8)

  return (
    <div>
      <Header title="Inventarios" subtitle="Control de inventarios por periodo (Sección 4)" />
      <div className="p-6 space-y-4">

        <div className="flex gap-3 items-center justify-between">
          <select className="select max-w-xs" value={filterContract} onChange={e => setFilterContract(e.target.value)}>
            <option value="">Todos los contratos</option>
            {contracts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <Button icon={<Plus size={15} />} onClick={() => setCreateOpen(true)}>Nuevo periodo</Button>
        </div>

        {loading ? <Spinner /> : (
          <div className="space-y-2">
            {filtered.length === 0
              ? <p className="text-slate-400 text-sm text-center py-12">No hay periodos de inventario</p>
              : filtered.map(p => {
                const cfg = statusConfig[p.status]
                const Icon = cfg.icon
                return (
                  <button key={p.id} onClick={() => setDetail(p)}
                    className="w-full text-left rounded-xl border border-slate-100 bg-white p-4 shadow-sm hover:shadow-md hover:border-progio-200 transition-all group flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-50">
                        <Icon size={18} className="text-slate-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-slate-800">{p.period_label}</p>
                          <Badge variant={cfg.color as 'info' | 'warning' | 'default'} size="sm">{cfg.label}</Badge>
                          <Badge variant="default" size="sm">{periodTypeLabels[p.period_type] ?? p.period_type}</Badge>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{contractName(p.contract_id)} · {p.items.length} insumo{p.items.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <span>{format(new Date(p.period_start), 'dd/MM/yyyy', { locale: es })} → {format(new Date(p.period_end), 'dd/MM/yyyy', { locale: es })}</span>
                      <ChevronRight size={14} className="text-slate-300 group-hover:text-progio-400 transition-colors" />
                    </div>
                  </button>
                )
              })}
          </div>
        )}
      </div>

      {/* ── Create Modal ── */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nuevo Periodo de Inventario" size="md">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Contrato <span className="text-red-400">*</span></label>
              <select className="select" required value={form.contract_id} onChange={e => setForm(p => ({ ...p, contract_id: e.target.value }))}>
                <option value="">Seleccionar...</option>
                {contracts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Etiqueta del periodo <span className="text-red-400">*</span></label>
              <input className="input" placeholder="2026-06" required value={form.period_label} onChange={e => setForm(p => ({ ...p, period_label: e.target.value }))} />
            </div>
            <div>
              <label className="label">Tipo de periodo</label>
              <select className="select" value={form.period_type} onChange={e => setForm(p => ({ ...p, period_type: e.target.value }))}>
                <option value="weekly">Semanal</option>
                <option value="biweekly">Quincenal</option>
                <option value="monthly">Mensual</option>
                <option value="bimonthly">Bimestral</option>
              </select>
            </div>
            <div>
              <label className="label">Fecha inicio <span className="text-red-400">*</span></label>
              <input className="input" type="date" required value={form.period_start} onChange={e => setForm(p => ({ ...p, period_start: e.target.value }))} />
            </div>
            <div>
              <label className="label">Fecha fin <span className="text-red-400">*</span></label>
              <input className="input" type="date" required value={form.period_end} onChange={e => setForm(p => ({ ...p, period_end: e.target.value }))} />
            </div>
            <div>
              <label className="label">Puesto de trabajo</label>
              <input className="input" placeholder="Opcional" value={form.workstation} onChange={e => setForm(p => ({ ...p, workstation: e.target.value }))} />
            </div>
            <div>
              <label className="label">Notas</label>
              <input className="input" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" type="button" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button type="submit">Crear periodo</Button>
          </div>
        </form>
      </Modal>

      {/* ── Detail Modal ── */}
      {detail && (
        <Modal open={!!detail} onClose={() => setDetail(null)} title={`Periodo ${detail.period_label}`} size="lg">
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Badge variant={statusConfig[detail.status].color as 'info' | 'warning' | 'default'}>{statusConfig[detail.status].label}</Badge>
              <Badge variant="default">{periodTypeLabels[detail.period_type] ?? detail.period_type}</Badge>
              <span className="text-xs text-slate-400 self-center">{contractName(detail.contract_id)}</span>
            </div>

            {/* Items table */}
            <div>
              <p className="label mb-2">Insumos del periodo</p>
              {detail.items.length === 0
                ? <p className="text-xs text-slate-400 text-center py-4">Sin insumos registrados</p>
                : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-slate-400 uppercase tracking-wide text-left border-b border-slate-100">
                          <th className="pb-2 pr-3">Insumo</th>
                          <th className="pb-2 pr-3 text-right">Stock inicial</th>
                          <th className="pb-2 pr-3 text-right">Ingresos</th>
                          <th className="pb-2 pr-3 text-right">Ajustes</th>
                          <th className="pb-2 pr-3 text-right">Cons. teórico</th>
                          <th className="pb-2 pr-3 text-right">Stock físico</th>
                          <th className="pb-2 text-right">Diferencia</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {detail.items.map(item => (
                          <tr key={item.id} className="hover:bg-slate-50">
                            <td className="py-2 pr-3 font-medium text-slate-700">{item.supply?.name ?? '—'}</td>
                            <td className="py-2 pr-3 text-right text-slate-500">{Number(item.initial_stock).toFixed(2)}</td>
                            <td className="py-2 pr-3 text-right">
                              {detail.status === 'open' ? (
                                <input type="number" step="0.01" className="input w-20 text-right py-0.5 px-1 text-xs"
                                  defaultValue={Number(item.entries).toFixed(2)}
                                  onBlur={e => handleUpdateItem(item, 'entries', e.target.value)} />
                              ) : Number(item.entries).toFixed(2)}
                            </td>
                            <td className="py-2 pr-3 text-right">
                              {detail.status !== 'closed' ? (
                                <input type="number" step="0.01" className="input w-20 text-right py-0.5 px-1 text-xs"
                                  defaultValue={Number(item.adjustments).toFixed(2)}
                                  onBlur={e => handleUpdateItem(item, 'adjustments', e.target.value)} />
                              ) : Number(item.adjustments).toFixed(2)}
                            </td>
                            <td className="py-2 pr-3 text-right text-slate-500">{Number(item.theoretical_consumption).toFixed(2)}</td>
                            <td className="py-2 pr-3 text-right">
                              {detail.status === 'reconciling' ? (
                                <input type="number" step="0.01" className="input w-24 text-right py-0.5 px-1 text-xs"
                                  defaultValue={item.final_stock_physical != null ? Number(item.final_stock_physical).toFixed(2) : ''}
                                  placeholder="Conteo"
                                  onBlur={e => handleUpdateItem(item, 'final_stock_physical', e.target.value)} />
                              ) : item.final_stock_physical != null ? Number(item.final_stock_physical).toFixed(2) : '—'}
                            </td>
                            <td className="py-2 text-right">
                              {item.difference != null ? (
                                <span className={Number(item.difference) < 0 ? 'text-red-500 font-medium' : 'text-emerald-600 font-medium'}>
                                  {Number(item.difference) >= 0 ? '+' : ''}{Number(item.difference).toFixed(2)}
                                  {item.deviation_pct != null && <span className="text-slate-400 ml-1">({item.deviation_pct.toFixed(1)}%)</span>}
                                </span>
                              ) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2 justify-end">
              {detail.status === 'open' && (
                <Button variant="secondary" onClick={handleReconcile}>Iniciar conciliación</Button>
              )}
              {detail.status === 'reconciling' && (
                <Button onClick={handleClose}>Cerrar periodo</Button>
              )}
              {detail.status === 'closed' && (
                <div className="flex items-center gap-2 text-emerald-600 text-sm">
                  <CheckCircle2 size={15} /> Periodo cerrado
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
