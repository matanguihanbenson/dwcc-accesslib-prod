'use client'

import { Input } from '@/components/ui/input'

interface User {
  user_id: number
  full_name: string
  account_id: string
  user_type: string
  department?: string
  program?: string
}

interface UserSearchInputProps {
  value: string
  onChange: (value: string) => void
  selectedUser: User | null
  onSelectUser: (user: User | null) => void
  searchResults: User[]
  isSearching: boolean
  label?: string
  placeholder?: string
  helperText?: string
}

export function UserSearchInput({
  value,
  onChange,
  selectedUser,
  onSelectUser,
  searchResults,
  isSearching,
  label = 'Search Student/User (ID Number or Name)',
  placeholder = 'Enter ID number or name...',
  helperText = 'Search and select a student/user'
}: UserSearchInputProps) {
  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      <Input
        type="text"
        placeholder={placeholder}
        className="w-full"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      
      {selectedUser && (
        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-900">{selectedUser.full_name}</p>
            <p className="text-xs text-blue-700">
              {selectedUser.account_id} - {selectedUser.user_type}
            </p>
          </div>
          <button
            onClick={() => {
              onSelectUser(null)
              onChange('')
            }}
            className="text-blue-600 hover:text-blue-800"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}
      
      {searchResults.length > 0 && !selectedUser && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {searchResults.map((user) => (
            <button
              key={user.user_id}
              onClick={() => {
                onSelectUser(user)
                onChange('')
              }}
              className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0"
            >
              <p className="text-sm font-medium text-gray-900">{user.full_name}</p>
              <p className="text-xs text-gray-600">
                {user.account_id} - {user.user_type}
              </p>
              {user.department && (
                <p className="text-xs text-gray-500">{user.department}</p>
              )}
            </button>
          ))}
        </div>
      )}
      
      {isSearching && (
        <div className="mt-2 text-sm text-gray-500">
          <i className="fas fa-spinner fa-spin mr-2"></i>Searching...
        </div>
      )}
      
      <p className="mt-1 text-xs text-gray-500">{helperText}</p>
    </div>
  )
}
