import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { CI } from '../types'
import { mockCIs } from './mockData'

const KEY = 'secops-cmdb'

function load(): CI[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as CI[]
  } catch { /* ignore corrupted storage */ }
  return mockCIs
}

function persist(cis: CI[]): void {
  localStorage.setItem(KEY, JSON.stringify(cis))
}

interface Store {
  cis: CI[]
  upsert: (ci: CI) => void
  remove: (id: string) => void
  reset: () => void
}

const Ctx = createContext<Store | null>(null)

export function CIProvider({ children }: { children: ReactNode }) {
  const [cis, setCIs] = useState<CI[]>(load)

  const upsert = useCallback((ci: CI) => {
    setCIs(prev => {
      const next = prev.some(c => c.id === ci.id)
        ? prev.map(c => c.id === ci.id ? ci : c)
        : [...prev, ci]
      persist(next)
      return next
    })
  }, [])

  const remove = useCallback((id: string) => {
    setCIs(prev => {
      const next = prev.filter(c => c.id !== id)
      persist(next)
      return next
    })
  }, [])

  const reset = useCallback(() => {
    persist(mockCIs)
    setCIs(mockCIs)
  }, [])

  return <Ctx.Provider value={{ cis, upsert, remove, reset }}>{children}</Ctx.Provider>
}

export function useCIs(): Store {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useCIs used outside CIProvider')
  return ctx
}
