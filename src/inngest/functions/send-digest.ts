import { inngest } from '../client'
import { createServiceClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { renderDigestEmail } from '@/email/templates/digest'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY ?? 'placeholder')
}

export const sendWeeklyDigest = inngest.createFunction(
  { id: 'send-weekly-digest', retries: 2, triggers: [{ cron: '0 9 * * 1' }] },
  async ({ step }: { step: any }) => {
    const supabase = createServiceClient()
    const weekStart = getMondayDate()

    const subscribers = await step.run('fetch-subscribers', async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, timezone, follows(repo_id)')
        .eq('digest_enabled', true)
        .in('plan', ['subscriber', 'maintainer'])
      if (error) throw error
      return data
    })

    const results = await Promise.allSettled(
      (subscribers ?? []).map((user: any) =>
        step.run(`send-digest-${user.id}`, async () => {
          const repoIds = user.follows.map((f: any) => f.repo_id)
          if (repoIds.length === 0) return { skipped: true }

          const weekAgo = new Date(weekStart)
          weekAgo.setDate(weekAgo.getDate() - 7)

          const [{ data: articles }, { data: updates }] = await Promise.all([
            supabase
              .from('articles')
              .select('*, repos(owner, name)')
              .in('repo_id', repoIds)
              .gte('published_at', weekAgo.toISOString())
              .eq('is_quarantined', false)
              .order('severity', { ascending: false })
              .limit(20),
            supabase
              .from('updates')
              .select('*, repos(owner, name)')
              .in('repo_id', repoIds)
              .gte('published_at', weekAgo.toISOString())
              .order('severity', { ascending: false })
              .limit(20),
          ])

          if (!articles?.length && !updates?.length) return { skipped: true }

          const html = renderDigestEmail({
            articles: articles ?? [],
            updates: updates ?? [],
            weekStart,
            appUrl: process.env.NEXT_PUBLIC_APP_URL!,
          })

          const { data: msg, error } = await getResend().emails.send({
            from: process.env.RESEND_FROM_EMAIL!,
            to: user.email,
            subject: `Your Changeblog digest — week of ${formatDate(weekStart)}`,
            html,
          })

          if (error) throw error

          await supabase.from('digests').upsert({
            user_id: user.id,
            week_start: weekStart,
            article_ids: articles?.map((a) => a.id) ?? [],
            update_ids: updates?.map((u) => u.id) ?? [],
            sent_at: new Date().toISOString(),
            resend_message_id: msg?.id,
          })

          return { sent: true, messageId: msg?.id }
        })
      )
    )

    return { processed: results.length }
  }
)

export const sendBreakingAlert = inngest.createFunction(
  { id: 'send-breaking-alert', retries: 3, triggers: [{ event: 'article/published.breaking' }] },
  async ({ event, step }: { event: any; step: any }) => {
    const { articleId } = event.data as { articleId: string }
    const supabase = createServiceClient()

    const article = await step.run('fetch-article', async () => {
      const { data, error } = await supabase
        .from('articles')
        .select('*, repos(owner, name, full_name)')
        .eq('id', articleId)
        .single()
      if (error) throw error
      return data
    })

    const subscribers = await step.run('fetch-subscribers', async () => {
      const { data, error } = await supabase
        .from('follows')
        .select('user_id, alert_threshold, users(email, plan)')
        .eq('repo_id', article.repo_id)
        .lte('alert_threshold', article.severity)
      if (error) throw error
      return data?.filter((f: any) => f.users?.plan !== 'free') ?? []
    })

    await Promise.allSettled(
      subscribers.map((sub: any) =>
        step.run(`alert-${sub.user_id}`, async () => {
          const existing = await supabase
            .from('alerts')
            .select('id')
            .eq('user_id', sub.user_id)
            .eq('article_id', articleId)
            .single()

          if (existing.data) return { skipped: true }

          const repoName = (article as any).repos?.full_name ?? ''
          const appUrl = process.env.NEXT_PUBLIC_APP_URL!

          const { data: msg } = await getResend().emails.send({
            from: process.env.RESEND_FROM_EMAIL!,
            to: sub.users.email,
            subject: `🚨 Breaking change in ${repoName}: ${article.one_liner}`,
            html: `
              <h2>Breaking change detected</h2>
              <p><strong>${repoName} ${(article as any).repos?.name}</strong></p>
              <p>${article.one_liner}</p>
              <h3>What changed</h3>
              <p>${article.what_changed}</p>
              <h3>What to do</h3>
              <p>${article.what_to_do}</p>
              <a href="${appUrl}/${repoName}">View full article →</a>
              <hr/>
              <small><a href="${appUrl}/settings">Manage alert settings</a></small>
            `,
          })

          await supabase.from('alerts').insert({
            user_id: sub.user_id,
            article_id: articleId,
            sent_at: new Date().toISOString(),
            resend_message_id: msg?.id,
          })
        })
      )
    )
  }
)

function getMondayDate(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().split('T')[0]
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}
