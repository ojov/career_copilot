import { NextRequest } from 'next/server'

const AGENT_URL = process.env.AGENT_SERVICE_URL ?? 'http://localhost:8080'

export async function POST(req: NextRequest) {
  try {
    const { message, profileId, sessionId } = await req.json()
    if (!message || !profileId) {
      return Response.json({ error: 'message and profileId required' }, { status: 400 })
    }

    const res = await fetch(`${AGENT_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        profile_id: profileId,
        session_id: sessionId ?? null,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Agent service error:', err)
      return Response.json({ error: 'Agent service error' }, { status: 502 })
    }

    const data = await res.json()
    return Response.json({ reply: data.reply, sessionId: data.session_id })
  } catch (err) {
    console.error(err)
    return Response.json({ error: 'Agent error' }, { status: 500 })
  }
}
