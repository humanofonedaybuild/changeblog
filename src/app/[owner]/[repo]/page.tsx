import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

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

export default async function RepoPage({ params }: Props) {
  const { owner, repo: repoName } = await params
  const supabase = await createClient()

  const { data: repo } = await supabase
    .from('repos')
    .select('*')
    .eq('owner', owner)
    .eq('name', repoName)
    .single()

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

  const feed = [
    ...(articles ?? []).map((a) => ({ ...a, itemType: 'article' as const })),
    ...(updates ?? []).map((u) => ({ ...u, itemType: 'update' as const })),
  ].sort((a, b) => new Date(b.published_at!).getTime() - new Date(a.published_at!).getTime())

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {owner}/{repoName}
            </h1>
            {repo.description && (
              <p className="text-gray-500 mt-1 text-sm">{repo.description}</p>
            )}
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
              {repo.language && <span>{repo.language}</span>}
              {repo.stars > 0 && <span>★ {repo.stars.toLocaleString()}</span>}
            </div>
          </div>
          <FollowButton repoId={repo.id} repoFullName={`${owner}/${repoName}`} />
        </div>
      </div>

      {feed.length === 0 ? (
        <div className="text-center py-20 text-gray-400 text-sm">
          No changelogs yet — check back soon.
        </div>
      ) : (
        <div className="space-y-8">
          {feed.map((item) =>
            item.itemType === 'article' ? (
              <ArticleCard key={item.id} article={item} />
            ) : (
              <UpdateCard key={item.id} update={item} />
            )
          )}
        </div>
      )}
    </div>
  )
}

function ArticleCard({ article }: { article: any }) {
  const severityColor = getSeverityColor(article.severity)
  return (
    <article id={article.id} className="bg-white border border-gray-100 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-xs font-medium px-2 py-0.5 rounded ${severityColor}`}>
          Severity {article.severity}
        </span>
        {(article.categories ?? []).map((cat: string) => (
          <span key={cat} className="text-xs bg-gray-50 text-gray-500 px-1.5 py-0.5 rounded">
            {cat}
          </span>
        ))}
        <time className="text-xs text-gray-400 ml-auto">
          {new Date(article.published_at).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
          })}
        </time>
      </div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">{article.one_liner}</h2>
      <div className="space-y-4 mt-4 text-sm text-gray-700">
        <div>
          <h3 className="font-medium text-gray-900 mb-1">What changed</h3>
          <p className="leading-relaxed">{article.what_changed}</p>
        </div>
        <div>
          <h3 className="font-medium text-gray-900 mb-1">What to do</h3>
          <p className="leading-relaxed">{article.what_to_do}</p>
        </div>
        {article.citations?.length > 0 && (
          <div>
            <h3 className="font-medium text-gray-900 mb-1">Sources</h3>
            <ul className="space-y-1">
              {article.citations.map((c: any, i: number) => (
                <li key={i} className="text-xs text-gray-500">
                  <span className="font-medium">{c.claim}</span>
                  {c.source_excerpt && <span className="italic"> — "{c.source_excerpt}"</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </article>
  )
}

function UpdateCard({ update }: { update: any }) {
  const severityColor = getSeverityColor(update.severity)
  return (
    <div className="flex items-start gap-3 px-2">
      <span className={`text-xs font-medium px-1.5 py-0.5 rounded mt-0.5 ${severityColor}`}>
        S{update.severity}
      </span>
      <div className="flex-1">
        <p className="text-sm text-gray-700">{update.one_liner}</p>
        <div className="flex items-center gap-2 mt-1">
          {(update.categories ?? []).map((cat: string) => (
            <span key={cat} className="text-xs text-gray-400">{cat}</span>
          ))}
          <time className="text-xs text-gray-400 ml-auto">
            {new Date(update.published_at).toLocaleDateString()}
          </time>
        </div>
      </div>
    </div>
  )
}

function FollowButton({ repoId, repoFullName }: { repoId: string; repoFullName: string }) {
  return (
    <form action="/api/follows" method="POST">
      <input type="hidden" name="repoId" value={repoId} />
      <button
        type="submit"
        className="text-sm px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
      >
        Follow
      </button>
    </form>
  )
}

function getSeverityColor(severity: number): string {
  if (severity >= 4) return 'bg-red-50 text-red-700'
  if (severity === 3) return 'bg-orange-50 text-orange-700'
  if (severity === 2) return 'bg-yellow-50 text-yellow-700'
  return 'bg-gray-50 text-gray-600'
}
