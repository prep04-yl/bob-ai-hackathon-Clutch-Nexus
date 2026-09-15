'use client'
import { useEffect, useState, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer
} from 'recharts'
import { AlertTriangle, Package, Truck, Thermometer, TrendingUp, DollarSign, RefreshCw, ShieldAlert, CheckCircle2, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { apiClient, type DashboardKPIs } from '@/lib/api'
import KPICard from '@/components/KPICard'
import { formatCurrency, severityColor } from '@/lib/utils'
import { cn } from '@/lib/utils'

const STATUS_COLORS: Record<string, string> = {
  disrupted:  'var(--red)',
  at_risk:    'var(--orange)',
  delayed:    'var(--amber)',
  in_transit: '#3b82f6',
  scheduled:  '#4a6180',
  delivered:  'var(--green)',
}

const CATEGORY_COLORS = ['#1e7ef8','#26d98e','#f5a623','#f43f3f','#00b8d4','#a78bfa','#fb8c00','#84cc16']

function CT(props: { style?: React.CSSProperties; className?: string; children?: React.ReactNode }) {
  return (
    <div className={cn('card', props.className)} style={{ padding: 16, ...props.style }}>
      {props.children}
    </div>
  )
}

const TOOLTIP_STYLE = {
  background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)',
  borderRadius: 5, fontSize: 11, padding: '6px 10px',
}

