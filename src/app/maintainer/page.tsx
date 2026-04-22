import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function MaintainerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('*').eq('id', user.id).single()
  const { data: claims } = await supabase
    .from('maintainer_claims')
    .select('*, repos(owner, name)')
    .eq('user_id', user.id)

  if (profile?.plan !== 'maintainer') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Maintainer Portal</h1>
        <p className="text-gray-500 text-sm mb-6">
          Claim your repo, edit AI-generated changelogs, and add custom branding.
          Requires a Maintainer plan.
        </p>
        <Link
          href="/upgrade?plan=maintainer"
          className="inline-block bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          Upgrade to Maintainer — $49/mo
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-semibold text-gray-900">Maintainer Portal</h1>
        <Link
          href="/maintainer/claim"
          className="text-sm px-4 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-700"
        >
          Claim a repo
        </Link>
      </div>

      {claims?.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">No claimed repos yet.</p>
          <Link href="/maintainer/claim" className="text-blue-600 hover:underline text-sm mt-2 inline-block">
            Claim your first repo →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {claims?.map((claim) => {
            const repo = claim.repos as any
            return (
              <div key={claim.id} className="bg-white border border-gray-100 rounded-xl p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <Link
                      href={`/${repo.owner}/${repo.name}`}
                      className="font-mono text-sm font-medium text-gray-900 hover:text-blue-600"
                    >
                      {repo.owner}/{repo.name}
                    </Link>
                    <span
                      className={`ml-3 text-xs px-2 py-0.5 rounded ${
                        claim.status === 'verified'
                          ? 'bg-green-50 text-green-700'
                          : 'bg-yellow-50 text-yellow-700'
                      }`}
                    >
                      {claim.status}
                    </span>
                  </div>
                  {claim.status === 'verified' && (
                    <Link
                      href={`/maintainer/edit/${repo.owner}/${repo.name}`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Manage articles →
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
