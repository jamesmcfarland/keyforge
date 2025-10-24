export type UnionStatus = 'provisioning' | 'ready' | 'failed'
export type SocietyStatus = 'pending' | 'created' | 'failed'
export type HealthStatus = 'healthy' | 'unhealthy'
export type DeploymentEventStatus = 'pending' | 'in_progress' | 'success' | 'failed'
export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

export interface Union {
  id: string
  name: string
  vaultwd_url: string
  vaultwd_admin_token: string
  status: UnionStatus
  error?: string
  created_at: number
}

export interface Society {
  id: string
  name: string
  union_id: string
  vaultwd_org_id?: string
  vaultwd_user_email?: string
  vaultwd_user_token?: string
  status: SocietyStatus
  created_at: number
}

export interface Password {
  id: string
  society_id: string
  vaultwd_cipher_id: string
  created_at: number
}

export interface PasswordWithData {
  id: string
  society_id: string
  name: string
  created_at: number
}

export interface PasswordDetail {
  id: string
  society_id: string
  name: string
  value: string
  created_at: number
}

export interface HealthCheck {
  status: HealthStatus
  union_id: string
  message?: string
  checked_at: number
}

export interface CreateUnionRequest {
  name: string
}

export interface CreateUnionResponse {
  union_id: string
  vaultwd_url: string
  admin_token: string
  status: UnionStatus
}

export interface CreateSocietyRequest {
  name: string
}

export interface CreateSocietyResponse {
  society_id: string
  union_id: string
  vaultwd_org_id?: string
  status: SocietyStatus
}

export interface CreatePasswordRequest {
  name: string
  value: string
}

export interface UpdatePasswordRequest {
  name?: string
  value?: string
}

export interface CreatePasswordResponse {
  password_id: string
  society_id: string
  name: string
  created_at: number
}

export interface PasswordListResponse {
  society_id: string
  passwords: PasswordWithData[]
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
  union: Union
  societies: Society[]
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
