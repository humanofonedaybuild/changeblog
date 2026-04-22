import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('*').eq('id', user.id).single()
  const { data: follows } = await supabase
    .from('follows')
    .select('id, alert_threshold, repos(id, owner, name)')
    .eq('user_id', user.id)

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      <h1 className="text-xl font-semibold text-gray-900">Settings</h1>

      {/* Plan */}
      <section className="bg-white border border-gray-100 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Plan</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium capitalize">{profile?.plan ?? 'free'}</p>
            {profile?.plan === 'free' && (
              <p className="text-xs text-gray-500 mt-0.5">Upgrade to get digest emails and alerts</p>
            )}
          </div>
          {profile?.plan === 'free' && (
            <a
              href="/upgrade"
              className="text-sm px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Upgrade — $4.99/mo
            </a>
          )}
        </div>
      </section>

      {/* Import deps */}
      <section className="bg-white border border-gray-100 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Import dependencies</h2>
        <p className="text-xs text-gray-500 mb-4">
          Paste your package.json, requirements.txt, or go.mod to auto-follow repos
        </p>
        <ImportForm />
      </section>

      {/* Followed repos */}
      <section className="bg-white border border-gray-100 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">
          Following ({follows?.length ?? 0})
        </h2>
        {follows?.length === 0 ? (
          <p className="text-sm text-gray-400">Not following any repos yet.</p>
        ) : (
          <div className="space-y-2">
            {follows?.map((f) => {
              const repo = f.repos as any
              return (
                <div key={f.id} className="flex items-center justify-between text-sm">
                  <a
                    href={`/${repo.owner}/${repo.name}`}
                    className="text-gray-700 hover:text-gray-900 font-mono text-xs"
                  >
                    {repo.owner}/{repo.name}
                  </a>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">Alert at S{f.alert_threshold}+</span>
                    <UnfollowButton repoId={repo.id} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Digest settings */}
      <section className="bg-white border border-gray-100 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Digest</h2>
        <form action="/api/settings" method="POST" className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-700">Weekly digest</label>
            <input
              type="checkbox"
              name="digest_enabled"
              defaultChecked={profile?.digest_enabled ?? true}
              className="rounded"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-700">Timezone</label>
            <input
              name="timezone"
              defaultValue={profile?.timezone ?? 'UTC'}
              className="text-sm border border-gray-200 rounded px-2 py-1"
              placeholder="UTC"
            />
          </div>
          <button
            type="submit"
            className="text-sm px-4 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-700"
          >
            Save
          </button>
        </form>
      </section>
    </div>
  )
}

function ImportForm() {
  return (
    <form action="/api/import-deps" method="POST" className="space-y-3">
      <select name="fileType" className="text-sm border border-gray-200 rounded px-2 py-1.5 w-full">
        <option value="package.json">package.json</option>
        <option value="requirements.txt">requirements.txt</option>
        <option value="go.mod">go.mod</option>
      </select>
      <textarea
        name="content"
        rows={6}
        placeholder="Paste file contents here…"
        className="w-full text-xs font-mono border border-gray-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="submit"
        className="text-sm px-4 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-700"
      >
        Import & follow
      </button>
    </form>
  )
}

function UnfollowButton({ repoId }: { repoId: string }) {
  return (
    <form action="/api/follows" method="POST">
      <input type="hidden" name="_method" value="DELETE" />
      <input type="hidden" name="repoId" value={repoId} />
      <button type="submit" className="text-xs text-red-500 hover:text-red-700">
        Unfollow
      </button>
    </form>
  )
}
