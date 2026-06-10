import { api } from './client'
import type { Client, Vehicle, User, Supply, AuditLog, Role, PreFactura, EnvironmentalConfig } from '../types'

// Clients
export const getClients = (q?: string) => api.get<Client[]>('/clients', { params: { q } })
export const createClient = (data: Record<string, unknown>) => api.post<Client>('/clients', data)
export const updateClient = (id: string, data: Record<string, unknown>) => api.put<Client>(`/clients/${id}`, data)

// Vehicles
export const getVehicles = (params?: Record<string, unknown>) => api.get<Vehicle[]>('/vehicles', { params })
export const createVehicle = (data: Record<string, unknown>) => api.post<Vehicle>('/vehicles', data)
export const updateVehicle = (id: string, data: Record<string, unknown>) => api.put<Vehicle>(`/vehicles/${id}`, data)

// Users
export const getUsers = () => api.get<User[]>('/users')
export const createUser = (data: Record<string, unknown>) => api.post<User>('/users', data)
export const deactivateUser = (id: string) => api.patch(`/users/${id}/deactivate`)
export const activateUser = (id: string) => api.patch(`/users/${id}/activate`)
export const assignContractRole = (data: { user_id: string; contract_id: string; role_id: string }) =>
  api.post('/users/contract-roles/assign', data)
export const revokeContractRole = (data: { user_id: string; contract_id: string }) =>
  api.post('/users/contract-roles/revoke', data)

// Supplies
export const getSupplies = () => api.get<Supply[]>('/supplies')
export const createSupply = (data: Record<string, unknown>) => api.post<Supply>('/supplies', data)
export const updateSupply = (id: string, data: Record<string, unknown>) => api.put<Supply>(`/supplies/${id}`, data)
export const registerSupplyUsage = (data: { service_id: string; supply_id: string; quantity: number }) =>
  api.post('/supplies/usage', data)

// Roles
export const getRoles = () => api.get<Role[]>('/roles')
export const getPermissions = () => api.get('/roles/permissions')

// Audit
export const getAuditLogs = (params?: Record<string, unknown>) => api.get<AuditLog[]>('/audit', { params })

// Pre-billing
export const getPreFacturas = (params?: Record<string, unknown>) => api.get<PreFactura[]>('/prefacturas', { params })
export const getPreFactura = (id: string) => api.get<PreFactura>(`/prefacturas/${id}`)
export const createPreFactura = (data: Record<string, unknown>) => api.post<PreFactura>('/prefacturas', data)
export const approvePreFactura = (id: string, notes?: string) =>
  api.post<PreFactura>(`/prefacturas/${id}/approve`, { notes })
export const cancelPreFactura = (id: string, reason?: string) =>
  api.post<PreFactura>(`/prefacturas/${id}/cancel`, { reason })

// Environmental Config
export const getEnvConfigs = () => api.get<EnvironmentalConfig[]>('/environmental-config')
export const createEnvConfig = (data: Record<string, unknown>) =>
  api.post<EnvironmentalConfig>('/environmental-config', data)

// Sedes (within contracts)
export const createSede = (contractId: string, data: Record<string, unknown>) =>
  api.post(`/contracts/${contractId}/sedes`, data)

// Reports
export const getReportEnvironmental = (params?: Record<string, unknown>) =>
  api.get('/reports/environmental', { params })
export const downloadReport = (type: string, format: string, params?: Record<string, unknown>) =>
  api.get(`/reports/${type}`, { params: { ...params, format }, responseType: 'blob' })
