import { useState, useMemo } from 'react'
import type { CI, VulnCount, Criticality, AssetStatus, Environment, PatchStatus, AssetCategory } from '../types'
import { useCIs } from '../data/store'
import { CriticalityBadge, StatusBadge, EnvironmentBadge, PatchBadge } from './Badge'

interface AssetsViewProps {
  onSelect: (ci: CI) => void
  onAdd: () => void
}

const ALL = 'All'

type SortDir = 'asc' | 'desc'
type SortCol = 'displayName' | 'type' | 'environment' | 'criticality' | 'status' | 'patchStatus' | 'risk' | 'owner' | 'lastSeen'

const ENV_ORDER: Record<Environment, number> = { Production: 4, DR: 3, Staging: 2, Development: 1 }
const CRIT_ORDER: Record<Criticality, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 }
const STATUS_ORDER: Record<AssetStatus, number> = { Active: 4, Maintenance: 3, Inactive: 2, Decommissioned: 1 }
const PATCH_ORDER: Record<PatchStatus, number> = { 'Critical patches': 4, 'Patches available': 3, Unknown: 2, 'Up to date': 1 }

function riskScore(v: VulnCount): number {
  return v.critical * 1000 + v.high * 100 + v.medium * 10 + v.low
}

function riskLabel(v: VulnCount): string {
  if (v.critical > 0) return 'critical'
  if (v.high > 0) return 'high'
  if (v.medium > 0) return 'medium'
  if (v.low > 0) return 'low'
  return 'none'
}

function sortCIs(list: CI[], col: SortCol, dir: SortDir): CI[] {
  return [...list].sort((a, b) => {
    let cmp = 0
    switch (col) {
      case 'displayName': cmp = a.displayName.localeCompare(b.displayName); break
      case 'type':        cmp = a.type.localeCompare(b.type); break
      case 'environment': cmp = ENV_ORDER[a.environment] - ENV_ORDER[b.environment]; break
      case 'criticality': cmp = CRIT_ORDER[a.criticality] - CRIT_ORDER[b.criticality]; break
      case 'status':      cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]; break
      case 'patchStatus': cmp = PATCH_ORDER[a.patchStatus] - PATCH_ORDER[b.patchStatus]; break
      case 'risk':        cmp = riskScore(a.vulnerabilities) - riskScore(b.vulnerabilities); break
      case 'owner':       cmp = a.owner.localeCompare(b.owner); break
      case 'lastSeen':    cmp = a.lastSeen.localeCompare(b.lastSeen); break
    }
    return dir === 'asc' ? cmp : -cmp
  })
}

