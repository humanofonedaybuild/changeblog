import { inngest } from '../client'
import { createServiceClient } from '@/lib/supabase/server'
import { Octokit } from '@octokit/rest'
import { createAppAuth } from '@octokit/auth-app'

export const pollRepos = inngest.createFunction(
  { id: 'poll-repos', retries: 1, triggers: [{ cron: '*/15 * * * *' }] },
  async ({ step }: { step: any }) => {
    const supabase = createServiceClient()

    const repos = await step.run('fetch-repos-to-poll', async () => {
      const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString()
      const { data, error } = await supabase
        .from('repos')
        .select('id, owner, name, full_name, github_app_installation_id, last_polled_at')
        .eq('webhook_active', false)
        .or(`last_polled_at.is.null,last_polled_at.lt.${cutoff}`)
        .limit(100)
      if (error) throw error
      return data ?? []
    })

    await Promise.allSettled(
      repos.map((repo: any) =>
        step.run(`poll-${repo.id}`, async () => {
          const octokit = repo.github_app_installation_id
            ? await getInstallationOctokit(repo.github_app_installation_id)
            : new Octokit()

          const { data: releases } = await octokit.rest.repos.listReleases({
            owner: repo.owner,
            repo: repo.name,
            per_page: 10,
          })

          for (const release of releases) {
            const { data: existing } = await supabase
              .from('releases')
              .select('id')
              .eq('github_id', release.id)
              .single()

            if (!existing) {
              const { data: newRelease } = await supabase
                .from('releases')
                .insert({
                  repo_id: repo.id,
                  github_id: release.id,
                  tag_name: release.tag_name,
                  name: release.name,
                  body: release.body,
                  published_at: release.published_at,
                  is_prerelease: release.prerelease,
                  is_draft: release.draft,
                })
                .select()
                .single()

              if (newRelease) {
                await inngest.send({
                  name: 'release/created',
                  data: { releaseId: newRelease.id },
                })
              }
            }
          }

          await supabase
            .from('repos')
            .update({ last_polled_at: new Date().toISOString() })
            .eq('id', repo.id)
        })
      )
    )

    return { polled: repos.length }
  }
)

async function getInstallationOctokit(installationId: number) {
  const auth = createAppAuth({
    appId: process.env.GITHUB_APP_ID!,
    privateKey: process.env.GITHUB_APP_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    installationId,
  })
  const { token } = await auth({ type: 'installation' })
  return new Octokit({ auth: token })
}
