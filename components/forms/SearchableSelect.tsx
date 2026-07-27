'use client'

import React, { useState, useRef, useEffect, useMemo } from 'react'

export interface SearchableSelectOption {
  value: string
  label: string
}

interface SearchableSelectProps {
  options: SearchableSelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  className?: string
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'None',
  searchPlaceholder = 'Search...',
  className = ''
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const selectedLabel = useMemo(() => {
    const found = options.find((o) => o.value === value)
    return found ? found.label : placeholder
  }, [options, value, placeholder])

  const filtered = useMemo(() => {
    if (!search) return options
    const q = search.toLowerCase()
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, search])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 0)
    }
  }, [open])

  const handleSelect = (val: string) => {
    onChange(val)
    setOpen(false)
    setSearch('')
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setSearch('') }}
        className="w-full px-3 py-2 border border-gray-300 rounded-md text-left bg-white text-sm flex items-center justify-between gap-2 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <span className={value ? 'text-gray-900' : 'text-gray-500'}>
          {selectedLabel}
        </span>
        <i className={`fas fa-chevron-down text-gray-400 text-xs transition-transform ${open ? 'rotate-180' : ''}`}></i>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-hidden flex flex-col">
          {/* Search input inside dropdown */}
          <div className="px-2 pt-2 pb-1 border-b border-gray-100 sticky top-0 bg-white">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          {/* Options list */}
          <div className="overflow-y-auto max-h-48">
            <button
              type="button"
              onClick={() => handleSelect('')}
              className={`w-full px-3 py-2 text-sm text-left hover:bg-blue-50 ${!value ? 'bg-blue-50 font-medium text-blue-700' : 'text-gray-700'}`}
            >
              {placeholder}
            </button>
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-400 italic">No matches</div>
            )}
            {filtered.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt.value)}
                className={`w-full px-3 py-2 text-sm text-left hover:bg-blue-50 ${opt.value === value ? 'bg-blue-50 font-medium text-blue-700' : 'text-gray-700'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
