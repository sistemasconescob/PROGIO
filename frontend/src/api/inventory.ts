import { api } from './client'
import type { InventoryPeriod, ServiceCostWeight } from '../types'

export const getPeriods = (params?: Record<string, unknown>) =>
  api.get<InventoryPeriod[]>('/inventory/periods', { params })

export const getPeriod = (id: string) =>
  api.get<InventoryPeriod>(`/inventory/periods/${id}`)

export const createPeriod = (data: Record<string, unknown>) =>
  api.post<InventoryPeriod>('/inventory/periods', data)

export const updatePeriodItem = (periodId: string, itemId: string, data: Record<string, unknown>) =>
  api.patch<unknown>(`/inventory/periods/${periodId}/items/${itemId}`, data)

export const addPeriodItem = (periodId: string, supplyId: string, initialStock = 0) =>
  api.post<unknown>(`/inventory/periods/${periodId}/items`, null, {
    params: { supply_id: supplyId, initial_stock: initialStock },
  })

export const startReconciliation = (id: string) =>
  api.post<InventoryPeriod>(`/inventory/periods/${id}/reconcile`)

export const closePeriod = (id: string) =>
  api.post<InventoryPeriod>(`/inventory/periods/${id}/close`)

export const getCostWeights = (activeOnly = true) =>
  api.get<ServiceCostWeight[]>('/inventory/cost-weights', { params: { active_only: activeOnly } })

export const createCostWeight = (data: Record<string, unknown>) =>
  api.post<ServiceCostWeight>('/inventory/cost-weights', data)

export const deactivateCostWeight = (id: string) =>
  api.delete(`/inventory/cost-weights/${id}`)
