import clsx from 'clsx'

interface CardProps { children: React.ReactNode; className?: string; onClick?: () => void }

export function Card({ children, className, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        'rounded-xl border border-slate-100 bg-white shadow-card',
        onClick && 'cursor-pointer hover:shadow-card-hover transition-shadow',
        className
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx('flex items-center justify-between px-5 py-4 border-b border-slate-50', className)}>{children}</div>
}

export function CardBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx('px-5 py-4', className)}>{children}</div>
}

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  color?: string
  sub?: string
  trend?: string
}

export function StatCard({ title, value, icon, color = 'bg-progio-50 text-progio-700', sub, trend }: StatCardProps) {
  return (
    <Card>
      <div className="flex items-start justify-between p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
          <p className="mt-2 text-3xl font-bold text-slate-800">{value}</p>
          {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
          {trend && <p className="mt-1 text-xs font-medium text-emerald-600">{trend}</p>}
        </div>
        <div className={clsx('rounded-xl p-3', color)}>{icon}</div>
      </div>
    </Card>
  )
}
