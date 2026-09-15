'use client'
import { useEffect, useState } from 'react'
import { apiClient, type AIResponse } from '@/lib/api'
import { cn } from '@/lib/utils'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Area, AreaChart
} from 'recharts'
import { Thermometer, AlertTriangle, Sparkles, Loader2 } from 'lucide-react'
import { format } from 'date-fns'

export default function ColdChainPage() {
  const [shipments, setShipments] = useState<any[]>([])
  const [excursions, setExcursions] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [selected, setSelected] = useState<any>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [aiAnalysis, setAiAnalysis] = useState<AIResponse | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => {
    Promise.all([
      apiClient.getColdChainShipments(),
      apiClient.getColdChainExcursions(),
      apiClient.getColdChainSummary(),
    ]).then(([s, e, sum]) => {
      setShipments(s.data)
      setExcursions(e.data)
      setSummary(sum.data)
      if (s.data.length > 0) selectShipment(s.data[0])
      setLoading(false)
    })
  }, [])

  const selectShipment = (s: any) => {
    setSelected(s)
    apiClient.getShipmentColdChain(s.id).then((r) => {
      setLogs(r.data.map((log: any, i: number) => ({
        ...log,
        label: `T-${r.data.length - 1 - i}h`,
      })))
    })
  }

  const excursionColor = (sev: string) => {
    if (sev === 'critical') return 'text-red-400'
    if (sev === 'major') return 'text-orange-400'
    return 'text-yellow-400'
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Cold Chain Monitor</h1>
          <p className="text-sm text-slate-400 mt-0.5">Temperature excursion detection & compliance</p>
        </div>
        {summary && (
          <div className="flex gap-3">
            {[
              { label: 'Cold Chain Shipments', value: summary.total_cold_chain_shipments, color: 'text-blue-400' },
              { label: 'In Excursion', value: summary.shipments_in_excursion, color: 'text-red-400' },
              { label: 'Excursion Events', value: summary.total_excursion_events, color: 'text-orange-400' },
            ].map((m) => (
              <div key={m.label} className="card px-4 py-3 text-center">
                <p className={cn('text-xl font-bold', m.color)}>{m.value}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{m.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Shipment list */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
            Cold-Chain Shipments
          </h3>
          {shipments.map((s) => (
            <button
              key={s.id}
              onClick={() => selectShipment(s)}
              className={cn(
                'w-full text-left card p-3 transition-all hover:border-slate-700',
                selected?.id === s.id && 'border-blue-600/50 bg-blue-600/5'
              )}
            >
              <div className="flex items-start gap-2">
                <Thermometer
                  size={14}
                  className={s.in_excursion ? 'text-red-400 mt-0.5' : 'text-cyan-400 mt-0.5'}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-blue-400">{s.tracking_id}</span>
                    {s.in_excursion && (
                      <span className="text-[10px] text-red-400 font-semibold">⚠ EXCURSION</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5 truncate">{s.description}</p>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500">
                    <span>Range: {s.temp_min_c}°C to {s.temp_max_c}°C</span>
                    {s.current_temp_c !== null && (
                      <span className={s.in_excursion ? 'text-red-400 font-semibold' : 'text-green-400'}>
                        Now: {s.current_temp_c}°C
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Temperature chart */}
        <div className="lg:col-span-2 space-y-4">
          {selected && (
            <>
              <div className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-200">{selected.description}</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {selected.tracking_id} · Required: {selected.temp_min_c}°C to {selected.temp_max_c}°C
                    </p>
                  </div>
                  {selected.in_excursion && (
                    <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5">
                      <AlertTriangle size={12} className="text-red-400" />
                      <span className="text-xs text-red-400 font-semibold">TEMPERATURE EXCURSION</span>
                    </div>
                  )}
                </div>
                {logs.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={logs}>
                      <defs>
                        <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} unit="°C" domain={['auto', 'auto']} />
                      <Tooltip
                        contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: 12 }}
                        formatter={(v: number) => [`${v}°C`, 'Temperature']}
                      />
                      {/* Safe range bands */}
                      {selected.temp_max_c !== null && (
                        <ReferenceLine
                          y={selected.temp_max_c}
                          stroke="#ef4444"
                          strokeDasharray="5 3"
                          label={{ value: `Max ${selected.temp_max_c}°C`, fill: '#ef4444', fontSize: 10, position: 'insideTopRight' }}
                        />
                      )}
                      {selected.temp_min_c !== null && (
                        <ReferenceLine
                          y={selected.temp_min_c}
                          stroke="#f59e0b"
                          strokeDasharray="5 3"
                          label={{ value: `Min ${selected.temp_min_c}°C`, fill: '#f59e0b', fontSize: 10, position: 'insideBottomRight' }}
                        />
                      )}
                      <Area
                        type="monotone"
                        dataKey="temperature_c"
                        stroke="#3b82f6"
                        fill="url(#tempGrad)"
                        strokeWidth={2}
                        dot={(props: any) => {
                          const { cx, cy, payload, index } = props
                          if (!payload.is_excursion) return <circle key={`dot-${index}`} cx={cx} cy={cy} r={3} fill="#3b82f6" stroke="none" />
                          return <circle key={`exc-${index}`} cx={cx} cy={cy} r={5} fill="#ef4444" stroke="#fca5a5" strokeWidth={1.5} />
                        }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-40 flex items-center justify-center text-slate-500 text-sm">No telemetry data</div>
                )}
              </div>

              {/* Excursion events */}
              {excursions.filter((e) => e.shipment_id === selected.id).length > 0 && (
                <div className="card p-4">
                  <h3 className="text-sm font-semibold text-slate-200 mb-3">Excursion Events</h3>
                  <div className="space-y-2">
                    {excursions.filter((e) => e.shipment_id === selected.id).map((e) => (
                      <div key={e.id} className="flex items-start gap-3 p-2 rounded bg-red-500/10 border border-red-500/20">
                        <AlertTriangle size={12} className="text-red-400 mt-0.5 shrink-0" />
                        <div className="text-xs">
                          <span className={cn('font-semibold', excursionColor(e.excursion_severity || ''))}>
                            {e.excursion_severity?.toUpperCase()} EXCURSION
                          </span>
                          <span className="text-slate-400 ml-2">
                            {format(new Date(e.timestamp), 'dd MMM HH:mm')}
                          </span>
                          <span className="text-slate-300 ml-2">
                            {e.temperature_c}°C
                            {e.required_max_c && ` (max: ${e.required_max_c}°C)`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Cold-Chain Analysis */}
              {selected.in_excursion && (
                <div className="card p-4 border-violet-600/30 bg-violet-600/5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles size={13} className="text-violet-400" />
                      <span className="text-xs font-semibold text-violet-300">AI Excursion Analysis</span>
                    </div>
                    <button
                      onClick={() => {
                        setAiAnalysis(null)
                        setAiLoading(true)
                        apiClient.getColdChainAnalysis(selected.id)
                          .then(r => { setAiAnalysis(r.data); setAiLoading(false) })
                          .catch(() => setAiLoading(false))
                      }}
                      disabled={aiLoading}
                      className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    >
                      {aiLoading ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                      {aiLoading ? 'Analysing…' : 'Analyse Excursion'}
                    </button>
                  </div>
                  {aiAnalysis ? (
                    <div>
                      <p className="text-sm text-slate-200 leading-relaxed">{aiAnalysis.text}</p>
                      <p className="text-[10px] text-slate-600 mt-2">
                        {aiAnalysis.configured ? 'IBM Granite · watsonx.ai' : 'Rule-based · add WATSONX_API_KEY to enable live AI'}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">Click "Analyse Excursion" to get an AI assessment of product integrity and recommended actions.</p>
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
