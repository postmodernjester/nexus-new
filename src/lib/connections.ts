import { supabase } from './supabase';

/**
 * Generate a unique invite code like "NEXUS-A7K3X2"
 */
function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1 to avoid confusion
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `NEXUS-${code}`;
}

/**
 * Create an invite for a contact. Returns the invite code.
 * If the contact already has a pending invite, returns that code instead.
 */
export async function createInvite(contactId: string): Promise<{ code: string | null; error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { code: null, error: 'Not logged in' };

  // Check if this contact already has a pending invite
  const { data: existing } = await supabase
    .from('connections')
    .select('invite_code')
    .eq('inviter_id', user.id)
    .eq('contact_id', contactId)
    .eq('status', 'pending')
    .single();

  if (existing) {
    return { code: existing.invite_code, error: null };
  }

  // Generate a unique code (retry if collision)
  let attempts = 0;
  while (attempts < 5) {
    const code = generateCode();
    const { error: insertError } = await supabase
      .from('connections')
      .insert({
        inviter_id: user.id,
        contact_id: contactId,
        invite_code: code,
        status: 'pending',
      });

    if (!insertError) {
      return { code, error: null };
    }

    // If it's a unique constraint violation, try again with a new code
    if (insertError.code === '23505') {
      attempts++;
      continue;
    }

    return { code: null, error: insertError.message };
  }

  return { code: null, error: 'Failed to generate unique code after 5 attempts' };
}

/**
 * Redeem an invite code. Links the current user as the invitee.
 */
export async function redeemInvite(code: string): Promise<{ success: boolean; error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not logged in' };

  const trimmedCode = code.trim().toUpperCase();

  // Find the pending invite
  const { data: invite, error: findError } = await supabase
    .from('connections')
    .select('*')
    .eq('invite_code', trimmedCode)
    .eq('status', 'pending')
    .single();

  if (findError || !invite) {
    return { success: false, error: 'Invalid or expired invite code' };
  }

  // Can't accept your own invite
  if (invite.inviter_id === user.id) {
    return { success: false, error: "You can't accept your own invite" };
  }

  // Check if already connected
  if (invite.invitee_id === user.id) {
    return { success: false, error: 'Already connected' };
  }

  // Accept the invite
  const { error: updateError } = await supabase
    .from('connections')
    .update({
      invitee_id: user.id,
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    })
    .eq('id', invite.id);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  return { success: true, error: null };
}

/**
 * Get all connections for the current user (both as inviter and invitee).
 */
export async function getConnections(): Promise<{ connections: any[]; error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { connections: [], error: 'Not logged in' };

  const { data, error } = await supabase
    .from('connections')
    .select('*')
    .eq('status', 'accepted')
    .or(`inviter_id.eq.${user.id},invitee_id.eq.${user.id}`);

  if (error) return { connections: [], error: error.message };
  return { connections: data || [], error: null };
}

/**
 * Get pending invites created by the current user.
 */
export async function getPendingInvites(): Promise<{ invites: any[]; error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { invites: [], error: 'Not logged in' };

  const { data, error } = await supabase
    .from('connections')
    .select('*, contacts(full_name)')
    .eq('inviter_id', user.id)
    .eq('status', 'pending');

  if (error) return { invites: [], error: error.message };
  return { invites: data || [], error: null };
}
