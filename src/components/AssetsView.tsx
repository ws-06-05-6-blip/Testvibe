import { useState } from 'react'
import type { CI, Criticality, AssetStatus, Environment, PatchStatus, AssetCategory } from '../types'
import { mockCIs } from '../data/mockData'
import { CriticalityBadge, StatusBadge, EnvironmentBadge, PatchBadge } from './Badge'

interface AssetsViewProps {
  onSelect: (ci: CI) => void
}

const ALL = 'All'

export function AssetsView({ onSelect }: AssetsViewProps) {
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState<AssetCategory | typeof ALL>(ALL)
  const [filterCriticality, setFilterCriticality] = useState<Criticality | typeof ALL>(ALL)
  const [filterEnvironment, setFilterEnvironment] = useState<Environment | typeof ALL>(ALL)
  const [filterStatus, setFilterStatus] = useState<AssetStatus | typeof ALL>(ALL)
  const [filterPatch, setFilterPatch] = useState<PatchStatus | typeof ALL>(ALL)

  const filtered = mockCIs.filter(ci => {
    if (filterCategory !== ALL && ci.category !== filterCategory) return false
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
        ci.tags.some(t => t.toLowerCase().includes(q))
      )
    }
    return true
  })

  function resetFilters() {
    setSearch('')
    setFilterCategory(ALL)
    setFilterCriticality(ALL)
    setFilterEnvironment(ALL)
    setFilterStatus(ALL)
    setFilterPatch(ALL)
  }

  const hasFilters =
    search !== '' ||
    filterCategory !== ALL ||
    filterCriticality !== ALL ||
    filterEnvironment !== ALL ||
    filterStatus !== ALL ||
    filterPatch !== ALL

  return (
    <div className="assets-view">
      <div className="page-header">
        <h1 className="page-title">Assets</h1>
        <span className="page-subtitle">
          {filtered.length} of {mockCIs.length} configuration items
        </span>
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
            placeholder="Search by name, type, owner, IP, tag..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-selects">
          <select
            className="filter-select"
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value as AssetCategory | typeof ALL)}
          >
            <option value={ALL}>All Categories</option>
            <option value="Hardware">Hardware</option>
            <option value="Network">Network</option>
            <option value="Cloud">Cloud</option>
          </select>
          <select
            className="filter-select"
            value={filterCriticality}
            onChange={e => setFilterCriticality(e.target.value as Criticality | typeof ALL)}
          >
            <option value={ALL}>All Criticality</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
          <select
            className="filter-select"
            value={filterEnvironment}
            onChange={e => setFilterEnvironment(e.target.value as Environment | typeof ALL)}
          >
            <option value={ALL}>All Environments</option>
            <option value="Production">Production</option>
            <option value="Staging">Staging</option>
            <option value="Development">Development</option>
            <option value="DR">DR</option>
          </select>
          <select
            className="filter-select"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as AssetStatus | typeof ALL)}
          >
            <option value={ALL}>All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Maintenance">Maintenance</option>
            <option value="Decommissioned">Decommissioned</option>
          </select>
          <select
            className="filter-select"
            value={filterPatch}
            onChange={e => setFilterPatch(e.target.value as PatchStatus | typeof ALL)}
          >
            <option value={ALL}>All Patch Status</option>
            <option value="Up to date">Up to date</option>
            <option value="Patches available">Patches available</option>
            <option value="Critical patches">Critical patches</option>
            <option value="Unknown">Unknown</option>
          </select>
          {hasFilters && (
            <button className="clear-btn" onClick={resetFilters}>
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="table-card">
        <table className="data-table assets-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Env</th>
              <th>Criticality</th>
              <th>Status</th>
              <th>Patch Status</th>
              <th>Vulns</th>
              <th>Owner</th>
              <th>Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(ci => (
              <tr key={ci.id} onClick={() => onSelect(ci)}>
                <td>
                  <div className="ci-name">{ci.displayName}</div>
                  <div className="ci-hostname">{ci.name}</div>
                </td>
                <td className="text-secondary">{ci.type}</td>
                <td><EnvironmentBadge value={ci.environment} /></td>
                <td><CriticalityBadge value={ci.criticality} /></td>
                <td><StatusBadge value={ci.status} /></td>
                <td><PatchBadge value={ci.patchStatus} /></td>
                <td><VulnCells vulns={ci.vulnerabilities} /></td>
                <td className="text-secondary">{ci.owner}</td>
                <td className="text-secondary">{ci.lastSeen}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
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

function VulnCells({ vulns }: { vulns: { critical: number; high: number; medium: number; low: number } }) {
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
