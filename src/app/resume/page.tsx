'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Nav from '@/components/Nav'

interface WorkEntry {
  id?: string
  title: string
  company: string
  location: string
  start_date: string
  end_date: string
  is_current: boolean
  description: string
  engagement_type: string
}

interface EducationEntry {
  id?: string
  institution: string
  degree: string
  field_of_study: string
  start_date: string
  end_date: string
  is_current: boolean
  description: string
}

interface ChronicleResumeEntry {
  id: string
  type: string
  title: string
  start_date: string
  end_date: string | null
  note: string | null
  canvas_col: string
  color: string | null
  show_on_resume: boolean
  description?: string | null
  image_url?: string | null
}

interface Skill {
  id?: string
  name: string
  category: string
  proficiency: number
}

interface KeyLink {
  type: string
  url: string
  visible: boolean
}

const LINK_TYPES = [
  { type: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/yourname' },
  { type: 'wikipedia', label: 'Wikipedia', placeholder: 'https://en.wikipedia.org/wiki/Your_Name' },
  { type: 'twitter', label: 'X / Twitter', placeholder: 'https://x.com/yourhandle' },
  { type: 'github', label: 'GitHub', placeholder: 'https://github.com/yourhandle' },
  { type: 'website', label: 'Personal Website', placeholder: 'https://yoursite.com' },
]

const CAT_LABELS: Record<string, string> = {
  work: 'Work', project: 'Project', personal: 'Personal',
  residence: 'Residence', tech: 'Tech', people: 'People',
}

const EMPTY_WORK: WorkEntry = {
  title: '', company: '', location: '', start_date: '', end_date: '',
  is_current: false, description: '', engagement_type: 'full-time'
}

const EMPTY_EDU: EducationEntry = {
  institution: '', degree: '', field_of_study: '', start_date: '', end_date: '',
  is_current: false, description: ''
}

const MONTHS = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 80 }, (_, i) => CURRENT_YEAR - i)

function parseDate(dateStr: string): { month: string; year: string } {
  if (!dateStr) return { month: '', year: '' }
  const parts = dateStr.split('-')
  return { year: parts[0] || '', month: parts[1] ? String(parseInt(parts[1])) : '' }
}

function buildDate(year: string, month: string): string {
  if (!year) return ''
  if (!month) return `${year}-01-01`
  return `${year}-${month.padStart(2, '0')}-01`
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const { month, year } = parseDate(dateStr)
  if (!year) return ''
  if (!month || month === '0') return year
  return `${MONTHS[parseInt(month)]} ${year}`
}

