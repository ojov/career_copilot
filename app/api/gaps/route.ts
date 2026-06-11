import { NextRequest } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

const AGENT_URL = process.env.AGENT_SERVICE_URL ?? 'http://localhost:8089'

// Skill-gap analysis is split out from /api/jobs so the job list can render
// immediately; this slower (~10s Gemini) call populates the roadmap separately.
export async function GET(req: NextRequest) {
  try {
    const profileId = req.nextUrl.searchParams.get('profileId')
    if (!profileId) return Response.json({ error: 'profileId required' }, { status: 400 })

    const db = await getDb()
    const profile = await db.collection('profiles').findOne({ _id: new ObjectId(profileId) })
    if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

    const skills: string[] = Array.isArray(profile.skills) ? profile.skills : []
    const cachedJobs = await db
      .collection('jobs')
      .find({ profileId })
      .sort({ cachedAt: -1 })
      .limit(10)
      .toArray()
    const descriptions = cachedJobs.map(j => j.description as string)

    if (descriptions.length === 0) {
      return Response.json({ gapAnalysis: null })
    }

    const gapRes = await fetch(`${AGENT_URL}/analyze-gaps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skills, job_descriptions: descriptions }),
      signal: AbortSignal.timeout(25000),
    })
    if (!gapRes.ok) {
      console.error(`analyze-gaps failed: ${gapRes.status} ${await gapRes.text()}`)
      return Response.json({ gapAnalysis: null })
    }
    const gapAnalysis = await gapRes.json()

    await db.collection('profiles').updateOne(
      { _id: new ObjectId(profileId) },
      { $set: { gapAnalysis, updatedAt: new Date() } }
    )

    return Response.json({ gapAnalysis })
  } catch (err) {
    console.error('gaps route error:', err)
    return Response.json({ gapAnalysis: null })
  }
}
