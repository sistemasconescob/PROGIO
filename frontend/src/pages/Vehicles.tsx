import { useEffect, useState, useCallback } from 'react'
import { Plus, Search, Car } from 'lucide-react'
import Header from '../components/Layout/Header'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Spinner from '../components/ui/Spinner'
import { getVehicles, createVehicle, getClients } from '../api/misc'
import { apiError } from '../api/errorMessage'
import { useToast } from '../hooks/useToast'
import type { Vehicle, Client } from '../types'

const vehicleTypeLabel: Record<string, string> = {
  sedan: 'Sedán', suv: 'SUV', pickup: 'Pickup', van: 'Van',
  truck: 'Camión', motorcycle: 'Moto', bus: 'Bus', other: 'Otro',
}
const fuelLabel: Record<string, string> = {
  gasoline: 'Gasolina', diesel: 'Diésel', electric: 'Eléctrico',
  hybrid: 'Híbrido', gas: 'Gas',
}

export default function Vehicles() {
  const toast = useToast()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)

  const [form, setForm] = useState({
    plate: '', brand: '', model: '',
    year: new Date().getFullYear(),
    vehicle_type: 'sedan', fuel_type: 'gasoline', color: '',
    client_id: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [vRes, cRes] = await Promise.all([getVehicles(), getClients()])
      setVehicles(vRes.data)
      setClients(cRes.data)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = vehicles.filter(v =>
    !search ||
    v.plate.toLowerCase().includes(search.toLowerCase()) ||
    `${v.brand} ${v.model}`.toLowerCase().includes(search.toLowerCase())
  )

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload: Record<string, unknown> = {
      plate: form.plate.toUpperCase(),
      brand: form.brand,
      model: form.model,
      year: Number(form.year),
      vehicle_type: form.vehicle_type,
      fuel_type: form.fuel_type,
      color: form.color || undefined,
      client_id: form.client_id || undefined,
    }
    try {
      await createVehicle(payload)
      toast('success', 'Vehículo registrado')
      setCreateOpen(false)
      setForm({ plate: '', brand: '', model: '', year: new Date().getFullYear(), vehicle_type: 'sedan', fuel_type: 'gasoline', color: '', client_id: '' })
      load()
    } catch (err) {
      toast('error', apiError(err, 'Error al crear vehículo'))
    }
  }

  return (
    <div>
      <Header title="Vehículos" subtitle="Flota registrada en el sistema" />
      <div className="p-6 space-y-4">

        <div className="flex gap-3 items-center justify-between">
          <div className="relative max-w-xs flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Placa o vehículo..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Button icon={<Plus size={15} />} onClick={() => setCreateOpen(true)}>Nuevo vehículo</Button>
        </div>

        {loading ? <Spinner /> : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Placa', 'Vehículo', 'Tipo', 'Combustible', 'Cliente', 'Color', 'Estado'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0
                    ? <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">No hay vehículos</td></tr>
                    : filtered.map(v => (
                      <tr key={v.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-lg bg-progio-50 flex items-center justify-center">
                              <Car size={14} className="text-progio-600" />
                            </div>
                            <span className="font-mono font-semibold text-slate-700 tracking-wider">{v.plate}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {v.brand} {v.model} {v.year && <span className="text-slate-400">({v.year})</span>}
                        </td>
                        <td className="px-4 py-3 text-slate-500">{vehicleTypeLabel[v.vehicle_type] || v.vehicle_type}</td>
                        <td className="px-4 py-3"><Badge variant="info" size="sm">{fuelLabel[v.fuel_type] || v.fuel_type}</Badge></td>
                        <td className="px-4 py-3">
                          {v.client_id
                            ? <span className="text-slate-600 text-xs">{clients.find(c => c.id === v.client_id)?.full_name ?? '—'}</span>
                            : <span className="text-slate-300 text-xs">Sin asignar</span>}
                        </td>
                        <td className="px-4 py-3">
                          {v.color
                            ? <span className="text-slate-500 text-xs">{v.color}</span>
                            : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={v.is_active ? 'success' : 'default'} size="sm">
                            {v.is_active ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nuevo Vehículo" size="md">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Placa</label>
              <input className="input font-mono uppercase" required placeholder="ABC123"
                value={form.plate} onChange={e => setForm(f => ({ ...f, plate: e.target.value.toUpperCase() }))} />
            </div>
            <div>
              <label className="label">Año</label>
              <input className="input" type="number" required min={1990} max={2030}
                value={form.year} onChange={e => setForm(f => ({ ...f, year: Number(e.target.value) }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Marca</label>
              <input className="input" required placeholder="Toyota"
                value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} />
            </div>
            <div>
              <label className="label">Modelo</label>
              <input className="input" required placeholder="Corolla"
                value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tipo</label>
              <select className="select" value={form.vehicle_type} onChange={e => setForm(f => ({ ...f, vehicle_type: e.target.value }))}>
                {Object.entries(vehicleTypeLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Combustible</label>
              <select className="select" value={form.fuel_type} onChange={e => setForm(f => ({ ...f, fuel_type: e.target.value }))}>
                {Object.entries(fuelLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Color (opcional)</label>
            <input className="input" placeholder="Blanco, Negro..."
              value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} />
          </div>
          <div>
            <label className="label">Empresa / Cliente asociado</label>
            <select className="select" value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}>
              <option value="">Sin asignar</option>
              {clients.filter(c => c.is_active).map(c => (
                <option key={c.id} value={c.id}>
                  {c.full_name}{c.company_name ? ` — ${c.company_name}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" type="button" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button type="submit">Registrar</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
