export type UnionStatus = 'provisioning' | 'ready' | 'failed'
export type SocietyStatus = 'pending' | 'created' | 'failed'
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
