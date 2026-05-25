import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Header } from '@/components/header'
import { CategoryBadge, SeverityBadge } from '@/components/badge'
import { MOCK_ARTICLES, MOCK_UPDATES, MOCK_REPOS } from '@/lib/mock-data'

function formatRelativeDate(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

const PREVIEW = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true'

export default async function DashboardPage() {
  let user = null
  let feed: Array<(typeof MOCK_ARTICLES[number] | typeof MOCK_UPDATES[number]) & { itemType: 'article' | 'update' }> = []
  let followedRepos: { owner: string; name: string; count: number }[] = []

  if (PREVIEW) {
    const mockFeed = [
      ...MOCK_ARTICLES.map((a) => ({ ...a, itemType: 'article' as const })),
      ...MOCK_UPDATES.map((u) => ({ ...u, itemType: 'update' as const })),
    ].sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
    feed = mockFeed

    const repoUpdateCounts: Record<string, number> = {}
    feed.forEach((item) => {
      const repo = item.repos as { owner: string; name: string } | null
      if (repo) {
        const key = `${repo.owner}/${repo.name}`
        repoUpdateCounts[key] = (repoUpdateCounts[key] ?? 0) + 1
      }
    })
    followedRepos = MOCK_REPOS.slice(0, 5).map((r) => ({
      owner: r.owner,
      name: r.name,
      count: repoUpdateCounts[`${r.owner}/${r.name}`] ?? 0,
    }))
  } else {
    const supabase = await createClient()
    const { data: { user: dbUser } } = await supabase.auth.getUser()
    user = dbUser

    const { data: follows } = user ? await supabase
      .from('follows')
      .select('repo_id, alert_threshold, repos(id, owner, name, full_name, description, language, stars)')
      .eq('user_id', user.id) : { data: [] }

    const repoIds = follows?.map((f: { repo_id: string }) => f.repo_id) ?? []

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

    const dbFeedRaw = [
      ...(articles ?? []).map((a: Record<string, unknown>) => ({ ...a, itemType: 'article' as const })),
      ...(updates ?? []).map((u: Record<string, unknown>) => ({ ...u, itemType: 'update' as const })),
    ].sort((a, b) => new Date((b as Record<string, unknown>).published_at as string).getTime() - new Date((a as Record<string, unknown>).published_at as string).getTime())

    if (dbFeedRaw.length > 0) {
      feed = dbFeedRaw as unknown as typeof feed
    } else {
      feed = [
        ...MOCK_ARTICLES.map((a) => ({ ...a, itemType: 'article' as const })),
        ...MOCK_UPDATES.map((u) => ({ ...u, itemType: 'update' as const })),
      ].sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
    }

    const repoUpdateCounts: Record<string, number> = {}
    feed.forEach((item) => {
      const repo = item.repos as { owner: string; name: string } | null
      if (repo) {
        const key = `${repo.owner}/${repo.name}`
        repoUpdateCounts[key] = (repoUpdateCounts[key] ?? 0) + 1
      }
    })

    const dbFollowedRepos = (follows ?? []).map((f: { repos: unknown }) => {
      const repo = f.repos as { id: string; owner: string; name: string } | null
      if (!repo) return null
      return { owner: repo.owner, name: repo.name, count: repoUpdateCounts[`${repo.owner}/${repo.name}`] ?? 0 }
    }).filter(Boolean) as { owner: string; name: string; count: number }[]

    followedRepos = dbFollowedRepos.length > 0 ? dbFollowedRepos : MOCK_REPOS.slice(0, 5).map((r) => ({
      owner: r.owner, name: r.name, count: repoUpdateCounts[`${r.owner}/${r.name}`] ?? 0,
    }))
  }

  return (
    <div className="min-h-screen bg-white">
      <Header user={user} />

      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex gap-12">
          {/* Main feed */}
          <main className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-8">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-0.5">
                  Your Feed
                </p>
                <p className="text-sm text-gray-500">Updates from your followed libraries</p>
              </div>
            </div>

            {feed.length === 0 ? (
              <div className="py-24 text-center">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-600 mb-1">Nothing followed yet</p>
                <p className="text-xs text-gray-400 mb-4">Import your package.json or follow repos manually</p>
                <Link href="/settings" className="text-sm text-blue-600 font-medium hover:text-blue-700">
                  Import dependencies →
                </Link>
              </div>
            ) : (
              <div className="space-y-px">
                {feed.map((item) => {
                  const repo = item.repos as { owner: string; name: string } | null
                  if (!repo) return null
                  const repoPath = `/${repo.owner}/${repo.name}`

                  return (
                    <div key={item.id} className="group relative bg-white hover:bg-gray-50/80 transition-colors rounded-xl px-4 py-4 -mx-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 mb-2">
                            <Link
                              href={repoPath}
                              className="text-[11px] font-mono text-gray-400 hover:text-blue-600 transition-colors"
                            >
                              {repo.owner}/{repo.name}
                            </Link>
                            <SeverityBadge severity={item.severity} />
                            {(item.categories ?? []).slice(0, 2).map((cat: string) => (
                              <CategoryBadge key={cat} type={cat} />
                            ))}
                            {item.itemType === 'article' && <CategoryBadge type="ARTICLE" />}
                          </div>
                          {item.itemType === 'article' ? (
                            <Link href={`/articles/${item.id}`} className="block">
                              <p className="text-[15px] font-medium text-[#111827] group-hover:text-blue-600 transition-colors leading-snug">
                                {item.one_liner}
                              </p>
                            </Link>
                          ) : (
                            <p className="text-sm text-gray-700 leading-snug">{item.one_liner}</p>
                          )}
                          <p className="mt-1.5 text-xs text-gray-400">
                            {item.published_at ? formatRelativeDate(item.published_at) : ''}
                          </p>
                        </div>
                        {item.itemType === 'article' && (
                          <svg className="w-4 h-4 text-gray-200 group-hover:text-blue-400 transition-colors mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </main>

          {/* Sidebar */}
          {followedRepos.length > 0 && (
            <aside className="w-56 shrink-0 hidden md:block">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-5">
                Your Libraries
              </p>
              <div className="space-y-1">
                {followedRepos.map((repo) => (
                  <Link
                    key={`${repo.owner}/${repo.name}`}
                    href={`/${repo.owner}/${repo.name}`}
                    className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 group transition-colors"
                  >
                    <span className="text-[13px] font-mono text-gray-600 group-hover:text-blue-600 transition-colors truncate">
                      {repo.name}
                    </span>
                    {repo.count > 0 && (
                      <span className="text-[11px] font-semibold text-white bg-blue-500 px-1.5 py-0.5 rounded-full ml-2 shrink-0">
                        {repo.count}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <Link
                  href="/settings"
                  className="flex items-center gap-2 text-xs text-gray-400 hover:text-blue-600 transition-colors font-medium"
                >
                  <span className="text-base leading-none">+</span> Follow more
                </Link>
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  )
}
