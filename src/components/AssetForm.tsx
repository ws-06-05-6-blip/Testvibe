import { useState, useCallback } from 'react'
import type {
  CI, AssetCategory, AssetStatus, Environment,
  Criticality, Classification, PatchStatus,
} from '../types'
import { useCIs } from '../data/store'

interface Props {
  target: 'new' | CI
  onClose: () => void
  onSaved: (ci: CI) => void
}

interface FD {
  displayName: string; name: string; type: string
  category: AssetCategory; status: AssetStatus
  environment: Environment; criticality: Criticality
  classification: Classification; owner: string
  team: string; location: string; ip: string
  manufacturer: string; model: string; os: string
  softwareVersion: string; serialNumber: string
  assetTag: string; warrantyExpiry: string; eolDate: string
  patchStatus: PatchStatus; lastVulnScan: string
  compliance: string; tags: string; dependencies: string; notes: string
}

const KNOWN_TYPES = [
  'Backup System', 'Certificate Authority', 'Cloud Security', 'EDR',
  'Email Gateway', 'Firewall', 'IDS/IPS', 'Identity Provider', 'NAC',
  'Network Device', 'PAM', 'Server', 'SIEM', 'VPN Gateway',
  'Vulnerability Scanner', 'Workstation',
]

function blank(): FD {
  return {
    displayName: '', name: '', type: '', category: 'Hardware',
    status: 'Active', environment: 'Production', criticality: 'Medium',
    classification: 'Confidential', owner: '', team: '', location: '',
    ip: '', manufacturer: '', model: '', os: '', softwareVersion: '',
    serialNumber: '', assetTag: '', warrantyExpiry: '', eolDate: '',
    patchStatus: 'Unknown', lastVulnScan: '', compliance: '', tags: '',
    dependencies: '', notes: '',
  }
}

function fromCI(ci: CI): FD {
  return {
    displayName: ci.displayName, name: ci.name, type: ci.type,
    category: ci.category, status: ci.status, environment: ci.environment,
    criticality: ci.criticality, classification: ci.classification,
    owner: ci.owner, team: ci.team, location: ci.location,
    ip: ci.ip ?? '', manufacturer: ci.manufacturer ?? '',
    model: ci.model ?? '', os: ci.os ?? '',
    softwareVersion: ci.softwareVersion ?? '',
    serialNumber: ci.serialNumber ?? '', assetTag: ci.assetTag ?? '',
    warrantyExpiry: ci.warrantyExpiry ?? '', eolDate: ci.eolDate ?? '',
    patchStatus: ci.patchStatus, lastVulnScan: ci.lastVulnScan ?? '',
    compliance: ci.compliance.join(', '), tags: ci.tags.join(', '),
    dependencies: ci.dependencies.join(', '), notes: ci.notes ?? '',
  }
}

function toCI(fd: FD, existing?: CI): CI {
  const today = new Date().toISOString().slice(0, 10)
  const csv = (s: string) => s.split(',').map(x => x.trim()).filter(Boolean)
  return {
    id: existing?.id ?? `ci-${Math.random().toString(36).slice(2, 9)}`,
    displayName: fd.displayName.trim(),
    name: fd.name.trim(),
    type: fd.type.trim() as CI['type'],
    category: fd.category, status: fd.status,
    environment: fd.environment, criticality: fd.criticality,
    classification: fd.classification,
    owner: fd.owner.trim(), team: fd.team.trim(), location: fd.location.trim(),
    ip: fd.ip.trim() || undefined,
    manufacturer: fd.manufacturer.trim() || undefined,
    model: fd.model.trim() || undefined,
    os: fd.os.trim() || undefined,
    softwareVersion: fd.softwareVersion.trim() || undefined,
    serialNumber: fd.serialNumber.trim() || undefined,
    assetTag: fd.assetTag.trim() || undefined,
    warrantyExpiry: fd.warrantyExpiry || undefined,
    eolDate: fd.eolDate || undefined,
    patchStatus: fd.patchStatus,
    lastVulnScan: fd.lastVulnScan || undefined,
    vulnerabilities: existing?.vulnerabilities ?? { critical: 0, high: 0, medium: 0, low: 0 },
    compliance: csv(fd.compliance), tags: csv(fd.tags),
    dependencies: csv(fd.dependencies),
    lastSeen: existing?.lastSeen ?? today,
    lastUpdated: today,
    notes: fd.notes.trim() || undefined,
  }
}

