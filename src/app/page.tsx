import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/header'
import { CategoryBadge, SeverityBadge } from '@/components/badge'
import { MOCK_ARTICLES } from '@/lib/mock-data'

function formatRelativeDate(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

const PREVIEW = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true'

export default async function HomePage() {
  let user = null
  let articles = MOCK_ARTICLES

  if (!PREVIEW) {
    const supabase = await createClient()
    const { data: { user: dbUser } } = await supabase.auth.getUser()
    user = dbUser
    const { data: dbArticles } = await supabase
      .from('articles')
      .select('id, title, one_liner, severity, categories, published_at, repos(owner, name)')
      .eq('is_quarantined', false)
      .not('published_at', 'is', null)
      .order('severity', { ascending: false })
      .order('published_at', { ascending: false })
      .limit(10)
    if (dbArticles && dbArticles.length > 0) articles = dbArticles as unknown as typeof MOCK_ARTICLES
  }

  return (
    <div className="min-h-screen">
      <Header user={user} />

      {/* Hero */}
      <section className="relative overflow-hidden bg-white">
        {/* Subtle radial gradient background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(59,130,246,0.08) 0%, transparent 70%)',
          }}
        />

        <div className="relative max-w-2xl mx-auto px-6 pt-20 pb-16 text-center">
          {/* Eyebrow label */}
          <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 text-blue-600 text-xs font-semibold px-3 py-1.5 rounded-full mb-6 tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Open source intelligence, automated
          </div>

          <h1 className="text-5xl font-bold text-[#111827] leading-[1.1] tracking-tight">
            Every release,{' '}
            <span
              className="relative inline-block"
              style={{
                background: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              actually explained
            </span>
          </h1>

          <p className="mt-5 text-lg text-gray-500 leading-relaxed max-w-lg mx-auto">
            Changeblog reads every release note, classifies every change, and delivers
            the ones that matter — straight to your inbox.
          </p>

          <div className="mt-8 flex items-center justify-center gap-3">
            <Link
              href="/login"
              className="bg-blue-600 text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-md shadow-blue-100"
            >
              Start for free
            </Link>
            <Link
              href="#top-changes"
              className="text-sm font-medium text-gray-500 hover:text-gray-900 px-4 py-3 transition-colors"
            >
              See top changes →
            </Link>
          </div>

          {/* Social proof */}
          <p className="mt-6 text-xs text-gray-400">
            Tracking 500+ open-source repos · Breaking changes in your inbox within minutes
          </p>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-2xl mx-auto px-6">
        <div className="border-t border-gray-100" />
      </div>

      {/* Top Changes Feed */}
      <section id="top-changes" className="max-w-2xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">
              Top Changes
            </p>
            <p className="text-sm text-gray-500">Most impactful releases this week</p>
          </div>
          <Link
            href="/login"
            className="text-sm text-blue-600 font-medium hover:text-blue-700 transition-colors"
          >
            Follow your stack →
          </Link>
        </div>

        <div className="space-y-px">
          {articles.map((article, i) => {
            const repo = article.repos as { owner: string; name: string } | null
            if (!repo) return null
            const repoPath = `/${repo.owner}/${repo.name}`

            return (
              <div
                key={article.id}
                className="group relative bg-white hover:bg-gray-50/80 transition-colors rounded-xl px-4 py-4 -mx-4"
              >
                <div className="flex items-start gap-4">
                  {/* Rank */}
                  <span className="text-xs font-bold text-gray-200 mt-0.5 w-5 shrink-0 text-right tabular-nums">
                    {String(i + 1).padStart(2, '0')}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-2">
                      <Link
                        href={repoPath}
                        className="text-[11px] font-mono text-gray-400 hover:text-blue-600 transition-colors"
                      >
                        {repo.owner}/{repo.name}
                      </Link>
                      <SeverityBadge severity={article.severity} />
                      {(article.categories ?? []).slice(0, 2).map((cat: string) => (
                        <CategoryBadge key={cat} type={cat} />
                      ))}
                    </div>

                    <Link href={`/articles/${article.id}`} className="block">
                      <p className="text-[15px] font-medium text-[#111827] group-hover:text-blue-600 transition-colors leading-snug">
                        {article.one_liner}
                      </p>
                    </Link>

                    <p className="mt-1.5 text-xs text-gray-400">
                      {article.published_at ? formatRelativeDate(article.published_at) : ''}
                    </p>
                  </div>

                  <svg className="w-4 h-4 text-gray-200 group-hover:text-blue-400 transition-colors mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Bottom CTA strip */}
      <section className="bg-gray-950 text-white mt-8">
        <div className="max-w-2xl mx-auto px-6 py-12 text-center">
          <h2 className="text-2xl font-bold mb-3">Never miss a breaking change</h2>
          <p className="text-gray-400 text-sm mb-6">
            Import your package.json and get instant alerts for the repos you depend on.
          </p>
          <Link
            href="/login"
            className="inline-block bg-blue-500 hover:bg-blue-400 text-white font-semibold text-sm px-6 py-3 rounded-xl transition-colors"
          >
            Sign up free — no credit card
          </Link>
        </div>
      </section>
    </div>
  )
}
