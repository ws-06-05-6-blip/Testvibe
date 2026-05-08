import { useState, useEffect } from 'react'
import type { CheckItem, CheckCategory, CheckPriority, CheckStatus } from '../types'
import { initialChecks } from '../data/checklistData'

const STORAGE_KEY = 'secops-checklist-state'

const WEIGHTS: Record<CheckPriority, number> = { critical: 4, high: 3, medium: 2, low: 1 }

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
  return max === 0 ? 0 : Math.round((earned / max) * 100)
}

function scoreColor(score: number): string {
  if (score >= 80) return 'score-green'
  if (score >= 60) return 'score-yellow'
  if (score >= 40) return 'score-orange'
  return 'score-red'
}

function statusWrapClass(status: CheckStatus): string {
  return {
    passed: 'ck-badge-passed',
    failed: 'ck-badge-failed',
    warning: 'ck-badge-warning',
    'in-progress': 'ck-badge-inprogress',
    na: 'ck-badge-na',
  }[status]
}

function priorityBadgeClass(priority: CheckPriority): string {
  return { critical: 'badge-critical', high: 'badge-high', medium: 'badge-medium', low: 'badge-low' }[priority]
}

function generateId(): string {
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function exportCSV(items: CheckItem[]) {
  const esc = (v: string) =>
    v.includes(',') || v.includes('"') || v.includes('\n')
      ? `"${v.replace(/"/g, '""')}"`
      : v

  const headers = ['ID', 'Title', 'Description', 'Category', 'Priority', 'Status', 'Owner', 'Frameworks', 'Due Date', 'Notes']
  const rows = items.map(i =>
    [i.id, i.title, i.description, i.category, i.priority, i.status, i.owner,
     i.frameworks.join('; '), i.dueDate ?? '', i.notes ?? '']
      .map(v => esc(String(v))).join(',')
  )
  const csv = [headers.map(esc).join(','), ...rows].join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }))
  a.download = `security-checklist-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

// ── Edit / create panel ───────────────────────────────────────────────────────

const BLANK: Omit<CheckItem, 'id'> = {
  title: '',
  description: '',
  category: 'Vulnerability Management',
  priority: 'medium',
  status: 'in-progress',
  owner: '',
  frameworks: [],
}

interface PanelProps {
  item: CheckItem | null
  onSave: (item: CheckItem) => void
  onDelete: (id: string) => void
  onClose: () => void
}

function EditPanel({ item, onSave, onDelete, onClose }: PanelProps) {
  const [form, setForm] = useState<Omit<CheckItem, 'id'>>(item ? { ...item } : { ...BLANK })
  const [fwText, setFwText] = useState(item ? item.frameworks.join(', ') : '')
  const [confirmDel, setConfirmDel] = useState(false)

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function handleSave() {
    if (!form.title.trim()) return
    onSave({
      ...form,
      id: item?.id ?? generateId(),
      frameworks: fwText.split(',').map(s => s.trim()).filter(Boolean),
    })
  }

  return (
    <>
      <div className="panel-overlay" onClick={onClose} />
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title-row">
            <div>
              <div className="panel-name">{item ? 'Edit control' : 'New control'}</div>
              {item && <div className="panel-hostname">{item.id}</div>}
            </div>
            <button className="close-btn" onClick={onClose}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        <div className="panel-section">
          <div className="ck-form">
            <div className="form-row">
              <label className="form-label">
                Title <span className="ck-required">*</span>
              </label>
              <input
                className="form-input"
                value={form.title}
                onChange={e => set('title', e.target.value)}
                placeholder="Control title"
                autoFocus
              />
            </div>

            <div className="form-row">
              <label className="form-label">Description</label>
              <textarea
                className="form-input ck-textarea"
                value={form.description}
                onChange={e => set('description', e.target.value)}
                placeholder="What this control verifies and how to assess it"
                rows={3}
              />
            </div>

            <div className="ck-form-grid">
              <div className="form-row">
                <label className="form-label">Category</label>
                <select className="form-input" value={form.category} onChange={e => set('category', e.target.value as CheckCategory)}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="form-row">
                <label className="form-label">Priority</label>
                <select className="form-input" value={form.priority} onChange={e => set('priority', e.target.value as CheckPriority)}>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              <div className="form-row">
                <label className="form-label">Status</label>
                <select className="form-input" value={form.status} onChange={e => set('status', e.target.value as CheckStatus)}>
                  <option value="passed">Passed</option>
                  <option value="failed">Failed</option>
                  <option value="warning">Warning</option>
                  <option value="in-progress">In Progress</option>
                  <option value="na">N/A</option>
                </select>
              </div>

              <div className="form-row">
                <label className="form-label">Owner</label>
                <input
                  className="form-input"
                  value={form.owner}
                  onChange={e => set('owner', e.target.value)}
                  placeholder="Person or team"
                />
              </div>
            </div>

            <div className="form-row">
              <label className="form-label">Frameworks</label>
              <input
                className="form-input"
                value={fwText}
                onChange={e => setFwText(e.target.value)}
                placeholder="CIS 7.1, NIST CSF ID.RA, PCI-DSS 11.3 (comma-separated)"
              />
            </div>

            <div className="form-row">
              <label className="form-label">Due date</label>
              <input
                className="form-input"
                type="date"
                value={form.dueDate ?? ''}
                onChange={e => set('dueDate', e.target.value || undefined)}
              />
            </div>

            <div className="form-row">
              <label className="form-label">Notes</label>
              <textarea
                className="form-input ck-textarea"
                value={form.notes ?? ''}
                onChange={e => set('notes', e.target.value || undefined)}
                placeholder="Current status, blockers, context..."
                rows={3}
              />
            </div>
          </div>
        </div>

        <div className="ck-panel-footer">
          <div className="ck-panel-footer-left">
            {item && (
              confirmDel
                ? <>
                    <span className="ck-del-confirm">Delete this control?</span>
                    <button className="del-btn-text" onClick={() => { onDelete(item.id); onClose() }}>Confirm</button>
                    <button className="secondary-btn ck-sm-btn" onClick={() => setConfirmDel(false)}>Cancel</button>
                  </>
                : <button className="del-btn-text" onClick={() => setConfirmDel(true)}>Delete</button>
            )}
          </div>
          <div className="form-actions" style={{ margin: 0 }}>
            <button className="secondary-btn" onClick={onClose}>Cancel</button>
            <button className="primary-btn" onClick={handleSave} disabled={!form.title.trim()}>
              {item ? 'Save changes' : 'Add control'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

type PanelState = false | null | CheckItem // false=closed, null=new, item=editing

export function ChecklistView() {
  const [checks, setChecks] = useState<CheckItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed: CheckItem[] = JSON.parse(saved)
        const map = new Map(parsed.map(c => [c.id, c]))
        return [
          ...initialChecks.map(c => map.get(c.id) ?? c),
          ...parsed.filter(c => c.id.startsWith('custom-')),
        ]
      }
    } catch { /* ignore */ }
    return initialChecks
  })

  const [panel, setPanel] = useState<PanelState>(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus] = useState<CheckStatus | ''>('')

  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterPriority, setFilterPriority] = useState<string>('')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(checks))
  }, [checks])

  function handleInlineStatus(id: string, status: CheckStatus) {
    setChecks(prev => prev.map(c => c.id === id ? { ...c, status } : c))
  }

  function handlePanelSave(item: CheckItem) {
    setChecks(prev =>
      prev.find(c => c.id === item.id)
        ? prev.map(c => c.id === item.id ? item : c)
        : [...prev, item]
    )
    setPanel(false)
  }

  function handlePanelDelete(id: string) {
    setChecks(prev => prev.filter(c => c.id !== id))
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n })
  }

  function handleBulkApply() {
    if (!bulkStatus) return
    setChecks(prev => prev.map(c => selected.has(c.id) ? { ...c, status: bulkStatus as CheckStatus } : c))
    setSelected(new Set())
    setBulkStatus('')
  }

  function handleResetDefaults() {
    if (!confirm('Reset all built-in controls to their default status? Custom controls are kept.')) return
    setChecks(prev => [
      ...initialChecks,
      ...prev.filter(c => c.id.startsWith('custom-')),
    ])
    setSelected(new Set())
  }

  function toggleSelect(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function toggleSelectAll(ids: string[]) {
    setSelected(prev =>
      ids.every(id => prev.has(id)) ? new Set() : new Set(ids)
    )
  }

  const score = calcScore(checks)

  const filtered = checks.filter(item => {
    if (filterCat && item.category !== filterCat) return false
    if (filterStatus && item.status !== filterStatus) return false
    if (filterPriority && item.priority !== filterPriority) return false
    if (search) {
      const q = search.toLowerCase()
      return item.title.toLowerCase().includes(q)
        || item.description.toLowerCase().includes(q)
        || item.owner.toLowerCase().includes(q)
    }
    return true
  })

  const filteredIds = filtered.map(i => i.id)
  const allSelected = filteredIds.length > 0 && filteredIds.every(id => selected.has(id))
  const hasFilter = !!(search || filterCat || filterStatus || filterPriority)

  const totalPassed = checks.filter(c => c.status === 'passed').length
  const totalFailed = checks.filter(c => c.status === 'failed').length
  const totalWarning = checks.filter(c => c.status === 'warning').length
  const totalInProgress = checks.filter(c => c.status === 'in-progress').length

  return (
    <div className="checklist-view">
      {/* Header */}
      <div className="checklist-header">
        <div className="checklist-title-col">
          <h1 className="page-title">Security Checklist</h1>
          <p className="page-subtitle">{checks.length} controls · {CATEGORIES.length} categories</p>
        </div>
        <div className="checklist-header-right">
          <div className="checklist-score-block">
            <span className={`checklist-score ${scoreColor(score)}`}>{score}</span>
            <span className="checklist-score-label">/ 100</span>
          </div>
          <button className="primary-btn ck-add-btn" onClick={() => setPanel(null)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            Add control
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="checklist-summary">
        {([
          ['Passed', totalPassed, 'ck-sum-passed'],
          ['Failed', totalFailed, 'ck-sum-failed'],
          ['Warning', totalWarning, 'ck-sum-warning'],
          ['In Progress', totalInProgress, 'ck-sum-inprogress'],
        ] as const).map(([label, count, cls]) => (
          <div
            key={label}
            className={`ck-sum-item ${filterStatus === label.toLowerCase().replace(' ', '-') ? 'ck-sum-active' : ''}`}
            onClick={() => setFilterStatus(s => s === label.toLowerCase().replace(' ', '-') ? '' : label.toLowerCase().replace(' ', '-'))}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter') setFilterStatus(s => s === label.toLowerCase().replace(' ', '-') ? '' : label.toLowerCase().replace(' ', '-')) }}
          >
            <span className={`ck-sum-count ${cls}`}>{count}</span>
            <span className="ck-sum-label">{label}</span>
          </div>
        ))}
      </div>

      {/* Category cards */}
      <div className="category-grid">
        {CATEGORIES.map(cat => {
          const catItems = checks.filter(c => c.category === cat)
          const catScore = calcScore(catItems)
          const passed = catItems.filter(i => i.status === 'passed').length
          const failed = catItems.filter(i => i.status === 'failed').length
          const warning = catItems.filter(i => i.status === 'warning').length
          const inProg = catItems.filter(i => i.status === 'in-progress').length
          return (
            <div
              key={cat}
              className={`category-card ${filterCat === cat ? 'category-card-active' : ''}`}
              onClick={() => setFilterCat(p => p === cat ? '' : cat)}
              role="button"
              tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setFilterCat(p => p === cat ? '' : cat) }}
            >
              <div className="category-card-top">
                <span className="category-card-name">{cat}</span>
                <span className={`category-card-score ${scoreColor(catScore)}`}>{catScore}</span>
              </div>
              <div className="category-mini-counts">
                <span className="ck-mini-pass">{passed}✓</span>
                {failed > 0 && <span className="ck-mini-fail">{failed}✗</span>}
                {warning > 0 && <span className="ck-mini-warn">{warning}!</span>}
                {inProg > 0 && <span className="ck-mini-prog">{inProg}↻</span>}
              </div>
              <div className="category-bar-track">
                <div className={`category-bar-fill ${scoreColor(catScore)}`} style={{ width: `${catScore}%` }} />
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
            placeholder="Search controls, owners..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-selects">
          <select className="filter-select" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
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
            <button className="clear-btn" onClick={() => { setSearch(''); setFilterCat(''); setFilterStatus(''); setFilterPriority('') }}>
              Clear
            </button>
          )}
          <span className="filter-count">{filtered.length} of {checks.length}</span>
          <div className="filter-spacer" />
          <button className="secondary-btn ck-sm-btn" onClick={() => exportCSV(filtered)} title={`Export ${filtered.length} controls`}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }}>
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Export CSV
          </button>
          <button className="secondary-btn ck-sm-btn" onClick={handleResetDefaults}>Reset defaults</button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="bulk-bar">
          <span className="bulk-count">{selected.size} selected</span>
          <select
            className="filter-select"
            value={bulkStatus}
            onChange={e => setBulkStatus(e.target.value as CheckStatus | '')}
          >
            <option value="">Set status…</option>
            <option value="passed">Passed</option>
            <option value="failed">Failed</option>
            <option value="warning">Warning</option>
            <option value="in-progress">In Progress</option>
            <option value="na">N/A</option>
          </select>
          <button className="primary-btn ck-sm-btn" onClick={handleBulkApply} disabled={!bulkStatus}>Apply</button>
          <button className="secondary-btn ck-sm-btn" onClick={() => setSelected(new Set())}>Clear selection</button>
        </div>
      )}

      {/* Table */}
      <div className="checklist-table-card table-card">
        {filtered.length === 0 ? (
          <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            No controls match the current filters.
          </div>
        ) : (
          <table className="data-table checklist-table">
            <thead>
              <tr>
                <th className="ck-col-check">
                  <input
                    type="checkbox"
                    className="ck-checkbox"
                    checked={allSelected}
                    onChange={() => toggleSelectAll(filteredIds)}
                  />
                </th>
                <th>Control</th>
                <th>Category</th>
                <th>Priority</th>
                <th>Owner</th>
                <th>Status</th>
                <th>Due</th>
                <th className="ck-col-action" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <tr key={item.id} className={selected.has(item.id) ? 'check-row-selected' : ''}>
                  <td onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="ck-checkbox"
                      checked={selected.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                    />
                  </td>
                  <td>
                    <div className="check-title">{item.title}</div>
                    {item.notes && (
                      <div className="check-notes-preview">{item.notes}</div>
                    )}
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
                  <td>
                    <span className={`badge ${priorityBadgeClass(item.priority)}`}>{item.priority}</span>
                  </td>
                  <td className="check-owner">{item.owner || <span className="text-muted">—</span>}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className={`ck-status-wrap ${statusWrapClass(item.status)}`}>
                      <select
                        className="ck-status-select"
                        value={item.status}
                        onChange={e => handleInlineStatus(item.id, e.target.value as CheckStatus)}
                      >
                        <option value="passed">Passed</option>
                        <option value="failed">Failed</option>
                        <option value="warning">Warning</option>
                        <option value="in-progress">In Progress</option>
                        <option value="na">N/A</option>
                      </select>
                    </div>
                  </td>
                  <td className="check-due">
                    {item.dueDate
                      ? <span className={new Date(item.dueDate) < new Date() && item.status !== 'passed' ? 'due-overdue' : 'due-date'}>
                          {new Date(item.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </span>
                      : <span className="text-muted">—</span>
                    }
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <button className="ck-edit-btn" onClick={() => setPanel(item)} title="Edit">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit / create panel */}
      {panel !== false && (
        <EditPanel
          item={panel}
          onSave={handlePanelSave}
          onDelete={handlePanelDelete}
          onClose={() => setPanel(false)}
        />
      )}
    </div>
  )
}
