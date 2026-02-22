import { supabase } from './supabase'

// ─── Auth helper ─────────────────────────────────────────────
async function getUserId(): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Not authenticated')
  return user.id
}

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
  show_on_resume?: boolean
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
  engagement_type?: string
  location?: string
  remote_type?: string
  description?: string
  ai_skills_extracted?: string[]
  show_on_resume?: boolean
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
  show_on_chronicle?: boolean
  met_date?: string
  created_at: string
}

// Education from existing table, with chronicle columns
export interface ChronicleEducationEntry {
  id: string
  user_id: string
  institution: string
  degree?: string
  field_of_study?: string
  start_date: string
  end_date?: string
  is_current: boolean
  show_on_resume?: boolean
  chronicle_color?: string
  chronicle_fuzzy_start?: boolean
  chronicle_fuzzy_end?: boolean
  chronicle_note?: string
}

// ─── Load all chronicle data ─────────────────────────────────
export async function loadChronicleData() {
  const userId = await getUserId()

  const [entries, places, workEntries, contacts, education] = await Promise.all([
    supabase.from('chronicle_entries').select('*').eq('user_id', userId).order('start_date'),
    supabase.from('chronicle_places').select('*').eq('user_id', userId).order('start_date'),
    supabase.from('work_entries').select('id, user_id, title, company, start_date, end_date, is_current, engagement_type, location, remote_type, description, ai_skills_extracted, chronicle_color, chronicle_fuzzy_start, chronicle_fuzzy_end, chronicle_note').eq('user_id', userId).order('start_date'),
    supabase.from('contacts').select('id, owner_id, full_name, company, role, chronicle_color, chronicle_fuzzy_start, chronicle_fuzzy_end, chronicle_note, show_on_chronicle, met_date, created_at').eq('owner_id', userId).eq('show_on_chronicle', true).order('full_name'),
    supabase.from('education').select('id, user_id, institution, degree, field_of_study, start_date, end_date, is_current, chronicle_color, chronicle_fuzzy_start, chronicle_fuzzy_end, chronicle_note').eq('user_id', userId).order('start_date'),
  ])

  return {
    entries: (entries.data ?? []) as ChronicleEntry[],
    places: (places.data ?? []) as ChroniclePlace[],
    workEntries: (workEntries.data ?? []) as ChronicleWorkEntry[],
    contacts: (contacts.data ?? []) as ChronicleContact[],
    education: (education.data ?? []) as ChronicleEducationEntry[],
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
    const userId = await getUserId()
    const { data, error } = await supabase
      .from('chronicle_entries')
      .insert({ ...payload, user_id: userId })
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
  // Build a clean payload with only defined fields
  const clean: Record<string, unknown> = {}
  if (place.title !== undefined) clean.title = place.title
  if (place.start_date !== undefined) clean.start_date = place.start_date
  if (place.end_date !== undefined) clean.end_date = place.end_date
  if (place.color !== undefined) clean.color = place.color
  if (place.fuzzy_start !== undefined) clean.fuzzy_start = place.fuzzy_start
  if (place.fuzzy_end !== undefined) clean.fuzzy_end = place.fuzzy_end
  if (place.note !== undefined) clean.note = place.note

  if (place.id) {
    // Try with updated_at, fall back without
    let { data, error } = await supabase
      .from('chronicle_places')
      .update({ ...clean, updated_at: new Date().toISOString() })
      .eq('id', place.id)
      .select()
      .single()
    if (error) {
      ;({ data, error } = await supabase
        .from('chronicle_places')
        .update(clean)
        .eq('id', place.id)
        .select()
        .single())
    }
    if (error) throw error
    return data as ChroniclePlace
  } else {
    const userId = await getUserId()
    // Try with updated_at, fall back without
    let { data, error } = await supabase
      .from('chronicle_places')
      .insert({ ...clean, user_id: userId, updated_at: new Date().toISOString() })
      .select()
      .single()
    if (error) {
      ;({ data, error } = await supabase
        .from('chronicle_places')
        .insert({ ...clean, user_id: userId })
        .select()
        .single())
    }
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
  title?: string
  company?: string
  start_date?: string
  end_date?: string | null
  is_current?: boolean
  engagement_type?: string
  location?: string
  remote_type?: string | null
  description?: string
  ai_skills_extracted?: string[]
  show_on_resume?: boolean
  chronicle_color?: string
  chronicle_fuzzy_start?: boolean
  chronicle_fuzzy_end?: boolean
  chronicle_note?: string
}) {
  // Phase 1: update base columns (always exist per 003_resume_tables migration)
  const { chronicle_color, chronicle_fuzzy_start, chronicle_fuzzy_end, chronicle_note, show_on_resume, ...base } = fields
  const { error } = await supabase.from('work_entries').update(base).eq('id', id)
  if (error) throw error

  // Phase 2: update optional columns that may not exist yet (silently skip on failure)
  const extras: Record<string, unknown> = {}
  if (chronicle_color !== undefined) extras.chronicle_color = chronicle_color
  if (chronicle_fuzzy_start !== undefined) extras.chronicle_fuzzy_start = chronicle_fuzzy_start
  if (chronicle_fuzzy_end !== undefined) extras.chronicle_fuzzy_end = chronicle_fuzzy_end
  if (chronicle_note !== undefined) extras.chronicle_note = chronicle_note
  if (show_on_resume !== undefined) extras.show_on_resume = show_on_resume
  if (Object.keys(extras).length > 0) {
    await supabase.from('work_entries').update(extras).eq('id', id).then(() => {}, () => {})
  }
}

export async function deleteWorkEntry(id: string) {
  const { error } = await supabase.from('work_entries').delete().eq('id', id)
  if (error) throw error
}

// ─── Update education from chronicle ────────────────────────
export async function updateEducationFromChronicle(id: string, fields: {
  start_date?: string
  end_date?: string | null
  is_current?: boolean
  show_on_resume?: boolean
  chronicle_color?: string
  chronicle_fuzzy_start?: boolean
  chronicle_fuzzy_end?: boolean
  chronicle_note?: string
}) {
  // Phase 1: base columns
  const { show_on_resume, chronicle_color, chronicle_fuzzy_start, chronicle_fuzzy_end, chronicle_note, ...base } = fields
  if (Object.keys(base).length > 0) {
    const { error } = await supabase.from('education').update(base).eq('id', id)
    if (error) throw error
  }
  // Phase 2: optional columns (silently skip if missing)
  const extras: Record<string, unknown> = {}
  if (show_on_resume !== undefined) extras.show_on_resume = show_on_resume
  if (chronicle_color !== undefined) extras.chronicle_color = chronicle_color
  if (chronicle_fuzzy_start !== undefined) extras.chronicle_fuzzy_start = chronicle_fuzzy_start
  if (chronicle_fuzzy_end !== undefined) extras.chronicle_fuzzy_end = chronicle_fuzzy_end
  if (chronicle_note !== undefined) extras.chronicle_note = chronicle_note
  if (Object.keys(extras).length > 0) {
    await supabase.from('education').update(extras).eq('id', id).then(() => {}, () => {})
  }
}
