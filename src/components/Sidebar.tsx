import type { View } from '../types'
import { mockCIs } from '../data/mockData'

interface SidebarProps {
  view: View
  onNavigate: (view: View) => void
}

const NAV_ITEMS: { view: View; label: string; icon: React.ReactNode }[] = [
  {
    view: 'dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    view: 'assets',
    label: 'Assets',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="3" width="20" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="2" y="10" width="20" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="2" y="17" width="20" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    view: 'scanner',
    label: 'Scanner',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.5" />
        <path d="M20 20l-3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M11 8v6M8 11h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    view: 'checklist',
    label: 'Checklist',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
]

export function Sidebar({ view, onNavigate }: SidebarProps) {
  const criticalCount = mockCIs.filter(ci => ci.criticality === 'Critical').length
  const actionRequired = mockCIs.filter(
    ci => ci.patchStatus === 'Critical patches' || ci.vulnerabilities.critical > 0
  ).length

  return (
    <>
    <aside className="sidebar">
      <div className="sidebar-brand">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="brand-icon">
          <path
            d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V6l-8-4z"
            fill="currentColor"
            opacity="0.15"
          />
          <path
            d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V6l-8-4z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="brand-name">SecOps CMDB</span>
      </div>

      <nav className="sidebar-nav">
        <button
          className={`nav-item ${view === 'dashboard' ? 'active' : ''}`}
          onClick={() => onNavigate('dashboard')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          Dashboard
        </button>
        <button
          className={`nav-item ${view === 'assets' ? 'active' : ''}`}
          onClick={() => onNavigate('assets')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="3" width="20" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" />
            <rect x="2" y="10" width="20" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" />
            <rect x="2" y="17" width="20" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          Assets
        </button>
        <button
          className={`nav-item ${view === 'scanner' ? 'active' : ''}`}
          onClick={() => onNavigate('scanner')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.5" />
            <path d="M20 20l-3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M11 8v6M8 11h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Scanner
        </button>
        <button
          className={`nav-item ${view === 'checklist' ? 'active' : ''}`}
          onClick={() => onNavigate('checklist')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5 8h14M5 12h4M5 16h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
            <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          Checklist
        </button>
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-stat">
          <span className="sidebar-stat-label">Total CIs</span>
          <span className="sidebar-stat-value">{mockCIs.length}</span>
        </div>
        <div className="sidebar-stat">
          <span className="sidebar-stat-label">Critical</span>
          <span className="sidebar-stat-value sidebar-stat-critical">{criticalCount}</span>
        </div>
        {actionRequired > 0 && (
          <div className="sidebar-alert">
            <span className="alert-dot" />
            {actionRequired} action{actionRequired !== 1 ? 's' : ''} required
          </div>
        )}
      </div>
    </aside>

    <nav className="bottom-nav">
      {NAV_ITEMS.map(item => (
        <button
          key={item.view}
          className={`bottom-nav-item ${view === item.view ? 'active' : ''}`}
          onClick={() => onNavigate(item.view)}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
    </>
  )
}
