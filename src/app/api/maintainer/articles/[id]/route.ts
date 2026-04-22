import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  field: z.enum(['title', 'one_liner', 'what_changed', 'what_to_do']),
  value: z.string().min(1),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = schema.parse(await req.json())
  const service = createServiceClient()

  // Verify maintainer claim on this article's repo
  const { data: article } = await service
    .from('articles')
    .select('repo_id')
    .eq('id', id)
    .single()

  if (!article) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: claim } = await service
    .from('maintainer_claims')
    .select('id')
    .eq('user_id', user.id)
    .eq('repo_id', article.repo_id)
    .eq('status', 'verified')
    .single()

  if (!claim) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Save edit history
  const { data: current } = await service
    .from('articles')
    .select(body.field)
    .eq('id', id)
    .single()

  await service.from('maintainer_edits').insert({
    article_id: id,
    user_id: user.id,
    field: body.field,
    old_value: (current as any)?.[body.field] ?? null,
    new_value: body.value,
  })

  // Apply edit — build a typed partial update then merge the field
  const fieldUpdate: Record<string, string | boolean> = {
    [body.field]: body.value,
    maintainer_edited: true,
  }
  await service
    .from('articles')
    .update(fieldUpdate as any)
    .eq('id', id)

  return NextResponse.json({ ok: true })
}
