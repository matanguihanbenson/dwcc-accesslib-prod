'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import useSWR from 'swr'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json())

export default function StudentCategoriesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('sections')

  // Fetch all category data
  const { data: sections, error: sectionsError } = useSWR('/api/student-sections?limit=500', fetcher)
  const { data: programs, error: programsError } = useSWR('/api/programs?limit=500', fetcher)
  const { data: departments, error: departmentsError } = useSWR('/api/departments?limit=500', fetcher)
  const { data: gradeLevels, error: gradeLevelsError } = useSWR('/api/grade-levels?limit=500', fetcher)
  const { data: strands, error: strandsError } = useSWR('/api/strands?limit=500', fetcher)

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

  // Categories management is available to SUPER_ADMIN,
  // ADMIN, and STAFF — same access level as the rest of
  // the library-user management surface.
  if (
    userRole !== 'SUPER_ADMIN' &&
    userRole !== 'ADMIN' &&
    userRole !== 'STAFF'
  ) {
    return (
      <div className="px-6 py-4">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">You do not have permission to access this page.</p>
        </div>
      </div>
    )
  }

  // Parse API responses
  const sectionsList = Array.isArray(sections) ? sections : (sections?.data || [])
  const programsList = Array.isArray(programs) ? programs : (programs?.data || [])
  const departmentsList = Array.isArray(departments) ? departments : (departments?.data || [])
  const gradeLevelsList = Array.isArray(gradeLevels) ? gradeLevels : (gradeLevels?.data || [])
  const strandsList = Array.isArray(strands) ? strands : (strands?.data || [])

  const handleNavigateToUsers = (filterType: string, filterId: number) => {
    // Map filter type to category type for URL
    const typeMap: Record<string, string> = {
      'section_id': 'section',
      'program_id': 'program',
      'department_id': 'department',
      'grade_level_id': 'grade-level',
      'strand_id': 'strand'
    }
    const categoryType = typeMap[filterType]
    router.push(`/library-users/categories/${categoryType}/${filterId}`)
  }

  return (
    <>
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-800">Student Categories</h1>
              <nav className="flex items-center space-x-2 text-sm text-gray-500 mt-1">
                <button 
                  onClick={() => router.push('/library-users')}
                  className="hover:text-gray-700"
                >
                  Library Users
                </button>
                <i className="fas fa-chevron-right text-xs"></i>
                <span className="text-gray-900 font-medium">Categories</span>
              </nav>
            </div>
            <Button variant="outline" onClick={() => router.push('/library-users')}>
              <i className="fas fa-arrow-left mr-2"></i>
              Back to Users
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5 mb-6">
            <TabsTrigger value="sections">
              <i className="fas fa-users mr-2"></i>
              Sections ({sectionsList.length})
            </TabsTrigger>
            <TabsTrigger value="programs">
              <i className="fas fa-graduation-cap mr-2"></i>
              Programs ({programsList.length})
            </TabsTrigger>
            <TabsTrigger value="departments">
              <i className="fas fa-building mr-2"></i>
              Departments ({departmentsList.length})
            </TabsTrigger>
            <TabsTrigger value="gradeLevels">
              <i className="fas fa-layer-group mr-2"></i>
              Grade Levels ({gradeLevelsList.length})
            </TabsTrigger>
            <TabsTrigger value="strands">
              <i className="fas fa-bookmark mr-2"></i>
              Strands ({strandsList.length})
            </TabsTrigger>
          </TabsList>

          {/* Sections Tab */}
          <TabsContent value="sections">
            <Card>
              <CardHeader>
                <CardTitle>Student Sections</CardTitle>
              </CardHeader>
              <CardContent>
                {sectionsError ? (
                  <div className="text-red-600">Error loading sections</div>
                ) : !sections ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <div className="text-sm text-gray-600">Loading sections...</div>
                  </div>
                ) : sectionsList.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <i className="fas fa-users text-4xl mb-3 text-gray-300"></i>
                    <p>No sections found</p>
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
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Student Count
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {sectionsList.map((section: any) => {
                          const studentCount = section.student_count ?? section.user_count ?? section._count?.users ?? 0
                          return (
                            <tr 
                              key={section.section_id}
                              className={studentCount === 0 ? 'opacity-50' : 'hover:bg-gray-50'}
                            >
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {section.name}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {section.grade_level?.name || 'N/A'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {section.strand ? (
                                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">
                                    {section.strand.abbreviation || section.strand.code}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  studentCount > 0 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-500'
                                }`}>
                                  {studentCount}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <button 
                                  onClick={() => handleNavigateToUsers('section_id', section.section_id)}
                                  className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-sm"
                                  title="See Details"
                                  disabled={studentCount === 0}
                                >
                                  <i className="fas fa-eye mr-1.5"></i>
                                  View Details
                                </button>
                              </td>
                            </tr>
                          )
                        })}
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
                <CardTitle>Academic Programs</CardTitle>
              </CardHeader>
              <CardContent>
                {programsError ? (
                  <div className="text-red-600">Error loading programs</div>
                ) : !programs ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <div className="text-sm text-gray-600">Loading programs...</div>
                  </div>
                ) : programsList.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <i className="fas fa-graduation-cap text-4xl mb-3 text-gray-300"></i>
                    <p>No programs found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Program Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Code
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Department
                          </th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Student Count
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {programsList.map((program: any) => {
                          const studentCount = program.student_count ?? program.user_count ?? program._count?.users ?? 0
                          return (
                            <tr 
                              key={program.program_id}
                              className={studentCount === 0 ? 'opacity-50' : 'hover:bg-gray-50'}
                            >
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {program.name}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {program.code}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {program.department?.name || 'N/A'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  studentCount > 0 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-500'
                                }`}>
                                  {studentCount}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <button 
                                  onClick={() => handleNavigateToUsers('program_id', program.program_id)}
                                  className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-sm"
                                  title="See Details"
                                  disabled={studentCount === 0}
                                >
                                  <i className="fas fa-eye mr-1.5"></i>
                                  View Details
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Departments Tab */}
          <TabsContent value="departments">
            <Card>
              <CardHeader>
                <CardTitle>Academic Departments</CardTitle>
              </CardHeader>
              <CardContent>
                {departmentsError ? (
                  <div className="text-red-600">Error loading departments</div>
                ) : !departments ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <div className="text-sm text-gray-600">Loading departments...</div>
                  </div>
                ) : departmentsList.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <i className="fas fa-building text-4xl mb-3 text-gray-300"></i>
                    <p>No departments found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Department Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Code
                          </th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Student Count
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {departmentsList.map((dept: any) => {
                          const studentCount = dept.student_count ?? dept.user_count ?? dept._count?.users ?? 0
                          return (
                            <tr 
                              key={dept.department_id}
                              className={studentCount === 0 ? 'opacity-50' : 'hover:bg-gray-50'}
                            >
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {dept.name}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {dept.code}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  studentCount > 0 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-500'
                                }`}>
                                  {studentCount}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <button 
                                  onClick={() => handleNavigateToUsers('department_id', dept.department_id)}
                                  className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-sm"
                                  title="See Details"
                                  disabled={studentCount === 0}
                                >
                                  <i className="fas fa-eye mr-1.5"></i>
                                  View Details
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Grade Levels Tab */}
          <TabsContent value="gradeLevels">
            <Card>
              <CardHeader>
                <CardTitle>Grade Levels</CardTitle>
              </CardHeader>
              <CardContent>
                {gradeLevelsError ? (
                  <div className="text-red-600">Error loading grade levels</div>
                ) : !gradeLevels ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <div className="text-sm text-gray-600">Loading grade levels...</div>
                  </div>
                ) : gradeLevelsList.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <i className="fas fa-layer-group text-4xl mb-3 text-gray-300"></i>
                    <p>No grade levels found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Grade Level
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Code
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Education Level
                          </th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Student Count
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {gradeLevelsList.map((grade: any) => {
                          const studentCount = grade.student_count ?? grade.user_count ?? grade._count?.users ?? 0
                          
                          // Format education level label
                          const educationLevelLabels: Record<string, string> = {
                            'KINDERGARTEN': 'Kindergarten',
                            'ELEMENTARY': 'Elementary',
                            'JUNIOR_HIGH': 'Junior High',
                            'SENIOR_HIGH': 'Senior High',
                            'COLLEGE': 'College',
                            'GRADUATE_SCHOOL': 'Graduate School'
                          }
                          
                          const educationLevelColors: Record<string, string> = {
                            'KINDERGARTEN': 'bg-pink-100 text-pink-800',
                            'ELEMENTARY': 'bg-green-100 text-green-800',
                            'JUNIOR_HIGH': 'bg-blue-100 text-blue-800',
                            'SENIOR_HIGH': 'bg-purple-100 text-purple-800',
                            'COLLEGE': 'bg-indigo-100 text-indigo-800',
                            'GRADUATE_SCHOOL': 'bg-gray-100 text-gray-800'
                          }
                          
                          return (
                            <tr 
                              key={grade.grade_level_id}
                              className={studentCount === 0 ? 'opacity-50' : 'hover:bg-gray-50'}
                            >
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {grade.name}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {grade.code}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  educationLevelColors[grade.education_level] || 'bg-gray-100 text-gray-800'
                                }`}>
                                  {educationLevelLabels[grade.education_level] || grade.education_level}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  studentCount > 0 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-500'
                                }`}>
                                  {studentCount}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <button 
                                  onClick={() => handleNavigateToUsers('grade_level_id', grade.grade_level_id)}
                                  className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-sm"
                                  title="See Details"
                                  disabled={studentCount === 0}
                                >
                                  <i className="fas fa-eye mr-1.5"></i>
                                  View Details
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Strands Tab */}
          <TabsContent value="strands">
            <Card>
              <CardHeader>
                <CardTitle>Senior High School Strands</CardTitle>
              </CardHeader>
              <CardContent>
                {strandsError ? (
                  <div className="text-red-600">Error loading strands</div>
                ) : !strands ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <div className="text-sm text-gray-600">Loading strands...</div>
                  </div>
                ) : strandsList.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <i className="fas fa-bookmark text-4xl mb-3 text-gray-300"></i>
                    <p>No strands found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Strand Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Code
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Abbreviation
                          </th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Student Count
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {strandsList.map((strand: any) => {
                          const studentCount = strand.student_count ?? strand.user_count ?? strand._count?.users ?? 0
                          return (
                            <tr 
                              key={strand.strand_id}
                              className={studentCount === 0 ? 'opacity-50' : 'hover:bg-gray-50'}
                            >
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {strand.name}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {strand.code}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {strand.abbreviation || '—'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  studentCount > 0 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-500'
                                }`}>
                                  {studentCount}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <button 
                                  onClick={() => handleNavigateToUsers('strand_id', strand.strand_id)}
                                  className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-sm"
                                  title="See Details"
                                  disabled={studentCount === 0}
                                >
                                  <i className="fas fa-eye mr-1.5"></i>
                                  View Details
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
