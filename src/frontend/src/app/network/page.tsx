'use client'
import NetworkMap from '@/components/NetworkMap'
import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api'
import { cn, modeIcon } from '@/lib/utils'

export default function NetworkPage() {
  const [ports, setPorts] = useState<any[]>([])
  const [routes, setRoutes] = useState<any[]>([])
  const [disruptions, setDisruptions] = useState<any[]>([])

  useEffect(() => {
    Promise.all([
      apiClient.getPorts(),
      apiClient.getRoutes(),
      apiClient.getDisruptions(),
    ]).then(([p, r, d]) => {
      setPorts(p.data)
      setRoutes(r.data)
      setDisruptions(d.data)
    })
  }, [])

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white">Supply Chain Network</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          {ports.length} ports · {routes.length} routes · {disruptions.filter(d => d.is_active).length} active disruptions
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Map */}
        <div className="lg:col-span-3 card overflow-hidden" style={{ height: '520px' }}>
          <NetworkMap />
        </div>

        {/* Side panel */}
        <div className="space-y-3 overflow-y-auto" style={{ maxHeight: '520px' }}>
          {/* Disrupted ports */}
          <div className="card p-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Disrupted Ports</h3>
            {disruptions.filter((d) => d.is_active && d.affected_port).map((d) => (
              <div key={d.id} className="flex items-center gap-2 py-1.5 border-b border-slate-800 last:border-0">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-white font-medium">{d.affected_port?.code}</p>
                  <p className="text-[10px] text-slate-500 truncate">{d.affected_port?.city}</p>
                </div>
              </div>
            ))}
            {disruptions.filter((d) => d.is_active && d.affected_port).length === 0 && (
              <p className="text-xs text-slate-600">No port disruptions</p>
            )}
          </div>

          {/* Routes table */}
          <div className="card p-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Active Routes</h3>
            <div className="space-y-1.5">
              {routes.filter(r => r.is_active).slice(0, 12).map((r) => (
                <div key={r.id} className="flex items-center justify-between py-1.5 border-b border-slate-800/50 last:border-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 text-[11px]">
                      <span>{modeIcon(r.mode)}</span>
                      <span className="text-slate-400 font-mono">
                        {r.origin_port?.code} → {r.destination_port?.code}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-600 mt-0.5">
                      {r.transit_days}d · {r.distance_km.toLocaleString()} km
                    </div>
                  </div>
                  <span className={cn(
                    'text-[9px] font-medium px-1.5 py-0.5 rounded capitalize',
                    r.mode === 'sea' ? 'bg-blue-500/20 text-blue-400' :
                    r.mode === 'air' ? 'bg-yellow-500/20 text-yellow-400' :
                    r.mode === 'rail' ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-500/20 text-slate-400'
                  )}>
                    {r.mode}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Ports table */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-slate-200 mb-3">Port Registry</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-800">
                <th className="pb-2 pr-4">Code</th>
                <th className="pb-2 pr-4">Name</th>
                <th className="pb-2 pr-4">City</th>
                <th className="pb-2 pr-4">Country</th>
                <th className="pb-2 pr-4">Type</th>
                <th className="pb-2 pr-4">Capacity (TEU)</th>
                <th className="pb-2 pr-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {ports.map((p) => {
                const isDisrupted = disruptions.some((d) => d.is_active && d.affected_port_id === p.id)
                return (
                  <tr key={p.id} className="hover:bg-slate-800/30">
                    <td className="py-2.5 pr-4 font-mono text-blue-400">{p.code}</td>
                    <td className="py-2.5 pr-4 text-slate-200">{p.name}</td>
                    <td className="py-2.5 pr-4 text-slate-400">{p.city}</td>
                    <td className="py-2.5 pr-4 text-slate-400">{p.country}</td>
                    <td className="py-2.5 pr-4">
                      <span className="flex items-center gap-1 text-slate-400 capitalize">
                        {modeIcon(p.type)} {p.type}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-slate-300 font-mono">
                      {p.capacity_teu ? p.capacity_teu.toLocaleString() : '—'}
                    </td>
                    <td className="py-2.5 pr-4">
                      {isDisrupted ? (
                        <span className="flex items-center gap-1 text-red-400 font-semibold text-[10px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> DISRUPTED
                        </span>
                      ) : (
                        <span className="text-green-400 text-[10px] font-semibold">OPERATIONAL</span>
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
