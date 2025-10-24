import { useDeployment, useDeploymentLogs } from '../hooks/useDeployments'
import { useParams, Link } from 'react-router-dom'
import { formatDistanceToNow, format } from 'date-fns'
import { useState } from 'react'
import { useIsFetching } from '@tanstack/react-query'
import { NewOrganisationModal } from '../components/NewOrganisationModal'
import type { DeploymentEventStatus, LogLevel } from '../types'

const statusColors: Record<DeploymentEventStatus, string> = {
  pending: 'bg-gray-100 text-gray-800',
  in_progress: 'bg-blue-100 text-blue-800',
  success: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800'
}

const logLevelColors: Record<LogLevel, string> = {
  info: 'text-blue-600',
  warn: 'text-yellow-600',
  error: 'text-red-600',
  debug: 'text-gray-600'
}

export function DeploymentDetail() {
  const { id } = useParams<{ id: string }>()
  const [logLevel, setLogLevel] = useState<string>('')
  const [page, setPage] = useState(1)
  const [isOrganisationModalOpen, setIsOrganisationModalOpen] = useState(false)
  
  const { data: deployment, isLoading, error } = useDeployment(id!)
  const { data: logsData } = useDeploymentLogs(id!, logLevel || undefined, page)
  const isFetching = useIsFetching()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">Loading deployment...</div>
      </div>
    )
  }

  if (error || !deployment) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-red-600">Error loading deployment</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold">{deployment.instance.name}</h1>
          {isFetching > 0 && (
            <div className="flex items-center space-x-2 text-blue-600">
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-sm">Updating...</span>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">ID</p>
            <p className="font-mono text-sm">{deployment.instance.id}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Status</p>
            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
              {deployment.instance.status}
            </span>
          </div>
          <div>
            <p className="text-sm text-gray-500">Created</p>
            <p className="text-sm">{format(deployment.instance.created_at, 'PPpp')}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">VaultWarden URL</p>
            <p className="text-sm font-mono">{deployment.instance.vaultwd_url}</p>
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Organisations</h2>
          {deployment.instance.status === 'ready' && (
            <button
              onClick={() => setIsOrganisationModalOpen(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>New Organisation</span>
            </button>
          )}
        </div>
        {deployment.organisations.length === 0 ? (
          <p className="text-gray-500 text-sm">No organisations created yet</p>
        ) : (
          <div className="space-y-3">
            {deployment.organisations.map((organisation) => (
              <div key={organisation.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{organisation.name}</h3>
                    <p className="text-xs text-gray-500 font-mono mt-1">{organisation.id}</p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      organisation.status === 'created' ? 'bg-green-100 text-green-800' : 
                      organisation.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                      'bg-red-100 text-red-800'
                    }`}>
                      {organisation.status}
                    </span>
                    {organisation.status === 'created' && (
                      <Link
                        to={`/deployments/${deployment.instance.id}/organisations/${organisation.id}`}
                        className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                      >
                        Manage Passwords
                      </Link>
                    )}
                  </div>
                </div>
                {organisation.vaultwd_org_id && (
                  <p className="text-xs text-gray-600 mt-2">
                    VaultWarden Org: <span className="font-mono">{organisation.vaultwd_org_id}</span>
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-2xl font-bold mb-4">Provisioning Timeline</h2>
        <div className="space-y-4">
          {deployment.events.map((event) => (
            <div key={event.id} className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[event.status]}`}>
                  {event.status}
                </span>
              </div>
              <div className="flex-1">
                <p className="font-medium">{event.step}</p>
                {event.message && (
                  <p className="text-sm text-gray-600">{event.message}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {formatDistanceToNow(event.created_at, { addSuffix: true })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Logs</h2>
          <select
            value={logLevel}
            onChange={(e) => setLogLevel(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1"
          >
            <option value="">All Levels</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
            <option value="debug">Debug</option>
          </select>
        </div>
        
        <div className="bg-gray-900 text-gray-100 rounded p-4 font-mono text-sm h-96 overflow-y-auto">
          {logsData?.logs.map((log) => (
            <div key={log.id} className="mb-2">
              <span className="text-gray-500">
                {format(log.created_at, 'HH:mm:ss')}
              </span>
              {' '}
              <span className={logLevelColors[log.level]}>
                [{log.level.toUpperCase()}]
              </span>
              {' '}
              <span>{log.message}</span>
            </div>
          ))}
        </div>

        {logsData && logsData.total > logsData.limit && (
          <div className="flex justify-between items-center mt-4">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {page} of {Math.ceil(logsData.total / logsData.limit)}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= Math.ceil(logsData.total / logsData.limit)}
              className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400"
            >
              Next
            </button>
          </div>
        )}
      </div>

      <NewOrganisationModal
        isOpen={isOrganisationModalOpen}
        onClose={() => setIsOrganisationModalOpen(false)}
        instanceId={deployment.instance.id}
      />
    </div>
  )
}
