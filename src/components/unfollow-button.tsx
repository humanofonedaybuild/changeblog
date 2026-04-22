'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function UnfollowButton({ repoId }: { repoId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleUnfollow() {
    setLoading(true)
    await fetch('/api/follows', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoId }),
    })
    setLoading(false)
    router.refresh()
  }

  return (
    <button
      onClick={handleUnfollow}
      disabled={loading}
      className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
    >
      {loading ? '…' : 'Unfollow'}
    </button>
  )
}
