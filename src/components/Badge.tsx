import type { Criticality, AssetStatus, Environment, PatchStatus } from '../types'

type BadgeVariant =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | 'active'
  | 'inactive'
  | 'maintenance'
  | 'decommissioned'
  | 'production'
  | 'staging'
  | 'development'
  | 'dr'
  | 'patch-ok'
  | 'patch-avail'
  | 'patch-critical'
  | 'patch-unknown'
  | 'neutral'

interface BadgeProps {
  children: React.ReactNode
  variant: BadgeVariant
}

export function Badge({ children, variant }: BadgeProps) {
  return <span className={`badge badge-${variant}`}>{children}</span>
}

export function CriticalityBadge({ value }: { value: Criticality }) {
  const map: Record<Criticality, BadgeVariant> = {
    Critical: 'critical',
    High: 'high',
    Medium: 'medium',
    Low: 'low',
  }
  return <Badge variant={map[value]}>{value}</Badge>
}

export function StatusBadge({ value }: { value: AssetStatus }) {
  const map: Record<AssetStatus, BadgeVariant> = {
    Active: 'active',
    Inactive: 'inactive',
    Maintenance: 'maintenance',
    Decommissioned: 'decommissioned',
  }
  return <Badge variant={map[value]}>{value}</Badge>
}

export function EnvironmentBadge({ value }: { value: Environment }) {
  const map: Record<Environment, BadgeVariant> = {
    Production: 'production',
    Staging: 'staging',
    Development: 'development',
    DR: 'dr',
  }
  const label: Record<Environment, string> = {
    Production: 'PROD',
    Staging: 'STG',
    Development: 'DEV',
    DR: 'DR',
  }
  return <Badge variant={map[value]}>{label[value]}</Badge>
}

export function PatchBadge({ value }: { value: PatchStatus }) {
  const map: Record<PatchStatus, BadgeVariant> = {
    'Up to date': 'patch-ok',
    'Patches available': 'patch-avail',
    'Critical patches': 'patch-critical',
    Unknown: 'patch-unknown',
  }
  return <Badge variant={map[value]}>{value}</Badge>
}
