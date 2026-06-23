'use client'

import React, { useState, useEffect } from 'react'
import { notify } from '@/lib/notification'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface SectionModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  editData?: {
    id: number
    name: string
    grade_level_id: number
    strand_id?: number
    is_active: boolean
  }
}

interface GradeLevel {
  id: number
  name: string
  code: string
  education_level: string
}

interface Strand {
  id: number
  name: string
  code: string
}

export default function SectionModal({
  isOpen,
  onClose,
  onSuccess,
  editData
}: SectionModalProps) {
  const [name, setName] = useState('')
  const [gradeLevelId, setGradeLevelId] = useState('')
  const [strandId, setStrandId] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [processing, setProcessing] = useState(false)
  
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([])
  const [strands, setStrands] = useState<Strand[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [selectedGradeLevel, setSelectedGradeLevel] = useState<GradeLevel | null>(null)

  const isEditMode = !!editData

  useEffect(() => {
    if (isOpen) {
      loadInitialData()
    }
  }, [isOpen])

  useEffect(() => {
    if (editData) {
      setName(editData.name)
      setGradeLevelId(String(editData.grade_level_id))
      setStrandId(editData.strand_id ? String(editData.strand_id) : '')
      setIsActive(editData.is_active)
    } else {
      resetForm()
    }
  }, [editData, isOpen])

  useEffect(() => {
    if (gradeLevelId && gradeLevels.length > 0) {
      const selected = gradeLevels.find(g => g.id === parseInt(gradeLevelId))
      setSelectedGradeLevel(selected || null)
      
      // Clear strand if not senior high
      if (selected && selected.education_level !== 'SENIOR_HIGH') {
        setStrandId('')
      }
    }
  }, [gradeLevelId, gradeLevels])

  const loadInitialData = async () => {
    setLoadingData(true)
    try {
      const [gradesRes, strandsRes] = await Promise.all([
        fetch('/api/grade-levels?limit=100', { credentials: 'include' }),
        fetch('/api/strands?limit=100', { credentials: 'include' })
      ])

      if (gradesRes.ok) {
        const gradesData = await gradesRes.json()
        // API returns array directly, not wrapped in data property
        const grades = Array.isArray(gradesData) ? gradesData : (gradesData.data || [])
        setGradeLevels(grades.map((g: any) => ({
          id: g.grade_level_id,
          name: g.name,
          code: g.code,
          education_level: g.education_level
        })))
      }

      if (strandsRes.ok) {
        const strandsData = await strandsRes.json()
        // API returns array directly, not wrapped in data property
        const strandsArray = Array.isArray(strandsData) ? strandsData : (strandsData.data || [])
        setStrands(strandsArray.map((s: any) => ({
          id: s.strand_id,
          name: s.name,
          code: s.code
        })))
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoadingData(false)
    }
  }

  const resetForm = () => {
    setName('')
    setGradeLevelId('')
    setStrandId('')
    setIsActive(true)
    setSelectedGradeLevel(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim()) {
      await notify.error('Validation Error', 'Section name is required')
      return
    }

    if (!gradeLevelId) {
      await notify.error('Validation Error', 'Grade level is required')
      return
    }

    if (selectedGradeLevel?.education_level === 'SENIOR_HIGH' && !strandId) {
      await notify.error('Validation Error', 'Strand is required for Senior High sections')
      return
    }

    setProcessing(true)
    try {
      const payload = {
        name: name.trim(),
        grade_level_id: parseInt(gradeLevelId),
        strand_id: strandId ? parseInt(strandId) : undefined,
        is_active: isActive
      }

      const url = isEditMode ? `/api/student-sections/${editData.id}` : '/api/student-sections'
      const method = isEditMode ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || `Failed to ${isEditMode ? 'update' : 'create'} section`)
      }

      await notify.success(
        'Success',
        `Section ${isEditMode ? 'updated' : 'created'} successfully`
      )
      
      resetForm()
      onSuccess()
      onClose()
    } catch (error) {
      await notify.error(
        'Error',
        error instanceof Error ? error.message : `Failed to ${isEditMode ? 'update' : 'create'} section`
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

  const isSeniorHigh = selectedGradeLevel?.education_level === 'SENIOR_HIGH'

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {isEditMode ? 'Edit Section' : 'Add New Section'}
          </h3>
        </div>
        
        <form onSubmit={handleSubmit} className="px-6 py-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Grade Level *
              </label>
              <select
                value={gradeLevelId}
                onChange={(e) => setGradeLevelId(e.target.value)}
                disabled={processing || loadingData}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select grade level...</option>
                {gradeLevels.map(grade => (
                  <option key={grade.id} value={grade.id}>
                    {grade.name} ({grade.code})
                  </option>
                ))}
              </select>
            </div>

            {isSeniorHigh && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Strand *
                </label>
                <select
                  value={strandId}
                  onChange={(e) => setStrandId(e.target.value)}
                  disabled={processing || loadingData}
                  required={isSeniorHigh}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select strand...</option>
                  {strands.map(strand => (
                    <option key={strand.id} value={strand.id}>
                      {strand.name} ({strand.code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Section Name *
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., A, B, Einstein, Newton"
                disabled={processing}
                required
                maxLength={100}
              />
              <p className="text-xs text-gray-500 mt-1">Must be unique per grade level</p>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="isActiveSection"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                disabled={processing}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="isActiveSection" className="ml-2 block text-sm text-gray-700">
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
              disabled={processing || loadingData}
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
