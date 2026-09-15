import { cn, statusColor, priorityColor, priorityLabel, riskBgColor, formatCurrency } from '@/lib/utils'
import type { Shipment } from '@/lib/api'

interface ShipmentTableProps {
  shipments: Shipment[]
  onSelect?: (s: Shipment) => void
  selectedId?: number
}

const STATUS_DOTS: Record<string, string> = {
  disrupted:  'var(--red)',
  at_risk:    'var(--orange)',
  delayed:    'var(--amber)',
  in_transit: '#60a5fa',
  scheduled:  'var(--text-muted)',
  delivered:  'var(--green)',
}

const RISK_COLOR = (s: number) => {
  if (s >= 0.8) return 'var(--red)'
  if (s >= 0.6) return 'var(--orange)'
  if (s >= 0.4) return 'var(--amber)'
  if (s >= 0.2) return '#60a5fa'
  return 'var(--green)'
}

export default function ShipmentTable({ shipments, onSelect, selectedId }: ShipmentTableProps) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Tracking ID</th>
            <th>Description</th>
            <th>Route</th>
            <th>Status</th>
            <th>Priority</th>
            <th>Risk</th>
            <th>Value</th>
            <th>Delay</th>
          </tr>
        </thead>
        <tbody>
          {shipments.map((s) => {
            const isSelected = selectedId === s.id
            const riskPct = Math.round(s.risk_score * 100)
            return (
              <tr
                key={s.id}
                onClick={() => onSelect?.(s)}
                style={{
                  cursor: onSelect ? 'pointer' : undefined,
                  background: isSelected ? 'var(--bg-active)' : undefined,
                  borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
                }}
              >
                <td>
                  <div className="flex items-center gap-1.5">
                    <span className="mono" style={{ color: '#60a5fa' }}>{s.tracking_id}</span>
                    {s.requires_cold_chain && (
                      <span style={{ fontSize: 9, color: 'var(--cyan)', fontWeight: 700, letterSpacing: '0.04em' }}>❄</span>
                    )}
                  </div>
                </td>
                <td>
                  <p style={{ color: 'var(--text-primary)', fontWeight: 500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.description}
                  </p>
                  <p style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'capitalize', marginTop: 1 }}>
                    {s.category}
                  </p>
                </td>
                <td>
                  <span className="mono" style={{ color: 'var(--text-secondary)' }}>
                    {s.origin_port?.code || '—'} → {s.destination_port?.code || '—'}
                  </span>
                </td>
                <td>
                  <div className="flex items-center gap-1.5">
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
                      background: STATUS_DOTS[s.status] || 'var(--text-muted)',
                    }} />
                    <span style={{ fontSize: 11, color: STATUS_DOTS[s.status] || 'var(--text-secondary)', fontWeight: 600, textTransform: 'capitalize' }}>
                      {s.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </td>
                <td>
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.03em',
                    color: s.priority === 1 ? 'var(--red)' : s.priority === 2 ? 'var(--orange)' : s.priority === 3 ? '#60a5fa' : 'var(--text-muted)',
                  }}>
                    P{s.priority}
                  </span>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <div style={{ width: 32, height: 3, background: 'var(--border-subtle)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${riskPct}%`, height: '100%', background: RISK_COLOR(s.risk_score), transition: 'width 0.3s' }} />
                    </div>
                    <span className="mono" style={{ color: RISK_COLOR(s.risk_score) }}>{riskPct}%</span>
                  </div>
                </td>
                <td>
                  <span className="mono" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(s.value_usd)}</span>
                </td>
                <td>
                  {s.delay_hours > 0 ? (
                    <span className="mono" style={{ color: 'var(--amber)', fontWeight: 600 }}>+{s.delay_hours}h</span>
                  ) : (
                    <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 500 }}>On time</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
