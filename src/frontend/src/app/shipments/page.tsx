'use client'
import { useEffect, useState } from 'react'
import { apiClient, type Shipment, type AIResponse } from '@/lib/api'
import ShipmentTable from '@/components/ShipmentTable'
import { cn, statusColor, priorityColor, priorityLabel, formatCurrency, riskBgColor } from '@/lib/utils'
import { Search, X, Sparkles, Loader2 } from 'lucide-react'

const STATUSES = ['all', 'disrupted', 'at_risk', 'delayed', 'in_transit', 'scheduled', 'delivered']

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [filtered, setFiltered] = useState<Shipment[]>([])
  const [selected, setSelected] = useState<Shipment | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [aiNarrative, setAiNarrative] = useState<AIResponse | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => {
    apiClient.getShipments().then((r) => {
      setShipments(r.data)
      setFiltered(r.data)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    let result = shipments
    if (statusFilter !== 'all') {
      result = result.filter((s) => s.status === statusFilter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (s) =>
          s.tracking_id.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q) ||
          s.origin_port?.code.toLowerCase().includes(q) ||
          s.destination_port?.code.toLowerCase().includes(q)
      )
    }
    setFiltered(result)
  }, [shipments, statusFilter, search])

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Shipments</h1>
          <p className="text-sm text-slate-400 mt-0.5">{filtered.length} of {shipments.length} shipments</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search tracking ID, description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 w-64"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
              <X size={12} />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize',
                statusFilter === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
              )}
            >
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className={cn('flex gap-4', selected ? 'items-start' : '')}>
        {/* Table */}
        <div className={cn('card p-4 overflow-x-auto', selected ? 'flex-1' : 'w-full')}>
          {loading ? (
            <div className="flex items-center justify-center h-40 text-slate-500 text-sm">Loading…</div>
          ) : (
            <ShipmentTable
              shipments={filtered}
              onSelect={setSelected}
              selectedId={selected?.id}
            />
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-80 card p-4 space-y-4 sticky top-6">
            <div className="flex items-start justify-between">
              <div>
                <span className="font-mono text-xs text-blue-400">{selected.tracking_id}</span>
                <p className="text-sm font-semibold text-white mt-0.5">{selected.description}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-500 hover:text-slate-300">
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-800/50 rounded-lg p-2">
                <p className="text-slate-500">Status</p>
                <span className={cn('badge mt-1', statusColor(selected.status))}>
                  {selected.status.replace('_', ' ')}
                </span>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-2">
                <p className="text-slate-500">Priority</p>
                <span className={cn('badge mt-1', priorityColor(selected.priority))}>
                  {priorityLabel(selected.priority)}
                </span>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-2">
                <p className="text-slate-500">Risk Score</p>
                <span className={cn('badge font-mono mt-1', riskBgColor(selected.risk_score))}>
                  {(selected.risk_score * 100).toFixed(0)}%
                </span>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-2">
                <p className="text-slate-500">Delay</p>
                <p className={cn('font-semibold mt-1', selected.delay_hours > 0 ? 'text-orange-400' : 'text-green-400')}>
                  {selected.delay_hours > 0 ? `+${selected.delay_hours}h` : 'On time'}
                </p>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Origin</span>
                <span className="text-slate-200">{selected.origin_port?.name || '—'}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Destination</span>
                <span className="text-slate-200">{selected.destination_port?.name || '—'}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Mode</span>
                <span className="text-slate-200 capitalize">{selected.route?.mode || '—'}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Weight</span>
                <span className="text-slate-200">{selected.weight_tonnes.toLocaleString()} t</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Value</span>
                <span className="text-slate-200">{formatCurrency(selected.value_usd)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Category</span>
                <span className="text-slate-200 capitalize">{selected.category}</span>
              </div>
              {selected.requires_cold_chain && (
                <>
                  <div className="border-t border-slate-700 pt-2 mt-2 text-cyan-400 font-medium">
                    ❄ Cold Chain Required
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Temp Range</span>
                    <span className="text-slate-200">{selected.temp_min_c}°C to {selected.temp_max_c}°C</span>
                  </div>
                  {selected.current_temp_c !== null && (
                    <div className="flex justify-between text-slate-400">
                      <span>Current Temp</span>
                      <span className={
                        selected.current_temp_c! > selected.temp_max_c! + 1 ||
                        selected.current_temp_c! < selected.temp_min_c! - 1
                          ? 'text-red-400 font-semibold' : 'text-green-400'
                      }>
                        {selected.current_temp_c}°C
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>

            {selected.vehicle && (
              <div className="border-t border-slate-700 pt-3">
                <p className="text-xs text-slate-500 mb-1.5">Assigned Vehicle</p>
                <p className="text-xs text-slate-200 font-medium">{selected.vehicle.name}</p>
                <p className="text-[11px] text-slate-500">{selected.vehicle.code} · {selected.vehicle.type}</p>
                <p className="text-[11px] text-slate-500">
                  Status: <span className={cn('font-medium', selected.vehicle.status === 'available' ? 'text-green-400' : 'text-yellow-400')}>
                    {selected.vehicle.status}
                  </span>
                </p>
              </div>
            )}

            {/* AI Risk Narrative */}
            <div className="border-t border-slate-700 pt-3">
              <button
                onClick={() => {
                  setAiNarrative(null)
                  setAiLoading(true)
                  apiClient.getRiskNarrative(selected.id)
                    .then(r => { setAiNarrative(r.data); setAiLoading(false) })
                    .catch(() => setAiLoading(false))
                }}
                disabled={aiLoading}
                className="w-full flex items-center justify-center gap-2 bg-violet-600/20 hover:bg-violet-600/30 border border-violet-600/30 text-violet-300 rounded-lg py-2 text-xs font-medium transition-colors disabled:opacity-60"
              >
                {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {aiLoading ? 'Analysing risk…' : 'AI Risk Explanation'}
              </button>
              {aiNarrative && (
                <div className="mt-2 p-2.5 rounded-lg bg-violet-600/10 border border-violet-600/20">
                  <p className="text-[11px] text-violet-200 leading-relaxed">{aiNarrative.text}</p>
                  <p className="text-[10px] text-slate-600 mt-1">
                    {aiNarrative.configured ? 'IBM Granite · watsonx.ai' : 'Rule-based · add credentials to enable live AI'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
