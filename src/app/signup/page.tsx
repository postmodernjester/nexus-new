'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function SignUpPage() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [connectUserId, setConnectUserId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  // Pre-fill invite code from URL params
  // ?code=NEXUS-XXXXXX → direct invite code entry
  // ?connect=userId → store the userId separately, redirect after signup to /connect/[userId]
  useEffect(() => {
    const code = searchParams.get('code')
    const connect = searchParams.get('connect')
    if (code) {
      setInviteCode(code.toUpperCase())
    }
    // If coming from /connect/[userId], store the userId for post-signup redirect
    // Do NOT use the userId as an invite code — it's a UUID, not a NEXUS-XXXXXX code
    if (connect) {
      setConnectUserId(connect)
    }
  }, [searchParams])

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Build the redirect URL — if coming from /connect/[userId], redirect there after email confirmation
      const redirectBase = window.location.origin
      const redirectPath = connectUserId
        ? `/auth/callback?next=/connect/${connectUserId}`
        : '/auth/callback'

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            invite_code: inviteCode.trim() || null,
            connect_user_id: connectUserId || null,
          },
          emailRedirectTo: `${redirectBase}${redirectPath}`,
        },
      })

      if (signUpError) {
        setError(signUpError.message)
        setLoading(false)
        return
      }

      if (data.user) {
        setSuccess(true)
      }
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
            <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Check your email</h2>
            <p className="text-zinc-400">
              We sent a confirmation link to <span className="text-white font-medium">{email}</span>. 
              Click the link to activate your account.
            </p>
            {connectUserId && (
              <p className="text-zinc-500 text-sm mt-3">
                After confirming, you&apos;ll be automatically connected.
              </p>
            )}
            {inviteCode.trim() && !connectUserId && (
              <p className="text-zinc-500 text-sm mt-3">
                Your invite code <span className="font-mono text-amber-500/70">{inviteCode}</span> will be applied once you confirm your email.
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-bold text-white tracking-tight">
            NEXUS
          </Link>
          <p className="text-zinc-400 mt-2">Create your account</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
          <form onSubmit={handleSignUp} className="space-y-5">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            {connectUserId && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-amber-400 text-sm">
                🤝 You&apos;ll be connected automatically after signing up.
              </div>
            )}

            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-zinc-300 mb-1.5">
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
                placeholder="Your full name"
              />
            </div>

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
                minLength={8}
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
                placeholder="At least 8 characters"
              />
            </div>

            {/* Only show invite code field if NOT coming from a connect link */}
            {!connectUserId && (
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
                <p className="text-zinc-600 text-xs mt-1">Got a code from someone? Enter it to connect.</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating account...' : connectUserId ? 'Create Account & Connect' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-zinc-400 text-sm mt-6">
            Already have an account?{' '}
            <Link href="/login" className="text-amber-500 hover:text-amber-400 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
