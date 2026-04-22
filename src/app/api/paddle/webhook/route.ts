import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('paddle-signature') ?? ''

  if (!verifyPaddleSignature(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = JSON.parse(body)
  const supabase = createServiceClient()

  switch (event.event_type) {
    case 'subscription.activated':
    case 'subscription.updated': {
      const customData = event.data?.custom_data ?? {}
      const userId = customData.user_id
      const priceId = event.data?.items?.[0]?.price?.id

      if (userId && priceId) {
        const plan = getPlanFromPriceId(priceId)
        await supabase
          .from('users')
          .update({ plan, paddle_customer_id: event.data.customer_id })
          .eq('id', userId)
      }
      break
    }

    case 'subscription.canceled':
    case 'subscription.paused': {
      const customData = event.data?.custom_data ?? {}
      const userId = customData.user_id
      if (userId) {
        await supabase.from('users').update({ plan: 'free' }).eq('id', userId)
      }
      break
    }
  }

  return NextResponse.json({ ok: true })
}

function getPlanFromPriceId(priceId: string): 'subscriber' | 'maintainer' {
  const maintainerPriceId = process.env.PADDLE_MAINTAINER_PRICE_ID
  return priceId === maintainerPriceId ? 'maintainer' : 'subscriber'
}

function verifyPaddleSignature(body: string, signature: string): boolean {
  if (!process.env.PADDLE_WEBHOOK_SECRET) return false
  // Paddle uses a ts= h1= format — basic validation in dev
  // In production, use Paddle's official SDK verification
  return signature.includes('h1=')
}
