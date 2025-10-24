import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { useState, useEffect } from 'react'
import { NewPasswordModal } from '../components/NewPasswordModal'
import { formatDistanceToNow } from 'date-fns'
import * as OTPAuth from 'otpauth'

export function SocietyDetail() {
  const { unionId, societyId } = useParams<{ unionId: string; societyId: string }>()
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  const [selectedPassword, setSelectedPassword] = useState<string | null>(null)
  const [totpCode, setTotpCode] = useState<string | null>(null)
  const [totpTimeLeft, setTotpTimeLeft] = useState<number>(30)
  const queryClient = useQueryClient()

  const { data: deployment } = useQuery({
    queryKey: ['deployment', unionId],
    queryFn: () => api.getDeployment(unionId!),
    enabled: !!unionId
  })

  const { data: passwordsData, isLoading, error } = useQuery({
    queryKey: ['passwords', unionId, societyId],
    queryFn: () => api.getPasswords(unionId!, societyId!),
    enabled: !!unionId && !!societyId,
    refetchInterval: 5000
  })

  const { data: selectedPasswordData } = useQuery({
    queryKey: ['password', unionId, societyId, selectedPassword],
    queryFn: () => api.getPassword(unionId!, societyId!, selectedPassword!),
    enabled: !!unionId && !!societyId && !!selectedPassword
  })

  useEffect(() => {
    if (selectedPasswordData?.totp) {
      const generateTOTP = () => {
        try {
          const totp = new OTPAuth.TOTP({
            secret: selectedPasswordData.totp,
            digits: 6,
            period: 30
          })
          
          const code = totp.generate()
          setTotpCode(code)
          
          const now = Math.floor(Date.now() / 1000)
          const timeLeft = 30 - (now % 30)
          setTotpTimeLeft(timeLeft)
        } catch (error) {
          console.error('Failed to generate TOTP:', error)
          setTotpCode(null)
        }
      }

      generateTOTP()
      const interval = setInterval(generateTOTP, 1000)

      return () => clearInterval(interval)
    } else {
      setTotpCode(null)
      setTotpTimeLeft(30)
    }
  }, [selectedPasswordData?.totp])

  const deleteMutation = useMutation({
    mutationFn: (passwordId: string) => api.deletePassword(unionId!, societyId!, passwordId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['passwords', unionId, societyId] })
      if (selectedPassword) {
        setSelectedPassword(null)
      }
    }
  })

  const society = deployment?.societies.find(s => s.id === societyId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">Loading passwords...</div>
      </div>
    )
  }

  if (error || !passwordsData || !society) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-red-600">Error loading passwords</div>
      </div>
    )
  }

  const handleCopyPassword = (value: string) => {
    navigator.clipboard.writeText(value)
  }

  const handleCopyTotp = (value: string) => {
    navigator.clipboard.writeText(value)
  }

  const handleCopyTotpCode = () => {
    if (totpCode) {
      navigator.clipboard.writeText(totpCode)
    }
  }

  const handleDeletePassword = (passwordId: string) => {
    if (confirm('Are you sure you want to delete this password?')) {
      deleteMutation.mutate(passwordId)
    }
  }

  return (
    <div className="container mx-auto p-6">
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="mb-4">
          <h1 className="text-3xl font-bold">{society.name}</h1>
          <p className="text-sm text-gray-500 font-mono mt-1">{society.id}</p>
          <p className="text-sm text-gray-600 mt-2">
            Union: <span className="font-semibold">{deployment?.union.name}</span>
          </p>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Passwords</h2>
          <button
            onClick={() => setIsPasswordModalOpen(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>New Password</span>
          </button>
        </div>

        {passwordsData.passwords.length === 0 ? (
          <p className="text-gray-500 text-sm">No passwords created yet</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-3">
              {passwordsData.passwords.map((password) => (
                <div
                  key={password.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    selectedPassword === password.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedPassword(password.id)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-semibold">{password.name}</h3>
                      <p className="text-xs text-gray-500 font-mono mt-1">{password.id}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        Created {formatDistanceToNow(password.created_at, { addSuffix: true })}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeletePassword(password.id)
                      }}
                      className="text-red-600 hover:text-red-800"
                      disabled={deleteMutation.isPending}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div>
              {selectedPassword && selectedPasswordData ? (
                <div className="border border-gray-200 rounded-lg p-6 bg-gray-50 sticky top-6">
                  <h3 className="text-xl font-bold mb-4">Password Details</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                      <p className="text-sm font-mono bg-white border border-gray-300 rounded px-3 py-2">
                        {selectedPasswordData.name}
                      </p>
                    </div>
                    {selectedPasswordData.username && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                        <p className="text-sm font-mono bg-white border border-gray-300 rounded px-3 py-2">
                          {selectedPasswordData.username}
                        </p>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          value={selectedPasswordData.password}
                          readOnly
                          className="flex-1 text-sm font-mono bg-white border border-gray-300 rounded px-3 py-2"
                        />
                        <button
                          onClick={() => handleCopyPassword(selectedPasswordData.password)}
                          className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                          title="Copy to clipboard"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    {selectedPasswordData.totp && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">TOTP Secret</label>
                        <div className="flex space-x-2">
                          <input
                            type="text"
                            value={selectedPasswordData.totp}
                            readOnly
                            className="flex-1 text-sm font-mono bg-white border border-gray-300 rounded px-3 py-2"
                          />
                          <button
                            onClick={() => handleCopyTotp(selectedPasswordData.totp!)}
                            className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                            title="Copy to clipboard"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>
                        {totpCode && (
                          <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-gray-700">Current Code</span>
                              <span className="text-xs text-gray-600">Expires in {totpTimeLeft}s</span>
                            </div>
                            <div className="flex space-x-2">
                              <input
                                type="text"
                                value={totpCode}
                                readOnly
                                className="flex-1 text-2xl font-mono font-bold bg-white border border-blue-300 rounded px-3 py-2 text-center tracking-wider"
                              />
                              <button
                                onClick={handleCopyTotpCode}
                                className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                title="Copy code to clipboard"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              </button>
                            </div>
                            <div className="mt-2 h-1 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-blue-600 transition-all duration-1000 ease-linear"
                                style={{ width: `${(totpTimeLeft / 30) * 100}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {selectedPasswordData.uris && selectedPasswordData.uris.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">URIs</label>
                        <div className="space-y-1">
                          {selectedPasswordData.uris.map((uri, index) => (
                            <a
                              key={index}
                              href={uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-sm text-blue-600 hover:text-blue-800 bg-white border border-gray-300 rounded px-3 py-2"
                            >
                              {uri}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                    {selectedPasswordData.notes && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                        <p className="text-sm bg-white border border-gray-300 rounded px-3 py-2 whitespace-pre-wrap">
                          {selectedPasswordData.notes}
                        </p>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">ID</label>
                      <p className="text-xs font-mono bg-white border border-gray-300 rounded px-3 py-2 text-gray-600">
                        {selectedPasswordData.id}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Created</label>
                      <p className="text-sm bg-white border border-gray-300 rounded px-3 py-2">
                        {formatDistanceToNow(selectedPasswordData.created_at, { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border border-gray-200 rounded-lg p-6 bg-gray-50 text-center text-gray-500">
                  Select a password to view details
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <NewPasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        unionId={unionId!}
        societyId={societyId!}
      />
    </div>
  )
}
