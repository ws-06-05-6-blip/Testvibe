import { useState, useEffect } from 'react'
import type { CI, View } from './types'
import { Sidebar } from './components/Sidebar'
import { Dashboard } from './components/Dashboard'
import { AssetsView } from './components/AssetsView'
import { AssetDetailPanel } from './components/AssetDetailPanel'
import { ScannerView } from './components/ScannerView'
import { ChecklistView } from './components/ChecklistView'
import './App.css'

function App() {
  const [view, setView] = useState<View>('dashboard')
  const [selectedCI, setSelectedCI] = useState<CI | null>(null)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('secops-theme') as 'dark' | 'light' | null
    const initial = saved ?? 'dark'
    document.documentElement.setAttribute('data-theme', initial)
    return initial
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('secops-theme', theme)
  }, [theme])

  useEffect(() => {
    const labels: Record<View, string> = {
      dashboard: 'Dashboard',
      assets: 'Assets',
      scanner: 'Scanner',
      checklist: 'Checklist',
    }
    document.title = `${labels[view]} — SecOps CMDB`
  }, [view])

  function handleSelect(ci: CI) {
    setSelectedCI(ci)
  }

  function handleClosePanel() {
    setSelectedCI(null)
  }

  function handleViewAssets() {
    setView('assets')
  }

  return (
    <div className="app">
      <Sidebar view={view} onNavigate={setView} />
      <div className="main">
        <header className="header">
          <div className="header-breadcrumb">
            <span className="header-org">SecOps CMDB</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="breadcrumb-sep">
              <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span className="header-section">
              {view === 'dashboard' ? 'Dashboard' : view === 'assets' ? 'Assets' : view === 'scanner' ? 'Scanner' : 'Checklist'}
            </span>
          </div>
          <div className="header-right">
            <span className="header-date">
              {new Date('2026-05-06').toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
            <button
              className="theme-toggle"
              onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          </div>
        </header>
        <main className="content">
          {view === 'dashboard' && (
            <Dashboard onViewAssets={handleViewAssets} onSelect={handleSelect} />
          )}
          {view === 'assets' && (
            <AssetsView onSelect={handleSelect} />
          )}
          {view === 'scanner' && (
            <ScannerView />
          )}
          {view === 'checklist' && (
            <ChecklistView />
          )}
        </main>
      </div>
      {selectedCI && (
        <AssetDetailPanel ci={selectedCI} onClose={handleClosePanel} />
      )}
    </div>
  )
}

export default App
