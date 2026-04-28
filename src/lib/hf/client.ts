export const HF_BASE = 'https://huggingface.co/api'

export interface HFModel {
  id: string
  author: string
  modelId: string
  likes: number
  downloads: number
  pipeline_tag?: string
  lastModified: string
}

export interface HFCommit {
  id: string
  title: string
  message?: string
  date: string
  authors: Array<{ name: string; email?: string }>
  changedFiles?: Array<{ type: string; path: string }>
}

function hfHeaders(): HeadersInit {
  const headers: Record<string, string> = {}
  if (process.env.HF_API_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.HF_API_TOKEN}`
  }
  return headers
}

export async function fetchModel(modelId: string): Promise<HFModel> {
  const res = await fetch(`${HF_BASE}/models/${modelId}`, { headers: hfHeaders() })
  if (!res.ok) throw new Error(`HF API error ${res.status} for model ${modelId}`)
  return res.json() as Promise<HFModel>
}

export async function fetchModelCommits(modelId: string, limit = 10): Promise<HFCommit[]> {
  const res = await fetch(`${HF_BASE}/models/${modelId}/commits/main?limit=${limit}`, {
    headers: hfHeaders(),
  })
  if (!res.ok) throw new Error(`HF commits error ${res.status} for ${modelId}`)
  const data = await res.json() as { commits?: HFCommit[] } | HFCommit[]
  // API returns either { commits: [...] } or a direct array depending on version
  return Array.isArray(data) ? data : (data.commits ?? [])
}

export async function fetchModelCard(modelId: string): Promise<string> {
  const res = await fetch(`https://huggingface.co/${modelId}/raw/main/README.md`, {
    headers: hfHeaders(),
  })
  if (!res.ok) return ''
  const text = await res.text()
  return text.slice(0, 6000)
}

export async function searchModels(pipelineTag: string, limit = 10): Promise<HFModel[]> {
  const url = `${HF_BASE}/models?sort=likes&direction=-1&limit=${limit}&pipeline_tag=${encodeURIComponent(pipelineTag)}`
  const res = await fetch(url, { headers: hfHeaders() })
  if (!res.ok) throw new Error(`HF search error ${res.status} for pipeline_tag=${pipelineTag}`)
  return res.json() as Promise<HFModel[]>
}
