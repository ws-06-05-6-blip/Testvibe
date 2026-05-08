import { useState } from 'react'
import type { CI } from '../types'
import { useCIs } from '../data/store'
import { CriticalityBadge, StatusBadge, EnvironmentBadge, PatchBadge, Badge } from './Badge'

interface AssetDetailPanelProps {
  ci: CI
  onClose: () => void
  onSelect: (ci: CI) => void
  onEdit: (ci: CI) => void
  onDeleted: () => void
}

function warrantyCls(expiry: string): string {
  const d = new Date(expiry)
  const now = new Date()
  const soon = new Date(); soon.setMonth(soon.getMonth() + 6)
  if (d < now) return 'due-overdue'
  if (d < soon) return 'warranty-soon'
  return ''
}

export function AssetDetailPanel({ ci, onClose, onSelect, onEdit, onDeleted }: AssetDetailPanelProps) {
  const { cis, remove } = useCIs()
  const [showConfirm, setShowConfirm] = useState(false)

  const dependencies = ci.dependencies
    .map(id => cis.find(c => c.id === id))
    .filter((c): c is CI => c !== undefined)

  const dependents = cis.filter(c => c.dependencies.includes(ci.id))

  const totalVulns =
    ci.vulnerabilities.critical +
    ci.vulnerabilities.high +
    ci.vulnerabilities.medium +
    ci.vulnerabilities.low

  const isHardware = ci.category === 'Hardware' || ci.category === 'Network'

  function handleDelete() {
    remove(ci.id)
    onDeleted()
  }

  return (
    <>
      <div className="panel-overlay" onClick={onClose} />
      <aside className="panel">
        {/* Header */}
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
          <div className="panel-actions">
            <button className="secondary-btn btn-sm" onClick={() => onEdit(ci)}>Edit</button>
            <button className="del-btn-text" onClick={() => setShowConfirm(s => !s)}>Delete</button>
          </div>
        </div>

        {/* Delete confirmation */}
        {showConfirm && (
          <div className="delete-confirm">
            <div className="delete-confirm-title">Delete this asset?</div>
            <p className="delete-confirm-desc">
              <strong>{ci.displayName}</strong> will be permanently removed from the CMDB.
            </p>
            <div className="delete-confirm-actions">
              <button className="secondary-btn btn-sm" onClick={() => setShowConfirm(false)}>Cancel</button>
              <button className="del-btn" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        )}

        {/* Alert note */}
        {ci.notes && (
          <div className="panel-notes">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
              <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            {ci.notes}
          </div>
        )}

        {/* Identity & Location */}
        <div className="panel-section">
          <h3 className="panel-section-title">Identity &amp; Location</h3>
          <dl className="detail-grid">
            <dt>Asset ID</dt>    <dd className="mono">{ci.id}</dd>
            {ci.assetTag      && <><dt>Asset Tag</dt>    <dd className="mono">{ci.assetTag}</dd></>}
            {ci.serialNumber  && <><dt>Serial No.</dt>   <dd className="mono">{ci.serialNumber}</dd></>}
            <dt>Category</dt>   <dd>{ci.category}</dd>
            <dt>Classification</dt><dd>{ci.classification}</dd>
            <dt>Location</dt>   <dd>{ci.location}</dd>
            {ci.ip && <><dt>IP Address</dt><dd className="mono">{ci.ip}</dd></>}
          </dl>
        </div>

        {/* Infrastructure (hardware/network only) */}
        {isHardware && (ci.manufacturer || ci.model || ci.os || ci.softwareVersion) && (
          <div className="panel-section">
            <h3 className="panel-section-title">Infrastructure</h3>
            <dl className="detail-grid">
              {ci.manufacturer    && <><dt>Manufacturer</dt>    <dd>{ci.manufacturer}</dd></>}
              {ci.model           && <><dt>Model</dt>           <dd>{ci.model}</dd></>}
              {ci.os              && <><dt>OS / Firmware</dt>   <dd>{ci.os}</dd></>}
              {ci.softwareVersion && <><dt>Software</dt>        <dd>{ci.softwareVersion}</dd></>}
            </dl>
          </div>
        )}

        {/* Cloud / SaaS software */}
        {!isHardware && ci.softwareVersion && (
          <div className="panel-section">
            <h3 className="panel-section-title">Service</h3>
            <dl className="detail-grid">
              <dt>Version / Tier</dt><dd>{ci.softwareVersion}</dd>
            </dl>
          </div>
        )}

        {/* Lifecycle & Ownership */}
        <div className="panel-section">
          <h3 className="panel-section-title">Lifecycle &amp; Ownership</h3>
          <dl className="detail-grid">
            <dt>Owner</dt>        <dd>{ci.owner}</dd>
            <dt>Team</dt>         <dd>{ci.team}</dd>
            <dt>Patch Status</dt> <dd><PatchBadge value={ci.patchStatus} /></dd>
            <dt>Last Seen</dt>    <dd>{ci.lastSeen}</dd>
            {ci.lastVulnScan && (
              <><dt>Last Vuln Scan</dt><dd>{ci.lastVulnScan}</dd></>
            )}
            <dt>Last Updated</dt> <dd>{ci.lastUpdated}</dd>
            {ci.warrantyExpiry && (
              <><dt>Warranty Expiry</dt>
                <dd className={warrantyCls(ci.warrantyExpiry)}>{ci.warrantyExpiry}</dd></>
            )}
            {ci.eolDate && (
              <><dt>End of Life</dt>
                <dd className={warrantyCls(ci.eolDate)}>{ci.eolDate}</dd></>
            )}
          </dl>
        </div>

        {/* Vulnerabilities */}
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

        {/* Compliance */}
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

        {/* Tags */}
        {ci.tags.length > 0 && (
          <div className="panel-section">
            <h3 className="panel-section-title">Tags</h3>
            <div className="tag-list">
              {ci.tags.map(t => <span key={t} className="tag">{t}</span>)}
            </div>
          </div>
        )}

        {/* Dependencies */}
        {dependencies.length > 0 && (
          <div className="panel-section">
            <h3 className="panel-section-title">
              Dependencies
              <span className="section-count">{dependencies.length}</span>
            </h3>
            <div className="rel-list">
              {dependencies.map(dep => (
                <button key={dep.id} className="rel-item rel-item-btn" onClick={() => onSelect(dep)}>
                  <div className="rel-item-header">
                    <span className="rel-name">{dep.displayName}</span>
                    <CriticalityBadge value={dep.criticality} />
                  </div>
                  <div className="rel-meta">
                    {dep.type} · {dep.name}{dep.ip && ` · ${dep.ip}`}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Dependents */}
        {dependents.length > 0 && (
          <div className="panel-section">
            <h3 className="panel-section-title">
              Dependents
              <span className="section-count">{dependents.length}</span>
            </h3>
            <div className="rel-list">
              {dependents.map(dep => (
                <button key={dep.id} className="rel-item rel-item-btn" onClick={() => onSelect(dep)}>
                  <div className="rel-item-header">
                    <span className="rel-name">{dep.displayName}</span>
                    <CriticalityBadge value={dep.criticality} />
                  </div>
                  <div className="rel-meta">
                    {dep.type} · {dep.name}{dep.ip && ` · ${dep.ip}`}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>
    </>
  )
}
