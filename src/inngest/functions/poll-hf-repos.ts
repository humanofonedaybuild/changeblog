import { inngest } from '../client'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchModelCommits, fetchModelCard } from '@/lib/hf/client'
import { hfCommitToReleaseInput } from '@/lib/hf/normalize'

export const pollHfRepos = inngest.createFunction(
  { id: 'poll-hf-repos', retries: 1, triggers: [{ cron: '*/15 * * * *' }] },
  async ({ step }: { step: any }) => {
    const supabase = createServiceClient()

    const repos = await step.run('fetch-hf-repos-to-poll', async () => {
      const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString()
      const { data, error } = await supabase
        .from('repos')
        .select('id, owner, name, full_name, last_polled_at')
        .eq('platform', 'hugging_face')
        .or(`last_polled_at.is.null,last_polled_at.lt.${cutoff}`)
        .limit(50)
      if (error) throw error
      return data ?? []
    })

    const releasesPerRepo = parseInt(process.env.RELEASES_PER_REPO ?? '3')

    await Promise.allSettled(
      repos.map((repo: any) =>
        step.run(`poll-hf-${repo.id}`, async () => {
          const modelId = `${repo.owner}/${repo.name}`
          const commits = await fetchModelCommits(modelId, releasesPerRepo * 3)

          for (const commit of commits.slice(0, releasesPerRepo * 3)) {
            const { data: existing } = await supabase
              .from('releases')
              .select('id')
              .eq('repo_id', repo.id)
              .eq('hf_commit_sha', commit.id)
              .maybeSingle()

            if (existing) continue

            const changedFiles = commit.changedFiles ?? []
            const needsCard =
              changedFiles.length === 0 ||
              changedFiles.some(f => f.path === 'README.md')

            const cardContent = needsCard ? await fetchModelCard(modelId) : undefined

            const releaseInput = hfCommitToReleaseInput(
              commit,
              { id: modelId, author: repo.owner, modelId: repo.name, likes: 0, downloads: 0, lastModified: commit.date },
              cardContent
            )

            if (!releaseInput) continue

            const { data: newRelease } = await supabase
              .from('releases')
              .insert({
                repo_id: repo.id,
                tag_name: releaseInput.tag_name,
                name: releaseInput.name,
                body: releaseInput.body,
                published_at: releaseInput.published_at,
                is_prerelease: false,
                is_draft: false,
                hf_commit_sha: releaseInput.hf_commit_sha,
                source_platform: 'hugging_face',
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
