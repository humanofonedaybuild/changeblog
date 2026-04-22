import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <span className="font-bold text-gray-900 text-lg">Changeblog</span>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">
            Sign in
          </Link>
          <Link
            href="/login"
            className="text-sm bg-gray-900 text-white px-4 py-1.5 rounded-lg hover:bg-gray-700"
          >
            Get started free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <h1 className="text-5xl font-bold text-gray-900 leading-tight">
          Every open-source change,{' '}
          <span className="text-blue-600">actually explained</span>
        </h1>
        <p className="mt-6 text-xl text-gray-500 leading-relaxed">
          Changeblog reads every release note so you don&apos;t have to. Get weekly digests
          and instant breaking-change alerts for the packages you depend on.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link
            href="/login"
            className="bg-blue-600 text-white px-8 py-3 rounded-xl text-base font-medium hover:bg-blue-700"
          >
            Start free — no credit card
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-4xl mx-auto px-6 py-16 grid md:grid-cols-3 gap-8">
        {[
          {
            title: 'AI-powered summaries',
            desc: 'Every release gets classified, severity-scored, and summarized. Grounding and hallucination checks ensure accuracy.',
          },
          {
            title: 'Follow your stack',
            desc: 'Import your package.json, requirements.txt, or go.mod to auto-follow the repos you actually depend on.',
          },
          {
            title: 'Breaking-change alerts',
            desc: 'Get instant emails for severity 4+ changes. Weekly digests for everything else. Your inbox, your rules.',
          },
        ].map((f) => (
          <div key={f.title} className="space-y-2">
            <h3 className="font-semibold text-gray-900">{f.title}</h3>
            <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </section>

      {/* Pricing */}
      <section className="max-w-3xl mx-auto px-6 py-16 text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-12">Simple pricing</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { name: 'Free', price: '$0', features: ['Public repo pages', 'Browse changelogs', 'No account required'] },
            { name: 'Subscriber', price: '$4.99/mo', features: ['Weekly digest email', 'Instant alerts', 'Follow unlimited repos', 'Import your deps'], highlight: true },
            { name: 'Maintainer', price: '$49/mo', features: ['Everything in Subscriber', 'Claim your repo', 'Edit AI articles', 'Custom branding'] },
          ].map((tier) => (
            <div
              key={tier.name}
              className={`rounded-xl border p-6 text-left ${
                tier.highlight ? 'border-blue-200 bg-blue-50' : 'border-gray-100'
              }`}
            >
              <p className="text-sm font-medium text-gray-900">{tier.name}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{tier.price}</p>
              <ul className="mt-4 space-y-2">
                {tier.features.map((f) => (
                  <li key={f} className="text-sm text-gray-600">✓ {f}</li>
                ))}
              </ul>
              <Link
                href={tier.name === 'Free' ? '/login' : `/upgrade?plan=${tier.name.toLowerCase()}`}
                className={`mt-6 block text-center py-2 rounded-lg text-sm font-medium ${
                  tier.highlight
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {tier.name === 'Free' ? 'Get started' : 'Subscribe'}
              </Link>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
