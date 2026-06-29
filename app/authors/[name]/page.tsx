'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { PublicHeader, PublicFooter } from '@/components/layout'
import { LoadingScreen } from '@/components/ui/loading-spinner'
import { bookHref, parseSlug, slugify } from '@/lib/utils'

interface Work {
  book_id: number
  title: string
  isbn: string | null
  copies_total: number
  copies_available: number
  year_published: number | null
  material_type: string | null
  contribution_role: string | null
  contribution_dates: string | null
  via: 'author' | 'contributor'
}

interface AuthorResponse {
  success: boolean
  name: string
  roles: string[]
  works: Work[]
}

/**
 * /authors/[name] — public catalogue page that lists every
 * book (non-archived) that credits the given person as
 * either a primary author or a contributor.
 *
 * The URL parameter is a slug that we re-attach spaces
 * to before looking up. The page also renders author /
 * contributor names on the public book view as links
 * into this page (see the book view page).
 */
export default function AuthorWorksPage() {
  const params = useParams()
  const router = useRouter()
  const rawParam = (params?.name as string) || ''

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<AuthorResponse | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [search, setSearch] = useState('')

  // Decode the slug ("stephen-king" -> "Stephen King") for
  // the lookup, but keep the original slug for the URL
  // breadcrumb so the user can see what they searched.
  const decodedName = useMemo(() => {
    try {
      return decodeURIComponent(rawParam)
    } catch {
      return rawParam
    }
  }, [rawParam])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setNotFound(false)
    setData(null)

    // The backend expects the original (spaced) name, not
    // the URL slug — so re-insert spaces by decoding then
    // parsing the slug the same way we build it.
    const name = parseSlug(decodedName).id
      ? decodedName
      : decodedName.replace(/-/g, ' ')

    fetch(`/api/public/authors/${encodeURIComponent(rawParam)}`, {
      signal: controller.signal,
      cache: 'no-store'
    })
      .then(async (res) => {
        if (res.status === 404) {
          setNotFound(true)
          setLoading(false)
          return
        }
        if (!res.ok) throw new Error('Failed to load author')
        const json: AuthorResponse = await res.json()
        setData(json)
        setLoading(false)
      })
      .catch((err) => {
        if ((err as any)?.name !== 'AbortError') {
          setNotFound(true)
        }
        setLoading(false)
      })

    return () => controller.abort()
  }, [rawParam, decodedName])

  const filteredWorks = useMemo(() => {
    if (!data) return []
    const q = search.trim().toLowerCase()
    if (!q) return data.works
    return data.works.filter(
      (w) =>
        w.title.toLowerCase().includes(q) ||
        (w.isbn || '').toLowerCase().includes(q) ||
        (w.contribution_role || '').toLowerCase().includes(q)
    )
  }, [data, search])

  if (loading) return <LoadingScreen message="Loading author…" />

  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50/30 via-white to-primary-50/40 flex flex-col">
        <PublicHeader showBrowseLink={true} />
        <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <i className="fas fa-user-slash text-5xl text-gray-300 mb-4"></i>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            No works found
          </h1>
          <p className="text-gray-600 mb-6">
            We couldn't find any books by{' '}
            <span className="font-mono">{decodedName}</span> in the
            catalogue.
          </p>
          <button
            type="button"
            onClick={() => router.push('/browse')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700 transition-colors"
          >
            <i className="fas fa-arrow-left text-xs"></i>
            Back to Browse
          </button>
        </main>
        <PublicFooter />
      </div>
    )
  }

  const total = data.works.length
  const availableCount = data.works.filter(
    (w) => w.copies_available > 0
  ).length
  const roleLabel =
    data.roles.length === 2
      ? 'Author & Contributor'
      : data.roles[0] === 'author'
      ? 'Author'
      : 'Contributor'

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50/30 via-white to-primary-50/40">
      <PublicHeader showBrowseLink={true} />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
          <a href="/browse" className="hover:text-primary-700 transition-colors">
            Browse
          </a>
          <i className="fas fa-chevron-right text-[10px]"></i>
          <span className="text-gray-900 font-medium">Authors</span>
          <i className="fas fa-chevron-right text-[10px]"></i>
          <span className="text-gray-900 font-medium truncate">
            {data.name}
          </span>
        </nav>

        {/* Hero */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-4">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
              <i className="fas fa-user-pen text-2xl"></i>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">
                {data.name}
              </h1>
              <p className="text-sm text-gray-600 mt-1">{roleLabel}</p>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-primary-100 text-primary-700">
                  <i className="fas fa-book"></i>
                  {total} {total === 1 ? 'work' : 'works'} in the catalogue
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700">
                  <i className="fas fa-check-circle"></i>
                  {availableCount} currently available
                </span>
                {data.roles.length > 1 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-700">
                    <i className="fas fa-people-arrows"></i>
                    Author & contributor
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Search filter */}
        <div className="bg-white border border-gray-200 rounded-2xl p-3 mb-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <i className="fas fa-search text-gray-400 text-sm"></i>
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by title, ISBN, or role…"
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Works list */}
        {filteredWorks.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
            <i className="fas fa-search text-3xl text-gray-300 mb-2"></i>
            <p className="text-sm text-gray-500">
              {search
                ? `No works match "${search}".`
                : 'No works found.'}
            </p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {filteredWorks.map((w) => (
                <a
                  key={w.book_id}
                  href={bookHref({
                    book_id: w.book_id,
                    title: w.title
                  })}
                  className="block p-3 hover:bg-primary-50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-md bg-primary-50 text-primary-600 flex items-center justify-center">
                      <i className="fas fa-book text-sm"></i>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {w.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {w.contribution_role || roleLabel}
                        {w.contribution_dates
                          ? ` • ${w.contribution_dates}`
                          : ''}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {w.year_published && (
                          <span className="text-[11px] text-gray-500">
                            {w.year_published}
                          </span>
                        )}
                        {w.material_type && (
                          <span className="text-[11px] text-gray-500">
                            • {w.material_type}
                          </span>
                        )}
                        <span
                          className={`ml-auto text-[11px] font-medium ${
                            w.copies_available > 0
                              ? 'text-emerald-700'
                              : 'text-red-700'
                          }`}
                        >
                          {w.copies_available > 0
                            ? `${w.copies_available}/${w.copies_total} available`
                            : 'Unavailable'}
                        </span>
                      </div>
                    </div>
                  </div>
                </a>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      Title
                    </th>
                    <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      Year
                    </th>
                    <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      Copies
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredWorks.map((w) => (
                    <tr
                      key={w.book_id}
                      className="hover:bg-primary-50 transition-colors"
                    >
                      <td className="px-4 py-2">
                        <Link
                          href={bookHref({
                            book_id: w.book_id,
                            title: w.title
                          })}
                          className="text-sm font-medium text-primary-700 hover:text-primary-900 hover:underline"
                        >
                          {w.title}
                        </Link>
                        {w.isbn && (
                          <div className="text-[11px] text-gray-500 font-mono">
                            ISBN {w.isbn}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-600">
                        {w.contribution_role || roleLabel}
                        {w.contribution_dates && (
                          <div className="text-[10px] text-gray-500">
                            {w.contribution_dates}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap">
                        {w.year_published || '—'}
                      </td>
                      <td className="px-4 py-2 text-sm whitespace-nowrap">
                        <span
                          className={
                            w.copies_available > 0
                              ? 'text-emerald-700'
                              : 'text-red-700'
                          }
                        >
                          {w.copies_available} / {w.copies_total}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      <PublicFooter />
    </div>
  )
}
