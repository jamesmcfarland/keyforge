import { Link, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'

export function Header() {
  const location = useLocation()
  const queryClient = useQueryClient()

  const handleRefresh = () => {
    queryClient.invalidateQueries()
  }

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link to="/" className="text-2xl font-bold text-gray-900 hover:text-gray-700">
              Keyforge Dashboard
            </Link>
            {location.pathname !== '/' && (
              <span className="text-gray-400">|</span>
            )}
            {location.pathname !== '/' && (
              <Link to="/" className="text-blue-600 hover:text-blue-800">
                Deployments
              </Link>
            )}
          </div>
          <button
            onClick={handleRefresh}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span>Refresh</span>
          </button>
        </div>
      </div>
    </header>
  )
}
