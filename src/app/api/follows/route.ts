import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(async () => {
    const form = await req.formData()
    return { repoId: form.get('repoId') }
  })

  const { repoId } = body

  if (!repoId) {
    return NextResponse.json({ error: 'repoId required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('follows')
    .upsert({ user_id: user.id, repo_id: repoId }, { onConflict: 'user_id,repo_id' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const referer = req.headers.get('referer')
  if (referer) {
    return NextResponse.redirect(referer, { status: 303 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { repoId } = await req.json()

  await supabase
    .from('follows')
    .delete()
    .eq('user_id', user.id)
    .eq('repo_id', repoId)

  return NextResponse.json({ ok: true })
}
