import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

const supabase = createClientComponentClient();

export interface Interaction {
  id: string;
  owner_id: string;
  contact_id: string;
  note: string;
  interaction_date: string;
  action_item?: string;
  action_due?: string;
  action_done: boolean;
  created_at: string;
}

// Add an interaction note for a contact
export async function addInteraction(
  contactId: string,
  note: string,
  interactionDate?: string,
  actionItem?: string,
  actionDue?: string
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in" };

  const { data, error } = await supabase
    .from("interactions")
    .insert({
      owner_id: user.id,
      contact_id: contactId,
      note,
      interaction_date: interactionDate || new Date().toISOString(),
      action_item: actionItem || null,
      action_due: actionDue || null,
      action_done: false,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

// Get all interactions for a contact
export async function getInteractions(contactId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("interactions")
    .select("*")
    .eq("owner_id", user.id)
    .eq("contact_id", contactId)
    .order("interaction_date", { ascending: false });

  return data || [];
}

// Update an interaction
export async function updateInteraction(
  interactionId: string,
  updates: Partial<Pick<Interaction, "note" | "interaction_date" | "action_item" | "action_due" | "action_done">>
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in" };

  const { data, error } = await supabase
    .from("interactions")
    .update(updates)
    .eq("id", interactionId)
    .eq("owner_id", user.id)
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

// Mark action item as done
export async function completeAction(interactionId: string) {
  return updateInteraction(interactionId, { action_done: true });
}

// Delete an interaction
export async function deleteInteraction(interactionId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in" };

  const { error } = await supabase
    .from("interactions")
    .delete()
    .eq("id", interactionId)
    .eq("owner_id", user.id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// Get interaction counts per contact (for network graph)
export async function getInteractionCounts() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {};

  const { data } = await supabase
    .from("interactions")
    .select("contact_id, interaction_date")
    .eq("owner_id", user.id);

  const counts: Record<string, { count: number; lastDate: string }> = {};
  if (data) {
    for (const i of data) {
      if (!counts[i.contact_id]) {
        counts[i.contact_id] = { count: 0, lastDate: i.interaction_date };
      }
      counts[i.contact_id].count++;
      if (i.interaction_date > counts[i.contact_id].lastDate) {
        counts[i.contact_id].lastDate = i.interaction_date;
      }
    }
  }
  return counts;
}

// Get pending action items
export async function getPendingActions() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("interactions")
    .select("*, contact:contacts(first_name, last_name)")
    .eq("owner_id", user.id)
    .eq("action_done", false)
    .not("action_item", "is", null)
    .order("action_due", { ascending: true });

  return data || [];
}
