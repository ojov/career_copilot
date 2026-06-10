interface Props {
  job: Record<string, unknown>
}

export default function JobCard({ job }: Props) {
  return (
    <div className="p-5 rounded-xl space-y-3 transition-all hover:scale-[1.01]"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-base" style={{ color: 'var(--foreground)' }}>{job.title as string}</h3>
          <p className="text-sm" style={{ color: 'var(--accent2)' }}>{job.company as string}</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full shrink-0"
          style={{ background: 'rgba(6,182,212,0.1)', color: 'var(--accent2)', border: '1px solid rgba(6,182,212,0.3)' }}>
          {job.location as string}
        </span>
      </div>

      <p className="text-sm line-clamp-3" style={{ color: 'var(--muted)' }}>
        {job.description as string}
      </p>

      {!!(job.salary_min || job.salary_max) && (
        <p className="text-xs font-medium" style={{ color: 'var(--success)' }}>
          ${(job.salary_min as number | undefined)?.toLocaleString()} – ${(job.salary_max as number | undefined)?.toLocaleString()}
        </p>
      )}

      <a href={job.redirect_url as string} target="_blank" rel="noopener noreferrer"
        className="inline-block text-sm font-medium px-4 py-1.5 rounded-full transition-opacity hover:opacity-80"
        style={{ background: 'var(--accent)', color: '#fff' }}>
        View Job →
      </a>
    </div>
  )
}
