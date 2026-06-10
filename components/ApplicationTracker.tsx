'use client'

import { useState, useEffect, useCallback } from 'react'

const STATUS_COLORS: Record<string, string> = {
  applied: '#f59e0b',
  interviewing: '#06b6d4',
  offered: '#10b981',
  rejected: '#ef4444',
  ghosted: '#94a3b8',
}

interface Application {
  _id: string
  company: string
  role: string
  status: string
  appliedAt: string
  needsFollowUp: boolean
  contact?: string
  notes?: string
}

interface Props {
  profileId: string
}

export default function ApplicationTracker({ profileId }: Props) {
  const [apps, setApps] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ company: '', role: '', contact: '' })

  const load = useCallback(async () => {
    const res = await fetch(`/api/applications?profileId=${profileId}`)
    const data = await res.json()
    setApps(data.applications ?? [])
    setLoading(false)
  }, [profileId])

  useEffect(() => { load() }, [load])

  async function addApplication() {
    if (!form.company || !form.role) return
    await fetch('/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId, ...form }),
    })
    setForm({ company: '', role: '', contact: '' })
    setAdding(false)
    load()
  }

  async function updateStatus(id: string, status: string) {
    await fetch('/api/applications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationId: id, status }),
    })
    load()
  }

  if (loading) return <div className="py-20 text-center" style={{ color: 'var(--muted)' }}>Loading applications...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold" style={{ color: 'var(--foreground)' }}>Applications ({apps.length})</h2>
        <button onClick={() => setAdding(!adding)}
          className="text-sm px-4 py-1.5 rounded-full font-medium"
          style={{ background: 'var(--accent)', color: '#fff' }}>
          + Log Application
        </button>
      </div>

      {adding && (
        <div className="p-4 rounded-xl space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {(['company', 'role', 'contact'] as const).map(f => (
            <input key={f} placeholder={f.charAt(0).toUpperCase() + f.slice(1)}
              value={form[f]} onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: 'var(--surface2)', color: 'var(--foreground)', border: '1px solid var(--border)' }} />
          ))}
          <button onClick={addApplication}
            className="w-full py-2 rounded-lg text-sm font-medium"
            style={{ background: 'var(--accent)', color: '#fff' }}>
            Save
          </button>
        </div>
      )}

      {apps.length === 0 && !adding && (
        <div className="py-16 text-center" style={{ color: 'var(--muted)' }}>No applications yet. Log your first one!</div>
      )}

      {apps.map(app => (
        <div key={app._id} className="p-4 rounded-xl space-y-2"
          style={{ background: 'var(--surface)', border: `1px solid ${app.needsFollowUp ? 'var(--warning)' : 'var(--border)'}` }}>
          {app.needsFollowUp && (
            <p className="text-xs font-medium" style={{ color: 'var(--warning)' }}>
              ⚠ No response in 7+ days — follow up?
            </p>
          )}
          <div className="flex items-start justify-between">
            <div>
              <p className="font-medium text-sm" style={{ color: 'var(--foreground)' }}>{app.role}</p>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>{app.company}</p>
            </div>
            <select value={app.status}
              onChange={e => updateStatus(app._id, e.target.value)}
              className="text-xs px-2 py-1 rounded-full font-medium border-0 outline-none"
              style={{ background: `${STATUS_COLORS[app.status]}22`, color: STATUS_COLORS[app.status] }}>
              {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            Applied {new Date(app.appliedAt).toLocaleDateString()}
            {app.contact && ` · ${app.contact}`}
          </p>
        </div>
      ))}
    </div>
  )
}
