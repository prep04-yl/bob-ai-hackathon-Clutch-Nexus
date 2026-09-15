'use client'
import { useEffect, useState } from 'react'
import { apiClient, type Vehicle } from '@/lib/api'
import { cn, statusColor, formatNumber } from '@/lib/utils'
import { Truck, Thermometer, Zap } from 'lucide-react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell
} from 'recharts'

const TYPE_LABELS: Record<string, string> = {
  container_ship: '🚢 Container Ship',
  truck: '🚛 Truck',
  train: '🚂 Train',
  aircraft: '✈️ Aircraft',
}

export default function FleetPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [recommendations, setRecommendations] = useState<any[]>([])
  const [optimising, setOptimising] = useState(false)
  const [loading, setLoading] = useState(true)
  const [objective, setObjective] = useState('minimize_delay')

  useEffect(() => {
    Promise.all([
      apiClient.getFleet(),
      apiClient.getFleetSummary(),
      apiClient.getFleetRecommendations(1),
    ]).then(([v, s, r]) => {
      setVehicles(v.data)
      setSummary(s.data)
      setRecommendations(r.data)
      setLoading(false)
    })
  }, [])

  const runOptimise = () => {
    setOptimising(true)
    apiClient.optimiseFleet(1, objective).then((r) => {
      setRecommendations(r.data)
      // refresh full recs
      return apiClient.getFleetRecommendations(1)
    }).then((r) => {
      setRecommendations(r.data)
      setOptimising(false)
    }).catch(() => setOptimising(false))
  }

  const chartData = vehicles.map((v) => ({
    name: v.code.split('-').slice(-1)[0],
    full_name: v.name,
    utilisation: v.utilisation_pct,
    capacity: v.capacity_tonnes,
    status: v.status,
  }))

  const summaryRadar = summary
    ? Object.entries(summary).map(([type, d]: [string, any]) => ({
        type: type.replace('_', ' '),
        utilisation: d.avg_utilisation,
        availability: (d.available / d.count) * 100,
        coldChain: (d.cold_chain / d.count) * 100,
      }))
    : []

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Fleet Management</h1>
          <p className="text-sm text-slate-400 mt-0.5">Utilisation, capacity & redeployment optimisation</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none"
          >
            <option value="minimize_delay">Minimise Delay</option>
            <option value="minimize_cost">Minimise Cost</option>
            <option value="balance">Balanced</option>
          </select>
          <button
            onClick={runOptimise}
            disabled={optimising}
            className="btn-primary flex items-center gap-2"
          >
            <Zap size={14} />
            {optimising ? 'Running OR-Tools…' : 'Run Fleet Optimiser'}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(summary).map(([type, d]: [string, any]) => (
            <div key={type} className="card p-4">
              <p className="text-xs text-slate-500 mb-2">{TYPE_LABELS[type] || type}</p>
              <p className="text-xl font-bold text-white">{d.count}</p>
              <div className="mt-2 space-y-1 text-[11px] text-slate-400">
                <div className="flex justify-between">
                  <span>Available</span>
                  <span className="text-green-400 font-medium">{d.available}/{d.count}</span>
                </div>
                <div className="flex justify-between">
                  <span>Avg Util</span>
                  <span className={d.avg_utilisation >= 80 ? 'text-red-400' : 'text-blue-400'}>
                    {d.avg_utilisation}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Cold Chain</span>
                  <span className="text-cyan-400">{d.cold_chain}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Vehicle Utilisation</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748b' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} unit="%" />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: 11 }}
                formatter={(v: number, _, p) => [`${v}%`, p.payload.full_name]}
              />
              <Bar dataKey="utilisation" radius={[4, 4, 0, 0]}>
                {chartData.map((d, i) => (
                  <Cell
                    key={i}
                    fill={
                      d.status === 'maintenance' ? '#475569' :
                      d.utilisation >= 85 ? '#ef4444' :
                      d.utilisation >= 60 ? '#f59e0b' : '#3b82f6'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {summaryRadar.length > 0 && (
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">Fleet Capability Radar</h3>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={summaryRadar}>
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis dataKey="type" tick={{ fontSize: 10, fill: '#64748b' }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#475569' }} />
                <Radar name="Utilisation" dataKey="utilisation" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                <Radar name="Availability" dataKey="availability" stroke="#22c55e" fill="#22c55e" fillOpacity={0.2} />
                <Radar name="Cold Chain" dataKey="coldChain" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Vehicle table */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-slate-200 mb-3">Fleet Registry</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-800">
                <th className="pb-2 pr-4">Code</th>
                <th className="pb-2 pr-4">Name</th>
                <th className="pb-2 pr-4">Type</th>
                <th className="pb-2 pr-4">Location</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Utilisation</th>
                <th className="pb-2 pr-4">Capacity</th>
                <th className="pb-2 pr-4">Cold Chain</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {vehicles.map((v) => (
                <tr key={v.id} className="hover:bg-slate-800/30">
                  <td className="py-2.5 pr-4 font-mono text-blue-400">{v.code}</td>
                  <td className="py-2.5 pr-4 text-slate-200">{v.name}</td>
                  <td className="py-2.5 pr-4 text-slate-400 capitalize">{TYPE_LABELS[v.type] || v.type}</td>
                  <td className="py-2.5 pr-4 text-slate-400">{v.current_port?.city || '—'}</td>
                  <td className="py-2.5 pr-4">
                    <span className={cn('badge', statusColor(v.status))}>{v.status}</span>
                  </td>
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${v.utilisation_pct}%` }}
                          className={cn('h-full rounded-full', v.utilisation_pct >= 85 ? 'bg-red-500' : v.utilisation_pct >= 60 ? 'bg-yellow-500' : 'bg-blue-500')}
                        />
                      </div>
                      <span className="text-slate-300">{v.utilisation_pct}%</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-4 text-slate-300">{formatNumber(v.capacity_tonnes)}t</td>
                  <td className="py-2.5 pr-4">
                    {v.has_cold_chain ? (
                      <span className="text-cyan-400 flex items-center gap-1">
                        <Thermometer size={11} /> {v.min_temp_c}° to {v.max_temp_c}°C
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* OR-Tools Recommendations */}
      {recommendations.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">
            Fleet Redeployment Recommendations
            <span className="ml-2 text-[11px] text-blue-400 font-normal">OR-Tools CP-SAT</span>
          </h3>
          <div className="space-y-3">
            {recommendations.map((r: any, i: number) => (
              <div key={i} className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-white">
                        {r.vehicle?.code || `Vehicle #${r.vehicle_id}`}
                      </span>
                      <span className="badge bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[10px]">
                        {r.action}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {(r.shipment_ids || []).length} shipment(s)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">{r.rationale}</p>
                  </div>
                  <div className="text-right shrink-0 text-xs">
                    <div className="text-slate-400">Priority</div>
                    <div className="text-white font-semibold">{r.priority_score?.toFixed(0)}</div>
                    <div className="text-slate-500 mt-1">Cap Match</div>
                    <div className="text-blue-400">{r.capacity_match_pct}%</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
