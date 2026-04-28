import { inngest } from '../client'
import { processRelease, MODEL_VERSION } from '@/lib/llm/pipeline'
import { createServiceClient } from '@/lib/supabase/server'

export const processReleaseFunction = inngest.createFunction(
  { id: 'process-release', retries: 3, triggers: [{ event: 'release/created' }] },
  async ({ event, step }: { event: any; step: any }) => {
    const { releaseId } = event.data as { releaseId: string }
    const supabase = createServiceClient()

    const release = await step.run('fetch-release', async () => {
      const { data, error } = await supabase
        .from('releases')
        .select('*, repos(*)')
        .eq('id', releaseId)
        .single()
      if (error) throw error
      return data
    })

    if (!release.body || release.is_draft || release.is_prerelease) {
      await supabase
        .from('releases')
        .update({ processing_status: 'skipped', processed_at: new Date().toISOString() })
        .eq('id', releaseId)
      return { skipped: true }
    }

    // Daily rate limit gate — INGEST_DAILY_RATE_LIMIT=0 disables the limit
    const dailyLimit = parseInt(process.env.INGEST_DAILY_RATE_LIMIT ?? '0')
    if (dailyLimit > 0) {
      const rateLimited = await step.run('check-daily-rate-limit', async () => {
        const todayStart = new Date()
        todayStart.setUTCHours(0, 0, 0, 0)
        const { count } = await supabase
          .from('releases')
          .select('id', { count: 'exact', head: true })
          .eq('processing_status', 'done')
          .gte('processed_at', todayStart.toISOString())
        return (count ?? 0) >= dailyLimit
      })

      if (rateLimited) {
        await supabase
          .from('releases')
          .update({ processing_status: 'queued' })
          .eq('id', releaseId)
        return { rateLimited: true }
      }
    }

    await supabase
      .from('releases')
      .update({ processing_status: 'processing' })
      .eq('id', releaseId)

    const contentHash = `${release.repo_id}:${release.tag_name}:${MODEL_VERSION}`

    // Check cache
    const cached = await step.run('check-cache', async () => {
      const { data } = await supabase
        .from('articles')
        .select('id')
        .eq('content_hash', contentHash)
        .single()
      return data
    })

    if (cached) {
      await supabase
        .from('releases')
        .update({ processing_status: 'done', processed_at: new Date().toISOString() })
        .eq('id', releaseId)
      return { cached: true, articleId: cached.id }
    }

    const result = await step.run('llm-pipeline', async () => {
      return processRelease(
        (release as any).repos.full_name,
        release.tag_name,
        release.body!
      )
    })

    if (result.type === 'drop') {
      await supabase
        .from('releases')
        .update({ processing_status: 'skipped', processed_at: new Date().toISOString() })
        .eq('id', releaseId)
      return { dropped: true }
    }

    if (result.type === 'update') {
      const { data: update } = await step.run('save-update', async () => {
        return supabase
          .from('updates')
          .insert({
            release_id: releaseId,
            repo_id: release.repo_id,
            one_liner: result.summary!.one_liner,
            severity: result.severity,
            categories: result.categories,
            published_at: new Date().toISOString(),
          })
          .select()
          .single()
      })

      await supabase
        .from('releases')
        .update({ processing_status: 'done', processed_at: new Date().toISOString() })
        .eq('id', releaseId)

      return { type: 'update', updateId: update?.id }
    }

    // Article path
    const isQuarantined =
      result.groundingResult?.pass === false || result.hallucinationResult?.pass === false
    const quarantineReason = isQuarantined
      ? [
          !result.groundingResult?.pass ? 'grounding-fail' : null,
          !result.hallucinationResult?.pass ? 'hallucination-flag' : null,
        ]
          .filter(Boolean)
          .join(', ')
      : null

    const { data: article } = await step.run('save-article', async () => {
      return supabase
        .from('articles')
        .insert({
          release_id: releaseId,
          repo_id: release.repo_id,
          title: result.title!,
          one_liner: result.summary!.one_liner,
          what_changed: result.summary!.what_changed,
          what_to_do: result.summary!.what_to_do,
          citations: result.summary!.citations as any,
          severity: result.severity,
          categories: result.categories,
          is_quarantined: isQuarantined,
          quarantine_reason: quarantineReason,
          published_at: isQuarantined ? null : new Date().toISOString(),
          model_version: result.model_version,
          content_hash: contentHash,
        })
        .select()
        .single()
    })

    if (isQuarantined && article) {
      await supabase.from('quality_events').insert({
        article_id: article.id,
        event_type: quarantineReason!.includes('hallucination') ? 'hallucination_flag' : 'grounding_fail',
        source: 'llm',
        details: {
          grounding: result.groundingResult,
          hallucination: result.hallucinationResult,
        } as any,
      })
    }

    await supabase
      .from('releases')
      .update({ processing_status: 'done', processed_at: new Date().toISOString() })
      .eq('id', releaseId)

    if (!isQuarantined && article && result.severity >= 4) {
      await inngest.send({
        name: 'article/published.breaking',
        data: { articleId: article.id, severity: result.severity },
      })
    }

    return { type: 'article', articleId: article?.id, quarantined: isQuarantined }
  }
)
