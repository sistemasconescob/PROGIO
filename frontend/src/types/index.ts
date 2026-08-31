export type ServiceStatus = 'pending' | 'in_process' | 'on_hold' | 'finished' | 'cancelled' | 'reprocessed' | 'blocked'
export type ServiceType = 'basic_wash' | 'full_wash' | 'premium_wash' | 'engine_wash' | 'interior_detail' | 'full_detail'
export type ContractType = 'in_house' | 'service_point'
export type ContractStatus = 'active' | 'suspended' | 'expired' | 'blocked'
export type VehicleType = 'sedan' | 'suv' | 'pickup' | 'bus' | 'truck' | 'motorcycle' | 'van' | 'other'
export type FuelType = 'gasoline' | 'diesel' | 'electric' | 'hybrid' | 'gas'
export type PreFacturaStatus = 'draft' | 'approved' | 'sent' | 'paid' | 'cancelled'
export type ClientType = 'occasional' | 'registered'
export type DocumentType = 'cc' | 'nit' | 'ce' | 'passport'

export interface User {
  id: string
  email: string
  username: string
  full_name: string
  phone?: string
  is_active: boolean
  is_superuser?: boolean
  failed_attempts?: number
  locked_until?: string
  created_at: string
}

export interface ContractSede {
  id: string
  contract_id: string
  name: string
  address?: string
  city?: string
  is_active: boolean
}

export interface ContractContact {
  id: string
  contract_id: string
  full_name: string
  position?: string
  phone?: string
  email?: string
  created_at: string
}

export interface Contract {
  id: string
  code: string
  name: string
  type: ContractType
  nit?: string
  business_name?: string
  economic_group?: string
  client_company?: string
  status: ContractStatus
  start_date: string
  end_date: string
  description?: string
  sedes: ContractSede[]
  contacts: ContractContact[]
  created_at: string
}

export interface Client {
  id: string
  type: ClientType
  document_type?: DocumentType
  document_number?: string
  full_name: string
  email?: string
  phone?: string
  address?: string
  company_name?: string
  is_active: boolean
  created_at: string
}

export interface Vehicle {
  id: string
  plate: string
  brand: string
  model: string
  year?: number
  vehicle_type: VehicleType
  fuel_type: FuelType
  color?: string
  client_id?: string
  fleet_id?: string
  is_active: boolean
  created_at: string
}

export interface ServiceEvent {
  id: string
  event_type: string
  user_id: string
  description?: string
  event_metadata?: Record<string, unknown>
  created_at: string
}

export interface Service {
  id: string
  code: string
  contract_id: string
  sede_id: string
  vehicle_id: string
  service_type: ServiceType
  status: ServiceStatus
  operator_id?: string
  started_at?: string
  finished_at?: string
  compliance_format_completed: boolean
  block_reason?: string
  notes?: string
  created_by_id: string
  created_at: string
  events: ServiceEvent[]
}

export interface Supply {
  id: string
  name: string
  unit: string
  unit_cost: number
  category: string
  description?: string
  is_active: boolean
  created_at: string
}

export interface Role {
  id: string
  name: string
  description?: string
  is_system?: boolean
  created_at: string
}

export interface AuditLog {
  id: string
  user_id?: string
  action: string
  entity_type: string
  entity_id?: string
  before_state?: Record<string, unknown>
  after_state?: Record<string, unknown>
  ip_address?: string
  created_at: string
}

export interface PreFacturaItem {
  id: string
  service_id?: string
  description: string
  quantity: number
  unit_price: number
  subtotal: number
}

export interface PreFactura {
  id: string
  code: string
  contract_id: string
  status: PreFacturaStatus
  total_amount: number
  period_start: string
  period_end: string
  notes?: string
  created_by_id: string
  approved_by_id?: string
  approved_at?: string
  created_at: string
  items: PreFacturaItem[]
}

// ── Inventory module ──────────────────────────────────────────────

export interface InventoryPeriodItem {
  id: string
  period_id: string
  supply_id: string
  supply?: { id: string; name: string; unit: string }
  initial_stock: number
  entries: number
  adjustments: number
  final_stock_physical?: number
  theoretical_consumption: number
  difference?: number
  deviation_pct?: number
}

export interface InventoryPeriod {
  id: string
  contract_id: string
  sede_id?: string
  workstation?: string
  period_label: string
  period_start: string
  period_end: string
  period_type: string
  status: 'open' | 'reconciling' | 'closed'
  notes?: string
  created_by_id: string
  closed_by_id?: string
  created_at: string
  closed_at?: string
  items: InventoryPeriodItem[]
}

export interface ServiceCostWeight {
  id: string
  formula_version: string
  service_type: string
  weight: number
  is_active: boolean
  notes?: string
  created_at: string
}

// ── Consulting module ─────────────────────────────────────────────

export type AssignmentStatus =
  | 'draft' | 'pending_docs' | 'internal_validation' | 'sent_to_client'
  | 'pending_client' | 'approved' | 'in_operation' | 'pending_closure'
  | 'finalized' | 'suspended' | 'cancelled'

export interface ConsultantDocument {
  id: string
  consultant_id: string
  doc_type: string
  name: string
  file_url?: string
  issued_at?: string
  expires_at?: string
  is_critical: boolean
  notes?: string
  uploaded_by_id: string
  created_at: string
}

export interface Consultant {
  id: string
  full_name: string
  document_type?: string
  document_number?: string
  email?: string
  phone?: string
  specialty?: string
  is_active: boolean
  user_id?: string
  notes?: string
  created_at: string
  documents: ConsultantDocument[]
}

export interface AssignmentEvent {
  id: string
  assignment_id: string
  event_type: string
  user_id: string
  description?: string
  event_metadata?: Record<string, unknown>
  created_at: string
}

export interface ClosureReportBrief {
  id: string
  internal_status: 'pending' | 'approved' | 'rejected'
  client_status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

export interface Assignment {
  id: string
  code: string
  contract_id: string
  consultant_id: string
  position?: string
  location?: string
  client_reference?: string
  status: AssignmentStatus
  opened_at: string
  closed_at?: string
  notes?: string
  created_by_id: string
  created_at: string
  events: AssignmentEvent[]
  closure_report?: ClosureReportBrief
}

export interface ClosureReportAttachment {
  id: string
  report_id: string
  file_name: string
  file_url?: string
  attachment_type: string
  notes?: string
  uploaded_by_id: string
  created_at: string
}

export interface ClosureReport {
  id: string
  assignment_id: string
  internal_status: 'pending' | 'approved' | 'rejected'
  internal_validated_by_id?: string
  internal_validated_at?: string
  internal_notes?: string
  client_status: 'pending' | 'approved' | 'rejected'
  client_validated_at?: string
  client_validator_name?: string
  client_notes?: string
  content?: Record<string, unknown>
  narrative?: string
  template_version: string
  notes?: string
  created_by_id: string
  created_at: string
  updated_at: string
  attachments: ClosureReportAttachment[]
}

// ─────────────────────────────────────────────────────────────────

export interface EnvironmentalConfig {
  id: string
  vehicle_type: string
  fuel_type: string
  co2_per_km: number
  water_saved_per_wash: number
  standard_km: number
  is_active: boolean
}
