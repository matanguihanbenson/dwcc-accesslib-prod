'use client'

import Link from 'next/link'

export function PublicFooter() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-gray-900 text-white mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* About Section */}
          <div>
            <h3 className="text-lg font-semibold mb-4">DWCC AccessLib</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Digital library management system for Divine Word College of Calapan. 
              Browse our collection and manage your library activities.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/browse" className="text-gray-400 hover:text-white transition-colors">
                  <i className="fas fa-book mr-2"></i>Browse Books
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-gray-400 hover:text-white transition-colors">
                  <i className="fas fa-info-circle mr-2"></i>About Us
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-gray-400 hover:text-white transition-colors">
                  <i className="fas fa-envelope mr-2"></i>Contact
                </Link>
              </li>
              <li>
                <Link href="/login" className="text-gray-400 hover:text-white transition-colors">
                  <i className="fas fa-sign-in-alt mr-2"></i>Staff Login
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Contact Us</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex items-start">
                <i className="fas fa-map-marker-alt mt-1 mr-2"></i>
                <span>Divine Word College of Calapan<br/>Calapan City, Oriental Mindoro</span>
              </li>
              <li>
                <i className="fas fa-phone mr-2"></i>
                <span>(043) 288-4276</span>
              </li>
              <li>
                <i className="fas fa-envelope mr-2"></i>
                <a href="mailto:library@dwcc.edu.ph" className="hover:text-white transition-colors">
                  library@dwcc.edu.ph
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 pt-8 border-t border-gray-800">
          <div className="flex flex-col md:flex-row justify-between items-center text-sm text-gray-400">
            <p>© {currentYear} Divine Word College of Calapan. All rights reserved.</p>
            <div className="flex items-center space-x-4 mt-4 md:mt-0">
              <Link href="/privacy" className="hover:text-white transition-colors">
                Privacy Policy
              </Link>
              <span>•</span>
              <Link href="/terms" className="hover:text-white transition-colors">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
