import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/header'
import { CategoryBadge, SeverityBadge } from '@/components/badge'
import { HighlightComment } from '@/components/highlight-comment'
import { MOCK_ARTICLES } from '@/lib/mock-data'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ id: string }>
}

const PREVIEW = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const mock = MOCK_ARTICLES.find((a) => a.id === id)
  if (PREVIEW || mock) {
    return { title: mock?.title ?? mock?.one_liner ?? 'Article — Changeblog', description: mock?.one_liner ?? '' }
  }
  const supabase = await createClient()
  const { data } = await supabase.from('articles').select('title, one_liner').eq('id', id).single()
  return { title: data?.title ?? 'Article — Changeblog', description: data?.one_liner ?? '' }
}

export default async function ArticlePage({ params }: Props) {
  const { id } = await params

  let user = null
  let article = MOCK_ARTICLES.find((a) => a.id === id) as typeof MOCK_ARTICLES[number] | null ?? null

  if (!PREVIEW) {
    const supabase = await createClient()
    const { data: { user: dbUser } } = await supabase.auth.getUser()
    user = dbUser
    const { data: dbArticle } = await supabase.from('articles').select('*, repos(owner, name)').eq('id', id).single()
    if (dbArticle) article = { ...dbArticle, published_at: dbArticle.published_at ?? '' } as unknown as typeof MOCK_ARTICLES[number]
  }

  if (!article) notFound()

  const repo = article.repos as { owner: string; name: string } | null
  const citations = (article.citations ?? []) as Array<{ claim: string; source_excerpt?: string; url?: string }>

  return (
    <div className="min-h-screen bg-white">
      <Header user={user} />

      <article className="max-w-2xl mx-auto px-6 py-12">
        {/* Breadcrumb */}
        {repo && (
          <div className="flex items-center gap-2 mb-6">
            <Link
              href="/"
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Changeblog
            </Link>
            <span className="text-gray-200 text-xs">/</span>
            <Link
              href={`/${repo.owner}/${repo.name}`}
              className="text-xs font-mono text-gray-500 hover:text-blue-600 transition-colors"
            >
              {repo.owner}/{repo.name}
            </Link>
          </div>
        )}

        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <SeverityBadge severity={article.severity} />
          {(article.categories ?? []).map((cat: string) => (
            <CategoryBadge key={cat} type={cat} />
          ))}
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-[#111827] leading-tight tracking-tight">
          {article.title ?? article.one_liner}
        </h1>

        {/* One-liner summary */}
        {article.title && article.one_liner && article.title !== article.one_liner && (
          <p className="mt-3 text-lg text-gray-500 leading-relaxed">{article.one_liner}</p>
        )}

        {/* Date + meta */}
        {article.published_at && (
          <p className="mt-4 text-xs text-gray-400 font-medium">
            {new Date(article.published_at).toLocaleDateString('en-US', {
              month: 'long', day: 'numeric', year: 'numeric',
            })}
          </p>
        )}

        {/* Divider */}
        <div className="border-t border-gray-100 mt-8 mb-8" />

        {/* Article body with highlight-to-comment */}
        <HighlightComment>
          <div className="space-y-8 select-text">
            <section>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
                What changed
              </h2>
              <p className="text-[15px] text-gray-700 leading-relaxed">{article.what_changed}</p>
            </section>
            <section>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
                What to do
              </h2>
              <p className="text-[15px] text-gray-700 leading-relaxed">{article.what_to_do}</p>
            </section>
          </div>
        </HighlightComment>

        {/* Citations */}
        {citations.length > 0 && (
          <section className="mt-8 pt-6 border-t border-gray-100">
            <h2 className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-3">Sources</h2>
            <ul className="space-y-2">
              {citations.map((c, i) => (
                <li key={i} className="text-xs text-gray-500">
                  <span className="font-medium text-gray-700">{c.claim}</span>
                  {c.source_excerpt && (
                    <span className="italic text-gray-400"> — &ldquo;{c.source_excerpt}&rdquo;</span>
                  )}
                  {c.url && (
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-blue-500 hover:underline"
                    >
                      ↗
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Comments */}
        <section className="mt-10 pt-6 border-t border-gray-100">
          <h2 className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-4">Comments</h2>

          {/* Comment form */}
          <div className="flex gap-3 mb-6">
            <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-500 shrink-0 mt-0.5">
              {user ? user.email?.[0].toUpperCase() : '?'}
            </div>
            <div className="flex-1">
              <textarea
                placeholder={user ? 'Add a comment…' : 'Sign in to comment'}
                disabled={!user}
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none disabled:bg-gray-50 disabled:text-gray-400"
              />
              {user && (
                <button className="mt-2 text-sm bg-[#1a1a1a] text-white px-4 py-1.5 rounded-md hover:bg-gray-800">
                  Post
                </button>
              )}
              {!user && (
                <Link href="/login" className="mt-2 block text-xs text-blue-500 hover:underline">
                  Sign in to comment →
                </Link>
              )}
            </div>
          </div>
        </section>
      </article>
    </div>
  )
}
