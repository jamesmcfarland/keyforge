export type InstanceStatus = 'provisioning' | 'ready' | 'failed'
export type OrganisationStatus = 'pending' | 'created' | 'failed'
export type HealthStatus = 'healthy' | 'unhealthy'
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

export interface Password {
  id: string
  organisation_id: string
  vaultwd_cipher_id: string
  created_at: number
}

export interface PasswordWithData {
  id: string
  organisation_id: string
  name: string
  created_at: number
}

export interface PasswordDetail {
  id: string
  organisation_id: string
  name: string
  username?: string
  password: string
  totp?: string
  uris?: string[]
  notes?: string
  created_at: number
}

export interface HealthCheck {
  status: HealthStatus
  instance_id: string
  message?: string
  checked_at: number
}

export interface CreateInstanceRequest {
  name: string
}

export interface CreateInstanceResponse {
  instance_id: string
  vaultwd_url: string
  admin_token: string
  status: InstanceStatus
}

export interface CreateOrganisationRequest {
  name: string
}

export interface CreateOrganisationResponse {
  organisation_id: string
  instance_id: string
  vaultwd_org_id?: string
  status: OrganisationStatus
}

export interface CreatePasswordRequest {
  name: string
  username?: string
  password: string
  totp?: string
  uris?: string[]
  notes?: string
}

export interface UpdatePasswordRequest {
  name?: string
  username?: string
  password?: string
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

export interface PasswordListResponse {
  organisation_id: string
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

export type AuditEventType = 
  | 'admin_operation' 
  | 'instance_access' 
  | 'data_modification'
  | 'auth_failure'
  | 'key_rotation'

export interface JWTPayload {
  sub: string
  iat: number
  exp: number
  jti: string
  instanceId: string
  requestId: string
  metadata: Record<string, any>
  isAdmin?: boolean
}

export interface KeyPair {
  id: string
  instanceId: string | null
  publicKey: string
  createdAt: Date
  revokedAt: Date | null
}

export interface RevokedToken {
  jti: string
  instanceId: string
  revokedAt: Date
  expiresAt: Date
}

export interface AuditLog {
  id: string
  timestamp: Date
  endpoint: string
  method: string
  instanceId: string
  requestId: string
  metadata: Record<string, any>
  responseStatus: number
  eventType: AuditEventType
  createdAt: Date
}
