import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { Header } from '@/components/header'
import { CategoryBadge, SeverityBadge } from '@/components/badge'
import { MOCK_REPOS, MOCK_ARTICLES, MOCK_UPDATES } from '@/lib/mock-data'

const PREVIEW = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true'

interface Props {
  params: Promise<{ owner: string; repo: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { owner, repo } = await params
  return {
    title: `${owner}/${repo} — Changeblog`,
    description: `Release changelog for ${owner}/${repo}`,
  }
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

export default async function RepoPage({ params }: Props) {
  const { owner, repo: repoName } = await params

  let user = null
  let repo: (typeof MOCK_REPOS[number]) | null = null
  let feed: Array<(typeof MOCK_ARTICLES[number] | typeof MOCK_UPDATES[number]) & { itemType: 'article' | 'update' }> = []

  if (PREVIEW) {
    repo = MOCK_REPOS.find((r) => r.owner === owner && r.name === repoName) ?? null
    if (!repo) notFound()
    feed = [
      ...MOCK_ARTICLES.filter((a) => a.repos.owner === owner && a.repos.name === repoName).map((a) => ({ ...a, itemType: 'article' as const })),
      ...MOCK_UPDATES.filter((u) => u.repos.owner === owner && u.repos.name === repoName).map((u) => ({ ...u, itemType: 'update' as const })),
    ].sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
  } else {
    const supabase = await createClient()
    const { data: { user: dbUser } } = await supabase.auth.getUser()
    user = dbUser

    const { data: dbRepo } = await supabase
      .from('repos')
      .select('*')
      .eq('owner', owner)
      .eq('name', repoName)
      .single()

    repo = dbRepo
      ? { ...dbRepo, description: dbRepo.description ?? '', language: dbRepo.language ?? '' }
      : MOCK_REPOS.find((r) => r.owner === owner && r.name === repoName) ?? null
    if (!repo) notFound()

    const { data: articles } = await supabase
      .from('articles')
      .select('*')
      .eq('repo_id', repo.id)
      .eq('is_quarantined', false)
      .not('published_at', 'is', null)
      .order('published_at', { ascending: false })
      .limit(20)

    const { data: updates } = await supabase
      .from('updates')
      .select('*')
      .eq('repo_id', repo.id)
      .not('published_at', 'is', null)
      .order('published_at', { ascending: false })
      .limit(20)

    const dbFeed = [
      ...(articles ?? []).map((a) => ({ ...a, itemType: 'article' as const })),
      ...(updates ?? []).map((u) => ({ ...u, itemType: 'update' as const })),
    ].sort((a, b) => new Date(b.published_at!).getTime() - new Date(a.published_at!).getTime())

    const mockFeed = [
      ...MOCK_ARTICLES.filter((a) => a.repos.owner === owner && a.repos.name === repoName).map((a) => ({ ...a, itemType: 'article' as const })),
      ...MOCK_UPDATES.filter((u) => u.repos.owner === owner && u.repos.name === repoName).map((u) => ({ ...u, itemType: 'update' as const })),
    ].sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())

    feed = dbFeed.length > 0 ? (dbFeed as unknown as typeof feed) : mockFeed
  }

  const latestPublishedAt = feed[0]?.published_at

  return (
    <div className="min-h-screen bg-white">
      <Header user={user} />

      {/* Repo hero band */}
      <div className="border-b border-gray-100 bg-gray-50/50">
        <div className="max-w-2xl mx-auto px-6 py-10">
          <div className="flex items-start justify-between gap-6">
            <div>
              {/* Package name */}
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
                  <span className="text-white text-xs font-bold">{repoName[0].toUpperCase()}</span>
                </div>
                <h1 className="text-2xl font-bold text-[#111827] tracking-tight">
                  {repoName}
                </h1>
              </div>
              <p className="text-sm text-gray-500 font-mono mb-3">{owner}/{repoName}</p>
              {repo.description && (
                <p className="text-sm text-gray-600 leading-relaxed max-w-sm">{repo.description}</p>
              )}
              <div className="flex items-center gap-4 mt-4">
                {repo.language && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 bg-white border border-gray-200 px-2.5 py-1 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    {repo.language}
                  </span>
                )}
                {(repo as { stars?: number }).stars && (repo as { stars: number }).stars > 0 && (
                  <span className="text-xs text-gray-500 bg-white border border-gray-200 px-2.5 py-1 rounded-full">
                    ★ {(repo as { stars: number }).stars.toLocaleString()}
                  </span>
                )}
                {latestPublishedAt && (
                  <span className="text-xs text-gray-400">
                    Updated {formatRelativeDate(latestPublishedAt)}
                  </span>
                )}
              </div>
            </div>
            <FollowButton repoId={repo.id} />
          </div>
        </div>
      </div>

      {/* Feed */}
      <div className="max-w-2xl mx-auto px-6 py-10">
        {feed.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-sm text-gray-400">No changelogs yet — check back soon.</p>
          </div>
        ) : (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-8">
              Changelog
            </p>
            <div className="space-y-px">
              {feed.map((item) => (
                <div key={item.id} className="group relative bg-white hover:bg-gray-50/80 transition-colors rounded-xl px-4 py-4 -mx-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-2">
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
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function FollowButton({ repoId }: { repoId: string }) {
  return (
    <form action="/api/follows" method="POST">
      <input type="hidden" name="repoId" value={repoId} />
      <button
        type="submit"
        className="text-sm px-4 py-1.5 border border-gray-200 text-gray-700 rounded-md hover:bg-gray-50 font-medium shrink-0"
      >
        Follow
      </button>
    </form>
  )
}
