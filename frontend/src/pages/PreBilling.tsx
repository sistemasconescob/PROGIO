import { useEffect, useState, useCallback } from 'react'
import { Plus, CheckCheck, X, ChevronDown } from 'lucide-react'
import Header from '../components/Layout/Header'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Spinner from '../components/ui/Spinner'
import { getPreFacturas, createPreFactura, approvePreFactura, cancelPreFactura } from '../api/misc'
import { getContracts } from '../api/contracts'
import { apiError } from '../api/errorMessage'
import { useToast } from '../hooks/useToast'
import type { PreFactura, Contract, PreFacturaStatus } from '../types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAuth } from '../contexts/AuthContext'

const statusConfig: Record<PreFacturaStatus, { label: string; variant: 'default' | 'info' | 'success' | 'warning' | 'danger' }> = {
  draft:     { label: 'Borrador',   variant: 'default' },
  approved:  { label: 'Aprobado',   variant: 'success' },
  sent:      { label: 'Enviado',    variant: 'info' },
  paid:      { label: 'Pagado',     variant: 'success' },
  cancelled: { label: 'Anulado',    variant: 'danger' },
}

interface ItemForm { description: string; quantity: string; unit_price: string }

export default function PreBilling() {
  const { user } = useAuth()
  const toast = useToast()
  const [prefacturas, setPrefacturas] = useState<PreFactura[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [detail, setDetail] = useState<PreFactura | null>(null)
  const [statusFilter, setStatusFilter] = useState<PreFacturaStatus | ''>('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const [form, setForm] = useState({ contract_id: '', period_start: '', period_end: '', notes: '' })
  const [items, setItems] = useState<ItemForm[]>([{ description: '', quantity: '1', unit_price: '0' }])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = {}
      if (statusFilter) params.status = statusFilter
      const [pfRes, cRes] = await Promise.all([getPreFacturas(params), getContracts()])
      setPrefacturas(pfRes.data)
      setContracts(cRes.data)
    } finally { setLoading(false) }
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  const addItem = () => setItems(i => [...i, { description: '', quantity: '1', unit_price: '0' }])
  const removeItem = (idx: number) => setItems(i => i.filter((_, j) => j !== idx))
  const updateItem = (idx: number, field: keyof ItemForm, val: string) =>
    setItems(i => i.map((item, j) => j === idx ? { ...item, [field]: val } : item))

  const totalAmount = items.reduce((sum, it) =>
    sum + (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0), 0)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createPreFactura({
        ...form,
        created_by_id: user?.id,
        items: items.map(it => ({
          description: it.description,
          quantity: parseFloat(it.quantity),
          unit_price: parseFloat(it.unit_price),
        })),
      })
      toast('success', 'Pre-factura creada')
      setCreateOpen(false)
      setForm({ contract_id: '', period_start: '', period_end: '', notes: '' })
      setItems([{ description: '', quantity: '1', unit_price: '0' }])
      load()
    } catch (err: unknown) {
      toast('error', apiError(err, 'Error al crear pre-factura'))
    }
  }

  const handleApprove = async (pf: PreFactura) => {
    setActionLoading(pf.id)
    try {
      await approvePreFactura(pf.id)
      toast('success', 'Pre-factura aprobada')
      load()
      setDetail(null)
    } catch (err: unknown) {
      toast('error', apiError(err, 'Error'))
    } finally { setActionLoading(null) }
  }

  const handleCancel = async (pf: PreFactura) => {
    setActionLoading(pf.id)
    try {
      await cancelPreFactura(pf.id)
      toast('success', 'Pre-factura anulada')
      load()
      setDetail(null)
    } catch (err: unknown) {
      toast('error', apiError(err, 'Error'))
    } finally { setActionLoading(null) }
  }

  const contractName = (id: string) => {
    const c = contracts.find(c => c.id === id)
    return c ? `${c.code} — ${c.name}` : id.slice(0, 8)
  }

  return (
    <div>
      <Header title="Pre-Facturación" subtitle="Control de cobros por período contractual" />
      <div className="p-6 space-y-4">

        <div className="flex gap-3 items-center justify-between">
          <div className="relative">
            <select className="select w-44" value={statusFilter} onChange={e => setStatusFilter(e.target.value as PreFacturaStatus | '')}>
              <option value="">Todos los estados</option>
              {Object.entries(statusConfig).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
          <Button icon={<Plus size={15} />} onClick={() => setCreateOpen(true)}>Nueva pre-factura</Button>
        </div>

        {loading ? <Spinner /> : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Código', 'Contrato', 'Período', 'Total', 'Estado', 'Acciones'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {prefacturas.length === 0
                    ? <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">No hay pre-facturas</td></tr>
                    : prefacturas.map(pf => {
                      const cfg = statusConfig[pf.status] || { label: pf.status, variant: 'default' as const }
                      return (
                        <tr key={pf.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">{pf.code}</td>
                          <td className="px-4 py-3 text-slate-600 text-xs">{contractName(pf.contract_id)}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs">
                            {format(new Date(pf.period_start), 'dd/MM/yy', { locale: es })} — {format(new Date(pf.period_end), 'dd/MM/yy', { locale: es })}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-700">
                            ${Number(pf.total_amount).toLocaleString('es-CO')}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={cfg.variant} size="sm">{cfg.label}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button onClick={() => setDetail(pf)} className="text-xs text-progio-700 hover:underline font-medium">Ver</button>
                              {pf.status === 'draft' && (
                                <>
                                  <span className="text-slate-200">|</span>
                                  <button onClick={() => handleApprove(pf)}
                                    disabled={actionLoading === pf.id}
                                    className="text-xs text-emerald-600 hover:underline font-medium flex items-center gap-1">
                                    <CheckCheck size={11} /> Aprobar
                                  </button>
                                  <span className="text-slate-200">|</span>
                                  <button onClick={() => handleCancel(pf)}
                                    disabled={actionLoading === pf.id}
                                    className="text-xs text-red-500 hover:underline font-medium flex items-center gap-1">
                                    <X size={11} /> Anular
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* Create */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nueva Pre-Factura" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Contrato</label>
            <select className="select" required value={form.contract_id} onChange={e => setForm(f => ({ ...f, contract_id: e.target.value }))}>
              <option value="">Seleccionar contrato...</option>
              {contracts.filter(c => c.status === 'active').map(c => (
                <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Período inicio</label>
              <input className="input" type="date" required value={form.period_start} onChange={e => setForm(f => ({ ...f, period_start: e.target.value }))} />
            </div>
            <div>
              <label className="label">Período fin</label>
              <input className="input" type="date" required value={form.period_end} onChange={e => setForm(f => ({ ...f, period_end: e.target.value }))} />
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Ítems</label>
              <button type="button" onClick={addItem} className="text-xs text-progio-700 hover:underline font-medium flex items-center gap-1">
                <Plus size={11} /> Agregar ítem
              </button>
            </div>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <input className="input col-span-5" placeholder="Descripción" required value={item.description}
                    onChange={e => updateItem(idx, 'description', e.target.value)} />
                  <input className="input col-span-2" type="number" min={0.01} step={0.01} placeholder="Cant." required value={item.quantity}
                    onChange={e => updateItem(idx, 'quantity', e.target.value)} />
                  <input className="input col-span-3" type="number" min={0} step={100} placeholder="Precio" required value={item.unit_price}
                    onChange={e => updateItem(idx, 'unit_price', e.target.value)} />
                  <div className="col-span-1 text-xs text-slate-500 text-right">
                    ${((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0)).toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                  </div>
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItem(idx)} className="col-span-1 text-red-400 hover:text-red-600">
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="text-right mt-2">
              <span className="text-sm font-bold text-slate-700">Total: ${totalAmount.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</span>
            </div>
          </div>

          <div>
            <label className="label">Notas</label>
            <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" type="button" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button type="submit">Crear pre-factura</Button>
          </div>
        </form>
      </Modal>

      {/* Detail */}
      {detail && (
        <Modal open={!!detail} onClose={() => setDetail(null)} title={`Pre-factura ${detail.code}`} size="lg">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge variant={statusConfig[detail.status]?.variant || 'default'}>
                {statusConfig[detail.status]?.label || detail.status}
              </Badge>
              <span className="text-sm text-slate-500">{contractName(detail.contract_id)}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">Período</p>
                <p className="mt-1">{format(new Date(detail.period_start), 'dd/MM/yyyy', { locale: es })} — {format(new Date(detail.period_end), 'dd/MM/yyyy', { locale: es })}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">Total</p>
                <p className="mt-1 text-xl font-bold text-slate-800">${Number(detail.total_amount).toLocaleString('es-CO')}</p>
              </div>
            </div>
            {detail.items.length > 0 && (
              <div>
                <p className="label mb-2">Ítems ({detail.items.length})</p>
                <div className="rounded-xl overflow-hidden border border-slate-100">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        {['Descripción', 'Cant.', 'Precio unit.', 'Subtotal'].map(h => (
                          <th key={h} className="px-3 py-2 text-left text-slate-500 font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {detail.items.map(it => (
                        <tr key={it.id} className="border-t border-slate-50">
                          <td className="px-3 py-2 text-slate-700">{it.description}</td>
                          <td className="px-3 py-2 text-slate-500">{it.quantity}</td>
                          <td className="px-3 py-2 text-slate-500">${Number(it.unit_price).toLocaleString('es-CO')}</td>
                          <td className="px-3 py-2 font-semibold text-slate-700">${Number(it.subtotal).toLocaleString('es-CO')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {detail.status === 'draft' && (
              <div className="flex gap-2 justify-end pt-2 border-t border-slate-50">
                <Button variant="danger" size="sm" icon={<X size={13} />} onClick={() => handleCancel(detail)}
                  loading={actionLoading === detail.id}>Anular</Button>
                <Button size="sm" icon={<CheckCheck size={13} />} onClick={() => handleApprove(detail)}
                  loading={actionLoading === detail.id}>Aprobar</Button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
