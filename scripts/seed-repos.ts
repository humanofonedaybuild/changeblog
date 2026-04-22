/**
 * Seeds ~500 popular repos across JS/Python/Go/Rust into the database.
 * Run: SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed-repos.ts
 */
import { createClient } from '@supabase/supabase-js'
import { Octokit } from '@octokit/rest'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN })

const QUERIES = [
  { q: 'stars:>5000 language:javascript', language: 'JavaScript' },
  { q: 'stars:>5000 language:typescript', language: 'TypeScript' },
  { q: 'stars:>5000 language:python', language: 'Python' },
  { q: 'stars:>5000 language:go', language: 'Go' },
  { q: 'stars:>3000 language:rust', language: 'Rust' },
]

async function main() {
  let total = 0

  for (const { q, language } of QUERIES) {
    console.log(`Fetching ${language} repos...`)

    for (let page = 1; page <= 2; page++) {
      const { data } = await octokit.rest.search.repos({
        q,
        sort: 'stars',
        order: 'desc',
        per_page: 50,
        page,
      })

      const rows = data.items.map((r) => ({
        owner: r.owner!.login,
        name: r.name,
        description: r.description?.slice(0, 500) ?? null,
        stars: r.stargazers_count,
        language: r.language ?? language,
      }))

      const { error } = await supabase
        .from('repos')
        .upsert(rows, { onConflict: 'owner,name', ignoreDuplicates: true })

      if (error) console.error('Insert error:', error.message)
      else total += rows.length

      // Respect GitHub rate limit
      await new Promise((r) => setTimeout(r, 1000))
    }
  }

  console.log(`Seeded ${total} repos`)
}

main().catch(console.error)
