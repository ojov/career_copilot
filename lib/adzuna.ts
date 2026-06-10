export interface AdzunaJob {
  id: string
  title: string
  company: string
  description: string
  salary_min?: number
  salary_max?: number
  location: string
  redirect_url: string
  created: string
}

export async function searchJobs(keywords: string[], country = 'gb'): Promise<AdzunaJob[]> {
  const appId = process.env.ADZUNA_APP_ID
  const apiKey = process.env.ADZUNA_API_KEY

  if (!appId || !apiKey) throw new Error('Adzuna credentials not configured')

  const query = keywords.join(' ')
  const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?app_id=${appId}&app_key=${apiKey}&results_per_page=10&what=${encodeURIComponent(query)}&where=remote&full_time=1`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Adzuna API error: ${res.status}`)

  const data = await res.json()
  return (data.results ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    title: r.title as string,
    company: (r.company as Record<string, string>)?.display_name ?? 'Unknown',
    description: r.description as string,
    salary_min: r.salary_min as number | undefined,
    salary_max: r.salary_max as number | undefined,
    location: ((r.location as Record<string, unknown>)?.display_name as string) ?? 'Remote',
    redirect_url: r.redirect_url as string,
    created: r.created as string,
  }))
}
