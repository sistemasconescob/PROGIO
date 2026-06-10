import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, CheckCircle2, Clock, Ban, Droplets, Wind, ArrowRight, Activity } from 'lucide-react'
import Header from '../components/Layout/Header'
import { StatCard, Card, CardHeader, CardBody } from '../components/ui/Card'
import { StatusBadge } from '../components/ui/Badge'
import Spinner from '../components/ui/Spinner'
import { getServices } from '../api/services'
import { getReportEnvironmental } from '../api/misc'
import type { Service } from '../types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const serviceTypeLabel: Record<string, string> = {
  basic_wash: 'Básico', full_wash: 'Completo', premium_wash: 'Premium',
  engine_wash: 'Motor', interior_detail: 'Interior', full_detail: 'Detallado',
}

const statusColors: Record<string, string> = {
  pending: '#F59E0B', in_process: '#3B82F6', on_hold: '#F97316',
  finished: '#10B981', cancelled: '#94A3B8', blocked: '#EF4444', reprocessed: '#8B5CF6',
}

export default function Dashboard() {
  const [services, setServices] = useState<Service[]>([])
  const [envData, setEnvData] = useState<{ total_water_saved_liters?: number; total_co2_avoided_kg?: number }>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const today = new Date()
    const from = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()
    Promise.all([
      getServices({ limit: 200 }),
      getReportEnvironmental({ date_from: from }),
    ]).then(([svcRes, envRes]) => {
      setServices(svcRes.data)
      setEnvData(envRes.data)
    }).finally(() => setLoading(false))
  }, [])

  const stats = {
    today: services.filter(s => new Date(s.created_at).toDateString() === new Date().toDateString()).length,
    active: services.filter(s => s.status === 'in_process').length,
    finished: services.filter(s => s.status === 'finished').length,
    blocked: services.filter(s => s.status === 'blocked').length,
  }

  const byStatus = Object.entries(
    services.reduce((acc, s) => { acc[s.status] = (acc[s.status] || 0) + 1; return acc }, {} as Record<string, number>)
  ).map(([name, count]) => ({ name, count }))

  const recent = [...services].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 8)

  if (loading) return <div className="p-6"><Spinner /></div>

  return (
    <div>
      <Header title="Dashboard" subtitle="Resumen general de operaciones" />
      <div className="p-6 space-y-6">

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Servicios hoy" value={stats.today} icon={<ClipboardList size={22} />}
            color="bg-progio-50 text-progio-700" sub="Creados hoy" />
          <StatCard title="En proceso" value={stats.active} icon={<Activity size={22} />}
            color="bg-blue-50 text-blue-700" sub="Activos ahora" />
          <StatCard title="Finalizados" value={stats.finished} icon={<CheckCircle2 size={22} />}
            color="bg-emerald-50 text-emerald-700" sub="Este mes" />
          <StatCard title="Bloqueados" value={stats.blocked} icon={<Ban size={22} />}
            color="bg-red-50 text-red-700" sub="Por límite contractual" />
        </div>

        {/* Environmental */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <StatCard title="Agua ahorrada" value={`${(envData.total_water_saved_liters || 0).toLocaleString('es-CO')} L`}
            icon={<Droplets size={22} />} color="bg-cyan-50 text-cyan-700"
            sub="Este mes · Servicios sin agua" trend="↑ Impacto ambiental positivo" />
          <StatCard title="CO₂ evitado" value={`${(envData.total_co2_avoided_kg || 0).toFixed(1)} kg`}
            icon={<Wind size={22} />} color="bg-teal-50 text-teal-700"
            sub="vs. recorrido estándar 10 km" trend="↑ Huella de carbono reducida" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Chart */}
          <Card className="lg:col-span-1">
            <CardHeader><span className="section-title">Por estado</span></CardHeader>
            <CardBody>
              {byStatus.length === 0
                ? <p className="text-sm text-slate-400 text-center py-6">Sin datos</p>
                : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={byStatus} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} tickFormatter={k => k.split('_')[0]} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v, n) => [v, n]} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {byStatus.map(entry => (
                          <Cell key={entry.name} fill={statusColors[entry.name] || '#94A3B8'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
            </CardBody>
          </Card>

          {/* Recent services */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <span className="section-title">Servicios recientes</span>
              <Link to="/services" className="flex items-center gap-1 text-xs text-progio-700 hover:underline font-medium">
                Ver todos <ArrowRight size={12} />
              </Link>
            </CardHeader>
            <div className="overflow-x-auto">
              {recent.length === 0
                ? <p className="text-sm text-slate-400 text-center py-8">No hay servicios registrados</p>
                : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-50">
                        {['Código', 'Tipo', 'Estado', 'Fecha'].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map(s => (
                        <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs font-medium text-slate-700">{s.code}</td>
                          <td className="px-4 py-3 text-slate-600">{serviceTypeLabel[s.service_type] || s.service_type}</td>
                          <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                          <td className="px-4 py-3 text-slate-400 text-xs">
                            {format(new Date(s.created_at), 'dd MMM HH:mm', { locale: es })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
