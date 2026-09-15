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
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/shipments', label: 'Shipments', icon: Package },
  { href: '/disruptions', label: 'Disruptions', icon: AlertTriangle },
  { href: '/fleet', label: 'Fleet', icon: Truck },
  { href: '/cold-chain', label: 'Cold Chain', icon: Thermometer },
  { href: '/whatif', label: 'What-If', icon: FlaskConical },
  { href: '/network', label: 'Network', icon: Network },
]

export default function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="fixed left-0 top-0 h-screen w-[240px] bg-slate-950 border-r border-slate-800 flex flex-col z-40">
      {/* Logo */}
      <div className="p-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Activity size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-tight">Clutch Nexus</p>
            <p className="text-[10px] text-slate-500 leading-tight">Supply Chain AI</p>
          </div>
        </div>
      </div>

      {/* Alert banner */}
      <div className="mx-3 mt-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[11px] text-red-400 font-medium">Mumbai Port: CLOSED</span>
        </div>
        <p className="text-[10px] text-slate-500 mt-0.5">18 shipments affected</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 mt-2 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all',
                active
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-600/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              )}
            >
              <Icon size={16} />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-800">
        <p className="text-[10px] text-slate-600 text-center">
          IBM Bob Hackathon 2026
        </p>
        <p className="text-[10px] text-slate-700 text-center mt-0.5">
          IBM Granite · watsonx.ai
        </p>
      </div>
    </aside>
  )
}
