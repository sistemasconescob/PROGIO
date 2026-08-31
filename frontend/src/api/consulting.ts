import { api } from './client'
import type { Consultant, ConsultantDocument, Assignment, ClosureReport, ClosureReportAttachment } from '../types'

// ── Consultants ──
export const getConsultants = (params?: Record<string, unknown>) =>
  api.get<Consultant[]>('/consulting/consultants', { params })

export const getConsultant = (id: string) =>
  api.get<Consultant>(`/consulting/consultants/${id}`)

export const createConsultant = (data: Record<string, unknown>) =>
  api.post<Consultant>('/consulting/consultants', data)

export const updateConsultant = (id: string, data: Record<string, unknown>) =>
  api.put<Consultant>(`/consulting/consultants/${id}`, data)

export const addConsultantDocument = (consultantId: string, data: Record<string, unknown>) =>
  api.post<ConsultantDocument>(`/consulting/consultants/${consultantId}/documents`, data)

export const deleteConsultantDocument = (docId: string) =>
  api.delete(`/consulting/consultants/documents/${docId}`)

// ── Assignments ──
export const getAssignments = (params?: Record<string, unknown>) =>
  api.get<Assignment[]>('/consulting/assignments', { params })

export const getAssignment = (id: string) =>
  api.get<Assignment>(`/consulting/assignments/${id}`)

export const createAssignment = (data: Record<string, unknown>) =>
  api.post<Assignment>('/consulting/assignments', data)

export const updateAssignment = (id: string, data: Record<string, unknown>) =>
  api.put<Assignment>(`/consulting/assignments/${id}`, data)

const transition = (action: string) => (id: string, notes?: string) =>
  api.post<Assignment>(`/consulting/assignments/${id}/${action}`, { notes })

export const submitAssignment = transition('submit')
export const validateInternalAssignment = transition('validate-internal')
export const sendToClient = transition('send-to-client')
export const pendingClientAssignment = transition('pending-client')
export const approveAssignment = transition('approve')
export const startOperation = transition('start-operation')
export const requestClosure = transition('request-closure')
export const finalizeAssignment = transition('finalize')
export const suspendAssignment = transition('suspend')
export const reactivateAssignment = transition('reactivate')
export const cancelAssignment = transition('cancel')

// ── Closure Reports ──
export const createClosureReport = (data: Record<string, unknown>) =>
  api.post<ClosureReport>('/consulting/closure-reports', data)

export const getClosureReport = (id: string) =>
  api.get<ClosureReport>(`/consulting/closure-reports/${id}`)

export const getClosureReportByAssignment = (assignmentId: string) =>
  api.get<ClosureReport>(`/consulting/assignments/${assignmentId}/closure-report`)

export const updateClosureReport = (id: string, data: Record<string, unknown>) =>
  api.put<ClosureReport>(`/consulting/closure-reports/${id}`, data)

export const validateInternalReport = (id: string, approve: boolean, notes?: string, validatorName?: string) =>
  api.post<ClosureReport>(`/consulting/closure-reports/${id}/validate-internal`, { notes, validator_name: validatorName }, { params: { approve } })

export const validateClientReport = (id: string, approve: boolean, notes?: string, validatorName?: string) =>
  api.post<ClosureReport>(`/consulting/closure-reports/${id}/validate-client`, { notes, validator_name: validatorName }, { params: { approve } })

export const addAttachment = (reportId: string, data: Record<string, unknown>) =>
  api.post<ClosureReportAttachment>(`/consulting/closure-reports/${reportId}/attachments`, data)

export const deleteAttachment = (attId: string) =>
  api.delete(`/consulting/closure-reports/attachments/${attId}`)
