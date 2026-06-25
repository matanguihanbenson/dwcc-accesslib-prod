"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PublicHeader } from "@/components/layout/PublicHeader";
import Image from "next/image";
import dwccLogo from "@/public/dwcc-logo.png";
import dwccAcd from "@/public/dwcc-acd.png";

interface Suggestion {
  id: number;
  title: string;
  author: string;
  category: string;
  section?: string;
  location?: string;
  url: string;
}

const MAX_SUGGESTIONS = 5;

export default function HomePage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Position of the autocomplete dropdown. Calculated from
  // the input's bounding rect and updated on scroll/resize
  // so the dropdown stays anchored to the input even when
  // the user scrolls the page. Rendered via portal so it's
  // never clipped by an ancestor's `overflow: hidden`.
  const [dropdownPos, setDropdownPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  // Fetch autocomplete suggestions
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (searchTerm.length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      setLoadingSuggestions(true);
      try {
        const response = await fetch(
          `/api/public/autocomplete?q=${encodeURIComponent(searchTerm)}`,
        );
        if (response.ok) {
          const data = await response.json();
          // Hard-cap to MAX_SUGGESTIONS rows so the dropdown
          // stays compact and predictable.
          setSuggestions((data.suggestions || []).slice(0, MAX_SUGGESTIONS));
          setShowSuggestions(true);
        }
      } catch (error) {
        // ignore network errors
      } finally {
        setLoadingSuggestions(false);
      }
    };

    const debounceTimer = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm]);

  // Re-anchor the dropdown to the input on scroll and resize
  // so it follows the input position. Uses `capture: true`
  // on scroll so we catch scrolling on any ancestor.
  const updateDropdownPos = useCallback(() => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 8, // mt-2
        left: rect.left,
        width: rect.width,
      });
    }
  }, []);

  useEffect(() => {
    if (!showSuggestions) {
      setDropdownPos(null);
      return;
    }
    updateDropdownPos();
    window.addEventListener("scroll", updateDropdownPos, true);
    window.addEventListener("resize", updateDropdownPos);
    return () => {
      window.removeEventListener("scroll", updateDropdownPos, true);
      window.removeEventListener("resize", updateDropdownPos);
    };
  }, [showSuggestions, updateDropdownPos]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (searchRef.current && !searchRef.current.contains(target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchTerm)}`);
    }
  };

  const handleSuggestionClick = (url: string) => {
    setShowSuggestions(false);
    router.push(url);
  };

  return (
    <div
      style={{
        backgroundImage: `url(${dwccAcd.src})`,
        backgroundPosition: "55% 45%",
        backgroundSize: "cover",
      }}
      className="h-dvh !overflow-hidden top-0 z-0 absolute w-full"
    >
      <PublicHeader showBrowseLink={true} />
      <div className=""></div>
      <main className="">
        {/* Hero Section */}
        <section className="relative">
          {/* Decorative background */}
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 overflow-hidden h-dvh"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-primary-400/40 to-primary-100/90" />
          </div>

          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-10 sm:pt-16 sm:pb-12">
            <div className="text-center">
              <Image
                alt="Divine Word College of Calapan"
                src={dwccLogo}
                width={150}
                height={150}
                className="mx-auto"
              />
              {/* Eyebrow tag */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-100 text-primary-700 text-xs font-semibold uppercase tracking-wider mb-5">
                DWCC Library
              </div>

              {/* Search Section */}
              <div className="max-w-3xl mx-auto" ref={searchRef}>
                <form onSubmit={handleSearch}>
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <div className="flex-1 relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <i className="fas fa-search text-gray-400"></i>
                      </div>
                      <input
                        ref={inputRef}
                        type="text"
                        placeholder="Search by title, author, ISBN, or keyword…"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onFocus={() =>
                          searchTerm.length >= 2 && setShowSuggestions(true)
                        }
                        className="w-full pl-11 pr-4 py-3.5 text-base border border-gray-200 rounded-xl bg-white shadow-sm hover:border-gray-300 transition-colors focus:outline-none focus:border-primary-500 focus:ring-0"
                      />
                    </div>
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-primary-600 text-white text-base font-semibold rounded-xl hover:bg-primary-700 focus:outline-none focus:ring-0 transition-colors shadow-sm hover:shadow-md"
                    >
                      <i className="fas fa-search"></i>
                      <span>Search</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t absolute bottom-0 w-full">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-center sm:text-left">
            <p className="text-sm text-gray-600">
              Digital library access management system for{" "}
              <span className="font-semibold text-gray-800">
                Divine Word College of Calapan
              </span>
              .
            </p>
            <p className="text-xs text-gray-500">
              &copy; {new Date().getFullYear()} DWCC AccessLib. All rights
              reserved.
            </p>
          </div>
        </div>
      </footer>

      {showSuggestions &&
        typeof document !== "undefined" &&
        dropdownPos &&
        createPortal(
          <div
            className="fixed z-50 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-80 overflow-y-auto text-left"
            style={{
              top: dropdownPos.top,
              left: dropdownPos.left,
              width: dropdownPos.width,
            }}
          >
            {loadingSuggestions ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                <i className="fas fa-spinner fa-spin mr-2"></i>
                Loading suggestions…
              </div>
            ) : suggestions.length > 0 ? (
              <ul>
                {suggestions.map((suggestion) => (
                  <li
                    key={suggestion.id}
                    onClick={() => handleSuggestionClick(suggestion.url)}
                    className="px-4 py-3 hover:bg-primary-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors"
                  >
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {suggestion.title}
                    </p>
                    <p className="text-xs text-gray-600 truncate mt-0.5">
                      by {suggestion.author}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span className="inline-block px-2 py-0.5 text-xs font-medium rounded bg-primary-100 text-primary-700">
                        {suggestion.category}
                      </span>
                      {suggestion.section && (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-800">
                          <i className="fas fa-bookmark mr-1"></i>
                          {suggestion.section}
                        </span>
                      )}
                      {suggestion.location && (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-amber-100 text-amber-800">
                          <i className="fas fa-map-marker-alt mr-1"></i>
                          {suggestion.location}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-4 text-center text-gray-500 text-sm">
                No suggestions found
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
