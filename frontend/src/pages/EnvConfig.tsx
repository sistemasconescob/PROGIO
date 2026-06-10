import { useEffect, useState, useCallback } from 'react'
import { Plus, Leaf } from 'lucide-react'
import Header from '../components/Layout/Header'
import { Card, CardHeader, CardBody } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Spinner from '../components/ui/Spinner'
import { getEnvConfigs, createEnvConfig } from '../api/misc'
import { apiError } from '../api/errorMessage'
import { useToast } from '../hooks/useToast'
import type { EnvironmentalConfig } from '../types'

const vehicleTypeLabel: Record<string, string> = {
  sedan: 'Sedán', suv: 'SUV', pickup: 'Pickup', van: 'Van',
  truck: 'Camión', motorcycle: 'Moto', bus: 'Bus', other: 'Otro',
}
const fuelLabel: Record<string, string> = {
  gasoline: 'Gasolina', diesel: 'Diésel', electric: 'Eléctrico',
  hybrid: 'Híbrido', gas: 'Gas',
}

export default function EnvConfig() {
  const toast = useToast()
  const [configs, setConfigs] = useState<EnvironmentalConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)

  const [form, setForm] = useState({
    vehicle_type: 'sedan', fuel_type: 'gasoline',
    co2_per_km: 0.21, water_saved_per_wash: 150, standard_km: 10,
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getEnvConfigs()
      setConfigs(res.data)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createEnvConfig({
        ...form,
        co2_per_km: Number(form.co2_per_km),
        water_saved_per_wash: Number(form.water_saved_per_wash),
        standard_km: Number(form.standard_km),
      })
      toast('success', 'Configuración creada')
      setCreateOpen(false)
      setForm({ vehicle_type: 'sedan', fuel_type: 'gasoline', co2_per_km: 0.21, water_saved_per_wash: 150, standard_km: 10 })
      load()
    } catch (err: unknown) {
      toast('error', apiError(err, 'Error al crear configuración'))
    }
  }

  const totalWater = configs.reduce((s, c) => s + c.water_saved_per_wash, 0)
  const avgCO2 = configs.length ? configs.reduce((s, c) => s + c.co2_per_km, 0) / configs.length : 0

  return (
    <div>
      <Header title="Indicadores Ambientales" subtitle="Configuración de parámetros de huella hídrica y CO₂" />
      <div className="p-6 space-y-6">

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Configuraciones activas', value: configs.filter(c => c.is_active).length, color: 'text-emerald-700 bg-emerald-50' },
            { label: 'Agua ahorrada promedio / lavado', value: `${(totalWater / (configs.length || 1)).toFixed(0)} L`, color: 'text-cyan-700 bg-cyan-50' },
            { label: 'CO₂ promedio / km', value: `${avgCO2.toFixed(3)} kg`, color: 'text-teal-700 bg-teal-50' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl px-5 py-4 ${s.color}`}>
              <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{s.label}</p>
              <p className="text-2xl font-bold mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {configs.length} configuración{configs.length !== 1 ? 'es' : ''} registrada{configs.length !== 1 ? 's' : ''}
          </p>
          <Button icon={<Plus size={15} />} onClick={() => setCreateOpen(true)}>Nueva configuración</Button>
        </div>

        {loading ? <Spinner /> : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Tipo vehículo', 'Combustible', 'CO₂ / km (kg)', 'Agua ahorrada (L)', 'Km estándar', 'Estado'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {configs.length === 0
                    ? <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">Sin configuraciones</td></tr>
                    : configs.map(c => (
                      <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Leaf size={14} className="text-emerald-500" />
                            <span className="font-medium text-slate-700">{vehicleTypeLabel[c.vehicle_type] || c.vehicle_type}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="info" size="sm">{fuelLabel[c.fuel_type] || c.fuel_type}</Badge>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-700">{Number(c.co2_per_km).toFixed(4)}</td>
                        <td className="px-4 py-3 text-cyan-700 font-semibold">{Number(c.water_saved_per_wash).toFixed(0)} L</td>
                        <td className="px-4 py-3 text-slate-500">{Number(c.standard_km).toFixed(0)} km</td>
                        <td className="px-4 py-3">
                          <Badge variant={c.is_active ? 'success' : 'default'} size="sm">
                            {c.is_active ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Info card */}
        <Card>
          <CardHeader><span className="section-title text-sm">¿Cómo funcionan estos parámetros?</span></CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-600">
              <div className="space-y-1">
                <p className="font-semibold text-slate-700">CO₂ / km</p>
                <p className="text-xs leading-relaxed">Gramos de CO₂ emitidos por km recorrido según tipo de vehículo y combustible. Se multiplica por los km estándar para calcular el impacto evitado al lavar en el punto en vez de en otro lugar.</p>
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-slate-700">Agua ahorrada</p>
                <p className="text-xs leading-relaxed">Litros de agua que se ahorran por lavado respecto a un lavado convencional con manguera (~180 L). Se acumula mensualmente en el dashboard.</p>
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-slate-700">Km estándar</p>
                <p className="text-xs leading-relaxed">Distancia base asumida como la que recorrería el vehículo para llegar a otro punto de lavado. Por defecto 10 km.</p>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nueva Configuración Ambiental" size="md">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tipo de vehículo</label>
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
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">CO₂ / km (kg)</label>
              <input className="input" type="number" min={0} step={0.0001} required value={form.co2_per_km}
                onChange={e => setForm(f => ({ ...f, co2_per_km: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="label">Agua ahorrada (L)</label>
              <input className="input" type="number" min={0} step={1} required value={form.water_saved_per_wash}
                onChange={e => setForm(f => ({ ...f, water_saved_per_wash: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="label">Km estándar</label>
              <input className="input" type="number" min={1} step={1} required value={form.standard_km}
                onChange={e => setForm(f => ({ ...f, standard_km: Number(e.target.value) }))} />
            </div>
          </div>
          <p className="text-xs text-slate-400">
            CO₂ evitado por servicio = CO₂/km × km estándar. Ejemplo: {(Number(form.co2_per_km) * Number(form.standard_km)).toFixed(3)} kg CO₂ por lavado.
          </p>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" type="button" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button type="submit">Guardar configuración</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
