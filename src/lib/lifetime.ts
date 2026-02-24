import { supabase } from './supabase'

// ─── Auth helper ─────────────────────────────────────────────
async function getUserId(): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Not authenticated')
  return user.id
}

// ─── Types ───────────────────────────────────────────────────
export interface LifetimeYear {
  year: number
  age: number | null
  notes: string
  // Auto-context from existing data
  work: { title: string; company: string }[]
  education: { institution: string; degree?: string }[]
  places: string[]
  gatherings: string[]
  people: string[]
  entries: { title: string; cat: string }[]  // other chronicle entries
}

// ─── Load all lifetime data ─────────────────────────────────
export async function loadLifetimeData(): Promise<{
  years: LifetimeYear[]
  birthday: string | null
}> {
  const userId = await getUserId()

  const [profileRes, workRes, eduRes, placesRes, entriesRes, contactsRes, notesRes] = await Promise.all([
    supabase.from('profiles').select('birthday').eq('id', userId).single(),
    supabase.from('work_entries').select('title, company, start_date, end_date, is_current').eq('user_id', userId).order('start_date'),
    supabase.from('education').select('institution, degree, field_of_study, start_date, end_date, is_current').eq('user_id', userId).order('start_date'),
    supabase.from('chronicle_places').select('title, start_date, end_date').eq('user_id', userId).order('start_date'),
    supabase.from('chronicle_entries').select('title, canvas_col, start_date, end_date').eq('user_id', userId).order('start_date'),
    supabase.from('contacts').select('full_name, met_date, created_at').eq('owner_id', userId).eq('show_on_chronicle', true).order('full_name'),
    supabase.from('lifetime_years').select('year, notes').eq('user_id', userId).order('year'),
  ])

  const birthday = profileRes.data?.birthday || null
  const birthYear = birthday ? parseInt(birthday.split('-')[0]) : null
  const currentYear = new Date().getFullYear()
  const startYear = birthYear || currentYear - 30
  const endYear = currentYear

  const work = (workRes.data ?? []) as { title: string; company: string; start_date: string; end_date?: string; is_current: boolean }[]
  const edu = (eduRes.data ?? []) as { institution: string; degree?: string; field_of_study?: string; start_date: string; end_date?: string; is_current: boolean }[]
  const places = (placesRes.data ?? []) as { title: string; start_date: string; end_date?: string | null }[]
  const entries = (entriesRes.data ?? []) as { title: string; canvas_col: string; start_date: string; end_date?: string | null }[]
  const contacts = (contactsRes.data ?? []) as { full_name: string; met_date?: string; created_at: string }[]
  const savedNotes: Record<number, string> = {}
  if (notesRes.data) {
    for (const row of notesRes.data as { year: number; notes: string }[]) {
      savedNotes[row.year] = row.notes
    }
  }

  // Helper: does a date range span a year?
  function spansYear(startDate: string, endDate: string | null | undefined, isCurrent: boolean, year: number): boolean {
    const sy = parseInt(startDate?.split('-')[0])
    if (isNaN(sy)) return false
    const ey = isCurrent ? currentYear : (endDate ? parseInt(endDate.split('-')[0]) : sy)
    return sy <= year && (isNaN(ey) ? sy : ey) >= year
  }

  function yearFromDate(d: string | null | undefined): number | null {
    if (!d) return null
    const y = parseInt(d.split('-')[0])
    return isNaN(y) ? null : y
  }

  const years: LifetimeYear[] = []
  for (let y = startYear; y <= endYear; y++) {
    const age = birthYear ? y - birthYear : null

    const yearWork = work
      .filter(w => spansYear(w.start_date, w.end_date, w.is_current, y))
      .map(w => ({ title: w.title || '', company: w.company || '' }))

    const yearEdu = edu
      .filter(e => spansYear(e.start_date, e.end_date, e.is_current, y))
      .map(e => ({ institution: e.institution, degree: e.degree }))

    const yearPlaces = places
      .filter(p => spansYear(p.start_date, p.end_date, false, y))
      .map(p => p.title)

    const yearGatherings = entries
      .filter(e => e.canvas_col === 'gatherings' && spansYear(e.start_date, e.end_date, false, y))
      .map(e => e.title)

    const yearPeople = contacts
      .filter(c => {
        const metYear = yearFromDate(c.met_date) || yearFromDate(c.created_at)
        return metYear === y
      })
      .map(c => c.full_name)

    const yearEntries = entries
      .filter(e => e.canvas_col !== 'gatherings' && spansYear(e.start_date, e.end_date, false, y))
      .map(e => ({ title: e.title, cat: e.canvas_col }))

    years.push({
      year: y,
      age,
      notes: savedNotes[y] || '',
      work: yearWork,
      education: yearEdu,
      places: yearPlaces,
      gatherings: yearGatherings,
      people: yearPeople,
      entries: yearEntries,
    })
  }

  return { years, birthday }
}

// ─── Save notes for a year ──────────────────────────────────
export async function saveLifetimeNotes(year: number, notes: string) {
  const userId = await getUserId()

  // Try upsert (requires unique constraint on user_id + year)
  const { error } = await supabase
    .from('lifetime_years')
    .upsert(
      { user_id: userId, year, notes, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,year' }
    )

  if (error) {
    console.error('lifetime_years save failed:', error.message)
    throw new Error(`Failed to save notes: ${error.message}`)
  }
}
