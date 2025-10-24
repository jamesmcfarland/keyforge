import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

interface NewSocietyModalProps {
  isOpen: boolean
  onClose: () => void
  unionId: string
}

export function NewSocietyModal({ isOpen, onClose, unionId }: NewSocietyModalProps) {
  const [name, setName] = useState('')
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (societyName: string) => {
      return api.createSociety(unionId, societyName)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployment', unionId] })
      setName('')
      onClose()
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim()) {
      mutation.mutate(name)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4">Create New Society</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="society-name" className="block text-sm font-medium text-gray-700 mb-2">
              Society Name
            </label>
            <input
              id="society-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., engineering-team"
              required
              disabled={mutation.isPending}
            />
          </div>

          {mutation.isError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
              Failed to create society. Please try again.
            </div>
          )}

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              disabled={mutation.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400"
              disabled={mutation.isPending || !name.trim()}
            >
              {mutation.isPending ? 'Creating...' : 'Create Society'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
