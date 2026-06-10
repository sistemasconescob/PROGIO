import { useEffect, useState, useCallback } from 'react'
import { Plus, Search, ChevronRight, MapPin } from 'lucide-react'
import Header from '../components/Layout/Header'
import { ContractStatusBadge, Badge } from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Spinner from '../components/ui/Spinner'
import { getContracts, createContract } from '../api/contracts'
import { createSede } from '../api/misc'
import { apiError } from '../api/errorMessage'
import { useToast } from '../hooks/useToast'
import type { Contract } from '../types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const typeLabel = { in_house: 'In-House', service_point: 'Punto de Servicio' }

export default function Contracts() {
  const toast = useToast()
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [detail, setDetail] = useState<Contract | null>(null)
  const [sedeOpen, setSedeOpen] = useState(false)

  const [form, setForm] = useState({
    name: '', code: '', type: 'in_house', client_company: '',
    start_date: '', end_date: '', description: '',
  })
  const [sedeForm, setSedeForm] = useState({ name: '', address: '', city: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getContracts()
      setContracts(res.data)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = contracts.filter(c =>
    !search ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  )

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createContract(form)
      toast('success', 'Contrato creado')
      setCreateOpen(false)
      setForm({ name: '', code: '', type: 'in_house', client_company: '', start_date: '', end_date: '', description: '' })
      load()
    } catch (err: unknown) {
      toast('error', apiError(err, 'Error al crear contrato'))
    }
  }

  const handleAddSede = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!detail) return
    try {
      await createSede(detail.id, sedeForm)
      toast('success', 'Sede agregada')
      setSedeOpen(false)
      setSedeForm({ name: '', address: '', city: '' })
      const res = await getContracts()
      setContracts(res.data)
      const updated = res.data.find(c => c.id === detail.id)
      if (updated) setDetail(updated)
    } catch (err: unknown) {
      toast('error', apiError(err, 'Error al agregar sede'))
    }
  }

  return (
    <div>
      <Header title="Contratos" subtitle="Control de contratos y clientes" />
      <div className="p-6 space-y-4">

        <div className="flex gap-3 items-center justify-between">
          <div className="relative max-w-xs flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Buscar contrato..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Button icon={<Plus size={15} />} onClick={() => setCreateOpen(true)}>Nuevo contrato</Button>
        </div>

        {loading ? <Spinner /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.length === 0
              ? <p className="text-slate-400 text-sm col-span-3 py-12 text-center">No hay contratos</p>
              : filtered.map(c => (
                <button key={c.id} onClick={() => setDetail(c)}
                  className="text-left rounded-2xl border border-slate-100 bg-white p-5 shadow-sm hover:shadow-md hover:border-progio-200 transition-all group">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-slate-800 group-hover:text-progio-700 transition-colors">{c.name}</p>
                      <p className="text-xs font-mono text-slate-400 mt-0.5">{c.code}</p>
                    </div>
                    <ContractStatusBadge status={c.status} />
                  </div>
                  {c.client_company && <p className="text-xs text-slate-500 mb-2">{c.client_company}</p>}
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="info" size="sm">{typeLabel[c.type]}</Badge>
                    <span className="text-xs text-slate-400">{c.sedes.length} sede{c.sedes.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="text-xs text-slate-400 flex items-center justify-between">
                    <span>{format(new Date(c.start_date), 'dd MMM yyyy', { locale: es })} → {format(new Date(c.end_date), 'dd MMM yyyy', { locale: es })}</span>
                    <ChevronRight size={14} className="text-slate-300 group-hover:text-progio-400 transition-colors" />
                  </div>
                </button>
              ))}
          </div>
        )}
      </div>

      {/* Create */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nuevo Contrato" size="md">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Nombre</label>
              <input className="input" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Código</label>
              <input className="input font-mono" required value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tipo</label>
              <select className="select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option value="in_house">In-House</option>
                <option value="service_point">Punto de Servicio</option>
              </select>
            </div>
            <div>
              <label className="label">Empresa cliente</label>
              <input className="input" value={form.client_company} onChange={e => setForm(f => ({ ...f, client_company: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Fecha inicio</label>
              <input className="input" type="date" required value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
            </div>
            <div>
              <label className="label">Fecha fin</label>
              <input className="input" type="date" required value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Descripción</label>
            <textarea className="input resize-none" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" type="button" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button type="submit">Crear</Button>
          </div>
        </form>
      </Modal>

      {/* Detail */}
      {detail && (
        <Modal open={!!detail} onClose={() => setDetail(null)} title={detail.name} size="lg">
          <div className="space-y-4">
            <div className="flex gap-3 flex-wrap">
              <ContractStatusBadge status={detail.status} />
              <Badge variant="info">{typeLabel[detail.type]}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">Código</p>
                <p className="mt-1 font-mono text-slate-700">{detail.code}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">Vigencia</p>
                <p className="mt-1 text-slate-700">
                  {format(new Date(detail.start_date), 'dd/MM/yyyy', { locale: es })} — {format(new Date(detail.end_date), 'dd/MM/yyyy', { locale: es })}
                </p>
              </div>
              {detail.client_company && (
                <div className="col-span-2">
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">Cliente</p>
                  <p className="mt-1 text-slate-700">{detail.client_company}</p>
                </div>
              )}
            </div>

            {/* Sedes */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="label">Sedes ({detail.sedes.length})</p>
                <button onClick={() => setSedeOpen(true)}
                  className="flex items-center gap-1 text-xs text-progio-700 hover:underline font-medium">
                  <Plus size={12} /> Agregar sede
                </button>
              </div>
              {detail.sedes.length === 0
                ? <p className="text-xs text-slate-400 py-3 text-center">Sin sedes registradas</p>
                : (
                  <div className="space-y-1.5">
                    {detail.sedes.map(s => (
                      <div key={s.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                        <div className="flex items-center gap-2">
                          <MapPin size={13} className="text-slate-400" />
                          <span className="font-medium text-slate-700">{s.name}</span>
                          {s.city && <span className="text-slate-400 text-xs">— {s.city}</span>}
                        </div>
                        <Badge variant={s.is_active ? 'success' : 'default'} size="sm">
                          {s.is_active ? 'Activa' : 'Inactiva'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </div>
        </Modal>
      )}

      {/* Add sede */}
      <Modal open={sedeOpen} onClose={() => setSedeOpen(false)} title="Agregar Sede" size="sm">
        <form onSubmit={handleAddSede} className="space-y-4">
          <div>
            <label className="label">Nombre de la sede</label>
            <input className="input" required value={sedeForm.name} onChange={e => setSedeForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Ciudad</label>
              <input className="input" value={sedeForm.city} onChange={e => setSedeForm(f => ({ ...f, city: e.target.value }))} />
            </div>
            <div>
              <label className="label">Dirección</label>
              <input className="input" value={sedeForm.address} onChange={e => setSedeForm(f => ({ ...f, address: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" type="button" onClick={() => setSedeOpen(false)}>Cancelar</Button>
            <Button type="submit">Agregar</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
