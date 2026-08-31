import { api } from './client'
import type { Contract, ContractContact } from '../types'

export const getContracts = () => api.get<Contract[]>('/contracts')
export const getContract = (id: string) => api.get<Contract>(`/contracts/${id}`)
export const createContract = (data: Record<string, unknown>) => api.post<Contract>('/contracts', data)
export const updateContract = (id: string, data: Record<string, unknown>) => api.put<Contract>(`/contracts/${id}`, data)
export const addContact = (contractId: string, data: Record<string, unknown>) =>
  api.post<ContractContact>(`/contracts/${contractId}/contacts`, data)
export const deleteContact = (contactId: string) =>
  api.delete(`/contracts/contacts/${contactId}`)
