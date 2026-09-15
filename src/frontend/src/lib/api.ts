import axios from 'axios'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export const api = axios.create({
  baseURL: `${API_BASE}/api/v1`,
  timeout: 15000,
})

// ── Types ──────────────────────────────────────────────────────────────────────
export interface Port {
  id: number
  code: string
  name: string
  city: string
  country: string
  lat: number
  lng: number
  type: string
  capacity_teu: number | null
  is_active: boolean
}

export interface Route {
  id: number
  code: string
  origin_port_id: number
  destination_port_id: number
  distance_km: number
  transit_days: number
  mode: string
  cost_per_unit: number
  is_active: boolean
  origin_port?: Port
  destination_port?: Port
}

export interface Vehicle {
  id: number
  code: string
  type: string
  name: string
  capacity_tonnes: number
  capacity_teu: number | null
  current_port_id: number | null
  status: string
  has_cold_chain: boolean
  min_temp_c: number | null
  max_temp_c: number | null
  utilisation_pct: number
  current_port?: Port
}

export interface Shipment {
  id: number
  tracking_id: string
  description: string
  category: string
  origin_port_id: number
  destination_port_id: number
  route_id: number | null
  vehicle_id: number | null
  weight_tonnes: number
  volume_cbm: number
  value_usd: number
  requires_cold_chain: boolean
  temp_min_c: number | null
  temp_max_c: number | null
  current_temp_c: number | null
  status: string
  priority: number
  scheduled_departure: string
  scheduled_arrival: string
  actual_departure: string | null
  estimated_arrival: string | null
  delay_hours: number
  disruption_id: number | null
  risk_score: number
  origin_port?: Port
  destination_port?: Port
  route?: Route
  vehicle?: Vehicle
}

export interface Disruption {
  id: number
  code: string
  title: string
  description: string
  type: string
  severity: string
  affected_port_id: number | null
  affected_route_ids: number[]
  affected_shipment_ids: number[]
  started_at: string
  estimated_end: string | null
  is_active: boolean
  financial_impact_usd: number
  shipments_affected: number
  affected_port?: Port
}

export interface DashboardKPIs {
  total_shipments: number
  disrupted: number
  at_risk: number
  in_transit: number
  delivered: number
  delayed: number
  total_value_at_risk_usd: number
  active_disruptions: number
  fleet_utilisation_avg_pct: number
  cold_chain_excursions: number
  top_disruption: string | null
}

export interface ColdChainExcursion {
  id: number
  shipment_id: number
  tracking_id: string | null
  description: string | null
  timestamp: string
  temperature_c: number
  required_min_c: number | null
  required_max_c: number | null
  excursion_severity: string | null
  humidity_pct: number | null
}

export interface WhatIfResult {
  scenario_name: string
  total_cost_delta_usd: number
  avg_delay_hours: number
  shipments_recovered: number
  risk_reduction_pct: number
  recommendations: Array<{
    tracking_id: string
    description: string
    category: string
    priority: number
    current_status: string
    action: string
    extra_days: number
    extra_cost_usd: number
  }>
}

export interface AIResponse {
  text: string
  model: string
  configured: boolean
  fallback: boolean
}

export interface CopilotResponse {
  answer: string
  model: string
  configured: boolean
  fallback: boolean
}

// ── API calls ──────────────────────────────────────────────────────────────────
export const apiClient = {
  // Dashboard
  getKPIs: () => api.get<DashboardKPIs>('/dashboard/kpis'),
  getShipmentsByStatus: () => api.get<{ status: string; count: number }[]>('/dashboard/shipments-by-status'),
  getShipmentsByCategory: () => api.get<{ category: string; count: number; value_usd: number }[]>('/dashboard/shipments-by-category'),
  getFleetUtilisation: () => api.get<{ code: string; name: string; type: string; utilisation_pct: number; status: string }[]>('/dashboard/fleet-utilisation'),
  getRiskTimeline: () => api.get<{ range: string; count: number }[]>('/dashboard/risk-timeline'),

  // Shipments
  getShipments: (params?: { status?: string; category?: string; priority?: number; disruption_id?: number }) =>
    api.get<Shipment[]>('/shipments/', { params }),
  getShipment: (id: number) => api.get<Shipment>(`/shipments/${id}`),
  getShipmentColdChain: (id: number) => api.get(`/shipments/${id}/cold-chain`),

  // Disruptions
  getDisruptions: () => api.get<Disruption[]>('/disruptions/'),
  getDisruption: (id: number) => api.get<Disruption>(`/disruptions/${id}`),
  getDisruptionImpact: (id: number) => api.get(`/disruptions/${id}/impact`),

  // Fleet
  getFleet: () => api.get<Vehicle[]>('/fleet/'),
  getFleetSummary: () => api.get('/fleet/summary'),
  optimiseFleet: (disruption_id: number, objective: string = 'minimize_delay') =>
    api.post('/fleet/optimise', { disruption_id, objective }),
  getFleetRecommendations: (disruption_id: number) =>
    api.get(`/fleet/recommendations/${disruption_id}`),

  // What-If
  getScenarios: () => api.get<{ key: string; name: string }[]>('/whatif/scenarios'),
  getScenarioResult: (key: string) => api.get<WhatIfResult>(`/whatif/scenarios/${key}`),
  compareScenarios: () => api.get('/whatif/compare'),

  // Cold Chain
  getColdChainExcursions: () => api.get<ColdChainExcursion[]>('/cold-chain/excursions'),
  getColdChainShipments: () => api.get('/cold-chain/shipments'),
  getColdChainSummary: () => api.get('/cold-chain/summary'),

  // Network
  getNetworkTopology: () => api.get('/network/topology'),
  getPorts: () => api.get<Port[]>('/network/ports'),
  getRoutes: () => api.get<Route[]>('/network/routes'),

  // AI — Gemini-powered, falls back to rule-based when GEMINI_API_KEY not set
  getAIStatus: () => api.get('/ai/status'),
  explainDisruption: (id: number) => api.get<AIResponse>(`/ai/disruptions/${id}/explain`),
  recommendActions: (id: number) => api.get<AIResponse>(`/ai/disruptions/${id}/recommend`),
  getRiskNarrative: (id: number) => api.get<AIResponse>(`/ai/shipments/${id}/risk-narrative`),
  getColdChainAnalysis: (id: number) => api.get<AIResponse>(`/ai/shipments/${id}/cold-chain-analysis`),
  copilot: (question: string) => api.post<CopilotResponse>('/ai/copilot', { question }),
}
