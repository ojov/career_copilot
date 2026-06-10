import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: 'var(--background)' }}>
      <div className="max-w-2xl w-full text-center space-y-8">
        {/* Logo / title */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium"
            style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.3)' }}>
            Powered by Gemini + MongoDB
          </div>
          <h1 className="text-5xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>
            Remote Career{' '}
            <span style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Copilot
            </span>
          </h1>
          <p className="text-lg" style={{ color: 'var(--muted)' }}>
            Upload your CV. Find remote jobs. Close the skill gap. Land the role.
          </p>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-2 gap-4 text-left">
          {[
            { icon: '📄', title: 'CV Analysis', desc: 'Extract your skills and experience instantly' },
            { icon: '🔍', title: 'Job Matching', desc: 'Real remote listings ranked by fit score' },
            { icon: '📈', title: 'Skill Gaps', desc: 'Know exactly what to learn next' },
            { icon: '🔔', title: 'Follow-up Alerts', desc: 'Never let an application go cold' },
          ].map(f => (
            <div key={f.title} className="p-4 rounded-xl space-y-1"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="text-2xl">{f.icon}</div>
              <div className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>{f.title}</div>
              <div className="text-xs" style={{ color: 'var(--muted)' }}>{f.desc}</div>
            </div>
          ))}
        </div>

        <Link href="/dashboard"
          className="inline-block px-8 py-3.5 rounded-full text-white font-semibold text-base transition-opacity hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)' }}>
          Get Started →
        </Link>
      </div>
    </main>
  )
}
