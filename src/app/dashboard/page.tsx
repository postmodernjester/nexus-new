'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      setUser(session.user)
      setLoading(false)
    }
    getUser()
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          NEXUS
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm">{user?.email}</span>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <h2 className="text-3xl font-bold mb-2">Welcome to NEXUS</h2>
        <p className="text-gray-400 mb-10">Your professional network, your way.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link href="/resume" className="block bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-blue-500 hover:bg-gray-800 transition-all cursor-pointer group">
            <div className="text-3xl mb-3">📄</div>
            <h3 className="text-xl font-semibold mb-2 group-hover:text-blue-400 transition-colors">Smart Resume</h3>
            <p className="text-gray-400 text-sm">Build and manage your professional experience with AI-powered insights.</p>
          </Link>

          <Link href="/contacts" className="block bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-purple-500 hover:bg-gray-800 transition-all cursor-pointer group">
            <div className="text-3xl mb-3">👥</div>
            <h3 className="text-xl font-semibold mb-2 group-hover:text-purple-400 transition-colors">Contact CRM</h3>
            <p className="text-gray-400 text-sm">Track relationships, notes, and communications with your network.</p>
          </Link>

          <Link href="/network" className="block bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-green-500 hover:bg-gray-800 transition-all cursor-pointer group">
            <div className="text-3xl mb-3">🕸️</div>
            <h3 className="text-xl font-semibold mb-2 group-hover:text-green-400 transition-colors">Network Graph</h3>
            <p className="text-gray-400 text-sm">Visualize your professional connections and discover hidden paths.</p>
          </Link>
        </div>
      </main>
    </div>
  )
}
