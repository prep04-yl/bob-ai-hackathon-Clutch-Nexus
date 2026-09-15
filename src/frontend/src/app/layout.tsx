import type { Metadata } from 'next'
import '../styles/globals.css'
import Sidebar from '@/components/Sidebar'

export const metadata: Metadata = {
  title: 'Clutch Nexus — Supply Chain Control Tower',
  description: 'L2 Supply Chain Disruption Intelligence & Fleet Optimisation',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
        <Sidebar />
        <main style={{ marginLeft: 'var(--sidebar-width)', minHeight: '100vh' }}>
          {children}
        </main>
      </body>
    </html>
  )
}
