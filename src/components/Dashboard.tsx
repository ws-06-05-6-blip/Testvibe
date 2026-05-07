import type { CI } from '../types'
import { mockCIs } from '../data/mockData'
import { CriticalityBadge, PatchBadge } from './Badge'

interface DashboardProps {
  onViewAssets: () => void
  onSelect: (ci: CI) => void
}

export function Dashboard({ onViewAssets, onSelect }: DashboardProps) {
  const totalCIs = mockCIs.length
  const criticalAssets = mockCIs.filter(ci => ci.criticality === 'Critical').length
  const totalCriticalVulns = mockCIs.reduce((sum, ci) => sum + ci.vulnerabilities.critical, 0)
  const needsPatching = mockCIs.filter(ci => ci.patchStatus !== 'Up to date').length

  const criticalCIs = mockCIs
    .filter(ci => ci.criticality === 'Critical')
    .sort((a, b) => b.vulnerabilities.critical - a.vulnerabilities.critical)

  const patchRequired = mockCIs
    .filter(ci => ci.patchStatus === 'Critical patches' || ci.patchStatus === 'Patches available')
    .sort((a, b) => {
      if (a.patchStatus === 'Critical patches' && b.patchStatus !== 'Critical patches') return -1
      if (b.patchStatus === 'Critical patches' && a.patchStatus !== 'Critical patches') return 1
      return 0
    })

  return (
    <div className="dashboard">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <span className="page-subtitle">Security asset overview</span>
      </div>

      <div className="stats-grid">
        <div className="stat-card" onClick={onViewAssets} style={{ cursor: 'pointer' }}>
          <div className="stat-label">Total CIs</div>
          <div className="stat-value">{totalCIs}</div>
          <div className="stat-sub">Configuration items</div>
        </div>
        <div className="stat-card stat-card-critical">
          <div className="stat-label">Critical Assets</div>
          <div className="stat-value stat-value-critical">{criticalAssets}</div>
          <div className="stat-sub">Highest business impact</div>
        </div>
        <div className={`stat-card ${totalCriticalVulns > 0 ? 'stat-card-critical' : ''}`}>
          <div className="stat-label">Critical Vulnerabilities</div>
          <div className={`stat-value ${totalCriticalVulns > 0 ? 'stat-value-critical' : 'stat-value-ok'}`}>
            {totalCriticalVulns}
          </div>
          <div className="stat-sub">Unpatched critical CVEs</div>
        </div>
        <div className={`stat-card ${needsPatching > 0 ? 'stat-card-warn' : ''}`}>
          <div className="stat-label">Needs Patching</div>
          <div className={`stat-value ${needsPatching > 0 ? 'stat-value-warn' : 'stat-value-ok'}`}>
            {needsPatching}
          </div>
          <div className="stat-sub">Patches pending</div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="table-card">
          <div className="table-card-header">
            <h2>Critical Assets</h2>
            <button className="link-btn" onClick={onViewAssets}>View all</button>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Owner</th>
                <th>Criticality</th>
                <th>Vulns</th>
              </tr>
            </thead>
            <tbody>
              {criticalCIs.map(ci => (
                <tr key={ci.id} onClick={() => onSelect(ci)}>
                  <td>
                    <div className="ci-name">{ci.displayName}</div>
                    <div className="ci-hostname">{ci.name}</div>
                  </td>
                  <td className="text-secondary">{ci.type}</td>
                  <td className="text-secondary">{ci.owner}</td>
                  <td><CriticalityBadge value={ci.criticality} /></td>
                  <td><VulnSummary vulns={ci.vulnerabilities} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="table-card">
          <div className="table-card-header">
            <h2>Patch Status</h2>
            <span className="text-secondary" style={{ fontSize: '12px' }}>{patchRequired.length} assets require attention</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Team</th>
                <th>Patch Status</th>
              </tr>
            </thead>
            <tbody>
              {patchRequired.map(ci => (
                <tr key={ci.id} onClick={() => onSelect(ci)}>
                  <td>
                    <div className="ci-name">{ci.displayName}</div>
                    <div className="ci-hostname">{ci.name}</div>
                  </td>
                  <td className="text-secondary">{ci.team}</td>
                  <td><PatchBadge value={ci.patchStatus} /></td>
                </tr>
              ))}
              {patchRequired.length === 0 && (
                <tr>
                  <td colSpan={3} className="empty-row">All assets up to date</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function VulnSummary({ vulns }: { vulns: { critical: number; high: number; medium: number; low: number } }) {
  const hasAny = vulns.critical > 0 || vulns.high > 0 || vulns.medium > 0 || vulns.low > 0
  if (!hasAny) return <span className="text-muted">—</span>
  return (
    <span className="vuln-row">
      {vulns.critical > 0 && <span className="vc vc-c">C:{vulns.critical}</span>}
      {vulns.high > 0 && <span className="vc vc-h">H:{vulns.high}</span>}
      {vulns.medium > 0 && <span className="vc vc-m">M:{vulns.medium}</span>}
      {vulns.low > 0 && <span className="vc vc-l">L:{vulns.low}</span>}
    </span>
  )
}
