import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

export const useDeployments = () => {
  return useQuery({
    queryKey: ['deployments'],
    queryFn: () => api.getDeployments(),
    refetchInterval: 5000
  })
}

export const useDeployment = (id: string) => {
  return useQuery({
    queryKey: ['deployment', id],
    queryFn: () => api.getDeployment(id),
    refetchInterval: 3000
  })
}

export const useDeploymentLogs = (id: string, level?: string, page = 1, limit = 100) => {
  return useQuery({
    queryKey: ['deploymentLogs', id, level, page, limit],
    queryFn: () => api.getDeploymentLogs(id, { level, page, limit }),
    refetchInterval: 2000
  })
}

export const useDeleteInstance = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (id: string) => api.deleteInstance(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployments'] })
    }
  })
}
