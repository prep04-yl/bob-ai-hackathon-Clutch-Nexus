'use client'
import { useEffect, useState, useCallback } from 'react'
import { apiClient, type Shipment, type AIResponse } from '@/lib/api'
import ShipmentTable from '@/components/ShipmentTable'
import { cn, priorityColor, priorityLabel, formatCurrency, riskBgColor, modeIcon } from '@/lib/utils'
import { Search, X, Sparkles, Loader2, AlertTriangle, RefreshCw, Thermometer, ChevronDown } from 'lucide-react'
import { format } from 'date-fns'

const STATUSES = ['all', 'disrupted', 'at_risk', 'delayed', 'in_transit', 'scheduled', 'delivered']

const STATUS_DOT: Record<string, string> = {
  disrupted: 'var(--red)', at_risk: 'var(--orange)', delayed: 'var(--amber)',
  in_transit: '#3b82f6', scheduled: 'var(--text-muted)', delivered: 'var(--green)',
}

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [filtered, setFiltered] = useState<Shipment[]>([])
  const [selected, setSelected] = useState<Shipment | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [coldOnly, setColdOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [aiNarrative, setAiNarrative] = useState<AIResponse | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [coldLogs, setColdLogs] = useState<any[]>([])

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    apiClient.getShipments().then((r) => {
      setShipments(r.data)
      setFiltered(r.data)
      setLoading(false)
    }).catch((err) => {
      setError(err?.message || 'Failed to load shipments')
      setLoading(false)
    })
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    let result = shipments
    if (statusFilter !== 'all') result = result.filter((s) => s.status === statusFilter)
    if (categoryFilter !== 'all') result = result.filter((s) => s.category === categoryFilter)
    if (coldOnly) result = result.filter((s) => s.requires_cold_chain)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((s) =>
        s.tracking_id.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        (s.origin_port?.code ?? '').toLowerCase().includes(q) ||
        (s.destination_port?.code ?? '').toLowerCase().includes(q)
      )
    }
    setFiltered(result)
  }, [shipments, statusFilter, categoryFilter, coldOnly, search])

  useEffect(() => {
    if (selected?.requires_cold_chain) {
      apiClient.getShipmentColdChain(selected.id).then((r) => setColdLogs(r.data))
    } else {
      setColdLogs([])
    }
  }, [selected])

  const handleSelect = (s: Shipment) => {
    setSelected(s)
    setAiNarrative(null)
  }

  const usedCategories = ['all', ...Array.from(new Set(shipments.map(s => s.category))).sort()]
  const coldCount = shipments.filter(s => s.requires_cold_chain).length
  const disruptedCount = shipments.filter(s => s.status === 'disrupted' || s.status === 'at_risk').length

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center" style={{ maxWidth: 360 }}>
          <AlertTriangle size={36} style={{ color: 'var(--red)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 6 }}>Could not load shipments</p>
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
          <h1 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 3 }}>SHIPMENT REGISTRY</h1>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {filtered.length} of {shipments.length} shipments
            {disruptedCount > 0 && <span style={{ color: 'var(--red)', marginLeft: 8 }}>· {disruptedCount} disrupted/at-risk</span>}
            {coldCount > 0 && <span style={{ color: 'var(--cyan)', marginLeft: 8 }}>· {coldCount} cold-chain</span>}
          </p>
        </div>
        <button onClick={load} className="btn-ghost"><RefreshCw size={13} /></button>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '10px 12px', marginBottom: 12 }}>
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search ID, desc, port…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field"
              style={{ paddingLeft: 28, paddingRight: search ? 28 : 10, width: 220 }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={11} />
              </button>
            )}
          </div>

          {/* Category select */}
          <div style={{ position: 'relative' }}>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="select-field" style={{ paddingRight: 28 }}>
              {usedCategories.map(c => <option key={c} value={c}>{c === 'all' ? 'All categories' : c}</option>)}
            </select>
            <ChevronDown size={11} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          </div>

          {/* Cold chain toggle */}
          <button
            onClick={() => setColdOnly(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
              borderRadius: 4, fontSize: 11, fontWeight: 500, cursor: 'pointer', border: '1px solid',
              background: coldOnly ? 'var(--cyan-dim)' : 'var(--bg-base)',
              color: coldOnly ? 'var(--cyan)' : 'var(--text-muted)',
              borderColor: coldOnly ? 'rgba(0,184,212,0.3)' : 'var(--border-default)',
            }}
          >
            <Thermometer size={11} /> Cold Chain
          </button>

          <div className="divider" style={{ width: 1, height: 20, background: 'var(--border-subtle)', flexShrink: 0 }} />

          {/* Status buttons */}
          <div className="flex flex-wrap gap-1">
            {STATUSES.map((s) => {
              const count = s !== 'all' ? shipments.filter(sh => sh.status === s).length : null
              const isActive = statusFilter === s
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '4px 9px',
                    borderRadius: 4, fontSize: 11, fontWeight: 500, cursor: 'pointer',
                    border: `1px solid ${isActive && s !== 'all' ? `${STATUS_DOT[s]}44` : 'var(--border-default)'}`,
                    background: isActive ? (s === 'all' ? 'var(--accent)' : `${STATUS_DOT[s]}18`) : 'var(--bg-base)',
                    color: isActive ? (s === 'all' ? '#fff' : STATUS_DOT[s]) : 'var(--text-muted)',
                  }}
                >
                  {s !== 'all' && (
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: STATUS_DOT[s], flexShrink: 0 }} />
                  )}
                  {s.replace(/_/g, ' ')}
                  {count !== null && count > 0 && (
                    <span style={{ fontSize: 9, opacity: 0.7 }}>{count}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {/* Table */}
        <div className="card" style={{ flex: 1, minWidth: 0, padding: '10px 12px', overflowX: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} style={{ height: 36, background: 'var(--bg-hover)', borderRadius: 4, animation: 'pulse 1.5s infinite', opacity: 0.6 }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center" style={{ height: 160, color: 'var(--text-muted)' }}>
              <Search size={22} style={{ opacity: 0.3, marginBottom: 8 }} />
              <p style={{ fontSize: 12 }}>No shipments match the current filters</p>
              <button onClick={() => { setStatusFilter('all'); setCategoryFilter('all'); setColdOnly(false); setSearch('') }}
                style={{ fontSize: 11, color: 'var(--accent)', marginTop: 8, background: 'none', border: 'none', cursor: 'pointer' }}>
                Clear all filters
              </button>
            </div>
          ) : (
            <ShipmentTable shipments={filtered} onSelect={handleSelect} selectedId={selected?.id} />
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="card" style={{ width: 280, flexShrink: 0, padding: '12px 14px', position: 'sticky', top: 20, maxHeight: 'calc(100vh - 80px)', overflowY: 'auto' }}>
            <div className="flex items-start justify-between" style={{ marginBottom: 10 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <span className="mono" style={{ color: '#60a5fa', fontSize: 11 }}>{selected.tracking_id}</span>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2, lineHeight: 1.3 }}>{selected.description}</p>
                <p style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'capitalize', marginTop: 1 }}>{selected.category}</p>
              </div>
              <button onClick={() => setSelected(null)} className="btn-ghost" style={{ padding: '2px 4px', flexShrink: 0 }}><X size={14} /></button>
            </div>

            {/* Status/priority/risk grid */}
            <div className="grid grid-cols-2 gap-1.5" style={{ marginBottom: 10 }}>
              {[
                { label: 'Status', value: selected.status.replace(/_/g,' '), color: STATUS_DOT[selected.status] || 'var(--text-muted)' },
                { label: 'Priority', value: priorityLabel(selected.priority), color: selected.priority === 1 ? 'var(--red)' : selected.priority === 2 ? 'var(--orange)' : '#60a5fa' },
                { label: 'Risk Score', value: `${(selected.risk_score * 100).toFixed(0)}%`, color: selected.risk_score >= 0.7 ? 'var(--red)' : selected.risk_score >= 0.4 ? 'var(--amber)' : 'var(--green)' },
                { label: 'Delay', value: selected.delay_hours > 0 ? `+${selected.delay_hours}h` : 'On time', color: selected.delay_hours > 0 ? 'var(--amber)' : 'var(--green)' },
              ].map(m => (
                <div key={m.label} className="inset" style={{ padding: '6px 8px' }}>
                  <p style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 3 }}>{m.label}</p>
                  <p style={{ fontSize: 11, fontWeight: 700, color: m.color, textTransform: 'capitalize' }}>{m.value}</p>
                </div>
              ))}
            </div>

            <hr className="divider" style={{ marginBottom: 8 }} />

            {/* Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {[
                { label: 'Origin', value: selected.origin_port?.name || '—' },
                { label: 'Destination', value: selected.destination_port?.name || '—' },
                { label: 'Mode', value: selected.route ? `${modeIcon(selected.route.mode)} ${selected.route.mode}` : '—' },
                { label: 'Weight', value: `${selected.weight_tonnes.toLocaleString()} t` },
                { label: 'Value', value: formatCurrency(selected.value_usd), highlight: true },
                ...(selected.scheduled_departure ? [{ label: 'Departure', value: format(new Date(selected.scheduled_departure), 'dd MMM HH:mm') }] : []),
                ...(selected.estimated_arrival ? [{ label: 'Est. Arrival', value: format(new Date(selected.estimated_arrival), 'dd MMM HH:mm') }] : []),
              ].map(m => (
                <div key={m.label} className="flex items-start justify-between gap-2">
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>{m.label}</span>
                  <span style={{ fontSize: 11, color: (m as any).highlight ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: (m as any).highlight ? 600 : 400, textAlign: 'right' }}>{m.value}</span>
                </div>
              ))}
            </div>

            {/* Cold chain */}
            {selected.requires_cold_chain && (
              <>
                <hr className="divider" style={{ margin: '10px 0' }} />
                <div className="flex items-center gap-1.5" style={{ color: 'var(--cyan)', marginBottom: 8 }}>
                  <Thermometer size={12} />
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em' }}>COLD CHAIN</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div className="flex justify-between">
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Allowed range</span>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{selected.temp_min_c}° to {selected.temp_max_c}°C</span>
                  </div>
                  {selected.current_temp_c !== null && (
                    <div className="flex justify-between">
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Current</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: (selected.current_temp_c! > (selected.temp_max_c ?? 0) + 0.5) ? 'var(--red)' : 'var(--green)' }}>
                        {selected.current_temp_c}°C
                        {(selected.current_temp_c! > (selected.temp_max_c ?? 0) + 0.5) && ' ⚠'}
                      </span>
                    </div>
                  )}
                </div>
                {coldLogs.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <p style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 4 }}>
                      {coldLogs.length} readings · {coldLogs.filter((l: any) => l.is_excursion).length} excursions
                    </p>
                    <div style={{ display: 'flex', gap: 1, alignItems: 'flex-end', height: 28 }}>
                      {coldLogs.slice(-24).map((log: any, i: number) => (
                        <div key={i} title={`${log.temperature_c}°C`} style={{
                          flex: 1, height: '100%', borderRadius: 1,
                          background: log.is_excursion ? 'var(--red)' : 'var(--accent)',
                          opacity: 0.5 + (i / 24) * 0.5,
                        }} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Vehicle */}
            {selected.vehicle && (
              <>
                <hr className="divider" style={{ margin: '10px 0' }} />
                <p style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Assigned Vehicle</p>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{selected.vehicle.name}</p>
                <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{selected.vehicle.code} · {selected.vehicle.type.replace(/_/g,' ')}</p>
                <div className="flex justify-between" style={{ marginTop: 6, fontSize: 11 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Utilisation</span>
                  <span style={{ color: selected.vehicle.utilisation_pct >= 80 ? 'var(--red)' : 'var(--text-secondary)', fontWeight: 600 }}>
                    {selected.vehicle.utilisation_pct}%
                  </span>
                </div>
              </>
            )}

            {/* AI risk narrative */}
            <hr className="divider" style={{ margin: '10px 0' }} />
            <button
              onClick={() => {
                setAiNarrative(null)
                setAiLoading(true)
                apiClient.getRiskNarrative(selected.id)
                  .then(r => { setAiNarrative(r.data); setAiLoading(false) })
                  .catch(() => setAiLoading(false))
              }}
              disabled={aiLoading}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)',
                color: '#a78bfa', borderRadius: 5, padding: '7px 10px', fontSize: 11, fontWeight: 600,
                cursor: aiLoading ? 'not-allowed' : 'pointer', opacity: aiLoading ? 0.7 : 1,
              }}
            >
              {aiLoading ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
              {aiLoading ? 'Analysing…' : 'AI Risk Explanation'}
            </button>
            {aiNarrative && (
              <div style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 5 }}>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{aiNarrative.text}</p>
                <p style={{ fontSize: 9, color: 'var(--text-faint)', marginTop: 4 }}>
                  {!aiNarrative.fallback ? 'Google Gemini · gemini-3.6-flash' : aiNarrative.configured ? 'Rule-based (Gemini error — check key)' : 'Rule-based fallback · add GEMINI_API_KEY'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
