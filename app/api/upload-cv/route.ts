import { NextRequest } from 'next/server'
import { getDb } from '@/lib/mongodb'

const AGENT_URL = process.env.AGENT_SERVICE_URL ?? 'http://localhost:8089'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('cv') as File | null
    if (!file) return Response.json({ error: 'No file provided' }, { status: 400 })

    // Send the raw PDF to the Python agent, which extracts text (pypdf) and
    // structures it with Gemini. Keeps fragile PDF parsing out of the
    // serverless bundle.
    const pdfBase64 = Buffer.from(await file.arrayBuffer()).toString('base64')

    const res = await fetch(`${AGENT_URL}/extract-cv-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdf_base64: pdfBase64 }),
    })
    if (!res.ok) {
      const detail = await res.text()
      throw new Error(`Agent extract-cv-pdf failed: ${res.status} ${detail}`)
    }
    const profile = await res.json()

    const db = await getDb()
    const result = await db.collection('profiles').insertOne({
      ...profile,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    return Response.json({ profileId: result.insertedId, profile })
  } catch (err) {
    console.error(err)
    return Response.json({ error: 'Failed to process CV' }, { status: 500 })
  }
}
