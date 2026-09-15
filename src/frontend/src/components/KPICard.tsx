import { ReactNode } from 'react'

interface KPICardProps {
  label: string
  value: string | number
  sub?: string
  color?: 'default' | 'danger' | 'warn' | 'ok' | 'blue' | 'cyan'
  icon?: ReactNode
  pulse?: boolean
  trend?: 'up' | 'down' | 'flat'
}

const valueColor: Record<string, string> = {
  default: 'var(--text-primary)',
  danger:  'var(--red)',
  warn:    'var(--amber)',
  ok:      'var(--green)',
  blue:    '#60a5fa',
  cyan:    'var(--cyan)',
}

const borderColor: Record<string, string> = {
  default: 'var(--border-default)',
  danger:  'rgba(244,63,63,0.3)',
  warn:    'rgba(245,166,35,0.3)',
  ok:      'rgba(38,217,142,0.25)',
  blue:    'rgba(30,126,248,0.3)',
  cyan:    'rgba(0,184,212,0.25)',
}

export default function KPICard({ label, value, sub, color = 'default', icon, pulse }: KPICardProps) {
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: `1px solid ${borderColor[color]}`,
      borderRadius: 6,
      padding: '12px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      minWidth: 0,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Top accent line for alert states */}
      {(color === 'danger' || color === 'warn') && (
        <span style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: color === 'danger' ? 'var(--red)' : 'var(--amber)',
          opacity: 0.7,
        }} />
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {label}
        </span>
        <span style={{ color: 'var(--text-faint)', display: 'flex' }}>
          {pulse && <span className="pulse-red" style={{ marginRight: icon ? 6 : 0 }} />}
          {icon}
        </span>
      </div>

      <p style={{ fontSize: 22, fontWeight: 700, color: valueColor[color], lineHeight: 1, marginTop: 4, letterSpacing: '-0.03em' }}>
        {value}
      </p>

      {sub && (
        <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</p>
      )}
    </div>
  )
}
