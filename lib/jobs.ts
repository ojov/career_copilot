// Multi-source remote job search with a fallback chain.
// Order: Remotive (remote-first, no key) → RemoteOK (remote-first, no key)
//        → Adzuna (volume, needs key). The first provider to return results wins.

export interface Job {
  id: string
  title: string
  company: string
  description: string
  salary_min?: number
  salary_max?: number
  location: string
  redirect_url: string
  created: string
  source: string
}

type Provider = {
  name: string
  fetchJobs: (query: string) => Promise<Job[]>
  tagsOf?: (job: Job) => string[]
}

function stripHtml(html: string): string {
  return (html ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

// Return all lowercase variants of a skill name to handle tag normalisation.
// e.g. "Node.js" → ["node.js", "node", "nodejs"], "JavaScript/TypeScript" →
// ["javascript", "typescript"]. Splits on slashes so combined skills match.
function skillVariants(skill: string): string[] {
  const variants = new Set<string>()
  for (const part of skill.toLowerCase().split('/')) {
    const s = part.trim()
    if (!s) continue
    variants.add(s)
    variants.add(s.replace(/\s+/g, ''))
    if (s.endsWith('.js')) {
      const base = s.slice(0, -3)
      variants.add(base)
      variants.add(base + 'js')
    }
  }
  return [...variants].filter(Boolean)
}

// Whole-word match so short skills don't false-positive on substrings:
// "go" must not match "ongoing", "java" must not match "javascript".
function matchesWord(haystack: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i').test(haystack)
}

// Score a job by how many of the user's skills appear in its text. The free
// remote-first APIs have loose/broken search, so we filter for relevance here.
function relevanceScore(job: Job, skills: string[]): number {
  const titleLower = job.title.toLowerCase()
  const bodyLower = `${job.description} ${job.source}`.toLowerCase()
  let score = 0
  for (const skill of skills) {
    const variants = skillVariants(skill)
    if (!variants.length) continue
    // Title matches count double — they're the strongest signal.
    if (variants.some(v => matchesWord(titleLower, v))) score += 2
    else if (variants.some(v => matchesWord(bodyLower, v))) score += 1
  }
  return score
}

// Require at least 2 points so a single coincidental match (e.g. the word "go"
// in prose) can't qualify an unrelated sales/writing job. A genuine match hits
// the title or several distinct skills.
function filterByRelevance(jobs: Job[], skills: string[]): Job[] {
  return jobs
    .map((job) => ({ job, score: relevanceScore(job, skills) }))
    .filter(({ score }) => score >= 2)
    .sort((a, b) => b.score - a.score)
    .map(({ job }) => job)
}

// ── Remotive ──────────────────────────────────────────────────────────────────
async function remotive(query: string): Promise<Job[]> {
  const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query)}&limit=10`
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`Remotive ${res.status}`)
  const data = await res.json()
  return (data.jobs ?? []).slice(0, 20).map((j: Record<string, unknown>) => ({
    id: `remotive-${j.id}`,
    title: j.title as string,
    company: (j.company_name as string) ?? 'Unknown',
    description: `${((j.tags as string[]) ?? []).join(' ')} ${stripHtml(j.description as string)}`,
    location: (j.candidate_required_location as string) || 'Remote',
    redirect_url: j.url as string,
    created: (j.publication_date as string) ?? new Date().toISOString(),
    source: 'Remotive',
  }))
}

// ── RemoteOK ──────────────────────────────────────────────────────────────────
async function remoteok(query: string): Promise<Job[]> {
  // RemoteOK accepts comma-separated tags; normalise each skill to alphanumeric slug.
  const tags = query.split(' ')
    .slice(0, 3)
    .map(k => k.toLowerCase().replace(/[^a-z0-9]/g, ''))
    .filter(Boolean)
    .join(',') || 'dev'
  const url = `https://remoteok.com/api?tags=${encodeURIComponent(tags)}`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'remote-career-copilot' },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`RemoteOK ${res.status}`)
  const data = await res.json()
  // First element is a legal/metadata notice — filter to real postings.
  return (Array.isArray(data) ? data : [])
    .filter((j: Record<string, unknown>) => j.position)
    .slice(0, 30)
    .map((j: Record<string, unknown>) => ({
      id: `remoteok-${j.id}`,
      title: j.position as string,
      company: (j.company as string) ?? 'Unknown',
      description: `${((j.tags as string[]) ?? []).join(' ')} ${stripHtml(j.description as string)}`,
      salary_min: j.salary_min as number | undefined,
      salary_max: j.salary_max as number | undefined,
      location: (j.location as string) || 'Remote',
      redirect_url: (j.url as string) ?? (j.apply_url as string),
      created: (j.date as string) ?? new Date().toISOString(),
      source: 'RemoteOK',
    }))
}

