import { cn } from '@/lib/utils'
import { ReactNode } from 'react'

interface KPICardProps {
  label: string
  value: string | number
  sub?: string
  color?: 'default' | 'danger' | 'warn' | 'ok' | 'blue'
  icon?: ReactNode
  pulse?: boolean
}

const colorMap = {
  default: 'text-slate-100',
  danger: 'text-red-400',
  warn: 'text-yellow-400',
  ok: 'text-green-400',
  blue: 'text-blue-400',
}

export default function KPICard({ label, value, sub, color = 'default', icon, pulse }: KPICardProps) {
  return (
    <div className="card p-4 flex flex-col gap-1 min-w-0">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">{label}</span>
        {icon && <span className="text-slate-600">{icon}</span>}
        {pulse && (
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        )}
      </div>
      <p className={cn('text-2xl font-bold leading-none mt-1', colorMap[color])}>
        {value}
      </p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  )
}
