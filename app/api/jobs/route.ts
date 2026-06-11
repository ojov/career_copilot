import { NextRequest } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { searchJobs } from '@/lib/jobs'
import { ObjectId } from 'mongodb'

const AGENT_URL = process.env.AGENT_SERVICE_URL ?? 'http://localhost:8089'

export async function GET(req: NextRequest) {
  try {
    const profileId = req.nextUrl.searchParams.get('profileId')
    if (!profileId) return Response.json({ error: 'profileId required' }, { status: 400 })

    const db = await getDb()
    const profile = await db.collection('profiles').findOne({ _id: new ObjectId(profileId) })
    if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

    const jobs = await searchJobs(profile.skills.slice(0, 5))

    if (jobs.length === 0) {
      return Response.json({ jobs: [], gapAnalysis: null })
    }

    // Cache jobs in MongoDB
    await db.collection('jobs').insertMany(
      jobs.map(j => ({ ...j, profileId, cachedAt: new Date() }))
    )

    const descriptions = jobs.map(j => j.description)
    const gapRes = await fetch(`${AGENT_URL}/analyze-gaps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skills: profile.skills, job_descriptions: descriptions }),
    })
    if (!gapRes.ok) {
      const detail = await gapRes.text()
      throw new Error(`Agent analyze-gaps failed: ${gapRes.status} ${detail}`)
    }
    const gapAnalysis = await gapRes.json()

    // Persist so the chat agent's get_skill_gaps tool can read it
    await db.collection('profiles').updateOne(
      { _id: new ObjectId(profileId) },
      { $set: { gapAnalysis, updatedAt: new Date() } }
    )

    return Response.json({ jobs, gapAnalysis })
  } catch (err) {
    console.error(err)
    return Response.json({ error: 'Failed to fetch jobs' }, { status: 500 })
  }
}
