import { api } from './client'
import type { Contract } from '../types'

export const getContracts = () => api.get<Contract[]>('/contracts')
export const getContract = (id: string) => api.get<Contract>(`/contracts/${id}`)
export const createContract = (data: Record<string, unknown>) => api.post<Contract>('/contracts', data)
export const updateContract = (id: string, data: Record<string, unknown>) => api.put<Contract>(`/contracts/${id}`, data)
