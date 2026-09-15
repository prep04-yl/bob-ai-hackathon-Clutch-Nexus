'use client'
import { useEffect, useState } from 'react'
import { apiClient, type WhatIfResult } from '@/lib/api'
import { cn, formatCurrency } from '@/lib/utils'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer
} from 'recharts'
import { FlaskConical, TrendingDown, Clock, Package, ChevronRight } from 'lucide-react'

interface ScenarioCompare {
  key: string
  name: string
  cost_delta_usd: number
  avg_delay_hours: number
  shipments_recovered: number
  risk_reduction_pct: number
}

const SCENARIO_COLORS = ['#ef4444', '#3b82f6', '#8b5cf6', '#f59e0b', '#22c55e', '#ec4899']

export default function WhatIfPage() {
  const [scenarios, setScenarios] = useState<ScenarioCompare[]>([])
  const [selected, setSelected] = useState<string>('reroute_jnpt')
  const [result, setResult] = useState<WhatIfResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    apiClient.compareScenarios().then((r) => {
      setScenarios(r.data)
      setLoading(false)
    })
    loadScenario('reroute_jnpt')
  }, [])

  const loadScenario = (key: string) => {
    setSelected(key)
    setDetailLoading(true)
    apiClient.getScenarioResult(key).then((r) => {
      setResult(r.data)
      setDetailLoading(false)
    })
  }

  const radarData = scenarios.map((s) => ({
    scenario: s.name.split('(')[0].trim().substring(0, 16),
    cost: Math.max(0, 100 - (s.cost_delta_usd / 4_000_000) * 100),
    speed: Math.max(0, 100 - (s.avg_delay_hours / 120) * 100),
    recovery: s.shipments_recovered * 5,
    risk: s.risk_reduction_pct,
  }))

  const priorityColor = (p: number) => {
    const m: Record<number, string> = { 1: 'text-red-400', 2: 'text-orange-400', 3: 'text-blue-400', 4: 'text-slate-400' }
    return m[p] || 'text-slate-400'
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">What-If Simulator</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Compare recovery scenarios for Mumbai Port closure disruption
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Scenario selector */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">Scenarios</h3>
          {scenarios.map((s, i) => (
            <button
              key={s.key}
              onClick={() => loadScenario(s.key)}
              className={cn(
                'w-full text-left card p-3.5 transition-all hover:border-slate-700',
                selected === s.key && 'border-blue-600/50 bg-blue-600/5'
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  style={{ background: SCENARIO_COLORS[i % SCENARIO_COLORS.length] }}
                  className="w-2 h-2 rounded-full shrink-0"
                />
                <p className="text-xs font-medium text-slate-200 ml-2 flex-1 leading-snug">{s.name}</p>
                <ChevronRight size={12} className="text-slate-600 shrink-0" />
              </div>
              <div className="grid grid-cols-2 gap-1.5 mt-2.5 text-[10px]">
                <div>
                  <span className="text-slate-600">Cost Δ</span>
                  <span className={cn('ml-1', s.cost_delta_usd > 0 ? 'text-red-400' : 'text-green-400')}>
                    {s.cost_delta_usd > 0 ? '+' : ''}{formatCurrency(s.cost_delta_usd)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-600">Delay</span>
                  <span className="text-yellow-400 ml-1">{s.avg_delay_hours}h</span>
                </div>
                <div>
                  <span className="text-slate-600">Recovered</span>
                  <span className="text-green-400 ml-1">{s.shipments_recovered}</span>
                </div>
                <div>
                  <span className="text-slate-600">Risk ↓</span>
                  <span className="text-blue-400 ml-1">{s.risk_reduction_pct}%</span>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Detail */}
        <div className="lg:col-span-2 space-y-4">
          {/* Comparison bar charts */}
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-4">
              <h3 className="text-xs font-semibold text-slate-400 mb-3">Cost Delta (USD)</h3>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={scenarios} barSize={20} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                  <YAxis type="category" dataKey="key" tick={{ fontSize: 9, fill: '#64748b' }} width={80}
                    tickFormatter={(v) => v.replace('_', ' ').substring(0, 12)} />
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: 11 }}
                    formatter={(v: number) => [formatCurrency(v), 'Cost Delta']}
                    labelFormatter={(l) => scenarios.find(s => s.key === l)?.name || l}
                  />
                  <Bar dataKey="cost_delta_usd" radius={[0, 4, 4, 0]}>
                    {scenarios.map((s, i) => (
                      <Cell key={i} fill={selected === s.key ? '#3b82f6' : '#1e40af'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card p-4">
              <h3 className="text-xs font-semibold text-slate-400 mb-3">Risk Reduction (%)</h3>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={scenarios} barSize={20} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 9, fill: '#64748b' }} unit="%" />
                  <YAxis type="category" dataKey="key" tick={{ fontSize: 9, fill: '#64748b' }} width={80}
                    tickFormatter={(v) => v.replace('_', ' ').substring(0, 12)} />
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: 11 }}
                    formatter={(v: number) => [`${v}%`, 'Risk Reduction']}
                    labelFormatter={(l) => scenarios.find(s => s.key === l)?.name || l}
                  />
                  <Bar dataKey="risk_reduction_pct" radius={[0, 4, 4, 0]}>
                    {scenarios.map((s, i) => (
                      <Cell key={i} fill={selected === s.key ? '#22c55e' : '#166534'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Selected scenario detail */}
          {result && !detailLoading && (
            <div className="card p-4 space-y-4">
              <div className="flex items-center gap-3">
                <FlaskConical size={16} className="text-blue-400" />
                <h3 className="text-sm font-semibold text-slate-200">{result.scenario_name}</h3>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Additional Cost', value: formatCurrency(result.total_cost_delta_usd), icon: <TrendingDown size={13} />, color: result.total_cost_delta_usd > 0 ? 'text-red-400' : 'text-green-400' },
                  { label: 'Avg Delay', value: `${result.avg_delay_hours}h`, icon: <Clock size={13} />, color: result.avg_delay_hours > 72 ? 'text-orange-400' : 'text-green-400' },
                  { label: 'Recovered', value: result.shipments_recovered, icon: <Package size={13} />, color: 'text-green-400' },
                  { label: 'Risk Reduction', value: `${result.risk_reduction_pct}%`, icon: <TrendingDown size={13} />, color: 'text-blue-400' },
                ].map((m) => (
                  <div key={m.label} className="bg-slate-800/50 rounded-lg p-3">
                    <div className="flex items-center gap-1 text-slate-500 text-[11px] mb-1">
                      {m.icon} {m.label}
                    </div>
                    <p className={cn('text-lg font-bold', m.color)}>{m.value}</p>
                  </div>
                ))}
              </div>

              {/* Per-shipment recommendations */}
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Shipment-Level Actions
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-slate-500 border-b border-slate-800">
                        <th className="pb-2 pr-4">Tracking ID</th>
                        <th className="pb-2 pr-4">Description</th>
                        <th className="pb-2 pr-4">P</th>
                        <th className="pb-2 pr-4">Current Status</th>
                        <th className="pb-2 pr-4">Recommended Action</th>
                        <th className="pb-2 pr-4">Extra Days</th>
                        <th className="pb-2 pr-4">Extra Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {result.recommendations.map((r, i) => (
                        <tr key={i}>
                          <td className="py-2.5 pr-4 font-mono text-blue-400">{r.tracking_id}</td>
                          <td className="py-2.5 pr-4 text-slate-300 max-w-[160px] truncate">{r.description}</td>
                          <td className={cn('py-2.5 pr-4 font-bold', priorityColor(r.priority))}>P{r.priority}</td>
                          <td className="py-2.5 pr-4 text-slate-400 capitalize">{r.current_status.replace('_', ' ')}</td>
                          <td className="py-2.5 pr-4 text-slate-200">{r.action}</td>
                          <td className={cn('py-2.5 pr-4 font-mono', r.extra_days < 0 ? 'text-green-400' : r.extra_days > 3 ? 'text-red-400' : 'text-yellow-400')}>
                            {r.extra_days > 0 ? '+' : ''}{r.extra_days}d
                          </td>
                          <td className={cn('py-2.5 pr-4 font-mono', r.extra_cost_usd > 0 ? 'text-orange-400' : 'text-slate-500')}>
                            {r.extra_cost_usd > 0 ? formatCurrency(r.extra_cost_usd) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {detailLoading && (
            <div className="card p-8 flex items-center justify-center text-slate-500 text-sm">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2" />
              Loading scenario…
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
