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

interface Skill {
  id?: string
  name: string
  category: string
  proficiency: number
}

interface ChronicleResumeEntry {
  id: string
  type: string
  title: string
  start_date: string
  end_date: string | null
  canvas_col: string
  note: string
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

const COL_LABELS: Record<string, string> = {
  work: 'Work', project: 'Project', personal: 'Personal',
  residence: 'Residence', tech: 'Tech', people: 'People',
}

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

function formatYM(dateStr: string): string {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  const year = parts[0]
  const month = parts[1] ? parseInt(parts[1]) : 0
  if (!year) return ''
  if (!month) return year
  return `${MONTHS[month]} ${year}`
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

  const [skills, setSkills] = useState<Skill[]>([])
  const [newSkillName, setNewSkillName] = useState('')
  const [newSkillCategory, setNewSkillCategory] = useState('')
  const [newSkillProficiency, setNewSkillProficiency] = useState(3)

  const [chronicleEntries, setChronicleEntries] = useState<ChronicleResumeEntry[]>([])

  useEffect(() => {
    const init = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { router.push('/login'); return }
      setUser(authUser)

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, headline, location')
        .eq('id', authUser.id)
        .single()

      if (profile) {
        setProfileName(profile.full_name || '')
        setProfileHeadline(profile.headline || '')
        setProfileLocation(profile.location || '')
      }

      const { data: work } = await supabase.from('work_entries').select('*').eq('user_id', authUser.id).order('start_date', { ascending: false })
      if (work) setWorkEntries(work)

      const { data: edu } = await supabase.from('education').select('*').eq('user_id', authUser.id).order('start_date', { ascending: false })
      if (edu) setEduEntries(edu)

      const { data: sk } = await supabase.from('skills').select('*').eq('user_id', authUser.id).order('name')
      if (sk) setSkills(sk)

      const { data: chronicle } = await supabase
        .from('chronicle_entries')
        .select('id, type, title, start_date, end_date, canvas_col, note')
        .eq('user_id', authUser.id)
        .eq('show_on_resume', true)
        .order('start_date', { ascending: false })
      if (chronicle) setChronicleEntries(chronicle)

      setLoading(false)
    }
    init()
  }, [router])

  const saveProfile = async () => {
    if (!user) return
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

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', background: '#1e293b',
    border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0',
    fontSize: '14px', outline: 'none',
  }

  const textareaStyle: React.CSSProperties = {
    ...inputStyle, minHeight: '80px', resize: 'vertical' as const, fontFamily: 'inherit',
  }

  const btnPrimary: React.CSSProperties = {
    padding: '8px 18px', background: '#a78bfa', color: '#0f172a',
    border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '13px', cursor: 'pointer',
  }

  const btnSecondary: React.CSSProperties = {
    padding: '8px 18px', background: 'transparent', color: '#94a3b8',
    border: '1px solid #334155', borderRadius: '6px', fontWeight: 500, fontSize: '13px', cursor: 'pointer',
  }

  const btnDanger: React.CSSProperties = {
    padding: '6px 14px', background: 'transparent', color: '#ef4444',
    border: '1px solid #7f1d1d', borderRadius: '6px', fontWeight: 500, fontSize: '12px', cursor: 'pointer',
  }

  const cardStyle: React.CSSProperties = {
    background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '24px',
  }

  const modalOverlay: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
  }

  const modalBox: React.CSSProperties = {
    background: '#0f172a', border: '1px solid #334155', borderRadius: '16px',
    padding: '32px', width: '100%', maxWidth: '560px', maxHeight: '80vh', overflowY: 'auto',
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a' }}>
        <Nav />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#64748b' }}>
          Loading...
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

        {/* WORK EXPERIENCE */}
        <section style={{ marginTop: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>Work Experience</h2>
            <button onClick={openAddWork} style={btnPrimary}>+ Add</button>
          </div>

          {workEntries.length === 0 && (
            <div style={{ ...cardStyle, color: '#475569', fontSize: '14px', textAlign: 'center' }}>
              No work experience added yet.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {workEntries.map(entry => (
              <div key={entry.id} style={cardStyle}>
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
                    <button onClick={() => openEditWork(entry)} style={btnSecondary}>Edit</button>
                    <button onClick={() => entry.id && deleteWork(entry.id)} style={btnDanger}>Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CHRONICLE ENTRIES (show_on_resume = true) */}
        {chronicleEntries.length > 0 && (
          <section style={{ marginTop: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>From Chronicle</h2>
              <a href="/chronicle" style={{ color: '#a78bfa', fontSize: '13px', textDecoration: 'none' }}>Edit in Chronicle</a>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {chronicleEntries.map(entry => (
                <div key={entry.id} style={cardStyle}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ fontWeight: 600, fontSize: '16px' }}>{entry.title}</div>
                      <span style={{
                        fontSize: '10px', color: '#64748b', background: '#0f172a',
                        padding: '2px 8px', borderRadius: '10px', textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}>
                        {COL_LABELS[entry.canvas_col || entry.type] || entry.type}
                      </span>
                    </div>
                    <div style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>
                      {formatYM(entry.start_date)}{entry.end_date ? ` – ${formatYM(entry.end_date)}` : ''}
                    </div>
                    {entry.note && (
                      <p style={{ color: '#cbd5e1', fontSize: '14px', marginTop: '8px', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{entry.note}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* EDUCATION */}
        <section style={{ marginTop: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>Education</h2>
            <button onClick={openAddEdu} style={btnPrimary}>+ Add</button>
          </div>

          {eduEntries.length === 0 && (
            <div style={{ ...cardStyle, color: '#475569', fontSize: '14px', textAlign: 'center' }}>
              No education added yet.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {eduEntries.map(entry => (
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
                    <button onClick={() => openEditEdu(entry)} style={btnSecondary}>Edit</button>
                    <button onClick={() => entry.id && deleteEdu(entry.id)} style={btnDanger}>Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SKILLS */}
        <section style={{ marginTop: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 12px' }}>Skills</h2>

          <div style={{ ...cardStyle, marginBottom: '12px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '140px' }}>
                <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Skill</label>
                <input value={newSkillName} onChange={e => setNewSkillName(e.target.value)} placeholder="e.g. TypeScript" style={inputStyle} />
              </div>
              <div style={{ flex: 1, minWidth: '140px' }}>
                <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Category</label>
                <input value={newSkillCategory} onChange={e => setNewSkillCategory(e.target.value)} placeholder="e.g. Programming" style={inputStyle} />
              </div>
              <div style={{ width: '80px' }}>
                <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Level (1-5)</label>
                <input type="number" min={1} max={5} value={newSkillProficiency} onChange={e => setNewSkillProficiency(Number(e.target.value))} style={inputStyle} />
              </div>
              <button onClick={addSkill} style={btnPrimary}>Add</button>
            </div>
          </div>

          {skills.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {skills.map(sk => (
                <div key={sk.id} style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  background: '#1e293b', border: '1px solid #334155', borderRadius: '20px',
                  padding: '6px 14px', fontSize: '13px',
                }}>
                  <span style={{ fontWeight: 500 }}>{sk.name}</span>
                  {sk.category && <span style={{ color: '#64748b', fontSize: '11px' }}>({sk.category})</span>}
                  <span style={{ color: '#a78bfa', fontSize: '11px' }}>{'●'.repeat(sk.proficiency)}{'○'.repeat(5 - sk.proficiency)}</span>
                  <button onClick={() => sk.id && deleteSkill(sk.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px', padding: '0 2px' }}>×</button>
                </div>
              ))}
            </div>
          )}
        </section>
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
