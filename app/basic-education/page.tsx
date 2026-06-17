'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { notify } from '@/lib/notification'
import StrandModal from '@/components/modals/StrandModal'
import GradeLevelModal from '@/components/modals/GradeLevelModal'
import SectionModal from '@/components/modals/SectionModal'

async function fetchJson<T>(url: string): Promise<T> {
  const cacheBuster = url.includes('?') ? `&ts=${Date.now()}` : `?ts=${Date.now()}`
  const response = await fetch(`${url}${cacheBuster}`, {
    credentials: 'include',
    cache: 'no-store',
  })

  if (!response.ok) {
    let message = 'Failed to load data'
    try {
      const err = await response.json()
      if (err?.error) message = err.error
    } catch {}
    throw new Error(message)
  }

  return response.json()
}

export default function BasicEducationPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('strands')
  const [strands, setStrands] = useState<any[] | null>(null)
  const [gradeLevels, setGradeLevels] = useState<any[] | null>(null)
  const [sections, setSections] = useState<any[] | null>(null)
  const [strandsError, setStrandsError] = useState<string | null>(null)
  const [gradeLevelsError, setGradeLevelsError] = useState<string | null>(null)
  const [sectionsError, setSectionsError] = useState<string | null>(null)
  const [strandsLoading, setStrandsLoading] = useState(false)
  const [gradeLevelsLoading, setGradeLevelsLoading] = useState(false)
  const [sectionsLoading, setSectionsLoading] = useState(false)
  
  // Modal states
  const [strandModalOpen, setStrandModalOpen] = useState(false)
  const [gradeLevelModalOpen, setGradeLevelModalOpen] = useState(false)
  const [sectionModalOpen, setSectionModalOpen] = useState(false)
  const [editingStrand, setEditingStrand] = useState<any>(null)
  const [editingGradeLevel, setEditingGradeLevel] = useState<any>(null)
  const [editingSection, setEditingSection] = useState<any>(null)

  const loadStrands = async () => {
    try {
      setStrandsLoading(true)
      setStrandsError(null)
      const data = await fetchJson<any[]>('/api/strands')
      setStrands(data)
    } catch (error) {
      setStrands([])
      setStrandsError(error instanceof Error ? error.message : 'Failed to load strands')
    } finally {
      setStrandsLoading(false)
    }
  }

  const loadGradeLevels = async () => {
    try {
      setGradeLevelsLoading(true)
      setGradeLevelsError(null)
      const data = await fetchJson<any[]>('/api/grade-levels')
      setGradeLevels(data)
    } catch (error) {
      setGradeLevels([])
      setGradeLevelsError(error instanceof Error ? error.message : 'Failed to load grade levels')
    } finally {
      setGradeLevelsLoading(false)
    }
  }

  const loadSections = async () => {
    try {
      setSectionsLoading(true)
      setSectionsError(null)
      const data = await fetchJson<any[]>('/api/student-sections')
      setSections(data)
    } catch (error) {
      setSections([])
      setSectionsError(error instanceof Error ? error.message : 'Failed to load sections')
    } finally {
      setSectionsLoading(false)
    }
  }

  // Auth check
  if (status === 'loading') {
    return (
      <div className="px-6 py-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <div className="text-sm text-gray-600">Loading...</div>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    router.push('/login')
    return null
  }

  const userRole = (session?.user as any)?.role

  if (userRole !== 'SUPER_ADMIN' && userRole !== 'ADMIN') {
    return (
      <div className="px-6 py-4">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">You do not have permission to access this page.</p>
        </div>
      </div>
    )
  }

  useEffect(() => {
    loadStrands()
    loadGradeLevels()
    loadSections()
  }, [])

  // Handler functions
  const handleAddStrand = () => {
    setEditingStrand(null)
    setStrandModalOpen(true)
  }

  const handleEditStrand = (strand: any) => {
    setEditingStrand(strand)
    setStrandModalOpen(true)
  }

  const handleToggleStrandActive = async (id: number, currentStatus: boolean) => {
    const action = currentStatus ? 'deactivate' : 'activate'
    const confirmed = await notify.confirm(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Strand`,
      `Are you sure you want to ${action} this strand?`
    )
    if (!confirmed) return

    try {
      const response = await fetch(`/api/strands/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_active: !currentStatus })
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || `Failed to ${action} strand`)
      }

      await notify.success('Success', `Strand ${action}d successfully`)
      await loadStrands()
    } catch (error) {
      await notify.error('Error', error instanceof Error ? error.message : `Failed to ${action} strand`)
    }
  }

  const handleAddGradeLevel = () => {
    setEditingGradeLevel(null)
    setGradeLevelModalOpen(true)
  }

  const handleEditGradeLevel = (gradeLevel: any) => {
    setEditingGradeLevel(gradeLevel)
    setGradeLevelModalOpen(true)
  }

  const handleToggleGradeLevelActive = async (id: number, currentStatus: boolean) => {
    const action = currentStatus ? 'deactivate' : 'activate'
    const confirmed = await notify.confirm(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Grade Level`,
      `Are you sure you want to ${action} this grade level?`
    )
    if (!confirmed) return

    try {
      const response = await fetch(`/api/grade-levels/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_active: !currentStatus })
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || `Failed to ${action} grade level`)
      }

      await notify.success('Success', `Grade level ${action}d successfully`)
      await loadGradeLevels()
    } catch (error) {
      await notify.error('Error', error instanceof Error ? error.message : `Failed to ${action} grade level`)
    }
  }

  const handleAddSection = () => {
    setEditingSection(null)
    setSectionModalOpen(true)
  }

  const handleEditSection = (section: any) => {
    setEditingSection(section)
    setSectionModalOpen(true)
  }

  const handleToggleSectionActive = async (id: number, currentStatus: boolean) => {
    const action = currentStatus ? 'deactivate' : 'activate'
    const confirmed = await notify.confirm(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Section`,
      `Are you sure you want to ${action} this section?`
    )
    if (!confirmed) return

    try {
      const response = await fetch(`/api/student-sections/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_active: !currentStatus })
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || `Failed to ${action} section`)
      }

      await notify.success('Success', `Section ${action}d successfully`)
      await loadSections()
    } catch (error) {
      await notify.error('Error', error instanceof Error ? error.message : `Failed to ${action} section`)
    }
  }

  return (
    <>
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-800">Basic Education Management</h1>
              <nav className="flex items-center space-x-2 text-sm text-gray-500 mt-1">
                <span>Administration</span>
                <i className="fas fa-chevron-right text-xs"></i>
                <span className="text-gray-900 font-medium">Basic Education</span>
              </nav>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="strands">
              <i className="fas fa-bookmark mr-2"></i>
              Senior High Strands
            </TabsTrigger>
            <TabsTrigger value="grades">
              <i className="fas fa-layer-group mr-2"></i>
              Grade Levels
            </TabsTrigger>
            <TabsTrigger value="sections">
              <i className="fas fa-users mr-2"></i>
              Sections
            </TabsTrigger>
          </TabsList>

          {/* Strands Tab */}
          <TabsContent value="strands">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Senior High School Strands</CardTitle>
                  <Button onClick={handleAddStrand}>
                    <i className="fas fa-plus mr-2"></i>
                    Add Strand
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {strandsError ? (
                  <div className="text-red-600">{strandsError}</div>
                ) : strandsLoading || !strands ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <div className="text-sm text-gray-600">Loading strands...</div>
                  </div>
                ) : strands.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <i className="fas fa-bookmark text-4xl mb-3 text-gray-300"></i>
                    <p>No strands created yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Code
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Abbreviation
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Students
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {strands.map((strand: any) => (
                          <tr key={strand.strand_id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {strand.name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {strand.code}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {strand.abbreviation}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {strand.student_count || 0}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                strand.is_active
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {strand.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex items-center justify-end gap-2">
                                <button 
                                  onClick={() => handleEditStrand({
                                    id: strand.strand_id,
                                    name: strand.name,
                                    code: strand.code,
                                    abbreviation: strand.abbreviation,
                                    is_active: strand.is_active
                                  })}
                                  className="inline-flex items-center px-3 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-md transition-colors"
                                  title="Edit Strand"
                                >
                                  <i className="fas fa-edit mr-1.5"></i>
                                  Edit
                                </button>
                                <button 
                                  onClick={() => handleToggleStrandActive(strand.strand_id, strand.is_active)}
                                  className={`inline-flex items-center px-3 py-1.5 rounded-md transition-colors ${
                                    strand.is_active
                                      ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                                  }`}
                                  title={strand.is_active ? 'Deactivate' : 'Activate'}
                                >
                                  <i className={`fas fa-${strand.is_active ? 'ban' : 'check-circle'} mr-1.5`}></i>
                                  {strand.is_active ? 'Deactivate' : 'Activate'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Grade Levels Tab */}
          <TabsContent value="grades">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Grade Levels</CardTitle>
                  <Button onClick={handleAddGradeLevel}>
                    <i className="fas fa-plus mr-2"></i>
                    Add Grade Level
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {gradeLevelsError ? (
                  <div className="text-red-600">{gradeLevelsError}</div>
                ) : gradeLevelsLoading || !gradeLevels ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <div className="text-sm text-gray-600">Loading grade levels...</div>
                  </div>
                ) : gradeLevels.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <i className="fas fa-layer-group text-4xl mb-3 text-gray-300"></i>
                    <p>No grade levels created yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Code
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Level
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Education Level
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Sections
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Students
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {gradeLevels.map((grade: any) => (
                          <tr key={grade.grade_level_id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {grade.name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {grade.code}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {grade.level_number}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                                {grade.education_level.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                {grade.section_count || 0}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {grade.student_count || 0}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                grade.is_active
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {grade.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex items-center justify-end gap-2">
                                <button 
                                  onClick={() => handleEditGradeLevel({
                                    id: grade.grade_level_id,
                                    name: grade.name,
                                    code: grade.code,
                                    level_number: grade.level_number,
                                    education_level: grade.education_level,
                                    is_active: grade.is_active
                                  })}
                                  className="inline-flex items-center px-3 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-md transition-colors"
                                  title="Edit Grade Level"
                                >
                                  <i className="fas fa-edit mr-1.5"></i>
                                  Edit
                                </button>
                                <button 
                                  onClick={() => handleToggleGradeLevelActive(grade.grade_level_id, grade.is_active)}
                                  className={`inline-flex items-center px-3 py-1.5 rounded-md transition-colors ${
                                    grade.is_active
                                      ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                                  }`}
                                  title={grade.is_active ? 'Deactivate' : 'Activate'}
                                >
                                  <i className={`fas fa-${grade.is_active ? 'ban' : 'check-circle'} mr-1.5`}></i>
                                  {grade.is_active ? 'Deactivate' : 'Activate'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sections Tab */}
          <TabsContent value="sections">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Student Sections</CardTitle>
                  <Button onClick={handleAddSection}>
                    <i className="fas fa-plus mr-2"></i>
                    Add Section
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {sectionsError ? (
                  <div className="text-red-600">{sectionsError}</div>
                ) : sectionsLoading || !sections ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <div className="text-sm text-gray-600">Loading sections...</div>
                  </div>
                ) : sections.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <i className="fas fa-users text-4xl mb-3 text-gray-300"></i>
                    <p>No sections created yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Section Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Grade Level
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Strand
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Students
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {sections.map((section: any) => (
                          <tr key={section.section_id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {section.name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {section.grade_level?.name || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {section.strand ? (
                                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">
                                  {section.strand.abbreviation}
                                </span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <button 
                                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 hover:bg-blue-200"
                                onClick={() => router.push(`/library-users?section_id=${section.section_id}`)}
                              >
                                {section.student_count || 0}
                              </button>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                section.is_active
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {section.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex items-center justify-end gap-2">
                                <button 
                                  onClick={() => handleEditSection({
                                    id: section.section_id,
                                    name: section.name,
                                    grade_level_id: section.grade_level_id,
                                    strand_id: section.strand_id,
                                    is_active: section.is_active
                                  })}
                                  className="inline-flex items-center px-3 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-md transition-colors"
                                  title="Edit Section"
                                >
                                  <i className="fas fa-edit mr-1.5"></i>
                                  Edit
                                </button>
                                <button 
                                  onClick={() => handleToggleSectionActive(section.section_id, section.is_active)}
                                  className={`inline-flex items-center px-3 py-1.5 rounded-md transition-colors ${
                                    section.is_active
                                      ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                                  }`}
                                  title={section.is_active ? 'Deactivate' : 'Activate'}
                                >
                                  <i className={`fas fa-${section.is_active ? 'ban' : 'check-circle'} mr-1.5`}></i>
                                  {section.is_active ? 'Deactivate' : 'Activate'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals */}
      <StrandModal
        isOpen={strandModalOpen}
        onClose={() => {
          setStrandModalOpen(false)
          setEditingStrand(null)
        }}
        onSuccess={loadStrands}
        editData={editingStrand}
      />

      <GradeLevelModal
        isOpen={gradeLevelModalOpen}
        onClose={() => {
          setGradeLevelModalOpen(false)
          setEditingGradeLevel(null)
        }}
        onSuccess={loadGradeLevels}
        editData={editingGradeLevel}
      />

      <SectionModal
        isOpen={sectionModalOpen}
        onClose={() => {
          setSectionModalOpen(false)
          setEditingSection(null)
        }}
        onSuccess={loadSections}
        editData={editingSection}
      />
    </>
  )
}
