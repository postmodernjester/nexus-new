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

// Get or create an invite code for the current user
export async function getOrCreateInviteCode(userId: string): Promise<string | null> {
  // Check if user already has a pending invite code
  const { data: existing } = await supabase
    .from('connections')
    .select('invite_code')
    .eq('inviter_id', userId)
    .eq('status', 'pending')
    .is('invitee_id', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (existing?.invite_code) return existing.invite_code;

  // Create a new one
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

// Generate an invite code for a specific contact
export async function createInviteForContact(
  userId: string,
  contactId: string
): Promise<string | null> {
  // Check if there's already a pending invite for this contact
  const { data: existing } = await supabase
    .from('connections')
    .select('invite_code')
    .eq('inviter_id', userId)
    .eq('contact_id', contactId)
    .eq('status', 'pending')
    .limit(1)
    .single();

  if (existing?.invite_code) return existing.invite_code;

  const code = generateInviteCode();
  const { error } = await supabase.from('connections').insert({
    inviter_id: userId,
    contact_id: contactId,
    invite_code: code,
    status: 'pending',
  });

  if (error) {
    console.error('Error creating invite for contact:', error);
    return null;
  }

  return code;
}

// Redeem an invite code — called after user is fully authenticated
// This is the CORE function that ensures bidirectional contacts + connection
export async function redeemInviteCode(
  inviteeId: string,
  inviteCode: string
): Promise<{ success: boolean; error?: string }> {
  const code = inviteCode.trim().toUpperCase();

  // 1. Find the pending connection
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

  // 3. Ensure inviter has a contact card for invitee (check by linked_profile_id)
  const { data: inviterContact } = await supabase
    .from('contacts')
    .select('id')
    .eq('owner_id', connection.inviter_id)
    .eq('linked_profile_id', inviteeId)
    .limit(1)
    .single();

  let inviterContactId = inviterContact?.id;

  if (!inviterContactId) {
    // Check if the connection had a contact_id (inviter created contact before inviting)
    if (connection.contact_id) {
      // Link the existing contact to the invitee's profile
      await supabase
        .from('contacts')
        .update({ linked_profile_id: inviteeId })
        .eq('id', connection.contact_id);
      inviterContactId = connection.contact_id;
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

  // 4. Ensure invitee has a contact card for inviter (check by linked_profile_id)
  const { data: inviteeContact } = await supabase
    .from('contacts')
    .select('id')
    .eq('owner_id', inviteeId)
    .eq('linked_profile_id', connection.inviter_id)
    .limit(1)
    .single();

  let inviteeContactId = inviteeContact?.id;

  if (!inviteeContactId) {
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

// Get pending invites sent by a user
export async function getPendingInvites(userId: string) {
  const { data, error } = await supabase
    .from('connections')
    .select('*, contacts(full_name)')
    .eq('inviter_id', userId)
    .eq('status', 'pending');

  if (error) {
    console.error('Error fetching pending invites:', error);
    return [];
  }

  return data || [];
}
