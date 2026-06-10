import { api } from './client'
import type { Service } from '../types'

export const getServices = (params?: Record<string, unknown>) =>
  api.get<Service[]>('/services', { params })

export const getService = (id: string) => api.get<Service>(`/services/${id}`)

export const createService = (data: Record<string, unknown>) =>
  api.post<Service>('/services', data)

export const startService = (id: string, operator_id: string) =>
  api.post<Service>(`/services/${id}/start`, { operator_id })

export const pauseService = (id: string, reason?: string) =>
  api.post<Service>(`/services/${id}/pause`, { reason })

export const resumeService = (id: string) =>
  api.post<Service>(`/services/${id}/resume`)

export const assignOperator = (id: string, operator_id: string) =>
  api.post<Service>(`/services/${id}/assign-operator`, { operator_id })

export const superviseService = (id: string, notes?: string) =>
  api.post<Service>(`/services/${id}/supervise`, { notes })

export const completeCompliance = (id: string, notes?: string) =>
  api.post<Service>(`/services/${id}/complete-compliance`, { notes })

export const finishService = (id: string, notes?: string) =>
  api.post<Service>(`/services/${id}/finish`, { notes })

export const cancelService = (id: string, reason: string) =>
  api.post<Service>(`/services/${id}/cancel`, { reason })
