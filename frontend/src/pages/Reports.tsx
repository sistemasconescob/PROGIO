import { useState } from 'react'
import { Download, FileSpreadsheet, FileText, Droplets, DollarSign, ClipboardList } from 'lucide-react'
import Header from '../components/Layout/Header'
import { Card, CardHeader, CardBody } from '../components/ui/Card'
import Button from '../components/ui/Button'
import { downloadReport } from '../api/misc'
import { useToast } from '../hooks/useToast'

interface ReportDef {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  color: string
  formats: ('csv' | 'pdf')[]
}

const reports: ReportDef[] = [
  {
    id: 'services',
    title: 'Servicios',
    description: 'Historial completo de servicios con estado, tiempos y cumplimiento',
    icon: <ClipboardList size={22} />,
    color: 'bg-blue-50 text-blue-700',
    formats: ['csv', 'pdf'],
  },
  {
    id: 'environmental',
    title: 'Indicadores Ambientales',
    description: 'Agua ahorrada y CO₂ evitado por tipo de vehículo y combustible',
    icon: <Droplets size={22} />,
    color: 'bg-cyan-50 text-cyan-700',
    formats: ['csv', 'pdf'],
  },
  {
    id: 'economic',
    title: 'Indicadores Económicos',
    description: 'Costo por servicio, margen operacional y costos fijos',
    icon: <DollarSign size={22} />,
    color: 'bg-emerald-50 text-emerald-700',
    formats: ['csv', 'pdf'],
  },
  {
    id: 'pre_billing',
    title: 'Pre-Facturación',
    description: 'Listado de servicios listos para facturar por contrato',
    icon: <FileSpreadsheet size={22} />,
    color: 'bg-violet-50 text-violet-700',
    formats: ['csv', 'pdf'],
  },
]

export default function Reports() {
  const toast = useToast()
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d.toISOString().slice(0, 10)
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const download = async (report: ReportDef, format: 'csv' | 'pdf') => {
    const key = `${report.id}-${format}`
    setLoadingId(key)
    try {
      const res = await downloadReport(report.id, format, { date_from: dateFrom, date_to: dateTo })
      const ext = format === 'csv' ? 'csv' : 'pdf'
      const mime = format === 'csv' ? 'text/csv;charset=utf-8;' : 'application/pdf'
      const url = window.URL.createObjectURL(new Blob([res.data], { type: mime }))
      const a = document.createElement('a')
      a.href = url
      a.download = `progio_${report.id}_${dateFrom}_${dateTo}.${ext}`
      a.click()
      window.URL.revokeObjectURL(url)
      toast('success', 'Reporte descargado')
    } catch {
      toast('error', 'Error al generar el reporte')
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div>
      <Header title="Reportes" subtitle="Exportación de datos en Excel y PDF" />
      <div className="p-6 space-y-6">

        {/* Date filter */}
        <Card>
          <CardHeader><span className="section-title">Rango de fechas</span></CardHeader>
          <CardBody>
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div>
                <label className="label">Desde</label>
                <input className="input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              </div>
              <div>
                <label className="label">Hasta</label>
                <input className="input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </div>
              <p className="text-xs text-slate-400 pb-2">El rango aplica a todos los reportes</p>
            </div>
          </CardBody>
        </Card>

        {/* Report cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reports.map(r => (
            <div key={r.id} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <div className="flex items-start gap-4 mb-4">
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${r.color}`}>
                  {r.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">{r.title}</h3>
                  <p className="text-sm text-slate-500 mt-0.5">{r.description}</p>
                </div>
              </div>
              <div className="flex gap-2">
                {r.formats.includes('csv') && (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<FileSpreadsheet size={14} />}
                    loading={loadingId === `${r.id}-csv`}
                    onClick={() => download(r, 'csv')}
                  >
                    CSV
                  </Button>
                )}
                {r.formats.includes('pdf') && (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<FileText size={14} />}
                    loading={loadingId === `${r.id}-pdf`}
                    onClick={() => download(r, 'pdf')}
                  >
                    PDF
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Tip */}
        <div className="flex items-start gap-3 rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
          <Download size={15} className="text-slate-400 mt-0.5" />
          <p className="text-xs text-slate-500 leading-relaxed">
            Los archivos Excel incluyen múltiples hojas con datos detallados y tablas de resumen.
            Los PDF están diseñados para impresión y presentación a clientes.
          </p>
        </div>
      </div>
    </div>
  )
}
