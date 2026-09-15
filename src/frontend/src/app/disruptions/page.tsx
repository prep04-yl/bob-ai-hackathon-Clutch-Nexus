'use client'
import { useEffect, useState } from 'react'
import { apiClient, type Disruption, type AIResponse } from '@/lib/api'
import { cn, severityColor, formatCurrency } from '@/lib/utils'
import { AlertTriangle, ChevronRight, Clock, Package, DollarSign, Sparkles, Loader2 } from 'lucide-react'
import { format } from 'date-fns'

export default function DisruptionsPage() {
  const [disruptions, setDisruptions] = useState<Disruption[]>([])
  const [selected, setSelected] = useState<Disruption | null>(null)
  const [impact, setImpact] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [aiExplanation, setAiExplanation] = useState<AIResponse | null>(null)
  const [aiActions, setAiActions] = useState<AIResponse | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => {
    apiClient.getDisruptions().then((r) => {
      setDisruptions(r.data)
      if (r.data.length > 0) {
        handleSelect(r.data[0])
      }
      setLoading(false)
    })
  }, [])

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

  const typeIcon: Record<string, string> = {
    port_closure: '🏗️',
    weather: '🌪️',
    strike: '✊',
    geopolitical: '🌍',
    equipment_failure: '⚙️',
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Disruptions</h1>
          <p className="text-sm text-slate-400 mt-0.5">Active supply chain disruptions and impact cascade</p>
        </div>
        {selected && (
          <button
            onClick={runAI}
            disabled={aiLoading}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {aiLoading
              ? <><Loader2 size={14} className="animate-spin" /> Analysing…</>
              : <><Sparkles size={14} /> AI Analysis</>
            }
          </button>
        )}
      </div>

      <div className="flex gap-4">
        {/* List */}
        <div className="w-[360px] shrink-0 space-y-2">
          {disruptions.map((d) => (
            <button
              key={d.id}
              onClick={() => handleSelect(d)}
              className={cn(
                'w-full text-left card p-4 transition-all hover:border-slate-700',
                selected?.id === d.id && 'border-blue-600/50 bg-blue-600/5'
              )}
            >
              <div className="flex items-start gap-3">
                <span className="text-xl mt-0.5">{typeIcon[d.type] || '⚠️'}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={cn('badge text-[10px]', severityColor(d.severity))}>
                      {d.severity.toUpperCase()}
                    </span>
                    {d.is_active && (
                      <span className="flex items-center gap-1 text-[10px] text-red-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        LIVE
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-slate-200 mt-1 leading-snug">{d.title}</p>
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <Package size={10} /> {d.shipments_affected} shipments
                    </span>
                    <span className="flex items-center gap-1">
                      <DollarSign size={10} /> {formatCurrency(d.financial_impact_usd)}
                    </span>
                  </div>
                </div>
                <ChevronRight size={14} className="text-slate-600 mt-1 shrink-0" />
              </div>
            </button>
          ))}
        </div>

        {/* Detail + Impact Cascade */}
        <div className="flex-1 space-y-4">
          {selected && (
            <>
              {/* Overview */}
              <div className="card p-5">
                <div className="flex items-start gap-4">
                  <span className="text-3xl">{typeIcon[selected.type] || '⚠️'}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn('badge', severityColor(selected.severity))}>
                        {selected.severity.toUpperCase()}
                      </span>
                      <span className="text-xs text-slate-500 capitalize">{selected.type.replace('_', ' ')}</span>
                      {selected.is_active && (
                        <span className="flex items-center gap-1 text-xs text-red-400 font-medium">
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                          Active
                        </span>
                      )}
                    </div>
                    <h2 className="text-base font-bold text-white mt-2">{selected.title}</h2>
                    <p className="text-sm text-slate-400 mt-2 leading-relaxed">{selected.description}</p>
                    <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        Started: {format(new Date(selected.started_at), 'dd MMM yyyy, HH:mm')}
                      </span>
                      {selected.estimated_end && (
                        <span className="flex items-center gap-1">
                          <Clock size={11} />
                          Est. end: {format(new Date(selected.estimated_end), 'dd MMM yyyy, HH:mm')}
                        </span>
                      )}
                      {selected.affected_port && (
                        <span className="flex items-center gap-1">
                          <AlertTriangle size={11} />
                          {selected.affected_port.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Impact Cascade */}
              {impact ? (
                <>
                  {/* Cascade metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Shipments Affected', value: impact.cascade.affected_shipments_count, color: 'text-red-400' },
                      { label: 'Cargo Value', value: formatCurrency(impact.cascade.total_cargo_value_usd), color: 'text-orange-400' },
                      { label: 'Cold Chain at Risk', value: impact.cascade.cold_chain_shipments_at_risk, color: 'text-cyan-400' },
                      { label: 'Critical Shipments', value: impact.cascade.critical_shipments_count, color: 'text-red-400' },
                      { label: 'Routes Disrupted', value: impact.cascade.affected_routes_count, color: 'text-yellow-400' },
                      { label: 'Vehicles Impacted', value: impact.cascade.affected_vehicles_count, color: 'text-blue-400' },
                      { label: 'Avg Risk Score', value: `${(impact.cascade.avg_risk_score * 100).toFixed(0)}%`, color: 'text-orange-400' },
                      { label: 'Total Weight', value: `${impact.cascade.total_weight_tonnes.toLocaleString()} t`, color: 'text-slate-300' },
                    ].map((m) => (
                      <div key={m.label} className="card p-3">
                        <p className="text-[11px] text-slate-500">{m.label}</p>
                        <p className={cn('text-lg font-bold mt-1', m.color)}>{m.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Affected shipments */}
                  <div className="card p-4">
                    <h3 className="text-sm font-semibold text-slate-200 mb-3">
                      Affected Shipments ({impact.shipments.length})
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-slate-500 border-b border-slate-800">
                            <th className="pb-2 pr-4">Tracking ID</th>
                            <th className="pb-2 pr-4">Description</th>
                            <th className="pb-2 pr-4">Category</th>
                            <th className="pb-2 pr-4">Status</th>
                            <th className="pb-2 pr-4">Priority</th>
                            <th className="pb-2 pr-4">Risk</th>
                            <th className="pb-2 pr-4">Value</th>
                            <th className="pb-2 pr-4">Delay</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                          {impact.shipments.map((s: any) => (
                            <tr key={s.id}>
                              <td className="py-2 pr-4 font-mono text-blue-400">{s.tracking_id}</td>
                              <td className="py-2 pr-4 text-slate-300 max-w-[180px] truncate">{s.description}</td>
                              <td className="py-2 pr-4 text-slate-400 capitalize">{s.category}</td>
                              <td className="py-2 pr-4">
                                <span className={cn('badge', s.status === 'disrupted' ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400')}>
                                  {s.status}
                                </span>
                              </td>
                              <td className="py-2 pr-4">P{s.priority}</td>
                              <td className="py-2 pr-4 font-mono text-orange-400">{(s.risk_score * 100).toFixed(0)}%</td>
                              <td className="py-2 pr-4">{formatCurrency(s.value_usd)}</td>
                              <td className="py-2 pr-4 text-orange-400">+{s.delay_hours}h</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  </>
                ) : (
                  <div className="card p-8 flex items-center justify-center text-slate-500 text-sm">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2" />
                    Loading impact analysis…
                  </div>
                )}
  
                {/* AI panels */}
                {(aiExplanation || aiActions) && (
                  <div className="space-y-3">
                    {aiExplanation && (
                      <div className="card p-4 border-violet-600/30 bg-violet-600/5">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles size={13} className="text-violet-400" />
                          <span className="text-xs font-semibold text-violet-300">AI Executive Summary</span>
                          <span className="ml-auto text-[10px] text-slate-600 font-mono">
                            {aiExplanation.configured ? 'IBM Granite (watsonx.ai)' : 'Rule-based (configure watsonx.ai for AI)'}
                          </span>
                        </div>
                        <p className="text-sm text-slate-300 leading-relaxed">{aiExplanation.text}</p>
                      </div>
                    )}
                    {aiActions && (
                      <div className="card p-4 border-violet-600/30 bg-violet-600/5">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles size={13} className="text-violet-400" />
                          <span className="text-xs font-semibold text-violet-300">AI Recovery Recommendations</span>
                          <span className="ml-auto text-[10px] text-slate-600 font-mono">
                            {aiActions.configured ? 'IBM Granite (watsonx.ai)' : 'Rule-based'}
                          </span>
                        </div>
                        <pre className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap font-sans">{aiActions.text}</pre>
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

