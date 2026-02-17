import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const inviteCode = user.user_metadata?.invite_code
        const connectUserId = user.user_metadata?.connect_user_id

        // If they signed up with an invite code, redeem it server-side
        if (inviteCode) {
          await redeemInviteServerSide(supabase, user.id, inviteCode)
          await supabase.auth.updateUser({
            data: { invite_code: null }
          })
        }

        // If they signed up from /connect/[userId], redirect there
        // The connect page will handle creating the bidirectional connection
        if (connectUserId) {
          // Clear the metadata so it doesn't fire again
          await supabase.auth.updateUser({
            data: { connect_user_id: null }
          })
          return NextResponse.redirect(`${origin}/connect/${connectUserId}`)
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}

// Server-side invite redemption (same logic as client-side but using the route handler client)
async function redeemInviteServerSide(supabase: any, inviteeId: string, inviteCode: string) {
  const code = inviteCode.trim().toUpperCase()

  // 1. Find the pending connection
  const { data: connection, error: findError } = await supabase
    .from('connections')
    .select('*')
    .eq('invite_code', code)
    .eq('status', 'pending')
    .limit(1)
    .single()

  if (findError || !connection) return
  if (connection.inviter_id === inviteeId) return

  // Check if already connected
  const { data: existing } = await supabase
    .from('connections')
    .select('id')
    .eq('status', 'accepted')
    .or(
      `and(inviter_id.eq.${connection.inviter_id},invitee_id.eq.${inviteeId}),and(inviter_id.eq.${inviteeId},invitee_id.eq.${connection.inviter_id})`
    )
    .limit(1)
    .single()

  if (existing) return

  // 2. Get both users' profiles
  const { data: inviterProfile } = await supabase
    .from('profiles')
    .select('id, full_name, email, avatar_url, location, bio, headline, website')
    .eq('id', connection.inviter_id)
    .single()

  const { data: inviteeProfile } = await supabase
    .from('profiles')
    .select('id, full_name, email, avatar_url, location, bio, headline, website')
    .eq('id', inviteeId)
    .single()

  if (!inviterProfile || !inviteeProfile) return

  // 3. Ensure inviter has a contact card for invitee
  const { data: inviterContact } = await supabase
    .from('contacts')
    .select('id')
    .eq('owner_id', connection.inviter_id)
    .eq('linked_profile_id', inviteeId)
    .limit(1)
    .single()

  let inviterContactId = inviterContact?.id

  if (!inviterContactId) {
    if (connection.contact_id) {
      // Invite was from a specific contact card — link it
      await supabase
        .from('contacts')
        .update({ linked_profile_id: inviteeId })
        .eq('id', connection.contact_id)
      inviterContactId = connection.contact_id
    } else {
      // General invite — check for unlinked contact matching by email
      const { data: matchByEmail } = await supabase
        .from('contacts')
        .select('id')
        .eq('owner_id', connection.inviter_id)
        .is('linked_profile_id', null)
        .ilike('email', inviteeProfile.email || '__no_match__')
        .limit(1)
        .single()

      if (matchByEmail) {
        await supabase
          .from('contacts')
          .update({ linked_profile_id: inviteeId })
          .eq('id', matchByEmail.id)
        inviterContactId = matchByEmail.id
      } else {
        // Create a new contact card
        const { data: newContact } = await supabase
          .from('contacts')
          .insert({
            owner_id: connection.inviter_id,
            linked_profile_id: inviteeId,
            full_name: inviteeProfile.full_name,
            email: inviteeProfile.email,
            avatar_url: inviteeProfile.avatar_url,
            location: inviteeProfile.location,
            bio: inviteeProfile.bio,
            website: inviteeProfile.website,
            relationship_type: 'connection',
          })
          .select('id')
          .single()
        inviterContactId = newContact?.id
      }
    }
  }

  // 4. Ensure invitee has a contact card for inviter
  const { data: inviteeContact } = await supabase
    .from('contacts')
    .select('id')
    .eq('owner_id', inviteeId)
    .eq('linked_profile_id', connection.inviter_id)
    .limit(1)
    .single()

  if (!inviteeContact) {
    // Check for unlinked contact matching by email
    const { data: matchByEmail } = await supabase
      .from('contacts')
      .select('id')
      .eq('owner_id', inviteeId)
      .is('linked_profile_id', null)
      .ilike('email', inviterProfile.email || '__no_match__')
      .limit(1)
      .single()

    if (matchByEmail) {
      await supabase
        .from('contacts')
        .update({ linked_profile_id: connection.inviter_id })
        .eq('id', matchByEmail.id)
    } else {
      await supabase
        .from('contacts')
        .insert({
          owner_id: inviteeId,
          linked_profile_id: connection.inviter_id,
          full_name: inviterProfile.full_name,
          email: inviterProfile.email,
          avatar_url: inviterProfile.avatar_url,
          location: inviterProfile.location,
          bio: inviterProfile.bio,
          website: inviterProfile.website,
          relationship_type: 'connection',
        })
    }
  }

  // 5. Accept the connection
  await supabase
    .from('connections')
    .update({
      invitee_id: inviteeId,
      contact_id: inviterContactId || connection.contact_id,
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    })
    .eq('id', connection.id)

  // 6. If general invite, create a fresh code for the inviter
  if (!connection.contact_id) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let newCode = 'NEXUS-'
    for (let i = 0; i < 6; i++) newCode += chars.charAt(Math.floor(Math.random() * chars.length))
    await supabase.from('connections').insert({
      inviter_id: connection.inviter_id,
      invite_code: newCode,
      status: 'pending',
    })
  }
}
