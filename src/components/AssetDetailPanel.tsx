import type { CI } from '../types'
import { mockCIs } from '../data/mockData'
import { CriticalityBadge, StatusBadge, EnvironmentBadge, PatchBadge, Badge } from './Badge'

interface AssetDetailPanelProps {
  ci: CI
  onClose: () => void
}

export function AssetDetailPanel({ ci, onClose }: AssetDetailPanelProps) {
  const dependencies = ci.dependencies
    .map(id => mockCIs.find(c => c.id === id))
    .filter((c): c is CI => c !== undefined)

  const dependents = mockCIs.filter(c => c.dependencies.includes(ci.id))

  const totalVulns =
    ci.vulnerabilities.critical +
    ci.vulnerabilities.high +
    ci.vulnerabilities.medium +
    ci.vulnerabilities.low

  return (
    <>
      <div className="panel-overlay" onClick={onClose} />
      <aside className="panel">
        <div className="panel-header">
          <div className="panel-title-row">
            <div>
              <div className="panel-name">{ci.displayName}</div>
              <div className="panel-hostname">{ci.name}</div>
            </div>
            <button className="close-btn" onClick={onClose} aria-label="Close">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className="panel-badges">
            <CriticalityBadge value={ci.criticality} />
            <StatusBadge value={ci.status} />
            <EnvironmentBadge value={ci.environment} />
            <Badge variant="neutral">{ci.type}</Badge>
          </div>
        </div>

        {ci.notes && (
          <div className="panel-notes">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
              <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            {ci.notes}
          </div>
        )}

        <div className="panel-section">
          <h3 className="panel-section-title">Details</h3>
          <dl className="detail-grid">
            <dt>Asset ID</dt><dd className="mono">{ci.id}</dd>
            <dt>Category</dt><dd>{ci.category}</dd>
            <dt>Classification</dt><dd>{ci.classification}</dd>
            <dt>Location</dt><dd>{ci.location}</dd>
            {ci.ip && <><dt>IP Address</dt><dd className="mono">{ci.ip}</dd></>}
            {ci.manufacturer && <><dt>Manufacturer</dt><dd>{ci.manufacturer}</dd></>}
            {ci.model && <><dt>Model</dt><dd>{ci.model}</dd></>}
            {ci.os && <><dt>OS / Version</dt><dd>{ci.os}</dd></>}
            <dt>Owner</dt><dd>{ci.owner}</dd>
            <dt>Team</dt><dd>{ci.team}</dd>
            <dt>Last Seen</dt><dd>{ci.lastSeen}</dd>
            <dt>Last Updated</dt><dd>{ci.lastUpdated}</dd>
            <dt>Patch Status</dt><dd><PatchBadge value={ci.patchStatus} /></dd>
          </dl>
        </div>

        <div className="panel-section">
          <h3 className="panel-section-title">
            Vulnerabilities
            <span className="section-count">{totalVulns} total</span>
          </h3>
          <div className="vuln-grid">
            <div className={`vuln-block ${ci.vulnerabilities.critical > 0 ? 'vuln-block-c' : ''}`}>
              <div className="vuln-count">{ci.vulnerabilities.critical}</div>
              <div className="vuln-label">Critical</div>
            </div>
            <div className={`vuln-block ${ci.vulnerabilities.high > 0 ? 'vuln-block-h' : ''}`}>
              <div className="vuln-count">{ci.vulnerabilities.high}</div>
              <div className="vuln-label">High</div>
            </div>
            <div className={`vuln-block ${ci.vulnerabilities.medium > 0 ? 'vuln-block-m' : ''}`}>
              <div className="vuln-count">{ci.vulnerabilities.medium}</div>
              <div className="vuln-label">Medium</div>
            </div>
            <div className={`vuln-block ${ci.vulnerabilities.low > 0 ? 'vuln-block-l' : ''}`}>
              <div className="vuln-count">{ci.vulnerabilities.low}</div>
              <div className="vuln-label">Low</div>
            </div>
          </div>
        </div>

        {ci.compliance.length > 0 && (
          <div className="panel-section">
            <h3 className="panel-section-title">Compliance Frameworks</h3>
            <div className="tag-list">
              {ci.compliance.map(f => (
                <span key={f} className="tag tag-compliance">{f}</span>
              ))}
            </div>
          </div>
        )}

        {ci.tags.length > 0 && (
          <div className="panel-section">
            <h3 className="panel-section-title">Tags</h3>
            <div className="tag-list">
              {ci.tags.map(t => (
                <span key={t} className="tag">{t}</span>
              ))}
            </div>
          </div>
        )}

        {dependencies.length > 0 && (
          <div className="panel-section">
            <h3 className="panel-section-title">
              Dependencies
              <span className="section-count">{dependencies.length}</span>
            </h3>
            <div className="rel-list">
              {dependencies.map(dep => (
                <div key={dep.id} className="rel-item">
                  <div className="rel-name">{dep.displayName}</div>
                  <div className="rel-meta">{dep.type} · {dep.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {dependents.length > 0 && (
          <div className="panel-section">
            <h3 className="panel-section-title">
              Dependents
              <span className="section-count">{dependents.length}</span>
            </h3>
            <div className="rel-list">
              {dependents.map(dep => (
                <div key={dep.id} className="rel-item">
                  <div className="rel-name">{dep.displayName}</div>
                  <div className="rel-meta">{dep.type} · {dep.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>
    </>
  )
}
