import { NextRequest } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { searchJobs } from '@/lib/jobs'
import { ObjectId } from 'mongodb'

// Returns job listings only. Skill-gap analysis is a separate, slower call
// (/api/gaps) so the job list renders fast and never depends on the agent.
export async function GET(req: NextRequest) {
  try {
    const profileId = req.nextUrl.searchParams.get('profileId')
    if (!profileId) return Response.json({ error: 'profileId required' }, { status: 400 })

    const db = await getDb()
    const profile = await db.collection('profiles').findOne({ _id: new ObjectId(profileId) })
    if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

    const skills: string[] = Array.isArray(profile.skills) ? profile.skills : []
    // Pass a generous slice: searchJobs queries on the top few but scores
    // relevance against all of them, so distinctive skills (FastAPI, Kafka)
    // help surface genuinely matching roles.
    const jobs = await searchJobs(skills.slice(0, 15))

    if (jobs.length === 0) {
      return Response.json({ jobs: [] })
    }

    // Cache jobs so /api/gaps can analyze them without re-fetching.
    await db.collection('jobs').insertMany(
      jobs.map(j => ({ ...j, profileId, cachedAt: new Date() }))
    )

    return Response.json({ jobs })
  } catch (err) {
    console.error(err)
    return Response.json({ error: 'Failed to fetch jobs' }, { status: 500 })
  }
}
