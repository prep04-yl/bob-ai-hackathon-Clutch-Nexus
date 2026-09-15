'use client'
import { useEffect, useState, useCallback } from 'react'
import { apiClient, type Disruption, type AIResponse } from '@/lib/api'
import { cn, formatCurrency } from '@/lib/utils'
import { AlertTriangle, ChevronRight, Clock, Package, DollarSign, Sparkles, Loader2, RefreshCw, ArrowRight, Thermometer } from 'lucide-react'
import { format } from 'date-fns'

const SEV_COLORS: Record<string, string> = {
  critical: 'var(--red)',
  high: 'var(--orange)',
  medium: 'var(--amber)',
  low: 'var(--green)',
}

const TYPE_ICON: Record<string, string> = {
  port_closure: '⚓', weather: '🌪', strike: '✊', geopolitical: '🌍', equipment_failure: '⚙️',
}

const TOOLTIP_STYLE = {
  background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)',
  borderRadius: 5, fontSize: 11, padding: '6px 10px',
}

export default function DisruptionsPage() {
  const [disruptions, setDisruptions] = useState<Disruption[]>([])
  const [selected, setSelected] = useState<Disruption | null>(null)
  const [impact, setImpact] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [aiExplanation, setAiExplanation] = useState<AIResponse | null>(null)
  const [aiActions, setAiActions] = useState<AIResponse | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    apiClient.getDisruptions().then((r) => {
      setDisruptions(r.data)
      if (r.data.length > 0) handleSelect(r.data[0])
      setLoading(false)
    }).catch((err) => {
      setError(err?.message || 'Failed to load disruptions')
      setLoading(false)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  const handleSelect = (d: Disruption) => {
    setSelected(d)
    setImpact(null)
    setAiExplanation(null)
    setAiActions(null)
    apiClient.getDisruptionImpact(d.id).then((r) => setImpact(r.data))
  }

  const runAI = () => {
    if (!selected) return
    setAiLoading(true)
    setAiExplanation(null)
    setAiActions(null)
    Promise.all([
      apiClient.explainDisruption(selected.id),
      apiClient.recommendActions(selected.id),
    ]).then(([exp, rec]) => {
      setAiExplanation(exp.data)
      setAiActions(rec.data)
      setAiLoading(false)
    }).catch(() => setAiLoading(false))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div style={{ width: 32, height: 32, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading disruptions…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center" style={{ maxWidth: 360 }}>
          <AlertTriangle size={36} style={{ color: 'var(--red)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 6 }}>Failed to load disruptions</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>{error}</p>
          <button onClick={load} className="btn-primary mx-auto"><RefreshCw size={12} /> Retry</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: 20 }} className="fade-in">
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
        <div>
          <div className="flex items-center gap-2" style={{ marginBottom: 3 }}>
            <span className="pulse-red" />
            <h1 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>DISRUPTION MONITOR</h1>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {disruptions.filter(d => d.is_active).length} active · Impact cascade analysis
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selected && (
            <button onClick={runAI} disabled={aiLoading} className="btn-primary">
              {aiLoading ? <><Loader2 size={12} className="animate-spin" /> Analysing…</> : <><Sparkles size={12} /> AI Analysis</>}
            </button>
          )}
          <button onClick={load} className="btn-ghost"><RefreshCw size={13} /></button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        {/* Incident list */}
        <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p className="section-label" style={{ padding: '0 2px 4px' }}>Incidents ({disruptions.length})</p>
          {disruptions.map((d) => {
            const isActive = d.is_active
            const sevColor = SEV_COLORS[d.severity] || 'var(--text-muted)'
            return (
              <button
                key={d.id}
                onClick={() => handleSelect(d)}
                style={{
                  width: '100%', textAlign: 'left',
                  background: selected?.id === d.id ? 'var(--bg-active)' : 'var(--bg-elevated)',
                  border: `1px solid ${selected?.id === d.id ? 'var(--accent)' : 'var(--border-default)'}`,
                  borderLeft: `3px solid ${sevColor}`,
                  borderRadius: 6, padding: '10px 12px', cursor: 'pointer',
                  transition: 'background 0.15s, border-color 0.15s',
                }}
              >
                <div className="flex items-start gap-2">
                  <span style={{ fontSize: 16, marginTop: 1, flexShrink: 0 }}>{TYPE_ICON[d.type] || '⚠️'}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="flex items-center gap-1.5" style={{ marginBottom: 3 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: sevColor, letterSpacing: '0.06em' }}>
                        {d.severity.toUpperCase()}
                      </span>
                      {isActive && <span className="pulse-red" style={{ width: 5, height: 5 }} />}
                      {!isActive && <span style={{ fontSize: 9, color: 'var(--green)', fontWeight: 600 }}>RESOLVED</span>}
                    </div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>{d.title}</p>
                    <div className="flex items-center gap-2" style={{ marginTop: 4, fontSize: 10, color: 'var(--text-muted)' }}>
                      <span>{d.shipments_affected} ships</span>
                      <span>·</span>
                      <span>{formatCurrency(d.financial_impact_usd)}</span>
                    </div>
                  </div>
                  <ChevronRight size={12} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }} />
                </div>
              </button>
            )
          })}
        </div>

        {/* Detail pane */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {selected && (
            <>
              {/* Incident header */}
              <div className="card" style={{ padding: '14px 16px' }}>
                <div className="flex items-start gap-3">
                  <span style={{ fontSize: 28, lineHeight: 1 }}>{TYPE_ICON[selected.type] || '⚠️'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 6 }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', padding: '2px 8px',
                        borderRadius: 3, fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
                        background: `${SEV_COLORS[selected.severity]}1a`,
                        color: SEV_COLORS[selected.severity],
                        border: `1px solid ${SEV_COLORS[selected.severity]}44`,
                      }}>
                        {selected.severity.toUpperCase()}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                        {selected.type.replace(/_/g, ' ')}
                      </span>
                      {selected.is_active && (
                        <span className="flex items-center gap-1" style={{ fontSize: 10, color: 'var(--red)', fontWeight: 600 }}>
                          <span className="pulse-red" style={{ width: 5, height: 5 }} /> ACTIVE
                        </span>
                      )}
                    </div>
                    <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{selected.title}</h2>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{selected.description}</p>
                    <div className="flex flex-wrap gap-4" style={{ marginTop: 10, fontSize: 10, color: 'var(--text-muted)' }}>
                      <span className="flex items-center gap-1">
                        <Clock size={10} /> Started: {format(new Date(selected.started_at), 'dd MMM yyyy HH:mm')}
                      </span>
                      {selected.estimated_end && (
                        <span className="flex items-center gap-1">
                          <Clock size={10} /> Est. resolution: {format(new Date(selected.estimated_end), 'dd MMM yyyy HH:mm')}
                        </span>
                      )}
                      {selected.affected_port && (
                        <span className="flex items-center gap-1" style={{ color: 'var(--red)' }}>
                          <AlertTriangle size={10} /> {selected.affected_port.name} ({selected.affected_port.code})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right" style={{ flexShrink: 0 }}>
                    <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--red)', letterSpacing: '-0.02em' }}>
                      {formatCurrency(selected.financial_impact_usd)}
                    </p>
                    <p style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Est. impact</p>
                  </div>
                </div>
              </div>

              {/* Impact cascade */}
              {impact ? (
                <>
                  {/* Cascade flow visualization */}
                  <div className="card" style={{ padding: '14px 16px' }}>
                    <p className="section-label" style={{ marginBottom: 12 }}>Impact Cascade</p>
                    
                    {/* Cascade flow: Disruption → Shipments → Routes → Vehicles → Risk */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, overflowX: 'auto' }}>
                      {[
                        { label: 'Disruption', value: '1', color: 'var(--red)', icon: '⚓' },
                        { label: 'Shipments', value: impact.cascade.affected_shipments_count, color: 'var(--orange)', icon: '📦' },
                        { label: 'Routes', value: impact.cascade.affected_routes_count, color: 'var(--amber)', icon: '🔀' },
                        { label: 'Vehicles', value: impact.cascade.affected_vehicles_count, color: '#60a5fa', icon: '🚢' },
                      ].map((step, i) => (
                        <div key={i} className="flex items-center gap-2" style={{ flexShrink: 0 }}>
                          <div style={{
                            padding: '8px 14px', borderRadius: 6, textAlign: 'center', minWidth: 80,
                            background: `${step.color}18`, border: `1px solid ${step.color}44`,
                          }}>
                            <p style={{ fontSize: 18, marginBottom: 2 }}>{step.icon}</p>
                            <p style={{ fontSize: 18, fontWeight: 700, color: step.color, lineHeight: 1 }}>{step.value}</p>
                            <p style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 3, letterSpacing: '0.04em' }}>{step.label}</p>
                          </div>
                          {i < 3 && <ArrowRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                        </div>
                      ))}
                      <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 12, borderLeft: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                        <div>
                          <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>Avg Risk Score</p>
                          <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--red)', letterSpacing: '-0.02em' }}>
                            {(impact.cascade.avg_risk_score * 100).toFixed(0)}%
                          </p>
                        </div>
                        <div>
                          <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>Cold Chain at Risk</p>
                          <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--cyan)', letterSpacing: '-0.02em' }}>
                            {impact.cascade.cold_chain_shipments_at_risk}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Cascade metrics grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { label: 'Cargo Value', value: formatCurrency(impact.cascade.total_cargo_value_usd), color: 'var(--orange)' },
                        { label: 'Critical (P1)', value: impact.cascade.critical_shipments_count, color: 'var(--red)' },
                        { label: 'Total Weight', value: `${impact.cascade.total_weight_tonnes.toLocaleString()}t`, color: 'var(--text-secondary)' },
                        { label: 'Cold Chain', value: impact.cascade.cold_chain_shipments_at_risk, color: 'var(--cyan)' },
                      ].map((m) => (
                        <div key={m.label} className="inset" style={{ padding: '8px 10px' }}>
                          <p style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{m.label}</p>
                          <p style={{ fontSize: 16, fontWeight: 700, color: m.color, marginTop: 4, letterSpacing: '-0.02em' }}>{m.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Affected shipments table */}
                  <div className="card" style={{ padding: '14px 16px' }}>
                    <p className="section-label" style={{ marginBottom: 12 }}>
                      Affected Shipments — {impact.shipments.length} records
                    </p>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Tracking ID</th>
                            <th>Description</th>
                            <th>Cat</th>
                            <th>Status</th>
                            <th>P</th>
                            <th>Risk</th>
                            <th>Value</th>
                            <th>Delay</th>
                          </tr>
                        </thead>
                        <tbody>
                          {impact.shipments.map((s: any) => {
                            const riskPct = Math.round(s.risk_score * 100)
                            const riskColor = riskPct >= 80 ? 'var(--red)' : riskPct >= 60 ? 'var(--orange)' : 'var(--amber)'
                            return (
                              <tr key={s.id}>
                                <td>
                                  <span className="mono" style={{ color: '#60a5fa' }}>{s.tracking_id}</span>
                                  {s.requires_cold_chain && <span style={{ marginLeft: 4, color: 'var(--cyan)', fontSize: 9 }}>❄</span>}
                                </td>
                                <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                                  {s.description}
                                </td>
                                <td style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>{s.category}</td>
                                <td>
                                  <span style={{ fontSize: 10, fontWeight: 600, color: s.status === 'disrupted' ? 'var(--red)' : 'var(--orange)' }}>
                                    {s.status}
                                  </span>
                                </td>
                                <td>
                                  <span style={{ fontWeight: 700, fontSize: 10, color: s.priority === 1 ? 'var(--red)' : 'var(--orange)' }}>P{s.priority}</span>
                                </td>
                                <td>
                                  <div className="flex items-center gap-1.5">
                                    <div style={{ width: 28, height: 3, background: 'var(--border-subtle)', borderRadius: 2, overflow: 'hidden' }}>
                                      <div style={{ width: `${riskPct}%`, height: '100%', background: riskColor }} />
                                    </div>
                                    <span className="mono" style={{ color: riskColor }}>{riskPct}%</span>
                                  </div>
                                </td>
                                <td><span className="mono">{formatCurrency(s.value_usd)}</span></td>
                                <td><span className="mono" style={{ color: 'var(--amber)' }}>+{s.delay_hours}h</span></td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="card flex items-center justify-center" style={{ height: 120 }}>
                  <div style={{ width: 18, height: 18, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginRight: 8 }} />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading impact analysis…</span>
                </div>
              )}

              {/* AI panels */}
              {(aiExplanation || aiActions) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {aiExplanation && (
                    <div className="card" style={{ padding: '14px 16px', borderColor: 'rgba(139,92,246,0.3)', background: 'rgba(139,92,246,0.04)' }}>
                      <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                        <Sparkles size={12} style={{ color: '#a78bfa' }} />
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#a78bfa', letterSpacing: '0.06em' }}>AI EXECUTIVE SUMMARY</span>
                        <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {!aiExplanation.fallback ? 'Google Gemini · gemini-3.6-flash' : aiExplanation.configured ? 'Rule-based (Gemini error — check key)' : 'Rule-based (add GEMINI_API_KEY)'}
                        </span>
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{aiExplanation.text}</p>
                    </div>
                  )}
                  {aiActions && (
                    <div className="card" style={{ padding: '14px 16px', borderColor: 'rgba(139,92,246,0.3)', background: 'rgba(139,92,246,0.04)' }}>
                      <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                        <Sparkles size={12} style={{ color: '#a78bfa' }} />
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#a78bfa', letterSpacing: '0.06em' }}>RECOVERY RECOMMENDATIONS</span>
                      </div>
                      <pre style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{aiActions.text}</pre>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
