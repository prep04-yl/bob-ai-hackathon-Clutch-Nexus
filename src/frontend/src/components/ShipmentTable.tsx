import { cn, statusColor, priorityColor, priorityLabel, riskBgColor, formatCurrency } from '@/lib/utils'
import type { Shipment } from '@/lib/api'

interface ShipmentTableProps {
  shipments: Shipment[]
  onSelect?: (s: Shipment) => void
  selectedId?: number
}

export default function ShipmentTable({ shipments, onSelect, selectedId }: ShipmentTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-500 uppercase tracking-wider border-b border-slate-800">
            <th className="pb-3 pr-4 font-medium">Tracking ID</th>
            <th className="pb-3 pr-4 font-medium">Description</th>
            <th className="pb-3 pr-4 font-medium">Route</th>
            <th className="pb-3 pr-4 font-medium">Status</th>
            <th className="pb-3 pr-4 font-medium">Priority</th>
            <th className="pb-3 pr-4 font-medium">Risk</th>
            <th className="pb-3 pr-4 font-medium">Value</th>
            <th className="pb-3 pr-4 font-medium">Delay</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/50">
          {shipments.map((s) => (
            <tr
              key={s.id}
              onClick={() => onSelect?.(s)}
              className={cn(
                'transition-colors',
                onSelect && 'cursor-pointer hover:bg-slate-800/40',
                selectedId === s.id && 'bg-blue-600/10'
              )}
            >
              <td className="py-3 pr-4">
                <span className="font-mono text-xs text-blue-400">{s.tracking_id}</span>
                {s.requires_cold_chain && (
                  <span className="ml-1.5 text-cyan-400 text-[10px]">❄</span>
                )}
              </td>
              <td className="py-3 pr-4">
                <p className="text-slate-200 font-medium truncate max-w-[200px]">{s.description}</p>
                <p className="text-xs text-slate-500 capitalize">{s.category}</p>
              </td>
              <td className="py-3 pr-4">
                <span className="text-xs text-slate-400">
                  {s.origin_port?.code || '—'} → {s.destination_port?.code || '—'}
                </span>
              </td>
              <td className="py-3 pr-4">
                <span className={cn('badge text-[11px]', statusColor(s.status))}>
                  {s.status.replace('_', ' ')}
                </span>
              </td>
              <td className="py-3 pr-4">
                <span className={cn('badge text-[11px]', priorityColor(s.priority))}>
                  {priorityLabel(s.priority)}
                </span>
              </td>
              <td className="py-3 pr-4">
                <span className={cn('badge text-[11px] font-mono', riskBgColor(s.risk_score))}>
                  {(s.risk_score * 100).toFixed(0)}%
                </span>
              </td>
              <td className="py-3 pr-4 text-slate-300 font-mono text-xs">
                {formatCurrency(s.value_usd)}
              </td>
              <td className="py-3 pr-4">
                {s.delay_hours > 0 ? (
                  <span className="text-orange-400 text-xs font-medium">+{s.delay_hours}h</span>
                ) : (
                  <span className="text-green-400 text-xs">On time</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
