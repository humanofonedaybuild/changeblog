import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { processReleaseFunction } from '@/inngest/functions/process-release'
import { sendWeeklyDigest, sendBreakingAlert } from '@/inngest/functions/send-digest'
import { pollRepos } from '@/inngest/functions/poll-repos'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processReleaseFunction, sendWeeklyDigest, sendBreakingAlert, pollRepos],
})
