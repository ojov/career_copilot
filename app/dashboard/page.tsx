'use client'

import { useState } from 'react'
import CVUpload from '@/components/CVUpload'
import AgentChat from '@/components/AgentChat'
import JobCard from '@/components/JobCard'
import ApplicationTracker from '@/components/ApplicationTracker'
import RoadmapPanel from '@/components/RoadmapPanel'

type Tab = 'jobs' | 'applications' | 'roadmap'

export default function Dashboard() {
  const [profileId, setProfileId] = useState<string | null>(null)
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null)
  const [jobs, setJobs] = useState<unknown[]>([])
  const [gapAnalysis, setGapAnalysis] = useState<Record<string, unknown> | null>(null)
  const [tab, setTab] = useState<Tab>('jobs')
  const [loadingJobs, setLoadingJobs] = useState(false)

  async function handleProfileReady(id: string, p: Record<string, unknown>) {
    setProfileId(id)
    setProfile(p)
    setLoadingJobs(true)
    try {
      const res = await fetch(`/api/jobs?profileId=${id}`)
      const data = await res.json()
      setJobs(data.jobs ?? [])
    } finally {
      setLoadingJobs(false)
    }

    // Skill-gap analysis is slower (~10s) — load it in the background so the
    // job list isn't blocked. The Roadmap tab fills in once it resolves.
    fetch(`/api/gaps?profileId=${id}`)
      .then(r => r.json())
      .then(d => setGapAnalysis(d.gapAnalysis ?? null))
      .catch(() => setGapAnalysis(null))
  }

  if (!profileId) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6" style={{ background: 'var(--background)' }}>
        <CVUpload onReady={handleProfileReady} />
      </main>
    )
  }

  return (
    <main className="min-h-screen" style={{ background: 'var(--background)' }}>
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div>
          <h1 className="font-bold text-lg" style={{ color: 'var(--foreground)' }}>
            Remote Career Copilot
          </h1>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            Welcome back, {profile?.name as string ?? 'there'}
          </p>
        </div>
        <div className="flex gap-1">
          {(['jobs', 'applications', 'roadmap'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-all"
              style={tab === t
                ? { background: 'var(--accent)', color: '#fff' }
                : { color: 'var(--muted)', background: 'transparent' }}>
              {t}
            </button>
          ))}
        </div>
      </header>

      <div className="flex h-[calc(100vh-65px)]">
        {/* Main panel */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {tab === 'jobs' && (
            loadingJobs
              ? <div className="text-center py-20" style={{ color: 'var(--muted)' }}>Finding jobs matched to your skills...</div>
              : jobs.length === 0
                ? <div className="text-center py-20" style={{ color: 'var(--muted)' }}>No jobs found. Try updating your skills.</div>
                : (jobs as Record<string, unknown>[]).map(j => <JobCard key={j.id as string} job={j} />)
          )}
          {tab === 'applications' && <ApplicationTracker profileId={profileId} />}
          {tab === 'roadmap' && <RoadmapPanel gapAnalysis={gapAnalysis} />}
        </div>

        {/* Agent chat sidebar */}
        <div className="w-96 border-l" style={{ borderColor: 'var(--border)' }}>
          <AgentChat profileId={profileId} />
        </div>
      </div>
    </main>
  )
}
