'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { notify } from '@/lib/notification'
import DepartmentModal from '@/components/modals/DepartmentModal'
import ProgramModal from '@/components/modals/ProgramModal'
import GradeLevelModal from '@/components/modals/GradeLevelModal'

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

export default function CollegePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('departments')

  const [departments, setDepartments] = useState<any[] | null>(null)
  const [programs, setPrograms] = useState<any[] | null>(null)
  const [gradeLevels, setGradeLevels] = useState<any[] | null>(null)

  const [departmentsError, setDepartmentsError] = useState<string | null>(null)
  const [programsError, setProgramsError] = useState<string | null>(null)
  const [gradeLevelsError, setGradeLevelsError] = useState<string | null>(null)

  const [departmentsLoading, setDepartmentsLoading] = useState(false)
  const [programsLoading, setProgramsLoading] = useState(false)
  const [gradeLevelsLoading, setGradeLevelsLoading] = useState(false)

  // Modal states
  const [departmentModalOpen, setDepartmentModalOpen] = useState(false)
  const [programModalOpen, setProgramModalOpen] = useState(false)
  const [gradeLevelModalOpen, setGradeLevelModalOpen] = useState(false)

  const [editingDepartment, setEditingDepartment] = useState<any>(null)
  const [editingProgram, setEditingProgram] = useState<any>(null)
  const [editingGradeLevel, setEditingGradeLevel] = useState<any>(null)

  const loadDepartments = async () => {
    try {
      setDepartmentsLoading(true)
      setDepartmentsError(null)
      const res = await fetchJson<any>('/api/departments')
      const data = res?.data || (Array.isArray(res) ? res : [])
      setDepartments(data)
    } catch (error) {
      setDepartments([])
      setDepartmentsError(error instanceof Error ? error.message : 'Failed to load departments')
    } finally {
      setDepartmentsLoading(false)
    }
  }

  const loadPrograms = async () => {
    try {
      setProgramsLoading(true)
      setProgramsError(null)
      const res = await fetchJson<any>('/api/programs')
      const data = res?.data || (Array.isArray(res) ? res : [])
      setPrograms(data)
    } catch (error) {
      setPrograms([])
      setProgramsError(error instanceof Error ? error.message : 'Failed to load programs')
    } finally {
      setProgramsLoading(false)
    }
  }

  const loadGradeLevels = async () => {
    try {
      setGradeLevelsLoading(true)
      setGradeLevelsError(null)
      const data = await fetchJson<any[]>('/api/grade-levels?education_level=COLLEGE')
      setGradeLevels(data)
    } catch (error) {
      setGradeLevels([])
      setGradeLevelsError(error instanceof Error ? error.message : 'Failed to load grade levels')
    } finally {
      setGradeLevelsLoading(false)
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
    loadDepartments()
    loadPrograms()
    loadGradeLevels()
  }, [])

  // Department handlers
  const handleAddDepartment = () => {
    setEditingDepartment(null)
    setDepartmentModalOpen(true)
  }

  const handleEditDepartment = (dept: any) => {
    setEditingDepartment({
      id: dept.department_id,
      name: dept.name,
      code: dept.code,
      description: dept.description,
      is_active: dept.is_active
    })
    setDepartmentModalOpen(true)
  }

  const handleToggleDepartmentActive = async (id: number, currentStatus: boolean) => {
    const action = currentStatus ? 'deactivate' : 'activate'
    const confirmed = await notify.confirm(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Department`,
      `Are you sure you want to ${action} this department?`
    )
    if (!confirmed) return

    try {
      const response = await fetch(`/api/departments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_active: !currentStatus })
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || `Failed to ${action} department`)
      }

      await notify.success('Success', `Department ${action}d successfully`)
      await loadDepartments()
    } catch (error) {
      await notify.error('Error', error instanceof Error ? error.message : `Failed to ${action} department`)
    }
  }

  // Program handlers
  const handleAddProgram = () => {
    setEditingProgram(null)
    setProgramModalOpen(true)
  }

  const handleEditProgram = (prog: any) => {
    setEditingProgram({
      id: prog.program_id,
      name: prog.name,
      code: prog.code,
      description: prog.description,
      department_id: prog.department_id,
      is_active: prog.is_active
    })
    setProgramModalOpen(true)
  }

  const handleToggleProgramActive = async (id: number, currentStatus: boolean) => {
    const action = currentStatus ? 'deactivate' : 'activate'
    const confirmed = await notify.confirm(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Program`,
      `Are you sure you want to ${action} this program?`
    )
    if (!confirmed) return

    try {
      const response = await fetch(`/api/programs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_active: !currentStatus })
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || `Failed to ${action} program`)
      }

      await notify.success('Success', `Program ${action}d successfully`)
      await loadPrograms()
    } catch (error) {
      await notify.error('Error', error instanceof Error ? error.message : `Failed to ${action} program`)
    }
  }

  // Grade level handlers
  const handleAddGradeLevel = () => {
    setEditingGradeLevel(null)
    setGradeLevelModalOpen(true)
  }

  const handleEditGradeLevel = (grade: any) => {
    setEditingGradeLevel({
      id: grade.grade_level_id,
      name: grade.name,
      code: grade.code,
      level_number: grade.level_number,
      education_level: grade.education_level,
      is_active: grade.is_active
    })
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

  const activeDepartments = departments?.filter((d: any) => d.is_active) || []

  return (
    <>
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-800">College Campus Management</h1>
              <nav className="flex items-center space-x-2 text-sm text-gray-500 mt-1">
                <span>Administration</span>
                <i className="fas fa-chevron-right text-xs"></i>
                <span className="text-gray-900 font-medium">College</span>
              </nav>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                className='bg-gray-100 h-[50px] px-4 hover:bg-gray-200'
                onClick={() => router.push('/library-users/categories')}
                title="Browse users by section, program, department, grade level, or strand"
              >
                <i className="fas fa-th-large mr-2" />
                View Categories
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="py-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="departments">
              <i className="fas fa-building mr-2"></i>
              Departments
            </TabsTrigger>
            <TabsTrigger value="programs">
              <i className="fas fa-graduation-cap mr-2"></i>
              Programs
            </TabsTrigger>
            <TabsTrigger value="grades">
              <i className="fas fa-layer-group mr-2"></i>
              Grade Levels
            </TabsTrigger>
          </TabsList>

          {/* Departments Tab */}
          <TabsContent value="departments">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Departments</CardTitle>
                  <Button onClick={handleAddDepartment} className="bg-primary-600 px-4 py-5 text-white hover:bg-primary-700 mb-2">
                    <i className="fas fa-plus mr-2"></i>
                    Add Department
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {departmentsError ? (
                  <div className="text-red-600">{departmentsError}</div>
                ) : departmentsLoading || !departments ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <div className="text-sm text-gray-600">Loading departments...</div>
                  </div>
                ) : departments.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <i className="fas fa-building text-4xl mb-3 text-gray-300"></i>
                    <p>No departments created yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Programs</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Users</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {departments.map((dept: any) => (
                          <tr key={dept.department_id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{dept.name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{dept.code}</td>
                            <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{dept.description || '—'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                {dept.programs?.length || 0}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {dept.user_count || 0}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${dept.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                {dept.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex items-center justify-end gap-2">
                                <button onClick={() => handleEditDepartment(dept)} className="inline-flex items-center px-3 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-md transition-colors" title="Edit">
                                  <i className="fas fa-edit mr-1.5"></i>Edit
                                </button>
                                <button onClick={() => handleToggleDepartmentActive(dept.department_id, dept.is_active)} className={`inline-flex items-center px-3 py-1.5 rounded-md transition-colors ${dept.is_active ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`} title={dept.is_active ? 'Deactivate' : 'Activate'}>
                                  <i className={`fas fa-${dept.is_active ? 'ban' : 'check-circle'} mr-1.5`}></i>{dept.is_active ? 'Deactivate' : 'Activate'}
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

          {/* Programs Tab */}
          <TabsContent value="programs">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Programs</CardTitle>
                  <Button onClick={handleAddProgram} className="bg-primary-600 px-4 py-5 text-white hover:bg-primary-700 mb-2">
                    <i className="fas fa-plus mr-2"></i>
                    Add Program
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {programsError ? (
                  <div className="text-red-600">{programsError}</div>
                ) : programsLoading || !programs ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <div className="text-sm text-gray-600">Loading programs...</div>
                  </div>
                ) : programs.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <i className="fas fa-graduation-cap text-4xl mb-3 text-gray-300"></i>
                    <p>No programs created yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Users</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {programs.map((prog: any) => (
                          <tr key={prog.program_id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{prog.name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{prog.code}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {prog.department ? (
                                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                                  {prog.department.name}
                                </span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {prog.user_count || 0}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${prog.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                {prog.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex items-center justify-end gap-2">
                                <button onClick={() => handleEditProgram(prog)} className="inline-flex items-center px-3 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-md transition-colors" title="Edit">
                                  <i className="fas fa-edit mr-1.5"></i>Edit
                                </button>
                                <button onClick={() => handleToggleProgramActive(prog.program_id, prog.is_active)} className={`inline-flex items-center px-3 py-1.5 rounded-md transition-colors ${prog.is_active ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`} title={prog.is_active ? 'Deactivate' : 'Activate'}>
                                  <i className={`fas fa-${prog.is_active ? 'ban' : 'check-circle'} mr-1.5`}></i>{prog.is_active ? 'Deactivate' : 'Activate'}
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
                  <CardTitle>College Grade Levels</CardTitle>
                  <Button onClick={handleAddGradeLevel} className="bg-primary-600 px-4 py-5 text-white hover:bg-primary-700 mb-2">
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
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Level</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sections</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Students</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {gradeLevels.map((grade: any) => (
                          <tr key={grade.grade_level_id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{grade.name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{grade.code}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{grade.level_number}</td>
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
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${grade.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                {grade.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex items-center justify-end gap-2">
                                <button onClick={() => handleEditGradeLevel(grade)} className="inline-flex items-center px-3 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-md transition-colors" title="Edit">
                                  <i className="fas fa-edit mr-1.5"></i>Edit
                                </button>
                                <button onClick={() => handleToggleGradeLevelActive(grade.grade_level_id, grade.is_active)} className={`inline-flex items-center px-3 py-1.5 rounded-md transition-colors ${grade.is_active ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`} title={grade.is_active ? 'Deactivate' : 'Activate'}>
                                  <i className={`fas fa-${grade.is_active ? 'ban' : 'check-circle'} mr-1.5`}></i>{grade.is_active ? 'Deactivate' : 'Activate'}
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
      <DepartmentModal
        isOpen={departmentModalOpen}
        onClose={() => {
          setDepartmentModalOpen(false)
          setEditingDepartment(null)
        }}
        onSuccess={loadDepartments}
        editData={editingDepartment}
      />

      <ProgramModal
        isOpen={programModalOpen}
        onClose={() => {
          setProgramModalOpen(false)
          setEditingProgram(null)
        }}
        onSuccess={loadPrograms}
        departments={activeDepartments}
        editData={editingProgram}
      />

      <GradeLevelModal
        isOpen={gradeLevelModalOpen}
        onClose={() => {
          setGradeLevelModalOpen(false)
          setEditingGradeLevel(null)
        }}
        onSuccess={loadGradeLevels}
        defaultEducationLevel="COLLEGE"
        editData={editingGradeLevel}
      />
    </>
  )
}
