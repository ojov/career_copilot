'use client'

import { useState, useRef } from 'react'

interface Props {
  onReady: (profileId: string, profile: Record<string, unknown>) => void
}

export default function CVUpload({ onReady }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function upload(file: File) {
    if (!file.name.endsWith('.pdf')) {
      setError('Please upload a PDF file')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('cv', file)
      const res = await fetch('/api/upload-cv', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      onReady(data.profileId, data.profile)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) upload(file)
  }

  return (
    <div className="w-full max-w-lg space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>Upload your CV</h2>
        <p style={{ color: 'var(--muted)' }}>We'll extract your skills and find remote jobs that match</p>
      </div>

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className="cursor-pointer rounded-2xl p-12 text-center transition-all"
        style={{
          border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
          background: dragOver ? 'rgba(124,58,237,0.08)' : 'var(--surface)',
        }}
      >
        <div className="text-5xl mb-4">📄</div>
        {loading
          ? <p style={{ color: 'var(--accent2)' }}>Analyzing your CV with Gemini...</p>
          : <><p className="font-medium" style={{ color: 'var(--foreground)' }}>Drop your PDF here</p>
            <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>or click to browse</p></>
        }
        <input ref={inputRef} type="file" accept=".pdf" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) upload(f) }} />
      </div>

      {error && (
        <p className="text-sm text-center px-4 py-2 rounded-lg"
          style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.3)' }}>
          {error}
        </p>
      )}
    </div>
  )
}
