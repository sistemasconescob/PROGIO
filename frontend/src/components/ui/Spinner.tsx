import { Loader2 } from 'lucide-react'

export default function Spinner({ text = 'Cargando...' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
      <Loader2 className="animate-spin w-8 h-8 mb-3 text-progio-600" />
      <p className="text-sm">{text}</p>
    </div>
  )
}

export function PageSpinner() {
  return (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="animate-spin w-10 h-10 text-progio-600" />
    </div>
  )
}