function DatePicker({ label, value, onChange, disabled }: {
  label: string
  value: string
  onChange: (val: string) => void
  disabled?: boolean
}) {
  const parsed = parseDate(value)
  const [month, setMonth] = useState(parsed.month)
  const [year, setYear] = useState(parsed.year)

  useEffect(() => {
    const p = parseDate(value)
    setMonth(p.month)
    setYear(p.year)
  }, [value])

  const handleChange = (newMonth: string, newYear: string) => {
    setMonth(newMonth)
    setYear(newYear)
    onChange(buildDate(newYear, newMonth))
  }

  const selectStyle: React.CSSProperties = {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '8px',
    padding: '8px 12px',
    color: '#e2e8f0',
    fontSize: '14px',
    outline: 'none',
  }

  return (
    <div>
      <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>{label}</label>
      <div style={{ display: 'flex', gap: '8px' }}>
        <select value={month} onChange={e => handleChange(e.target.value, year)} disabled={disabled} style={{ ...selectStyle, opacity: disabled ? 0.5 : 1 }}>
          <option value="">Month (optional)</option>
          {MONTHS.slice(1).map((m, i) => (
            <option key={i + 1} value={String(i + 1)}>{m}</option>
          ))}
        </select>
        <select value={year} onChange={e => handleChange(month, e.target.value)} disabled={disabled} style={{ ...selectStyle, opacity: disabled ? 0.5 : 1 }}>
          <option value="">Year</option>
          {YEARS.map(y => (
            <option key={y} value={String(y)}>{y}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

export default function ResumePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [profileName, setProfileName] = useState('')
  const [profileHeadline, setProfileHeadline] = useState('')
  const [profileLocation, setProfileLocation] = useState('')
  const [editingProfile, setEditingProfile] = useState(false)

  const [workEntries, setWorkEntries] = useState<WorkEntry[]>([])
  const [showWorkModal, setShowWorkModal] = useState(false)
  const [editingWork, setEditingWork] = useState<WorkEntry>(EMPTY_WORK)
  const [editingWorkId, setEditingWorkId] = useState<string | null>(null)

  const [eduEntries, setEduEntries] = useState<EducationEntry[]>([])
  const [showEduModal, setShowEduModal] = useState(false)
  const [editingEdu, setEditingEdu] = useState<EducationEntry>(EMPTY_EDU)
  const [editingEduId, setEditingEduId] = useState<string | null>(null)

  const [chronicleEntries, setChronicleEntries] = useState<ChronicleResumeEntry[]>([])
  const [showChronicleModal, setShowChronicleModal] = useState(false)
  const [editingChronicle, setEditingChronicle] = useState<ChronicleResumeEntry | null>(null)

  const [skills, setSkills] = useState<Skill[]>([])
  const [newSkillName, setNewSkillName] = useState('')
  const [newSkillCategory, setNewSkillCategory] = useState('')
  const [newSkillProficiency, setNewSkillProficiency] = useState(3)

  const [keyLinks, setKeyLinks] = useState<KeyLink[]>(
    LINK_TYPES.map(lt => ({ type: lt.type, url: '', visible: true }))
  )
  const [editingLinks, setEditingLinks] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { router.push('/login'); return }
      setUser(authUser)

      // Read profile from profiles table (not user_metadata)
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (profile) {
        setProfileName(profile.full_name || '')
        setProfileHeadline(profile.headline || '')
        setProfileLocation(profile.location || '')
        // Load key links from profiles.key_links (JSONB) or fallback table
        if (profile.key_links && Array.isArray(profile.key_links)) {
          const saved = profile.key_links as KeyLink[]
          setKeyLinks(LINK_TYPES.map(lt => {
            const existing = saved.find(s => s.type === lt.type)
            return existing || { type: lt.type, url: '', visible: true }
          }))
        } else {
          // Try loading from user_key_links table
          const { data: linkRows } = await supabase
            .from('user_key_links')
            .select('link_type, url, visible')
            .eq('user_id', authUser.id)
          if (linkRows && linkRows.length > 0) {
            setKeyLinks(LINK_TYPES.map(lt => {
              const existing = linkRows.find((r: any) => r.link_type === lt.type)
              return existing ? { type: lt.type, url: existing.url, visible: existing.visible } : { type: lt.type, url: '', visible: true }
            }))
          }
        }
      }

      const { data: work } = await supabase.from('work_entries').select('*').eq('user_id', authUser.id).order('start_date', { ascending: false })
      if (work) setWorkEntries(work)

      const { data: edu } = await supabase.from('education').select('*').eq('user_id', authUser.id).order('start_date', { ascending: false })
      if (edu) setEduEntries(edu)

      const { data: sk } = await supabase.from('skills').select('*').eq('user_id', authUser.id).order('name')
      if (sk) setSkills(sk)

      const { data: chron, error: chronErr } = await supabase
        .from('chronicle_entries')
        .select('*')
        .eq('user_id', authUser.id)
        .eq('show_on_resume', true)
        .order('start_date', { ascending: false })
      if (chronErr) console.warn('Chronicle query error:', chronErr.message)
      if (chron) setChronicleEntries(chron)

      setLoading(false)
    }
    init()
  }, [router])

  const saveProfile = async () => {
    if (!user) return
    // Save to profiles table (not user_metadata)
    await supabase
      .from('profiles')
      .update({
        full_name: profileName,
        headline: profileHeadline,
        location: profileLocation,
      })
      .eq('id', user.id)
    setEditingProfile(false)
  }

  const saveKeyLinks = async () => {
    if (!user) return
    // Try saving to profiles.key_links (JSONB column)
    const { error } = await supabase
      .from('profiles')
      .update({ key_links: keyLinks })
      .eq('id', user.id)
    if (error) {
      // key_links column may not exist — fall back to user_key_links table
      console.warn('profiles.key_links save failed, trying user_key_links table:', error.message)
      // Delete existing links for this user, then insert fresh
      await supabase.from('user_key_links').delete().eq('user_id', user.id)
      const rows = keyLinks.filter(l => l.url).map(l => ({
        user_id: user.id,
        link_type: l.type,
        url: l.url,
        visible: l.visible,
      }))
      if (rows.length > 0) {
        const { error: err2 } = await supabase.from('user_key_links').insert(rows)
        if (err2) {
          console.warn('user_key_links save also failed:', err2.message)
          alert('Could not save links. Please add a "key_links" column (type: jsonb) to the profiles table in Supabase.')
          return
        }
      }
    }
    setEditingLinks(false)
  }

  const updateLink = (type: string, field: 'url' | 'visible', value: string | boolean) => {
    setKeyLinks(prev => prev.map(l => l.type === type ? { ...l, [field]: value } : l))
  }

  const openAddWork = () => { setEditingWork(EMPTY_WORK); setEditingWorkId(null); setShowWorkModal(true) }
  const openEditWork = (entry: WorkEntry) => { setEditingWork({ ...entry }); setEditingWorkId(entry.id || null); setShowWorkModal(true) }

  const saveWork = async () => {
    if (!user) return
    const payload = { ...editingWork, user_id: user.id }
    delete (payload as any).id
    if (editingWorkId) {
      const { data } = await supabase.from('work_entries').update(payload).eq('id', editingWorkId).select().single()
      if (data) setWorkEntries(prev => prev.map(e => e.id === editingWorkId ? data : e))
    } else {
      const { data } = await supabase.from('work_entries').insert(payload).select().single()
      if (data) setWorkEntries(prev => [data, ...prev])
    }
    setShowWorkModal(false)
  }

  const deleteWork = async (id: string) => {
    await supabase.from('work_entries').delete().eq('id', id)
    setWorkEntries(prev => prev.filter(e => e.id !== id))
  }

  const openAddEdu = () => { setEditingEdu(EMPTY_EDU); setEditingEduId(null); setShowEduModal(true) }
  const openEditEdu = (entry: EducationEntry) => { setEditingEdu({ ...entry }); setEditingEduId(entry.id || null); setShowEduModal(true) }

  const saveEdu = async () => {
    if (!user) return
    const payload = { ...editingEdu, user_id: user.id }
    delete (payload as any).id
    if (editingEduId) {
      const { data } = await supabase.from('education').update(payload).eq('id', editingEduId).select().single()
      if (data) setEduEntries(prev => prev.map(e => e.id === editingEduId ? data : e))
    } else {
      const { data } = await supabase.from('education').insert(payload).select().single()
      if (data) setEduEntries(prev => [data, ...prev])
    }
    setShowEduModal(false)
  }

  const deleteEdu = async (id: string) => {
    await supabase.from('education').delete().eq('id', id)
    setEduEntries(prev => prev.filter(e => e.id !== id))
  }

  const addSkill = async () => {
    if (!user || !newSkillName.trim()) return
    const { data } = await supabase.from('skills').insert({
      user_id: user.id, name: newSkillName.trim(), category: newSkillCategory.trim(), proficiency: newSkillProficiency
    }).select().single()
    if (data) setSkills(prev => [...prev, data])
    setNewSkillName(''); setNewSkillCategory(''); setNewSkillProficiency(3)
  }

  const deleteSkill = async (id: string) => {
    await supabase.from('skills').delete().eq('id', id)
    setSkills(prev => prev.filter(s => s.id !== id))
  }

  const openEditChronicle = (entry: ChronicleResumeEntry) => {
    setEditingChronicle(entry)
    setShowChronicleModal(true)
  }

  const saveChronicle = async () => {
    if (!user || !editingChronicle) return
    // Build update payload — only include fields we know exist
    const payload: Record<string, unknown> = {
      title: editingChronicle.title,
      start_date: editingChronicle.start_date,
      end_date: editingChronicle.end_date || null,
      note: editingChronicle.note,
      show_on_resume: editingChronicle.show_on_resume,
      updated_at: new Date().toISOString(),
    }
    // Include optional fields if they have values (columns may or may not exist)
    if (editingChronicle.description !== undefined) payload.description = editingChronicle.description || null
    if (editingChronicle.image_url !== undefined) payload.image_url = editingChronicle.image_url || null

    let { error } = await supabase
      .from('chronicle_entries')
      .update(payload)
      .eq('id', editingChronicle.id)

    // If the update fails (possibly due to missing columns), retry without optional fields
    if (error) {
      console.warn('Chronicle save error, retrying without optional fields:', error.message)
      const { error: err2 } = await supabase
        .from('chronicle_entries')
        .update({
          title: editingChronicle.title,
          start_date: editingChronicle.start_date,
          end_date: editingChronicle.end_date || null,
          note: editingChronicle.note,
          show_on_resume: editingChronicle.show_on_resume,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingChronicle.id)
      error = err2
    }

    if (!error) {
      if (!editingChronicle.show_on_resume) {
        setChronicleEntries(prev => prev.filter(e => e.id !== editingChronicle.id))
      } else {
        setChronicleEntries(prev => prev.map(e => e.id === editingChronicle.id ? editingChronicle : e))
      }
    } else {
      console.error('Failed to save chronicle entry:', error.message)
    }
    setShowChronicleModal(false)
    setEditingChronicle(null)
  }

  const deleteChronicle = async (id: string) => {
    await supabase.from('chronicle_entries').delete().eq('id', id)
    setChronicleEntries(prev => prev.filter(e => e.id !== id))
    setShowChronicleModal(false)
    setEditingChronicle(null)
  }

  // ─── Styles ───
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '8px',
    color: '#e2e8f0',
    fontSize: '14px',
    outline: 'none',
  }

  const textareaStyle: React.CSSProperties = {
    ...inputStyle,
    minHeight: '80px',
    resize: 'vertical' as const,
    fontFamily: 'inherit',
  }

  const btnPrimary: React.CSSProperties = {
    padding: '8px 18px',
    background: '#a78bfa',
    color: '#0f172a',
    border: 'none',
    borderRadius: '6px',
    fontWeight: 600,
    fontSize: '13px',
    cursor: 'pointer',
  }

  const btnSecondary: React.CSSProperties = {
    padding: '8px 18px',
    background: 'transparent',
    color: '#94a3b8',
    border: '1px solid #334155',
    borderRadius: '6px',
    fontWeight: 500,
    fontSize: '13px',
    cursor: 'pointer',
  }

  const btnDanger: React.CSSProperties = {
    padding: '6px 14px',
    background: 'transparent',
    color: '#ef4444',
    border: '1px solid #7f1d1d',
    borderRadius: '6px',
    fontWeight: 500,
    fontSize: '12px',
    cursor: 'pointer',
  }

  const iconBtn: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 32, height: 32, borderRadius: '6px',
    background: 'transparent', border: '1px solid #334155',
    color: '#94a3b8', cursor: 'pointer',
  }

  const iconBtnDanger: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 32, height: 32, borderRadius: '6px',
    background: 'transparent', border: '1px solid #7f1d1d',
    color: '#ef4444', cursor: 'pointer',
  }

  const cardStyle: React.CSSProperties = {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '12px',
    padding: '24px',
  }

  const modalOverlay: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  }

  const modalBox: React.CSSProperties = {
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '16px',
    padding: '32px',
    width: '100%',
    maxWidth: '560px',
    maxHeight: '80vh',
    overflowY: 'auto',
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a' }}>
        <Nav />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#64748b' }}>
          Loading…
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a' }}>
        <Nav />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#94a3b8', flexDirection: 'column', gap: '16px' }}>
          <div>Please log in to view your profile.</div>
          <a href="/login" style={{ color: '#a78bfa' }}>Go to Login</a>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0' }}>
      <Nav />

      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 20px 60px' }}>

        {/* PROFILE HEADER */}
        <section style={cardStyle}>
          {editingProfile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input value={profileName} onChange={e => setProfileName(e.target.value)} placeholder="Full Name" style={inputStyle} />
              <input value={profileHeadline} onChange={e => setProfileHeadline(e.target.value)} placeholder="Headline (e.g. Software Engineer at Acme)" style={inputStyle} />
              <input value={profileLocation} onChange={e => setProfileLocation(e.target.value)} placeholder="Location" style={inputStyle} />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={saveProfile} style={btnPrimary}>Save</button>
                <button onClick={() => setEditingProfile(false)} style={btnSecondary}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{profileName || 'Your Name'}</h1>
                <p style={{ color: '#94a3b8', fontSize: '14px', margin: '4px 0 0' }}>{profileHeadline || 'Add a headline'}</p>
                {profileLocation && <p style={{ color: '#64748b', fontSize: '13px', margin: '2px 0 0' }}>{profileLocation}</p>}
              </div>
              <button onClick={() => setEditingProfile(true)} style={btnSecondary}>Edit</button>
            </div>
          )}
        </section>

        {/* EXPERIENCE (work entries + non-project chronicle entries) */}
        <section style={{ marginTop: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>Experience</h2>
            <button onClick={openAddWork} style={btnPrimary}>+ Add</button>
          </div>

          {workEntries.length === 0 && chronicleEntries.filter(e => e.canvas_col !== 'project' && e.type !== 'project' && e.canvas_col !== 'education' && e.type !== 'education').length === 0 && (
            <div style={{ ...cardStyle, color: '#475569', fontSize: '14px', textAlign: 'center' }}>
              No experience added yet.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              ...workEntries.map(e => ({ kind: 'work' as const, sortDate: e.start_date || '', data: e })),
              ...chronicleEntries
                .filter(e => e.canvas_col !== 'project' && e.type !== 'project' && e.canvas_col !== 'education' && e.type !== 'education')
                .map(e => ({ kind: 'chronicle' as const, sortDate: e.start_date || '', data: e })),
            ]
              .sort((a, b) => b.sortDate.localeCompare(a.sortDate))
              .map(item => {
                if (item.kind === 'work') {
                  const entry = item.data as WorkEntry
                  return (
                    <div key={`w-${entry.id}`} style={cardStyle}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '16px' }}>{entry.title}</div>
                          <div style={{ color: '#94a3b8', fontSize: '14px' }}>
                            {entry.company}{entry.engagement_type && entry.engagement_type !== 'full-time' ? ` · ${entry.engagement_type}` : ''}
                          </div>
                          <div style={{ color: '#64748b', fontSize: '13px', marginTop: '2px' }}>
                            {formatDate(entry.start_date)} – {entry.is_current ? 'Present' : formatDate(entry.end_date)}
                            {entry.location ? ` · ${entry.location}` : ''}
                          </div>
                          {entry.description && (
                            <p style={{ color: '#cbd5e1', fontSize: '14px', marginTop: '8px', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{entry.description}</p>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                          <button onClick={() => openEditWork(entry)} style={iconBtn} title="Edit">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          <button onClick={() => entry.id && deleteWork(entry.id)} style={iconBtnDanger} title="Delete">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                } else {
                  const entry = item.data as ChronicleResumeEntry
                  const catLabel = CAT_LABELS[entry.canvas_col || entry.type] || entry.type
                  const startYM = entry.start_date?.slice(0, 7) || ''
                  const endYM = entry.end_date?.slice(0, 7) || ''
                  return (
                    <div key={`c-${entry.id}`} style={cardStyle}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ fontWeight: 600, fontSize: '16px' }}>{entry.title}</div>
                            <span style={{
                              fontSize: '10px', padding: '2px 7px', borderRadius: '10px',
                              background: '#334155', color: '#94a3b8', letterSpacing: '.04em',
                            }}>{catLabel}</span>
                          </div>
                          <div style={{ color: '#64748b', fontSize: '13px', marginTop: '2px' }}>
                            {startYM}{endYM ? ` – ${endYM}` : startYM ? ' – Present' : ''}
                          </div>
                          {entry.note && (
                            <p style={{ color: '#cbd5e1', fontSize: '14px', marginTop: '8px', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{entry.note}</p>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                          <button onClick={() => openEditChronicle(entry)} style={iconBtn} title="Edit">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          <button onClick={() => deleteChronicle(entry.id)} style={iconBtnDanger} title="Delete">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                }
              })
            }
          </div>
        </section>

        {/* PROJECTS (chronicle entries with canvas_col === 'project') */}
        {(() => {
          const projectEntries = chronicleEntries.filter(e => e.canvas_col === 'project' || e.type === 'project')
          return (
            <section style={{ marginTop: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>Projects</h2>
                <button onClick={openAddWork} style={btnPrimary}>+ Add</button>
              </div>

              {projectEntries.length === 0 ? (
                <div style={{ ...cardStyle, color: '#475569', fontSize: '14px', textAlign: 'center' }}>
                  No projects yet. Add a project to get started.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
                  {projectEntries.map(project => {
                    const startYM = project.start_date?.slice(0, 7) || ''
                    const endYM = project.end_date?.slice(0, 7) || ''
                    const accentColor = project.color || '#508038'
                    return (
                      <div key={`p-${project.id}`} style={{
                        background: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        transition: 'border-color 0.2s',
                      }}>
                        <div style={{
                          height: '120px',
                          background: project.image_url ? 'none' : `linear-gradient(135deg, ${accentColor}22, ${accentColor}44)`,
                          borderBottom: `2px solid ${accentColor}66`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative',
                          overflow: 'hidden',
                        }}>
                          {project.image_url ? (
                            <img src={project.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{
                              width: 48, height: 48, borderRadius: '50%',
                              background: `${accentColor}33`,
                              border: `2px solid ${accentColor}88`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '20px', color: accentColor, fontWeight: 700,
                            }}>
                              {project.title.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div style={{ padding: '16px 20px 20px' }}>
                          <div style={{ fontWeight: 700, fontSize: '17px', marginBottom: '4px' }}>{project.title}</div>
                          <div style={{ color: '#64748b', fontSize: '12px', letterSpacing: '.04em' }}>
                            {startYM}{endYM ? ` – ${endYM}` : startYM ? ' – Present' : ''}
                          </div>
                          {project.note && (
                            <p style={{
                              color: '#94a3b8', fontSize: '14px', marginTop: '10px',
                              lineHeight: '1.6', whiteSpace: 'pre-wrap',
                            }}>
                              {project.note}
                            </p>
                          )}
                          <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                            <button onClick={() => openEditChronicle(project)} style={iconBtn} title="Edit">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button onClick={() => deleteChronicle(project.id)} style={iconBtnDanger} title="Delete">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          )
        })()}

        {/* EDUCATION */}
        {(() => {
          const eduChronicle = chronicleEntries.filter(e => e.canvas_col === 'education' || e.type === 'education')
          return (
            <section style={{ marginTop: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>Education</h2>
                <button onClick={openAddEdu} style={btnPrimary}>+ Add</button>
              </div>

              {eduEntries.length === 0 && eduChronicle.length === 0 && (
                <div style={{ ...cardStyle, color: '#475569', fontSize: '14px', textAlign: 'center' }}>
                  No education added yet.
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  ...eduEntries.map(e => ({ kind: 'edu' as const, sortDate: e.start_date || '', data: e })),
                  ...eduChronicle.map(e => ({ kind: 'chronicle' as const, sortDate: e.start_date || '', data: e })),
                ]
                  .sort((a, b) => b.sortDate.localeCompare(a.sortDate))
                  .map(item => {
                    if (item.kind === 'edu') {
                      const entry = item.data as EducationEntry
                      return (
                        <div key={entry.id} style={cardStyle}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '16px' }}>{entry.institution}</div>
                              <div style={{ color: '#94a3b8', fontSize: '14px' }}>
                                {entry.degree}{entry.field_of_study ? ` in ${entry.field_of_study}` : ''}
                              </div>
                              <div style={{ color: '#64748b', fontSize: '13px', marginTop: '2px' }}>
                                {formatDate(entry.start_date)} – {entry.is_current ? 'Present' : formatDate(entry.end_date)}
                              </div>
                              {entry.description && (
                                <p style={{ color: '#cbd5e1', fontSize: '14px', marginTop: '8px', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{entry.description}</p>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                              <button onClick={() => openEditEdu(entry)} style={iconBtn} title="Edit">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              </button>
                              <button onClick={() => entry.id && deleteEdu(entry.id)} style={iconBtnDanger} title="Delete">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    } else {
                      const entry = item.data as ChronicleResumeEntry
                      const startYM = entry.start_date?.slice(0, 7) || ''
                      const endYM = entry.end_date?.slice(0, 7) || ''
                      return (
                        <div key={`c-${entry.id}`} style={cardStyle}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '16px' }}>{entry.title}</div>
                              <div style={{ color: '#64748b', fontSize: '13px', marginTop: '2px' }}>
                                {startYM}{endYM ? ` – ${endYM}` : startYM ? ' – Present' : ''}
                              </div>
                              {entry.note && (
                                <p style={{ color: '#cbd5e1', fontSize: '14px', marginTop: '8px', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{entry.note}</p>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                              <button onClick={() => openEditChronicle(entry)} style={iconBtn} title="Edit">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              </button>
                              <button onClick={() => deleteChronicle(entry.id)} style={iconBtnDanger} title="Delete">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    }
                  })
                }
              </div>
            </section>
          )
        })()}

        {/* KEY LINKS */}
        <section style={{ marginTop: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>Key Links</h2>
            <button onClick={() => setEditingLinks(!editingLinks)} style={btnSecondary}>
              {editingLinks ? 'Done' : 'Edit'}
            </button>
          </div>
          <div style={cardStyle}>
            {editingLinks ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {keyLinks.map(link => {
                  const meta = LINK_TYPES.find(lt => lt.type === link.type)
                  return (
                    <div key={link.type} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', flexShrink: 0 }}>
                        <input
                          type="checkbox"
                          checked={link.visible}
                          onChange={e => updateLink(link.type, 'visible', e.target.checked)}
                          style={{ width: 14, height: 14, accentColor: '#a78bfa' }}
                        />
                        <span style={{ color: '#94a3b8', fontSize: '12px', width: 120 }}>{meta?.label || link.type}</span>
                      </label>
                      <input
                        value={link.url}
                        onChange={e => updateLink(link.type, 'url', e.target.value)}
                        placeholder={meta?.placeholder || 'https://...'}
                        style={{ ...inputStyle, flex: 1 }}
                      />
                    </div>
                  )
                })}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                  <button onClick={() => setEditingLinks(false)} style={btnSecondary}>Cancel</button>
                  <button onClick={saveKeyLinks} style={btnPrimary}>Save Links</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {keyLinks.filter(l => l.url && l.visible).length === 0 ? (
                  <span style={{ color: '#475569', fontSize: '14px' }}>No links added yet. Click Edit to add your key links.</span>
                ) : (
                  keyLinks.filter(l => l.url && l.visible).map(link => {
                    const meta = LINK_TYPES.find(lt => lt.type === link.type)
                    return (
                      <a
                        key={link.type}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '6px',
                          padding: '6px 14px', borderRadius: '20px',
                          background: '#334155', color: '#e2e8f0', fontSize: '13px',
                          textDecoration: 'none', transition: 'background 0.15s',
                        }}
                      >
                        {meta?.label || link.type}
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
                          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                        </svg>
                      </a>
                    )
                  })
                )}
              </div>
            )}
          </div>
        </section>

        {/* SKILLS — hidden for now */}
      </main>

      {/* WORK MODAL */}
      {showWorkModal && (
        <div style={modalOverlay} onClick={() => setShowWorkModal(false)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '20px' }}>
              {editingWorkId ? 'Edit Experience' : 'Add Experience'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Job Title *</label>
                <input value={editingWork.title} onChange={e => setEditingWork({ ...editingWork, title: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Company *</label>
                <input value={editingWork.company} onChange={e => setEditingWork({ ...editingWork, company: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Location</label>
                <input value={editingWork.location} onChange={e => setEditingWork({ ...editingWork, location: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Engagement Type</label>
                <select value={editingWork.engagement_type} onChange={e => setEditingWork({ ...editingWork, engagement_type: e.target.value })} style={{ ...inputStyle }}>
                  <option value="full-time">Full-time</option>
                  <option value="part-time">Part-time</option>
                  <option value="contract">Contract</option>
                  <option value="freelance">Freelance</option>
                  <option value="internship">Internship</option>
                  <option value="self-employed">Self-employed</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <DatePicker label="Start Date" value={editingWork.start_date} onChange={v => setEditingWork({ ...editingWork, start_date: v })} />
                <DatePicker label="End Date" value={editingWork.end_date} onChange={v => setEditingWork({ ...editingWork, end_date: v })} disabled={editingWork.is_current} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '13px' }}>
                <input type="checkbox" checked={editingWork.is_current} onChange={e => setEditingWork({ ...editingWork, is_current: e.target.checked, end_date: e.target.checked ? '' : editingWork.end_date })} />
                I currently work here
              </label>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Description</label>
                <textarea value={editingWork.description} onChange={e => setEditingWork({ ...editingWork, description: e.target.value })} style={textareaStyle} />
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button onClick={() => setShowWorkModal(false)} style={btnSecondary}>Cancel</button>
                <button onClick={saveWork} style={btnPrimary}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CHRONICLE ENTRY MODAL */}
      {showChronicleModal && editingChronicle && (
        <div style={modalOverlay} onClick={() => { setShowChronicleModal(false); setEditingChronicle(null) }}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '20px' }}>Edit Entry</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Title *</label>
                <input value={editingChronicle.title} onChange={e => setEditingChronicle({ ...editingChronicle, title: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Start (YYYY-MM)</label>
                  <input value={editingChronicle.start_date || ''} onChange={e => setEditingChronicle({ ...editingChronicle, start_date: e.target.value })} placeholder="2020-01" style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>End (YYYY-MM or blank)</label>
                  <input value={editingChronicle.end_date || ''} onChange={e => setEditingChronicle({ ...editingChronicle, end_date: e.target.value || null })} placeholder="2022-06" style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Description</label>
                <textarea value={editingChronicle.description || ''} onChange={e => setEditingChronicle({ ...editingChronicle, description: e.target.value })} placeholder="Brief description..." style={textareaStyle} />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Note</label>
                <textarea value={editingChronicle.note || ''} onChange={e => setEditingChronicle({ ...editingChronicle, note: e.target.value })} style={textareaStyle} />
              </div>
              {(editingChronicle.canvas_col === 'project' || editingChronicle.type === 'project') && (
                <div>
                  <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Project Image</label>
                  {editingChronicle.image_url && (
                    <div style={{ marginBottom: '8px', position: 'relative', display: 'inline-block' }}>
                      <img src={editingChronicle.image_url} alt="" style={{ maxWidth: '100%', maxHeight: '120px', borderRadius: '6px', border: '1px solid #334155' }} />
                      <button onClick={() => setEditingChronicle({ ...editingChronicle, image_url: null })} style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,.7)', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', fontSize: '11px', lineHeight: '20px', textAlign: 'center' as const, padding: 0 }}>×</button>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      if (file.size > 1 * 1024 * 1024) { alert('Image must be under 1 MB'); e.target.value = ''; return }
                      if (!file.type.startsWith('image/')) { alert('Only image files allowed'); e.target.value = ''; return }
                      // Convert to base64 data URL (avoids storage bucket dependency)
                      const reader = new FileReader()
                      reader.onload = () => {
                        setEditingChronicle({ ...editingChronicle, image_url: reader.result as string })
                      }
                      reader.onerror = () => alert('Failed to read file')
                      reader.readAsDataURL(file)
                    }}
                    style={{ fontSize: '12px', color: '#94a3b8' }}
                  />
                  <div style={{ fontSize: '10px', color: '#475569', marginTop: '4px' }}>PNG, JPG, WebP, GIF — max 1 MB</div>
                </div>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', borderTop: '1px solid #334155', paddingTop: '12px' }}>
                <input type="checkbox" checked={editingChronicle.show_on_resume} onChange={e => setEditingChronicle({ ...editingChronicle, show_on_resume: e.target.checked })} style={{ width: 14, height: 14, accentColor: '#a78bfa' }} />
                <span style={{ fontSize: '13px', color: '#e2e8f0' }}>Show on Resume</span>
              </label>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', marginTop: '8px' }}>
                <button onClick={() => deleteChronicle(editingChronicle.id)} style={btnDanger}>Delete</button>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => { setShowChronicleModal(false); setEditingChronicle(null) }} style={btnSecondary}>Cancel</button>
                  <button onClick={saveChronicle} style={btnPrimary}>Save</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDUCATION MODAL */}
      {showEduModal && (
        <div style={modalOverlay} onClick={() => setShowEduModal(false)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '20px' }}>
              {editingEduId ? 'Edit Education' : 'Add Education'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Institution *</label>
                <input value={editingEdu.institution} onChange={e => setEditingEdu({ ...editingEdu, institution: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Degree</label>
                <input value={editingEdu.degree} onChange={e => setEditingEdu({ ...editingEdu, degree: e.target.value })} placeholder="e.g. Bachelor of Science" style={inputStyle} />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Field of Study</label>
                <input value={editingEdu.field_of_study} onChange={e => setEditingEdu({ ...editingEdu, field_of_study: e.target.value })} placeholder="e.g. Computer Science" style={inputStyle} />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <DatePicker label="Start Date" value={editingEdu.start_date} onChange={v => setEditingEdu({ ...editingEdu, start_date: v })} />
                <DatePicker label="End Date" value={editingEdu.end_date} onChange={v => setEditingEdu({ ...editingEdu, end_date: v })} disabled={editingEdu.is_current} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '13px' }}>
                <input type="checkbox" checked={editingEdu.is_current} onChange={e => setEditingEdu({ ...editingEdu, is_current: e.target.checked, end_date: e.target.checked ? '' : editingEdu.end_date })} />
                Currently attending
              </label>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Description</label>
                <textarea value={editingEdu.description} onChange={e => setEditingEdu({ ...editingEdu, description: e.target.value })} style={textareaStyle} />
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button onClick={() => setShowEduModal(false)} style={btnSecondary}>Cancel</button>
                <button onClick={saveEdu} style={btnPrimary}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