export default function DashboardPage() {
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null)
  const [statusData, setStatusData] = useState<any[]>([])
  const [categoryData, setCategoryData] = useState<any[]>([])
  const [riskData, setRiskData] = useState<any[]>([])
  const [fleetData, setFleetData] = useState<any[]>([])
  const [disruptions, setDisruptions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      apiClient.getKPIs(),
      apiClient.getShipmentsByStatus(),
      apiClient.getShipmentsByCategory(),
      apiClient.getRiskTimeline(),
      apiClient.getFleetUtilisation(),
      apiClient.getDisruptions(),
    ]).then(([k, s, c, r, f, d]) => {
      setKpis(k.data)
      setStatusData(s.data)
      setCategoryData(c.data)
      setRiskData(r.data)
      setFleetData(f.data)
      setDisruptions(d.data)
      setLoading(false)
    }).catch((err) => {
      setError(err?.message || 'Failed to load dashboard. Is the backend running?')
      setLoading(false)
    })
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div style={{ width: 32, height: 32, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading command center…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center" style={{ maxWidth: 360 }}>
          <AlertTriangle size={36} style={{ color: 'var(--red)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 6 }}>Backend unreachable</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>{error}</p>
          <button onClick={load} className="btn-primary mx-auto"><RefreshCw size={12} /> Retry</button>
        </div>
      </div>
    )
  }

  const activeDisruptions = disruptions.filter((d: any) => d.is_active)
  const mainDisruption = activeDisruptions.find((d: any) => d.type === 'port_closure') || activeDisruptions[0]

  return (
    <div style={{ padding: 20 }} className="fade-in">
      {/* ── Top bar ────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between" style={{ marginBottom: 16 }}>
        <div>
          <div className="flex items-center gap-2" style={{ marginBottom: 3 }}>
            <span className="pulse-red" />
            <h1 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              COMMAND CENTER
            </h1>
            <span className="badge badge-red">LIVE INCIDENT</span>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Mumbai Port Trust · Partial Closure (Berths 1–8) ·{' '}
            <span style={{ color: 'var(--red)' }}>{kpis?.active_disruptions ?? 0} active disruptions</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {mainDisruption && (
            <Link href="/disruptions" style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
                background: 'var(--red-dim)', border: '1px solid var(--red-border)', borderRadius: 5,
                cursor: 'pointer',
              }}>
                <span className="pulse-red" />
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', letterSpacing: '0.04em' }}>
                  VIEW CASCADE →
                </span>
              </div>
            </Link>
          )}
          <button onClick={load} className="btn-ghost" title="Refresh">
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* ── KPI strip ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-2" style={{ marginBottom: 16 }}>
        <KPICard label="Total Shipments" value={kpis?.total_shipments ?? 0} sub="Under tracking" icon={<Package size={12} />} />
        <KPICard label="Disrupted" value={kpis?.disrupted ?? 0} sub="Port closure" color="danger" pulse={!!kpis?.disrupted} icon={<AlertTriangle size={12} />} />
        <KPICard label="At Risk" value={kpis?.at_risk ?? 0} sub="Escalation possible" color="warn" icon={<TrendingUp size={12} />} />
        <KPICard label="Delayed" value={kpis?.delayed ?? 0} sub="Behind schedule" color="warn" icon={<ShieldAlert size={12} />} />
        <KPICard label="In Transit" value={kpis?.in_transit ?? 0} sub="Moving normally" color="blue" icon={<Truck size={12} />} />
        <KPICard label="Value at Risk" value={formatCurrency(kpis?.total_value_at_risk_usd ?? 0)} sub="Disrupted + at-risk" color="danger" icon={<DollarSign size={12} />} />
        <KPICard
          label="Cold Excursions"
          value={kpis?.cold_chain_excursions ?? 0}
          sub="Temp breach events"
          color={kpis?.cold_chain_excursions ? 'danger' : 'ok'}
          icon={<Thermometer size={12} />}
        />
      </div>

      {/* ── Main content grid ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3" style={{ marginBottom: 12 }}>

        {/* Left: status donut */}
        <CT>
          <p className="section-label" style={{ marginBottom: 10 }}>Shipment Status Distribution</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={statusData} dataKey="count" nameKey="status" cx="50%" cy="50%"
                innerRadius={52} outerRadius={82} paddingAngle={2}>
                {statusData.map((entry, i) => (
                  <Cell key={i} fill={STATUS_COLORS[entry.status] || '#4a6180'} />
                ))}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [v, n.replace(/_/g, ' ')]} />
            </PieChart>
          </ResponsiveContainer>
          {/* Legend row */}
          <div className="flex flex-wrap gap-2" style={{ marginTop: 8 }}>
            {statusData.map((d) => (
              <div key={d.status} className="flex items-center gap-1">
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_COLORS[d.status] || '#4a6180', flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{d.status.replace(/_/g, ' ')} ({d.count})</span>
              </div>
            ))}
          </div>
        </CT>

        {/* Middle: risk distribution */}
        <CT>
          <p className="section-label" style={{ marginBottom: 10 }}>Risk Score Distribution</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={riskData} barSize={28}>
              <CartesianGrid strokeDasharray="2 2" stroke="var(--border-subtle)" />
              <XAxis dataKey="range" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: 'var(--text-muted)' }} allowDecimals={false} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [v, 'Shipments']} />
              <Bar dataKey="count" name="Shipments" radius={[3, 3, 0, 0]}>
                {riskData.map((_, i) => (
                  <Cell key={i} fill={['var(--green)','#3b82f6','var(--amber)','var(--orange)','var(--red)'][i] ?? '#3b82f6'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>
            High risk (≥60%): <span style={{ color: 'var(--red)' }}>
              {riskData.filter(d => d.range === '0.6-0.8' || d.range === '0.8-1.0').reduce((a, d) => a + d.count, 0)} shipments
            </span>
          </p>
        </CT>

        {/* Right: active disruptions */}
        <CT>
          <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
            <p className="section-label">Active Disruptions</p>
            <Link href="/disruptions" style={{ fontSize: 10, color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
              Impact cascade <ArrowRight size={10} />
            </Link>
          </div>
          {activeDisruptions.length === 0 ? (
            <div className="flex items-center gap-2" style={{ padding: '16px 0', color: 'var(--green)' }}>
              <CheckCircle2 size={14} /> <span style={{ fontSize: 12 }}>No active disruptions</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {activeDisruptions.map((d: any) => (
                <Link key={d.id} href="/disruptions" style={{ textDecoration: 'none' }}>
                  <div style={{
                    padding: '8px 10px', borderRadius: 5, cursor: 'pointer',
                    background: 'var(--bg-base)', border: '1px solid var(--border-default)',
                    borderLeft: `3px solid ${d.severity === 'critical' ? 'var(--red)' : d.severity === 'high' ? 'var(--orange)' : 'var(--amber)'}`,
                    transition: 'border-color 0.15s',
                  }}>
                    <div className="flex items-center justify-between">
                      <span style={{ fontSize: 10, fontWeight: 700, color: d.severity === 'critical' ? 'var(--red)' : 'var(--orange)', letterSpacing: '0.05em' }}>
                        {d.severity.toUpperCase()} · {d.type.replace(/_/g,' ')}
                      </span>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{d.shipments_affected} shipments</span>
                    </div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginTop: 3, lineHeight: 1.3 }}>
                      {d.title}
                    </p>
                    <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                      {formatCurrency(d.financial_impact_usd)} estimated impact
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Bottom stats */}
          <hr className="divider" style={{ margin: '12px 0' }} />
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Fleet Util', value: `${kpis?.fleet_utilisation_avg_pct ?? 0}%`, color: 'var(--text-primary)' },
              { label: 'Delivered', value: kpis?.delivered ?? 0, color: 'var(--green)' },
              { label: 'Disruptions', value: kpis?.active_disruptions ?? 0, color: 'var(--red)' },
            ].map(m => (
              <div key={m.label} className="text-center" style={{ padding: '4px 0' }}>
                <p style={{ fontSize: 16, fontWeight: 700, color: m.color, letterSpacing: '-0.02em' }}>{m.value}</p>
                <p style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 1 }}>{m.label}</p>
              </div>
            ))}
          </div>
        </CT>
      </div>

      {/* ── Bottom row ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

        {/* Cargo value by category */}
        <CT>
          <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
            <p className="section-label">Cargo Value by Category</p>
            <Link href="/shipments" style={{ fontSize: 10, color: 'var(--accent)', textDecoration: 'none' }}>View shipments →</Link>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={[...categoryData].sort((a, b) => b.value_usd - a.value_usd)} barSize={20}>
              <CartesianGrid strokeDasharray="2 2" stroke="var(--border-subtle)" />
              <XAxis dataKey="category" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1e6).toFixed(0)}M`} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [formatCurrency(v), 'Value']} />
              <Bar dataKey="value_usd" name="Value" radius={[3, 3, 0, 0]}>
                {categoryData.map((_, i) => <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CT>

        {/* Fleet utilisation */}
        <CT>
          <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
            <p className="section-label">Fleet Utilisation</p>
            <Link href="/fleet" style={{ fontSize: 10, color: 'var(--accent)', textDecoration: 'none' }}>Optimise fleet →</Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {fleetData.slice(0, 8).map((v: any, i: number) => {
              const pct = v.utilisation_pct
              const barColor = pct >= 85 ? 'var(--red)' : pct >= 60 ? 'var(--amber)' : 'var(--accent)'
              return (
                <div key={i}>
                  <div className="flex items-center justify-between" style={{ marginBottom: 3 }}>
                    <div className="flex items-center gap-2">
                      <span className="mono" style={{ color: '#60a5fa', fontSize: 10 }}>{v.code}</span>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{v.type.replace(/_/g,' ')}</span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: barColor }} className="mono">{pct}%</span>
                  </div>
                  <div style={{ height: 4, background: 'var(--border-subtle)', borderRadius: 2, overflow: 'hidden' }}>
                    <div className="slide-right" style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 2 }} />
                  </div>
                </div>
              )
            })}
          </div>
        </CT>
      </div>
    </div>
  )
}
