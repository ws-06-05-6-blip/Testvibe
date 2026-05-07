import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { Scan, ScanHost, ScanProfile, ScanResult, ScanVuln, VulnSeverity } from '../types'
import { createScan, deleteScan, getHealth, getProfiles, getScan, listScans } from '../api/scanner'

// ── Top-level view ────────────────────────────────────────────────────────────

type SubView = 'list' | 'detail' | 'new'

export function ScannerView() {
  const [subView, setSubView] = useState<SubView>('list')
  const [scans, setScans] = useState<Scan[]>([])
  const [selected, setSelected] = useState<ScanResult | null>(null)
  const [backendOk, setBackendOk] = useState<boolean | null>(null)
  const [nmapOk, setNmapOk] = useState<boolean | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchScans = useCallback(async () => {
    try {
      const data = await listScans()
      setScans(data)
    } catch {
      setBackendOk(false)
    }
  }, [])

  const refreshSelected = useCallback(async (id: string) => {
    try {
      const data = await getScan(id)
      setSelected(data)
    } catch { /* ignore */ }
  }, [])

  // Initial health check + scan fetch
  useEffect(() => {
    getHealth()
      .then(h => {
        setBackendOk(true)
        setNmapOk(h.checks['nmap'] === true)
      })
      .catch(() => setBackendOk(false))
    fetchScans()
  }, [fetchScans])

  // Poll running scans
  useEffect(() => {
    const hasActive = scans.some(s => s.status === 'pending' || s.status === 'running')
    if (hasActive) {
      pollRef.current = setInterval(() => {
        fetchScans()
        if (selected && (selected.status === 'pending' || selected.status === 'running')) {
          refreshSelected(selected.id)
        }
      }, 2000)
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [scans, selected, fetchScans, refreshSelected])

  async function handleCreate(data: {
    name: string; target: string; profile: string; nvd_api_key?: string
  }) {
    const { id } = await createScan(data)
    await fetchScans()
    const result = await getScan(id)
    setSelected(result)
    setSubView('detail')
  }

  async function handleSelect(scan: Scan) {
    const result = await getScan(scan.id)
    setSelected(result)
    setSubView('detail')
  }

  async function handleDelete(id: string) {
    await deleteScan(id)
    await fetchScans()
    if (selected?.id === id) {
      setSelected(null)
      setSubView('list')
    }
  }

  if (backendOk === false) {
    return (
      <div className="scanner-offline">
        <div className="offline-card">
          <div className="offline-icon">⚠</div>
          <h2>Scanner backend offline</h2>
          <p>Start the backend to enable scanning:</p>
          <pre className="offline-cmd">cd Testvibe/backend && bash start.sh</pre>
        </div>
      </div>
    )
  }

  if (subView === 'new') {
    return (
      <NewScanForm
        onCancel={() => setSubView('list')}
        onCreate={handleCreate}
        nmapOk={nmapOk}
      />
    )
  }

  if (subView === 'detail' && selected) {
    return (
      <ScanDetail
        scan={selected}
        onBack={() => setSubView('list')}
        onDelete={() => handleDelete(selected.id)}
      />
    )
  }

  return (
    <ScanList
      scans={scans}
      nmapOk={nmapOk}
      onSelect={handleSelect}
      onNew={() => setSubView('new')}
      onDelete={handleDelete}
    />
  )
}

// ── Scan list ─────────────────────────────────────────────────────────────────

function ScanList({
  scans,
  nmapOk,
  onSelect,
  onNew,
  onDelete,
}: {
  scans: Scan[]
  nmapOk: boolean | null
  onSelect: (s: Scan) => void
  onNew: () => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="scanner-list-view">
      <div className="page-header">
        <div>
          <h1 className="page-title">Vulnerability Scanner</h1>
          <span className="page-subtitle">{scans.length} scan{scans.length !== 1 ? 's' : ''}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {nmapOk === false && (
            <span className="nmap-warn">nmap not found — install to scan</span>
          )}
          {nmapOk === true && (
            <span className="nmap-ok">nmap ready</span>
          )}
          <button className="primary-btn" onClick={onNew}>+ New Scan</button>
        </div>
      </div>

      {scans.length === 0 ? (
        <div className="scanner-empty">
          <div className="scanner-empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5" />
              <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M11 8v6M8 11h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <h3>No scans yet</h3>
          <p>Run your first vulnerability scan against a host or network range.</p>
          <button className="primary-btn" onClick={onNew}>Run First Scan</button>
        </div>
      ) : (
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name / Target</th>
                <th>Profile</th>
                <th>Status</th>
                <th>Hosts</th>
                <th>Vulnerabilities</th>
                <th>Started</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {scans.map(scan => (
                <tr key={scan.id} onClick={() => onSelect(scan)}>
                  <td>
                    <div className="ci-name">{scan.name}</div>
                    <div className="ci-hostname">{scan.target}</div>
                  </td>
                  <td className="text-secondary">{scan.profile}</td>
                  <td><ScanStatusBadge status={scan.status} progress={scan.progress} /></td>
                  <td className="text-secondary">
                    {scan.status === 'completed' ? scan.hosts_total : `${scan.hosts_scanned}/${scan.hosts_total}`}
                  </td>
                  <td>
                    <ScanVulnSummary scan={scan} />
                  </td>
                  <td className="text-secondary text-sm">
                    {scan.started_at ? scan.started_at.slice(0, 10) : '—'}
                  </td>
                  <td>
                    <button
                      className="del-btn"
                      title="Delete scan"
                      onClick={e => { e.stopPropagation(); onDelete(scan.id) }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── New scan form ─────────────────────────────────────────────────────────────

function NewScanForm({
  onCancel,
  onCreate,
  nmapOk,
}: {
  onCancel: () => void
  onCreate: (d: { name: string; target: string; profile: string; nvd_api_key?: string }) => Promise<void>
  nmapOk: boolean | null
}) {
  const [profiles, setProfiles] = useState<Record<string, ScanProfile>>({})
  const [target, setTarget] = useState('')
  const [name, setName] = useState('')
  const [profile, setProfile] = useState('standard')
  const [nvdKey, setNvdKey] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getProfiles().then(setProfiles).catch(() => {})
  }, [])

  // Auto-fill name from target
  useEffect(() => {
    if (target && !name) setName(`Scan ${target}`)
  }, [target, name])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await onCreate({
        name: name.trim() || `Scan ${target}`,
        target: target.trim(),
        profile,
        nvd_api_key: nvdKey.trim() || undefined,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setSubmitting(false)
    }
  }

  return (
    <div className="new-scan-view">
      <div className="page-header">
        <button className="back-btn" onClick={onCancel}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>
        <h1 className="page-title">New Scan</h1>
      </div>

      {nmapOk === false && (
        <div className="scan-warn-banner">
          nmap is not installed. Install it first: <code>sudo dnf install -y nmap</code>
        </div>
      )}

      <div className="new-scan-card">
        <form onSubmit={handleSubmit} className="new-scan-form">
          {error && <div className="form-error">{error}</div>}

          <div className="form-row">
            <label className="form-label">Target *</label>
            <input
              className="form-input"
              type="text"
              placeholder="192.168.1.1 or 192.168.1.0/24 or hostname"
              value={target}
              onChange={e => setTarget(e.target.value)}
              required
            />
            <span className="form-hint">IP address, CIDR range, or hostname. Only scan systems you own or have written authorization to test.</span>
          </div>

          <div className="form-row">
            <label className="form-label">Scan Name *</label>
            <input
              className="form-input"
              type="text"
              placeholder="My scan"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-row">
            <label className="form-label">Profile</label>
            <div className="profile-grid">
              {Object.entries(profiles).map(([key, p]) => (
                <button
                  key={key}
                  type="button"
                  className={`profile-card ${profile === key ? 'selected' : ''}`}
                  onClick={() => setProfile(key)}
                >
                  <div className="profile-name">{p.name}</div>
                  <div className="profile-desc">{p.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="form-row">
            <label className="form-label">NVD API Key <span className="optional">(optional)</span></label>
            <input
              className="form-input"
              type="password"
              placeholder="Increases CVE lookup rate limit (free at nvd.nist.gov/developers)"
              value={nvdKey}
              onChange={e => setNvdKey(e.target.value)}
            />
            <span className="form-hint">Without a key: 5 req/30s. With a key: 50 req/30s. Free to register.</span>
          </div>

          <div className="form-actions">
            <button type="button" className="secondary-btn" onClick={onCancel}>Cancel</button>
            <button type="submit" className="primary-btn" disabled={submitting || !target.trim()}>
              {submitting ? 'Starting…' : 'Start Scan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Scan detail ───────────────────────────────────────────────────────────────

function ScanDetail({
  scan,
  onBack,
  onDelete,
}: {
  scan: ScanResult
  onBack: () => void
  onDelete: () => void
}) {
  const [expandedHost, setExpandedHost] = useState<string | null>(null)

  const totalVulns = scan.vuln_critical + scan.vuln_high + scan.vuln_medium + scan.vuln_low
  const elapsed = scan.started_at && scan.completed_at
    ? Math.round(
        (new Date(scan.completed_at).getTime() - new Date(scan.started_at).getTime()) / 1000
      )
    : null

  return (
    <div className="scan-detail-view">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="back-btn" onClick={onBack}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Scans
          </button>
          <div>
            <h1 className="page-title">{scan.name}</h1>
            <span className="page-subtitle">{scan.target} · {scan.profile}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ScanStatusBadge status={scan.status} progress={scan.progress} />
          <button className="del-btn del-btn-text" onClick={onDelete}>Delete</button>
        </div>
      </div>

      {(scan.status === 'pending' || scan.status === 'running') && (
        <div className="scan-progress-bar-wrap">
          <div className="scan-progress-label">
            {scan.status === 'pending' ? 'Queued…' : `Scanning… ${scan.hosts_scanned}/${scan.hosts_total} hosts`}
          </div>
          <div className="scan-progress-track">
            <div className="scan-progress-fill" style={{ width: `${scan.progress}%` }} />
          </div>
          <div className="scan-progress-pct">{scan.progress}%</div>
        </div>
      )}

      {scan.status === 'failed' && scan.error && (
        <div className="scan-error-banner">{scan.error}</div>
      )}

      <div className="stats-grid scan-stats">
        <div className="stat-card">
          <div className="stat-label">Hosts Found</div>
          <div className="stat-value">{scan.hosts_total}</div>
          <div className="stat-sub">{elapsed !== null ? `Completed in ${elapsed}s` : scan.started_at ? `Started ${scan.started_at.slice(0, 10)}` : 'Not started'}</div>
        </div>
        <div className={`stat-card ${scan.vuln_critical > 0 ? 'stat-card-critical' : ''}`}>
          <div className="stat-label">Critical</div>
          <div className={`stat-value ${scan.vuln_critical > 0 ? 'stat-value-critical' : 'stat-value-ok'}`}>{scan.vuln_critical}</div>
          <div className="stat-sub">CVSSv3 ≥ 9.0</div>
        </div>
        <div className={`stat-card ${scan.vuln_high > 0 ? 'stat-card-warn' : ''}`}>
          <div className="stat-label">High</div>
          <div className={`stat-value ${scan.vuln_high > 0 ? 'stat-value-warn' : 'stat-value-ok'}`}>{scan.vuln_high}</div>
          <div className="stat-sub">CVSSv3 7.0–8.9</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Medium / Low</div>
          <div className="stat-value">{scan.vuln_medium + scan.vuln_low}</div>
          <div className="stat-sub">{totalVulns} total CVEs</div>
        </div>
      </div>

      {scan.hosts.length > 0 ? (
        <div className="table-card">
          <div className="table-card-header">
            <h2>Hosts ({scan.hosts.length})</h2>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>IP / Hostname</th>
                <th>OS</th>
                <th>Open Ports</th>
                <th>Vulnerabilities</th>
                <th>Risk Score</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {scan.hosts.map(host => (
                <Fragment key={host.id}>
                  <tr
                    onClick={() => setExpandedHost(expandedHost === host.id ? null : host.id)}
                    className={expandedHost === host.id ? 'row-expanded' : ''}
                  >
                    <td>
                      <div className="ci-name">{host.ip}</div>
                      {host.hostname && <div className="ci-hostname">{host.hostname}</div>}
                    </td>
                    <td className="text-secondary">{host.os ?? '—'}</td>
                    <td className="text-secondary">{host.ports.length}</td>
                    <td>
                      <HostVulnSummary vulns={host.vulnerabilities} />
                    </td>
                    <td>
                      <RiskScore score={host.risk_score} />
                    </td>
                    <td>
                      <svg
                        width="14" height="14" viewBox="0 0 24 24" fill="none"
                        style={{ color: 'var(--text-muted)', transform: expandedHost === host.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
                      >
                        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </td>
                  </tr>
                  {expandedHost === host.id && (
                    <tr className="host-detail-row">
                      <td colSpan={6} style={{ padding: 0 }}>
                        <HostDetailExpanded host={host} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ) : scan.status === 'completed' ? (
        <div className="table-card">
          <div className="empty-row" style={{ padding: 48 }}>No hosts found. The target may be offline or blocking scans.</div>
        </div>
      ) : null}
    </div>
  )
}

// ── Host detail expanded row ──────────────────────────────────────────────────

function HostDetailExpanded({ host }: { host: ScanHost }) {
  return (
    <div className="host-detail">
      <div className="host-detail-sections">
        <div className="host-detail-section">
          <h4>Open Ports ({host.ports.length})</h4>
          {host.ports.length > 0 ? (
            <table className="data-table inner-table">
              <thead>
                <tr>
                  <th>Port</th>
                  <th>Proto</th>
                  <th>Service</th>
                  <th>Product / Version</th>
                </tr>
              </thead>
              <tbody>
                {host.ports.map(p => (
                  <tr key={p.id}>
                    <td className="mono">{p.port}</td>
                    <td className="text-secondary">{p.protocol}</td>
                    <td className="text-secondary">{p.service ?? '—'}</td>
                    <td className="text-secondary">
                      {[p.product, p.version].filter(Boolean).join(' ') || '—'}
                      {p.extra_info && <span className="text-muted"> ({p.extra_info})</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-muted" style={{ fontSize: 12, padding: '8px 0' }}>No open ports detected</div>
          )}
        </div>

        <div className="host-detail-section">
          <h4>CVEs ({host.vulnerabilities.length})</h4>
          {host.vulnerabilities.length > 0 ? (
            <div className="cve-list">
              {host.vulnerabilities.map(v => (
                <CveCard key={v.id} vuln={v} />
              ))}
            </div>
          ) : (
            <div className="text-muted" style={{ fontSize: 12, padding: '8px 0' }}>No CVEs found for detected services.</div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── CVE card ──────────────────────────────────────────────────────────────────

function CveCard({ vuln }: { vuln: ScanVuln }) {
  const severityClass = vuln.severity.toLowerCase()
  return (
    <div className={`cve-card cve-${severityClass}`}>
      <div className="cve-header">
        <a
          href={vuln.url ?? '#'}
          target="_blank"
          rel="noreferrer"
          className="cve-id"
          onClick={e => e.stopPropagation()}
        >
          {vuln.cve_id}
        </a>
        <span className={`badge badge-${severityClass}`}>{vuln.severity}</span>
        <span className="cve-score">{vuln.cvss_score.toFixed(1)}</span>
        {vuln.published && <span className="text-muted cve-date">{vuln.published}</span>}
      </div>
      {vuln.description && (
        <div className="cve-desc">{vuln.description}</div>
      )}
    </div>
  )
}

// ── Small reusable pieces ─────────────────────────────────────────────────────

function ScanStatusBadge({ status, progress }: { status: string; progress: number }) {
  if (status === 'running') {
    return <span className="badge badge-scan-running">Running {progress}%</span>
  }
  if (status === 'pending') return <span className="badge badge-scan-pending">Queued</span>
  if (status === 'completed') return <span className="badge badge-active">Completed</span>
  if (status === 'failed') return <span className="badge badge-critical">Failed</span>
  return <span className="badge badge-neutral">{status}</span>
}

function ScanVulnSummary({ scan }: { scan: Scan }) {
  if (scan.status !== 'completed') return <span className="text-muted">—</span>
  const total = scan.vuln_critical + scan.vuln_high + scan.vuln_medium + scan.vuln_low
  if (total === 0) return <span className="badge badge-low">Clean</span>
  return (
    <span className="vuln-row">
      {scan.vuln_critical > 0 && <span className="vc vc-c">C:{scan.vuln_critical}</span>}
      {scan.vuln_high > 0 && <span className="vc vc-h">H:{scan.vuln_high}</span>}
      {scan.vuln_medium > 0 && <span className="vc vc-m">M:{scan.vuln_medium}</span>}
      {scan.vuln_low > 0 && <span className="vc vc-l">L:{scan.vuln_low}</span>}
    </span>
  )
}

function HostVulnSummary({ vulns }: { vulns: ScanVuln[] }) {
  if (vulns.length === 0) return <span className="badge badge-low">Clean</span>
  const counts: Record<VulnSeverity, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }
  for (const v of vulns) counts[v.severity]++
  return (
    <span className="vuln-row">
      {counts.CRITICAL > 0 && <span className="vc vc-c">C:{counts.CRITICAL}</span>}
      {counts.HIGH > 0 && <span className="vc vc-h">H:{counts.HIGH}</span>}
      {counts.MEDIUM > 0 && <span className="vc vc-m">M:{counts.MEDIUM}</span>}
      {counts.LOW > 0 && <span className="vc vc-l">L:{counts.LOW}</span>}
    </span>
  )
}

function RiskScore({ score }: { score: number }) {
  if (score === 0) return <span className="risk-score risk-none">0.0</span>
  if (score >= 9.0) return <span className="risk-score risk-critical">{score.toFixed(1)}</span>
  if (score >= 7.0) return <span className="risk-score risk-high">{score.toFixed(1)}</span>
  if (score >= 4.0) return <span className="risk-score risk-medium">{score.toFixed(1)}</span>
  return <span className="risk-score risk-low">{score.toFixed(1)}</span>
}

