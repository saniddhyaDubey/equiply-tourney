import { useState, useRef, useCallback } from 'react'

export default function FileUpload({ onUpload, loading }) {
  const [dragActive, setDragActive] = useState(false)
  const [file, setFile] = useState(null)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  const validateFile = (f) => {
    if (!f) return 'No file selected.'
    if (!f.name.endsWith('.csv')) return 'Only CSV files are accepted.'
    if (f.size > 50 * 1024 * 1024) return 'File must be under 50 MB.'
    return null
  }

  const handleFile = useCallback((f) => {
    const err = validateFile(f)
    if (err) {
      setError(err)
      setFile(null)
      return
    }
    setError(null)
    setFile(f)
  }, [])

  const handleDrop = (e) => {
    e.preventDefault()
    setDragActive(false)
    handleFile(e.dataTransfer.files[0])
  }

  const handleDrag = (e) => {
    e.preventDefault()
    setDragActive(e.type === 'dragenter' || e.type === 'dragover')
  }

  const handleChange = (e) => {
    handleFile(e.target.files[0])
  }

  const handleSubmit = () => {
    if (file && onUpload) onUpload(file)
  }

  const formatBytes = (bytes) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col gap-4">
      {/* Drop zone */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => !file && inputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-2xl p-10 flex flex-col items-center gap-4
          transition-all duration-200 cursor-pointer select-none
          ${dragActive
            ? 'border-accent bg-navy/5 drag-active scale-[1.01]'
            : file
            ? 'border-navy/40 bg-navy/3 cursor-default'
            : 'border-navy/25 hover:border-navy/50 hover:bg-navy/5'
          }
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleChange}
        />

        {file ? (
          <>
            <div className="w-14 h-14 rounded-xl bg-navy/10 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-navy">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M8 13h8M8 17h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="text-center">
              <p className="font-medium text-navy font-body">{file.name}</p>
              <p className="text-sm text-navy/50 mt-0.5 font-mono">{formatBytes(file.size)}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setFile(null); setError(null) }}
              className="text-xs text-navy/40 hover:text-red-500 transition-colors underline"
            >
              Remove file
            </button>
          </>
        ) : (
          <>
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center transition-colors ${dragActive ? 'bg-navy text-cream' : 'bg-navy/8 text-navy'}`}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="17 8 12 3 7 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="text-center">
              <p className="font-medium text-navy">
                {dragActive ? 'Drop your CSV here' : 'Drag & drop your CSV file'}
              </p>
              <p className="text-sm text-navy/50 mt-1">or click to browse — max 50 MB</p>
            </div>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-500 text-center font-body">{error}</p>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!file || loading}
        className={`
          w-full py-3 rounded-xl font-medium text-sm tracking-wide transition-all duration-200
          ${file && !loading
            ? 'bg-navy text-cream hover:bg-navy-light active:scale-[0.98] shadow-md hover:shadow-lg'
            : 'bg-navy/20 text-navy/40 cursor-not-allowed'
          }
        `}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <Spinner />
            Processing…
          </span>
        ) : (
          'Enrich Data'
        )}
      </button>
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
    </svg>
  )
}
