'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { PublicHeader } from '@/components/layout/PublicHeader'

interface Suggestion {
  id: number
  title: string
  author: string
  category: string
  section?: string
  location?: string
  url: string
}

export default function HomePage() {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  // Fetch autocomplete suggestions
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (searchTerm.length < 2) {
        setSuggestions([])
        setShowSuggestions(false)
        return
      }

      setLoadingSuggestions(true)
      try {
        const response = await fetch(`/api/public/autocomplete?q=${encodeURIComponent(searchTerm)}`)
        if (response.ok) {
          const data = await response.json()
          setSuggestions(data.suggestions || [])
          setShowSuggestions(true)
        }
      } catch (error) {
      } finally {
        setLoadingSuggestions(false)
      }
    }

    const debounceTimer = setTimeout(fetchSuggestions, 300)
    return () => clearTimeout(debounceTimer)
  }, [searchTerm])

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchTerm.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchTerm)}`)
    }
  }

  const handleSuggestionClick = (url: string) => {
    setShowSuggestions(false)
    router.push(url)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50">
      <PublicHeader showBrowseLink={true} />

      {/* Hero Section */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Welcome to <span className="text-green-600">DWCC AccessLib</span>
          </h1>
          <p className="text-sm text-gray-500">
            Search, discover, and explore thousands of books available in our library
          </p>
        </div>

        {/* Search Section */}
        <div className="max-w-3xl mx-auto mb-8" ref={searchRef}>
          <form onSubmit={handleSearch} className="relative">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Search by title, author, or keyword..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={() => searchTerm.length >= 2 && setShowSuggestions(true)}
                  className="w-full px-5 py-3 text-base border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent shadow-sm"
                />
                
                {/* Autocomplete Dropdown */}
                {showSuggestions && (
                  <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto">
                    {loadingSuggestions ? (
                      <div className="p-4 text-center text-gray-500">
                        <i className="fas fa-spinner fa-spin mr-2"></i>
                        Loading suggestions...
                      </div>
                    ) : suggestions.length > 0 ? (
                      <ul>
                        {suggestions.map((suggestion) => (
                          <li
                            key={suggestion.id}
                            onClick={() => handleSuggestionClick(suggestion.url)}
                            className="px-4 py-3 hover:bg-green-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors"
                          >
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {suggestion.title}
                            </p>
                            <p className="text-xs text-gray-600 truncate mt-0.5">
                              by {suggestion.author}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <span className="inline-block px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-800">
                                {suggestion.category}
                              </span>
                              {suggestion.section && (
                                <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-800">
                                  <i className="fas fa-bookmark mr-1"></i>
                                  {suggestion.section}
                                </span>
                              )}
                              {suggestion.location && (
                                <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-orange-100 text-orange-800">
                                  <i className="fas fa-map-marker-alt mr-1"></i>
                                  {suggestion.location}
                                </span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="p-4 text-center text-gray-500">
                        No suggestions found
                      </div>
                    )}
                  </div>
                )}
              </div>
              <button
                type="submit"
                className="px-6 py-3 bg-green-600 text-white text-base font-semibold rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors shadow-sm"
              >
                <i className="fas fa-search mr-2"></i>
                Search
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">
              Digital library access management system for Divine Word College of Calapan
            </p>
            <p className="text-gray-500 text-xs">
              &copy; 2025 DWCC AccessLib. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
