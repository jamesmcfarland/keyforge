export type InstanceStatus = 'provisioning' | 'ready' | 'failed'
export type OrganisationStatus = 'pending' | 'created' | 'failed'
export type DeploymentEventStatus = 'pending' | 'in_progress' | 'success' | 'failed'
export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

export interface Instance {
  id: string
  name: string
  vaultwd_url: string
  vaultwd_admin_token: string
  status: InstanceStatus
  error?: string
  created_at: number
}

export interface Organisation {
  id: string
  name: string
  instance_id: string
  vaultwd_org_id?: string
  vaultwd_user_email?: string
  vaultwd_user_token?: string
  status: OrganisationStatus
  created_at: number
}

export interface DeploymentEvent {
  id: string
  deployment_id: string
  step: string
  status: DeploymentEventStatus
  message?: string
  created_at: number
}

export interface DeploymentLog {
  id: string
  deployment_id: string
  level: LogLevel
  message: string
  created_at: number
}

export interface DeploymentDetail {
  instance: Instance
  organisations: Organisation[]
  events: DeploymentEvent[]
}

export interface DeploymentEventsResponse {
  deployment_id: string
  events: DeploymentEvent[]
}

export interface DeploymentLogsResponse {
  deployment_id: string
  logs: DeploymentLog[]
  total: number
  page: number
  limit: number
}

export interface Password {
  id: string
  organisation_id: string
  name: string
  created_at: number
}

export interface PasswordWithValue extends Password {
  username?: string
  password: string
  totp?: string
  uris?: string[]
  notes?: string
}

export interface PasswordListResponse {
  organisation_id: string
  passwords: Password[]
}

export interface CreateOrganisationRequest {
  name: string
}

export interface CreateOrganisationResponse {
  organisation_id: string
  instance_id: string
  vaultwd_org_id: string
  status: string
}

export interface CreatePasswordRequest {
  name: string
  username?: string
  password: string
  totp?: string
  uris?: string[]
  notes?: string
}

export interface CreatePasswordResponse {
  password_id: string
  organisation_id: string
  name: string
  created_at: number
}
