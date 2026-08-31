import { useEffect, useState, useCallback } from 'react'
import { Plus, Search, ChevronRight, FileCheck, AlertCircle, Clock, CheckCircle2, XCircle, PlayCircle } from 'lucide-react'
import Header from '../components/Layout/Header'
import { Badge } from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Spinner from '../components/ui/Spinner'
import {
  getAssignments, createAssignment, getAssignment,
  submitAssignment, validateInternalAssignment, sendToClient,
  pendingClientAssignment, approveAssignment, startOperation,
  requestClosure, finalizeAssignment, suspendAssignment,
  reactivateAssignment, cancelAssignment,
  createClosureReport, getClosureReportByAssignment,
  updateClosureReport, validateInternalReport, validateClientReport,
  addAttachment, deleteAttachment,
} from '../api/consulting'
import { getConsultants } from '../api/consulting'
import { getContracts } from '../api/contracts'
import { apiError } from '../api/errorMessage'
import { useToast } from '../hooks/useToast'
import type { Assignment, Consultant, Contract, ClosureReport } from '../types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const STATUS_CONFIG: Record<string, { label: string; color: 'default' | 'info' | 'warning' | 'success' | 'error' }> = {
  draft: { label: 'Borrador', color: 'default' },
  pending_docs: { label: 'Pend. documentos', color: 'warning' },
  internal_validation: { label: 'Validación interna', color: 'info' },
  sent_to_client: { label: 'Enviada a cliente', color: 'info' },
  pending_client: { label: 'Pend. cliente', color: 'warning' },
  approved: { label: 'Aprobada', color: 'success' },
  in_operation: { label: 'En operación', color: 'success' },
  pending_closure: { label: 'Pend. cierre', color: 'warning' },
  finalized: { label: 'Finalizada', color: 'success' },
  suspended: { label: 'Suspendida', color: 'warning' },
  cancelled: { label: 'Cancelada', color: 'error' },
}

const NEXT_ACTIONS: Record<string, Array<{ label: string; fn: (id: string, notes?: string) => Promise<unknown>; variant?: 'primary' | 'secondary' | 'danger' }>> = {
  draft: [{ label: 'Enviar a revisión de docs', fn: submitAssignment }],
  pending_docs: [{ label: 'Iniciar validación interna', fn: validateInternalAssignment }],
  internal_validation: [{ label: 'Enviar al cliente', fn: sendToClient }],
  sent_to_client: [{ label: 'Pendiente aprobación cliente', fn: pendingClientAssignment }],
  pending_client: [{ label: 'Aprobar', fn: approveAssignment }],
  approved: [{ label: 'Iniciar operación', fn: startOperation }],
  in_operation: [
    { label: 'Solicitar cierre', fn: requestClosure },
    { label: 'Suspender', fn: suspendAssignment, variant: 'secondary' },
  ],
  pending_closure: [{ label: 'Finalizar', fn: finalizeAssignment }],
  suspended: [
    { label: 'Reactivar', fn: reactivateAssignment },
    { label: 'Cancelar', fn: cancelAssignment, variant: 'danger' },
  ],
}

