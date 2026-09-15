import type { Metadata } from 'next'
import '../styles/globals.css'
import Sidebar from '@/components/Sidebar'

export const metadata: Metadata = {
  title: 'Clutch Nexus – Supply Chain Disruption Assistant',
  description: 'L2 Supply Chain Disruption & Fleet Utilisation Optimizer',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 min-h-screen">
        <Sidebar />
        <main className="ml-[240px] min-h-screen">
          {children}
        </main>
      </body>
    </html>
  )
}
