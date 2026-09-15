import clsx from 'clsx'

export function cn(...classes: (string | undefined | null | false)[]) {
  return clsx(classes)
}

export function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value.toFixed(0)}`
}

export function formatNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return `${value}`
}

export function riskColor(score: number): string {
  if (score >= 0.8) return 'text-red-400'
  if (score >= 0.6) return 'text-orange-400'
  if (score >= 0.4) return 'text-yellow-400'
  if (score >= 0.2) return 'text-blue-400'
  return 'text-green-400'
}

export function riskBgColor(score: number): string {
  if (score >= 0.8) return 'bg-red-500/20 text-red-400 border border-red-500/30'
  if (score >= 0.6) return 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
  if (score >= 0.4) return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
  if (score >= 0.2) return 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
  return 'bg-green-500/20 text-green-400 border border-green-500/30'
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    disrupted: 'bg-red-500/20 text-red-400 border border-red-500/30',
    at_risk: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
    delayed: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
    in_transit: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    scheduled: 'bg-slate-500/20 text-slate-400 border border-slate-500/30',
    delivered: 'bg-green-500/20 text-green-400 border border-green-500/30',
    available: 'bg-green-500/20 text-green-400 border border-green-500/30',
    maintenance: 'bg-slate-500/20 text-slate-400 border border-slate-500/30',
    stranded: 'bg-red-500/20 text-red-400 border border-red-500/30',
  }
  return map[status] || 'bg-slate-500/20 text-slate-400'
}

export function priorityLabel(p: number): string {
  const map: Record<number, string> = { 1: 'Critical', 2: 'High', 3: 'Medium', 4: 'Low' }
  return map[p] || 'Unknown'
}

export function priorityColor(p: number): string {
  const map: Record<number, string> = {
    1: 'bg-red-500/20 text-red-400 border border-red-500/30',
    2: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
    3: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    4: 'bg-slate-500/20 text-slate-400 border border-slate-500/30',
  }
  return map[p] || 'bg-slate-500/20 text-slate-400'
}

export function severityColor(s: string): string {
  const map: Record<string, string> = {
    critical: 'bg-red-500/20 text-red-400 border border-red-500/30',
    high: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
    low: 'bg-green-500/20 text-green-400 border border-green-500/30',
  }
  return map[s] || 'bg-slate-500/20 text-slate-400'
}

export function modeIcon(mode: string): string {
  const map: Record<string, string> = {
    sea: '🚢',
    air: '✈️',
    rail: '🚂',
    road: '🚛',
    multimodal: '🔀',
  }
  return map[mode] || '📦'
}
