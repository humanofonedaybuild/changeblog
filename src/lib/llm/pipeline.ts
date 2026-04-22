import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export type Category =
  | 'breaking'
  | 'security'
  | 'feature'
  | 'perf'
  | 'deprecation'
  | 'bugfix'
  | 'docs'
  | 'internal'

export interface ClassifyResult {
  categories: Category[]
  breaking_changes: string[]
  deprecated_apis: string[]
  summary_hint: string
}

export interface SeverityResult {
  severity: number
  rationale: string
}

export interface Citation {
  claim: string
  source_excerpt: string
}

export interface SummarizeResult {
  one_liner: string
  what_changed: string
  what_to_do: string
  citations: Citation[]
}

export interface GroundingResult {
  pass: boolean
  unsupported_claims: Array<{ claim: string; reason: string }>
}

export interface HallucinationResult {
  pass: boolean
  flagged: Array<{ statement: string; issue: string }>
}

export interface PipelineOutput {
  type: 'article' | 'update' | 'drop'
  severity: number
  categories: Category[]
  summary?: SummarizeResult
  title?: string
  model_version: string
}

// Classify release notes using Sonnet — determines categories and breaking changes
export async function classifyRelease(
  repoFullName: string,
  releaseBody: string
): Promise<ClassifyResult> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: [
      {
        type: 'text',
        text: `You are a release-notes analyst for open-source software. Classify release notes into categories and extract key changes.

Categories: breaking|security|feature|perf|deprecation|bugfix|docs|internal

Output valid JSON only: {"categories": string[], "breaking_changes": string[], "deprecated_apis": string[], "summary_hint": string}`,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Repo: ${repoFullName}\n\nRelease notes:\n${releaseBody}`,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  return JSON.parse(extractJson(text)) as ClassifyResult
}

// Score severity 0-5 using Sonnet
export async function scoreSeverity(
  categories: Category[],
  breakingChanges: string[]
): Promise<SeverityResult> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 256,
    system: [
      {
        type: 'text',
        text: `Score release severity 0-5:
0=internal/docs only, 1=minor bugfix, 2=non-breaking feature/improvement,
3=breaking change (minor scope), 4=security issue or major breaking change, 5=critical vulnerability

Output valid JSON only: {"severity": number, "rationale": string}`,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Categories: ${categories.join(', ')}\nBreaking changes: ${breakingChanges.join('; ') || 'none'}`,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  return JSON.parse(extractJson(text)) as SeverityResult
}

// Summarize release using Haiku — cost-efficient high-volume path
export async function summarizeRelease(
  repoFullName: string,
  tagName: string,
  releaseBody: string
): Promise<SummarizeResult> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    system: [
      {
        type: 'text',
        text: `You are a developer newsletter editor. Summarize release notes clearly and factually.
Every claim must be directly traceable to the source. Do not embellish or infer.

Output valid JSON only:
{"one_liner": string, "what_changed": string, "what_to_do": string, "citations": [{"claim": string, "source_excerpt": string}]}`,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Repo: ${repoFullName}\nTag: ${tagName}\n\nRelease notes:\n${releaseBody}`,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  return JSON.parse(extractJson(text)) as SummarizeResult
}

// Grounding check using Sonnet — verifies all claims trace to source
export async function groundingCheck(
  releaseBody: string,
  summary: SummarizeResult
): Promise<GroundingResult> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: [
      {
        type: 'text',
        text: `You are a fact-checker. Verify every claim in the summary traces directly to the source release notes.
Flag any claim not directly supported by the source.

Output valid JSON only: {"pass": boolean, "unsupported_claims": [{"claim": string, "reason": string}]}`,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Source release notes:\n${releaseBody}\n\nSummary what_changed:\n${summary.what_changed}\n\nSummary what_to_do:\n${summary.what_to_do}\n\nCitations:\n${JSON.stringify(summary.citations)}`,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  return JSON.parse(extractJson(text)) as GroundingResult
}

// Adversarial hallucination check using Haiku
export async function hallucinationCheck(
  releaseBody: string,
  summary: SummarizeResult
): Promise<HallucinationResult> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: [
      {
        type: 'text',
        text: `You are a skeptical fact-checker. Aggressively find any statements in the summary that are unsupported, embellished, or hallucinated relative to the source.

Output valid JSON only: {"pass": boolean, "flagged": [{"statement": string, "issue": string}]}`,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Source:\n${releaseBody}\n\nSummary:\n${summary.one_liner}\n\n${summary.what_changed}\n\n${summary.what_to_do}`,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  return JSON.parse(extractJson(text)) as HallucinationResult
}

// Full pipeline: classify → severity → editorial filter → summarize → grounding → hallucination
export async function processRelease(
  repoFullName: string,
  tagName: string,
  releaseBody: string
): Promise<PipelineOutput & { groundingResult?: GroundingResult; hallucinationResult?: HallucinationResult }> {
  const modelVersion = 'sonnet-4-6/haiku-4-5'

  const [classification, severityResult] = await Promise.all([
    classifyRelease(repoFullName, releaseBody),
    (async () => {
      // Can't run in parallel since severity depends on classify, but we do classify first
      return null
    })(),
  ])

  const severity = await scoreSeverity(classification.categories as Category[], classification.breaking_changes)

  // Editorial filter
  if (severity.severity === 0) {
    return { type: 'drop', severity: 0, categories: classification.categories as Category[], model_version: modelVersion }
  }

  if (severity.severity <= 2) {
    const summary = await summarizeRelease(repoFullName, tagName, releaseBody)
    return {
      type: 'update',
      severity: severity.severity,
      categories: classification.categories as Category[],
      summary,
      model_version: modelVersion,
    }
  }

  // Article path: full treatment with quality checks
  const summary = await summarizeRelease(repoFullName, tagName, releaseBody)
  const [groundingResult, hallucinationResult] = await Promise.all([
    groundingCheck(releaseBody, summary),
    hallucinationCheck(releaseBody, summary),
  ])

  const title = `${repoFullName} ${tagName}: ${summary.one_liner}`

  return {
    type: 'article',
    severity: severity.severity,
    categories: classification.categories as Category[],
    summary,
    title,
    model_version: modelVersion,
    groundingResult,
    hallucinationResult,
  }
}

function extractJson(text: string): string {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error(`No JSON found in LLM response: ${text}`)
  return match[0]
}