export default function Assignments() {
  const toast = useToast()
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [detail, setDetail] = useState<Assignment | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [closureReport, setClosureReport] = useState<ClosureReport | null>(null)
  const [closureOpen, setClosureOpen] = useState(false)
  const [createClosureOpen, setCreateClosureOpen] = useState(false)
  const [actionNotes, setActionNotes] = useState('')

  const [form, setForm] = useState({
    code: '', contract_id: '', consultant_id: '',
    position: '', location: '', client_reference: '', notes: '',
  })

  const [closureForm, setClosureForm] = useState({ narrative: '', notes: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [aRes, cRes, ctRes] = await Promise.all([
        getAssignments(),
        getConsultants({ active_only: false }),
        getContracts(),
      ])
      setAssignments(aRes.data)
      setConsultants(cRes.data)
      setContracts(ctRes.data)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = assignments.filter(a => {
    const matchSearch = !search || a.code.toLowerCase().includes(search.toLowerCase()) ||
      (a.location ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = !filterStatus || a.status === filterStatus
    return matchSearch && matchStatus
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createAssignment({
        ...form,
        position: form.position || undefined,
        location: form.location || undefined,
        client_reference: form.client_reference || undefined,
        notes: form.notes || undefined,
      })
      toast('success', 'Asignación creada')
      setCreateOpen(false)
      setForm({ code: '', contract_id: '', consultant_id: '', position: '', location: '', client_reference: '', notes: '' })
      load()
    } catch (err) { toast('error', apiError(err, 'Error al crear asignación')) }
  }

  const handleAction = async (fn: (id: string, notes?: string) => Promise<unknown>) => {
    if (!detail) return
    try {
      const res = await fn(detail.id, actionNotes || undefined)
      toast('success', 'Estado actualizado')
      setActionNotes('')
      const updated = (res as { data: Assignment }).data
      setDetail(updated)
      setAssignments(prev => prev.map(a => a.id === updated.id ? updated : a))
    } catch (err) { toast('error', apiError(err, 'Error al cambiar estado')) }
  }

  const handleOpenDetail = async (a: Assignment) => {
    setDetail(a)
    setClosureReport(null)
    if (a.closure_report) {
      try {
        const res = await getClosureReportByAssignment(a.id)
        setClosureReport(res.data)
      } catch { /* no report yet */ }
    }
  }

  const handleCreateClosure = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!detail) return
    try {
      const res = await createClosureReport({
        assignment_id: detail.id,
        narrative: closureForm.narrative || undefined,
        notes: closureForm.notes || undefined,
      })
      setClosureReport(res.data)
      toast('success', 'Reporte de cierre creado')
      setCreateClosureOpen(false)
      const refreshed = await getAssignment(detail.id)
      setDetail(refreshed.data)
    } catch (err) { toast('error', apiError(err, 'Error al crear reporte')) }
  }

  const handleValidateInternal = async (approve: boolean) => {
    if (!closureReport) return
    try {
      const res = await validateInternalReport(closureReport.id, approve)
      setClosureReport(res.data)
      toast('success', approve ? 'Validado internamente' : 'Reporte rechazado internamente')
    } catch (err) { toast('error', apiError(err)) }
  }

  const handleValidateClient = async (approve: boolean, name?: string) => {
    if (!closureReport) return
    try {
      const res = await validateClientReport(closureReport.id, approve, undefined, name)
      setClosureReport(res.data)
      toast('success', approve ? 'Validado por el cliente' : 'Rechazado por el cliente')
    } catch (err) { toast('error', apiError(err)) }
  }

  const contractName = (id: string) => contracts.find(c => c.id === id)?.name ?? '—'
  const consultantName = (id: string) => consultants.find(c => c.id === id)?.full_name ?? '—'

  return (
    <div>
      <Header title="Asignaciones / Llamados" subtitle="Gestión del ciclo de vida de asignaciones de consultoría (Secciones 6–12)" />
      <div className="p-6 space-y-4">
        <div className="flex gap-3 items-center justify-between">
          <div className="flex gap-2 flex-1">
            <div className="relative max-w-xs flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="input pl-9" placeholder="Código, ubicación..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="select max-w-[180px]" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">Todos los estados</option>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <Button icon={<Plus size={15} />} onClick={() => setCreateOpen(true)}>Nueva asignación</Button>
        </div>

        {loading ? <Spinner /> : (
          <div className="space-y-2">
            {filtered.length === 0
              ? <p className="text-slate-400 text-sm text-center py-12">No hay asignaciones</p>
              : filtered.map(a => {
                const cfg = STATUS_CONFIG[a.status] ?? { label: a.status, color: 'default' }
                return (
                  <button key={a.id} onClick={() => handleOpenDetail(a)}
                    className="w-full text-left rounded-xl border border-slate-100 bg-white p-4 shadow-sm hover:shadow-md hover:border-progio-200 transition-all group flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-slate-800 font-mono text-sm">{a.code}</p>
                          <Badge variant={cfg.color} size="sm">{cfg.label}</Badge>
                          {a.closure_report && <FileCheck size={13} className="text-progio-500" />}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {consultantName(a.consultant_id)} · {contractName(a.contract_id)}
                          {a.location && ` · ${a.location}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span>{format(new Date(a.opened_at), 'dd MMM yyyy', { locale: es })}</span>
                      <ChevronRight size={14} className="text-slate-300 group-hover:text-progio-400 transition-colors" />
                    </div>
                  </button>
                )
              })}
          </div>
        )}
      </div>

      {/* ── Create Modal ── */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nueva Asignación / Llamado" size="md">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Código <span className="text-red-400">*</span></label>
              <input className="input font-mono" required value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} placeholder="ASIG-2026-001" />
            </div>
            <div>
              <label className="label">Contrato <span className="text-red-400">*</span></label>
              <select className="select" required value={form.contract_id} onChange={e => setForm(p => ({ ...p, contract_id: e.target.value }))}>
                <option value="">Seleccionar...</option>
                {contracts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Consultor <span className="text-red-400">*</span></label>
              <select className="select" required value={form.consultant_id} onChange={e => setForm(p => ({ ...p, consultant_id: e.target.value }))}>
                <option value="">Seleccionar...</option>
                {consultants.filter(c => c.is_active).map(c => <option key={c.id} value={c.id}>{c.full_name}{c.specialty ? ` — ${c.specialty}` : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Cargo / Rol</label>
              <input className="input" value={form.position} onChange={e => setForm(p => ({ ...p, position: e.target.value }))} />
            </div>
            <div>
              <label className="label">Ubicación (campo/pozo)</label>
              <input className="input" value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="label">Referencia del cliente</label>
              <input className="input" value={form.client_reference} onChange={e => setForm(p => ({ ...p, client_reference: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="label">Notas</label>
              <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" type="button" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button type="submit">Crear asignación</Button>
          </div>
        </form>
      </Modal>

      {/* ── Detail Modal ── */}
      {detail && (
        <Modal open={!!detail} onClose={() => setDetail(null)} title={`Asignación ${detail.code}`} size="lg">
          <div className="space-y-5">
            <div className="flex gap-2 flex-wrap">
              <Badge variant={STATUS_CONFIG[detail.status]?.color ?? 'default'}>{STATUS_CONFIG[detail.status]?.label ?? detail.status}</Badge>
            </div>

            {/* Basic info */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-xs text-slate-400 uppercase font-semibold">Consultor</p><p className="mt-1 font-medium">{consultantName(detail.consultant_id)}</p></div>
              <div><p className="text-xs text-slate-400 uppercase font-semibold">Contrato</p><p className="mt-1">{contractName(detail.contract_id)}</p></div>
              {detail.position && <div><p className="text-xs text-slate-400 uppercase font-semibold">Cargo / Rol</p><p className="mt-1">{detail.position}</p></div>}
              {detail.location && <div><p className="text-xs text-slate-400 uppercase font-semibold">Ubicación</p><p className="mt-1">{detail.location}</p></div>}
              {detail.client_reference && <div className="col-span-2"><p className="text-xs text-slate-400 uppercase font-semibold">Referencia cliente</p><p className="mt-1">{detail.client_reference}</p></div>}
              {detail.notes && <div className="col-span-2"><p className="text-xs text-slate-400 uppercase font-semibold">Notas</p><p className="mt-1 text-slate-600">{detail.notes}</p></div>}
            </div>

            {/* Timeline */}
            <div>
              <p className="label mb-2">Historial de eventos ({detail.events.length})</p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {detail.events.length === 0
                  ? <p className="text-xs text-slate-400 text-center py-2">Sin eventos</p>
                  : [...detail.events].reverse().map(ev => (
                    <div key={ev.id} className="flex gap-2 text-xs">
                      <span className="text-slate-300 flex-shrink-0 pt-0.5">{format(new Date(ev.created_at), 'dd/MM HH:mm')}</span>
                      <div>
                        <span className="font-medium text-slate-600 capitalize">{ev.event_type.replace(/_/g, ' ')}</span>
                        {ev.description && <span className="text-slate-400 ml-1">— {ev.description}</span>}
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Reporte de cierre */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="label">Reporte de cierre</p>
                {detail.status === 'pending_closure' && !closureReport && (
                  <button onClick={() => setCreateClosureOpen(true)} className="flex items-center gap-1 text-xs text-progio-700 hover:underline font-medium">
                    <Plus size={12} /> Crear reporte
                  </button>
                )}
              </div>
              {!closureReport
                ? <p className="text-xs text-slate-400 text-center py-2">{detail.status === 'pending_closure' ? 'Crea el reporte de cierre para finalizar el llamado' : 'Sin reporte de cierre'}</p>
                : (
                  <div className="rounded-xl border border-slate-100 p-4 space-y-3">
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <p className="text-xs text-slate-400 uppercase font-semibold mb-1">Validación interna</p>
                        <div className="flex items-center gap-2">
                          {closureReport.internal_status === 'approved' && <CheckCircle2 size={14} className="text-emerald-500" />}
                          {closureReport.internal_status === 'rejected' && <XCircle size={14} className="text-red-400" />}
                          {closureReport.internal_status === 'pending' && <Clock size={14} className="text-amber-400" />}
                          <Badge variant={closureReport.internal_status === 'approved' ? 'success' : closureReport.internal_status === 'rejected' ? 'error' : 'warning'} size="sm">
                            {closureReport.internal_status === 'pending' ? 'Pendiente' : closureReport.internal_status === 'approved' ? 'Aprobado' : 'Rechazado'}
                          </Badge>
                          {closureReport.internal_status === 'pending' && (
                            <div className="flex gap-1 ml-2">
                              <button onClick={() => handleValidateInternal(true)} className="text-xs text-emerald-600 hover:underline font-medium">Aprobar</button>
                              <span className="text-slate-300">/</span>
                              <button onClick={() => handleValidateInternal(false)} className="text-xs text-red-400 hover:underline font-medium">Rechazar</button>
                            </div>
                          )}
                        </div>
                        {closureReport.internal_notes && <p className="text-xs text-slate-400 mt-1">{closureReport.internal_notes}</p>}
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-slate-400 uppercase font-semibold mb-1">Validación cliente</p>
                        <div className="flex items-center gap-2">
                          {closureReport.client_status === 'approved' && <CheckCircle2 size={14} className="text-emerald-500" />}
                          {closureReport.client_status === 'rejected' && <XCircle size={14} className="text-red-400" />}
                          {closureReport.client_status === 'pending' && <Clock size={14} className="text-amber-400" />}
                          <Badge variant={closureReport.client_status === 'approved' ? 'success' : closureReport.client_status === 'rejected' ? 'error' : 'warning'} size="sm">
                            {closureReport.client_status === 'pending' ? 'Pendiente' : closureReport.client_status === 'approved' ? 'Aprobado' : 'Rechazado'}
                          </Badge>
                          {closureReport.internal_status === 'approved' && closureReport.client_status === 'pending' && (
                            <div className="flex gap-1 ml-2">
                              <button onClick={() => handleValidateClient(true)} className="text-xs text-emerald-600 hover:underline font-medium">Aprobar</button>
                              <span className="text-slate-300">/</span>
                              <button onClick={() => handleValidateClient(false)} className="text-xs text-red-400 hover:underline font-medium">Rechazar</button>
                            </div>
                          )}
                        </div>
                        {closureReport.client_validator_name && <p className="text-xs text-slate-400 mt-1">Por: {closureReport.client_validator_name}</p>}
                      </div>
                    </div>
                    {closureReport.narrative && (
                      <div>
                        <p className="text-xs text-slate-400 uppercase font-semibold mb-1">Narrativa</p>
                        <p className="text-sm text-slate-600">{closureReport.narrative}</p>
                      </div>
                    )}
                    <p className="text-xs text-slate-300">Plantilla v{closureReport.template_version} · Adjuntos: {closureReport.attachments.length}</p>
                  </div>
                )}
            </div>

            {/* Action buttons */}
            {NEXT_ACTIONS[detail.status] && NEXT_ACTIONS[detail.status].length > 0 && (
              <div className="border-t border-slate-100 pt-3 space-y-2">
                <p className="label">Siguiente paso</p>
                <textarea className="input resize-none text-xs" rows={2} placeholder="Notas opcionales para el evento..." value={actionNotes} onChange={e => setActionNotes(e.target.value)} />
                <div className="flex gap-2">
                  {NEXT_ACTIONS[detail.status].map(action => (
                    <Button
                      key={action.label}
                      variant={action.variant === 'danger' ? 'danger' : action.variant ?? 'primary'}
                      onClick={() => handleAction(action.fn as (id: string, notes?: string) => Promise<unknown>)}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ── Create Closure Report Modal ── */}
      <Modal open={createClosureOpen} onClose={() => setCreateClosureOpen(false)} title="Crear Reporte de Cierre" size="md">
        <form onSubmit={handleCreateClosure} className="space-y-4">
          <div>
            <label className="label">Narrativa del cierre</label>
            <textarea className="input resize-none" rows={5} placeholder="Descripción del trabajo realizado, resultados, observaciones..." value={closureForm.narrative} onChange={e => setClosureForm(p => ({ ...p, narrative: e.target.value }))} />
          </div>
          <div>
            <label className="label">Notas internas</label>
            <textarea className="input resize-none" rows={2} value={closureForm.notes} onChange={e => setClosureForm(p => ({ ...p, notes: e.target.value }))} />
          </div>
          <p className="text-xs text-slate-400">El reporte requiere validación interna (Ingecoper) y del cliente antes de poder finalizar la asignación.</p>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" type="button" onClick={() => setCreateClosureOpen(false)}>Cancelar</Button>
            <Button type="submit">Crear reporte</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