function validate(fd: FD): string[] {
  const e: string[] = []
  if (!fd.displayName.trim()) e.push('Display name is required')
  if (!fd.name.trim()) e.push('Hostname / slug is required')
  if (!fd.type.trim()) e.push('Type is required')
  if (!fd.owner.trim()) e.push('Owner is required')
  if (!fd.team.trim()) e.push('Team is required')
  if (!fd.location.trim()) e.push('Location is required')
  return e
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function AssetForm({ target, onClose, onSaved }: Props) {
  const { upsert } = useCIs()
  const existing = target === 'new' ? undefined : target
  const [fd, setFD] = useState<FD>(() => existing ? fromCI(existing) : blank())
  const [errors, setErrors] = useState<string[]>([])

  const set = useCallback(<K extends keyof FD>(k: K, v: FD[K]) => {
    setFD(prev => ({ ...prev, [k]: v }))
  }, [])

  function onDisplayName(v: string) {
    setFD(prev => ({
      ...prev,
      displayName: v,
      name: prev.name ? prev.name : slugify(v),
    }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate(fd)
    if (errs.length) { setErrors(errs); return }
    const ci = toCI(fd, existing)
    upsert(ci)
    onSaved(ci)
  }

  const Sel = ({ label, k, opts }: { label: string; k: keyof FD; opts: string[] }) => (
    <div className="form-row">
      <label className="form-label">{label}</label>
      <select className="form-input" value={fd[k] as string}
        onChange={e => set(k, e.target.value as FD[typeof k])}>
        {opts.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )

  const Txt = ({ label, k, placeholder, required, full }: {
    label: string; k: keyof FD; placeholder?: string; required?: boolean; full?: boolean
  }) => (
    <div className={`form-row${full ? ' form-col-2' : ''}`}>
      <label className="form-label">
        {label}
        {required && <span className="form-required"> *</span>}
      </label>
      <input className="form-input" value={fd[k] as string} placeholder={placeholder}
        onChange={e => set(k, e.target.value as FD[typeof k])} />
    </div>
  )

  return (
    <>
      <div className="form-overlay" onClick={onClose} />
      <aside className="panel form-panel">
        <div className="panel-header">
          <div className="panel-title-row">
            <div className="panel-name">
              {existing ? `Edit — ${existing.displayName}` : 'Add Asset'}
            </div>
            <button className="close-btn" onClick={onClose} aria-label="Close">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        <form className="form-body" onSubmit={handleSubmit}>
          {errors.length > 0 && (
            <div className="form-error">
              {errors.map(e => <div key={e}>{e}</div>)}
            </div>
          )}

          <div>
            <div className="form-section-title">Identity</div>
            <div className="form-grid">
              <div className="form-row">
                <label className="form-label">Display Name<span className="form-required"> *</span></label>
                <input className="form-input" value={fd.displayName}
                  placeholder="Core Perimeter Firewall"
                  onChange={e => onDisplayName(e.target.value)} />
              </div>
              <div className="form-row">
                <label className="form-label">Hostname / Slug<span className="form-required"> *</span></label>
                <input className="form-input" value={fd.name}
                  placeholder="fw-core-01"
                  onChange={e => set('name', e.target.value)} />
              </div>
              <div className="form-row">
                <label className="form-label">Type<span className="form-required"> *</span></label>
                <input className="form-input" list="ci-types" value={fd.type}
                  placeholder="Firewall"
                  onChange={e => set('type', e.target.value)} />
                <datalist id="ci-types">
                  {KNOWN_TYPES.map(t => <option key={t} value={t} />)}
                </datalist>
              </div>
              <Sel label="Category" k="category" opts={['Hardware', 'Network', 'Cloud']} />
            </div>
          </div>

          <div>
            <div className="form-section-title">Status &amp; Classification</div>
            <div className="form-grid">
              <Sel label="Status" k="status" opts={['Active', 'Maintenance', 'Inactive', 'Decommissioned']} />
              <Sel label="Environment" k="environment" opts={['Production', 'Staging', 'Development', 'DR']} />
              <Sel label="Criticality" k="criticality" opts={['Critical', 'High', 'Medium', 'Low']} />
              <Sel label="Classification" k="classification" opts={['Restricted', 'Confidential', 'Internal', 'Public']} />
            </div>
          </div>

          <div>
            <div className="form-section-title">Ownership</div>
            <div className="form-grid">
              <Txt label="Owner" k="owner" placeholder="Alice Chen" required />
              <Txt label="Team" k="team" placeholder="Network Security" required />
              <Txt label="Location" k="location" placeholder="DC-Primary / Rack A1" required full />
            </div>
          </div>

          <div>
            <div className="form-section-title">Infrastructure <span className="form-optional">(optional)</span></div>
            <div className="form-grid">
              <Txt label="IP Address" k="ip" placeholder="10.10.1.50" />
              <Txt label="Manufacturer" k="manufacturer" placeholder="Dell" />
              <Txt label="Model" k="model" placeholder="PowerEdge R860" />
              <Txt label="OS / Firmware" k="os" placeholder="RHEL 9.4" />
              <Txt label="Software Version" k="softwareVersion" placeholder="Splunk Enterprise 9.3.1" full />
              <Txt label="Serial Number" k="serialNumber" placeholder="F7K4J2L" />
              <Txt label="Asset Tag" k="assetTag" placeholder="IT-00101" />
            </div>
          </div>

          <div>
            <div className="form-section-title">Lifecycle</div>
            <div className="form-grid">
              <Sel label="Patch Status" k="patchStatus"
                opts={['Up to date', 'Patches available', 'Critical patches', 'Unknown']} />
              <div className="form-row">
                <label className="form-label">Last Vuln Scan</label>
                <input className="form-input" type="date" value={fd.lastVulnScan}
                  onChange={e => set('lastVulnScan', e.target.value)} />
              </div>
              <div className="form-row">
                <label className="form-label">Warranty Expiry</label>
                <input className="form-input" type="date" value={fd.warrantyExpiry}
                  onChange={e => set('warrantyExpiry', e.target.value)} />
              </div>
              <div className="form-row">
                <label className="form-label">End of Life</label>
                <input className="form-input" type="date" value={fd.eolDate}
                  onChange={e => set('eolDate', e.target.value)} />
              </div>
            </div>
          </div>

          <div>
            <div className="form-section-title">Labels &amp; Notes</div>
            <div className="form-grid">
              <Txt label="Compliance Frameworks" k="compliance" placeholder="SOC2, ISO27001, PCI-DSS" full />
              <Txt label="Tags" k="tags" placeholder="critical-infrastructure, tier-1" full />
              <Txt label="Dependencies" k="dependencies" placeholder="ci-001, ci-006" full />
              <div className="form-row form-col-2">
                <label className="form-label">Notes</label>
                <textarea className="form-input form-textarea" rows={3} value={fd.notes}
                  placeholder="Optional notes..."
                  onChange={e => set('notes', e.target.value)} />
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="secondary-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-btn">
              {existing ? 'Save Changes' : 'Add Asset'}
            </button>
          </div>
        </form>
      </aside>
    </>
  )
}
