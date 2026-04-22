import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await req.formData()
  const timezone = (form.get('timezone') as string) || 'UTC'
  const digestEnabled = form.get('digest_enabled') === 'on'

  await supabase
    .from('users')
    .update({ timezone, digest_enabled: digestEnabled })
    .eq('id', user.id)

  const referer = req.headers.get('referer') ?? '/settings'
  return NextResponse.redirect(referer, { status: 303 })
}
