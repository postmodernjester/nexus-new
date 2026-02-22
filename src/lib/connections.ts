import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

const supabase = createClientComponentClient();

// Generate a unique invite code like NEXUS-A7K3X2
export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 to avoid confusion
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `NEXUS-${code}`;
}

// Get or create a SINGLE reusable invite code for the user (for the dashboard "Share Your Code" section)
// This code is NOT tied to any specific contact — it's a general-purpose code.
// We store it in a connections row with inviter_id=userId, invitee_id=null, contact_id=null, status='pending'.
// We reuse the same code across sessions (don't create new rows each time).
export async function getOrCreateInviteCode(userId: string): Promise<string | null> {
  // Check if user already has a general pending invite code (no contact_id, no invitee_id)
  const { data: existing } = await supabase
    .from('connections')
    .select('invite_code')
    .eq('inviter_id', userId)
    .eq('status', 'pending')
    .is('invitee_id', null)
    .is('contact_id', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (existing?.invite_code) return existing.invite_code;

  // Create a new general invite code
  const code = generateInviteCode();
  const { error } = await supabase.from('connections').insert({
    inviter_id: userId,
    invite_code: code,
    status: 'pending',
  });

  if (error) {
    console.error('Error creating invite code:', error);
    return null;
  }

  return code;
}

// Generate an invite code for a specific contact (from the contacts page "Invite" button)
// Returns { code, error } for the contacts page UI
export async function createInviteForContact(
  userId: string,
  contactId: string
): Promise<{ code: string | null; error: string | null }> {
  // Check if there's already a pending invite for this contact
  const { data: existing } = await supabase
    .from('connections')
    .select('invite_code')
    .eq('inviter_id', userId)
    .eq('contact_id', contactId)
    .eq('status', 'pending')
    .limit(1)
    .single();

  if (existing?.invite_code) return { code: existing.invite_code, error: null };

  const code = generateInviteCode();
  const { error } = await supabase.from('connections').insert({
    inviter_id: userId,
    contact_id: contactId,
    invite_code: code,
    status: 'pending',
  });

  if (error) {
    console.error('Error creating invite for contact:', error);
    return { code: null, error: error.message };
  }

  return { code, error: null };
}

// Alias for backward compatibility — contacts page imports this
export async function createInvite(contactId: string): Promise<{ code: string | null; error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { code: null, error: 'Not logged in' };
  return createInviteForContact(user.id, contactId);
}

// Redeem an invite code — called after user is fully authenticated
// This is the CORE function that ensures bidirectional contacts + connection
export async function redeemInviteCode(
  inviteeId: string,
  inviteCode: string
): Promise<{ success: boolean; error?: string }> {
  const code = inviteCode.trim().toUpperCase();

  // 1. Find the pending connection with this code
  const { data: connection, error: findError } = await supabase
    .from('connections')
    .select('*')
    .eq('invite_code', code)
    .eq('status', 'pending')
    .limit(1)
    .single();

  if (findError || !connection) {
    return { success: false, error: 'Invalid or expired invite code' };
  }

  // Prevent self-connection
  if (connection.inviter_id === inviteeId) {
    return { success: false, error: 'You cannot connect with yourself' };
  }

  // Check if already connected (either direction)
  const { data: existingConnection } = await supabase
    .from('connections')
    .select('id')
    .eq('status', 'accepted')
    .or(
      `and(inviter_id.eq.${connection.inviter_id},invitee_id.eq.${inviteeId}),and(inviter_id.eq.${inviteeId},invitee_id.eq.${connection.inviter_id})`
    )
    .limit(1)
    .single();

  if (existingConnection) {
    return { success: false, error: 'You are already connected with this person' };
  }

  // 2. Get both users' profiles
  const { data: inviterProfile } = await supabase
    .from('profiles')
    .select('id, full_name, email, avatar_url, location, bio, headline, website')
    .eq('id', connection.inviter_id)
    .single();

  const { data: inviteeProfile } = await supabase
    .from('profiles')
    .select('id, full_name, email, avatar_url, location, bio, headline, website')
    .eq('id', inviteeId)
    .single();

  if (!inviterProfile || !inviteeProfile) {
    return { success: false, error: 'Could not find user profiles' };
  }

  // 3. Ensure inviter has a contact card for invitee
  // First check by linked_profile_id
  const { data: inviterContact } = await supabase
    .from('contacts')
    .select('id')
    .eq('owner_id', connection.inviter_id)
    .eq('linked_profile_id', inviteeId)
    .limit(1)
    .single();

  let inviterContactId = inviterContact?.id;

  if (!inviterContactId) {
    if (connection.contact_id) {
      // The invite was created from a specific contact card — link it to the invitee's profile
      await supabase
        .from('contacts')
        .update({ linked_profile_id: inviteeId })
        .eq('id', connection.contact_id);
      inviterContactId = connection.contact_id;
    } else {
      // General invite (from dashboard) — check if inviter has an unlinked contact matching the invitee by email or name
      const { data: matchByEmail } = await supabase
        .from('contacts')
        .select('id')
        .eq('owner_id', connection.inviter_id)
        .is('linked_profile_id', null)
        .ilike('email', inviteeProfile.email || '__no_match__')
        .limit(1)
        .single();

      if (matchByEmail) {
        await supabase
          .from('contacts')
          .update({ linked_profile_id: inviteeId })
          .eq('id', matchByEmail.id);
        inviterContactId = matchByEmail.id;
      } else {
        // Create a new contact card for the inviter
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
          .single();
        inviterContactId = newContact?.id;
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
    .single();

  let inviteeContactId = inviteeContact?.id;

  if (!inviteeContactId) {
    // Check if invitee has an unlinked contact matching the inviter by email
    const { data: matchByEmail } = await supabase
      .from('contacts')
      .select('id')
      .eq('owner_id', inviteeId)
      .is('linked_profile_id', null)
      .ilike('email', inviterProfile.email || '__no_match__')
      .limit(1)
      .single();

    if (matchByEmail) {
      await supabase
        .from('contacts')
        .update({ linked_profile_id: connection.inviter_id })
        .eq('id', matchByEmail.id);
      inviteeContactId = matchByEmail.id;
    } else {
      // Create a new contact card for the invitee
      const { data: newContact } = await supabase
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
        .select('id')
        .single();
      inviteeContactId = newContact?.id;
    }
  }

  // 5. Accept the connection
  const { error: updateError } = await supabase
    .from('connections')
    .update({
      invitee_id: inviteeId,
      contact_id: inviterContactId || connection.contact_id,
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    })
    .eq('id', connection.id);

  if (updateError) {
    console.error('Error accepting connection:', updateError);
    return { success: false, error: 'Failed to accept connection' };
  }

  // 6. If this was a general invite code (no contact_id), create a fresh one for the inviter
  //    so they always have a shareable code available
  if (!connection.contact_id) {
    const newCode = generateInviteCode();
    await supabase.from('connections').insert({
      inviter_id: connection.inviter_id,
      invite_code: newCode,
      status: 'pending',
    });
  }

  return { success: true };
}

// Get all connections for a user (both as inviter and invitee)
export async function getUserConnections(userId: string) {
  const { data, error } = await supabase
    .from('connections')
    .select('*')
    .eq('status', 'accepted')
    .or(`inviter_id.eq.${userId},invitee_id.eq.${userId}`);

  if (error) {
    console.error('Error fetching connections:', error);
    return [];
  }

  return data || [];
}

// Get the connected user IDs for a given user
export async function getConnectedUserIds(userId: string): Promise<string[]> {
  const connections = await getUserConnections(userId);
  const ids = new Set<string>();

  for (const conn of connections) {
    if (conn.inviter_id === userId && conn.invitee_id) {
      ids.add(conn.invitee_id);
    } else if (conn.invitee_id === userId) {
      ids.add(conn.inviter_id);
    }
  }

  return Array.from(ids);
}

// ─── Direct connect (link-based, no invite code needed) ──────────
// Used by /connect/[userId] page. Handles contact-aware bidirectional linking.
// If contactId is provided, it references the inviter's existing contact card for the invitee.
export async function connectDirectly(
  currentUserId: string,
  targetUserId: string,
  existingContactId?: string | null,
): Promise<{ success: boolean; error?: string }> {
  // 1. Prevent self-connection
  if (currentUserId === targetUserId) {
    return { success: false, error: 'You cannot connect with yourself' };
  }

  // 2. Check if already connected (either direction)
  const { data: existingConnection } = await supabase
    .from('connections')
    .select('id')
    .eq('status', 'accepted')
    .or(
      `and(inviter_id.eq.${targetUserId},invitee_id.eq.${currentUserId}),and(inviter_id.eq.${currentUserId},invitee_id.eq.${targetUserId})`
    )
    .limit(1)
    .single();

  if (existingConnection) {
    return { success: false, error: 'Already connected' };
  }

  // 3. Get both profiles
  const [{ data: targetProfile }, { data: currentProfile }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email, avatar_url, location, bio, headline, website').eq('id', targetUserId).single(),
    supabase.from('profiles').select('id, full_name, email, avatar_url, location, bio, headline, website').eq('id', currentUserId).single(),
  ]);

  if (!targetProfile || !currentProfile) {
    return { success: false, error: 'Could not find user profiles' };
  }

  // 4. Ensure target (link sender) has a contact card for current user (link clicker)
  //    Check by linked_profile_id first
  const { data: targetHasCard } = await supabase
    .from('contacts')
    .select('id')
    .eq('owner_id', targetUserId)
    .eq('linked_profile_id', currentUserId)
    .limit(1)
    .single();

  let targetContactId = targetHasCard?.id;

  if (!targetContactId) {
    if (existingContactId) {
      // The link specified a contact card — link it to the current user's profile
      await supabase
        .from('contacts')
        .update({ linked_profile_id: currentUserId })
        .eq('id', existingContactId)
        .eq('owner_id', targetUserId);
      targetContactId = existingContactId;
    } else {
      // No specific card — try matching by email
      const { data: matchByEmail } = await supabase
        .from('contacts')
        .select('id')
        .eq('owner_id', targetUserId)
        .is('linked_profile_id', null)
        .ilike('email', currentProfile.email || '__no_match__')
        .limit(1)
        .single();

      if (matchByEmail) {
        await supabase
          .from('contacts')
          .update({ linked_profile_id: currentUserId })
          .eq('id', matchByEmail.id);
        targetContactId = matchByEmail.id;
      } else {
        // Create a new card for the target
        const { data: newContact } = await supabase
          .from('contacts')
          .insert({
            owner_id: targetUserId,
            linked_profile_id: currentUserId,
            full_name: currentProfile.full_name,
            email: currentProfile.email,
          })
          .select('id')
          .single();
        targetContactId = newContact?.id;
      }
    }
  }

  // 5. Ensure current user (link clicker) has a contact card for target (link sender)
  const { data: currentHasCard } = await supabase
    .from('contacts')
    .select('id')
    .eq('owner_id', currentUserId)
    .eq('linked_profile_id', targetUserId)
    .limit(1)
    .single();

  if (!currentHasCard) {
    // Try matching by email
    const { data: matchByEmail } = await supabase
      .from('contacts')
      .select('id')
      .eq('owner_id', currentUserId)
      .is('linked_profile_id', null)
      .ilike('email', targetProfile.email || '__no_match__')
      .limit(1)
      .single();

    if (matchByEmail) {
      await supabase
        .from('contacts')
        .update({ linked_profile_id: targetUserId })
        .eq('id', matchByEmail.id);
    } else {
      // Create a new card for the current user
      await supabase
        .from('contacts')
        .insert({
          owner_id: currentUserId,
          linked_profile_id: targetUserId,
          full_name: targetProfile.full_name,
          email: targetProfile.email,
        });
    }
  }

  // 6. Create the accepted connection record
  const { error: insertError } = await supabase.from('connections').insert({
    inviter_id: targetUserId,
    invitee_id: currentUserId,
    contact_id: targetContactId,
    invite_code: generateInviteCode(), // connections table requires a unique code
    status: 'accepted',
    accepted_at: new Date().toISOString(),
  });

  if (insertError) {
    console.error('Error creating connection:', insertError);
    return { success: false, error: 'Failed to create connection' };
  }

  return { success: true };
}

// Get pending invites sent by a user
export async function getPendingInvites(userId: string) {
  const { data, error } = await supabase
    .from('connections')
    .select('*, contacts(full_name)')
    .eq('inviter_id', userId)
    .eq('status', 'pending')
    .not('contact_id', 'is', null);  // Only show contact-specific invites, not general codes

  if (error) {
    console.error('Error fetching pending invites:', error);
    return [];
  }

  return data || [];
}
