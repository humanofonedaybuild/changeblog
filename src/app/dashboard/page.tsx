import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: follows } = await supabase
    .from('follows')
    .select('repo_id, alert_threshold, repos(id, owner, name, full_name, description, language, stars)')
    .eq('user_id', user.id)

  const repoIds = follows?.map((f) => f.repo_id) ?? []

  const { data: articles } = repoIds.length
    ? await supabase
        .from('articles')
        .select('id, title, one_liner, severity, categories, published_at, repos(owner, name)')
        .in('repo_id', repoIds)
        .eq('is_quarantined', false)
        .not('published_at', 'is', null)
        .order('published_at', { ascending: false })
        .limit(30)
    : { data: [] }

  const { data: updates } = repoIds.length
    ? await supabase
        .from('updates')
        .select('id, one_liner, severity, categories, published_at, repos(owner, name)')
        .in('repo_id', repoIds)
        .not('published_at', 'is', null)
        .order('published_at', { ascending: false })
        .limit(30)
    : { data: [] }

  const feed = [
    ...(articles ?? []).map((a) => ({ ...a, itemType: 'article' as const })),
    ...(updates ?? []).map((u) => ({ ...u, itemType: 'update' as const })),
  ].sort((a, b) => new Date(b.published_at!).getTime() - new Date(a.published_at!).getTime())

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-semibold text-gray-900">Your feed</h1>
        <Link href="/settings" className="text-sm text-gray-500 hover:text-gray-900">Settings</Link>
      </div>

      {repoIds.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg mb-2">Nothing here yet</p>
          <p className="text-sm">Follow some repos to see their changelogs</p>
          <Link href="/explore" className="mt-4 inline-block text-blue-600 hover:underline text-sm">
            Browse popular repos →
          </Link>
        </div>
      ) : feed.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-sm">No updates in the last 30 days from your followed repos.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {feed.map((item) => (
            <FeedItem key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}

function FeedItem({ item }: { item: any }) {
  const repo = item.repos
  const repoPath = `/${repo.owner}/${repo.name}`
  const severityColor = getSeverityColor(item.severity)

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 hover:border-gray-200 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Link href={repoPath} className="text-xs text-gray-500 hover:text-gray-900 font-mono">
              {repo.owner}/{repo.name}
            </Link>
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${severityColor}`}>
              S{item.severity}
            </span>
            {item.itemType === 'article' && (
              <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">Article</span>
            )}
          </div>
          {item.itemType === 'article' ? (
            <Link href={`${repoPath}#${item.id}`} className="block">
              <p className="text-sm font-medium text-gray-900 hover:text-blue-600">{item.one_liner}</p>
            </Link>
          ) : (
            <p className="text-sm text-gray-700">{item.one_liner}</p>
          )}
          <div className="flex flex-wrap gap-1 mt-2">
            {(item.categories ?? []).map((cat: string) => (
              <span key={cat} className="text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
                {cat}
              </span>
            ))}
          </div>
        </div>
        <time className="text-xs text-gray-400 whitespace-nowrap mt-0.5">
          {formatRelativeDate(item.published_at)}
        </time>
      </div>
    </div>
  )
}

function getSeverityColor(severity: number): string {
  if (severity >= 4) return 'bg-red-50 text-red-700'
  if (severity === 3) return 'bg-orange-50 text-orange-700'
  if (severity === 2) return 'bg-yellow-50 text-yellow-700'
  return 'bg-gray-50 text-gray-600'
}

function formatRelativeDate(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}
