'use client'

import React, {
  useState,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle
} from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import IsbnLookupModal from './IsbnLookupModal'
import AddOptionModal, {
  type AddOptionItem
} from './AddOptionModal'
import type { OpenLibraryBook } from '@/lib/open-library'

/**
 * Imperative handle exposed by `EnhancedBookForm`. The parent
 * page uses this to:
 *   - Append a freshly-created Category / Section into the
 *     form's dropdowns (the parent calls the API, the form
 *     just updates its local list).
 *   - Append a freshly-created option into one of the
 *     form's hard-coded option arrays (Material Type, Subtype,
 *     Interest Level, Lexile, Fountas & Pinnell).
 *   - Set a specific form field by name (used by the page
 *     after a header quick action to switch e.g. category_id
 *     to the freshly-added category).
 */
export type OptionKind =
  | 'materialType'
  | 'subtype'
  | 'interestLevel'
  | 'lexile'
  | 'fountasPinnell'

export interface BookFormHandle {
  addCategory: (item: { category_id: number; name: string }) => void
  addSection: (item: { section_id: number; name: string }) => void
  addOption: (kind: OptionKind, value: string) => void
  setField: (name: string, value: any) => void
}

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

export const EnhancedBookForm = forwardRef<
  BookFormHandle,
  EnhancedBookFormProps
