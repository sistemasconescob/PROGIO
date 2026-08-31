import { useEffect, useState, useCallback } from 'react'
import { Plus, Search, FileText, AlertCircle, CheckCircle2, Trash2, User } from 'lucide-react'
import Header from '../components/Layout/Header'
import { Badge } from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Spinner from '../components/ui/Spinner'
import {
  getConsultants, createConsultant, updateConsultant,
  addConsultantDocument, deleteConsultantDocument,
} from '../api/consulting'
import { apiError } from '../api/errorMessage'
import { useToast } from '../hooks/useToast'
import type { Consultant, ConsultantDocument } from '../types'
import { format, isPast, addDays } from 'date-fns'
import { es } from 'date-fns/locale'

const DOC_TYPE_LABELS: Record<string, string> = {
  cv: 'Hoja de Vida',
  certification: 'Certificación',
  professional_card: 'Tarjeta Profesional',
  mandatory_course: 'Curso Obligatorio',
  medical_exam: 'Examen Médico',
  vaccine: 'Vacuna',
  arl: 'ARL / Seguridad Social',
  legal_doc: 'Documento Legal (RUT/Facturación)',
}

function docStatus(doc: ConsultantDocument): 'expired' | 'expiring' | 'ok' | 'none' {
  if (!doc.expires_at) return 'none'
  const exp = new Date(doc.expires_at)
  if (isPast(exp)) return 'expired'
  if (isPast(addDays(exp, -30))) return 'expiring'
  return 'ok'
}

const statusBadge = { expired: 'error', expiring: 'warning', ok: 'success', none: 'default' } as const
const statusLabel = { expired: 'Vencido', expiring: 'Por vencer', ok: 'Vigente', none: 'Sin vencimiento' }

