import { useEffect, useState, useCallback } from 'react'
import { Plus, Search, Shield, UserCheck, UserX } from 'lucide-react'
import Header from '../components/Layout/Header'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Spinner from '../components/ui/Spinner'
import { getUsers, createUser, getRoles, deactivateUser, activateUser, assignContractRole, revokeContractRole } from '../api/misc'
import { getContracts } from '../api/contracts'
import { apiError } from '../api/errorMessage'
import { useToast } from '../hooks/useToast'
import type { User, Role, Contract } from '../types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const avatarColors = ['bg-progio-600', 'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-orange-500']

export default function Users() {
  const toast = useToast()
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  const [form, setForm] = useState({ username: '', email: '', password: '', full_name: '' })
  const [assignForm, setAssignForm] = useState({ user_id: '', contract_id: '', role_id: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [uRes, rRes, cRes] = await Promise.all([getUsers(), getRoles(), getContracts()])
      setUsers(uRes.data)
      setRoles(rRes.data)
      setContracts(cRes.data)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = users.filter(u =>
    !search ||
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.full_name && u.full_name.toLowerCase().includes(search.toLowerCase()))
  )

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createUser(form)
      toast('success', 'Usuario creado')
      setCreateOpen(false)
      setForm({ username: '', email: '', password: '', full_name: '' })
      load()
    } catch (err: unknown) {
      toast('error', apiError(err, 'Error al crear usuario'))
    }
  }

  const handleToggleActive = async (u: User) => {
    try {
      if (u.is_active) {
        await deactivateUser(u.id)
        toast('success', 'Usuario desactivado')
      } else {
        await activateUser(u.id)
        toast('success', 'Usuario activado')
      }
      load()
    } catch (err: unknown) {
      toast('error', apiError(err, 'Error'))
    }
  }

  const openAssign = (u: User) => {
    setSelectedUser(u)
    setAssignForm({ user_id: u.id, contract_id: '', role_id: '' })
    setAssignOpen(true)
  }

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await assignContractRole(assignForm)
      toast('success', 'Rol asignado correctamente')
      setAssignOpen(false)
      setSelectedUser(null)
    } catch (err: unknown) {
      toast('error', apiError(err, 'Error al asignar rol'))
    }
  }

  const handleRevoke = async () => {
    if (!assignForm.user_id || !assignForm.contract_id) return
    try {
      await revokeContractRole({ user_id: assignForm.user_id, contract_id: assignForm.contract_id })
      toast('success', 'Rol revocado')
      setAssignOpen(false)
      setSelectedUser(null)
    } catch (err: unknown) {
      toast('error', apiError(err, 'Error al revocar rol'))
    }
  }

  return (
    <div>
      <Header title="Usuarios" subtitle="Gestión de usuarios y accesos del sistema" />
      <div className="p-6 space-y-4">

        <div className="flex gap-3 items-center justify-between">
          <div className="relative max-w-xs flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Usuario, nombre o correo..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Button icon={<Plus size={15} />} onClick={() => setCreateOpen(true)}>Nuevo usuario</Button>
        </div>

        {loading ? <Spinner /> : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Usuario', 'Email', 'Estado', 'Seguridad', 'Creado', 'Acciones'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0
                    ? <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">No hay usuarios</td></tr>
                    : filtered.map((u, idx) => (
                      <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${avatarColors[idx % avatarColors.length]}`}>
                              {u.username.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-slate-700">{u.username}</p>
                              {u.full_name && <p className="text-xs text-slate-400">{u.full_name}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{u.email}</td>
                        <td className="px-4 py-3">
                          <Badge variant={u.is_active ? 'success' : 'default'} size="sm">
                            {u.is_active ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {u.locked_until
                            ? <span className="text-xs text-red-500 font-medium flex items-center gap-1"><Shield size={11} /> Bloqueado</span>
                            : u.failed_attempts && u.failed_attempts > 0
                              ? <span className="text-xs text-amber-500">{u.failed_attempts} intentos fallidos</span>
                              : <span className="text-xs text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs">
                          {format(new Date(u.created_at), 'dd/MM/yyyy', { locale: es })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button onClick={() => openAssign(u)}
                              className="text-xs text-progio-700 hover:underline font-medium flex items-center gap-1">
                              <Shield size={11} /> Rol
                            </button>
                            <span className="text-slate-200">|</span>
                            <button onClick={() => handleToggleActive(u)}
                              className={`text-xs font-medium flex items-center gap-1 ${u.is_active ? 'text-red-500 hover:underline' : 'text-emerald-600 hover:underline'}`}>
                              {u.is_active ? <><UserX size={11} /> Desactivar</> : <><UserCheck size={11} /> Activar</>}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Roles overview */}
        {roles.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Roles del sistema</p>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              {roles.map(r => (
                <div key={r.id} className="rounded-xl border border-slate-100 bg-white p-3 text-center shadow-sm">
                  <div className="h-8 w-8 rounded-full bg-progio-50 flex items-center justify-center mx-auto mb-2">
                    <Shield size={14} className="text-progio-600" />
                  </div>
                  <p className="text-xs font-semibold text-slate-700 capitalize">{r.name.replace(/_/g, ' ')}</p>
                  {r.description && <p className="text-xs text-slate-400 mt-0.5 leading-tight line-clamp-2">{r.description}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create user */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nuevo Usuario" size="md">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Usuario</label>
              <input className="input" required value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
            </div>
            <div>
              <label className="label">Nombre completo</label>
              <input className="input" required value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label className="label">Contraseña temporal</label>
            <input className="input" type="password" required minLength={8} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            <p className="text-xs text-slate-400 mt-1">Mínimo 8 caracteres</p>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" type="button" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button type="submit">Crear usuario</Button>
          </div>
        </form>
      </Modal>

      {/* Assign role */}
      {selectedUser && (
        <Modal open={assignOpen} onClose={() => setAssignOpen(false)} title={`Asignar rol — ${selectedUser.username}`} size="sm">
          <form onSubmit={handleAssign} className="space-y-4">
            <div>
              <label className="label">Contrato</label>
              <select className="select" required value={assignForm.contract_id}
                onChange={e => setAssignForm(f => ({ ...f, contract_id: e.target.value }))}>
                <option value="">Seleccionar contrato...</option>
                {contracts.filter(c => c.status === 'active').map(c => (
                  <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Rol</label>
              <select className="select" required value={assignForm.role_id}
                onChange={e => setAssignForm(f => ({ ...f, role_id: e.target.value }))}>
                <option value="">Seleccionar rol...</option>
                {roles.map(r => (
                  <option key={r.id} value={r.id}>{r.name.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 justify-between pt-2">
              <Button variant="danger" type="button"
                onClick={handleRevoke}
                disabled={!assignForm.contract_id}>
                Revocar rol
              </Button>
              <div className="flex gap-2">
                <Button variant="secondary" type="button" onClick={() => setAssignOpen(false)}>Cancelar</Button>
                <Button type="submit">Asignar</Button>
              </div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
