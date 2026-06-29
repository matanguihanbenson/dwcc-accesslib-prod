'use client'

import { useEffect, useRef, useState } from 'react'

export interface AuthorHit {
  name: string
  dates: string | null
  work_count: number
}

export interface ContributorHit extends AuthorHit {
  role: string
}

interface Props {
  /** Label rendered above the input */
  label?: string
  /** Placeholder for the search input */
  placeholder?: string
  /** Which pool to search — 'author' or 'contributor' */
  source: 'author' | 'contributor'
  /** Pre-filled value (used when the form already has a
      name and we just want to show the lookup alongside it) */
  initialValue?: string
  /** Called when the user picks a hit. The full hit
      object is passed so the parent can prefill dates /
      role without a second round-trip. */
  onPick: (hit: AuthorHit | ContributorHit) => void
  /** Optional: when the user just wants to keep what they
      typed (no DB match), notify the parent with the raw
      string. The parent can decide to add a new entry. */
  onCreateNew?: (raw: string) => void
}

interface LookupResponse {
  success: boolean
  query: string
  authors: AuthorHit[]
  contributors: ContributorHit[]
}

/**
 * Compact author / contributor autocomplete. Used inline
 * next to the primary-author input on the Brief tab and
 * next to the "name" cell on the Added Entries tab.
 *
 * Debounces the lookup, races against an `ignore` flag
 * so out-of-order responses can't overwrite newer ones,
 * and renders a dropdown of matches with a
 * "create new" fallback for names that aren't in the DB.
 */
export default function AuthorContributorLookup({
  label,
  placeholder = 'Search by author or contributor name…',
  source,
  initialValue = '',
  onPick,
  onCreateNew
}: Props) {
  const [query, setQuery] = useState(initialValue)
  const [open, setOpen] = useState(false)
  const [hits, setHits] = useState<(AuthorHit | ContributorHit)[]>([])
  const [loading, setLoading] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const ignoreRef = useRef(0)

  // Debounced search — 250 ms after the user stops typing.
  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setHits([])
      setLoading(false)
      return
    }

    const myRequest = ++ignoreRef.current
    setLoading(true)
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/author-contributor-lookup?q=${encodeURIComponent(trimmed)}&limit=8`
        )
        if (!res.ok) {
          if (myRequest === ignoreRef.current) setHits([])
          return
        }
        const data: LookupResponse = await res.json()
        if (myRequest !== ignoreRef.current) return
        const pool =
          source === 'author' ? data.authors : data.contributors
        setHits(pool)
      } catch {
        if (myRequest === ignoreRef.current) setHits([])
      } finally {
        if (myRequest === ignoreRef.current) setLoading(false)
      }
    }, 250)

    return () => clearTimeout(handle)
  }, [query, source])

  // Close the dropdown when the user clicks outside.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const pick = (hit: AuthorHit | ContributorHit) => {
    setQuery(hit.name)
    setOpen(false)
    onPick(hit)
  }

  const createNew = () => {
    setOpen(false)
    onCreateNew?.(query.trim())
  }

  return (
    <div ref={wrapperRef} className="relative">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full px-3 py-2 pr-9 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <div className="absolute inset-y-0 right-2 flex items-center text-gray-400">
          {loading ? (
            <i className="fas fa-spinner fa-spin text-xs"></i>
          ) : query.trim().length >= 2 ? (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setHits([])
              }}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Clear search"
            >
              <i className="fas fa-times text-xs"></i>
            </button>
          ) : (
            <i className="fas fa-magnifying-glass text-xs"></i>
          )}
        </div>
      </div>

      {open && query.trim().length >= 2 && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-72 overflow-y-auto text-sm">
          {loading && hits.length === 0 ? (
            <div className="p-3 text-center text-gray-500">
              <i className="fas fa-spinner fa-spin mr-2"></i>
              Searching…
            </div>
          ) : hits.length === 0 ? (
            <div className="p-3 space-y-2">
              <p className="text-gray-500">
                No existing{' '}
                {source === 'author' ? 'author' : 'contributor'} matches
                <span className="font-mono font-semibold text-gray-700">
                  {' '}
                  {query.trim()}
                </span>
                .
              </p>
              {onCreateNew && (
                <button
                  type="button"
                  onClick={createNew}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded hover:bg-primary-100"
                >
                  <i className="fas fa-plus"></i>
                  Add new{' '}
                  {source === 'author' ? 'author' : 'contributor'}{' '}
                  <span className="font-mono">{query.trim()}</span>
                </button>
              )}
            </div>
          ) : (
            <ul>
              {hits.map((hit, idx) => {
                const isAuthor = source === 'author'
                return (
                  <li
                    key={`${hit.name}-${idx}`}
                    onClick={() => pick(hit)}
                    className="px-3 py-2 hover:bg-primary-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {hit.name}
                        </p>
                        <p className="text-[11px] text-gray-500 truncate">
                          {!isAuthor && (hit as ContributorHit).role}
                          {!isAuthor && (hit as ContributorHit).role && hit.dates ? ' • ' : ''}
                          {hit.dates}
                        </p>
                      </div>
                      <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                        <i className="fas fa-book mr-1"></i>
                        {hit.work_count}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