export function AssetsView({ onSelect, onAdd }: AssetsViewProps) {
  const { cis, reset } = useCIs()
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState<AssetCategory | typeof ALL>(ALL)
  const [filterType, setFilterType] = useState<string | typeof ALL>(ALL)
  const [filterTeam, setFilterTeam] = useState<string | typeof ALL>(ALL)
  const [filterCriticality, setFilterCriticality] = useState<Criticality | typeof ALL>(ALL)
  const [filterEnvironment, setFilterEnvironment] = useState<Environment | typeof ALL>(ALL)
  const [filterStatus, setFilterStatus] = useState<AssetStatus | typeof ALL>(ALL)
  const [filterPatch, setFilterPatch] = useState<PatchStatus | typeof ALL>(ALL)
  const [sortCol, setSortCol] = useState<SortCol>('criticality')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [resetPending, setResetPending] = useState(false)

  const allTypes = useMemo(() => Array.from(new Set(cis.map(ci => ci.type))).sort(), [cis])
  const allTeams = useMemo(() => Array.from(new Set(cis.map(ci => ci.team))).sort(), [cis])

  function handleSort(col: SortCol) {
    if (col === sortCol) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }

  const filtered = cis.filter(ci => {
    if (filterCategory !== ALL && ci.category !== filterCategory) return false
    if (filterType !== ALL && ci.type !== filterType) return false
    if (filterTeam !== ALL && ci.team !== filterTeam) return false
    if (filterCriticality !== ALL && ci.criticality !== filterCriticality) return false
    if (filterEnvironment !== ALL && ci.environment !== filterEnvironment) return false
    if (filterStatus !== ALL && ci.status !== filterStatus) return false
    if (filterPatch !== ALL && ci.patchStatus !== filterPatch) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        ci.name.toLowerCase().includes(q) ||
        ci.displayName.toLowerCase().includes(q) ||
        ci.type.toLowerCase().includes(q) ||
        ci.owner.toLowerCase().includes(q) ||
        ci.team.toLowerCase().includes(q) ||
        (ci.ip?.toLowerCase().includes(q) ?? false) ||
        (ci.serialNumber?.toLowerCase().includes(q) ?? false) ||
        (ci.assetTag?.toLowerCase().includes(q) ?? false) ||
        ci.tags.some(t => t.toLowerCase().includes(q))
      )
    }
    return true
  })

  const sorted = sortCIs(filtered, sortCol, sortDir)

  function resetFilters() {
    setSearch('')
    setFilterCategory(ALL)
    setFilterType(ALL)
    setFilterTeam(ALL)
    setFilterCriticality(ALL)
    setFilterEnvironment(ALL)
    setFilterStatus(ALL)
    setFilterPatch(ALL)
  }

  const hasFilters =
    search !== '' ||
    filterCategory !== ALL ||
    filterType !== ALL ||
    filterTeam !== ALL ||
    filterCriticality !== ALL ||
    filterEnvironment !== ALL ||
    filterStatus !== ALL ||
    filterPatch !== ALL

  function handleReset() {
    if (!resetPending) {
      setResetPending(true)
      setTimeout(() => setResetPending(false), 3000)
    } else {
      reset()
      resetFilters()
      setResetPending(false)
    }
  }

  return (
    <div className="assets-view">
      <div className="page-header">
        <h1 className="page-title">Assets</h1>
        <span className="page-subtitle">
          {filtered.length} of {cis.length} configuration items
        </span>
        <div className="page-header-actions">
          <button
            className={`ghost-btn${resetPending ? ' ghost-btn-warn' : ''}`}
            onClick={handleReset}
            title="Reset all asset data back to defaults"
          >
            {resetPending ? 'Click again to confirm' : 'Reset data'}
          </button>
          <button className="primary-btn btn-sm" onClick={onAdd}>
            + Add Asset
          </button>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-wrap">
          <svg className="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
            <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            className="search-input"
            type="text"
            placeholder="Search by name, type, owner, IP, asset tag, serial..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-selects">
          <select className="filter-select" value={filterCategory} onChange={e => setFilterCategory(e.target.value as AssetCategory | typeof ALL)}>
            <option value={ALL}>All Categories</option>
            <option value="Hardware">Hardware</option>
            <option value="Network">Network</option>
            <option value="Cloud">Cloud</option>
          </select>
          <select className="filter-select" value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value={ALL}>All Types</option>
            {allTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className="filter-select" value={filterTeam} onChange={e => setFilterTeam(e.target.value)}>
            <option value={ALL}>All Teams</option>
            {allTeams.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className="filter-select" value={filterCriticality} onChange={e => setFilterCriticality(e.target.value as Criticality | typeof ALL)}>
            <option value={ALL}>All Criticality</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
          <select className="filter-select" value={filterEnvironment} onChange={e => setFilterEnvironment(e.target.value as Environment | typeof ALL)}>
            <option value={ALL}>All Environments</option>
            <option value="Production">Production</option>
            <option value="Staging">Staging</option>
            <option value="Development">Development</option>
            <option value="DR">DR</option>
          </select>
          <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value as AssetStatus | typeof ALL)}>
            <option value={ALL}>All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Maintenance">Maintenance</option>
            <option value="Decommissioned">Decommissioned</option>
          </select>
          <select className="filter-select" value={filterPatch} onChange={e => setFilterPatch(e.target.value as PatchStatus | typeof ALL)}>
            <option value={ALL}>All Patch Status</option>
            <option value="Up to date">Up to date</option>
            <option value="Patches available">Patches available</option>
            <option value="Critical patches">Critical patches</option>
            <option value="Unknown">Unknown</option>
          </select>
          {hasFilters && (
            <button className="clear-btn" onClick={resetFilters}>Clear</button>
          )}
        </div>
      </div>

      <div className="table-card">
        <table className="data-table assets-table">
          <thead>
            <tr>
              <SortTh col="displayName" label="Name"        active={sortCol} dir={sortDir} onSort={handleSort} />
              <SortTh col="type"        label="Type"        active={sortCol} dir={sortDir} onSort={handleSort} />
              <SortTh col="environment" label="Env"         active={sortCol} dir={sortDir} onSort={handleSort} />
              <SortTh col="criticality" label="Criticality" active={sortCol} dir={sortDir} onSort={handleSort} />
              <SortTh col="status"      label="Status"      active={sortCol} dir={sortDir} onSort={handleSort} />
              <SortTh col="patchStatus" label="Patch"       active={sortCol} dir={sortDir} onSort={handleSort} />
              <SortTh col="risk"        label="Risk"        active={sortCol} dir={sortDir} onSort={handleSort} />
              <SortTh col="owner"       label="Owner"       active={sortCol} dir={sortDir} onSort={handleSort} />
              <SortTh col="lastSeen"    label="Last Seen"   active={sortCol} dir={sortDir} onSort={handleSort} />
            </tr>
          </thead>
          <tbody>
            {sorted.map(ci => (
              <tr key={ci.id} onClick={() => onSelect(ci)}>
                <td>
                  <div className="ci-name">{ci.displayName}</div>
                  <div className="ci-hostname">{ci.name}{ci.assetTag && <span className="ci-asset-tag">{ci.assetTag}</span>}</div>
                </td>
                <td className="text-secondary">{ci.type}</td>
                <td><EnvironmentBadge value={ci.environment} /></td>
                <td><CriticalityBadge value={ci.criticality} /></td>
                <td><StatusBadge value={ci.status} /></td>
                <td><PatchBadge value={ci.patchStatus} /></td>
                <td><RiskCell vulns={ci.vulnerabilities} /></td>
                <td className="text-secondary">{ci.owner}</td>
                <td className="text-secondary">{ci.lastSeen}</td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={9} className="empty-row">
                  No assets match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SortTh({ col, label, active, dir, onSort }: {
  col: SortCol
  label: string
  active: SortCol
  dir: SortDir
  onSort: (col: SortCol) => void
}) {
  const isActive = col === active
  return (
    <th className={`th-sortable${isActive ? ' th-sorted' : ''}`} onClick={() => onSort(col)}>
      {label}
      <span className="sort-icon">
        {isActive
          ? (dir === 'asc'
              ? <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor"><path d="M4 1l3.5 6H.5L4 1z"/></svg>
              : <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor"><path d="M4 7L.5 1h7L4 7z"/></svg>)
          : <svg width="8" height="10" viewBox="0 0 8 10" fill="currentColor" opacity="0.35"><path d="M4 0l3 4H1L4 0z"/><path d="M4 10L1 6h6l-3 4z"/></svg>
        }
      </span>
    </th>
  )
}

function RiskCell({ vulns }: { vulns: VulnCount }) {
  const level = riskLabel(vulns)
  if (level === 'none') return <span className="text-muted">—</span>
  const cls = { critical: 'badge-critical', high: 'badge-high', medium: 'badge-medium', low: 'badge-low' }[level]
  return <span className={`badge ${cls}`}>{level}</span>
}
