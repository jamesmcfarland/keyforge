import axios from 'axios'
import type { Union, DeploymentDetail, DeploymentEventsResponse, DeploymentLogsResponse } from '../types'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000'

const client = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json'
  }
})

export const api = {
  getDeployments: async (): Promise<{ deployments: Union[] }> => {
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

  createUnion: async (name: string): Promise<{ union_id: string; vaultwd_url: string; admin_token: string; status: string }> => {
    const response = await client.post('/admin/unions', { name })
    return response.data
  }
}
