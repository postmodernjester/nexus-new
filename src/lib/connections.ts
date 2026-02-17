import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

const supabase = createClientComponentClient();

// Generate a unique invite code like NEXUS-A7K3X2
function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "NEXUS-";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Create an invite for a contact
export async function createInvite(contactId?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in" };

  const code = generateCode();

  const { data, error } = await supabase
    .from("connections")
    .insert({
      inviter_id: user.id,
      invite_code: code,
      contact_id: contactId || null,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    // Retry with new code if duplicate
    if (error.code === "23505") {
      return createInvite(contactId);
    }
    return { success: false, error: error.message };
  }

  return { success: true, code, data };
}

// Redeem an invite code
export async function redeemInvite(code: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in" };

  // Find the pending invite
  const { data: invite, error: findError } = await supabase
    .from("connections")
    .select("*")
    .eq("invite_code", code.toUpperCase().trim())
    .eq("status", "pending")
    .single();

  if (findError || !invite) {
    return { success: false, error: "Invalid or expired invite code" };
  }

  // Can't connect to yourself
  if (invite.inviter_id === user.id) {
    return { success: false, error: "You can't redeem your own invite code" };
  }

  // Check if already connected
  const { data: existing } = await supabase
    .from("connections")
    .select("id")
    .or(
      `and(inviter_id.eq.${user.id},invitee_id.eq.${invite.inviter_id}),and(inviter_id.eq.${invite.inviter_id},invitee_id.eq.${user.id})`
    )
    .eq("status", "accepted");

  if (existing && existing.length > 0) {
    return { success: false, error: "You're already connected" };
  }

  // Accept the invite
  const { error: updateError } = await supabase
    .from("connections")
    .update({
      invitee_id: user.id,
      status: "accepted",
      accepted_at: new Date().toISOString(),
    })
    .eq("id", invite.id);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  // Auto-create contact record for the inviter if they're not already in my contacts
  await autoCreateContact(user.id, invite.inviter_id);

  // Auto-create contact record for me in the inviter's contacts
  await autoCreateContact(invite.inviter_id, user.id);

  return { success: true };
}

// Auto-create a contact record when connecting
async function autoCreateContact(ownerId: string, targetUserId: string) {
  // Check if this person is already in their contacts
  const { data: existingContacts } = await supabase
    .from("contacts")
    .select("id")
    .eq("owner_id", ownerId);

  // Look up the target user's profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, job_title, company")
    .eq("id", targetUserId)
    .single();

  if (!profile) return;

  // Check if any existing contact matches this user (by name or linked user_id)
  // We check contacts that have a connection linking them
  const { data: linkedConnections } = await supabase
    .from("connections")
    .select("contact_id")
    .or(
      `and(inviter_id.eq.${ownerId},invitee_id.eq.${targetUserId}),and(inviter_id.eq.${targetUserId},invitee_id.eq.${ownerId})`
    )
    .eq("status", "accepted")
    .not("contact_id", "is", null);

  if (linkedConnections && linkedConnections.length > 0) {
    // Already have a contact linked via connection
    return;
  }

  // Parse name
  const nameParts = (profile.full_name || "").trim().split(" ");
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

  // Create the contact
  const { data: newContact } = await supabase
    .from("contacts")
    .insert({
      owner_id: ownerId,
      first_name: firstName,
      last_name: lastName,
      job_title: profile.job_title || "",
      company: profile.company || "",
      relationship_type: "professional",
      closeness: 3,
    })
    .select()
    .single();

  // Link this contact to the connection
  if (newContact) {
    await supabase
      .from("connections")
      .update({ contact_id: newContact.id })
      .or(
        `and(inviter_id.eq.${ownerId},invitee_id.eq.${targetUserId}),and(inviter_id.eq.${targetUserId},invitee_id.eq.${ownerId})`
      )
      .eq("status", "accepted")
      .is("contact_id", null);
  }
}

// Get all my connections
export async function getConnections() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("connections")
    .select("*")
    .or(`inviter_id.eq.${user.id},invitee_id.eq.${user.id}`)
    .eq("status", "accepted");

  return data || [];
}

// Get pending invites I've sent
export async function getPendingInvites() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("connections")
    .select("*")
    .eq("inviter_id", user.id)
    .eq("status", "pending");

  return data || [];
}
