import { useState, useEffect } from 'react'
import type { CheckItem, CheckCategory, CheckPriority, CheckStatus } from '../types'
import { initialChecks } from '../data/checklistData'

const STORAGE_KEY = 'secops-checklist-state'

const WEIGHTS: Record<CheckPriority, number> = { critical: 4, high: 3, medium: 2, low: 1 }

const STATUS_LABELS: Record<CheckStatus, string> = {
  passed: 'Passed',
  failed: 'Failed',
  warning: 'Warning',
  'in-progress': 'In Progress',
  na: 'N/A',
}

const CATEGORIES: CheckCategory[] = [
  'Vulnerability Management',
  'Identity & Access',
  'Network Security',
  'Endpoint Security',
  'Data Protection',
  'Incident Response',
  'Compliance',
  'Asset Management',
]

function calcScore(items: CheckItem[]): number {
  let earned = 0
  let max = 0
  for (const item of items) {
    if (item.status === 'na') continue
    const w = WEIGHTS[item.priority]
    max += w
    if (item.status === 'passed') earned += w
    else if (item.status === 'warning') earned += w * 0.5
    else if (item.status === 'in-progress') earned += w * 0.25
  }
  if (max === 0) return 0
  return Math.round((earned / max) * 100)
}

function scoreColor(score: number): string {
  if (score >= 80) return 'score-green'
  if (score >= 60) return 'score-yellow'
  if (score >= 40) return 'score-orange'
  return 'score-red'
}

function statusBadgeClass(status: CheckStatus): string {
  return {
    passed: 'ck-badge-passed',
    failed: 'ck-badge-failed',
    warning: 'ck-badge-warning',
    'in-progress': 'ck-badge-inprogress',
    na: 'ck-badge-na',
  }[status]
}

function priorityBadgeClass(priority: CheckPriority): string {
  return {
    critical: 'badge-critical',
    high: 'badge-high',
    medium: 'badge-medium',
    low: 'badge-low',
  }[priority]
}

interface CategoryStats {
  total: number
  passed: number
  failed: number
  warning: number
  inProgress: number
  na: number
}

function categoryStats(items: CheckItem[], category: CheckCategory): CategoryStats {
  const cats = items.filter(i => i.category === category)
  return {
    total: cats.length,
    passed: cats.filter(i => i.status === 'passed').length,
    failed: cats.filter(i => i.status === 'failed').length,
    warning: cats.filter(i => i.status === 'warning').length,
    inProgress: cats.filter(i => i.status === 'in-progress').length,
    na: cats.filter(i => i.status === 'na').length,
  }
}