// ── Adzuna (fallback, needs key) ──────────────────────────────────────────────
async function adzuna(query: string, country = 'gb'): Promise<Job[]> {
  const appId = process.env.ADZUNA_APP_ID
  const apiKey = process.env.ADZUNA_API_KEY
  if (!appId || !apiKey) throw new Error('Adzuna credentials not configured')

  const params = new URLSearchParams({
    app_id: appId,
    app_key: apiKey,
    results_per_page: '10',
    what_or: query,
    what_phrase: 'remote',
  })
  const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params}`
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`Adzuna ${res.status}`)
  const data = await res.json()
  return (data.results ?? []).map((r: Record<string, unknown>) => ({
    id: `adzuna-${r.id}`,
    title: r.title as string,
    company: (r.company as Record<string, string>)?.display_name ?? 'Unknown',
    description: stripHtml(r.description as string),
    salary_min: r.salary_min as number | undefined,
    salary_max: r.salary_max as number | undefined,
    location: ((r.location as Record<string, unknown>)?.display_name as string) ?? 'Remote',
    redirect_url: r.redirect_url as string,
    created: r.created as string,
    source: 'Adzuna',
  }))
}

const PROVIDERS: Provider[] = [
  { name: 'Remotive', fetchJobs: remotive },
  { name: 'RemoteOK', fetchJobs: remoteok },
  { name: 'Adzuna', fetchJobs: (q) => adzuna(q) },
]

// Cap how many roles any single company contributes so one employer posting the
// same job across many cities (e.g. Remotive's fixed set) doesn't dominate.
function dedupeByCompany(jobs: Job[], maxPerCompany = 2): Job[] {
  const counts = new Map<string, number>()
  const seen = new Set<string>()
  const out: Job[] = []
  for (const job of jobs) {
    const company = job.company.toLowerCase().trim()
    // Skip exact same role at the same company (duplicate listings).
    const exact = `${company}::${job.title.toLowerCase().trim()}`
    if (seen.has(exact)) continue
    const n = counts.get(company) ?? 0
    if (n >= maxPerCompany) continue
    seen.add(exact)
    counts.set(company, n + 1)
    out.push(job)
  }
  return out
}

const MIN_VARIETY = 4 // distinct, relevant roles before we accept a provider

export async function searchJobs(keywords: string[]): Promise<Job[]> {
  // OR semantics over the top few skills — ANDing many keywords kills results.
  const query = keywords.slice(0, 3).join(' ') || 'developer'
  const errors: string[] = []
  let best: Job[] = [] // fallback: the most varied result if none clear the bar

  for (const provider of PROVIDERS) {
    try {
      const raw = await provider.fetchJobs(query)
      // Free APIs return loosely-matched results; filter for skill relevance,
      // then cap per-company so the list isn't one employer repeated.
      const relevant = dedupeByCompany(filterByRelevance(raw, keywords)).slice(0, 10)
      console.log(`[jobs] ${provider.name}: ${relevant.length} relevant/varied of ${raw.length} for "${query}"`)
      if (relevant.length >= MIN_VARIETY) return relevant
      if (relevant.length > best.length) best = relevant
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${provider.name}: ${msg}`)
      console.warn(`[jobs] ${provider.name} failed: ${msg}`)
    }
  }

  // None hit the variety bar — return the best we found rather than nothing.
  if (best.length > 0) {
    console.log(`[jobs] no provider hit variety bar; returning best (${best.length})`)
    return best
  }
  console.warn(`[jobs] all providers exhausted for "${query}". ${errors.join('; ')}`)
  return []
}
