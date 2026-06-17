import Link from 'next/link'

export default function About() {
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
                href="/contact" 
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                Contact
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
            About DWCC AccessLib
          </h1>

          <div className="space-y-6 text-gray-700">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">
                Welcome to Our Digital Library
              </h2>
              <p>
                DWCC AccessLib is a comprehensive digital library access management system designed to provide 
                seamless access to our extensive book collection. Our platform serves as a bridge between 
                library users and the vast resources available in our institution.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">
                Our Mission
              </h2>
              <p>
                We are committed to democratizing access to knowledge by providing an intuitive, 
                user-friendly platform that makes browsing and discovering books effortless. 
                Our system is designed to enhance the library experience for both users and staff.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">
                Key Features
              </h2>
              <ul className="space-y-2 ml-6">
                <li className="flex items-start">
                  <i className="fas fa-check-circle text-green-600 mt-1 mr-3"></i>
                  <span>Browse available books by category and search functionality</span>
                </li>
                <li className="flex items-start">
                  <i className="fas fa-check-circle text-green-600 mt-1 mr-3"></i>
                  <span>View detailed book information including author, category, and availability status</span>
                </li>
                <li className="flex items-start">
                  <i className="fas fa-check-circle text-green-600 mt-1 mr-3"></i>
                  <span>Advanced search and filtering options for easy book discovery</span>
                </li>
                <li className="flex items-start">
                  <i className="fas fa-check-circle text-green-600 mt-1 mr-3"></i>
                  <span>Real-time availability updates and comprehensive book management</span>
                </li>
                <li className="flex items-start">
                  <i className="fas fa-check-circle text-green-600 mt-1 mr-3"></i>
                  <span>Staff management system for book tracking and user administration</span>
                </li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">
                How It Works
              </h2>
              <div className="grid md:grid-cols-3 gap-6 mt-4">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <i className="fas fa-search text-white"></i>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Browse & Search</h3>
                  <p className="text-sm text-gray-600">
                    Explore our collection using our intuitive search and category filters
                  </p>
                </div>
                
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <i className="fas fa-book text-white"></i>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">View Details</h3>
                  <p className="text-sm text-gray-600">
                    Get comprehensive information about any book in our collection
                  </p>
                </div>
                
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <i className="fas fa-users text-white"></i>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Contact Staff</h3>
                  <p className="text-sm text-gray-600">
                    Reach out to our library staff for borrowing requests and assistance
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">
                Technology & Innovation
              </h2>
              <p>
                Built with modern web technologies, DWCC AccessLib ensures a fast, reliable, and 
                secure experience. Our system is designed to be responsive and accessible across 
                all devices, making library resources available anytime, anywhere.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">
                Get Started
              </h2>
              <p>
                Ready to explore our book collection? Start browsing now or contact our staff 
                if you need assistance with borrowing or have any questions about our services.
              </p>
              <div className="flex gap-4 mt-4">
                <Link 
                  href="/" 
                  className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 transition-colors"
                >
                  Browse Books
                </Link>
                <Link 
                  href="/contact" 
                  className="border border-green-600 text-green-600 px-6 py-2 rounded-md hover:bg-green-50 transition-colors"
                >
                  Contact Us
                </Link>
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
              <Link href="/contact" className="hover:text-green-600 transition-colors">
                Contact Us
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
