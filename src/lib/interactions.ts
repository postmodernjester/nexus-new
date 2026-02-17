import { supabase } from './supabase';

export interface Interaction {
  id: string;
  owner_id: string;
  contact_id: string;
  note: string;
  interaction_date: string;
  action_item: string | null;
  action_due: string | null;
  action_done: boolean;
  created_at: string;
}

export async function createInteraction(data: {
  contact_id: string;
  note: string;
  interaction_date?: string;
  action_item?: string;
  action_due?: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { data: interaction, error } = await supabase
    .from('interactions')
    .insert({
      owner_id: user.id,
      contact_id: data.contact_id,
      note: data.note,
      interaction_date: data.interaction_date || new Date().toISOString(),
      action_item: data.action_item || null,
      action_due: data.action_due || null,
      action_done: false,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, interaction };
}

export async function getInteractions(contactId: string) {
  const { data, error } = await supabase
    .from('interactions')
    .select('*')
    .eq('contact_id', contactId)
    .order('interaction_date', { ascending: false });

  if (error) return { success: false, error: error.message, interactions: [] };
  return { success: true, interactions: data || [] };
}

export async function getInteractionCounts(contactIds: string[]) {
  // Get count and most recent date for each contact
  const { data, error } = await supabase
    .from('interactions')
    .select('contact_id, interaction_date')
    .in('contact_id', contactIds)
    .order('interaction_date', { ascending: false });

  if (error) return {};

  const counts: Record<string, { count: number; mostRecent: string }> = {};
  for (const row of data || []) {
    if (!counts[row.contact_id]) {
      counts[row.contact_id] = { count: 0, mostRecent: row.interaction_date };
    }
    counts[row.contact_id].count++;
  }
  return counts;
}

export async function updateInteraction(id: string, updates: Partial<Interaction>) {
  const { data, error } = await supabase
    .from('interactions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, interaction: data };
}

export async function deleteInteraction(id: string) {
  const { error } = await supabase
    .from('interactions')
    .delete()
    .eq('id', id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function toggleActionDone(id: string, done: boolean) {
  return updateInteraction(id, { action_done: done });
}

export async function getPendingActions() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('interactions')
    .select('*, contacts(first_name, last_name)')
    .eq('owner_id', user.id)
    .eq('action_done', false)
    .not('action_item', 'is', null)
    .order('action_due', { ascending: true });

  if (error) return [];
  return data || [];
}
