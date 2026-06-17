'use client'

import React, { useState, useEffect } from 'react'
import { notify } from '@/lib/notification'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface StrandModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  editData?: {
    id: number
    name: string
    code: string
    abbreviation?: string
    is_active: boolean
  }
}

export default function StrandModal({
  isOpen,
  onClose,
  onSuccess,
  editData
}: StrandModalProps) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [abbreviation, setAbbreviation] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [processing, setProcessing] = useState(false)

  const isEditMode = !!editData

  useEffect(() => {
    if (editData) {
      setName(editData.name)
      setCode(editData.code)
      setAbbreviation(editData.abbreviation || '')
      setIsActive(editData.is_active)
    } else {
      resetForm()
    }
  }, [editData, isOpen])

  const resetForm = () => {
    setName('')
    setCode('')
    setAbbreviation('')
    setIsActive(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim()) {
      await notify.error('Validation Error', 'Strand name is required')
      return
    }

    if (!code.trim()) {
      await notify.error('Validation Error', 'Strand code is required')
      return
    }

    setProcessing(true)
    try {
      const payload = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        abbreviation: abbreviation.trim() || undefined,
        is_active: isActive
      }

      const url = isEditMode ? `/api/strands/${editData.id}` : '/api/strands'
      const method = isEditMode ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || `Failed to ${isEditMode ? 'update' : 'create'} strand`)
      }

      await notify.success(
        'Success',
        `Strand ${isEditMode ? 'updated' : 'created'} successfully`
      )
      
      resetForm()
      onSuccess()
      onClose()
    } catch (error) {
      await notify.error(
        'Error',
        error instanceof Error ? error.message : `Failed to ${isEditMode ? 'update' : 'create'} strand`
      )
    } finally {
      setProcessing(false)
    }
  }

  const handleClose = () => {
    if (!processing) {
      resetForm()
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {isEditMode ? 'Edit Strand' : 'Add New Strand'}
          </h3>
        </div>
        
        <form onSubmit={handleSubmit} className="px-6 py-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Strand Name *
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Science, Technology, Engineering, and Mathematics"
                disabled={processing}
                required
                maxLength={200}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Strand Code *
              </label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g., STEM"
                disabled={processing}
                required
                maxLength={20}
              />
              <p className="text-xs text-gray-500 mt-1">Must be unique</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Abbreviation (Optional)
              </label>
              <Input
                value={abbreviation}
                onChange={(e) => setAbbreviation(e.target.value)}
                placeholder="e.g., STEM"
                disabled={processing}
                maxLength={50}
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                disabled={processing}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="isActive" className="ml-2 block text-sm text-gray-700">
                Active
              </label>
            </div>
          </div>

          <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={processing}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={processing}
              className="flex-1"
            >
              {processing ? 'Saving...' : isEditMode ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
