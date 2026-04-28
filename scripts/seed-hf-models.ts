/**
 * Seeds top HF models across key pipeline tags.
 * Run: SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed-hf-models.ts
 * Config: HF_SEED_LIMIT (default 50) — total models to seed across all pipeline tags
 */
import { createClient } from '@supabase/supabase-js'
import { searchModels } from '../src/lib/hf/client'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const HF_SEED_LIMIT = parseInt(process.env.HF_SEED_LIMIT ?? '50')

const PIPELINE_TAGS = [
  'text-generation',
  'text2text-generation',
  'image-classification',
  'automatic-speech-recognition',
  'sentence-similarity',
]

const perTag = Math.ceil(HF_SEED_LIMIT / PIPELINE_TAGS.length)

async function main() {
  let total = 0

  for (const tag of PIPELINE_TAGS) {
    if (total >= HF_SEED_LIMIT) break
    const limit = Math.min(perTag, HF_SEED_LIMIT - total)
    console.log(`Fetching ${limit} models for pipeline_tag=${tag}...`)

    const models = await searchModels(tag, limit)

    const rows = models.map(m => {
      const [author, ...nameParts] = m.id.split('/')
      const name = nameParts.join('/') || author
      return {
        owner: author,
        name,
        description: null as string | null,
        stars: 0,
        language: null as string | null,
        platform: 'hugging_face',
        hf_author: m.author,
        hf_pipeline_tag: tag,
        hf_likes: m.likes ?? 0,
        hf_downloads: m.downloads ?? 0,
      }
    })

    const { error } = await supabase
      .from('repos')
      .upsert(rows, { onConflict: 'owner,name,platform', ignoreDuplicates: true })

    if (error) console.error('Insert error:', error.message)
    else {
      total += rows.length
      console.log(`  Inserted ${rows.length} models`)
    }

    await new Promise(r => setTimeout(r, 500))
  }

  console.log(`Seeded ${total} HF models`)
}

main().catch(console.error)
