import axios from 'axios'
import type { Instance, DeploymentDetail, DeploymentEventsResponse, DeploymentLogsResponse, CreateOrganisationResponse, PasswordListResponse, PasswordWithValue, CreatePasswordResponse, CreatePasswordRequest } from '../types'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000'
const ADMIN_API_KEY = import.meta.env.VITE_ADMIN_API_KEY

const client = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
    ...(ADMIN_API_KEY && { 'Authorization': `Bearer ${ADMIN_API_KEY}` })
  }
})

export const api = {
  getDeployments: async (): Promise<{ deployments: Instance[] }> => {
    const response = await client.get('/admin/deployments')
    return response.data
  },

  getDeployment: async (id: string): Promise<DeploymentDetail> => {
    const response = await client.get(`/admin/deployments/${id}`)
    return response.data
  },

  getDeploymentEvents: async (id: string): Promise<DeploymentEventsResponse> => {
    const response = await client.get(`/admin/deployments/${id}/events`)
    return response.data
  },

  getDeploymentLogs: async (
    id: string,
    options?: {
      level?: string
      since?: number
      page?: number
      limit?: number
    }
  ): Promise<DeploymentLogsResponse> => {
    const params = new URLSearchParams()
    if (options?.level) params.append('level', options.level)
    if (options?.since) params.append('since', options.since.toString())
    if (options?.page) params.append('page', options.page.toString())
    if (options?.limit) params.append('limit', options.limit.toString())
    
    const response = await client.get(`/admin/deployments/${id}/logs?${params}`)
    return response.data
  },

  createInstance: async (name: string): Promise<{ instance_id: string; vaultwd_url: string; admin_token: string; status: string }> => {
    const response = await client.post('/admin/instances', { name })
    return response.data
  },

  createOrganisation: async (instanceId: string, name: string): Promise<CreateOrganisationResponse> => {
    const response = await client.post(`/instances/${instanceId}/organisations`, { name })
    return response.data
  },

  getPasswords: async (instanceId: string, organisationId: string): Promise<PasswordListResponse> => {
    const response = await client.get(`/instances/${instanceId}/organisations/${organisationId}/passwords`)
    return response.data
  },

  getPassword: async (instanceId: string, organisationId: string, passwordId: string): Promise<PasswordWithValue> => {
    const response = await client.get(`/instances/${instanceId}/organisations/${organisationId}/passwords/${passwordId}`)
    return response.data
  },

  createPassword: async (instanceId: string, organisationId: string, data: CreatePasswordRequest): Promise<CreatePasswordResponse> => {
    const response = await client.post(`/instances/${instanceId}/organisations/${organisationId}/passwords`, data)
    return response.data
  },

  deletePassword: async (instanceId: string, organisationId: string, passwordId: string): Promise<{ message: string }> => {
    const response = await client.delete(`/instances/${instanceId}/organisations/${organisationId}/passwords/${passwordId}`)
    return response.data
  },

  deleteInstance: async (id: string): Promise<{ message: string }> => {
    const response = await client.delete(`/admin/instances/${id}`)
    return response.data
  }
}
