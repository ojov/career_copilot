const PRIORITY_COLORS = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' }

interface RoadmapItem {
  skill: string
  resource: string
  estimatedWeeks: number
}

interface MissingSkill {
  skill: string
  frequency: number
  priority: 'high' | 'medium' | 'low'
}

interface Props {
  gapAnalysis: Record<string, unknown> | null
}

export default function RoadmapPanel({ gapAnalysis }: Props) {
  if (!gapAnalysis) return (
    <div className="py-20 text-center" style={{ color: 'var(--muted)' }}>
      Upload your CV and fetch jobs to see your learning roadmap.
    </div>
  )

  const missing = (gapAnalysis.missingSkills ?? []) as MissingSkill[]
  const roadmap = (gapAnalysis.roadmap ?? []) as RoadmapItem[]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-semibold mb-3" style={{ color: 'var(--foreground)' }}>Skill Gaps</h2>
        <div className="space-y-2">
          {missing.map(s => (
            <div key={s.skill} className="flex items-center justify-between px-4 py-3 rounded-xl"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <span className="font-medium text-sm" style={{ color: 'var(--foreground)' }}>{s.skill}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--muted)' }}>in {s.frequency} listings</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
                  style={{ background: `${PRIORITY_COLORS[s.priority]}22`, color: PRIORITY_COLORS[s.priority] }}>
                  {s.priority}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-semibold mb-3" style={{ color: 'var(--foreground)' }}>Learning Roadmap</h2>
        <div className="space-y-2">
          {roadmap.map((item, i) => (
            <div key={item.skill} className="p-4 rounded-xl"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: 'var(--accent)', color: '#fff' }}>{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm" style={{ color: 'var(--foreground)' }}>{item.skill}</p>
                  <p className="text-xs truncate" style={{ color: 'var(--accent2)' }}>{item.resource}</p>
                </div>
                <span className="text-xs shrink-0" style={{ color: 'var(--muted)' }}>{item.estimatedWeeks}w</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
