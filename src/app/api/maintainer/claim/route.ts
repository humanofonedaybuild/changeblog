import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { Octokit } from '@octokit/rest'
import { createAppAuth } from '@octokit/auth-app'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('plan').eq('id', user.id).single()
  if (profile?.plan !== 'maintainer') {
    return NextResponse.json({ error: 'Maintainer plan required' }, { status: 403 })
  }

  const { owner, name } = await req.json()
  if (!owner || !name) return NextResponse.json({ error: 'owner and name required' }, { status: 400 })

  const service = createServiceClient()

  const { data: repo } = await service
    .from('repos')
    .select('id, github_app_installation_id')
    .eq('owner', owner)
    .eq('name', name)
    .single()

  if (!repo) return NextResponse.json({ error: 'Repo not found' }, { status: 404 })

  // Verify user is actually a collaborator via GitHub API
  const { data: authProfile } = await supabase
    .from('users')
    .select('github_username')
    .eq('id', user.id)
    .single()

  if (!authProfile?.github_username) {
    return NextResponse.json({ error: 'GitHub account required for maintainer claim' }, { status: 400 })
  }

  let isCollaborator = false
  try {
    const octokit = repo.github_app_installation_id
      ? await getInstallationOctokit(repo.github_app_installation_id)
      : new Octokit()
    const { status } = await octokit.rest.repos.checkCollaborator({
      owner,
      repo: name,
      username: authProfile.github_username,
    })
    isCollaborator = status === 204
  } catch {
    isCollaborator = false
  }

  const { data: claim } = await service
    .from('maintainer_claims')
    .upsert({
      user_id: user.id,
      repo_id: repo.id,
      status: isCollaborator ? 'verified' : 'pending',
      verified_at: isCollaborator ? new Date().toISOString() : null,
    }, { onConflict: 'user_id,repo_id' })
    .select()
    .single()

  return NextResponse.json({ claim, verified: isCollaborator })
}

async function getInstallationOctokit(installationId: number) {
  const auth = createAppAuth({
    appId: process.env.GITHUB_APP_ID!,
    privateKey: process.env.GITHUB_APP_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    installationId,
  })
  const { token } = await auth({ type: 'installation' })
  return new Octokit({ auth: token })
}
