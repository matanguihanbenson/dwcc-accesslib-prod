'use client'

import Link from 'next/link'

export default function Contact() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <Link href="/" className="text-2xl font-bold text-green-600 hover:text-green-800 transition-colors">
                DWCC AccessLib
              </Link>
            </div>
            <div className="flex space-x-4">
              <Link 
                href="/" 
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                Browse Books
              </Link>
              <Link 
                href="/about" 
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                About
              </Link>
              <Link 
                href="/login" 
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
              >
                Staff Login
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            Contact Us
          </h1>
          
          <div className="space-y-8 text-gray-700">
            <p className="text-lg">
              We're here to help you with any questions about our library services, 
              book borrowing, or technical assistance. Feel free to reach out through 
              any of the methods below.
            </p>
            
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">
                  Library Location
                </h2>
                <p className="text-gray-700">
                  Divine Word College of Calapan<br />
                  Main Building, 2nd Floor
                </p>
              </div>
              
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">
                  Opening Hours
                </h2>
                <p className="text-gray-700">
                  Monday to Friday:<br />
                  8:00 AM – 5:00 PM
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-500 text-sm">
            <p>&copy; 2025 DWCC AccessLib. All rights reserved.</p>
            <div className="mt-4 flex justify-center space-x-4">
              <Link href="/" className="hover:text-green-600 transition-colors">
                Home
              </Link>
              <Link href="/about" className="hover:text-green-600 transition-colors">
                About AccessLib
              </Link>
              <Link href="/login" className="hover:text-green-600 transition-colors">
                Staff Login
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
