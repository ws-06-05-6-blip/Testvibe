export type AssetType =
  | 'Firewall'
  | 'IDS/IPS'
  | 'SIEM'
  | 'EDR'
  | 'Server'
  | 'Workstation'
  | 'Network Device'
  | 'VPN Gateway'
  | 'Identity Provider'
  | 'PAM'
  | 'Vulnerability Scanner'
  | 'Certificate Authority'
  | 'Email Gateway'
  | 'NAC'
  | 'Backup System'
  | 'Cloud Security'

export type AssetCategory = 'Hardware' | 'Network' | 'Cloud'
export type AssetStatus = 'Active' | 'Inactive' | 'Decommissioned' | 'Maintenance'
export type Environment = 'Production' | 'Staging' | 'Development' | 'DR'
export type Criticality = 'Critical' | 'High' | 'Medium' | 'Low'
export type Classification = 'Restricted' | 'Confidential' | 'Internal' | 'Public'
export type PatchStatus = 'Up to date' | 'Patches available' | 'Critical patches' | 'Unknown'

export interface VulnCount {
  critical: number
  high: number
  medium: number
  low: number
}

export interface CI {
  id: string
  name: string
  displayName: string
  type: AssetType
  category: AssetCategory
  status: AssetStatus
  environment: Environment
  criticality: Criticality
  classification: Classification
  owner: string
  team: string
  ip?: string
  manufacturer?: string
  model?: string
  os?: string
  softwareVersion?: string
  serialNumber?: string
  assetTag?: string
  warrantyExpiry?: string
  location: string
  lastSeen: string
  lastVulnScan?: string
  patchStatus: PatchStatus
  vulnerabilities: VulnCount
  compliance: string[]
  tags: string[]
  dependencies: string[]
  lastUpdated: string
  notes?: string
}

export type View = 'dashboard' | 'assets' | 'scanner' | 'checklist'

// ── Checklist types ───────────────────────────────────────────────────────────

export type CheckCategory =
  | 'Vulnerability Management'
  | 'Identity & Access'
  | 'Network Security'
  | 'Endpoint Security'
  | 'Data Protection'
  | 'Incident Response'
  | 'Compliance'
  | 'Asset Management'

export type CheckPriority = 'critical' | 'high' | 'medium' | 'low'
export type CheckStatus = 'passed' | 'failed' | 'warning' | 'in-progress' | 'na'

export interface CheckItem {
  id: string
  title: string
  description: string
  category: CheckCategory
  priority: CheckPriority
  status: CheckStatus
  owner: string
  frameworks: string[]
  dueDate?: string
  notes?: string
}

// ── Scanner types ─────────────────────────────────────────────────────────────

export type ScanStatus = 'pending' | 'running' | 'completed' | 'failed'
export type VulnSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

export interface ScanProfile {
  name: string
  description: string
  flags: string[]
}

export interface Scan {
  id: string
  name: string
  target: string
  profile: string
  status: ScanStatus
  progress: number
  started_at: string | null
  completed_at: string | null
  hosts_total: number
  hosts_scanned: number
  vuln_critical: number
  vuln_high: number
  vuln_medium: number
  vuln_low: number
  created_at: string
  error: string | null
}

export interface ScanPort {
  id: string
  host_id: string
  port: number
  protocol: string
  state: string
  service: string | null
  product: string | null
  version: string | null
  extra_info: string | null
}

export interface ScanVuln {
  id: string
  host_id: string
  cve_id: string
  description: string | null
  cvss_score: number
  severity: VulnSeverity
  published: string | null
  url: string | null
}

export interface ScanHost {
  id: string
  scan_id: string
  ip: string
  hostname: string | null
  os: string | null
  status: string
  risk_score: number
  ports: ScanPort[]
  vulnerabilities: ScanVuln[]
}

export interface ScanResult extends Scan {
  hosts: ScanHost[]
}
