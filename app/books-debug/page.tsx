'use client'

import { useState } from 'react'

export default function BooksDebugPage() {
  const [debugData, setDebugData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [fixLoading, setFixLoading] = useState(false)
  const [fixData, setFixData] = useState<any>(null)

  const testFetch = async () => {
    setLoading(true)
    try {
      console.log('Testing fetch...')
      const response = await fetch('/api/books/debug', {
        credentials: 'include'
      })
      
      console.log('Response status:', response.status)
      console.log('Response ok:', response.ok)
      
      const data = await response.json()
      console.log('Response data:', data)
      
      setDebugData({
        status: response.status,
        ok: response.ok,
        data: data
      })
    } catch (error) {
      console.error('Error:', error)
      setDebugData({
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setLoading(false)
    }
  }

  const fixBookStatus = async () => {
    setFixLoading(true)
    try {
      console.log('Fixing book status...')
      const response = await fetch('/api/books/fix-status', {
        method: 'POST',
        credentials: 'include'
      })
      
      const data = await response.json()
      console.log('Fix response:', data)
      
      setFixData({
        status: response.status,
        ok: response.ok,
        data: data
      })
    } catch (error) {
      console.error('Fix error:', error)
      setFixData({
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setFixLoading(false)
    }
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Books Debug Page</h1>
      
      <div className="space-y-4 mb-8">
        <button
          onClick={testFetch}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 mr-4"
        >
          {loading ? 'Testing...' : 'Test Book Fetch'}
        </button>
        
        <button
          onClick={fixBookStatus}
          disabled={fixLoading}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
        >
          {fixLoading ? 'Fixing...' : 'Fix Book Status Values'}
        </button>
      </div>

      {debugData && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-2">Debug Results:</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
            {JSON.stringify(debugData, null, 2)}
          </pre>
        </div>
      )}
      
      {fixData && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-2">Fix Results:</h2>
          <pre className="bg-green-100 p-4 rounded text-sm overflow-auto">
            {JSON.stringify(fixData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
