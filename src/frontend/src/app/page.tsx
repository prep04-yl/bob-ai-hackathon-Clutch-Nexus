'use client'
import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer, Legend
} from 'recharts'
import { AlertTriangle, Package, Truck, Thermometer, TrendingUp, DollarSign } from 'lucide-react'
import { apiClient, type DashboardKPIs } from '@/lib/api'
import KPICard from '@/components/KPICard'
import { formatCurrency, formatNumber, statusColor, severityColor } from '@/lib/utils'
import { cn } from '@/lib/utils'

const STATUS_COLORS: Record<string, string> = {
  disrupted: '#ef4444',
  at_risk: '#f97316',
  delayed: '#eab308',
  in_transit: '#3b82f6',
  scheduled: '#64748b',
  delivered: '#22c55e',
}

const CATEGORY_COLORS = ['#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#84cc16']

export default function DashboardPage() {
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null)
  const [statusData, setStatusData] = useState<any[]>([])
  const [categoryData, setCategoryData] = useState<any[]>([])
  const [riskData, setRiskData] = useState<any[]>([])
  const [fleetData, setFleetData] = useState<any[]>([])
  const [disruptions, setDisruptions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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
    })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Loading dashboard…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Supply Chain Command Center</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Mumbai Port Trust — Partial Closure (Berths 1–8) · Active
          </p>
        </div>
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-red-400 text-xs font-semibold">CRITICAL DISRUPTION ACTIVE</span>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        <KPICard
          label="Total Shipments"
          value={kpis?.total_shipments ?? 0}
          sub="Active tracking"
          icon={<Package size={14} />}
        />
        <KPICard
          label="Disrupted"
          value={kpis?.disrupted ?? 0}
          sub="Port closure impact"
          color="danger"
          pulse
          icon={<AlertTriangle size={14} />}
        />
        <KPICard
          label="At Risk"
          value={kpis?.at_risk ?? 0}
          sub="Escalation possible"
          color="warn"
          icon={<TrendingUp size={14} />}
        />
        <KPICard
          label="Value at Risk"
          value={formatCurrency(kpis?.total_value_at_risk_usd ?? 0)}
          sub="Disrupted + at-risk"
          color="danger"
          icon={<DollarSign size={14} />}
        />
        <KPICard
          label="Fleet Utilisation"
          value={`${kpis?.fleet_utilisation_avg_pct ?? 0}%`}
          sub="Avg across fleet"
          color="blue"
          icon={<Truck size={14} />}
        />
        <KPICard
          label="Cold Excursions"
          value={kpis?.cold_chain_excursions ?? 0}
          sub="Temp breach events"
          color={kpis?.cold_chain_excursions ? 'danger' : 'ok'}
          icon={<Thermometer size={14} />}
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Shipment status donut */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Shipment Status</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={statusData}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={2}
              >
                {statusData.map((entry, i) => (
                  <Cell key={i} fill={STATUS_COLORS[entry.status] || '#64748b'} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: 12 }}
                formatter={(v: number, n: string) => [v, n.replace('_', ' ')]}
              />
              <Legend
                formatter={(v) => <span style={{ fontSize: 11, color: '#94a3b8' }}>{v.replace('_', ' ')}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Risk distribution */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Risk Score Distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={riskData} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="range" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: 12 }}
              />
              <Bar dataKey="count" name="Shipments" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                {riskData.map((_, i) => (
                  <Cell
                    key={i}
                    fill={['#22c55e', '#3b82f6', '#eab308', '#f97316', '#ef4444'][i] || '#3b82f6'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Fleet utilisation */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Fleet Utilisation</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={fleetData.slice(0, 8)} layout="vertical" barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} unit="%" />
              <YAxis type="category" dataKey="code" tick={{ fontSize: 9, fill: '#64748b' }} width={90} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: 12 }}
                formatter={(v: number) => [`${v}%`, 'Utilisation']}
              />
              <Bar dataKey="utilisation_pct" name="Utilisation" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                {fleetData.slice(0, 8).map((v: any, i: number) => (
                  <Cell key={i} fill={v.utilisation_pct >= 85 ? '#ef4444' : v.utilisation_pct >= 60 ? '#f59e0b' : '#3b82f6'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Category value */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Cargo Value by Category</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={categoryData.sort((a, b) => b.value_usd - a.value_usd)} barSize={24}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="category" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v) => `$${(v / 1_000_000).toFixed(0)}M`} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: 12 }}
                formatter={(v: number) => [formatCurrency(v), 'Value']}
              />
              <Bar dataKey="value_usd" name="Value" radius={[4, 4, 0, 0]}>
                {categoryData.map((_, i) => (
                  <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Active disruptions */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Active Disruptions</h3>
          <div className="space-y-2.5">
            {disruptions.filter((d: any) => d.is_active).map((d: any) => (
              <div key={d.id} className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <div className={cn('mt-0.5 px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap', severityColor(d.severity))}>
                  {d.severity.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-200 truncate">{d.title}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {d.shipments_affected} shipments · {formatCurrency(d.financial_impact_usd)} impact
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
