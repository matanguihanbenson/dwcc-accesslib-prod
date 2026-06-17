'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface EnhancedBookFormProps {
  onSubmit: (data: any) => Promise<void>
  onCancel?: () => void
  loading?: boolean
  initialData?: Partial<any>
  categories?: { category_id: number; name: string }[]
  sections?: { section_id: number; name: string }[]
  isEditing?: boolean
}

type TabType = 'brief' | 'details' | 'series' | 'resources' | 'entries'

export function EnhancedBookForm({ 
  onSubmit, 
  onCancel, 
  loading = false, 
  initialData, 
  categories: propCategories, 
  sections: propSections, 
  isEditing = false 
}: EnhancedBookFormProps) {
  const [activeTab, setActiveTab] = useState<TabType>('brief')
  
  // Helper function to convert null to empty string or appropriate default
  const sanitizeValue = (key: string, value: any): any => {
    // Handle array fields specially
    const arrayFields = ['notes', 'links', 'coAuthors', 'digitalContent', 'contributors', 'authors', 'alternate_titles']
    if (arrayFields.includes(key)) {
      if (Array.isArray(value)) return value
      if (typeof value === 'string' && value.startsWith('[')) {
        try {
          return JSON.parse(value)
        } catch {
          return []
        }
      }
      return []
    }
    
    // Handle null/undefined
    if (value === null || value === undefined) return ''
    
    // Return as-is for valid values
    return value
  }
  
  // Sanitize initialData to convert null values to empty strings and parse arrays
  const sanitizedInitialData = initialData ? Object.keys(initialData).reduce((acc, key) => {
    acc[key] = sanitizeValue(key, initialData[key])
    return acc
  }, {} as any) : {}
  
  const [formData, setFormData] = useState({
    // Brief Title fields
    title: '',
    alternateTitle: '',
    uniformTitle: '',
    varyingForm: '',
    seriesUniformTitle: '',
    coAuthors: [] as Array<{ name: string; dates: string; role: string }>,
    
    // Series/Notes fields
    seriesTitle: '',
    volumeNumber: '',
    interestLevel: 'Adult',
    lexile: 'No Code',
    fountasPinnell: 'Any Level',
    notes: [] as Array<{ type: string; content: string }>,
    
    // Title Information fields
    subtitle: '',
    book_author: '',
    edition: '',
    lccn: '',
    isbn: '',
    issn: '',
    materialType: 'Book',
    subtype: 'Paperback',
    authorName: '',
    authorDates: '',
    publicationPlace: '',
    publisher: '',
    publication_year: '',
    extent: '',
    otherDetails: '',
    size: '',
    
    // Resources fields
    links: [] as Array<{ url: string; description: string }>,
    digitalContent: [] as Array<any>,
    
    // Basic fields
    category_id: '' as number | '',
    section_id: '' as number | '',
    language: 'English',
    description: '',
    copies: '1'
  })

  const [categories, setCategories] = useState<{ category_id: number; name: string }[]>(propCategories || [])
  const [sections, setSections] = useState<{ section_id: number; name: string }[]>(propSections || [])

  useEffect(() => {
    if (propCategories) setCategories(propCategories)
  }, [propCategories])

  useEffect(() => {
    if (propSections) setSections(propSections)
  }, [propSections])

  // Map incoming initialData (DB shape) to form state shape for edit mode
  useEffect(() => {
    if (!initialData) return
    const d: any = initialData

    const firstAuthor = Array.isArray(d.authors) && d.authors.length > 0 ? d.authors[0] : null
    const contributors = Array.isArray(d.coAuthors)
      ? d.coAuthors
      : Array.isArray(d.contributors)
        ? d.contributors.map((c: any) => ({ name: c.name || '', dates: c.dates || '', role: c.role || '' }))
        : []

    const links = Array.isArray(d.links)
      ? d.links.map((l: any) => ({ url: l.url || '', description: l.description || '' }))
      : []

    const digitalContent = Array.isArray(d.digital_content)
      ? d.digital_content.map((c: any) => ({ title: c.title || '', url: c.url || '', type: c.file_type || c.type || '' }))
      : Array.isArray(d.digitalContent)
        ? d.digitalContent
        : []

    const notes = Array.isArray(d.notes)
      ? d.notes
      : (typeof d.notes === 'string' && d.notes.trim())
        ? (() => {
            try {
              const parsed = JSON.parse(d.notes)
              if (Array.isArray(parsed)) return parsed
              if (parsed && typeof parsed === 'object') return [parsed]
              return []
            } catch {
              return [{ type: 'Note', content: d.notes }]
            }
          })()
        : []

    const mapped: any = {
      // Titles & authors
      title: d.title ?? '',
      subtitle: d.subtitle ?? '',
      book_author: (d.book_author || firstAuthor?.name || ''),
      authorName: firstAuthor?.name || d.authorName || d.book_author || '',
      authorDates: firstAuthor?.dates || d.authorDates || '',

      // Series/levels
      seriesTitle: d.series_title ?? d.seriesTitle ?? '',
      volumeNumber: d.volume_number ?? d.volumeNumber ?? '',
      interestLevel: d.interest_level ?? d.interestLevel ?? 'Adult',
      lexile: d.lexile_code ?? d.lexile ?? 'No Code',
      fountasPinnell: d.fountas_pinnell ?? d.fountasPinnell ?? 'Any Level',
      notes,

      // Standards
      lccn: d.lccn ?? '',
      isbn: d.isbn ?? '',
      issn: d.issn ?? '',

      // Material & publication
      materialType: d.material_type ?? d.materialType ?? 'Book',
      subtype: d.subtype ?? '',
      publicationPlace: d.publication_place ?? d.publicationPlace ?? '',
      publisher: d.publisher ?? '',
      publication_year: (d.year_published != null ? String(d.year_published) : (d.publication_year ?? '')),

      // Physical
      extent: d.extent ?? '',
      otherDetails: d.other_details ?? d.otherDetails ?? '',
      size: d.size ?? '',

      // Library mgmt
      category_id: d.category_id ?? (typeof d.category === 'object' && d.category ? d.category.category_id : ''),
      section_id: d.section_id ?? (typeof d.section === 'object' && d.section ? d.section.section_id : ''),
      language: d.language ?? 'English',
      copies: (d.copies != null ? String(d.copies) : (d.copies_total != null ? String(d.copies_total) : formData.copies)),

      // Resources
      links,
      digitalContent,

      // Added entries
      coAuthors: contributors,

      // Single alternate title input -> take first alternate_titles if present
      alternateTitle: d.alternateTitle ?? (Array.isArray(d.alternate_titles) && d.alternate_titles[0]?.title ? d.alternate_titles[0].title : ''),
    }

    setFormData(prev => ({
      ...prev,
      ...mapped,
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: (name === 'category_id' || name === 'section_id') ? (value ? parseInt(value) : '') : value
    }))
  }

  // Auto-fill primary author from first co-author if empty
  useEffect(() => {
    if (!formData.book_author.trim()) {
      const first = formData.coAuthors.find((a) => a.name && a.name.trim())
      if (first) {
        setFormData(prev => ({ ...prev, book_author: first.name }))
      }
    }
  }, [formData.coAuthors])

  const addCoAuthor = () => {
    setFormData(prev => ({
      ...prev,
      coAuthors: [...prev.coAuthors, { name: '', dates: '', role: '' }]
    }))
  }

  const updateCoAuthor = (index: number, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      coAuthors: prev.coAuthors.map((author, i) => 
        i === index ? { ...author, [field]: value } : author
      )
    }))
  }

  const removeCoAuthor = (index: number) => {
    setFormData(prev => ({
      ...prev,
      coAuthors: prev.coAuthors.filter((_, i) => i !== index)
    }))
  }

  const addNote = () => {
    setFormData(prev => ({
      ...prev,
      notes: [...prev.notes, { type: 'Summary', content: '' }]
    }))
  }

  const updateNote = (index: number, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      notes: prev.notes.map((note, i) => 
        i === index ? { ...note, [field]: value } : note
      )
    }))
  }

  const addLink = () => {
    setFormData(prev => ({
      ...prev,
      links: [...prev.links, { url: '', description: '' }]
    }))
  }

  const updateLink = (index: number, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      links: prev.links.map((link, i) => 
        i === index ? { ...link, [field]: value } : link
      )
    }))
  }

  const removeLink = (index: number) => {
    setFormData(prev => ({
      ...prev,
      links: prev.links.filter((_, i) => i !== index)
    }))
  }

  const addDigitalContent = () => {
    setFormData(prev => ({
      ...prev,
      digitalContent: [...prev.digitalContent, { title: '', url: '', type: '' }]
    }))
  }

  const updateDigitalContent = (index: number, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      digitalContent: prev.digitalContent.map((content, i) => 
        i === index ? { ...content, [field]: value } : content
      )
    }))
  }

  const removeDigitalContent = (index: number) => {
    setFormData(prev => ({
      ...prev,
      digitalContent: prev.digitalContent.filter((_, i) => i !== index)
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    if (!formData.title.trim()) {
      alert('Please enter a book title')
      setActiveTab('brief')
      return
    }
    
    // Check if author is provided either in book_author or coAuthors
    const hasAuthor = formData.book_author.trim() || formData.coAuthors.some(a => a.name.trim())
    if (!hasAuthor) {
      alert('Please provide at least one author in the Brief Title tab or Authors field in Title Information tab')
      setActiveTab('brief')
      return
    }
    
    if (!formData.category_id) {
      alert('Please select a category')
      setActiveTab('details')
      return
    }
    
    if (!formData.copies || parseInt(formData.copies) < 1) {
      alert('Please enter a valid number of copies')
      setActiveTab('details')
      return
    }
    
    // If book_author is empty but we have coAuthors, use the first coAuthor as the main author
    const submissionData = {
      ...formData,
      book_author: formData.book_author.trim() || formData.coAuthors.find(a => a.name.trim())?.name || ''
    }
    
    await onSubmit(submissionData)
  }

  const tabs = [
    { id: 'brief' as TabType, label: 'Brief Title' },
    { id: 'details' as TabType, label: 'Title Information' },
    { id: 'series' as TabType, label: 'Series/Notes' },
    { id: 'resources' as TabType, label: 'Resources' },
    { id: 'entries' as TabType, label: 'Added Entries' },
  ]

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardContent className="p-6">
          {/* Tab Navigation */}
          <div className="flex border-b border-gray-200 mb-6">
            {tabs.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="space-y-6">
            {/* Brief Title Tab */}
            {activeTab === 'brief' && (
              <div className="space-y-6">
                {/* Title Section */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="title"
                      value={formData.title}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter book title"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subtitle</label>
                    <input
                      type="text"
                      name="subtitle"
                      value={formData.subtitle}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Alternate Titles</label>
                    <input
                      type="text"
                      name="alternateTitle"
                      value={formData.alternateTitle}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Uniform Title</label>
                    <input
                      type="text"
                      name="uniformTitle"
                      value={formData.uniformTitle}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Varying Form</label>
                    <input
                      type="text"
                      name="varyingForm"
                      value={formData.varyingForm}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Series Uniform Title</label>
                    <input
                      type="text"
                      name="seriesUniformTitle"
                      value={formData.seriesUniformTitle}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Authors Section */}
                <div className="space-y-4 pt-4 border-t border-gray-200">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Primary author
                    </label>
                    <input
                      type="text"
                      name="book_author"
                      value={formData.book_author}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="Enter primary author name or use Added Entries"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Edition</label>
                    <input
                      type="text"
                      name="edition"
                      value={formData.edition}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>

                {/* Standard Numbers */}
                <div className="space-y-4 pt-4 border-t border-gray-200">
                  <h3 className="font-medium text-gray-900">Standard Numbers</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">LCCN</label>
                      <input
                        type="text"
                        name="lccn"
                        value={formData.lccn}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">ISBN</label>
                      <input
                        type="text"
                        name="isbn"
                        value={formData.isbn}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">ISSN</label>
                      <input
                        type="text"
                        name="issn"
                        value={formData.issn}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                  </div>
                </div>

                {/* Material Type */}
                <div className="space-y-4 pt-4 border-t border-gray-200">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Material Type</label>
                      <select
                        name="materialType"
                        value={formData.materialType}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="Book">Book</option>
                        <option value="eBook">eBook</option>
                        <option value="Audiobook">Audiobook</option>
                        <option value="DVD">DVD</option>
                        <option value="Magazine">Magazine</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Subtype</label>
                      <select
                        name="subtype"
                        value={formData.subtype}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="Paperback">Paperback</option>
                        <option value="Hardcover">Hardcover</option>
                        <option value="Board Book">Board Book</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Author Details (removed to avoid duplication; use Primary author and Added Entries) */}

                {/* Publication Information */}
                <div className="space-y-4 pt-4 border-t border-gray-200">
                  <h3 className="font-medium text-gray-900">Publication Information</h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Place</label>
                    <input
                      type="text"
                      name="publicationPlace"
                      value={formData.publicationPlace}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Publisher</label>
                    <input
                      type="text"
                      name="publisher"
                      value={formData.publisher}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <input
                      type="text"
                      name="publication_year"
                      value={formData.publication_year}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="c2025"
                    />
                  </div>
                </div>

                {/* Physical Description */}
                <div className="space-y-4 pt-4 border-t border-gray-200">
                  <h3 className="font-medium text-gray-900">Physical Description</h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Extent</label>
                    <input
                      type="text"
                      name="extent"
                      value={formData.extent}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="e.g., 193 pages"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Other Details</label>
                    <input
                      type="text"
                      name="otherDetails"
                      value={formData.otherDetails}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Size</label>
                    <input
                      type="text"
                      name="size"
                      value={formData.size}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="e.g., 23 cm"
                    />
                  </div>
                </div>

                {/* Library Management */}
                <div className="space-y-4 pt-4 border-t border-gray-200">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Category <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="category_id"
                        value={formData.category_id}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="">Select a category</option>
                        {categories.map(c => (
                          <option key={c.category_id} value={c.category_id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
                      <select
                        name="section_id"
                        value={formData.section_id}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="">No section</option>
                        {sections.map(s => (
                          <option key={s.section_id} value={s.section_id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Number of Copies <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="copies"
                      value={formData.copies}
                      onChange={handleInputChange}
                      min="1"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Series/Notes Tab */}
            {activeTab === 'series' && (
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900 mb-4">Series Information</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    name="seriesTitle"
                    value={formData.seriesTitle}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Volume #</label>
                  <input
                    type="text"
                    name="volumeNumber"
                    value={formData.volumeNumber}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Interest Level</label>
                    <select
                      name="interestLevel"
                      value={formData.interestLevel}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="Adult">Adult</option>
                      <option value="Young Adult">Young Adult</option>
                      <option value="Middle Grade">Middle Grade</option>
                      <option value="Early Readers">Early Readers</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Lexile</label>
                    <select
                      name="lexile"
                      value={formData.lexile}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="No Code">No Code</option>
                      <option value="BR">BR (Beginning Reader)</option>
                      <option value="NP">NP (Non-Prose)</option>
                      <option value="HL">HL (High-Low)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fountas and Pinnell</label>
                    <select
                      name="fountasPinnell"
                      value={formData.fountasPinnell}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="Any Level">Any Level</option>
                      <option value="Level A">Level A</option>
                      <option value="Level B">Level B</option>
                      <option value="Level C">Level C</option>
                      <option value="Level D">Level D</option>
                      <option value="Level Z">Level Z</option>
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700">Notes</label>
                    <Button type="button" onClick={addNote} size="sm" variant="outline">
                      Add Note
                    </Button>
                  </div>
                  {formData.notes.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">There are no notes for this title</p>
                  ) : (
                    <div className="space-y-3">
                      {formData.notes.map((note, index) => (
                        <div key={index} className="space-y-2 p-3 border border-gray-200 rounded">
                          <select
                            value={note.type}
                            onChange={(e) => updateNote(index, 'type', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          >
                            <option value="Summary">Summary</option>
                            <option value="Content">Content</option>
                            <option value="General">General</option>
                          </select>
                          <textarea
                            value={note.content}
                            onChange={(e) => updateNote(index, 'content', e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            placeholder="Enter note content..."
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Title Information Tab */}
            {activeTab === 'details' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subtitle</label>
                  <input
                    type="text"
                    name="subtitle"
                    value={formData.subtitle}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>

                {/* Duplicate Authors input removed to avoid confusion */}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Edition</label>
                  <input
                    type="text"
                    name="edition"
                    value={formData.edition}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>

                <h3 className="font-medium text-gray-900 pt-4">Standard Numbers</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">LCCN</label>
                    <input
                      type="text"
                      name="lccn"
                      value={formData.lccn}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ISBN</label>
                    <input
                      type="text"
                      name="isbn"
                      value={formData.isbn}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ISSN</label>
                    <input
                      type="text"
                      name="issn"
                      value={formData.issn}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Material Type</label>
                    <select
                      name="materialType"
                      value={formData.materialType}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="Book">Book</option>
                      <option value="eBook">eBook</option>
                      <option value="Audiobook">Audiobook</option>
                      <option value="DVD">DVD</option>
                      <option value="Magazine">Magazine</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subtype</label>
                    <select
                      name="subtype"
                      value={formData.subtype}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="Paperback">Paperback</option>
                      <option value="Hardcover">Hardcover</option>
                      <option value="Board Book">Board Book</option>
                    </select>
                  </div>
                </div>

                <h3 className="font-medium text-gray-900 pt-4">Author</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      name="authorName"
                      value={formData.authorName}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Dates</label>
                    <input
                      type="text"
                      name="authorDates"
                      value={formData.authorDates}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>

                <h3 className="font-medium text-gray-900 pt-4">Publication Information</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Place</label>
                    <input
                      type="text"
                      name="publicationPlace"
                      value={formData.publicationPlace}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Publisher</label>
                    <input
                      type="text"
                      name="publisher"
                      value={formData.publisher}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <input
                      type="text"
                      name="publication_year"
                      value={formData.publication_year}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="c2025"
                    />
                  </div>
                </div>

                <h3 className="font-medium text-gray-900 pt-4">Physical Description</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Extent</label>
                    <input
                      type="text"
                      name="extent"
                      value={formData.extent}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="e.g., 193 pages"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Other Details</label>
                    <input
                      type="text"
                      name="otherDetails"
                      value={formData.otherDetails}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Size</label>
                    <input
                      type="text"
                      name="size"
                      value={formData.size}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="e.g., 23 cm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="category_id"
                      value={formData.category_id}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="">Select a category</option>
                      {categories.map(c => (
                        <option key={c.category_id} value={c.category_id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
                    <select
                      name="section_id"
                      value={formData.section_id}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="">No section</option>
                      {sections.map(s => (
                        <option key={s.section_id} value={s.section_id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Number of Copies <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="copies"
                    value={formData.copies}
                    onChange={handleInputChange}
                    min="1"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
            )}

            {/* Added Entries Tab */}
            {activeTab === 'entries' && (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700">Co-authors, Illustrators, Editors, etc.</label>
                    <Button type="button" onClick={addCoAuthor} size="sm" variant="outline">
                      Add Entry
                    </Button>
                  </div>
                  {formData.coAuthors.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">There are no added entries for this title</p>
                  ) : (
                    <div className="space-y-3">
                      {formData.coAuthors.map((author, index) => (
                        <div key={index} className="grid grid-cols-3 gap-3 p-3 border border-gray-200 rounded">
                          <input
                            type="text"
                            placeholder="Name"
                            value={author.name}
                            onChange={(e) => updateCoAuthor(index, 'name', e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-md"
                          />
                          <input
                            type="text"
                            placeholder="Dates"
                            value={author.dates}
                            onChange={(e) => updateCoAuthor(index, 'dates', e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-md"
                          />
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="Role"
                              value={author.role}
                              onChange={(e) => updateCoAuthor(index, 'role', e.target.value)}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                            />
                            <Button type="button" onClick={() => removeCoAuthor(index)} size="sm" variant="destructive">
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Resources Tab */}
            {activeTab === 'resources' && (
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-medium text-gray-900">Links</h3>
                    <Button type="button" onClick={addLink} size="sm" variant="outline">
                      Add Link
                    </Button>
                  </div>
                  {formData.links.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">There are no electronic resources for this title</p>
                  ) : (
                    <div className="space-y-3">
                      {formData.links.map((link, index) => (
                        <div key={index} className="p-3 border border-gray-200 rounded">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">URL</label>
                              <input
                                type="url"
                                value={link.url}
                                onChange={(e) => updateLink(index, 'url', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                placeholder="https://..."
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">Description</label>
                              <input
                                type="text"
                                value={link.description}
                                onChange={(e) => updateLink(index, 'description', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                              />
                            </div>
                          </div>
                          <div className="mt-2 flex justify-end">
                            <Button type="button" onClick={() => removeLink(index)} size="sm" variant="destructive">
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-medium text-gray-900">Digital Content</h3>
                    <Button type="button" onClick={addDigitalContent} size="sm" variant="outline">
                      Add New
                    </Button>
                  </div>
                  {formData.digitalContent.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">There is no digital content for this title</p>
                  ) : (
                    <div className="space-y-3">
                      {formData.digitalContent.map((content, index) => (
                        <div key={index} className="p-3 border border-gray-200 rounded">
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">Title</label>
                              <input
                                type="text"
                                value={content.title}
                                onChange={(e) => updateDigitalContent(index, 'title', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                placeholder="Content title"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">URL</label>
                              <input
                                type="url"
                                value={content.url}
                                onChange={(e) => updateDigitalContent(index, 'url', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                placeholder="https://..."
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">Type</label>
                              <select
                                value={content.type}
                                onChange={(e) => updateDigitalContent(index, 'type', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                              >
                                <option value="">Select type</option>
                                <option value="PDF">PDF</option>
                                <option value="eBook">eBook</option>
                                <option value="Audio">Audio</option>
                                <option value="Video">Video</option>
                                <option value="Other">Other</option>
                              </select>
                            </div>
                          </div>
                          <div className="mt-2 flex justify-end">
                            <Button type="button" onClick={() => removeDigitalContent(index)} size="sm" variant="destructive">
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Form Actions */}
      <div className="flex items-center justify-between pt-4">
        <div className="text-sm text-gray-500">
          <span className="text-red-500">*</span> Required fields
        </div>
        <div className="flex gap-3">
          {onCancel && (
            <Button type="button" onClick={onCancel} variant="outline">
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                {isEditing ? 'Updating...' : 'Adding...'}
              </>
            ) : (
              <>
                <i className={`fas fa-${isEditing ? 'save' : 'plus'} mr-2`}></i>
                {isEditing ? 'Save Title' : 'Save Title'}
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  )
}
