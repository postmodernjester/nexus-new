'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { redeemInviteCode } from '@/lib/connections'
import Link from 'next/link'

function LoginForm() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Check for invite code in URL params (from /connect/[userId] redirect)
  useEffect(() => {
    const code = searchParams.get('code')
    const next = searchParams.get('next')
    if (code) {
      setInviteCode(code.toUpperCase())
    }
    // If redirected from /connect page, we might have a next param
    if (next) {
      // Store it so we redirect after login
      sessionStorage.setItem('nexus_redirect_after_login', next)
    }
  }, [searchParams])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError(signInError.message)
        setLoading(false)
        return
      }

      if (data.session) {
        // If there's an invite code, redeem it now (user is authenticated)
        if (inviteCode.trim()) {
          const result = await redeemInviteCode(data.session.user.id, inviteCode.trim())
          if (!result.success) {
            console.log('Invite redeem on login:', result.error)
          }
        }

        // Check for stored redirect
        const redirectTo = sessionStorage.getItem('nexus_redirect_after_login')
        sessionStorage.removeItem('nexus_redirect_after_login')

        window.location.href = redirectTo || '/dashboard'
      } else {
        setError('Login succeeded but no session was created. Please try again.')
        setLoading(false)
      }
    } catch (err) {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md w-full">
      <div className="text-center mb-8">
        <Link href="/" className="text-3xl font-bold text-white tracking-tight">
          NEXUS
        </Link>
        <p className="text-zinc-400 mt-2">Welcome back</p>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
        <form onSubmit={handleLogin} className="space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          {inviteCode && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-amber-400 text-sm">
              Sign in to connect with code <span className="font-mono font-bold">{inviteCode}</span>
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-zinc-300 mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-zinc-300 mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
              placeholder="Your password"
            />
          </div>

          {!inviteCode && (
            <div>
              <label htmlFor="inviteCode" className="block text-sm font-medium text-zinc-300 mb-1.5">
                Invite Code <span className="text-zinc-500 font-normal">(optional)</span>
              </label>
              <input
                id="inviteCode"
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition font-mono tracking-wider"
                placeholder="NEXUS-XXXXXX"
                maxLength={12}
              />
              <p className="text-zinc-600 text-xs mt-1">Have a code? Enter it to connect on login.</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-zinc-400 text-sm mt-6">
          Don&apos;t have an account?{' '}
          <Link href={inviteCode ? `/signup?code=${inviteCode}` : '/signup'} className="text-amber-500 hover:text-amber-400 font-medium">
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <Suspense fallback={
        <div className="max-w-md w-full text-center">
          <div className="text-3xl font-bold text-white tracking-tight mb-4">NEXUS</div>
          <div className="text-zinc-500">Loading...</div>
        </div>
      }>
        <LoginForm />
      </Suspense>
    </div>
  )
}
