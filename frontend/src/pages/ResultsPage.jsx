import { useLocation, useNavigate } from 'react-router-dom'
import DataTable from '../components/DataTable'
import DeviceTypePieChart from '../components/DeviceTypePieChart'
import ExportButton from '../components/ExportButton'

export default function ResultsPage() {
  const { state } = useLocation()
  const navigate = useNavigate()

  const rows = state?.rows ?? []
  const filename = state?.filename ?? 'data.csv'
  const decoderLogic = state?.decoderLogic ?? {}
  const enrichedFilename = filename.replace(/\.csv$/i, '_enriched.csv')

  if (rows.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-24 text-center">
        <p className="text-navy/50 font-body mb-4">No results found. Upload a file first.</p>
        <button
          onClick={() => navigate('/')}
          className="px-5 py-2.5 rounded-xl bg-navy text-cream text-sm font-body hover:bg-navy-light transition-colors"
        >
          ← Go to Upload
        </button>
      </div>
    )
  }

  // Stats
  const withDate = rows.filter(
    (r) => r.manufactured_date && String(r.manufactured_date).trim() !== '' && String(r.manufactured_date).toLowerCase() !== 'null'
  )
  const deviceTypes = new Set(rows.map((r) => r.device_type).filter(Boolean))
  const manufacturers = new Set(rows.map((r) => r.manufacturer).filter(Boolean))

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-10 animate-fade-in-up">
        <div>
          <span className="inline-block mb-2 px-3 py-1 rounded-full bg-navy/8 text-navy text-xs font-mono tracking-widest uppercase">
            Step 2 of 2
          </span>
          <h1 className="font-display text-3xl text-navy">Enriched Results</h1>
          <p className="mt-1 text-navy/50 font-body text-sm">
            {rows.length} rows · source:{' '}
            <span className="font-mono">{filename}</span>
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2.5 rounded-xl border border-navy/20 text-navy text-sm font-body hover:bg-navy/5 transition-colors"
          >
            ← New Upload
          </button>
          <ExportButton rows={rows} filename={enrichedFilename} />
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10 animate-fade-in-up animate-fade-in-up-delay-1">
        <StatCard label="Total Devices" value={rows.length} />
        <StatCard label="Manufacturers" value={manufacturers.size} />
        <StatCard label="Device Types" value={deviceTypes.size} />
        <StatCard
          label="Date Coverage"
          value={`${Math.round((withDate.length / rows.length) * 100)}%`}
          sub={`${withDate.length} / ${rows.length} identified`}
        />
      </div>

      {/* Two-column: chart left, table right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 animate-fade-in-up animate-fade-in-up-delay-2">
          <SectionCard title="Device Type Distribution" hint={`${deviceTypes.size} categories`}>
            <DeviceTypePieChart rows={rows} decoderLogic={decoderLogic} />
          </SectionCard>
        </div>

        <div className="lg:col-span-2 animate-fade-in-up animate-fade-in-up-delay-3">
          <SectionCard
            title="Enriched Data"
            hint="Teal columns were added · sorted by manufactured_date ↑"
          >
            <DataTable rows={rows} />
          </SectionCard>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-xl border border-navy/10 bg-white px-5 py-4 shadow-sm">
      <p className="text-xs text-navy/40 font-body uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-display text-navy">{value}</p>
      {sub && <p className="text-xs text-navy/40 font-body mt-0.5">{sub}</p>}
    </div>
  )
}

function SectionCard({ title, hint, children }) {
  return (
    <div className="rounded-2xl border border-navy/10 bg-white shadow-sm overflow-hidden h-full flex flex-col">
      <div className="px-5 py-4 border-b border-navy/8 flex-shrink-0">
        <h2 className="font-body font-semibold text-navy text-sm">{title}</h2>
        {hint && <p className="text-xs text-navy/40 mt-0.5">{hint}</p>}
      </div>
      <div className="p-5 flex-1">{children}</div>
    </div>
  )
}