export default function Consultants() {
  const toast = useToast()
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [detail, setDetail] = useState<Consultant | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [docOpen, setDocOpen] = useState(false)

  const [form, setForm] = useState({ full_name: '', document_type: '', document_number: '', email: '', phone: '', specialty: '', notes: '' })
  const [docForm, setDocForm] = useState({ doc_type: 'cv', name: '', file_url: '', issued_at: '', expires_at: '', is_critical: false, notes: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getConsultants({ active_only: false })
      setConsultants(res.data)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = consultants.filter(c =>
    !search ||
    c.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (c.specialty ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (c.document_number ?? '').includes(search)
  )

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createConsultant({
        ...form,
        document_type: form.document_type || undefined,
        document_number: form.document_number || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        specialty: form.specialty || undefined,
        notes: form.notes || undefined,
      })
      toast('success', 'Consultor registrado')
      setCreateOpen(false)
      setForm({ full_name: '', document_type: '', document_number: '', email: '', phone: '', specialty: '', notes: '' })
      load()
    } catch (err) { toast('error', apiError(err, 'Error al registrar')) }
  }

  const handleAddDoc = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!detail) return
    try {
      await addConsultantDocument(detail.id, {
        ...docForm,
        file_url: docForm.file_url || undefined,
        issued_at: docForm.issued_at || undefined,
        expires_at: docForm.expires_at || undefined,
        notes: docForm.notes || undefined,
      })
      toast('success', 'Documento agregado')
      setDocOpen(false)
      setDocForm({ doc_type: 'cv', name: '', file_url: '', issued_at: '', expires_at: '', is_critical: false, notes: '' })
      const refreshed = (await getConsultants({ active_only: false })).data
      setConsultants(refreshed)
      const updated = refreshed.find(c => c.id === detail.id)
      if (updated) setDetail(updated)
    } catch (err) { toast('error', apiError(err, 'Error al agregar documento')) }
  }

  const handleDeleteDoc = async (doc: ConsultantDocument) => {
    if (!confirm(`¿Eliminar documento "${doc.name}"?`)) return
    try {
      await deleteConsultantDocument(doc.id)
      toast('success', 'Documento eliminado')
      const refreshed = (await getConsultants({ active_only: false })).data
      setConsultants(refreshed)
      const updated = refreshed.find(c => c.id === detail?.id)
      if (updated) setDetail(updated)
    } catch (err) { toast('error', apiError(err, 'Error')) }
  }

  const handleToggleActive = async (c: Consultant) => {
    try {
      await updateConsultant(c.id, { is_active: !c.is_active })
      toast('success', c.is_active ? 'Consultor desactivado' : 'Consultor activado')
      load()
    } catch (err) { toast('error', apiError(err)) }
  }

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <div>
      <Header title="Consultores" subtitle="Dossier HSE y gestión de documentos (Sección 7)" />
      <div className="p-6 space-y-4">
        <div className="flex gap-3 items-center justify-between">
          <div className="relative max-w-xs flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Buscar por nombre, especialidad..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Button icon={<Plus size={15} />} onClick={() => setCreateOpen(true)}>Nuevo consultor</Button>
        </div>

        {loading ? <Spinner /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.length === 0
              ? <p className="text-slate-400 text-sm col-span-3 text-center py-12">No hay consultores</p>
              : filtered.map(c => {
                const expired = c.documents.filter(d => docStatus(d) === 'expired')
                const expiring = c.documents.filter(d => docStatus(d) === 'expiring')
                return (
                  <button key={c.id} onClick={() => setDetail(c)}
                    className="text-left rounded-2xl border border-slate-100 bg-white p-5 shadow-sm hover:shadow-md hover:border-progio-200 transition-all group">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-progio-100 text-progio-700 font-bold">
                          {c.full_name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800 group-hover:text-progio-700">{c.full_name}</p>
                          <p className="text-xs text-slate-400">{c.specialty ?? 'Sin especialidad'}</p>
                        </div>
                      </div>
                      <Badge variant={c.is_active ? 'success' : 'default'} size="sm">{c.is_active ? 'Activo' : 'Inactivo'}</Badge>
                    </div>
                    <div className="text-xs text-slate-400 space-y-1 mb-3">
                      {c.document_number && <p>{c.document_type?.toUpperCase()} {c.document_number}</p>}
                      {c.email && <p>{c.email}</p>}
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="default" size="sm">{c.documents.length} doc{c.documents.length !== 1 ? 's' : ''}</Badge>
                      {expired.length > 0 && <Badge variant="error" size="sm"><AlertCircle size={10} className="inline mr-1" />{expired.length} vencido{expired.length > 1 ? 's' : ''}</Badge>}
                      {expiring.length > 0 && <Badge variant="warning" size="sm">{expiring.length} por vencer</Badge>}
                    </div>
                  </button>
                )
              })}
          </div>
        )}
      </div>

      {/* ── Create Modal ── */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Registrar Consultor" size="md">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Nombre completo <span className="text-red-400">*</span></label>
            <input className="input" required value={form.full_name} onChange={f('full_name')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tipo documento</label>
              <select className="select" value={form.document_type} onChange={f('document_type')}>
                <option value="">Seleccionar...</option>
                <option value="cc">CC</option>
                <option value="ce">CE</option>
                <option value="passport">Pasaporte</option>
                <option value="nit">NIT</option>
              </select>
            </div>
            <div>
              <label className="label">Número documento</label>
              <input className="input" value={form.document_number} onChange={f('document_number')} />
            </div>
            <div>
              <label className="label">Especialidad</label>
              <input className="input" placeholder="Ej. Ingeniero de Yacimientos" value={form.specialty} onChange={f('specialty')} />
            </div>
            <div>
              <label className="label">Teléfono</label>
              <input className="input" value={form.phone} onChange={f('phone')} />
            </div>
            <div className="col-span-2">
              <label className="label">Email</label>
              <input className="input" type="email" value={form.email} onChange={f('email')} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" type="button" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button type="submit">Registrar</Button>
          </div>
        </form>
      </Modal>

      {/* ── Detail Modal ── */}
      {detail && (
        <Modal open={!!detail} onClose={() => setDetail(null)} title={detail.full_name} size="lg">
          <div className="space-y-5">
            <div className="flex gap-2 flex-wrap">
              <Badge variant={detail.is_active ? 'success' : 'default'}>{detail.is_active ? 'Activo' : 'Inactivo'}</Badge>
              {detail.specialty && <Badge variant="info">{detail.specialty}</Badge>}
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {detail.document_number && <div><p className="text-xs text-slate-400 uppercase font-semibold">Documento</p><p className="mt-1">{detail.document_type?.toUpperCase()} {detail.document_number}</p></div>}
              {detail.email && <div><p className="text-xs text-slate-400 uppercase font-semibold">Email</p><p className="mt-1">{detail.email}</p></div>}
              {detail.phone && <div><p className="text-xs text-slate-400 uppercase font-semibold">Teléfono</p><p className="mt-1">{detail.phone}</p></div>}
            </div>

            {/* Dossier HSE */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="label">Dossier HSE ({detail.documents.length} documentos)</p>
                <button onClick={() => setDocOpen(true)} className="flex items-center gap-1 text-xs text-progio-700 hover:underline font-medium">
                  <Plus size={12} /> Agregar documento
                </button>
              </div>
              {detail.documents.length === 0
                ? <p className="text-xs text-slate-400 text-center py-3">Sin documentos en el dossier</p>
                : (
                  <div className="space-y-2">
                    {detail.documents.map(doc => {
                      const s = docStatus(doc)
                      return (
                        <div key={doc.id} className="rounded-lg bg-slate-50 px-3 py-2.5 flex items-start justify-between">
                          <div className="flex items-start gap-2">
                            <FileText size={13} className="text-slate-400 mt-0.5 flex-shrink-0" />
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-slate-700">{doc.name}</p>
                                {doc.is_critical && <span className="text-xs text-red-400 font-semibold">CRÍTICO</span>}
                              </div>
                              <p className="text-xs text-slate-400 mt-0.5">{DOC_TYPE_LABELS[doc.doc_type] ?? doc.doc_type}</p>
                              <div className="flex gap-3 mt-1">
                                {doc.issued_at && <span className="text-xs text-slate-400">Emitido: {format(new Date(doc.issued_at), 'dd/MM/yyyy')}</span>}
                                {doc.expires_at && (
                                  <span className={`text-xs font-medium ${s === 'expired' ? 'text-red-500' : s === 'expiring' ? 'text-amber-500' : 'text-slate-400'}`}>
                                    Vence: {format(new Date(doc.expires_at), 'dd/MM/yyyy', { locale: es })}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge variant={statusBadge[s]} size="sm">{statusLabel[s]}</Badge>
                            <button onClick={() => handleDeleteDoc(doc)} className="text-slate-300 hover:text-red-400 transition-colors">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <Button variant="secondary" onClick={() => handleToggleActive(detail)}>
                {detail.is_active ? 'Desactivar' : 'Activar'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Add Document Modal ── */}
      <Modal open={docOpen} onClose={() => setDocOpen(false)} title="Agregar Documento al Dossier" size="sm">
        <form onSubmit={handleAddDoc} className="space-y-4">
          <div>
            <label className="label">Tipo de documento <span className="text-red-400">*</span></label>
            <select className="select" value={docForm.doc_type} onChange={e => setDocForm(p => ({ ...p, doc_type: e.target.value }))}>
              {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Nombre / Descripción <span className="text-red-400">*</span></label>
            <input className="input" required value={docForm.name} onChange={e => setDocForm(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Fecha emisión</label>
              <input className="input" type="date" value={docForm.issued_at} onChange={e => setDocForm(p => ({ ...p, issued_at: e.target.value }))} />
            </div>
            <div>
              <label className="label">Fecha vencimiento</label>
              <input className="input" type="date" value={docForm.expires_at} onChange={e => setDocForm(p => ({ ...p, expires_at: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">URL del archivo</label>
            <input className="input" placeholder="https://..." value={docForm.file_url} onChange={e => setDocForm(p => ({ ...p, file_url: e.target.value }))} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="critical" checked={docForm.is_critical} onChange={e => setDocForm(p => ({ ...p, is_critical: e.target.checked }))} />
            <label htmlFor="critical" className="text-sm text-slate-600">Documento crítico (bloquea asignaciones si vence)</label>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" type="button" onClick={() => setDocOpen(false)}>Cancelar</Button>
            <Button type="submit">Agregar</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
