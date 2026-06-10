import { NextRequest } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { searchJobs } from '@/lib/adzuna'
import { analyzeSkillGaps } from '@/lib/gemini'
import { ObjectId } from 'mongodb'

export async function GET(req: NextRequest) {
  try {
    const profileId = req.nextUrl.searchParams.get('profileId')
    if (!profileId) return Response.json({ error: 'profileId required' }, { status: 400 })

    const db = await getDb()
    const profile = await db.collection('profiles').findOne({ _id: new ObjectId(profileId) })
    if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

    const jobs = await searchJobs(profile.skills.slice(0, 5))

    // Cache jobs in MongoDB
    await db.collection('jobs').insertMany(
      jobs.map(j => ({ ...j, profileId, cachedAt: new Date() }))
    )

    const descriptions = jobs.map(j => j.description)
    const gapAnalysis = await analyzeSkillGaps(profile.skills, descriptions)

    return Response.json({ jobs, gapAnalysis })
  } catch (err) {
    console.error(err)
    return Response.json({ error: 'Failed to fetch jobs' }, { status: 500 })
  }
}
