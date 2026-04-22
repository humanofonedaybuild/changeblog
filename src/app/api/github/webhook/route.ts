import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'
import { inngest } from '@/inngest/client'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('x-hub-signature-256') ?? ''
  const event = req.headers.get('x-github-event') ?? ''

  if (!verifySignature(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const payload = JSON.parse(body)

  if (event === 'release' && payload.action === 'published') {
    await handleRelease(payload)
  } else if (event === 'installation') {
    await handleInstallation(payload)
  }

  return NextResponse.json({ ok: true })
}

async function handleRelease(payload: any) {
  const supabase = createServiceClient()
  const { repository, release } = payload

  let { data: repo } = await supabase
    .from('repos')
    .select('id')
    .eq('owner', repository.owner.login)
    .eq('name', repository.name)
    .single()

  if (!repo) {
    const { data: newRepo } = await supabase
      .from('repos')
      .insert({
        owner: repository.owner.login,
        name: repository.name,
        description: repository.description,
        stars: repository.stargazers_count,
        language: repository.language,
        webhook_active: true,
      })
      .select()
      .single()
    repo = newRepo
  } else {
    await supabase
      .from('repos')
      .update({ webhook_active: true })
      .eq('id', repo!.id)
  }

  if (!repo) return

  const { data: existing } = await supabase
    .from('releases')
    .select('id')
    .eq('github_id', release.id)
    .single()

  if (existing) return

  const { data: newRelease } = await supabase
    .from('releases')
    .insert({
      repo_id: repo.id,
      github_id: release.id,
      tag_name: release.tag_name,
      name: release.name,
      body: release.body,
      published_at: release.published_at,
      is_prerelease: release.prerelease,
      is_draft: release.draft,
    })
    .select()
    .single()

  if (newRelease) {
    await inngest.send({ name: 'release/created', data: { releaseId: newRelease.id } })
  }
}

async function handleInstallation(payload: any) {
  if (payload.action !== 'created') return
  const supabase = createServiceClient()
  const installationId = payload.installation.id

  for (const repo of payload.repositories ?? []) {
    const [owner, name] = repo.full_name.split('/')
    await supabase
      .from('repos')
      .upsert(
        {
          owner,
          name,
          github_app_installation_id: installationId,
          webhook_active: true,
        },
        { onConflict: 'owner,name' }
      )
  }
}

function verifySignature(body: string, signature: string): boolean {
  const secret = process.env.GITHUB_APP_WEBHOOK_SECRET
  if (!secret) return false
  const expected = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex')
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}
