'use client'
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface TopologyNode {
  id: number
  code: string
  name: string
  city: string
  country?: string
  lat: number
  lng: number
  type: string
  is_disrupted: boolean
}

interface TopologyEdge {
  id: number
  code: string
  source: number
  target: number
  source_code: string
  target_code: string
  mode: string
  distance_km: number
  transit_days: number
  is_active: boolean
}

interface Props {
  topology: { nodes: TopologyNode[]; edges: TopologyEdge[] }
}

const MODE_COLORS: Record<string, string> = {
  sea: '#3b82f6',
  air: '#f59e0b',
  rail: '#8b5cf6',
  road: '#22c55e',
  multimodal: '#ec4899',
}

export default function MapInner({ topology }: Props) {
  const mapRef = useRef<L.Map | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center: [20, 60],
      zoom: 3,
      zoomControl: true,
      attributionControl: false,
    })

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; CartoDB',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map)

    const nodeMap: Record<number, TopologyNode> = {}
    topology.nodes.forEach((n) => (nodeMap[n.id] = n))

    // Draw edges
    topology.edges.forEach((edge) => {
      const src = nodeMap[edge.source]
      const tgt = nodeMap[edge.target]
      if (!src || !tgt) return
      const color = MODE_COLORS[edge.mode] || '#64748b'
      const line = L.polyline(
        [[src.lat, src.lng], [tgt.lat, tgt.lng]],
        { color, weight: edge.is_active ? 1.5 : 0.5, opacity: 0.55, dashArray: edge.is_active ? undefined : '4,4' }
      ).addTo(map)
      line.bindPopup(
        `<div style="font-family:monospace;font-size:12px;color:#e2e8f0;background:#1e293b;padding:6px;border-radius:6px;">
          <b>${edge.source_code} → ${edge.target_code}</b><br/>
          Mode: ${edge.mode} | ${edge.transit_days}d | ${edge.distance_km.toLocaleString()} km
        </div>`,
        { className: 'dark-popup' }
      )
    })

    // Draw nodes
    topology.nodes.forEach((node) => {
      const isDisrupted = node.is_disrupted
      const color = isDisrupted ? '#ef4444' : node.type === 'air' ? '#f59e0b' : '#3b82f6'
      const radius = node.type === 'sea' ? 8 : 5
      const marker = L.circleMarker([node.lat, node.lng], {
        radius,
        color: isDisrupted ? '#ef4444' : '#1e40af',
        fillColor: color,
        fillOpacity: 0.9,
        weight: isDisrupted ? 2 : 1,
      }).addTo(map)

      marker.bindPopup(
        `<div style="font-family:monospace;font-size:12px;color:#e2e8f0;background:#1e293b;padding:8px;border-radius:6px;min-width:160px;">
          ${isDisrupted ? '<span style="color:#ef4444;font-weight:bold;">⚠ DISRUPTED</span><br/>' : ''}
          <b>${node.name}</b><br/>
          <span style="color:#94a3b8;">${node.code} · ${node.city}, ${node.country}</span><br/>
          Type: ${node.type}
        </div>`,
        { className: 'dark-popup' }
      )

      // Label for major ports
      if (node.type === 'sea') {
        L.tooltip({
          permanent: true,
          direction: 'top',
          offset: [0, -10],
          opacity: 0.85,
          className: 'port-label',
        })
          .setContent(`<span style="font-size:9px;font-weight:600;color:#94a3b8;">${node.code}</span>`)
          .setLatLng([node.lat, node.lng])
          .addTo(map)
      }
    })

    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [topology])

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full rounded-lg overflow-hidden" />
      {/* Legend */}
      <div className="absolute bottom-3 left-3 bg-slate-900/90 border border-slate-700 rounded-lg px-3 py-2 text-[11px] space-y-1 z-[999]">
        {Object.entries(MODE_COLORS).map(([mode, color]) => (
          <div key={mode} className="flex items-center gap-2">
            <span style={{ background: color }} className="w-3 h-0.5 rounded-full inline-block" />
            <span className="text-slate-400 capitalize">{mode}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 mt-1 pt-1 border-t border-slate-700">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
          <span className="text-red-400">Disrupted</span>
        </div>
      </div>
    </div>
  )
}
