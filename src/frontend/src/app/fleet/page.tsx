'use client'
import { useEffect, useState, useCallback } from 'react'
import { apiClient, type Vehicle } from '@/lib/api'
import { cn, formatNumber } from '@/lib/utils'
import { Truck, Thermometer, Zap, AlertTriangle, RefreshCw, ChevronDown } from 'lucide-react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Legend
} from 'recharts'

const TYPE_ICONS: Record<string, string> = {
  container_ship: '🚢', truck: '🚛', train: '🚂', aircraft: '✈️',
}
const UTIL_COLOR = (p: number) => p >= 85 ? 'var(--red)' : p >= 60 ? 'var(--amber)' : 'var(--accent)'
const STATUS_COLOR: Record<string, string> = {
  available: 'var(--green)', in_transit: '#60a5fa', maintenance: 'var(--text-muted)', stranded: 'var(--red)',
}

export default function FleetPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [recommendations, setRecommendations] = useState<any[]>([])
  const [disruptions, setDisruptions] = useState<any[]>([])
  const [selectedDisruption, setSelectedDisruption] = useState<number>(1)
  const [optimising, setOptimising] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [objective, setObjective] = useState('minimize_delay')

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      apiClient.getFleet(),
      apiClient.getFleetSummary(),
      apiClient.getDisruptions(),
    ]).then(([v, s, d]) => {
      setVehicles(v.data)
      setSummary(s.data)
      const active = d.data.filter((dis: any) => dis.is_active)
      setDisruptions(active)
      const firstId = active[0]?.id ?? 1
      setSelectedDisruption(firstId)
      return apiClient.getFleetRecommendations(firstId)
    }).then((r) => {
      setRecommendations(r.data)
      setLoading(false)
    }).catch((err) => {
      setError(err?.message || 'Failed to load fleet data')
      setLoading(false)
    })
  }, [])

  useEffect(() => { load() }, [load])

  const runOptimise = () => {
    setOptimising(true)
    apiClient.optimiseFleet(selectedDisruption, objective)
      .then(() => apiClient.getFleetRecommendations(selectedDisruption))
      .then((r) => { setRecommendations(r.data); setOptimising(false) })
      .catch(() => setOptimising(false))
  }

  const handleDisruptionChange = (id: number) => {
    setSelectedDisruption(id)
    apiClient.getFleetRecommendations(id).then((r) => setRecommendations(r.data))
  }

  const summaryRadar = summary
    ? Object.entries(summary).map(([type, d]: [string, any]) => ({
        type: type.replace(/_/g, ' '),
        utilisation: d.avg_utilisation,
        availability: Math.round((d.available / Math.max(d.count, 1)) * 100),
        coldChain: Math.round((d.cold_chain / Math.max(d.count, 1)) * 100),
      }))
    : []

  const solverTag = (() => {
    const first = recommendations[0]
    if (!first) return 'Pyomo + HiGHS'
    const match = first.rationale?.match(/\[([^\]]+)\]/)
    return match ? match[1] : 'Pyomo + HiGHS'
  })()

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center" style={{ maxWidth: 360 }}>
          <AlertTriangle size={36} style={{ color: 'var(--red)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 6 }}>Could not load fleet data</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>{error}</p>
          <button onClick={load} className="btn-primary mx-auto"><RefreshCw size={12} /> Retry</button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div style={{ width: 32, height: 32, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  return (
    <div style={{ padding: 20 }} className="fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3" style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 3 }}>FLEET OPERATIONS</h1>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {vehicles.length} vehicles · {vehicles.filter(v => v.status === 'available').length} available · MIP optimisation
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {disruptions.length > 0 && (
            <div style={{ position: 'relative' }}>
              <select value={selectedDisruption} onChange={(e) => handleDisruptionChange(Number(e.target.value))}
                className="select-field" style={{ paddingRight: 28, maxWidth: 200 }}>
                {disruptions.map((d: any) => (
                  <option key={d.id} value={d.id}>{d.code}: {d.title.substring(0, 28)}…</option>
                ))}
              </select>
              <ChevronDown size={11} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            </div>
          )}
          <select value={objective} onChange={(e) => setObjective(e.target.value)} className="select-field">
            <option value="minimize_delay">Min Delay</option>
            <option value="minimize_cost">Min Cost</option>
            <option value="balance">Balanced</option>
          </select>
          <button onClick={runOptimise} disabled={optimising} className="btn-primary">
            <Zap size={12} /> {optimising ? 'Optimising…' : 'Run Optimiser'}
          </button>
          <button onClick={load} className="btn-ghost"><RefreshCw size={13} /></button>
        </div>
      </div>

      {/* Fleet type summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2" style={{ marginBottom: 14 }}>
          {Object.entries(summary).map(([type, d]: [string, any]) => {
            const utilColor = UTIL_COLOR(d.avg_utilisation)
            return (
              <div key={type} className="card" style={{ padding: '12px 14px' }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                  <span style={{ fontSize: 14 }}>{TYPE_ICONS[type] || '🚗'}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                    {type.replace(/_/g,' ')}
                  </span>
                </div>
                <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: 8 }}>
                  {d.count}
                </p>
                <div style={{ height: 3, background: 'var(--border-subtle)', borderRadius: 2, overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{ width: `${d.avg_utilisation}%`, height: '100%', background: utilColor, transition: 'width 0.4s' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 10, color: 'var(--text-muted)' }}>
                  <div className="flex justify-between">
                    <span>Available</span>
                    <span style={{ color: d.available === 0 ? 'var(--red)' : 'var(--green)', fontWeight: 700 }}>
                      {d.available}/{d.count}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg util</span>
                    <span style={{ color: utilColor, fontWeight: 700 }}>{d.avg_utilisation}%</span>
                  </div>
                  {d.cold_chain > 0 && (
                    <div className="flex justify-between">
                      <span>Cold chain</span>
                      <span style={{ color: 'var(--cyan)', fontWeight: 700 }}>{d.cold_chain}</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3" style={{ marginBottom: 14 }}>
        {/* Radar chart */}
        {summaryRadar.length > 0 && (
          <div className="card" style={{ padding: '12px 14px' }}>
            <p className="section-label" style={{ marginBottom: 8 }}>Fleet Capability by Type</p>
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={summaryRadar}>
                <PolarGrid stroke="var(--border-subtle)" />
                <PolarAngleAxis dataKey="type" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 8, fill: 'var(--text-faint)' }} />
                <Radar name="Utilisation" dataKey="utilisation" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.2} />
                <Radar name="Availability" dataKey="availability" stroke="var(--green)" fill="var(--green)" fillOpacity={0.15} />
                <Radar name="Cold Chain" dataKey="coldChain" stroke="var(--cyan)" fill="var(--cyan)" fillOpacity={0.15} />
                <Legend iconSize={7} wrapperStyle={{ fontSize: 10, color: 'var(--text-muted)' }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Vehicle utilisation bars */}
        <div className="card lg:col-span-2" style={{ padding: '12px 14px' }}>
          <p className="section-label" style={{ marginBottom: 10 }}>Vehicle Utilisation</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {vehicles.slice(0, 10).map((v) => {
              const pct = v.utilisation_pct
              const barColor = UTIL_COLOR(pct)
              return (
                <div key={v.id}>
                  <div className="flex items-center justify-between" style={{ marginBottom: 3 }}>
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: 11 }}>{TYPE_ICONS[v.type] || '🚗'}</span>
                      <span className="mono" style={{ color: '#60a5fa', fontSize: 10 }}>{v.code}</span>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{v.current_port?.city || '—'}</span>
                      {v.has_cold_chain && <span style={{ fontSize: 9, color: 'var(--cyan)' }}>❄</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: 9, color: STATUS_COLOR[v.status] || 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.04em' }}>
                        {v.status.toUpperCase()}
                      </span>
                      <span className="mono" style={{ color: barColor, fontSize: 11, fontWeight: 700 }}>{pct}%</span>
                    </div>
                  </div>
                  <div style={{ height: 4, background: 'var(--border-subtle)', borderRadius: 2, overflow: 'hidden' }}>
                    <div className="slide-right" style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 2 }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="card" style={{ padding: '12px 14px', marginBottom: 14 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
          <p className="section-label">Redeployment Recommendations</p>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', padding: '2px 8px',
            background: 'var(--accent-glow)', border: '1px solid rgba(30,126,248,0.3)',
            borderRadius: 3, color: '#60a5fa',
          }}>{solverTag}</span>
        </div>
        {recommendations.length === 0 ? (
          <div className="flex flex-col items-center justify-center" style={{ padding: '24px 0', color: 'var(--text-muted)' }}>
            <Zap size={22} style={{ opacity: 0.3, marginBottom: 8 }} />
            <p style={{ fontSize: 12 }}>No recommendations yet</p>
            <p style={{ fontSize: 10, marginTop: 4 }}>Click <span style={{ color: 'var(--accent)' }}>Run Optimiser</span> to generate assignments</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recommendations.map((r: any, i: number) => (
              <div key={i} style={{
                padding: '10px 12px', background: 'var(--bg-base)',
                border: '1px solid var(--border-default)', borderRadius: 5,
                borderLeft: '3px solid var(--accent)',
              }}>
                <div className="flex items-start justify-between gap-3">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {r.vehicle?.code || `Vehicle #${r.vehicle_id}`}
                      </span>
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 3,
                        background: 'var(--accent-glow)', color: '#60a5fa', letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                      }}>{r.action}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        {(r.shipment_ids || []).length} shipment{r.shipment_ids?.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      {r.rationale?.replace(/^\[[^\]]+\]\s*/, '')}
                    </p>
                    {r.shipment_ids?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                        {r.shipment_ids.map((sid: number) => (
                          <span key={sid} className="mono" style={{
                            fontSize: 9, background: 'var(--border-subtle)', color: 'var(--text-muted)',
                            padding: '1px 6px', borderRadius: 3,
                          }}>#{sid}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div>
                      <p style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>PRIORITY</p>
                      <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{r.priority_score?.toFixed(0)}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>CAP MATCH</p>
                      <p style={{ fontSize: 12, fontWeight: 600, color: r.capacity_match_pct >= 50 ? 'var(--green)' : 'var(--amber)' }}>
                        {r.capacity_match_pct}%
                      </p>
                    </div>
                    {r.cost_delta_usd > 0 && (
                      <div>
                        <p style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>COST Δ</p>
                        <p className="mono" style={{ color: 'var(--amber)', fontSize: 10 }}>${r.cost_delta_usd.toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Vehicle registry table */}
      <div className="card" style={{ padding: '12px 14px' }}>
        <p className="section-label" style={{ marginBottom: 10 }}>Fleet Registry — {vehicles.length} vehicles</p>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th><th>Name</th><th>Type</th><th>Location</th>
                <th>Status</th><th>Utilisation</th><th>Capacity</th><th>Cold Chain</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => (
                <tr key={v.id}>
                  <td><span className="mono" style={{ color: '#60a5fa' }}>{v.code}</span></td>
                  <td style={{ color: 'var(--text-primary)' }}>{v.name}</td>
                  <td style={{ textTransform: 'capitalize' }}>{v.type.replace(/_/g,' ')}</td>
                  <td>{v.current_port?.city || '—'}</td>
                  <td>
                    <span style={{ fontSize: 10, fontWeight: 600, color: STATUS_COLOR[v.status] || 'var(--text-muted)' }}>
                      {v.status}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div style={{ width: 48, height: 3, background: 'var(--border-subtle)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${v.utilisation_pct}%`, height: '100%', background: UTIL_COLOR(v.utilisation_pct) }} />
                      </div>
                      <span className="mono" style={{ color: UTIL_COLOR(v.utilisation_pct), fontSize: 10 }}>{v.utilisation_pct}%</span>
                    </div>
                  </td>
                  <td><span className="mono">{formatNumber(v.capacity_tonnes)}t</span></td>
                  <td>
                    {v.has_cold_chain ? (
                      <span style={{ color: 'var(--cyan)', fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Thermometer size={10} /> {v.min_temp_c}° to {v.max_temp_c}°C
                      </span>
                    ) : <span style={{ color: 'var(--text-faint)' }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
