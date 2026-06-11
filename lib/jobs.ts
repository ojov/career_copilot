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

// Score a job by how many of the user's skills appear in its text. The free
// remote-first APIs have loose/broken search, so we filter for relevance here.
function relevanceScore(job: Job, skills: string[]): number {
  const haystack = `${job.title} ${job.description} ${job.source}`.toLowerCase()
  let score = 0
  for (const skill of skills) {
    const s = skill.toLowerCase().trim()
    if (!s) continue
    // Title matches count double — they're the strongest signal.
    if (job.title.toLowerCase().includes(s)) score += 2
    else if (haystack.includes(s)) score += 1
  }
  return score
}

function filterByRelevance(jobs: Job[], skills: string[]): Job[] {
  return jobs
    .map((job) => ({ job, score: relevanceScore(job, skills) }))
    .filter(({ score }) => score > 0)
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
  const tag = query.split(' ')[0]?.toLowerCase() ?? 'dev'
  const url = `https://remoteok.com/api?tags=${encodeURIComponent(tag)}`
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

export async function searchJobs(keywords: string[]): Promise<Job[]> {
  // OR semantics over the top few skills — ANDing many keywords kills results.
  const query = keywords.slice(0, 3).join(' ') || 'developer'
  const errors: string[] = []

  for (const provider of PROVIDERS) {
    try {
      const raw = await provider.fetchJobs(query)
      // The free remote-first APIs return loosely-matched (often irrelevant)
      // results, so only accept a provider if it yields skill-relevant jobs.
      const relevant = filterByRelevance(raw, keywords).slice(0, 10)
      if (relevant.length > 0) {
        console.log(`[jobs] ${provider.name}: ${relevant.length}/${raw.length} relevant for "${query}"`)
        return relevant
      }
      console.log(`[jobs] ${provider.name}: 0 relevant of ${raw.length}, trying next provider`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${provider.name}: ${msg}`)
      console.warn(`[jobs] ${provider.name} failed: ${msg}`)
    }
  }

  console.warn(`[jobs] all providers exhausted for "${query}". ${errors.join('; ')}`)
  return []
}
