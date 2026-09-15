'use client'
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api'

// Dynamically import leaflet to avoid SSR issues
const MapComponent = dynamic(() => import('./MapInner'), { ssr: false })

export default function NetworkMap() {
  const [topology, setTopology] = useState<any>(null)

  useEffect(() => {
    apiClient.getNetworkTopology().then((r) => setTopology(r.data))
  }, [])

  if (!topology) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 text-sm">
        Loading network map…
      </div>
    )
  }

  return <MapComponent topology={topology} />
}
