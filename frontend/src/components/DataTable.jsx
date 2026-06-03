import { useState } from 'react'

const ENRICHED_COLS = ['manufactured_date', 'device_type']
const PAGE_SIZE = 50

export default function DataTable({ rows }) {
  const [page, setPage] = useState(0)

  if (!rows || rows.length === 0) {
    return <div className="text-center py-12 text-navy/40 font-body text-sm">No data to display.</div>
  }

  // Filter out the internal outlier column from visible columns
  const allKeys = Object.keys(rows[0])
  const columns = allKeys.filter(c => c !== '_outlier_reason')

  const totalPages = Math.ceil(rows.length / PAGE_SIZE)
  const pageRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="flex flex-col gap-3">
      <div className="w-full overflow-x-auto rounded-xl border border-navy/10 scrollbar-navy">
        <table className="min-w-full text-sm font-body">
          <thead>
            <tr className="bg-navy text-cream">
              {columns.map((col) => (
                <th
                  key={col}
                  className={`px-4 py-3 text-left font-medium whitespace-nowrap select-none
                    ${ENRICHED_COLS.includes(col) ? 'text-accent' : 'text-cream/80'}`}
                >
                  <span className="flex items-center gap-1.5">
                    {col}
                    {ENRICHED_COLS.includes(col) && (
                      <span className="text-[10px] bg-accent/20 text-accent border border-accent/30 px-1.5 py-0.5 rounded-full font-mono leading-none">
                        new
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => {
              const outlierReason = row['_outlier_reason']
              const isOutlier = !!outlierReason
              return (
                <tr
                  key={i}
                  className={`border-t border-navy/8 transition-colors
                    ${isOutlier
                      ? 'bg-amber-50 hover:bg-amber-100'
                      : i % 2 === 0 ? 'hover:bg-navy/5' : 'bg-navy/[0.02] hover:bg-navy/5'
                    }`}
                >
                  {columns.map((col) => {
                    const val = row[col]
                    const isEmpty = val === null || val === undefined ||
                      String(val).toLowerCase() === 'null' || String(val).trim() === ''

                    // Highlight the manufactured_date cell specifically if this row is an outlier
                    const isOutlierCell = isOutlier && col === 'manufactured_date'

                    return (
                      <td
                        key={col}
                        className={`px-4 py-2.5 whitespace-nowrap font-mono text-xs
                          ${ENRICHED_COLS.includes(col)
                            ? isEmpty ? 'text-navy/30 italic' : 'text-navy font-medium'
                            : 'text-navy/70'
                          }
                          ${isOutlierCell ? 'relative' : ''}
                        `}
                      >
                        {isOutlierCell ? (
                          <OutlierCell value={isEmpty ? '—' : String(val)} reason={outlierReason} />
                        ) : (
                          isEmpty ? '—' : String(val)
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-navy/50 font-body px-1">
          <span>
            Rows {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, rows.length)} of {rows.length}
          </span>
          <div className="flex gap-1">
            <PageBtn onClick={() => setPage(0)} disabled={page === 0} label="«" />
            <PageBtn onClick={() => setPage(p => p - 1)} disabled={page === 0} label="‹" />
            <span className="px-2 py-1 rounded bg-navy/8 text-navy font-medium">
              {page + 1} / {totalPages}
            </span>
            <PageBtn onClick={() => setPage(p => p + 1)} disabled={page === totalPages - 1} label="›" />
            <PageBtn onClick={() => setPage(totalPages - 1)} disabled={page === totalPages - 1} label="»" />
          </div>
        </div>
      )}
    </div>
  )
}

function OutlierCell({ value, reason }) {
  const [show, setShow] = useState(false)
  return (
    <span
      className="relative inline-flex items-center gap-1 cursor-help"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span className="text-amber-700 font-semibold">{value}</span>
      {/* Warning icon */}
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="text-amber-500 flex-shrink-0">
        <path d="M8 1.5L14.5 13H1.5L8 1.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M8 6v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="8" cy="11.5" r="0.5" fill="currentColor"/>
      </svg>
      {/* Tooltip */}
      {show && (
        <span className="absolute bottom-full left-0 mb-2 z-50 w-72 bg-navy text-cream text-[11px] font-body leading-relaxed px-3 py-2.5 rounded-lg shadow-xl pointer-events-none">
          <span className="flex items-start gap-1.5">
            <span className="text-amber-400 flex-shrink-0 mt-0.5">⚠</span>
            <span>{reason}</span>
          </span>
          {/* Arrow */}
          <span className="absolute top-full left-4 border-4 border-transparent border-t-navy" />
        </span>
      )}
    </span>
  )
}

function PageBtn({ onClick, disabled, label }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-2 py-1 rounded hover:bg-navy/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
    >
      {label}
    </button>
  )
}
