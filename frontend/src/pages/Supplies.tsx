import { useEffect, useState, useCallback } from 'react'
import { Plus, Search, Package } from 'lucide-react'
import Header from '../components/Layout/Header'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Spinner from '../components/ui/Spinner'
import { getSupplies, createSupply, updateSupply, registerSupplyUsage, getSupplies as loadSupplies } from '../api/misc'
import { getServices } from '../api/services'
import { apiError } from '../api/errorMessage'
import { useToast } from '../hooks/useToast'
import type { Supply, Service } from '../types'

const categoryLabel: Record<string, string> = {
  cleaning_agent: 'Agente de limpieza',
  water: 'Agua',
  equipment: 'Equipo',
  protective: 'Protector',
  other: 'Otro',
}

const categoryVariant: Record<string, 'info' | 'success' | 'warning' | 'default'> = {
  cleaning_agent: 'info',
  water: 'info',
  equipment: 'warning',
  protective: 'success',
  other: 'default',
}

export default function Supplies() {
  const toast = useToast()
  const [supplies, setSupplies] = useState<Supply[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Supply | null>(null)
  const [usageOpen, setUsageOpen] = useState(false)

  const [form, setForm] = useState({ name: '', unit: 'L', unit_cost: 0, category: 'cleaning_agent', description: '' })
  const [usageForm, setUsageForm] = useState({ service_id: '', supply_id: '', quantity: 1 })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [sRes, svcRes] = await Promise.all([loadSupplies(), getServices({ limit: 100, status: 'in_process' })])
      setSupplies(sRes.data)
      setServices(svcRes.data)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = supplies.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.category.includes(search.toLowerCase())
  )

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createSupply({ ...form, unit_cost: Number(form.unit_cost) })
      toast('success', 'Insumo creado')
      setCreateOpen(false)
      setForm({ name: '', unit: 'L', unit_cost: 0, category: 'cleaning_agent', description: '' })
      load()
    } catch (err: unknown) {
      toast('error', apiError(err, 'Error'))
    }
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editTarget) return
    try {
      await updateSupply(editTarget.id, { unit_cost: Number(form.unit_cost), description: form.description })
      toast('success', 'Insumo actualizado')
      setEditTarget(null)
      load()
    } catch (err: unknown) {
      toast('error', apiError(err, 'Error'))
    }
  }

  const handleUsage = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await registerSupplyUsage({ ...usageForm, quantity: Number(usageForm.quantity) })
      toast('success', 'Uso registrado en el servicio')
      setUsageOpen(false)
      setUsageForm({ service_id: '', supply_id: '', quantity: 1 })
    } catch (err: unknown) {
      toast('error', apiError(err, 'Error al registrar uso'))
    }
  }

  const openEdit = (s: Supply) => {
    setForm({ name: s.name, unit: s.unit, unit_cost: s.unit_cost, category: s.category, description: s.description || '' })
    setEditTarget(s)
  }

  return (
    <div>
      <Header title="Insumos" subtitle="Catálogo de consumibles y registro de uso" />
      <div className="p-6 space-y-4">
        <div className="flex gap-3 items-center justify-between">
          <div className="relative max-w-xs flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Nombre o categoría..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" icon={<Package size={15} />} onClick={() => setUsageOpen(true)}>Registrar uso</Button>
            <Button icon={<Plus size={15} />} onClick={() => setCreateOpen(true)}>Nuevo insumo</Button>
          </div>
        </div>

        {loading ? <Spinner /> : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Nombre', 'Categoría', 'Unidad', 'Costo unitario', 'Estado', 'Acciones'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0
                    ? <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">No hay insumos</td></tr>
                    : filtered.map(s => (
                      <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-lg bg-slate-50 flex items-center justify-center">
                              <Package size={14} className="text-slate-400" />
                            </div>
                            <div>
                              <p className="font-medium text-slate-700">{s.name}</p>
                              {s.description && <p className="text-xs text-slate-400">{s.description}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={categoryVariant[s.category] || 'default'} size="sm">
                            {categoryLabel[s.category] || s.category}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-slate-500">{s.unit}</td>
                        <td className="px-4 py-3 font-semibold text-slate-700">
                          ${Number(s.unit_cost).toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={s.is_active ? 'success' : 'default'} size="sm">
                            {s.is_active ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => openEdit(s)}
                            className="text-xs text-progio-700 hover:underline font-medium">
                            Editar
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* Create */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nuevo Insumo" size="md">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Nombre</label>
              <input className="input" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Categoría</label>
              <select className="select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {Object.entries(categoryLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Unidad</label>
              <select className="select" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                {['L', 'mL', 'kg', 'g', 'unidad', 'galón'].map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Costo por unidad</label>
              <input className="input" type="number" min={0} step={0.01} required value={form.unit_cost}
                onChange={e => setForm(f => ({ ...f, unit_cost: Number(e.target.value) }))} />
            </div>
            <div className="col-span-2">
              <label className="label">Descripción (opcional)</label>
              <input className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" type="button" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button type="submit">Crear insumo</Button>
          </div>
        </form>
      </Modal>

      {/* Edit */}
      {editTarget && (
        <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title={`Editar — ${editTarget.name}`} size="sm">
          <form onSubmit={handleEdit} className="space-y-4">
            <div>
              <label className="label">Costo por {editTarget.unit}</label>
              <input className="input" type="number" min={0} step={0.01} value={form.unit_cost}
                onChange={e => setForm(f => ({ ...f, unit_cost: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="label">Descripción</label>
              <input className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="secondary" type="button" onClick={() => setEditTarget(null)}>Cancelar</Button>
              <Button type="submit">Guardar</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Register usage */}
      <Modal open={usageOpen} onClose={() => setUsageOpen(false)} title="Registrar Uso de Insumo" size="sm">
        <form onSubmit={handleUsage} className="space-y-4">
          <div>
            <label className="label">Servicio en proceso</label>
            <select className="select" required value={usageForm.service_id}
              onChange={e => setUsageForm(f => ({ ...f, service_id: e.target.value }))}>
              <option value="">Seleccionar servicio...</option>
              {services.map(s => <option key={s.id} value={s.id}>{s.code}</option>)}
            </select>
            {services.length === 0 && <p className="text-xs text-amber-600 mt-1">No hay servicios en proceso activos</p>}
          </div>
          <div>
            <label className="label">Insumo</label>
            <select className="select" required value={usageForm.supply_id}
              onChange={e => setUsageForm(f => ({ ...f, supply_id: e.target.value }))}>
              <option value="">Seleccionar insumo...</option>
              {supplies.filter(s => s.is_active).map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Cantidad</label>
            <input className="input" type="number" min={0.001} step={0.001} required value={usageForm.quantity}
              onChange={e => setUsageForm(f => ({ ...f, quantity: Number(e.target.value) }))} />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" type="button" onClick={() => setUsageOpen(false)}>Cancelar</Button>
            <Button type="submit">Registrar</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
