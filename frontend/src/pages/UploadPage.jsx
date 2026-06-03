import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import FileUpload from '../components/FileUpload'

export default function UploadPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  const handleUpload = async (file) => {
    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/enrich', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(err.detail || `Server error ${res.status}`)
      }

      const data = await res.json()
      navigate('/results', {
        state: {
          rows: data.rows,
          filename: data.filename,
          total: data.total,
          decoderLogic: data.decoder_logic,
        },
      })
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      {/* Hero */}
      <div className="mb-12 text-center animate-fade-in-up">
        <span className="inline-block mb-4 px-3 py-1 rounded-full bg-navy/8 text-navy text-xs font-mono tracking-widest uppercase">
          Step 1 of 2
        </span>
        <h1 className="font-display text-4xl text-navy leading-tight">
          Upload your<br />
          <em>device CSV</em>
        </h1>
        <p className="mt-4 text-navy/60 font-body text-base leading-relaxed max-w-sm mx-auto">
          We'll enrich your data with{' '}
          <code className="font-mono text-sm bg-navy/8 px-1.5 py-0.5 rounded">manufactured_date</code>{' '}
          and{' '}
          <code className="font-mono text-sm bg-navy/8 px-1.5 py-0.5 rounded">device_type</code>{' '}
          columns, then sort everything by date.
        </p>
      </div>

      <div className="animate-fade-in-up animate-fade-in-up-delay-1">
        <FileUpload onUpload={handleUpload} loading={loading} />
      </div>

      {error && (
        <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-center animate-fade-in-up">
          <p className="text-sm text-red-600 font-body">{error}</p>
        </div>
      )}

      {/* What happens next */}
      <div className="mt-12 animate-fade-in-up animate-fade-in-up-delay-2">
        <p className="text-xs text-navy/30 uppercase font-mono tracking-widest text-center mb-4">
          What happens next
        </p>
        <div className="grid grid-cols-3 gap-3">
          {STEPS.map(({ icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-navy/4 text-center">
              <span className="text-2xl">{icon}</span>
              <span className="text-xs text-navy/60 font-body leading-snug">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const STEPS = [
  { icon: '🔍', label: 'Parse & validate your CSV structure' },
  { icon: '⚙️', label: 'Enrich with manufactured date & device type' },
  { icon: '📊', label: 'Visualise distribution and export results' },
]
