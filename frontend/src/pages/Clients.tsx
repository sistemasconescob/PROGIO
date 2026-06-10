import { useEffect, useState, useCallback } from 'react'
import { Plus, Search, Building2, User } from 'lucide-react'
import Header from '../components/Layout/Header'
import { Badge } from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Spinner from '../components/ui/Spinner'
import { getClients, createClient } from '../api/misc'
import { apiError } from '../api/errorMessage'
import { useToast } from '../hooks/useToast'
import type { Client, DocumentType } from '../types'

const docTypeLabel: Record<string, string> = { cc: 'C.C.', nit: 'NIT', ce: 'C.E.', passport: 'Pasaporte' }

export default function Clients() {
  const toast = useToast()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [isCompany, setIsCompany] = useState(true)

  const [form, setForm] = useState({
    full_name: '',
    document_type: 'nit' as DocumentType,
    document_number: '',
    email: '',
    phone: '',
    address: '',
    company_name: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getClients()
      setClients(res.data)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = clients.filter(c =>
    !search ||
    c.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (c.document_number && c.document_number.includes(search)) ||
    (c.company_name && c.company_name.toLowerCase().includes(search.toLowerCase()))
  )

  const resetForm = () => {
    setForm({ full_name: '', document_type: 'nit', document_number: '', email: '', phone: '', address: '', company_name: '' })
    setIsCompany(true)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload: Record<string, unknown> = {
      type: isCompany ? 'registered' : 'occasional',
      full_name: form.full_name,
      email: form.email || undefined,
      phone: form.phone || undefined,
      address: form.address || undefined,
      company_name: isCompany ? (form.company_name || undefined) : undefined,
      document_type: form.document_number ? form.document_type : undefined,
      document_number: form.document_number || undefined,
    }
    try {
      await createClient(payload)
      toast('success', 'Cliente creado')
      setCreateOpen(false)
      resetForm()
      load()
    } catch (err) {
      toast('error', apiError(err, 'Error al crear cliente'))
    }
  }

  return (
    <div>
      <Header title="Clientes" subtitle="Empresas y personas con contrato activo" />
      <div className="p-6 space-y-4">

        <div className="flex gap-3 items-center justify-between">
          <div className="relative max-w-xs flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Nombre, NIT o empresa..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Button icon={<Plus size={15} />} onClick={() => setCreateOpen(true)}>Nuevo cliente</Button>
        </div>

        {loading ? <Spinner /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.length === 0
              ? <p className="text-slate-400 text-sm col-span-3 py-12 text-center">No hay clientes</p>
              : filtered.map(c => (
                <div key={c.id} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="h-10 w-10 rounded-xl bg-progio-50 flex items-center justify-center flex-shrink-0">
                      {c.type === 'registered' ? <Building2 size={18} className="text-progio-700" /> : <User size={18} className="text-progio-700" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{c.full_name}</p>
                      {c.document_number && (
                        <p className="text-xs font-mono text-slate-400 mt-0.5">
                          {docTypeLabel[c.document_type ?? ''] ?? c.document_type}: {c.document_number}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1 text-xs text-slate-500">
                    {c.company_name && <p><span className="text-slate-400">Empresa:</span> {c.company_name}</p>}
                    {c.email && <p className="truncate"><span className="text-slate-400">Email:</span> {c.email}</p>}
                    {c.phone && <p><span className="text-slate-400">Tel:</span> {c.phone}</p>}
                  </div>
                  <div className="mt-3">
                    <Badge variant={c.type === 'registered' ? 'info' : 'default'} size="sm">
                      {c.type === 'registered' ? 'Registrado' : 'Ocasional'}
                    </Badge>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      <Modal open={createOpen} onClose={() => { setCreateOpen(false); resetForm() }} title="Nuevo Cliente" size="md">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="flex items-center gap-4 p-3 rounded-xl bg-slate-50">
            <span className="text-sm text-slate-600 font-medium">Tipo:</span>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="clientType" checked={isCompany} onChange={() => { setIsCompany(true); setForm(f => ({ ...f, document_type: 'nit' })) }} />
              <span className="text-sm">Empresa</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="clientType" checked={!isCompany} onChange={() => { setIsCompany(false); setForm(f => ({ ...f, document_type: 'cc' })) }} />
              <span className="text-sm">Persona natural</span>
            </label>
          </div>

          <div>
            <label className="label">{isCompany ? 'Nombre del contacto' : 'Nombre completo'}</label>
            <input className="input" required value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
          </div>

          {isCompany && (
            <div>
              <label className="label">Razón social</label>
              <input className="input" value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tipo documento</label>
              <select className="select" value={form.document_type} onChange={e => setForm(f => ({ ...f, document_type: e.target.value as DocumentType }))}>
                {Object.entries(docTypeLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="label">N° documento</label>
              <input className="input font-mono" value={form.document_number} onChange={e => setForm(f => ({ ...f, document_number: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Teléfono</label>
              <input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="label">Dirección</label>
            <input className="input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" type="button" onClick={() => { setCreateOpen(false); resetForm() }}>Cancelar</Button>
            <Button type="submit">Crear cliente</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
