import type { HFCommit, HFModel } from './client'

const WEIGHT_EXTENSIONS = /\.(safetensors|bin|gguf|pt|ckpt|pth|h5|pkl)$/i

export interface HFReleaseInput {
  tag_name: string
  name: string
  body: string
  published_at: string
  is_prerelease: boolean
  is_draft: boolean
  hf_commit_sha: string
  source_platform: 'hugging_face'
}

export function hfCommitToReleaseInput(
  commit: HFCommit,
  model: HFModel,
  cardContent?: string
): HFReleaseInput | null {
  const changedFiles = commit.changedFiles ?? []
  const hasWeightChange = changedFiles.some(f => WEIGHT_EXTENSIONS.test(f.path))
  const hasCardChange = changedFiles.some(f => f.path === 'README.md')

  // If we have changedFiles metadata and nothing interesting changed, skip
  if (changedFiles.length > 0 && !hasWeightChange && !hasCardChange) {
    return null
  }

  const parts: string[] = []

  if (hasWeightChange) {
    const weightFiles = changedFiles
      .filter(f => WEIGHT_EXTENSIONS.test(f.path))
      .map(f => `\`${f.path}\``)
    parts.push(
      `## ⚠️ Model Weights Updated\n\nThis commit modifies model weight files: ${weightFiles.join(', ')}.\n\nDownstream users should re-evaluate their integration and test for behavioral changes.`
    )
  }

  if (commit.message && commit.message.trim() && commit.message !== commit.title) {
    parts.push(`## Commit Message\n\n${commit.message.trim()}`)
  }

  if ((hasCardChange || changedFiles.length === 0) && cardContent) {
    parts.push(`## Model Card\n\n${cardContent}`)
  }

  const otherFiles = changedFiles
    .filter(f => !WEIGHT_EXTENSIONS.test(f.path) && f.path !== 'README.md')
    .map(f => `- ${f.type}: \`${f.path}\``)
  if (otherFiles.length > 0) {
    parts.push(`## Other Changed Files\n\n${otherFiles.join('\n')}`)
  }

  const body = parts.join('\n\n').trim()
  if (!body) return null

  return {
    tag_name: commit.id.slice(0, 8),
    name: commit.title || `${model.id} update`,
    body,
    published_at: commit.date,
    is_prerelease: false,
    is_draft: false,
    hf_commit_sha: commit.id,
    source_platform: 'hugging_face',
  }
}
