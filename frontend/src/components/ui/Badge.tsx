import clsx from 'clsx'
import type { ServiceStatus } from '../../types'

const statusConfig: Record<ServiceStatus, { label: string; className: string }> = {
  pending:     { label: 'Pendiente',   className: 'bg-amber-50 text-amber-700 border-amber-200' },
  in_process:  { label: 'En proceso',  className: 'bg-blue-50 text-blue-700 border-blue-200' },
  on_hold:     { label: 'En espera',   className: 'bg-orange-50 text-orange-700 border-orange-200' },
  finished:    { label: 'Finalizado',  className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cancelled:   { label: 'Cancelado',   className: 'bg-slate-50 text-slate-600 border-slate-200' },
  reprocessed: { label: 'Reprocesado', className: 'bg-purple-50 text-purple-700 border-purple-200' },
  blocked:     { label: 'Bloqueado',   className: 'bg-red-50 text-red-700 border-red-200' },
}

export function StatusBadge({ status }: { status: ServiceStatus }) {
  const cfg = statusConfig[status] ?? { label: status, className: 'bg-slate-50 text-slate-600 border-slate-200' }
  return (
    <span className={clsx('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold', cfg.className)}>
      {cfg.label}
    </span>
  )
}

const contractStatusConfig: Record<string, { label: string; className: string }> = {
  active:    { label: 'Activo',     className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  suspended: { label: 'Suspendido', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  expired:   { label: 'Expirado',   className: 'bg-slate-50 text-slate-600 border-slate-200' },
  blocked:   { label: 'Bloqueado',  className: 'bg-red-50 text-red-700 border-red-200' },
}

export function ContractStatusBadge({ status }: { status: string }) {
  const cfg = contractStatusConfig[status] ?? { label: status, className: 'bg-slate-50 text-slate-600 border-slate-200' }
  return (
    <span className={clsx('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold', cfg.className)}>
      {cfg.label}
    </span>
  )
}

const variantConfig: Record<string, string> = {
  default: 'bg-slate-50 text-slate-600 border-slate-200',
  info:    'bg-blue-50 text-blue-700 border-blue-200',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  danger:  'bg-red-50 text-red-700 border-red-200',
}

const sizeConfig: Record<string, string> = {
  sm: 'px-2 py-0 text-xs',
  md: 'px-2.5 py-0.5 text-xs',
}

interface BadgeProps {
  children: React.ReactNode
  className?: string
  variant?: 'default' | 'info' | 'success' | 'warning' | 'danger'
  size?: 'sm' | 'md'
}

export function Badge({ children, className, variant = 'default', size = 'md' }: BadgeProps) {
  return (
    <span className={clsx('inline-flex items-center rounded-full border font-semibold', variantConfig[variant], sizeConfig[size], className)}>
      {children}
    </span>
  )
}
