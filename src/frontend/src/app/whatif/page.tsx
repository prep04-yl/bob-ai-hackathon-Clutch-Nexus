'use client'
import { useEffect, useState, useCallback } from 'react'
import { apiClient, type WhatIfResult } from '@/lib/api'
import { cn, formatCurrency } from '@/lib/utils'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  ResponsiveContainer
} from 'recharts'
import { FlaskConical, TrendingDown, Clock, Package, ChevronRight, AlertTriangle, RefreshCw, DollarSign } from 'lucide-react'

interface ScenarioCompare {
  key: string
  name: string
  cost_delta_usd: number
  avg_delay_hours: number
  shipments_recovered: number
  risk_reduction_pct: number
}

const TOOLTIP_STYLE = {
  background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)',
  borderRadius: 5, fontSize: 11, padding: '6px 10px',
}

export default function WhatIfPage() {
  const [scenarios, setScenarios] = useState<ScenarioCompare[]>([])
  const [selected, setSelected] = useState<string>('reroute_jnpt')
  const [result, setResult] = useState<WhatIfResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      apiClient.compareScenarios(),
      apiClient.getScenarioResult('reroute_jnpt'),
    ]).then(([c, r]) => {
      setScenarios(c.data)
      setResult(r.data)
      setLoading(false)
    }).catch((err) => {
      setError(err?.message || 'Failed to load scenarios')
      setLoading(false)
    })
  }, [])

  useEffect(() => { load() }, [load])

  const loadScenario = (key: string) => {
    setSelected(key)
    setDetailLoading(true)
    apiClient.getScenarioResult(key).then((r) => {
      setResult(r.data)
      setDetailLoading(false)
    }).catch(() => setDetailLoading(false))
  }

  const bestScenario = scenarios.reduce<ScenarioCompare | null>((best, s) => {
    if (!best || s.risk_reduction_pct > best.risk_reduction_pct) return s
    return best
  }, null)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div style={{ width: 32, height: 32, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center" style={{ maxWidth: 360 }}>
          <AlertTriangle size={36} style={{ color: 'var(--red)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 6 }}>Could not load scenarios</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>{error}</p>
          <button onClick={load} className="btn-primary mx-auto"><RefreshCw size={12} /> Retry</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: 20 }} className="fade-in">
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 3 }}>SCENARIO SIMULATOR</h1>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {scenarios.length} recovery scenarios · Mumbai Port closure
          </p>
        </div>
        <button onClick={load} className="btn-ghost"><RefreshCw size={13} /></button>
      </div>

      {/* Best scenario callout */}
      {bestScenario && (
        <div className="card" style={{ padding: '10px 14px', marginBottom: 12, borderColor: 'rgba(38,217,142,0.25)', background: 'rgba(38,217,142,0.04)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 6, background: 'rgba(38,217,142,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <TrendingDown size={15} style={{ color: 'var(--green)' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Best risk reduction scenario</p>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginTop: 1 }}>{bestScenario.name}</p>
          </div>
          <div className="text-right" style={{ flexShrink: 0 }}>
            <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--green)', letterSpacing: '-0.03em' }}>{bestScenario.risk_reduction_pct}%</p>
            <p style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>RISK REDUCTION</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Scenario list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <p className="section-label" style={{ padding: '0 2px 4px' }}>Scenarios ({scenarios.length})</p>
          {scenarios.map((s, i) => (
            <button
              key={s.key}
              onClick={() => loadScenario(s.key)}
              style={{
                width: '100%', textAlign: 'left',
                background: selected === s.key ? 'var(--bg-active)' : 'var(--bg-elevated)',
                border: `1px solid ${selected === s.key ? 'var(--accent)' : 'var(--border-default)'}`,
                borderRadius: 6, padding: '9px 12px', cursor: 'pointer',
                transition: 'background 0.15s, border-color 0.15s',
              }}
            >
              <div className="flex items-center gap-2" style={{ marginBottom: 5 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: selected === s.key ? 'var(--accent)' : 'var(--text-muted)' }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', flex: 1, lineHeight: 1.3 }}>{s.name}</p>
                {bestScenario?.key === s.key && (
                  <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--green)', background: 'rgba(38,217,142,0.15)', padding: '1px 5px', borderRadius: 3, letterSpacing: '0.06em' }}>
                    BEST
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1" style={{ fontSize: 10 }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Cost Δ</span>
                  <span style={{ marginLeft: 4, color: s.cost_delta_usd > 0 ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>
                    {s.cost_delta_usd > 0 ? '+' : ''}{formatCurrency(s.cost_delta_usd)}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Delay</span>
                  <span style={{ marginLeft: 4, color: s.avg_delay_hours <= 24 ? 'var(--green)' : s.avg_delay_hours <= 72 ? 'var(--amber)' : 'var(--orange)', fontWeight: 600 }}>
                    {s.avg_delay_hours}h
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Recovered</span>
                  <span style={{ marginLeft: 4, color: 'var(--green)', fontWeight: 600 }}>{s.shipments_recovered}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Risk ↓</span>
                  <span style={{ marginLeft: 4, color: '#60a5fa', fontWeight: 600 }}>{s.risk_reduction_pct}%</span>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Detail */}
        <div className="lg:col-span-2" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Comparison charts */}
          <div className="grid grid-cols-2 gap-3">
            <div className="card" style={{ padding: '12px 14px' }}>
              <p className="section-label" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                <DollarSign size={9} /> Cost Delta (USD)
              </p>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={scenarios} barSize={14} layout="vertical">
                  <CartesianGrid strokeDasharray="2 2" stroke="var(--border-subtle)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 8, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}K`} />
                  <YAxis type="category" dataKey="key" tick={{ fontSize: 8, fill: 'var(--text-muted)' }} width={70} axisLine={false} tickLine={false}
                    tickFormatter={(v) => v.replace(/_/g,' ').substring(0,10)} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [formatCurrency(v), 'Cost Delta']} labelFormatter={(l) => scenarios.find(s => s.key === l)?.name || l} />
                  <Bar dataKey="cost_delta_usd" radius={[0, 3, 3, 0]}>
                    {scenarios.map((s, i) => <Cell key={i} fill={selected === s.key ? 'var(--accent)' : 'rgba(30,126,248,0.3)'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card" style={{ padding: '12px 14px' }}>
              <p className="section-label" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                <TrendingDown size={9} /> Risk Reduction (%)
              </p>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={scenarios} barSize={14} layout="vertical">
                  <CartesianGrid strokeDasharray="2 2" stroke="var(--border-subtle)" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 8, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} unit="%" />
                  <YAxis type="category" dataKey="key" tick={{ fontSize: 8, fill: 'var(--text-muted)' }} width={70} axisLine={false} tickLine={false}
                    tickFormatter={(v) => v.replace(/_/g,' ').substring(0,10)} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${v}%`, 'Risk Reduction']} labelFormatter={(l) => scenarios.find(s => s.key === l)?.name || l} />
                  <Bar dataKey="risk_reduction_pct" radius={[0, 3, 3, 0]}>
                    {scenarios.map((s, i) => <Cell key={i} fill={selected === s.key ? 'var(--green)' : 'rgba(38,217,142,0.3)'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Selected scenario detail */}
          {detailLoading ? (
            <div className="card flex items-center justify-center" style={{ height: 100 }}>
              <div style={{ width: 18, height: 18, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginRight: 8 }} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading scenario…</span>
            </div>
          ) : result ? (
            <div className="card" style={{ padding: '12px 14px' }}>
              <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
                <FlaskConical size={13} style={{ color: 'var(--accent)' }} />
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{result.scenario_name}</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" style={{ marginBottom: 14 }}>
                {[
                  { label: 'Additional Cost', value: formatCurrency(result.total_cost_delta_usd), color: result.total_cost_delta_usd > 1e6 ? 'var(--red)' : result.total_cost_delta_usd > 0 ? 'var(--orange)' : 'var(--green)' },
                  { label: 'Avg Delay', value: `${result.avg_delay_hours}h`, color: result.avg_delay_hours <= 24 ? 'var(--green)' : result.avg_delay_hours <= 72 ? 'var(--amber)' : 'var(--orange)' },
                  { label: 'Recovered', value: result.shipments_recovered, color: 'var(--green)' },
                  { label: 'Risk Reduction', value: `${result.risk_reduction_pct}%`, color: result.risk_reduction_pct >= 50 ? 'var(--green)' : '#60a5fa' },
                ].map((m) => (
                  <div key={m.label} className="inset" style={{ padding: '8px 10px' }}>
                    <p style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{m.label}</p>
                    <p style={{ fontSize: 18, fontWeight: 700, color: m.color, marginTop: 4, letterSpacing: '-0.02em' }}>{m.value}</p>
                  </div>
                ))}
              </div>

              {result.recommendations.length > 0 && (
                <div>
                  <p className="section-label" style={{ marginBottom: 8 }}>
                    Shipment Actions — {result.recommendations.length} records
                  </p>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Tracking ID</th><th>Description</th><th>P</th>
                          <th>Status</th><th>Recommended Action</th><th>Extra Days</th><th>Extra Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.recommendations.map((r, i) => (
                          <tr key={i}>
                            <td><span className="mono" style={{ color: '#60a5fa' }}>{r.tracking_id}</span></td>
                            <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>{r.description}</td>
                            <td>
                              <span style={{ fontWeight: 700, fontSize: 10, color: r.priority === 1 ? 'var(--red)' : 'var(--orange)' }}>P{r.priority}</span>
                            </td>
                            <td style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>{r.current_status.replace(/_/g,' ')}</td>
                            <td style={{ color: 'var(--text-primary)' }}>{r.action}</td>
                            <td>
                              <span className="mono" style={{ color: r.extra_days < 0 ? 'var(--green)' : r.extra_days > 3 ? 'var(--red)' : 'var(--amber)' }}>
                                {r.extra_days > 0 ? '+' : ''}{r.extra_days}d
                              </span>
                            </td>
                            <td>
                              <span className="mono" style={{ color: r.extra_cost_usd > 100000 ? 'var(--orange)' : r.extra_cost_usd > 0 ? 'var(--amber)' : 'var(--text-muted)' }}>
                                {r.extra_cost_usd > 0 ? formatCurrency(r.extra_cost_usd) : '—'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
