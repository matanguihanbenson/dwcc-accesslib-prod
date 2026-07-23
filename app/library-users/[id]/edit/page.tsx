'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { UserRole, UserType, UserStatus } from '@/types'
import { notify } from '@/lib/notification'

interface LibraryUser {
  user_id: number
  account_id: string
  first_name: string
  last_name: string
  middle_name?: string
  suffix?: string
  full_name: string
  user_type: UserType
  // 'BASIC_EDUCATION' | 'COLLEGE' | ''. Only meaningful
  // when user_type === 'STUDENT'.
  student_category?: 'BASIC_EDUCATION' | 'COLLEGE' | '' | null
  // EducationLevel enum value (only for Basic Ed students).
  // One of KINDERGARTEN | ELEMENTARY | JUNIOR_HIGH |
  // SENIOR_HIGH. COLLEGE / GRADUATE_SCHOOL are stored
  // on the user row when the user_type is STUDENT +
  // student_category COLLEGE, but the add/edit form
  // doesn't expose a separate "education level" picker
  // for college students.
  education_level?:
    | 'KINDERGARTEN'
    | 'ELEMENTARY'
    | 'JUNIOR_HIGH'
    | 'SENIOR_HIGH'
    | 'COLLEGE'
    | 'GRADUATE_SCHOOL'
    | null
  department_id?: number
  program_id?: number
  office_id?: number
  grade_level_id?: number
  section_id?: number
  strand_id?: number
  year_level?: string
  email?: string
  contact_number?: string
  purpose?: string
  status: UserStatus
  created_at: string
  updated_at: string
}

interface Department {
  department_id: number
  name: string
  code: string
  is_active: boolean
}

interface Program {
  program_id: number
  name: string
  code: string
  is_active: boolean
}

interface Office {
  office_id: number
  name: string
  code: string
  is_active: boolean
}

interface GradeLevel {
  grade_level_id: number
  name: string
  code: string
  level_number: number
  education_level: string
}

interface Section {
  section_id: number
  name: string
  grade_level_id: number
}

interface Strand {
  strand_id: number
  name: string
  grade_level_id: number
}

const showErrorAlert = (title: string, message: string) => notify.error(title, message)
const showSuccessAlert = (title: string, message: string) => notify.success(title, message)
const showLoadingAlert = (title: string) => notify.loading(title)

