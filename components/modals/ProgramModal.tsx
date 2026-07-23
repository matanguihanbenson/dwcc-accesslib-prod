'use client'

import React, { useState, useEffect } from 'react'
import { notify } from '@/lib/notification'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface ProgramModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  departments: { department_id: number; name: string; code: string }[]
  editData?: {
    id: number
    name: string
    code: string
    description?: string
    department_id: number
    is_active: boolean
  }
}

export default function ProgramModal({
  isOpen,
  onClose,
  onSuccess,
  departments,
  editData
}: ProgramModalProps) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [processing, setProcessing] = useState(false)

  const isEditMode = !!editData

  useEffect(() => {
    if (editData) {
      setName(editData.name)
      setCode(editData.code)
      setDescription(editData.description || '')
      setDepartmentId(String(editData.department_id))
      setIsActive(editData.is_active)
    } else {
      resetForm()
    }
  }, [editData, isOpen])

  const resetForm = () => {
    setName('')
    setCode('')
    setDescription('')
    setDepartmentId('')
    setIsActive(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim()) {
      await notify.error('Validation Error', 'Program name is required')
      return
    }

    if (!code.trim()) {
      await notify.error('Validation Error', 'Program code is required')
      return
    }

    if (!departmentId) {
      await notify.error('Validation Error', 'Department is required')
      return
    }

    setProcessing(true)
    try {
      const payload = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        description: description.trim() || undefined,
        department_id: parseInt(departmentId),
        is_active: isActive
      }

      const url = isEditMode ? `/api/programs/${editData.id}` : '/api/programs'
      const method = isEditMode ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || `Failed to ${isEditMode ? 'update' : 'create'} program`)
      }

      await notify.success(
        'Success',
        `Program ${isEditMode ? 'updated' : 'created'} successfully`
      )
      
      resetForm()
      onSuccess()
      onClose()
    } catch (error) {
      await notify.error(
        'Error',
        error instanceof Error ? error.message : `Failed to ${isEditMode ? 'update' : 'create'} program`
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
            {isEditMode ? 'Edit Program' : 'Add New Program'}
          </h3>
        </div>
        
        <form onSubmit={handleSubmit} className="px-6 py-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department *
              </label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                disabled={processing}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                <option value="">Select department...</option>
                {departments.map(dept => (
                  <option key={dept.department_id} value={dept.department_id}>
                    {dept.name} ({dept.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Program Name *
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Bachelor of Science in Computer Science"
                disabled={processing}
                required
                maxLength={100}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Program Code *
              </label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g., BSCS, BSIT"
                disabled={processing}
                required
                maxLength={20}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                disabled={processing}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="isActiveProgram"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                disabled={processing}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="isActiveProgram" className="ml-2 block text-sm text-gray-700">
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
              className="flex-1 bg-gray-200 px-4 py-5 hover:bg-gray-300"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={processing}
              className="flex-1 bg-primary-600 px-4 py-5 text-white hover:bg-primary-700"
            >
              {processing ? 'Saving...' : isEditMode ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
