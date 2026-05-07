import { useState } from 'react'
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
