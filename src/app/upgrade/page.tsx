'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useEffect } from 'react'

declare global {
  interface Window {
    Paddle?: any
  }
}

function UpgradeContent() {
  const searchParams = useSearchParams()
  const plan = searchParams.get('plan') ?? 'subscriber'

  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js'
    script.onload = () => {
      if (window.Paddle) {
        window.Paddle.Initialize({ token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN })
      }
    }
    document.head.appendChild(script)
  }, [])

  const isSubscriber = plan !== 'maintainer'

  function handleCheckout() {
    if (!window.Paddle) return
    const priceId = isSubscriber
      ? process.env.NEXT_PUBLIC_PADDLE_SUBSCRIBER_PRICE_ID
      : process.env.NEXT_PUBLIC_PADDLE_MAINTAINER_PRICE_ID

    window.Paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      settings: { successUrl: '/dashboard?upgraded=1' },
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isSubscriber ? 'Subscriber Plan' : 'Maintainer Plan'}
          </h1>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {isSubscriber ? '$4.99' : '$49'}
            <span className="text-base font-normal text-gray-500">/month</span>
          </p>
        </div>

        <ul className="space-y-2 text-sm text-gray-700">
          {isSubscriber ? (
            <>
              <li>✓ Weekly digest emails</li>
              <li>✓ Instant breaking-change alerts</li>
              <li>✓ Follow unlimited repos</li>
              <li>✓ Severity-based alert thresholds</li>
            </>
          ) : (
            <>
              <li>✓ Claim your repo</li>
              <li>✓ Edit AI-generated changelogs</li>
              <li>✓ Custom branding on public page</li>
              <li>✓ Approve articles before publication</li>
              <li>✓ Analytics on reader engagement</li>
            </>
          )}
        </ul>

        <button
          onClick={handleCheckout}
          className="w-full bg-blue-600 text-white rounded-lg py-3 text-sm font-medium hover:bg-blue-700"
        >
          Subscribe now
        </button>

        <p className="text-xs text-center text-gray-400">Cancel anytime. No contracts.</p>
      </div>
    </div>
  )
}

export default function UpgradePage() {
  return (
    <Suspense>
      <UpgradeContent />
    </Suspense>
  )
}
