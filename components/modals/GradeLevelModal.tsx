'use client'

import React, { useState, useEffect } from 'react'
import { notify } from '@/lib/notification'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EducationLevel } from '@/types'

interface GradeLevelModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  editData?: {
    id: number
    name: string
    code: string
    level_number: number
    education_level: EducationLevel
    is_active: boolean
  }
}

const EDUCATION_LEVELS = [
  { value: 'KINDERGARTEN', label: 'Kindergarten' },
  { value: 'ELEMENTARY', label: 'Elementary' },
  { value: 'JUNIOR_HIGH', label: 'Junior High School' },
  { value: 'SENIOR_HIGH', label: 'Senior High School' },
  { value: 'COLLEGE', label: 'College' },
  { value: 'GRADUATE_SCHOOL', label: 'Graduate School' }
]

export default function GradeLevelModal({
  isOpen,
  onClose,
  onSuccess,
  editData
}: GradeLevelModalProps) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [levelNumber, setLevelNumber] = useState('')
  const [educationLevel, setEducationLevel] = useState<EducationLevel>('ELEMENTARY')
  const [isActive, setIsActive] = useState(true)
  const [processing, setProcessing] = useState(false)

  const isEditMode = !!editData

  useEffect(() => {
    if (editData) {
      setName(editData.name)
      setCode(editData.code)
      setLevelNumber(String(editData.level_number))
      setEducationLevel(editData.education_level)
      setIsActive(editData.is_active)
    } else {
      resetForm()
    }
  }, [editData, isOpen])

  const resetForm = () => {
    setName('')
    setCode('')
    setLevelNumber('')
    setEducationLevel('ELEMENTARY')
    setIsActive(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim()) {
      await notify.error('Validation Error', 'Grade level name is required')
      return
    }

    if (!code.trim()) {
      await notify.error('Validation Error', 'Grade level code is required')
      return
    }

    const parsedLevelNumber = parseInt(levelNumber)
    if (isNaN(parsedLevelNumber) || parsedLevelNumber < 1) {
      await notify.error('Validation Error', 'Level number must be a positive number')
      return
    }

    setProcessing(true)
    try {
      const payload = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        level_number: parsedLevelNumber,
        education_level: educationLevel,
        is_active: isActive
      }

      const url = isEditMode ? `/api/grade-levels/${editData.id}` : '/api/grade-levels'
      const method = isEditMode ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || `Failed to ${isEditMode ? 'update' : 'create'} grade level`)
      }

      await notify.success(
        'Success',
        `Grade level ${isEditMode ? 'updated' : 'created'} successfully`
      )
      
      resetForm()
      onSuccess()
      onClose()
    } catch (error) {
      await notify.error(
        'Error',
        error instanceof Error ? error.message : `Failed to ${isEditMode ? 'update' : 'create'} grade level`
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
            {isEditMode ? 'Edit Grade Level' : 'Add New Grade Level'}
          </h3>
        </div>
        
        <form onSubmit={handleSubmit} className="px-6 py-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Education Level *
              </label>
              <select
                value={educationLevel}
                onChange={(e) => setEducationLevel(e.target.value as EducationLevel)}
                disabled={processing}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {EDUCATION_LEVELS.map(level => (
                  <option key={level.value} value={level.value}>
                    {level.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Grade Level Name *
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Grade 1, Grade 7, First Year"
                disabled={processing}
                required
                maxLength={100}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Grade Level Code *
              </label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g., G1, G7, YEAR1"
                disabled={processing}
                required
                maxLength={20}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Level Number *
              </label>
              <Input
                type="number"
                value={levelNumber}
                onChange={(e) => setLevelNumber(e.target.value)}
                placeholder="e.g., 1, 7, 11"
                disabled={processing}
                required
                min="1"
              />
              <p className="text-xs text-gray-500 mt-1">Used for ordering grade levels</p>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="isActiveGrade"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                disabled={processing}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="isActiveGrade" className="ml-2 block text-sm text-gray-700">
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
