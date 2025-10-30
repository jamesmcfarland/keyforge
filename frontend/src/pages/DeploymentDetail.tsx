import { useDeployment, useDeploymentLogs, useDeleteInstance } from '../hooks/useDeployments'
import { useParams, Link, useNavigate } from 'react-router-dom'
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
  const navigate = useNavigate()
  const [logLevel, setLogLevel] = useState<string>('')
  const [page, setPage] = useState(1)
  const [isOrganisationModalOpen, setIsOrganisationModalOpen] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  
  const { data: deployment, isLoading, error } = useDeployment(id!)
  const { data: logsData } = useDeploymentLogs(id!, logLevel || undefined, page)
  const isFetching = useIsFetching()
  const deleteInstance = useDeleteInstance()

  const handleDelete = async () => {
    if (!id) return
    
    try {
      await deleteInstance.mutateAsync(id)
      navigate('/')
    } catch (error) {
      console.error('Failed to delete instance:', error)
      alert('Failed to delete instance. Please try again.')
    }
  }

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
          <div className="flex items-center space-x-4">
            <Link to="/" className="text-blue-600 hover:text-blue-800">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <h1 className="text-3xl font-bold">{deployment.instance.name}</h1>
          </div>
          <div className="flex items-center space-x-4">
            {isFetching > 0 && (
              <div className="flex items-center space-x-2 text-blue-600">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-sm">Updating...</span>
              </div>
            )}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleteInstance.isPending}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:bg-gray-400 flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>{deleteInstance.isPending ? 'Deleting...' : 'Delete Instance'}</span>
            </button>
          </div>
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

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Confirm Deletion</h2>
            <p className="text-gray-700 mb-4">
              Are you sure you want to delete this instance? This will:
            </p>
            <ul className="list-disc list-inside text-gray-700 mb-6 space-y-2">
              <li>Delete the Kubernetes namespace and all resources</li>
              <li>Remove all VaultWarden data</li>
              <li>Delete all organisations and passwords</li>
              <li>This action cannot be undone</li>
            </ul>
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    <strong>Warning:</strong> This will permanently delete the instance <span className="font-mono">{deployment.instance.id}</span>
                  </p>
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteInstance.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:bg-gray-400"
              >
                {deleteInstance.isPending ? 'Deleting...' : 'Delete Instance'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
