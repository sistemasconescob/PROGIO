import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { apiError } from '../api/errorMessage'
import { useToast } from '../hooks/useToast'
import { Droplets, Eye, EyeOff, Loader2 } from 'lucide-react'

export default function Login() {
  const { login } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password) return
    setLoading(true)
    try {
      await login(username, password)
      nav('/', { replace: true })
    } catch (err: unknown) {
      toast('error', apiError(err, 'Credenciales incorrectas'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex w-1/2 flex-col items-center justify-center bg-progio-800 p-12 relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="absolute rounded-full border border-white"
              style={{ width: `${(i + 1) * 120}px`, height: `${(i + 1) * 120}px`, top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
          ))}
        </div>
        <div className="relative z-10 text-center">
          <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/15 shadow-xl backdrop-blur-sm">
            <Droplets className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">PROGIO</h1>
          <p className="text-progio-200 text-lg font-light mb-2">Procesos de Gestión Integrado Online</p>
          <p className="text-progio-300 text-sm max-w-sm mx-auto leading-relaxed">
            Sistema de control operativo para servicios de lavado de vehículos con trazabilidad completa
          </p>
          <div className="mt-10 grid grid-cols-3 gap-6 text-center">
            {[
              { value: 'Multi-sede', label: 'Operación' },
              { value: 'RBAC', label: 'Seguridad' },
              { value: 'Eco', label: 'Indicadores' },
            ].map(item => (
              <div key={item.label} className="rounded-xl bg-white/10 px-4 py-3">
                <p className="text-white font-bold text-sm">{item.value}</p>
                <p className="text-progio-300 text-xs mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex flex-1 items-center justify-center bg-slate-50 p-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <Droplets className="w-6 h-6 text-progio-800" />
            <span className="text-xl font-bold text-progio-800">PROGIO</span>
          </div>

          <h2 className="text-2xl font-bold text-slate-800 mb-1">Bienvenido</h2>
          <p className="text-slate-500 text-sm mb-8">Ingresa tus credenciales para acceder</p>

          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="label">Correo electrónico</label>
              <input
                className="input"
                type="email"
                placeholder="usuario@empresa.com"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoFocus
                autoComplete="email"
              />
            </div>
            <div>
              <label className="label">Contraseña</label>
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showPwd ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  onClick={() => setShowPwd(v => !v)}
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading || !username || !password}
              className="flex w-full items-center justify-center gap-2 h-10 rounded-lg bg-progio-800 text-sm font-semibold text-white hover:bg-progio-700 transition-colors disabled:opacity-50 shadow-sm"
            >
              {loading ? <><Loader2 className="animate-spin w-4 h-4" /> Ingresando...</> : 'Iniciar sesión'}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-400">
            PROGIO v1.0 © {new Date().getFullYear()} — Todos los derechos reservados
          </p>
        </div>
      </div>
    </div>
  )
}
