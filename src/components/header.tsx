'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { NavDrawer } from './nav-drawer'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

interface HeaderProps {
  user?: User | null
}

export function Header({ user }: HeaderProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const initials = user?.email ? user.email[0].toUpperCase() : 'U'

  return (
    <>
      <NavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <header className="fixed top-0 left-0 right-0 z-20 bg-white/90 backdrop-blur-md border-b border-gray-100 h-14 flex items-center px-6">
        {/* Hamburger */}
        <button
          onClick={() => setDrawerOpen(true)}
          className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
          aria-label="Open menu"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Center: logo */}
        <div className="flex-1 flex justify-center">
          <Link
            href="/"
            className="text-[#111827] font-semibold text-[15px] tracking-[-0.3px] hover:text-blue-600 transition-colors"
          >
            Changeblog
          </Link>
        </div>

        {/* Right: auth */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen((o) => !o)}
                className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm"
                aria-label="Account menu"
              >
                {initials}
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-lg shadow-gray-100/80 py-1.5 text-sm z-50">
                  <Link
                    href="/settings"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-gray-400">⚙</span> Account
                  </Link>
                  <Link
                    href="/upgrade"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-gray-400">✦</span> Billing
                  </Link>
                  <div className="border-t border-gray-100 my-1" />
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
                  >
                    <span className="text-gray-400">↗</span> Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm text-gray-500 hover:text-gray-900 font-medium transition-colors"
              >
                Log in
              </Link>
              <Link
                href="/login"
                className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm"
              >
                Sign up free
              </Link>
            </>
          )}
        </div>
      </header>

      <div className="h-14" />
    </>
  )
}
