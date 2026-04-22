'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function ImportForm() {
  const [fileType, setFileType] = useState<'package.json' | 'requirements.txt' | 'go.mod'>('package.json')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ count: number; followed: string[] } | null>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setResult(null)
    const res = await fetch('/api/import-deps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, fileType }),
    })
    const data = await res.json()
    setLoading(false)
    if (res.ok) {
      setResult(data)
      setContent('')
      router.refresh()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <select
        value={fileType}
        onChange={(e) => setFileType(e.target.value as typeof fileType)}
        className="text-sm border border-gray-200 rounded px-2 py-1.5 w-full"
      >
        <option value="package.json">package.json</option>
        <option value="requirements.txt">requirements.txt</option>
        <option value="go.mod">go.mod</option>
      </select>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={6}
        placeholder="Paste file contents here…"
        className="w-full text-xs font-mono border border-gray-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="submit"
        disabled={loading || !content.trim()}
        className="text-sm px-4 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
      >
        {loading ? 'Importing…' : 'Import & follow'}
      </button>
      {result && (
        <p className="text-xs text-green-700">
          Followed {result.count} repo{result.count !== 1 ? 's' : ''}
        </p>
      )}
    </form>
  )
}
