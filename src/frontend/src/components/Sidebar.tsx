'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Package,
  AlertTriangle,
  Truck,
  Thermometer,
  FlaskConical,
  Network,
  Activity,
  Radio,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/', label: 'Command', icon: LayoutDashboard },
  { href: '/disruptions', label: 'Disruptions', icon: AlertTriangle, alert: true },
  { href: '/shipments', label: 'Shipments', icon: Package },
  { href: '/fleet', label: 'Fleet Ops', icon: Truck },
  { href: '/cold-chain', label: 'Cold Chain', icon: Thermometer },
  { href: '/whatif', label: 'Scenarios', icon: FlaskConical },
  { href: '/network', label: 'Network', icon: Network },
  { href: '/copilot', label: 'AI Copilot', icon: Sparkles },
]

export default function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="fixed left-0 top-0 h-screen flex flex-col z-40"
      style={{ width: 'var(--sidebar-width)', background: 'var(--bg-raised)', borderRight: '1px solid var(--border-default)' }}>

      {/* Wordmark */}
      <div style={{ padding: '16px 16px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center"
            style={{ width: 28, height: 28, background: 'var(--accent)', borderRadius: 5 }}>
            <Activity size={14} color="#fff" strokeWidth={2.5} />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
              style={{ background: 'var(--green)', border: '1.5px solid var(--bg-raised)' }} />
          </div>
          <div>
            <p className="font-bold leading-none" style={{ fontSize: 13, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              CLUTCH NEXUS
            </p>
            <p style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.1em', marginTop: 2 }}>
              CONTROL TOWER
            </p>
          </div>
        </div>
      </div>

      {/* Live Incident */}
      <div style={{ padding: '10px 12px' }}>
        <div className="incident-banner">
          <div className="flex items-start gap-2">
            <span className="pulse-red mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--red)', letterSpacing: '0.04em' }}>
                LIVE INCIDENT
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 600, marginTop: 1, lineHeight: 1.3 }}>
                Mumbai Port — Berths 1–8
              </p>
              <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                Partial closure · Critical
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '4px 8px', overflowY: 'auto' }}>
        <p className="section-label" style={{ padding: '8px 8px 6px' }}>Navigation</p>
        {navItems.map(({ href, label, icon: Icon, alert }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 transition-all relative',
                active ? 'text-white' : 'hover:text-white'
              )}
              style={{
                padding: '8px 10px',
                borderRadius: 5,
                fontSize: 12,
                fontWeight: active ? 600 : 400,
                color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                background: active ? 'var(--bg-active)' : 'transparent',
                borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                textDecoration: 'none',
              }}
            >
              <Icon size={14} style={{ opacity: active ? 1 : 0.7, flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{label}</span>
              {alert && (
                <span className="pulse-red" style={{ width: 6, height: 6 }} />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Status strip */}
      <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center gap-1.5 mb-2">
          <Radio size={10} style={{ color: 'var(--green)' }} />
          <span style={{ fontSize: 10, color: 'var(--green)', fontWeight: 600, letterSpacing: '0.05em' }}>
            BACKEND CONNECTED
          </span>
        </div>
        <p style={{ fontSize: 9, color: 'var(--text-faint)', letterSpacing: '0.05em' }}>
          IBM BOB HACKATHON 2026
        </p>
      </div>
    </aside>
  )
}
