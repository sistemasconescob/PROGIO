import { useEffect, useState, useCallback } from 'react'
import { Plus, Search, ChevronRight, MapPin, UserRound, Phone, Mail, Briefcase, Trash2 } from 'lucide-react'
import Header from '../components/Layout/Header'
import { ContractStatusBadge, Badge } from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Spinner from '../components/ui/Spinner'
import { getContracts, createContract, addContact, deleteContact } from '../api/contracts'
import { createSede } from '../api/misc'
import { apiError } from '../api/errorMessage'
import { useToast } from '../hooks/useToast'
import type { Contract, ContractContact } from '../types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const typeLabel = { in_house: 'In-House', service_point: 'Punto de Servicio' }

type ContactDraft = { full_name: string; position: string; phone: string; email: string }
const emptyContact = (): ContactDraft => ({ full_name: '', position: '', phone: '', email: '' })

const emptyForm = () => ({
  name: '', code: '', type: 'in_house',
  nit: '', business_name: '', economic_group: '', client_company: '',
  start_date: '', end_date: '', description: '',
})

export default function Contracts() {
  const toast = useToast()
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [detail, setDetail] = useState<Contract | null>(null)
  const [sedeOpen, setSedeOpen] = useState(false)
  const [addContactOpen, setAddContactOpen] = useState(false)

  const [form, setForm] = useState(emptyForm)
  const [contacts, setContacts] = useState<ContactDraft[]>([])
  const [newContact, setNewContact] = useState<ContactDraft>(emptyContact())
  const [sedeForm, setSedeForm] = useState({ name: '', address: '', city: '' })
  const [contactForm, setContactForm] = useState<ContactDraft>(emptyContact())

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
    c.code.toLowerCase().includes(search.toLowerCase()) ||
    (c.nit || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.business_name || '').toLowerCase().includes(search.toLowerCase())
  )

  const addContactDraft = () => {
    if (!newContact.full_name.trim()) return
    setContacts(prev => [...prev, { ...newContact }])
    setNewContact(emptyContact())
  }

  const removeContactDraft = (i: number) => setContacts(prev => prev.filter((_, idx) => idx !== i))

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createContract({
        ...form,
        nit: form.nit || undefined,
        business_name: form.business_name || undefined,
        economic_group: form.economic_group || undefined,
        client_company: form.client_company || undefined,
        description: form.description || undefined,
        contacts: contacts.map(c => ({
          full_name: c.full_name,
          position: c.position || undefined,
          phone: c.phone || undefined,
          email: c.email || undefined,
        })),
      })
      toast('success', 'Contrato creado')
      setCreateOpen(false)
      setForm(emptyForm())
      setContacts([])
      setNewContact(emptyContact())
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

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!detail) return
    try {
      await addContact(detail.id, {
        full_name: contactForm.full_name,
        position: contactForm.position || undefined,
        phone: contactForm.phone || undefined,
        email: contactForm.email || undefined,
      })
      toast('success', 'Contacto agregado')
      setAddContactOpen(false)
      setContactForm(emptyContact())
      const res = await getContracts()
      setContracts(res.data)
      const updated = res.data.find(c => c.id === detail.id)
      if (updated) setDetail(updated)
    } catch (err: unknown) {
      toast('error', apiError(err, 'Error al agregar contacto'))
    }
  }

  const handleDeleteContact = async (contact: ContractContact) => {
    if (!detail) return
    try {
      await deleteContact(contact.id)
      toast('success', 'Contacto eliminado')
      const res = await getContracts()
      setContracts(res.data)
      const updated = res.data.find(c => c.id === detail.id)
      if (updated) setDetail(updated)
    } catch (err: unknown) {
      toast('error', apiError(err, 'Error al eliminar contacto'))
    }
  }

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  return (
    <div>
      <Header title="Contratos" subtitle="Control de contratos y clientes" />
      <div className="p-6 space-y-4">

        <div className="flex gap-3 items-center justify-between">
          <div className="relative max-w-xs flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Buscar por nombre, código, NIT..." value={search} onChange={e => setSearch(e.target.value)} />
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
                  {c.business_name && <p className="text-xs text-slate-600 font-medium mb-0.5">{c.business_name}</p>}
                  {c.nit && <p className="text-xs text-slate-400 mb-2">NIT: {c.nit}</p>}
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="info" size="sm">{typeLabel[c.type]}</Badge>
                    <span className="text-xs text-slate-400">{c.sedes.length} sede{c.sedes.length !== 1 ? 's' : ''}</span>
                    {c.contacts.length > 0 && <span className="text-xs text-slate-400">{c.contacts.length} contacto{c.contacts.length !== 1 ? 's' : ''}</span>}
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

      {/* ── Create modal ── */}
      <Modal open={createOpen} onClose={() => { setCreateOpen(false); setContacts([]); setNewContact(emptyContact()) }} title="Nuevo Contrato" size="lg">
        <form onSubmit={handleCreate} className="space-y-5">

          {/* Identificación */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Identificación</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Nombre del contrato <span className="text-red-400">*</span></label>
                <input className="input" required value={form.name} onChange={f('name')} />
              </div>
              <div>
                <label className="label">Código <span className="text-red-400">*</span></label>
                <input className="input font-mono" required value={form.code} onChange={f('code')} />
              </div>
              <div>
                <label className="label">Razón social</label>
                <input className="input" placeholder="Nombre legal de la empresa" value={form.business_name} onChange={f('business_name')} />
              </div>
              <div>
                <label className="label">NIT</label>
                <input className="input" placeholder="Ej. 900123456-7" value={form.nit} onChange={f('nit')} />
              </div>
              <div>
                <label className="label">Grupo económico</label>
                <input className="input" placeholder="Holding o grupo al que pertenece" value={form.economic_group} onChange={f('economic_group')} />
              </div>
              <div>
                <label className="label">Empresa / Cliente</label>
                <input className="input" value={form.client_company} onChange={f('client_company')} />
              </div>
            </div>
          </div>

          {/* Tipo y vigencia */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Tipo y vigencia</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Tipo <span className="text-red-400">*</span></label>
                <select className="select" value={form.type} onChange={f('type')}>
                  <option value="in_house">In-House</option>
                  <option value="service_point">Punto de Servicio</option>
                </select>
              </div>
              <div>
                <label className="label">Fecha inicio <span className="text-red-400">*</span></label>
                <input className="input" type="date" required value={form.start_date} onChange={f('start_date')} />
              </div>
              <div>
                <label className="label">Fecha fin <span className="text-red-400">*</span></label>
                <input className="input" type="date" required value={form.end_date} onChange={f('end_date')} />
              </div>
            </div>
          </div>

          {/* Personas de contacto */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Personas de contacto</p>

            {contacts.length > 0 && (
              <div className="space-y-2 mb-3">
                {contacts.map((c, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <div className="flex items-center gap-3">
                      <UserRound size={14} className="text-slate-400 flex-shrink-0" />
                      <div>
                        <span className="font-medium text-slate-700">{c.full_name}</span>
                        {c.position && <span className="text-slate-400 text-xs ml-2">— {c.position}</span>}
                        <div className="flex gap-3 mt-0.5">
                          {c.phone && <span className="text-xs text-slate-400">{c.phone}</span>}
                          {c.email && <span className="text-xs text-slate-400">{c.email}</span>}
                        </div>
                      </div>
                    </div>
                    <button type="button" onClick={() => removeContactDraft(i)} className="text-slate-300 hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-xl border border-dashed border-slate-200 p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input className="input" placeholder="Nombre completo *" value={newContact.full_name}
                  onChange={e => setNewContact(p => ({ ...p, full_name: e.target.value }))} />
                <input className="input" placeholder="Cargo / Rol" value={newContact.position}
                  onChange={e => setNewContact(p => ({ ...p, position: e.target.value }))} />
                <input className="input" placeholder="Teléfono" value={newContact.phone}
                  onChange={e => setNewContact(p => ({ ...p, phone: e.target.value }))} />
                <input className="input" placeholder="Email" value={newContact.email}
                  onChange={e => setNewContact(p => ({ ...p, email: e.target.value }))} />
              </div>
              <button type="button" onClick={addContactDraft}
                className="flex items-center gap-1.5 text-xs text-progio-600 hover:text-progio-800 font-medium transition-colors disabled:opacity-40"
                disabled={!newContact.full_name.trim()}>
                <Plus size={13} /> Agregar persona de contacto
              </button>
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className="label">Descripción / Observaciones</label>
            <textarea className="input resize-none" rows={2} value={form.description} onChange={f('description')} />
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <Button variant="secondary" type="button" onClick={() => { setCreateOpen(false); setContacts([]); setNewContact(emptyContact()) }}>Cancelar</Button>
            <Button type="submit">Crear contrato</Button>
          </div>
        </form>
      </Modal>

      {/* ── Detail modal ── */}
      {detail && (
        <Modal open={!!detail} onClose={() => setDetail(null)} title={detail.name} size="lg">
          <div className="space-y-5">
            <div className="flex gap-3 flex-wrap">
              <ContractStatusBadge status={detail.status} />
              <Badge variant="info">{typeLabel[detail.type]}</Badge>
            </div>

            {/* Datos de identificación */}
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
              {detail.business_name && (
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">Razón social</p>
                  <p className="mt-1 text-slate-700">{detail.business_name}</p>
                </div>
              )}
              {detail.nit && (
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">NIT</p>
                  <p className="mt-1 text-slate-700">{detail.nit}</p>
                </div>
              )}
              {detail.economic_group && (
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">Grupo económico</p>
                  <p className="mt-1 text-slate-700">{detail.economic_group}</p>
                </div>
              )}
              {detail.client_company && (
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">Empresa / Cliente</p>
                  <p className="mt-1 text-slate-700">{detail.client_company}</p>
                </div>
              )}
              {detail.description && (
                <div className="col-span-2">
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">Descripción</p>
                  <p className="mt-1 text-slate-600 text-sm">{detail.description}</p>
                </div>
              )}
            </div>

            {/* Personas de contacto */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="label">Contactos ({detail.contacts.length})</p>
                <button onClick={() => setAddContactOpen(true)}
                  className="flex items-center gap-1 text-xs text-progio-700 hover:underline font-medium">
                  <Plus size={12} /> Agregar contacto
                </button>
              </div>
              {detail.contacts.length === 0
                ? <p className="text-xs text-slate-400 py-2 text-center">Sin personas de contacto registradas</p>
                : (
                  <div className="space-y-2">
                    {detail.contacts.map(c => (
                      <div key={c.id} className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-2">
                            <UserRound size={14} className="text-slate-400 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="font-medium text-slate-700">{c.full_name}</p>
                              {c.position && (
                                <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                  <Briefcase size={10} /> {c.position}
                                </p>
                              )}
                              <div className="flex gap-4 mt-1">
                                {c.phone && (
                                  <span className="text-xs text-slate-400 flex items-center gap-1">
                                    <Phone size={10} /> {c.phone}
                                  </span>
                                )}
                                {c.email && (
                                  <span className="text-xs text-slate-400 flex items-center gap-1">
                                    <Mail size={10} /> {c.email}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <button onClick={() => handleDeleteContact(c)}
                            className="text-slate-300 hover:text-red-400 transition-colors ml-2 flex-shrink-0">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
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
                ? <p className="text-xs text-slate-400 py-2 text-center">Sin sedes registradas</p>
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

      {/* ── Add sede modal ── */}
      <Modal open={sedeOpen} onClose={() => setSedeOpen(false)} title="Agregar Sede" size="sm">
        <form onSubmit={handleAddSede} className="space-y-4">
          <div>
            <label className="label">Nombre de la sede <span className="text-red-400">*</span></label>
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

      {/* ── Add contact modal ── */}
      <Modal open={addContactOpen} onClose={() => { setAddContactOpen(false); setContactForm(emptyContact()) }} title="Agregar Persona de Contacto" size="sm">
        <form onSubmit={handleAddContact} className="space-y-4">
          <div>
            <label className="label">Nombre completo <span className="text-red-400">*</span></label>
            <input className="input" required value={contactForm.full_name}
              onChange={e => setContactForm(p => ({ ...p, full_name: e.target.value }))} />
          </div>
          <div>
            <label className="label">Cargo / Rol</label>
            <input className="input" placeholder="Ej. Gerente de flota, Coordinador logístico" value={contactForm.position}
              onChange={e => setContactForm(p => ({ ...p, position: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Teléfono</label>
              <input className="input" value={contactForm.phone}
                onChange={e => setContactForm(p => ({ ...p, phone: e.target.value }))} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={contactForm.email}
                onChange={e => setContactForm(p => ({ ...p, email: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" type="button" onClick={() => { setAddContactOpen(false); setContactForm(emptyContact()) }}>Cancelar</Button>
            <Button type="submit">Agregar</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
