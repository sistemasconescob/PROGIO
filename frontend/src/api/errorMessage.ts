type ApiError = { response?: { data?: { detail?: unknown } } }

export function apiError(err: unknown, fallback = 'Error inesperado'): string {
  const detail = (err as ApiError)?.response?.data?.detail
  if (!detail) return fallback
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail.map((e: { msg?: string; loc?: string[] }) =>
      `${e.loc?.slice(-1)[0] ?? 'campo'}: ${e.msg ?? ''}`
    ).join(' · ')
  }
  return fallback
}
