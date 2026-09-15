'use client'
import { useEffect, useState, useCallback } from 'react'
import { apiClient, type AIResponse } from '@/lib/api'
import { cn } from '@/lib/utils'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Area, AreaChart
} from 'recharts'
import { Thermometer, AlertTriangle, Sparkles, Loader2, RefreshCw, CheckCircle2 } from 'lucide-react'
import { format } from 'date-fns'

const TOOLTIP_STYLE = {
  background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)',
  borderRadius: 5, fontSize: 11, padding: '6px 10px',
}

export default function ColdChainPage() {
  const [shipments, setShipments] = useState<any[]>([])
  const [excursions, setExcursions] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [selected, setSelected] = useState<any>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [logsLoading, setLogsLoading] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState<AIResponse | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      apiClient.getColdChainShipments(),
      apiClient.getColdChainExcursions(),
      apiClient.getColdChainSummary(),
    ]).then(([s, e, sum]) => {
      setShipments(s.data)
      setExcursions(e.data)
      setSummary(sum.data)
      setLoading(false)
      if (s.data.length > 0) selectShipment(s.data[0])
    }).catch((err) => {
      setError(err?.message || 'Failed to load cold chain data')
      setLoading(false)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  const selectShipment = (s: any) => {
    setSelected(s)
    setAiAnalysis(null)
    setLogsLoading(true)
    apiClient.getShipmentColdChain(s.id).then((r) => {
      setLogs(r.data.map((log: any, i: number) => ({ ...log, label: `T-${r.data.length - 1 - i}h` })))
      setLogsLoading(false)
    }).catch(() => setLogsLoading(false))
  }

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
          <p style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 6 }}>Could not load cold chain data</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>{error}</p>
          <button onClick={load} className="btn-primary mx-auto"><RefreshCw size={12} /> Retry</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: 20 }} className="fade-in">
      {/* Header + summary */}
      <div className="flex items-center justify-between flex-wrap gap-3" style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 3 }}>COLD CHAIN MONITOR</h1>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Temperature excursion detection · compliance tracking</p>
        </div>
        <div className="flex items-center gap-2">
          {summary && (
            <>
              {[
                { label: 'Cold Shipments', value: summary.total_cold_chain_shipments, color: '#60a5fa' },
                { label: 'In Excursion', value: summary.shipments_in_excursion, color: summary.shipments_in_excursion > 0 ? 'var(--red)' : 'var(--green)' },
                { label: 'Events', value: summary.total_excursion_events, color: summary.total_excursion_events > 0 ? 'var(--orange)' : 'var(--green)' },
              ].map((m) => (
                <div key={m.label} className="inset" style={{ padding: '8px 14px', textAlign: 'center' }}>
                  <p style={{ fontSize: 18, fontWeight: 700, color: m.color, letterSpacing: '-0.03em' }}>{m.value}</p>
                  <p style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{m.label}</p>
                </div>
              ))}
            </>
          )}
          <button onClick={load} className="btn-ghost"><RefreshCw size={13} /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Shipment list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p className="section-label" style={{ padding: '0 2px 2px' }}>Cold-Chain Shipments ({shipments.length})</p>
          {shipments.length === 0 && (
            <div className="card flex items-center gap-2" style={{ padding: '20px', color: 'var(--green)' }}>
              <CheckCircle2 size={14} /> <span style={{ fontSize: 12 }}>No cold-chain shipments</span>
            </div>
          )}
          {shipments.map((s) => {
            const isSelected = selected?.id === s.id
            return (
              <button
                key={s.id}
                onClick={() => selectShipment(s)}
                style={{
                  width: '100%', textAlign: 'left',
                  background: isSelected ? 'var(--bg-active)' : 'var(--bg-elevated)',
                  border: `1px solid ${isSelected ? 'var(--accent)' : s.in_excursion ? 'var(--red-border)' : 'var(--border-default)'}`,
                  borderLeft: `3px solid ${s.in_excursion ? 'var(--red)' : 'var(--cyan)'}`,
                  borderRadius: 6, padding: '9px 12px', cursor: 'pointer',
                }}
              >
                <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
                  <Thermometer size={11} style={{ color: s.in_excursion ? 'var(--red)' : 'var(--cyan)', flexShrink: 0 }} />
                  <span className="mono" style={{ color: '#60a5fa', fontSize: 10, flex: 1 }}>{s.tracking_id}</span>
                  {s.in_excursion ? (
                    <span style={{ fontSize: 9, color: 'var(--red)', fontWeight: 700, letterSpacing: '0.05em' }}>⚠ EXCURSION</span>
                  ) : (
                    <span style={{ fontSize: 9, color: 'var(--green)', fontWeight: 600 }}>✓ OK</span>
                  )}
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.3 }}>{s.description}</p>
                <div className="flex items-center justify-between" style={{ marginTop: 4 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{s.temp_min_c}° to {s.temp_max_c}°C</span>
                  {s.current_temp_c !== null && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: s.in_excursion ? 'var(--red)' : 'var(--green)' }}>
                      {s.current_temp_c}°C
                    </span>
                  )}
                </div>
                {s.excursion_event_count > 0 && (
                  <p style={{ fontSize: 10, color: 'var(--orange)', marginTop: 3 }}>
                    {s.excursion_event_count} event{s.excursion_event_count > 1 ? 's' : ''}
                  </p>
                )}
              </button>
            )
          })}
        </div>

        {/* Chart + detail */}
        <div className="lg:col-span-2" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {selected && (
            <>
              {/* Telemetry chart */}
              <div className="card" style={{ padding: '12px 14px' }}>
                <div className="flex items-center justify-between flex-wrap gap-2" style={{ marginBottom: 10 }}>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{selected.description}</p>
                    <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                      {selected.tracking_id} · Allowed: {selected.temp_min_c}°C to {selected.temp_max_c}°C
                      {selected.current_temp_c !== null && (
                        <span style={{ marginLeft: 6, fontWeight: 700, color: selected.in_excursion ? 'var(--red)' : 'var(--green)' }}>
                          · Now: {selected.current_temp_c}°C
                        </span>
                      )}
                    </p>
                  </div>
                  {selected.in_excursion && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'var(--red-dim)', border: '1px solid var(--red-border)', borderRadius: 5 }}>
                      <AlertTriangle size={11} style={{ color: 'var(--red)' }} />
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--red)', letterSpacing: '0.06em' }}>TEMPERATURE EXCURSION</span>
                    </div>
                  )}
                </div>

                {logsLoading ? (
                  <div className="flex items-center justify-center" style={{ height: 160, color: 'var(--text-muted)' }}>
                    <div style={{ width: 16, height: 16, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginRight: 8 }} />
                    <span style={{ fontSize: 12 }}>Loading telemetry…</span>
                  </div>
                ) : logs.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={logs}>
                      <defs>
                        <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="2 2" stroke="var(--border-subtle)" />
                      <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: 'var(--text-muted)' }} unit="°C" domain={['auto', 'auto']} axisLine={false} tickLine={false} padding={{ top: 10, bottom: 10 }} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, _, p) => [
                        `${v}°C${p.payload.is_excursion ? ' ⚠ EXCURSION' : ''}`, 'Temperature'
                      ]} />
                      {selected.temp_max_c !== null && (
                        <ReferenceLine y={selected.temp_max_c} stroke="var(--red)" strokeDasharray="4 2"
                          label={{ value: `Max ${selected.temp_max_c}°C`, fill: 'var(--red)', fontSize: 9, position: 'insideTopRight' }} />
                      )}
                      {selected.temp_min_c !== null && (
                        <ReferenceLine y={selected.temp_min_c} stroke="var(--amber)" strokeDasharray="4 2"
                          label={{ value: `Min ${selected.temp_min_c}°C`, fill: 'var(--amber)', fontSize: 9, position: 'insideBottomRight' }} />
                      )}
                      <Area type="monotone" dataKey="temperature_c" stroke="var(--accent)" fill="url(#tempGrad)" strokeWidth={1.5}
                        dot={(props: any) => {
                          const { cx, cy, payload, index } = props
                          if (!payload.is_excursion) return <circle key={`d-${index}`} cx={cx} cy={cy} r={2.5} fill="var(--accent)" stroke="none" />
                          return <circle key={`e-${index}`} cx={cx} cy={cy} r={4.5} fill="var(--red)" stroke="rgba(244,63,63,0.4)" strokeWidth={2} />
                        }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center" style={{ height: 120, color: 'var(--text-muted)', fontSize: 12 }}>
                    No telemetry data available
                  </div>
                )}

                {logs.length > 0 && (
                  <div className="flex items-center gap-4" style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-subtle)', fontSize: 10, color: 'var(--text-muted)' }}>
                    <span>{logs.length} readings</span>
                    <span>·</span>
                    <span style={{ color: logs.filter((l: any) => l.is_excursion).length > 0 ? 'var(--red)' : 'var(--green)' }}>
                      {logs.filter((l: any) => l.is_excursion).length} excursion point{logs.filter((l: any) => l.is_excursion).length !== 1 ? 's' : ''}
                    </span>
                    {logs[logs.length - 1]?.humidity_pct != null && (
                      <>
                        <span>·</span>
                        <span>Humidity: {logs[logs.length - 1].humidity_pct}%</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Excursion events */}
              {(() => {
                const shipEx = excursions.filter((e) => e.shipment_id === selected.id)
                if (shipEx.length === 0) return null
                return (
                  <div className="card" style={{ padding: '12px 14px' }}>
                    <p className="section-label" style={{ marginBottom: 8 }}>
                      Excursion Events — {shipEx.length} recorded
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {shipEx.map((e) => (
                        <div key={e.id} style={{ padding: '8px 10px', background: 'var(--red-dim)', border: '1px solid var(--red-border)', borderRadius: 5 }}>
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <span style={{ fontSize: 10, fontWeight: 700, color: e.excursion_severity === 'critical' ? 'var(--red)' : 'var(--orange)', letterSpacing: '0.06em' }}>
                              {(e.excursion_severity ?? 'unknown').toUpperCase()} EXCURSION
                            </span>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                              {format(new Date(e.timestamp), 'dd MMM yyyy HH:mm')}
                            </span>
                          </div>
                          <div className="flex items-center gap-3" style={{ marginTop: 4, fontSize: 11 }}>
                            <span>Temp: <span style={{ color: 'var(--red)', fontWeight: 700 }}>{e.temperature_c}°C</span></span>
                            {e.required_max_c && <span style={{ color: 'var(--text-muted)' }}>Limit: {e.required_min_c}–{e.required_max_c}°C</span>}
                            {e.humidity_pct && <span style={{ color: 'var(--text-muted)' }}>Humidity: {e.humidity_pct}%</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {/* AI Analysis */}
              <div className="card" style={{ padding: '12px 14px', borderColor: 'rgba(139,92,246,0.25)', background: 'rgba(139,92,246,0.03)' }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                  <div className="flex items-center gap-2">
                    <Sparkles size={12} style={{ color: '#a78bfa' }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#a78bfa', letterSpacing: '0.06em' }}>AI COLD-CHAIN ANALYSIS</span>
                  </div>
                  <button
                    onClick={() => {
                      setAiAnalysis(null)
                      setAiLoading(true)
                      apiClient.getColdChainAnalysis(selected.id)
                        .then(r => { setAiAnalysis(r.data); setAiLoading(false) })
                        .catch(() => setAiLoading(false))
                    }}
                    disabled={aiLoading || !selected.in_excursion}
                    className="btn-primary"
                    style={{ background: aiLoading || !selected.in_excursion ? 'rgba(139,92,246,0.2)' : 'rgba(139,92,246,0.8)', color: '#e9d5ff', fontSize: 11 }}
                    title={selected.in_excursion ? 'Analyse excursion' : 'Only available during an active excursion'}
                  >
                    {aiLoading ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                    {aiLoading ? 'Analysing…' : 'Analyse'}
                  </button>
                </div>
                {aiAnalysis ? (
                  <div>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{aiAnalysis.text}</p>
                    <p style={{ fontSize: 9, color: 'var(--text-faint)', marginTop: 6 }}>
                      {!aiAnalysis.fallback ? 'Google Gemini · gemini-3.6-flash' : aiAnalysis.configured ? 'Rule-based (Gemini error — check key)' : 'Rule-based fallback · add GEMINI_API_KEY'}
                    </p>
                  </div>
                ) : (
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {selected.in_excursion
                      ? 'Click "Analyse" to get an AI assessment of product integrity and recommended corrective actions.'
                      : 'No active excursion on this shipment. Analysis available when a temperature breach is detected.'}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
