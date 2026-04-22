import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { Octokit } from '@octokit/rest'
import { z } from 'zod'

const schema = z.object({
  content: z.string(),
  fileType: z.enum(['package.json', 'requirements.txt', 'go.mod']),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = schema.parse(await req.json())
  const packages = extractPackages(body.content, body.fileType)

  const service = createServiceClient()
  const octokit = new Octokit()
  const followed: string[] = []

  for (const pkg of packages.slice(0, 50)) {
    // Try to find GitHub repo for this package
    const repoFullName = await resolvePackageToRepo(pkg, body.fileType, octokit)
    if (!repoFullName) continue

    const [owner, name] = repoFullName.split('/')

    // Upsert repo
    const { data: repo } = await service
      .from('repos')
      .upsert({ owner, name }, { onConflict: 'owner,name' })
      .select()
      .single()

    if (!repo) continue

    // Follow
    await service
      .from('follows')
      .upsert({ user_id: user.id, repo_id: repo.id }, { onConflict: 'user_id,repo_id' })

    followed.push(repoFullName)
  }

  return NextResponse.json({ followed, count: followed.length })
}

function extractPackages(content: string, fileType: string): string[] {
  if (fileType === 'package.json') {
    try {
      const pkg = JSON.parse(content)
      return [
        ...Object.keys(pkg.dependencies ?? {}),
        ...Object.keys(pkg.devDependencies ?? {}),
      ].filter((p) => !p.startsWith('@types/'))
    } catch {
      return []
    }
  }

  if (fileType === 'requirements.txt') {
    return content
      .split('\n')
      .map((line) => line.trim().split(/[>=<!]/)[0].trim())
      .filter(Boolean)
  }

  if (fileType === 'go.mod') {
    return content
      .split('\n')
      .filter((line) => line.trim().startsWith('require') || line.includes('github.com'))
      .map((line) => {
        const match = line.match(/github\.com\/([^/]+\/[^\s]+)/)
        return match ? `github.com/${match[1]}` : null
      })
      .filter(Boolean) as string[]
  }

  return []
}

async function resolvePackageToRepo(
  pkg: string,
  fileType: string,
  octokit: Octokit
): Promise<string | null> {
  try {
    if (pkg.startsWith('github.com/')) {
      return pkg.replace('github.com/', '')
    }

    // Search GitHub for the package
    const query = fileType === 'requirements.txt'
      ? `${pkg} language:python`
      : `${pkg} in:name`

    const { data } = await octokit.rest.search.repos({
      q: query,
      sort: 'stars',
      per_page: 1,
    })

    return data.items[0]?.full_name ?? null
  } catch {
    return null
  }
}