export function ChecklistView() {
  const [checks, setChecks] = useState<CheckItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed: CheckItem[] = JSON.parse(saved)
        const map = new Map(parsed.map(c => [c.id, c]))
        return initialChecks.map(c => map.get(c.id) ?? c)
      }
    } catch {
      // ignore
    }
    return initialChecks
  })

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [draftStatus, setDraftStatus] = useState<CheckStatus>('passed')
  const [draftNotes, setDraftNotes] = useState('')

  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterPriority, setFilterPriority] = useState<string>('')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(checks))
  }, [checks])

  function handleExpand(item: CheckItem) {
    if (expandedId === item.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(item.id)
    setDraftStatus(item.status)
    setDraftNotes(item.notes ?? '')
  }

  function handleSave(id: string) {
    setChecks(prev =>
      prev.map(c => c.id === id ? { ...c, status: draftStatus, notes: draftNotes || undefined } : c)
    )
    setExpandedId(null)
  }

  const score = calcScore(checks)

  const filtered = checks.filter(item => {
    if (filterCategory && item.category !== filterCategory) return false
    if (filterStatus && item.status !== filterStatus) return false
    if (filterPriority && item.priority !== filterPriority) return false
    if (search) {
      const q = search.toLowerCase()
      return item.title.toLowerCase().includes(q) || item.description.toLowerCase().includes(q)
    }
    return true
  })

  const hasFilter = search || filterCategory || filterStatus || filterPriority

  const totalPassed = checks.filter(c => c.status === 'passed').length
  const totalFailed = checks.filter(c => c.status === 'failed').length
  const totalWarning = checks.filter(c => c.status === 'warning').length
  const totalInProgress = checks.filter(c => c.status === 'in-progress').length

  return (
    <div className="checklist-view">
      {/* Page header */}
      <div className="checklist-header">
        <div className="checklist-title-col">
          <h1 className="page-title">Security Checklist</h1>
          <p className="page-subtitle">{checks.length} controls across {CATEGORIES.length} categories</p>
        </div>
        <div className="checklist-score-block">
          <span className={`checklist-score ${scoreColor(score)}`}>{score}</span>
          <span className="checklist-score-label">/ 100</span>
        </div>
      </div>

      {/* Summary row */}
      <div className="checklist-summary">
        <div className="ck-sum-item">
          <span className="ck-sum-count ck-sum-passed">{totalPassed}</span>
          <span className="ck-sum-label">Passed</span>
        </div>
        <div className="ck-sum-item">
          <span className="ck-sum-count ck-sum-failed">{totalFailed}</span>
          <span className="ck-sum-label">Failed</span>
        </div>
        <div className="ck-sum-item">
          <span className="ck-sum-count ck-sum-warning">{totalWarning}</span>
          <span className="ck-sum-label">Warning</span>
        </div>
        <div className="ck-sum-item">
          <span className="ck-sum-count ck-sum-inprogress">{totalInProgress}</span>
          <span className="ck-sum-label">In Progress</span>
        </div>
      </div>

      {/* Category grid */}
      <div className="category-grid">
        {CATEGORIES.map(cat => {
          const s = categoryStats(checks, cat)
          const catScore = calcScore(checks.filter(c => c.category === cat))
          return (
            <div
              key={cat}
              className={`category-card ${filterCategory === cat ? 'category-card-active' : ''}`}
              onClick={() => setFilterCategory(prev => prev === cat ? '' : cat)}
              role="button"
              tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setFilterCategory(prev => prev === cat ? '' : cat) }}
            >
              <div className="category-card-top">
                <span className="category-card-name">{cat}</span>
                <span className={`category-card-score ${scoreColor(catScore)}`}>{catScore}</span>
              </div>
              <div className="category-mini-counts">
                <span className="ck-mini-pass">{s.passed}✓</span>
                {s.failed > 0 && <span className="ck-mini-fail">{s.failed}✗</span>}
                {s.warning > 0 && <span className="ck-mini-warn">{s.warning}!</span>}
                {s.inProgress > 0 && <span className="ck-mini-prog">{s.inProgress}↻</span>}
              </div>
              <div className="category-bar-track">
                <div
                  className={`category-bar-fill ${scoreColor(catScore)}`}
                  style={{ width: `${catScore}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Filter bar */}
      <div className="filter-bar">
        <div className="search-wrap">
          <svg className="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="M20 20l-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            className="search-input"
            placeholder="Search controls..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-selects">
          <select className="filter-select" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
            <option value="">All categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="passed">Passed</option>
            <option value="failed">Failed</option>
            <option value="warning">Warning</option>
            <option value="in-progress">In Progress</option>
            <option value="na">N/A</option>
          </select>
          <select className="filter-select" value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
            <option value="">All priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          {hasFilter && (
            <button className="clear-btn" onClick={() => { setSearch(''); setFilterCategory(''); setFilterStatus(''); setFilterPriority('') }}>
              Clear
            </button>
          )}
          <span className="filter-count">{filtered.length} of {checks.length}</span>
        </div>
      </div>

      {/* Check list */}
      <div className="checklist-table-card table-card">
        {filtered.length === 0 ? (
          <div className="empty-row" style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            No controls match the current filters.
          </div>
        ) : (
          <table className="data-table checklist-table">
            <thead>
              <tr>
                <th>Control</th>
                <th>Category</th>
                <th>Priority</th>
                <th>Owner</th>
                <th>Status</th>
                <th>Due</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <>
                  <tr
                    key={item.id}
                    className={`check-row ${expandedId === item.id ? 'check-row-expanded' : ''}`}
                    onClick={() => handleExpand(item)}
                  >
                    <td>
                      <div className="check-title">{item.title}</div>
                      {item.frameworks.length > 0 && (
                        <div className="check-frameworks">
                          {item.frameworks.slice(0, 3).map(f => (
                            <span key={f} className="framework-tag">{f}</span>
                          ))}
                          {item.frameworks.length > 3 && (
                            <span className="framework-tag framework-more">+{item.frameworks.length - 3}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="check-category">{item.category}</td>
                    <td><span className={`badge ${priorityBadgeClass(item.priority)}`}>{item.priority}</span></td>
                    <td className="check-owner">{item.owner}</td>
                    <td><span className={`ck-badge ${statusBadgeClass(item.status)}`}>{STATUS_LABELS[item.status]}</span></td>
                    <td className="check-due">
                      {item.dueDate
                        ? <span className={new Date(item.dueDate) < new Date() && item.status !== 'passed' ? 'due-overdue' : 'due-date'}>
                            {new Date(item.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </span>
                        : <span className="text-muted">—</span>
                      }
                    </td>
                  </tr>
                  {expandedId === item.id && (
                    <tr key={`${item.id}-detail`} className="check-detail-row">
                      <td colSpan={6}>
                        <div className="check-detail">
                          <p className="check-desc">{item.description}</p>
                          <div className="check-edit-row">
                            <div className="check-edit-field">
                              <label className="form-label">Status</label>
                              <select
                                className="filter-select"
                                value={draftStatus}
                                onChange={e => setDraftStatus(e.target.value as CheckStatus)}
                                onClick={e => e.stopPropagation()}
                              >
                                <option value="passed">Passed</option>
                                <option value="failed">Failed</option>
                                <option value="warning">Warning</option>
                                <option value="in-progress">In Progress</option>
                                <option value="na">N/A</option>
                              </select>
                            </div>
                            <div className="check-edit-field check-edit-notes">
                              <label className="form-label">Notes</label>
                              <textarea
                                className="check-notes-input"
                                value={draftNotes}
                                onChange={e => setDraftNotes(e.target.value)}
                                onClick={e => e.stopPropagation()}
                                rows={2}
                                placeholder="Add notes..."
                              />
                            </div>
                            <div className="check-edit-actions">
                              <button
                                className="primary-btn"
                                onClick={e => { e.stopPropagation(); handleSave(item.id) }}
                              >
                                Save
                              </button>
                              <button
                                className="secondary-btn"
                                onClick={e => { e.stopPropagation(); setExpandedId(null) }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
