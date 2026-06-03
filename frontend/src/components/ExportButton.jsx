export default function ExportButton({ rows, filename = 'enriched_data.csv' }) {
  const handleExport = () => {
    if (!rows || rows.length === 0) return

    const columns = Object.keys(rows[0])
    const header = columns.join(',')
    const csvRows = rows.map((row) =>
      columns
        .map((col) => {
          const val = row[col] ?? ''
          return typeof val === 'string' && (val.includes(',') || val.includes('"'))
            ? `"${val.replace(/"/g, '""')}"`
            : val
        })
        .join(',')
    )
    const csvContent = [header, ...csvRows].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={handleExport}
      disabled={!rows || rows.length === 0}
      className="
        flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium font-body
        bg-navy text-cream hover:bg-navy-light active:scale-[0.98]
        transition-all duration-150 shadow-sm hover:shadow-md
        disabled:opacity-40 disabled:cursor-not-allowed
      "
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <polyline points="7 10 12 15 17 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      Export CSV
    </button>
  )
}
