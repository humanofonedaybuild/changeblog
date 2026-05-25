import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

// Model selection — defaults to Haiku for launch cost control; promote to Sonnet after eval harness validates quality
const CLASSIFY_MODEL = process.env.LLM_CLASSIFY_MODEL ?? 'claude-haiku-4-5-20251001'
const SEVERITY_MODEL = process.env.LLM_SEVERITY_MODEL ?? 'claude-haiku-4-5-20251001'
const GROUNDING_MODEL = process.env.LLM_GROUNDING_MODEL ?? 'claude-sonnet-4-6'
export const MODEL_VERSION = `classify:${CLASSIFY_MODEL},severity:${SEVERITY_MODEL},grounding:${GROUNDING_MODEL}`

export type Category =
  | 'breaking'
  | 'security'
  | 'feature'
  | 'perf'
  | 'deprecation'
  | 'bugfix'
  | 'docs'
  | 'internal'
  | 'model-weights'

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

// Classify release notes — determines categories and breaking changes
export async function classifyRelease(
  repoFullName: string,
  releaseBody: string
): Promise<ClassifyResult> {
  const response = await client.messages.create({
    model: CLASSIFY_MODEL,
    max_tokens: 1024,
    system: [
      {
        type: 'text',
        text: `You are a release-notes analyst for open-source software. Classify release notes into categories and extract key changes.

Categories: breaking|security|feature|perf|deprecation|bugfix|docs|internal|model-weights

For summary_hint: write a one-phrase description of the user impact for a non-technical builder — focus on what breaks or changes for someone who just uses the library (e.g., "routing hook renamed — existing code breaks" not "Router.navigate() API refactored"). If nothing affects typical users, say so.

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

// Score severity 0-5
export async function scoreSeverity(
  categories: Category[],
  breakingChanges: string[]
): Promise<SeverityResult> {
  const response = await client.messages.create({
    model: SEVERITY_MODEL,
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
        text: `You are writing for people who build apps using AI coding tools (Cursor, Copilot, Claude) without deeply reading library docs or changelogs. They install packages, ask AI to write code, and ship. They don't know what "deprecation" means in practice — they just need to know: does this update break something I have, and what do I do?

Your job: translate release notes into plain English that answers three questions:
1. What actually happened? (no jargon)
2. Does this affect someone who uses this library in their app?
3. What should they do about it?

Tone: warm, direct, zero technical jargon. Write like you're texting a smart friend who builds apps but isn't a library author.

Field instructions:
- one_liner: One punchy sentence. Name the library (not the version number). Say whether this is a big deal and why a typical app builder would care. Bad: "v4.2.0 removes deprecated API surface." Good: "Tailwind just scrapped the config file entirely — if you upgrade, your whole setup needs to change."
- what_changed: 2–4 sentences. First sentence: what changed. Second sentence: what this means for someone who uses the library in their app (not for maintainers). Focus on real-world consequences: "your login flow will break", "builds will be noticeably faster", "this function no longer exists". Include why this matters — not what the maintainers intended, but what the user experiences.
- what_to_do: 2–4 sentences. Should they upgrade now, wait, or skip it? What is the one concrete thing to do? Write it like advice from a friend. If urgent (security bug, breakage), say so plainly. If safe to ignore for now, say that too.
- citations: Exact claims from your summary that map to specific phrases in the source release notes.

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

// Grounding check — verifies all claims trace to source
export async function groundingCheck(
  releaseBody: string,
  summary: SummarizeResult
): Promise<GroundingResult> {
  const response = await client.messages.create({
    model: GROUNDING_MODEL,
    max_tokens: 1024,
    system: [
      {
        type: 'text',
        text: `You are a fact-checker reviewing a plain-English translation of technical release notes written for non-technical users. The summary intentionally uses everyday language to describe technical changes.

Your job: verify that each claim in the summary is factually accurate relative to the source, even if expressed differently. Plain-language translations and implications are acceptable:
- "your login code will stop working" is supported if the source says "auth API removed"
- "builds are now much faster" is supported if the source mentions a performance improvement
- "you'll need to update your imports" is supported if a module was renamed or removed

Flag ONLY claims that are factually wrong or have no basis whatsoever in the source. Do NOT flag plain-English restatements, reasonable implications of stated changes, or simplified descriptions that omit technical nuance.

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
        text: `You are a fact-checker reviewing a plain-English translation of technical release notes. The summary is intentionally written for non-technical readers and uses everyday language — translations and paraphrasing are expected and fine.

Flag ONLY genuinely fabricated claims: things that are factually wrong or have absolutely no basis in the source release notes.

Do NOT flag:
- Plain-language restatements of technical facts ("your imports will break" for an API removal)
- Reasonable real-world implications of stated changes
- Simplified descriptions that drop technical nuance but aren't wrong
- Missing information (omission is not hallucination)

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
  const modelVersion = MODEL_VERSION

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
