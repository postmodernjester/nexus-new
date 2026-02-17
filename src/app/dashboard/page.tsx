'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { redeemInvite, getConnections, getPendingInvites } from '@/lib/connections'
import Link from 'next/link'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
  // Invite code redemption
  const [codeInput, setCodeInput] = useState('')
  const [redeemLoading, setRedeemLoading] = useState(false)
  const [redeemMessage, setRedeemMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  
  // Connection stats
  const [connectionCount, setConnectionCount] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      setUser(session.user)
      setLoading(false)
      
      // Check if they signed up with an invite code that hasn't been redeemed yet
      const pendingCode = session.user.user_metadata?.invite_code
      if (pendingCode) {
        const { success } = await redeemInvite(pendingCode)
        if (success) {
          // Clear the metadata so we don't try again
          await supabase.auth.updateUser({ data: { invite_code: null } })
        }
      }
      
      // Load connection stats
      const connections = await getConnections()
setConnectionCount(connections.length)
const invites = await getPendingInvites()
setPendingCount(invites.length)
    }
    getUser()
  }, [router])

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!codeInput.trim()) return
    setRedeemLoading(true)
    setRedeemMessage(null)
    
    const { success, error } = await redeemInvite(codeInput.trim())
    
    if (success) {
      setRedeemMessage({ type: 'success', text: 'Connected! You\'re now linked with this person.' })
      setCodeInput('')
      setConnectionCount(prev => prev + 1)
    } else {
      setRedeemMessage({ type: 'error', text: error || 'Failed to redeem code' })
    }
    setRedeemLoading(false)
  }

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

        {/* Redeem Invite Code Section */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
          <div className="flex items-start gap-4">
            <div className="text-3xl">🔗</div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-1">Have an invite code?</h3>
              <p className="text-gray-400 text-sm mb-4">Someone shared a NEXUS code with you? Enter it below to connect.</p>
              <form onSubmit={handleRedeem} className="flex gap-3">
                <input
                  type="text"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  placeholder="NEXUS-XXXXXX"
                  maxLength={12}
                  className="flex-1 max-w-xs bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
                />
                <button
                  type="submit"
                  disabled={redeemLoading || !codeInput.trim()}
                  className="bg-amber-500 hover:bg-amber-400 text-black font-semibold px-5 py-2.5 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {redeemLoading ? 'Connecting...' : 'Connect'}
                </button>
              </form>
              {redeemMessage && (
                <div className={`mt-3 text-sm ${redeemMessage.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                  {redeemMessage.text}
                </div>
              )}
            </div>
          </div>
          
          {/* Connection stats */}
          {(connectionCount > 0 || pendingCount > 0) && (
            <div className="mt-4 pt-4 border-t border-gray-800 flex gap-6 text-sm">
              {connectionCount > 0 && (
                <span className="text-gray-400">
                  <span className="text-green-400 font-semibold">{connectionCount}</span> active {connectionCount === 1 ? 'connection' : 'connections'}
                </span>
              )}
              {pendingCount > 0 && (
                <span className="text-gray-400">
                  <span className="text-amber-400 font-semibold">{pendingCount}</span> pending {pendingCount === 1 ? 'invite' : 'invites'}
                </span>
              )}
            </div>
          )}
        </div>

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
