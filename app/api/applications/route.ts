import { NextRequest } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

export async function GET(req: NextRequest) {
  const profileId = req.nextUrl.searchParams.get('profileId')
  if (!profileId) return Response.json({ error: 'profileId required' }, { status: 400 })

  const db = await getDb()
  const applications = await db
    .collection('applications')
    .find({ profileId })
    .sort({ appliedAt: -1 })
    .toArray()

  // Flag stale applications (>7 days, no update)
  const now = Date.now()
  const flagged = applications.map(app => ({
    ...app,
    needsFollowUp:
      app.status === 'applied' &&
      now - new Date(app.appliedAt).getTime() > 7 * 24 * 60 * 60 * 1000,
  }))

  return Response.json({ applications: flagged })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { profileId, company, role, appliedAt, contact, notes } = body

    if (!profileId || !company || !role) {
      return Response.json({ error: 'profileId, company and role required' }, { status: 400 })
    }

    const db = await getDb()
    const result = await db.collection('applications').insertOne({
      profileId,
      company,
      role,
      status: 'applied',
      appliedAt: appliedAt ? new Date(appliedAt) : new Date(),
      contact: contact ?? null,
      notes: notes ?? null,
      updatedAt: new Date(),
    })

    return Response.json({ applicationId: result.insertedId })
  } catch (err) {
    console.error(err)
    return Response.json({ error: 'Failed to log application' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { applicationId, status, notes } = body

    const db = await getDb()
    await db.collection('applications').updateOne(
      { _id: new ObjectId(applicationId) },
      { $set: { status, notes, updatedAt: new Date() } }
    )

    return Response.json({ success: true })
  } catch (err) {
    console.error(err)
    return Response.json({ error: 'Failed to update application' }, { status: 500 })
  }
}