export default function EditLibraryUserPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const userId = params.id as string

  const [user, setUser] = useState<LibraryUser | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [offices, setOffices] = useState<Office[]>([])
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([])
  const [collegeGradeLevels, setCollegeGradeLevels] = useState<GradeLevel[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [strands, setStrands] = useState<Strand[]>([])
  const [loading, setLoading] = useState(true)
  const [authReady, setAuthReady] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [checkingAccountId, setCheckingAccountId] = useState(false)
  const [accountIdStatus, setAccountIdStatus] = useState<
    'idle' | 'checking' | 'available' | 'taken'
  >('idle')
  const accountIdCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    middle_name: '',
    suffix: '',
    account_id: '',
    user_type: 'STUDENT' as UserType,
    student_category: '',
    basic_ed_level: '',
    department_id: '',
    program_id: '',
    office_id: '',
    grade_level_id: '',
    section_id: '',
    strand_id: '',
    email: '',
    contact_number: '',
    purpose: '',
    status: 'ACTIVE' as UserStatus
  })

  useEffect(() => {
    const checkAuth = async () => {
      if (status === 'loading') {
        return
      }

      if (!session) {
        router.push('/login')
        return
      }

      const userRole = session.user.role as UserRole
      if (
        userRole !== UserRole.SUPER_ADMIN &&
        userRole !== UserRole.ADMIN &&
        userRole !== UserRole.STAFF
      ) {
        router.push('/dashboard')
        return
      }

      setAuthReady(true)
    }

    checkAuth()
  }, [session, status, router])

  useEffect(() => {
    if (authReady && userId) {
      fetchUser()
      fetchDepartments()
      fetchOffices()
      fetchCollegeGradeLevels()
    }
  }, [authReady, userId])

  const fetchUser = async () => {
    try {
      setLoading(true)

      const response = await fetch(`/api/library-users/${userId}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const data = await response.json()
        const userData = data.data
        setUser(userData)
        populateFromUser(userData)
      } else if (response.status === 404) {
        router.push('/library-users')
        return
      } else {
        console.error('Failed to fetch user:', response.status)
        showErrorAlert('Error', 'Failed to fetch user details')
      }
    } catch (error) {
      console.error('Error fetching user:', error)
      showErrorAlert('Error', 'Error fetching user details')
    } finally {
      setLoading(false)
    }
  }

  const populateFromUser = (userData: any) => {
    // Compute the student_category from the user row so
    // the add/edit form's "Basic Ed / College" radio
    // reflects the persisted state. College / Graduate
    // School are mapped to 'COLLEGE'; everything else
    // (or no education_level) is treated as Basic Ed.
    const isStudent = userData.user_type === 'STUDENT'
    const isCollege = isStudent && (
      userData.education_level === 'COLLEGE' ||
      userData.education_level === 'GRADUATE_SCHOOL' ||
      (userData.department_id != null && userData.grade_level_id == null)
    )

    // Pull Basic Ed fields. For College students, the
    // Basic Ed fields stay empty so the "Basic Ed"
    // section collapses in the UI.
    const isBasicEd = isStudent && !isCollege

    setFormData({
      first_name: userData.first_name || '',
      last_name: userData.last_name || '',
      middle_name: userData.middle_name || '',
      suffix: userData.suffix || '',
      account_id: userData.account_id,
      user_type: userData.user_type,
      student_category: isStudent
        ? (isCollege ? 'COLLEGE' : 'BASIC_EDUCATION')
        : '',
      basic_ed_level: isBasicEd
        ? (userData.education_level || '')
        : '',
      department_id: userData.department_id
        ? userData.department_id.toString()
        : '',
      program_id: userData.program_id
        ? userData.program_id.toString()
        : '',
      office_id: userData.office_id
        ? userData.office_id.toString()
        : '',
      grade_level_id: userData.grade_level_id
        ? userData.grade_level_id.toString()
        : '',
      section_id: userData.section_id
        ? userData.section_id.toString()
        : '',
      strand_id: userData.strand_id
        ? userData.strand_id.toString()
        : '',
      email: userData.email || '',
      contact_number: userData.contact_number || '',
      purpose: userData.purpose || '',
      status: userData.status
    })

    // Pre-fetch the lookup-table lists for the persisted
    // values so the cascading selects (programs by
    // department, sections by grade_level / strand,
    // grade_levels by education_level) all populate.
    if (userData.department_id) {
      fetchPrograms(userData.department_id.toString())
    }
    if (userData.grade_level_id) {
      const glId = userData.grade_level_id.toString()
      if (userData.education_level) {
        fetchGradeLevels(userData.education_level)
      }
      // If the persisted education_level is a Senior
      // High strand-bearing level, also fetch strands.
      if (userData.education_level === 'SENIOR_HIGH' && userData.strand_id) {
        fetchStrands()
        // Defer section fetch until strands are loaded
        // (the form re-renders after the strands effect
        // and the strand id then drives section fetch).
      }
      // If a strand is already set, fetch sections
      // directly.
      if (userData.strand_id) {
        fetchSections(glId, userData.strand_id.toString())
      } else {
        // Try to fetch sections anyway — they'll be empty
        // for non-SENIOR_HIGH levels but it doesn't hurt.
        fetchSections(glId)
      }
    }
  }

  const fetchDepartments = async () => {
    try {
      const response = await fetch('/api/departments', {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
      if (response.ok) {
        const data = await response.json()
        setDepartments(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching departments:', error)
    }
  }

  const fetchPrograms = async (departmentId: string) => {
    try {
      const response = await fetch(
        `/api/programs?departmentId=${departmentId}`,
        {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        }
      )
      if (response.ok) {
        const data = await response.json()
        setPrograms(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching programs:', error)
    }
  }

  const fetchOffices = async () => {
    try {
      const response = await fetch('/api/offices', {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
      if (response.ok) {
        const data = await response.json()
        setOffices(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching offices:', error)
    }
  }

  const fetchCollegeGradeLevels = async () => {
    try {
      const response = await fetch('/api/grade-levels?education_level=COLLEGE', {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
      if (response.ok) {
        const data = await response.json()
        const list: GradeLevel[] = Array.isArray(data) ? data : (data?.data || [])
        setCollegeGradeLevels(list)
      }
    } catch (error) {
      console.error('Error fetching college grade levels:', error)
    }
  }

  const fetchGradeLevels = async (educationLevel: string) => {
    try {
      const response = await fetch(
        `/api/grade-levels?education_level=${encodeURIComponent(educationLevel)}`,
        {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        }
      )
      if (response.ok) {
        const data = await response.json()
        // API returns either a raw array or a wrapped
        // { data: [...] } envelope. Normalise here so the
        // rest of the form doesn't have to care.
        const list: GradeLevel[] = Array.isArray(data)
          ? data
          : (data?.data || [])
        setGradeLevels(list)
      } else {
        setGradeLevels([])
      }
    } catch (error) {
      console.error('Error fetching grade levels:', error)
      setGradeLevels([])
    }
  }

  const fetchSections = async (gradeLevelId: string, strandId?: string) => {
    try {
      let url = `/api/student-sections?grade_level_id=${gradeLevelId}`
      if (strandId) {
        url += `&strand_id=${strandId}`
      }
      const response = await fetch(url, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
      if (response.ok) {
        const data = await response.json()
        const list: Section[] = Array.isArray(data)
          ? data
          : (data?.data || [])
        setSections(list)
      } else {
        setSections([])
      }
    } catch (error) {
      console.error('Error fetching sections:', error)
      setSections([])
    }
  }

  const fetchStrands = async () => {
    try {
      const response = await fetch('/api/strands?limit=500', {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
      if (response.ok) {
        const data = await response.json()
        const list: Strand[] = Array.isArray(data)
          ? data
          : (data?.data || [])
        setStrands(list)
      } else {
        setStrands([])
      }
    } catch (error) {
      console.error('Error fetching strands:', error)
      setStrands([])
    }
  }

  // Auto-fetch grade levels when the Basic Ed education
  // level changes.
  useEffect(() => {
    if (formData.basic_ed_level) {
      fetchGradeLevels(formData.basic_ed_level)
    } else {
      setGradeLevels([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.basic_ed_level])

  // Auto-fetch programs when the department changes.
  useEffect(() => {
    if (formData.department_id) {
      fetchPrograms(formData.department_id)
    } else {
      setPrograms([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.department_id])

  // Senior-High grade levels expose a strand picker.
  // We re-derive the selected grade's `education_level`
  // from the just-loaded `gradeLevels` array.
  useEffect(() => {
    const selectedGrade = gradeLevels.find(
      (g) => g.grade_level_id.toString() === formData.grade_level_id.toString()
    )
    if (selectedGrade && selectedGrade.education_level === 'SENIOR_HIGH') {
      fetchStrands()
    } else {
      setStrands([])
      setFormData((prev) => ({ ...prev, strand_id: '' }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.grade_level_id, gradeLevels])

  // Once both the strand and the grade level are set
  // (and the grade is Senior-High), fetch the sections
  // for that grade + strand.
  useEffect(() => {
    if (formData.grade_level_id) {
      const selectedGrade = gradeLevels.find(
        (g) => g.grade_level_id.toString() === formData.grade_level_id.toString()
      )
      if (selectedGrade && selectedGrade.education_level === 'SENIOR_HIGH') {
        if (formData.strand_id) {
          fetchSections(formData.grade_level_id, formData.strand_id)
        } else {
          setSections([])
        }
      } else {
        // For non-SENIOR_HIGH grade levels the section
        // picker is still useful, so fetch sections
        // unfiltered by strand.
        fetchSections(formData.grade_level_id)
      }
    } else {
      setSections([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.grade_level_id, formData.strand_id, gradeLevels])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.first_name.trim() || !formData.last_name.trim() || !formData.account_id.trim()) {
      showErrorAlert('Error', 'First name, last name, and ID number are required')
      return
    }

    try {
      setSubmitting(true)
      showLoadingAlert('Updating user...')

      const response = await fetch(`/api/library-users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          // Numeric FKs are sent as numbers, not strings,
          // and "" → null so the server can clear the
          // field when the admin changes a student's
          // category (e.g. Basic Ed → College clears the
          // grade_level_id / section_id / strand_id, and
          // the college department_id / program_id are
          // re-asserted).
          department_id: formData.department_id
            ? parseInt(formData.department_id)
            : null,
          program_id: formData.program_id
            ? parseInt(formData.program_id)
            : null,
          office_id: formData.office_id
            ? parseInt(formData.office_id)
            : null,
          grade_level_id: formData.grade_level_id
            ? parseInt(formData.grade_level_id)
            : null,
          section_id: formData.section_id
            ? parseInt(formData.section_id)
            : null,
          strand_id: formData.strand_id
            ? parseInt(formData.strand_id)
            : null
        }),
      })

      if (response.ok) {
        notify.close()
        showSuccessAlert('Success', 'User updated successfully')
        router.push(`/library-users/${userId}`)
      } else {
        const errorData = await response.json()
        notify.close()
        showErrorAlert('Error', errorData.error || 'Failed to update user')
      }
    } catch (error) {
      console.error('Error updating user:', error)
      notify.close()
      showErrorAlert('Error', 'Network error occurred while updating user')
    } finally {
      setSubmitting(false)
    }
  }

  const capitalizeWords = (str: string): string => {
    if (!str) return ''
    return str
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => {
      let processedValue = value
      if (field === 'first_name' || field === 'middle_name' || field === 'last_name' || field === 'suffix') {
        processedValue = capitalizeWords(value)
      }

      const next = { ...prev, [field]: processedValue }

      // Cascading resets when the student_category flips
      // between Basic Ed and College, so we don't end up
      // persisting grade-level data on a college student
      // (or vice versa).
      if (field === 'student_category') {
        if (value === 'BASIC_EDUCATION') {
          next.department_id = ''
          next.program_id = ''
        } else if (value === 'COLLEGE') {
          next.basic_ed_level = ''
          next.grade_level_id = ''
          next.section_id = ''
          next.strand_id = ''
        }
      }
      if (field === 'basic_ed_level') {
        next.grade_level_id = ''
        next.section_id = ''
        next.strand_id = ''
      }
      if (field === 'grade_level_id') {
        next.section_id = ''
        next.strand_id = ''
      }
      if (field === 'strand_id') {
        next.section_id = ''
      }
      if (field === 'department_id') {
        if (value) {
          fetchPrograms(value)
        } else {
          setPrograms([])
        }
        next.program_id = ''
      }
      if (field === 'user_type') {
        // Reset all student-specific fields so the
        // form collapses cleanly when the user type
        // changes (e.g. Student → Employee).
        next.student_category = ''
        next.basic_ed_level = ''
        next.department_id = ''
        next.program_id = ''
        next.grade_level_id = ''
        next.section_id = ''
        next.strand_id = ''
        next.office_id = ''
      }
      return next
    })
  }

  if (!authReady) {
    return (
      <div className="px-6 py-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <div className="text-sm text-gray-600">Checking authentication...</div>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="px-6 py-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <div className="text-sm text-gray-600">Loading user details...</div>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="px-6 py-4">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900">User Not Found</h1>
          <p className="text-gray-600 mt-2">The user you're looking for doesn't exist.</p>
          <Button onClick={() => router.push('/library-users')} className="mt-4">
            Back to Library Users
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.back()}
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                <i className="fas fa-arrow-left text-lg"></i>
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-800">
                  Edit User
                </h1>
                <nav className="flex items-center space-x-2 text-sm text-gray-500 mt-1">
                  <span>Library Users</span>
                  <i className="fas fa-chevron-right text-xs"></i>
                  <span>{user.full_name}</span>
                  <i className="fas fa-chevron-right text-xs"></i>
                  <span className="text-gray-900 font-medium">Edit</span>
                </nav>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="py-4">
        <Card>
          <CardHeader>
            <CardTitle>Edit User Information</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={formData.first_name}
                    onChange={(e) => handleInputChange('first_name', e.target.value)}
                    placeholder="Enter first name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    value={formData.last_name}
                    onChange={(e) => handleInputChange('last_name', e.target.value)}
                    placeholder="Enter last name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Middle Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.middle_name}
                    onChange={(e) => handleInputChange('middle_name', e.target.value)}
                    placeholder="Enter middle name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Suffix (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.suffix}
                    onChange={(e) => handleInputChange('suffix', e.target.value)}
                    placeholder="Jr., Sr., III, etc."
                    maxLength={10}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ID Number *
                  </label>
                  <input
                    type="text"
                    value={formData.account_id}
                    readOnly
                    placeholder="ID number (read-only)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-700 cursor-not-allowed"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={formData.status}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="SUSPENDED">Suspended</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    User Type *
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-100"
                    value={formData.user_type}
                    onChange={(e) => handleInputChange('user_type', e.target.value)}
                    disabled
                    required
                  >
                    <option value="STUDENT">Student</option>
                    <option value="EMPLOYEE">Employee</option>
                    <option value="ALUMNI">Alumni</option>
                    <option value="GUEST">Guest</option>
                  </select>
                </div>
              </div>

              {formData.user_type === 'STUDENT' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Student Category <span className="text-red-500">*</span>
                      </label>
                      <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={formData.student_category}
                        onChange={(e) => handleInputChange('student_category', e.target.value)}
                        required
                      >
                        <option value="">Select Category</option>
                        <option value="BASIC_EDUCATION">Basic Education</option>
                        <option value="COLLEGE">College</option>
                      </select>
                    </div>

                    {formData.student_category === 'BASIC_EDUCATION' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Education Level <span className="text-red-500">*</span>
                        </label>
                        <select
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          value={formData.basic_ed_level}
                          onChange={(e) => handleInputChange('basic_ed_level', e.target.value)}
                          required
                        >
                          <option value="">Select Education Level</option>
                          <option value="KINDERGARTEN">Kindergarten</option>
                          <option value="ELEMENTARY">Elementary</option>
                          <option value="JUNIOR_HIGH">Junior High School</option>
                          <option value="SENIOR_HIGH">Senior High School</option>
                        </select>
                      </div>
                    )}

                    {formData.student_category === 'COLLEGE' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Year Level <span className="text-red-500">*</span>
                        </label>
                        <select
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          value={formData.grade_level_id}
                          onChange={(e) => handleInputChange('grade_level_id', e.target.value)}
                          required
                        >
                          <option value="">Select Year Level</option>
                          {collegeGradeLevels.map((grade) => (
                            <option key={grade.grade_level_id} value={grade.grade_level_id}>
                              {grade.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {formData.student_category === 'BASIC_EDUCATION' && formData.basic_ed_level && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Grade Level <span className="text-red-500">*</span>
                        </label>
                        {gradeLevels.length === 0 ? (
                          <div className="w-full px-3 py-2 border border-amber-200 bg-amber-50 rounded-md text-sm text-amber-800 flex items-start gap-2">
                            <i className="fas fa-info-circle mt-0.5"></i>
                            <div>
                              <div className="font-medium">No grade levels configured for this education level.</div>
                              <div className="text-xs mt-1 text-amber-700">
                                Run <code className="font-mono bg-amber-100 px-1 rounded">node scripts/seed-grade-levels.js</code> to populate the standard K–12 grade levels, then refresh this page.
                              </div>
                            </div>
                          </div>
                        ) : (
                          <select
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            value={formData.grade_level_id}
                            onChange={(e) => handleInputChange('grade_level_id', e.target.value)}
                            required
                          >
                            <option value="">Select Grade Level</option>
                            {gradeLevels.map((grade) => (
                              <option key={grade.grade_level_id} value={grade.grade_level_id}>
                                {grade.name} ({grade.code})
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      {(() => {
                        const selectedGrade = gradeLevels.find(
                          (g) => g.grade_level_id.toString() === formData.grade_level_id.toString()
                        )
                        if (selectedGrade && selectedGrade.education_level === 'SENIOR_HIGH') {
                          return (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Strand <span className="text-red-500">*</span>
                              </label>
                              <select
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                value={formData.strand_id}
                                onChange={(e) => handleInputChange('strand_id', e.target.value)}
                                required
                              >
                                <option value="">Select Strand</option>
                                {strands.map((strand) => (
                                  <option key={strand.strand_id} value={strand.strand_id}>
                                    {strand.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )
                        }
                        return null
                      })()}

                      {(() => {
                        const selectedGrade = gradeLevels.find(
                          (g) => g.grade_level_id.toString() === formData.grade_level_id.toString()
                        )
                        if (selectedGrade && selectedGrade.education_level === 'SENIOR_HIGH' && formData.strand_id) {
                          return (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Section <span className="text-red-500">*</span>
                              </label>
                              <select
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                value={formData.section_id}
                                onChange={(e) => handleInputChange('section_id', e.target.value)}
                                required
                              >
                                <option value="">Select Section</option>
                                {sections.map((sec) => (
                                  <option key={sec.section_id} value={sec.section_id}>
                                    {sec.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )
                        }
                        if (selectedGrade && selectedGrade.education_level !== 'SENIOR_HIGH') {
                          return (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Section <span className="text-red-500">*</span>
                              </label>
                              <select
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                value={formData.section_id}
                                onChange={(e) => handleInputChange('section_id', e.target.value)}
                                required
                              >
                                <option value="">Select Section</option>
                                {sections.map((sec) => (
                                  <option key={sec.section_id} value={sec.section_id}>
                                    {sec.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )
                        }
                        return null
                      })()}
                    </div>
                  )}
                </div>
              )}

              {formData.user_type === 'EMPLOYEE' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Office
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={formData.office_id}
                      onChange={(e) => handleInputChange('office_id', e.target.value)}
                    >
                      <option value="">Select Office</option>
                      {offices.map((office) => (
                        <option key={office.office_id} value={office.office_id}>
                          {office.name} ({office.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Department
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={formData.department_id}
                    onChange={(e) => handleInputChange('department_id', e.target.value)}
                    disabled={formData.student_category === 'BASIC_EDUCATION'}
                  >
                    <option value="">Select Department</option>
                    {departments.map((dept) => (
                      <option key={dept.department_id} value={dept.department_id}>
                        {dept.name} ({dept.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Program
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={formData.program_id}
                    onChange={(e) => handleInputChange('program_id', e.target.value)}
                    disabled={!formData.department_id}
                  >
                    <option value="">Select Program</option>
                    {programs.map((prog) => (
                      <option key={prog.program_id} value={prog.program_id}>
                        {prog.name} ({prog.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="Enter email address"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Number
                  </label>
                  <input
                    type="tel"
                    value={formData.contact_number}
                    onChange={(e) => {
                      const value = e.target.value
                      if (value === '' || /^[0-9]+$/.test(value)) {
                        handleInputChange('contact_number', value)
                      }
                    }}
                    placeholder="Enter contact number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Purpose
                </label>
                <input
                  type="text"
                  value={formData.purpose}
                  onChange={(e) => handleInputChange('purpose', e.target.value)}
                  placeholder="Enter purpose"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Submit Button */}
              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className='py-5 px-4 bg-gray-200 hover:bg-gray-300'
                  onClick={() => router.back()}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting} className='py-5 px-4 bg-primary-600 text-white hover:bg-primary-700'>
                  {submitting ? 'Updating...' : 'Update User'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
