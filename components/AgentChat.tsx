'use client'

import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'agent'
  content: string
}

interface Props {
  profileId: string
}

const SUGGESTIONS = [
  'Find me remote jobs',
  'What skills am I missing?',
  'I applied to Stripe today',
  'Draft a follow-up email',
]

export default function AgentChat({ profileId }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'agent', content: "Hi! I'm your career copilot. I can find jobs, analyze skill gaps, track applications, and draft follow-up emails. What would you like to do?" }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(text?: string) {
    const message = text ?? input.trim()
    if (!message || loading) return
    setInput('')
    setMessages(m => [...m, { role: 'user', content: message }])
    setLoading(true)
    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, profileId }),
      })
      const data = await res.json()
      setMessages(m => [...m, { role: 'agent', content: data.reply ?? 'Something went wrong.' }])
    } catch {
      setMessages(m => [...m, { role: 'agent', content: 'Connection error. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 font-semibold text-sm" style={{ borderBottom: '1px solid var(--border)', color: 'var(--foreground)' }}>
        Agent Chat
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[85%] px-3 py-2 rounded-2xl text-sm"
              style={m.role === 'user'
                ? { background: 'var(--accent)', color: '#fff', borderBottomRightRadius: 4 }
                : { background: 'var(--surface2)', color: 'var(--foreground)', border: '1px solid var(--border)', borderBottomLeftRadius: 4 }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="px-3 py-2 rounded-2xl text-sm" style={{ background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
              Thinking...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 space-y-2" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.map(s => (
            <button key={s} onClick={() => send(s)}
              className="text-xs px-2.5 py-1 rounded-full transition-opacity hover:opacity-80"
              style={{ background: 'var(--surface2)', color: 'var(--accent2)', border: '1px solid var(--border)' }}>
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Ask your copilot..."
            className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
            style={{ background: 'var(--surface2)', color: 'var(--foreground)', border: '1px solid var(--border)' }} />
          <button onClick={() => send()}
            className="px-3 py-2 rounded-xl font-medium text-sm transition-opacity hover:opacity-80"
            style={{ background: 'var(--accent)', color: '#fff' }}>
            →
          </button>
        </div>
      </div>
    </div>
  )
}
