import { Link, useLocation } from 'react-router-dom'

export default function Navbar() {
  const { pathname } = useLocation()

  return (
    <nav className="bg-navy text-cream shadow-md">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-md bg-cream/10 border border-cream/20 flex items-center justify-center group-hover:bg-cream/20 transition-colors">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-cream">
              <path d="M2 4h12M2 8h8M2 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="font-display text-xl tracking-tight">equiply</span>
        </Link>

        {/* Breadcrumb steps */}
        <div className="flex items-center gap-1 text-sm font-body">
          <Step to="/" label="Upload" active={pathname === '/'} done={pathname === '/results'} />
          <ChevronSep />
          <Step to="/results" label="Results" active={pathname === '/results'} done={false} />
        </div>
      </div>
    </nav>
  )
}

function Step({ to, label, active, done }) {
  return (
    <Link
      to={to}
      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
        active
          ? 'bg-cream text-navy'
          : done
          ? 'text-cream/70 hover:text-cream'
          : 'text-cream/40 pointer-events-none'
      }`}
    >
      {label}
    </Link>
  )
}

function ChevronSep() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-cream/30">
      <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
