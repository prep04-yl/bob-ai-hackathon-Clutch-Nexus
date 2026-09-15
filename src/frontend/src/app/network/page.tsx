'use client'
import NetworkMap from '@/components/NetworkMap'
import { useEffect, useState, useCallback } from 'react'
import { apiClient } from '@/lib/api'
import { cn, modeIcon } from '@/lib/utils'
import { AlertTriangle, RefreshCw, Globe } from 'lucide-react'

export default function NetworkPage() {
  const [ports, setPorts] = useState<any[]>([])
  const [routes, setRoutes] = useState<any[]>([])
  const [disruptions, setDisruptions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      apiClient.getPorts(),
      apiClient.getRoutes(),
      apiClient.getDisruptions(),
    ]).then(([p, r, d]) => {
      setPorts(p.data)
      setRoutes(r.data)
      setDisruptions(d.data)
      setLoading(false)
    }).catch((err) => {
      setError(err?.message || 'Failed to load network data')
      setLoading(false)
    })
  }, [])

  useEffect(() => { load() }, [load])

  const activeDisruptions = disruptions.filter(d => d.is_active)
  const disruptedPortIds = new Set(activeDisruptions.map((d: any) => d.affected_port_id).filter(Boolean))
  const byMode = routes.reduce((acc: Record<string, number>, r: any) => {
    acc[r.mode] = (acc[r.mode] || 0) + 1
    return acc
  }, {})

  const MODE_COLORS: Record<string, string> = { sea: '#60a5fa', air: 'var(--amber)', rail: '#a78bfa', road: 'var(--green)' }

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
          <p style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 6 }}>Could not load network data</p>
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
          <h1 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 3 }}>NETWORK TOPOLOGY</h1>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {ports.length} ports · {routes.length} routes ·{' '}
            <span style={{ color: activeDisruptions.length > 0 ? 'var(--red)' : 'var(--green)' }}>
              {activeDisruptions.length} active disruption{activeDisruptions.length !== 1 ? 's' : ''}
            </span>
          </p>
        </div>
        <button onClick={load} className="btn-ghost"><RefreshCw size={13} /></button>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2" style={{ marginBottom: 12 }}>
        {[
          { label: 'Total Ports', value: ports.length, color: 'var(--text-primary)' },
          { label: 'Sea Ports', value: ports.filter((p: any) => p.type === 'sea').length, color: '#60a5fa' },
          { label: 'Total Routes', value: routes.length, color: 'var(--text-primary)' },
          { label: 'Air Routes', value: byMode['air'] || 0, color: 'var(--amber)' },
          { label: 'Disrupted Ports', value: disruptedPortIds.size, color: disruptedPortIds.size > 0 ? 'var(--red)' : 'var(--green)' },
          { label: 'Active Routes', value: routes.filter((r: any) => r.is_active).length, color: 'var(--green)' },
        ].map(m => (
          <div key={m.label} className="inset" style={{ padding: '8px 10px', textAlign: 'center' }}>
            <p style={{ fontSize: 18, fontWeight: 700, color: m.color, letterSpacing: '-0.03em' }}>{m.value}</p>
            <p style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{m.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        {/* Map */}
        <div className="lg:col-span-3 card" style={{ height: 500, overflow: 'hidden' }}>
          {!loading && <NetworkMap />}
        </div>

        {/* Side panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 500, overflowY: 'auto' }}>
          {/* Disrupted ports */}
          <div className="card" style={{ padding: '10px 12px' }}>
            <p className="section-label" style={{ marginBottom: 8 }}>Disrupted Ports</p>
            {activeDisruptions.filter((d) => d.affected_port).length === 0 ? (
              <div className="flex items-center gap-1.5" style={{ color: 'var(--green)', fontSize: 11 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
                All ports operational
              </div>
            ) : (
              activeDisruptions.filter((d) => d.affected_port).map((d: any) => (
                <div key={d.id} className="flex items-center gap-2" style={{ padding: '5px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span className="pulse-red" style={{ width: 6, height: 6, flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{d.affected_port?.code}</p>
                    <p style={{ fontSize: 9, color: 'var(--text-muted)' }}>{d.affected_port?.city} · {d.type.replace(/_/g,' ')}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Routes by mode */}
          <div className="card" style={{ padding: '10px 12px' }}>
            <p className="section-label" style={{ marginBottom: 8 }}>Routes by Mode</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {Object.entries(byMode).map(([mode, count]) => (
                <div key={mode}>
                  <div className="flex items-center justify-between" style={{ marginBottom: 3 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                      {modeIcon(mode)} {mode}
                    </span>
                    <span className="mono" style={{ fontSize: 10, color: MODE_COLORS[mode] || 'var(--text-muted)', fontWeight: 600 }}>
                      {count as number}
                    </span>
                  </div>
                  <div style={{ height: 3, background: 'var(--border-subtle)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${((count as number) / routes.length) * 100}%`, height: '100%', background: MODE_COLORS[mode] || 'var(--accent)', borderRadius: 2 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Active routes list */}
          <div className="card" style={{ padding: '10px 12px' }}>
            <p className="section-label" style={{ marginBottom: 8 }}>
              Active Routes ({routes.filter(r => r.is_active).length})
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {routes.filter(r => r.is_active).slice(0, 12).map((r) => (
                <div key={r.id} className="flex items-center justify-between" style={{ padding: '4px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="flex items-center gap-1" style={{ fontSize: 10 }}>
                      <span>{modeIcon(r.mode)}</span>
                      <span className="mono" style={{ color: 'var(--text-secondary)' }}>
                        {r.origin_port?.code || r.origin_port_id} → {r.destination_port?.code || r.destination_port_id}
                      </span>
                    </div>
                    <p style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 1 }}>
                      {r.transit_days}d · {r.distance_km?.toLocaleString()} km
                    </p>
                  </div>
                  <span style={{
                    fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 3, textTransform: 'capitalize',
                    background: `${MODE_COLORS[r.mode] || 'var(--accent)'}22`,
                    color: MODE_COLORS[r.mode] || 'var(--accent)',
                  }}>{r.mode}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Port registry */}
      <div className="card" style={{ padding: '12px 14px', marginTop: 12 }}>
        <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
          <Globe size={12} style={{ color: 'var(--text-muted)' }} />
          <p className="section-label">Port Registry — {ports.length} facilities</p>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th><th>Name</th><th>City</th><th>Country</th>
                <th>Type</th><th>Capacity (TEU)</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {ports.map((p) => {
                const isDisrupted = disruptedPortIds.has(p.id)
                return (
                  <tr key={p.id} style={{ background: isDisrupted ? 'var(--red-dim)' : undefined }}>
                    <td><span className="mono" style={{ color: isDisrupted ? 'var(--red)' : '#60a5fa' }}>{p.code}</span></td>
                    <td style={{ color: 'var(--text-primary)' }}>{p.name}</td>
                    <td>{p.city}</td>
                    <td>{p.country}</td>
                    <td>
                      <span style={{ textTransform: 'capitalize', fontSize: 10 }}>{modeIcon(p.type)} {p.type}</span>
                    </td>
                    <td><span className="mono">{p.capacity_teu ? p.capacity_teu.toLocaleString() : '—'}</span></td>
                    <td>
                      {isDisrupted ? (
                        <div className="flex items-center gap-1.5">
                          <span className="pulse-red" style={{ width: 5, height: 5 }} />
                          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--red)' }}>DISRUPTED</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--green)' }}>OPERATIONAL</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
