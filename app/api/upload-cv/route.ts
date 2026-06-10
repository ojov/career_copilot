import { NextRequest } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { extractTextFromPdf } from '@/lib/pdf-parser'
import { extractProfileFromCV } from '@/lib/gemini'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('cv') as File | null
    if (!file) return Response.json({ error: 'No file provided' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const text = await extractTextFromPdf(buffer)
    const profile = await extractProfileFromCV(text)

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
