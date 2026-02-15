'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

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

  return (
    <div>
      <label className="text-gray-400 text-xs block mb-1">{label}</label>
      <div className="flex gap-2">
        <select
          value={month}
          onChange={e => handleChange(e.target.value, year)}
          disabled={disabled}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
        >
          <option value="">Month (optional)</option>
          {MONTHS.slice(1).map((m, i) => (
            <option key={i + 1} value={String(i + 1)}>{m}</option>
          ))}
        </select>
        <select
          value={year}
          onChange={e => handleChange(month, e.target.value)}
          disabled={disabled}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
        >
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

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setLoading(false); return }
      setUser(session.user)

      const meta = session.user.user_metadata
      setProfileName(meta?.full_name || meta?.name || '')
      setProfileHeadline(meta?.headline || '')
      setProfileLocation(meta?.location || '')

      const { data: work } = await supabase.from('work_entries').select('*').eq('user_id', session.user.id).order('start_date', { ascending: false })
      if (work) setWorkEntries(work)

      const { data: edu } = await supabase.from('education').select('*').eq('user_id', session.user.id).order('start_date', { ascending: false })
      if (edu) setEduEntries(edu)

      const { data: sk } = await supabase.from('skills').select('*').eq('user_id', session.user.id).order('name')
      if (sk) setSkills(sk)

      setLoading(false)
    }
    init()
  }, [])

  const saveProfile = async () => {
    if (!user) return
    await supabase.auth.updateUser({
      data: { full_name: profileName, headline: profileHeadline, location: profileLocation }
    })
    setEditingProfile(false)
  }

  const openAddWork = () => {
    setEditingWork(EMPTY_WORK)
    setEditingWorkId(null)
    setShowWorkModal(true)
  }

  const openEditWork = (entry: WorkEntry) => {
    setEditingWork({ ...entry })
    setEditingWorkId(entry.id || null)
    setShowWorkModal(true)
  }

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

  const openAddEdu = () => {
    setEditingEdu(EMPTY_EDU)
    setEditingEduId(null)
    setShowEduModal(true)
  }

  const openEditEdu = (entry: EducationEntry) => {
    setEditingEdu({ ...entry })
    setEditingEduId(entry.id || null)
    setShowEduModal(true)
  }

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
    setNewSkillName('')
    setNewSkillCategory('')
    setNewSkillProficiency(3)
  }

  const deleteSkill = async (id: string) => {
    await supabase.from('skills').delete().eq('id', id)
    setSkills(prev => prev.filter(s => s.id !== id))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center flex-col gap-4">
        <div className="text-white text-lg">Please log in to view your resume.</div>
        <a href="/login" className="text-blue-400 hover:text-blue-300">Go to Login</a>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <a href="/dashboard" className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          NEXUS
        </a>
        <nav className="flex items-center gap-6">
          <a href="/resume" className="text-blue-400 font-medium">Resume</a>
          <a href="/contacts" className="text-gray-400 hover:text-white transition-colors">Contacts</a>
          <a href="/network" className="text-gray-400 hover:text-white transition-colors">Network</a>
        </nav>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-8">

        {/* PROFILE HEADER */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          {editingProfile ? (
            <div className="space-y-4">
              <input value={profileName} onChange={e => setProfileName(e.target.value)} placeholder="Full Name"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
              <input value={profileHeadline} onChange={e => setProfileHeadline(e.target.value)} placeholder="Headline (e.g. Full-Stack Developer)"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
              <input value={profileLocation} onChange={e => setProfileLocation(e.target.value)} placeholder="Location"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
              <div className="flex gap-3">
                <button onClick={saveProfile} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">Save</button>
                <button onClick={() => setEditingProfile(false)} className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold">{profileName || 'Your Name'}</h2>
                <p className="text-gray-400 mt-1">{profileHeadline || 'Add a headline'}</p>
                <p className="text-gray-500 text-sm mt-1">{profileLocation || 'Add location'}</p>
              </div>
              <button onClick={() => setEditingProfile(true)} className="text-blue-400 hover:text-blue-300 text-sm font-medium">Edit</button>
            </div>
          )}
        </section>

        {/* WORK EXPERIENCE */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">Work Experience</h3>
            <button onClick={openAddWork} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">+ Add</button>
          </div>
          {workEntries.length === 0 ? (
            <p className="text-gray-500">No work experience added yet.</p>
          ) : (
            <div className="space-y-4">
              {workEntries.map(entry => (
                <div key={entry.id} className="border border-gray-700 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-lg">{entry.title}</h4>
                      <p className="text-gray-400">{entry.company}{entry.location ? ` · ${entry.location}` : ''}</p>
                      <p className="text-gray-500 text-sm">
                        {formatDate(entry.start_date)}{entry.is_current ? ' — Present' : entry.end_date ? ` — ${formatDate(entry.end_date)}` : ''}
                        {entry.engagement_type ? ` · ${entry.engagement_type}` : ''}
                      </p>
                      {entry.description && <p className="text-gray-300 mt-2 text-sm">{entry.description}</p>}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openEditWork(entry)} className="text-blue-400 hover:text-blue-300 text-sm">Edit</button>
                      <button onClick={() => entry.id && deleteWork(entry.id)} className="text-red-400 hover:text-red-300 text-sm">Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* EDUCATION */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">Education</h3>
            <button onClick={openAddEdu} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">+ Add</button>
          </div>
          {eduEntries.length === 0 ? (
            <p className="text-gray-500">No education added yet.</p>
          ) : (
            <div className="space-y-4">
              {eduEntries.map(entry => (
                <div key={entry.id} className="border border-gray-700 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-lg">{entry.institution}</h4>
                      <p className="text-gray-400">{entry.degree}{entry.field_of_study ? ` in ${entry.field_of_study}` : ''}</p>
                      <p className="text-gray-500 text-sm">
                        {formatDate(entry.start_date)}{entry.is_current ? ' — Present' : entry.end_date ? ` — ${formatDate(entry.end_date)}` : ''}
                      </p>
                      {entry.description && <p className="text-gray-300 mt-2 text-sm">{entry.description}</p>}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openEditEdu(entry)} className="text-blue-400 hover:text-blue-300 text-sm">Edit</button>
                      <button onClick={() => entry.id && deleteEdu(entry.id)} className="text-red-400 hover:text-red-300 text-sm">Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* SKILLS */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h3 className="text-xl font-semibold mb-4">Skills</h3>
          <div className="flex flex-wrap gap-2 mb-4">
            {skills.map(skill => (
              <span key={skill.id} className="bg-gray-800 border border-gray-700 rounded-full px-3 py-1 text-sm flex items-center gap-2">
                {skill.name}
                {skill.category && <span className="text-gray-500">({skill.category})</span>}
                <span className="text-yellow-400">{'★'.repeat(skill.proficiency)}{'☆'.repeat(5 - skill.proficiency)}</span>
                <button onClick={() => skill.id && deleteSkill(skill.id)} className="text-red-400 hover:text-red-300 ml-1">&times;</button>
              </span>
            ))}
            {skills.length === 0 && <p className="text-gray-500">No skills added yet.</p>}
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-gray-400 text-xs block mb-1">Skill</label>
              <input value={newSkillName} onChange={e => setNewSkillName(e.target.value)} placeholder="e.g. React"
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 w-40" />
            </div>
            <div>
              <label className="text-gray-400 text-xs block mb-1">Category</label>
              <input value={newSkillCategory} onChange={e => setNewSkillCategory(e.target.value)} placeholder="e.g. Frontend"
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 w-40" />
            </div>
            <div>
              <label className="text-gray-400 text-xs block mb-1">Proficiency</label>
              <select value={newSkillProficiency} onChange={e => setNewSkillProficiency(Number(e.target.value))}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500">
                <option value={1}>1 - Beginner</option>
                <option value={2}>2 - Basic</option>
                <option value={3}>3 - Intermediate</option>
                <option value={4}>4 - Advanced</option>
                <option value={5}>5 - Expert</option>
              </select>
            </div>
            <button onClick={addSkill} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">Add Skill</button>
          </div>
        </section>
      </main>

      {/* WORK MODAL */}
      {showWorkModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold mb-4">{editingWorkId ? 'Edit' : 'Add'} Work Experience</h3>
            <div className="space-y-3">
              <input value={editingWork.title} onChange={e => setEditingWork(p => ({ ...p, title: e.target.value }))} placeholder="Job Title"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
              <input value={editingWork.company} onChange={e => setEditingWork(p => ({ ...p, company: e.target.value }))} placeholder="Company"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
              <input value={editingWork.location} onChange={e => setEditingWork(p => ({ ...p, location: e.target.value }))} placeholder="Location"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
              <select value={editingWork.engagement_type} onChange={e => setEditingWork(p => ({ ...p, engagement_type: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500">
                <option value="full-time">Full-time</option>
                <option value="part-time">Part-time</option>
                <option value="contract">Contract</option>
                <option value="freelance">Freelance</option>
                <option value="internship">Internship</option>
                <option value="volunteer">Volunteer</option>
                <option value="project-based">Project-based</option>
              </select>
              <div className="grid grid-cols-2 gap-3">
                <DatePicker label="Start Date" value={editingWork.start_date} onChange={val => setEditingWork(p => ({ ...p, start_date: val }))} />
                <DatePicker label="End Date" value={editingWork.end_date} onChange={val => setEditingWork(p => ({ ...p, end_date: val }))} disabled={editingWork.is_current} />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-400">
                <input type="checkbox" checked={editingWork.is_current} onChange={e => setEditingWork(p => ({ ...p, is_current: e.target.checked, end_date: e.target.checked ? '' : p.end_date }))}
                  className="rounded bg-gray-800 border-gray-700" />
                I currently work here
              </label>
              <textarea value={editingWork.description} onChange={e => setEditingWork(p => ({ ...p, description: e.target.value }))} placeholder="Description"
                rows={4} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none" />
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={saveWork} className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg text-sm font-medium transition-colors">Save</button>
              <button onClick={() => setShowWorkModal(false)} className="bg-gray-700 hover:bg-gray-600 px-6 py-2 rounded-lg text-sm font-medium transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* EDUCATION MODAL */}
      {showEduModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold mb-4">{editingEduId ? 'Edit' : 'Add'} Education</h3>
            <div className="space-y-3">
              <input value={editingEdu.institution} onChange={e => setEditingEdu(p => ({ ...p, institution: e.target.value }))} placeholder="Institution"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
              <input value={editingEdu.degree} onChange={e => setEditingEdu(p => ({ ...p, degree: e.target.value }))} placeholder="Degree (e.g. Bachelor's, Master's)"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
              <input value={editingEdu.field_of_study} onChange={e => setEditingEdu(p => ({ ...p, field_of_study: e.target.value }))} placeholder="Field of Study"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
              <div className="grid grid-cols-2 gap-3">
                <DatePicker label="Start Date" value={editingEdu.start_date} onChange={val => setEditingEdu(p => ({ ...p, start_date: val }))} />
                <DatePicker label="End Date" value={editingEdu.end_date} onChange={val => setEditingEdu(p => ({ ...p, end_date: val }))} disabled={editingEdu.is_current} />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-400">
                <input type="checkbox" checked={editingEdu.is_current} onChange={e => setEditingEdu(p => ({ ...p, is_current: e.target.checked, end_date: e.target.checked ? '' : p.end_date }))}
                  className="rounded bg-gray-800 border-gray-700" />
                I currently attend here
              </label>
              <textarea value={editingEdu.description} onChange={e => setEditingEdu(p => ({ ...p, description: e.target.value }))} placeholder="Description"
                rows={3} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none" />
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={saveEdu} className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg text-sm font-medium transition-colors">Save</button>
              <button onClick={() => setShowEduModal(false)} className="bg-gray-700 hover:bg-gray-600 px-6 py-2 rounded-lg text-sm font-medium transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