>(function EnhancedBookForm(
  {
    onSubmit,
    onCancel,
    loading = false,
    initialData,
    categories: propCategories,
    sections: propSections,
    isEditing = false
  },
  ref
) {
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
    summary: '',
    copies: '1'
  })

  const [categories, setCategories] = useState<{ category_id: number; name: string }[]>(propCategories || [])
  const [sections, setSections] = useState<{ section_id: number; name: string }[]>(propSections || [])

  // Dynamic option lists for the hard-coded <select> fields.
  // We start from the same defaults the original form used,
  // but allow new values to be appended at runtime — important
  // for the Open Library ISBN lookup: if the scraped book is
  // a new material type / format we don't know about yet, we
  // can still surface it as a usable option and select it.
  const [materialTypeOptions, setMaterialTypeOptions] = useState<string[]>([
    'Book', 'eBook', 'Audiobook', 'DVD', 'Magazine'
  ])
  const [subtypeOptions, setSubtypeOptions] = useState<string[]>([
    'Paperback', 'Hardcover', 'Board Book'
  ])
  const [interestLevelOptions, setInterestLevelOptions] = useState<string[]>([
    'Adult', 'Young Adult', 'Middle Grade', 'Early Readers'
  ])
  const [lexileOptions, setLexileOptions] = useState<string[]>([
    'No Code', 'BR (Beginning Reader)', 'NP (Non-Prose)', 'HL (High-Low)'
  ])
  const [fountasPinnellOptions, setFountasPinnellOptions] = useState<string[]>([
    'Any Level', 'Level A', 'Level B', 'Level C', 'Level D', 'Level Z'
  ])

  // Modal that drives the Open Library ISBN lookup.
  const [showIsbnModal, setShowIsbnModal] = useState(false)

  // Inline "Add new category / section" modal state. When
  // the user picks the special `__add_new__` option in
  // either select, this opens the shared AddOptionModal.
  // The newly created item is appended to the matching list
  // AND auto-selected in the form.
  const [inlineAdd, setInlineAdd] = useState<
    | null
    | {
        kind: 'category' | 'section'
        title: string
        endpoint: string
        fieldName: 'category_id' | 'section_id'
      }
  >(null)

  // Imperative handle — exposes a small, typed surface to
  // the parent page so the header quick-action buttons can
  // add options into the same lists the form uses. Each
  // method is case-insensitive de-duped against the
  // existing options so re-clicking the same quick action
  // twice doesn't create duplicates.
  useImperativeHandle(
    ref,
    () => ({
      addCategory: (item) => {
        setCategories((prev) => {
          if (
            prev.some(
              (c) =>
                c.category_id === item.category_id ||
                c.name.toLowerCase() === item.name.toLowerCase()
            )
          )
            return prev
          return [...prev, item]
        })
        setFormData((prev) => ({ ...prev, category_id: item.category_id }))
      },
      addSection: (item) => {
        setSections((prev) => {
          if (
            prev.some(
              (s) =>
                s.section_id === item.section_id ||
                s.name.toLowerCase() === item.name.toLowerCase()
            )
          )
            return prev
          return [...prev, item]
        })
        setFormData((prev) => ({ ...prev, section_id: item.section_id }))
      },
      addOption: (kind, value) => {
        const cleaned = (value || '').trim()
        if (!cleaned) return
        // Map each option kind to its current list + setter.
        // The setter accepts a callback form so we can
        // de-dupe against the existing values before appending.
        const setterByKind: Record<
          OptionKind,
          (updater: (prev: string[]) => string[]) => void
        > = {
          materialType: (updater) =>
            setMaterialTypeOptions(updater as (prev: string[]) => string[]),
          subtype: (updater) => setSubtypeOptions(updater as (prev: string[]) => string[]),
          interestLevel: (updater) =>
            setInterestLevelOptions(updater as (prev: string[]) => string[]),
          lexile: (updater) => setLexileOptions(updater as (prev: string[]) => string[]),
          fountasPinnell: (updater) =>
            setFountasPinnellOptions(updater as (prev: string[]) => string[])
        }
        setterByKind[kind]((prev: string[]) => {
          if (prev.some((v) => v.toLowerCase() === cleaned.toLowerCase())) return prev
          return [...prev, cleaned]
        })
        // Also set the form value so the field auto-switches
        // to the freshly-added option.
        const formFieldMap: Record<OptionKind, string> = {
          materialType: 'materialType',
          subtype: 'subtype',
          interestLevel: 'interestLevel',
          lexile: 'lexile',
          fountasPinnell: 'fountasPinnell'
        }
        setFormData((prev) => ({ ...prev, [formFieldMap[kind]]: cleaned }))
      },
      setField: (name, value) => {
        setFormData((prev) => ({ ...prev, [name]: value }))
      }
    }),
    [
      materialTypeOptions,
      subtypeOptions,
      interestLevelOptions,
      lexileOptions,
      fountasPinnellOptions
    ]
  )

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
      description: d.description ?? '',
      summary: d.summary ?? '',
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

  const removeNote = (index: number) => {
    setFormData(prev => ({
      ...prev,
      notes: prev.notes.filter((_, i) => i !== index)
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

  // ---------- Open Library ISBN lookup ----------
  // Ensures the option list contains `value` (case-insensitive
  // de-dupe). Returns the value the select should now show.
  const ensureOption = (
    list: string[],
    setter: (next: string[]) => void,
    value: string
  ): string => {
    const cleaned = (value || '').trim()
    if (!cleaned) return ''
    const exists = list.some((v) => v.toLowerCase() === cleaned.toLowerCase())
    if (!exists) setter([...list, cleaned])
    return cleaned
  }

  // Apply an Open Library record to the form. The Open Library
  // record maps onto:
  //   - direct scalar fields (title, subtitle, isbn, ...)
  //   - the primary author (first name in the authors array)
  //   - the added-entries list (every other author, so the
  //     first author slot doesn't get cluttered with co-authors)
  //   - publisher + publish place + publish date (year)
  //   - physical format -> material type / subtype
  //   - the cover, but only stored locally (no upload here)
  //
  // New option values (e.g. a previously-unseen material type
  // like "Audio CD") are auto-appended to the corresponding
  // dropdown so the user can always accept the scraped value.
  const applyOpenLibraryData = useCallback((book: OpenLibraryBook) => {
    // 1. Auto-extend dropdowns with any new values.
    const materialType = ensureOption(
      materialTypeOptions,
      setMaterialTypeOptions,
      book.materialType
    )
    const subtype = ensureOption(subtypeOptions, setSubtypeOptions, book.subtype)
    // interestLevel / lexile / fountasPinnell don't have
    // direct Open Library equivalents, but if the lookup did
    // provide a value we still want to surface it.
    const interestLevel = ensureOption(
      interestLevelOptions,
      setInterestLevelOptions,
      (book.raw?.interest_level as string) || ''
    )
    const lexile = ensureOption(
      lexileOptions,
      setLexileOptions,
      (book.raw?.lexile_code as string) || ''
    )
    const fountasPinnell = ensureOption(
      fountasPinnellOptions,
      setFountasPinnellOptions,
      (book.raw?.fountas_pinnell as string) || ''
    )

    // 2. Build the alternate titles list. Open Library
    //    exposes these as `subjects` (the most common
    //    ones are sub-titles) and `alternative_title` /
    //    `subtitle`. We collect anything that looks like an
    //    extra title.
    const altTitleCandidates: string[] = []
    if (book.subtitle) altTitleCandidates.push(book.subtitle)
    if (Array.isArray(book.raw?.subjects)) {
      book.raw.subjects
        .filter((s: any) => typeof s === 'string')
        .slice(0, 8)
        .forEach((s: string) => altTitleCandidates.push(s))
    }
    // The "brief" alternate title (single field) takes the
    // first non-empty alternate; the full list is preserved
    // in `coAuthors`-adjacent "Notes" if the user wants
    // to copy it over manually.
    const alternateTitle = book.subtitle || book.title

    // 3. Build the added-entries (contributors) list. Every
    //    author beyond the primary is added as a "Co-Author"
    //    entry — the form's "Added Entries" tab lets the user
    //    change the role / dates freely.
    const addedEntries = book.coAuthors.map((name) => ({
      name,
      dates: '',
      role: 'Co-Author'
    }))

    // 4. Build a starter Notes array. The description (if
    //    Open Library returned one) is added first as a
    //    "Summary" note so it lands on top of the list; any
    //    subjects are added below as "General" notes.
    const notes: Array<{ type: string; content: string }> = []
    if (book.description) {
      notes.push({ type: 'Summary', content: book.description })
    }
    if (book.subjects.length > 0) {
      book.subjects.slice(0, 5).forEach((content) => {
        notes.push({ type: 'General', content })
      })
    }

    // 5. Compute the LCCN / ISSN from the merged identifier
    //    arrays. Open Library sometimes returns more than one
    //    value; we take the first.
    const lccn = book.lccn[0] || ''
    const issn = book.issn[0] || ''

    // 6. Publish place: Open Library returns an array. Take
    //    the first non-empty value.
    const publicationPlace = book.publishPlaces[0] || ''

    // 7. Year: prefer the explicitly extracted year, fall back
    //    to whatever we can pull from the raw date string.
    const publicationYear = book.publishYear || ''

    setFormData((prev) => ({
      ...prev,
      // Brief Title
      title: book.title || prev.title,
      alternateTitle,
      // Open Library doesn't expose MARC "uniform title" or
      // "varying form" — leave as-is.
      // Series uniform title similarly left as-is.
      // Primary author: take from the lookup but don't blow
      // away a value the user has already typed manually.
      book_author: book.primaryAuthor || prev.book_author,
      authorName: book.primaryAuthor || prev.authorName,

      // Title Information
      subtitle: book.subtitle,
      edition: (book.raw?.edition_statement as string) || prev.edition,
      lccn,
      isbn: book.isbn,
      issn,
      materialType: materialType || prev.materialType,
      subtype: subtype || prev.subtype,
      publicationPlace,
      publisher: book.publishers[0] || '',
      publication_year: publicationYear,
      extent: book.numberOfPages,
      size: [book.physicalDimensions, book.weight]
        .filter(Boolean)
        .join(' · '),

      // Reading-level selects (only fill when the lookup
      // actually returned something — otherwise keep the
      // current value).
      interestLevel: interestLevel || prev.interestLevel,
      lexile: lexile || prev.lexile,
      fountasPinnell: fountasPinnell || prev.fountasPinnell,

      // Series/Notes
      // Keep the existing series title; Open Library doesn't
      // expose a uniform series name.
      notes: notes.length > 0 ? notes : prev.notes,

      // Added Entries
      coAuthors: addedEntries.length > 0 ? addedEntries : prev.coAuthors
    }))
  }, [
    materialTypeOptions,
    subtypeOptions,
    interestLevelOptions,
    lexileOptions,
    fountasPinnellOptions
  ])

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
    // Derive `summary` from the first note with type "Summary"
    // so the public /browse page can render it on the card.
    // If no Summary note exists, fall back to the existing
    // formData.summary so the user can still set it manually
    // (the form's notes panel is the primary source though).
    const firstSummaryNote = formData.notes.find(
      (n) => n.type === 'Summary' && n.content && n.content.trim()
    )
    const derivedSummary = firstSummaryNote
      ? firstSummaryNote.content.trim()
      : (typeof formData.summary === 'string' ? formData.summary : '')

    const submissionData = {
      ...formData,
      book_author: formData.book_author.trim() || formData.coAuthors.find(a => a.name.trim())?.name || '',
      summary: derivedSummary
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
                {/* Auto-fill via Open Library: a single button
                    opens a small ISBN prompt, fetches the
                    record, and (on confirm) populates all the
                    fields below. The button is shown only on
                    the Brief Title tab so it doesn't compete
                    with the rest of the form chrome. */}
                <div className="flex items-center justify-between gap-3 p-3 rounded-md border border-dashed border-blue-200 bg-blue-50/50">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-md bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <i className="fas fa-wand-magic-sparkles text-blue-600"></i>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        Auto-fill from ISBN
                      </p>
                      <p className="text-xs text-gray-600 truncate">
                        Enter an ISBN to pull title, author, publisher,
                        year, format, identifiers, and subjects from
                        Open Library.
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShowIsbnModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white flex-shrink-0"
                  >
                    <i className="fas fa-barcode mr-1.5"></i>
                    Lookup by ISBN
                  </Button>
                </div>

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
                        {materialTypeOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
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
                        {subtypeOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
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
                        onChange={(e) => {
                          // The form's `handleInputChange` is
                          // for plain text/number fields. The
                          // category / section selects need
                          // their own handler so we can detect
                          // the special "__add_new__" value the
                          // user picks from the inline option.
                          const v = e.target.value
                          if (v === '__add_new__') {
                            setInlineAdd({
                              kind: 'category',
                              title: 'Add New Category',
                              endpoint: '/api/book-categories',
                              fieldName: 'category_id'
                            })
                            // Reset the select back to its
                            // current value so the inline modal
                            // is the only visible state.
                            e.target.value = String(formData.category_id ?? '')
                            return
                          }
                          handleInputChange(e)
                        }}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="">Select a category</option>
                        {categories.map(c => (
                          <option key={c.category_id} value={c.category_id}>{c.name}</option>
                        ))}
                        <option value="__add_new__" className="font-semibold text-blue-600">
                          + Add new category…
                        </option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
                      <select
                        name="section_id"
                        value={formData.section_id}
                        onChange={(e) => {
                          const v = e.target.value
                          if (v === '__add_new__') {
                            setInlineAdd({
                              kind: 'section',
                              title: 'Add New Section',
                              endpoint: '/api/sections',
                              fieldName: 'section_id'
                            })
                            e.target.value = String(formData.section_id ?? '')
                            return
                          }
                          handleInputChange(e)
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="">No section</option>
                        {sections.map(s => (
                          <option key={s.section_id} value={s.section_id}>{s.name}</option>
                        ))}
                        <option value="__add_new__" className="font-semibold text-blue-600">
                          + Add new section…
                        </option>
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
                      {interestLevelOptions.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
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
                      {lexileOptions.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
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
                      {fountasPinnellOptions.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
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
                          <div className="flex items-center gap-2">
                            <select
                              value={note.type}
                              onChange={(e) => updateNote(index, 'type', e.target.value)}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                            >
                              <option value="Summary">Summary</option>
                              <option value="Content">Content</option>
                              <option value="General">General</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => removeNote(index)}
                              className="inline-flex items-center justify-center w-9 h-9 text-red-600 hover:bg-red-50 border border-red-200 rounded-md transition-colors"
                              title="Remove this note"
                              aria-label="Remove note"
                            >
                              <i className="fas fa-trash-can text-sm"></i>
                            </button>
                          </div>
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
                      {materialTypeOptions.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
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
                      {subtypeOptions.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
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
                      onChange={(e) => {
                        const v = e.target.value
                        if (v === '__add_new__') {
                          setInlineAdd({
                            kind: 'category',
                            title: 'Add New Category',
                            endpoint: '/api/book-categories',
                            fieldName: 'category_id'
                          })
                          e.target.value = String(formData.category_id ?? '')
                          return
                        }
                        handleInputChange(e)
                      }}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="">Select a category</option>
                      {categories.map(c => (
                        <option key={c.category_id} value={c.category_id}>{c.name}</option>
                      ))}
                      <option value="__add_new__" className="font-semibold text-blue-600">
                        + Add new category…
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
                    <select
                      name="section_id"
                      value={formData.section_id}
                      onChange={(e) => {
                        const v = e.target.value
                        if (v === '__add_new__') {
                          setInlineAdd({
                            kind: 'section',
                            title: 'Add New Section',
                            endpoint: '/api/sections',
                            fieldName: 'section_id'
                          })
                          e.target.value = String(formData.section_id ?? '')
                          return
                        }
                        handleInputChange(e)
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="">No section</option>
                      {sections.map(s => (
                        <option key={s.section_id} value={s.section_id}>{s.name}</option>
                      ))}
                      <option value="__add_new__" className="font-semibold text-blue-600">
                        + Add new section…
                      </option>
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
            <Button type="button" onClick={onCancel} variant="outline" className='px-4 py-5 bg-gray-200 hover:bg-gray-300'>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={loading} className='bg-primary-600 hover:bg-primary-700 text-white px-4 py-5'>
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

      {/* Open Library ISBN lookup modal. Drives the
          "Auto-fill from ISBN" button in the Brief Title tab.
          The modal itself is a two-step wizard (input →
          preview) and the result is funneled back into the
          form via `applyOpenLibraryData`. */}
      <IsbnLookupModal
        isOpen={showIsbnModal}
        onClose={() => setShowIsbnModal(false)}
        onApply={applyOpenLibraryData}
      />

      {/* Inline "Add new category / section" modal — opened
          by selecting the special `__add_new__` option in the
          category or section <select>. The modal uses the
          server endpoint that already exists, then appends the
          new record to the local list and auto-selects it. */}
      {inlineAdd && (
        <AddOptionModal
          isOpen={true}
          onClose={() => setInlineAdd(null)}
          title={inlineAdd.title}
          description="Created categories and sections are saved to the
            library and become available to every book record."
          icon={inlineAdd.kind === 'category' ? 'fa-folder' : 'fa-layer-group'}
          endpoint={inlineAdd.endpoint}
          existingOptions={
            inlineAdd.kind === 'category'
              ? categories.map((c) => ({ id: c.category_id, name: c.name }))
              : sections.map((s) => ({ id: s.section_id, name: s.name }))
          }
          mode="name-and-description"
          onAdded={(item) => {
            // Push the freshly-created item into the matching
            // local list and select it. The select's special
            // `__add_new__` option only carries a string value,
            // so we treat the numeric id (category_id /
            // section_id) as the source of truth here.
            if (inlineAdd.kind === 'category') {
              setCategories((prev) => {
                if (prev.some((c) => c.category_id === item.id)) return prev
                return [
                  ...prev,
                  { category_id: item.id as number, name: item.name }
                ]
              })
              setFormData((prev) => ({
                ...prev,
                [inlineAdd.fieldName]: item.id as number
              }))
            } else {
              setSections((prev) => {
                if (prev.some((s) => s.section_id === item.id)) return prev
                return [
                  ...prev,
                  { section_id: item.id as number, name: item.name }
                ]
              })
              setFormData((prev) => ({
                ...prev,
                [inlineAdd.fieldName]: item.id as number
              }))
            }
          }}
        />
      )}
    </form>
  )
})
