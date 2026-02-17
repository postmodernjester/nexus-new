'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { redeemInviteCode, getOrCreateInviteCode } from '@/lib/connections'
import Link from 'next/link'

type ConnectState = 'loading' | 'not-found' | 'self' | 'not-logged-in' | 'already-connected' | 'connecting' | 'connected' | 'error'

export default function ConnectPage() {
  const params = useParams()
  const router = useRouter()
  const targetUserId = params.userId as string

  const [state, setState] = useState<ConnectState>('loading')
  const [targetProfile, setTargetProfile] = useState<any>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    handleConnect()
  }, [targetUserId])

  async function handleConnect() {
    setState('loading')

    // 1. Fetch the target user's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, headline, bio')
      .eq('id', targetUserId)
      .single()

    if (profileError || !profile) {
      setState('not-found')
      return
    }
    setTargetProfile(profile)

    // 2. Check if the current user is logged in
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setState('not-logged-in')
      return
    }
    setCurrentUser(user)

    // 3. Self-check
    if (user.id === targetUserId) {
      setState('self')
      return
    }

    // 4. Check if already connected
    const { data: existingConnection } = await supabase
      .from('connections')
      .select('id')
      .eq('status', 'accepted')
      .or(
        `and(inviter_id.eq.${targetUserId},invitee_id.eq.${user.id}),and(inviter_id.eq.${user.id},invitee_id.eq.${targetUserId})`
      )
      .limit(1)
      .single()

    if (existingConnection) {
      setState('already-connected')
      return
    }

    // 5. Find or create a pending invite from the target user, then redeem it
    setState('connecting')

    // Check if target user has a pending invite code we can use
    const { data: pendingInvite } = await supabase
      .from('connections')
      .select('invite_code')
      .eq('inviter_id', targetUserId)
      .eq('status', 'pending')
      .is('invitee_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (pendingInvite?.invite_code) {
      // Redeem the existing invite
      const result = await redeemInviteCode(user.id, pendingInvite.invite_code)
      if (result.success) {
        setState('connected')
      } else {
        setErrorMsg(result.error || 'Failed to connect')
        setState('error')
      }
    } else {
      // No pending invite from this user — we need to create a direct connection
      // Create bidirectional contacts and a connection record
      const result = await createDirectConnection(user.id, targetUserId)
      if (result.success) {
        setState('connected')
      } else {
        setErrorMsg(result.error || 'Failed to connect')
        setState('error')
      }
    }
  }

  async function createDirectConnection(currentUserId: string, targetId: string) {
    try {
      // Get both profiles
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url, location, bio, website')
        .eq('id', currentUserId)
        .single()

      const { data: theirProfile } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url, location, bio, website')
        .eq('id', targetId)
        .single()

      if (!myProfile || !theirProfile) {
        return { success: false, error: 'Could not load profiles' }
      }

      // Ensure I have a contact card for them
      const { data: myContactForThem } = await supabase
        .from('contacts')
        .select('id')
        .eq('owner_id', currentUserId)
        .eq('linked_profile_id', targetId)
        .limit(1)
        .single()

      if (!myContactForThem) {
        await supabase.from('contacts').insert({
          owner_id: currentUserId,
          linked_profile_id: targetId,
          full_name: theirProfile.full_name,
          email: theirProfile.email,
          avatar_url: theirProfile.avatar_url,
          location: theirProfile.location,
          bio: theirProfile.bio,
          website: theirProfile.website,
          relationship_type: 'connection',
        })
      }

      // Ensure they have a contact card for me
      const { data: theirContactForMe } = await supabase
        .from('contacts')
        .select('id')
        .eq('owner_id', targetId)
        .eq('linked_profile_id', currentUserId)
        .limit(1)
        .single()

      if (!theirContactForMe) {
        await supabase.from('contacts').insert({
          owner_id: targetId,
          linked_profile_id: currentUserId,
          full_name: myProfile.full_name,
          email: myProfile.email,
          avatar_url: myProfile.avatar_url,
          location: myProfile.location,
          bio: myProfile.bio,
          website: myProfile.website,
          relationship_type: 'connection',
        })
      }

      // Create the connection record
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
      let code = ''
      for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length))

      await supabase.from('connections').insert({
        inviter_id: targetId,
        invitee_id: currentUserId,
        invite_code: `NEXUS-${code}`,
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })

      return { success: true }
    } catch (err) {
      console.error('Direct connection error:', err)
      return { success: false, error: 'Something went wrong' }
    }
  }

  // --- RENDER ---

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400 flex items-center gap-3">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Connecting...
        </div>
      </div>
    )
  }

  if (state === 'not-found') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
            <div className="text-4xl mb-4">🔍</div>
            <h2 className="text-xl font-bold text-white mb-2">User not found</h2>
            <p className="text-zinc-400 mb-6">This invite link doesn&apos;t match any user.</p>
            <Link href="/" className="text-amber-500 hover:text-amber-400 font-medium">
              Go to NEXUS
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Profile card component (used in multiple states)
  const ProfileCard = () => (
    <div className="flex items-center gap-4 mb-6">
      {targetProfile?.avatar_url ? (
        <img src={targetProfile.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover" />
      ) : (
        <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 text-xl font-bold">
          {targetProfile?.full_name?.charAt(0) || '?'}
        </div>
      )}
      <div>
        <h3 className="text-lg font-semibold text-white">{targetProfile?.full_name}</h3>
        {targetProfile?.headline && (
          <p className="text-zinc-400 text-sm">{targetProfile.headline}</p>
        )}
      </div>
    </div>
  )

  if (state === 'not-logged-in') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
            <div className="text-4xl mb-4">🤝</div>
            <h2 className="text-xl font-bold text-white mb-4">Connect on NEXUS</h2>
            <ProfileCard />
            <p className="text-zinc-400 mb-6">
              <span className="text-white font-medium">{targetProfile?.full_name}</span> wants to connect with you on NEXUS.
            </p>
            <div className="space-y-3">
              <Link
                href={`/signup?connect=${targetUserId}`}
                className="block w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg transition text-center"
              >
                Create Account &amp; Connect
              </Link>
              <Link
                href={`/login?next=/connect/${targetUserId}`}
                className="block w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-lg transition text-center border border-zinc-700"
              >
                Sign In &amp; Connect
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (state === 'self') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
            <div className="text-4xl mb-4">🪞</div>
            <h2 className="text-xl font-bold text-white mb-2">That&apos;s you!</h2>
            <p className="text-zinc-400 mb-6">You can&apos;t connect with yourself. Share this link with others to connect.</p>
            <Link href="/dashboard" className="text-amber-500 hover:text-amber-400 font-medium">
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (state === 'already-connected') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
            <div className="text-4xl mb-4">✅</div>
            <h2 className="text-xl font-bold text-white mb-4">Already Connected</h2>
            <ProfileCard />
            <p className="text-zinc-400 mb-6">
              You&apos;re already connected with <span className="text-white font-medium">{targetProfile?.full_name}</span>.
            </p>
            <Link href="/contacts" className="text-amber-500 hover:text-amber-400 font-medium">
              View Contacts
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (state === 'connecting') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400 flex items-center gap-3">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Setting up your connection...
        </div>
      </div>
    )
  }

  if (state === 'connected') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
            <div className="text-4xl mb-4">🎉</div>
            <h2 className="text-xl font-bold text-white mb-4">Connected!</h2>
            <ProfileCard />
            <p className="text-zinc-400 mb-6">
              You and <span className="text-white font-medium">{targetProfile?.full_name}</span> are now connected on NEXUS.
            </p>
            <div className="space-y-3">
              <Link
                href="/contacts"
                className="block w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg transition text-center"
              >
                View Contacts
              </Link>
              <Link
                href="/network"
                className="block w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-lg transition text-center border border-zinc-700"
              >
                View Network
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-white mb-2">Connection Failed</h2>
          <p className="text-zinc-400 mb-6">{errorMsg}</p>
          <button
            onClick={() => handleConnect()}
            className="text-amber-500 hover:text-amber-400 font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    </div>
  )
}
