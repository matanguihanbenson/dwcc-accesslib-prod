'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/ui/icon'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SearchResult {
  type: 'book' | 'user' | 'locker'
  id: number
  title: string
  subtitle?: string
  url: string
}

export function HeaderSearch() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSelectedIndex(-1)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      if (query.trim().length >= 2) {
        performSearch(query)
      } else {
        setResults([])
      }
    }, 300)

    return () => clearTimeout(delayedSearch)
  }, [query])

  const performSearch = async (searchQuery: string) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&limit=8`, {
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        setResults(data.results || [])
      }
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && results[selectedIndex]) {
          navigateToResult(results[selectedIndex])
        }
        break
      case 'Escape':
        setIsOpen(false)
        setSelectedIndex(-1)
        inputRef.current?.blur()
        break
    }
  }

  const navigateToResult = (result: SearchResult) => {
    router.push(result.url)
    setIsOpen(false)
    setQuery('')
    setSelectedIndex(-1)
    inputRef.current?.blur()
  }

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'book': return 'fa-book'
      case 'user': return 'fa-user'
      case 'locker': return 'fa-lock'
      default: return 'fa-search'
    }
  }

  const getResultTypeColor = (type: string) => {
    switch (type) {
      case 'book': return 'text-blue-600'
      case 'user': return 'text-green-600'
      case 'locker': return 'text-purple-600'
      default: return 'text-gray-600'
    }
  }

  return (
    <div className="relative flex-1 max-w-md" ref={dropdownRef}>
      <div className="relative">
        <Icon 
          name="fa-search" 
          size="sm" 
          className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" 
        />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search books, users, lockers..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
            setSelectedIndex(-1)
          }}
          onFocus={() => {
            setIsOpen(true)
            if (query.trim().length >= 2) {
              performSearch(query)
            }
          }}
          onKeyDown={handleKeyDown}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          </div>
        )}
      </div>

      {isOpen && (query.trim().length >= 2 || results.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
          {loading ? (
            <div className="p-3 text-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-xs text-gray-500 mt-1">Searching...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="p-3 text-center">
              <Icon name="fa-search" size="lg" className="text-gray-400 mb-1" />
              <p className="text-sm text-gray-500">
                {query.trim().length < 2 ? 'Type at least 2 characters' : 'No results found'}
              </p>
            </div>
          ) : (
            results.map((result, index) => (
              <div
                key={`${result.type}-${result.id}`}
                className={cn(
                  'p-3 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors',
                  index === selectedIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
                )}
                onClick={() => navigateToResult(result)}
              >
                <div className="flex items-center space-x-3">
                  <Icon 
                    name={getResultIcon(result.type)} 
                    size="sm" 
                    className={cn('flex-shrink-0', getResultTypeColor(result.type))}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {result.title}
                    </p>
                    {result.subtitle && (
                      <p className="text-xs text-gray-500 truncate">
                        {result.subtitle}
                      </p>
                    )}
                  </div>
                  <span className={cn(
                    'text-xs px-2 py-1 rounded-full capitalize font-medium',
                    result.type === 'book' && 'bg-blue-100 text-blue-700',
                    result.type === 'user' && 'bg-green-100 text-green-700',
                    result.type === 'locker' && 'bg-purple-100 text-purple-700'
                  )}>
                    {result.type}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
