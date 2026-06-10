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

export interface Contract {
  id: string
  code: string
  name: string
  type: ContractType
  client_company?: string
  status: ContractStatus
  start_date: string
  end_date: string
  description?: string
  sedes: ContractSede[]
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

export interface EnvironmentalConfig {
  id: string
  vehicle_type: string
  fuel_type: string
  co2_per_km: number
  water_saved_per_wash: number
  standard_km: number
  is_active: boolean
}
