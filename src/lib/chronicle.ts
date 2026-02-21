import { supabase } from './supabase'

// ─── Types ───────────────────────────────────────────────────
export interface ChronicleEntry {
  id: string
  user_id?: string
  type: string
  title: string
  description?: string
  start_date: string
  end_date: string | null
  canvas_col: string
  color: string
  fuzzy_start: boolean
  fuzzy_end: boolean
  note?: string
  show_on_resume: boolean
  created_at?: string
  updated_at?: string
}

export interface ChroniclePlace {
  id: string
  user_id?: string
  title: string
  start_date: string
  end_date: string | null
  color: string
  fuzzy_start: boolean
  fuzzy_end: boolean
  note?: string
  show_on_resume: boolean
  created_at?: string
  updated_at?: string
}

// Work entries from existing table, with chronicle columns
export interface ChronicleWorkEntry {
  id: string
  user_id: string
  title: string
  company: string
  start_date: string
  end_date?: string
  is_current: boolean
  chronicle_color?: string
  chronicle_fuzzy_start?: boolean
  chronicle_fuzzy_end?: boolean
  chronicle_note?: string
}

// Contacts from existing table, with chronicle columns
export interface ChronicleContact {
  id: string
  owner_id: string
  full_name: string
  company?: string
  role?: string
  chronicle_color?: string
  chronicle_fuzzy_start?: boolean
  chronicle_fuzzy_end?: boolean
  chronicle_note?: string
  created_at: string
}

// ─── Load all chronicle data ─────────────────────────────────
export async function loadChronicleData() {
  const [entries, places, workEntries, contacts] = await Promise.all([
    supabase.from('chronicle_entries').select('*').order('start_date'),
    supabase.from('chronicle_places').select('*').order('start_date'),
    supabase.from('work_entries').select('id, user_id, title, company, start_date, end_date, is_current, chronicle_color, chronicle_fuzzy_start, chronicle_fuzzy_end, chronicle_note').order('start_date'),
    supabase.from('contacts').select('id, owner_id, full_name, company, role, chronicle_color, chronicle_fuzzy_start, chronicle_fuzzy_end, chronicle_note, created_at').order('full_name'),
  ])

  return {
    entries: (entries.data ?? []) as ChronicleEntry[],
    places: (places.data ?? []) as ChroniclePlace[],
    workEntries: (workEntries.data ?? []) as ChronicleWorkEntry[],
    contacts: (contacts.data ?? []) as ChronicleContact[],
  }
}

// ─── Chronicle Entries CRUD ──────────────────────────────────
export async function upsertEntry(entry: Partial<ChronicleEntry> & { title: string; type: string; start_date: string; canvas_col: string }) {
  const payload = { ...entry, updated_at: new Date().toISOString() }
  if (entry.id) {
    const { data, error } = await supabase
      .from('chronicle_entries')
      .update(payload)
      .eq('id', entry.id)
      .select()
      .single()
    if (error) throw error
    return data as ChronicleEntry
  } else {
    const { data, error } = await supabase
      .from('chronicle_entries')
      .insert(payload)
      .select()
      .single()
    if (error) throw error
    return data as ChronicleEntry
  }
}

export async function deleteEntry(id: string) {
  const { error } = await supabase.from('chronicle_entries').delete().eq('id', id)
  if (error) throw error
}

// ─── Chronicle Places CRUD ───────────────────────────────────
export async function upsertPlace(place: Partial<ChroniclePlace> & { title: string; start_date: string }) {
  const payload = { ...place, updated_at: new Date().toISOString() }
  if (place.id) {
    const { data, error } = await supabase
      .from('chronicle_places')
      .update(payload)
      .eq('id', place.id)
      .select()
      .single()
    if (error) throw error
    return data as ChroniclePlace
  } else {
    const { data, error } = await supabase
      .from('chronicle_places')
      .insert(payload)
      .select()
      .single()
    if (error) throw error
    return data as ChroniclePlace
  }
}

export async function deletePlace(id: string) {
  const { error } = await supabase.from('chronicle_places').delete().eq('id', id)
  if (error) throw error
}

// ─── Update chronicle columns on existing tables ─────────────
export async function updateWorkEntryChronicle(id: string, fields: { chronicle_color?: string; chronicle_fuzzy_start?: boolean; chronicle_fuzzy_end?: boolean; chronicle_note?: string }) {
  const { error } = await supabase.from('work_entries').update(fields).eq('id', id)
  if (error) throw error
}

export async function updateContactChronicle(id: string, fields: { chronicle_color?: string; chronicle_fuzzy_start?: boolean; chronicle_fuzzy_end?: boolean; chronicle_note?: string }) {
  const { error } = await supabase.from('contacts').update(fields).eq('id', id)
  if (error) throw error
}

// ─── Update entry dates after drag/resize ────────────────────
export async function updateEntryDates(id: string, start_date: string, end_date: string | null) {
  const { error } = await supabase
    .from('chronicle_entries')
    .update({ start_date, end_date, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

// ─── Update work entry from chronicle (full fields) ──────────
export async function updateWorkEntryFromChronicle(id: string, fields: {
  start_date?: string
  end_date?: string | null
  is_current?: boolean
  chronicle_color?: string
  chronicle_fuzzy_start?: boolean
  chronicle_fuzzy_end?: boolean
  chronicle_note?: string
}) {
  const { error } = await supabase.from('work_entries').update(fields).eq('id', id)
  if (error) throw error
}

export async function deleteWorkEntry(id: string) {
  const { error } = await supabase.from('work_entries').delete().eq('id', id)
  if (error) throw error
}
