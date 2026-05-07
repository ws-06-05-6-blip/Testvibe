import type { Scan, ScanProfile, ScanResult } from '../types'

const BASE = '/api'

export async function getHealth(): Promise<{ status: string; checks: Record<string, unknown> }> {
  const res = await fetch(`${BASE}/health`)
  return res.json()
}

export async function getProfiles(): Promise<Record<string, ScanProfile>> {
  const res = await fetch(`${BASE}/profiles`)
  return res.json()
}

export async function listScans(): Promise<Scan[]> {
  const res = await fetch(`${BASE}/scans`)
  if (!res.ok) throw new Error('Failed to fetch scans')
  return res.json()
}

export async function getScan(id: string): Promise<ScanResult> {
  const res = await fetch(`${BASE}/scans/${id}`)
  if (!res.ok) throw new Error('Scan not found')
  return res.json()
}

export async function createScan(data: {
  name: string
  target: string
  profile: string
  nvd_api_key?: string
}): Promise<{ id: string; status: string }> {
  const res = await fetch(`${BASE}/scans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail ?? 'Failed to create scan')
  }
  return res.json()
}

export async function deleteScan(id: string): Promise<void> {
  await fetch(`${BASE}/scans/${id}`, { method: 'DELETE' })
}
