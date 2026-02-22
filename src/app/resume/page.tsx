'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Nav from '@/components/Nav'

import {
  WorkEntry, EducationEntry, ChronicleResumeEntry, Skill, KeyLink,
  LINK_TYPES, CAT_LABELS, EMPTY_WORK, EMPTY_EDU, LOCATION_TYPES,
} from './types'
import {
  inputStyle, btnPrimary, btnSecondary, iconBtn, iconBtnDanger, cardStyle,
} from './styles'
import { formatDate } from './utils'

import WorkModal from './components/WorkModal'
import EducationModal from './components/EducationModal'
import ChronicleEntryModal from './components/ChronicleEntryModal'
import KeyLinksSection from './components/KeyLinksSection'

export default function ResumePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [profileName, setProfileName] = useState('')
  const [profileHeadline, setProfileHeadline] = useState('')
  const [profileLocation, setProfileLocation] = useState('')
  const [profileBirthday, setProfileBirthday] = useState('')
  const [profilePhoto, setProfilePhoto] = useState('')
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
        setProfileBirthday(profile.birthday || '')
        setProfilePhoto(profile.profile_photo_url || '')
        // Load key links: try profiles.key_links first, then auth user_metadata
        const savedLinks = profile.key_links
          || authUser.user_metadata?.key_links
        if (savedLinks && Array.isArray(savedLinks)) {
          setKeyLinks(LINK_TYPES.map(lt => {
            const existing = (savedLinks as KeyLink[]).find(s => s.type === lt.type)
            return existing || { type: lt.type, url: '', visible: true }
          }))
        }
      }

      const { data: work } = await supabase.from('work_entries').select('*').eq('user_id', authUser.id).order('start_date', { ascending: false })
      if (work) setWorkEntries(work.map((w: any) => ({
        ...w,
        location_type: w.remote_type || '',
        ai_skills_extracted: w.ai_skills_extracted || [],
      })))

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
    const payload: Record<string, unknown> = {
      full_name: profileName,
      headline: profileHeadline,
      location: profileLocation,
    }
    // Try with birthday + profile_photo_url (columns may not exist yet)
    const fullPayload = {
      ...payload,
      birthday: profileBirthday || null,
      profile_photo_url: profilePhoto || null,
    }
    const { error } = await supabase.from('profiles').update(fullPayload).eq('id', user.id)
    if (error) {
      // Fallback: save without new columns
      await supabase.from('profiles').update(payload).eq('id', user.id)
    }
    setEditingProfile(false)
  }

  const handleProfilePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return
    if (file.size > 1024 * 1024) { alert('Photo must be under 1 MB'); return }
    const reader = new FileReader()
    reader.onload = () => { setProfilePhoto(reader.result as string) }
    reader.readAsDataURL(file)
  }

  const saveKeyLinks = async () => {
    if (!user) return
    // Try saving to profiles.key_links (JSONB column) first
    const { error } = await supabase
      .from('profiles')
      .update({ key_links: keyLinks })
      .eq('id', user.id)
    if (error) {
      // Column doesn't exist — save to auth user_metadata instead (always works)
      console.warn('profiles.key_links save failed, using user_metadata:', error.message)
      const { error: authErr } = await supabase.auth.updateUser({
        data: { key_links: keyLinks }
      })
      if (authErr) {
        alert('Could not save links: ' + authErr.message)
        return
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
    const migratePrefix = 'migrate-chronicle:'
    const isMigration = editingWork.id?.startsWith(migratePrefix)
    const chronicleId = isMigration ? editingWork.id!.slice(migratePrefix.length) : null

    // Build a clean payload with only work_entries columns
    const payload: Record<string, unknown> = {
      user_id: user.id,
      title: editingWork.title,
      company: editingWork.company,
      location: editingWork.location || null,
      remote_type: editingWork.location_type || null,
      start_date: editingWork.start_date,
      end_date: editingWork.is_current ? null : (editingWork.end_date || null),
      is_current: editingWork.is_current,
      description: editingWork.description || null,
      engagement_type: editingWork.engagement_type,
      ai_skills_extracted: editingWork.ai_skills_extracted || [],
    }
    // Include chronicle display fields if set
    if (editingWork.chronicle_color) payload.chronicle_color = editingWork.chronicle_color
    if (editingWork.chronicle_fuzzy_start !== undefined) payload.chronicle_fuzzy_start = editingWork.chronicle_fuzzy_start
    if (editingWork.chronicle_fuzzy_end !== undefined) payload.chronicle_fuzzy_end = editingWork.chronicle_fuzzy_end
    if (editingWork.chronicle_note !== undefined) payload.chronicle_note = editingWork.chronicle_note || null

    if (isMigration) {
      // Migrate from chronicle_entry → work_entry
      const { data, error } = await supabase.from('work_entries').insert(payload).select().single()
      if (error) { console.error('Migration insert failed:', error.message); alert('Failed to save: ' + error.message); return }
      if (data) {
        setWorkEntries(prev => [{ ...data, location_type: data.remote_type || '', ai_skills_extracted: data.ai_skills_extracted || [] }, ...prev])
        // Delete the old chronicle entry
        await supabase.from('chronicle_entries').delete().eq('id', chronicleId!)
        setChronicleEntries(prev => prev.filter(e => e.id !== chronicleId))
      }
    } else if (editingWorkId) {
      delete payload.user_id
      const { data, error } = await supabase.from('work_entries').update(payload).eq('id', editingWorkId).select().single()
      if (error) { console.error('Update failed:', error.message); alert('Failed to save: ' + error.message); return }
      if (data) setWorkEntries(prev => prev.map(e => e.id === editingWorkId ? { ...data, location_type: data.remote_type || '', ai_skills_extracted: data.ai_skills_extracted || [] } : e))
    } else {
      const { data, error } = await supabase.from('work_entries').insert(payload).select().single()
      if (error) { console.error('Insert failed:', error.message); alert('Failed to save: ' + error.message); return }
      if (data) setWorkEntries(prev => [{ ...data, location_type: data.remote_type || '', ai_skills_extracted: data.ai_skills_extracted || [] }, ...prev])
    }
    // Upsert per-job skills to the global skills table
    const skillsToSync = editingWork.ai_skills_extracted || []
    if (skillsToSync.length > 0) {
      for (const skillName of skillsToSync) {
        const { data: existing } = await supabase
          .from('skills')
          .select('id')
          .eq('user_id', user.id)
          .eq('name', skillName)
          .single()
        if (!existing) {
          await supabase.from('skills').insert({ user_id: user.id, name: skillName })
        }
      }
      // Refresh skills list
      const { data: sk } = await supabase.from('skills').select('*').eq('user_id', user.id).order('name')
      if (sk) setSkills(sk)
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
    // Work-type chronicle entries → open full WorkModal (migrate to work_entry on save)
    const entryCat = entry.canvas_col || entry.type
    if (entryCat === 'work') {
      const startDate = entry.start_date ? (entry.start_date.length <= 7 ? entry.start_date + '-01' : entry.start_date) : ''
      const endDate = entry.end_date ? (entry.end_date.length <= 7 ? entry.end_date + '-01' : entry.end_date) : ''
      setEditingWork({
        title: entry.title || '',
        company: '',
        location: '',
        location_type: '',
        start_date: startDate,
        end_date: endDate,
        is_current: !entry.end_date,
        description: entry.note || entry.description || '',
        engagement_type: 'full-time',
        ai_skills_extracted: [],
        id: `migrate-chronicle:${entry.id}`,
      })
      setEditingWorkId(null)
      setShowWorkModal(true)
      return
    }
    setEditingChronicle(entry)
    setShowChronicleModal(true)
  }

  const saveChronicle = async () => {
    if (!user || !editingChronicle) return
    const base: Record<string, unknown> = {
      title: editingChronicle.title,
      start_date: editingChronicle.start_date,
      end_date: editingChronicle.end_date || null,
      note: editingChronicle.note,
      show_on_resume: editingChronicle.show_on_resume,
    }

    // Try with all optional fields first, then progressively drop them
    const optionalFields: Record<string, unknown> = {}
    if (editingChronicle.description !== undefined) optionalFields.description = editingChronicle.description || null
    if (editingChronicle.image_url !== undefined) optionalFields.image_url = editingChronicle.image_url || null

    // Attempt 1: all fields + updated_at
    let { error } = await supabase
      .from('chronicle_entries')
      .update({ ...base, ...optionalFields, updated_at: new Date().toISOString() })
      .eq('id', editingChronicle.id)

    // Attempt 2: all fields without updated_at
    if (error) {
      console.warn('Chronicle save retry without updated_at:', error.message)
      ;({ error } = await supabase
        .from('chronicle_entries')
        .update({ ...base, ...optionalFields })
        .eq('id', editingChronicle.id))
    }

    // Attempt 3: without image_url (column may not exist yet)
    if (error) {
      console.warn('Chronicle save retry without image_url:', error.message)
      const { image_url: _drop, ...withoutImage } = optionalFields
      ;({ error } = await supabase
        .from('chronicle_entries')
        .update({ ...base, ...withoutImage })
        .eq('id', editingChronicle.id))
    }

    // Attempt 4: base fields only
    if (error) {
      console.warn('Chronicle save retry base fields only:', error.message)
      ;({ error } = await supabase
        .from('chronicle_entries')
        .update(base)
        .eq('id', editingChronicle.id))
    }

    if (!error) {
      if (!editingChronicle.show_on_resume) {
        setChronicleEntries(prev => prev.filter(e => e.id !== editingChronicle.id))
      } else {
        setChronicleEntries(prev => prev.map(e => e.id === editingChronicle.id ? editingChronicle : e))
      }
    } else {
      console.error('Failed to save chronicle entry:', error.message)
      alert('Failed to save: ' + error.message)
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
              {/* Profile photo upload */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 8, overflow: 'hidden',
                  border: '2px solid #334155', background: '#1e293b',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {profilePhoto ? (
                    <img src={profilePhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: 24, color: '#475569' }}>+</span>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Profile Photo</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <label style={{ ...btnSecondary, display: 'inline-block', fontSize: '12px', padding: '6px 12px' }}>
                      Upload
                      <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleProfilePhotoUpload} style={{ display: 'none' }} />
                    </label>
                    {profilePhoto && (
                      <button onClick={() => setProfilePhoto('')} style={{ ...btnSecondary, fontSize: '12px', padding: '6px 12px', color: '#ef4444', borderColor: '#7f1d1d' }}>Remove</button>
                    )}
                  </div>
                </div>
              </div>
              <input value={profileName} onChange={e => setProfileName(e.target.value)} placeholder="Full Name" style={inputStyle} />
              <input value={profileHeadline} onChange={e => setProfileHeadline(e.target.value)} placeholder="Headline (e.g. Software Engineer at Acme)" style={inputStyle} />
              <input value={profileLocation} onChange={e => setProfileLocation(e.target.value)} placeholder="Location" style={inputStyle} />
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Birthday</label>
                <input type="date" value={profileBirthday} onChange={e => setProfileBirthday(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={saveProfile} style={btnPrimary}>Save</button>
                <button onClick={() => setEditingProfile(false)} style={btnSecondary}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {profilePhoto && (
                  <div style={{
                    width: 56, height: 56, borderRadius: 8, overflow: 'hidden',
                    border: '2px solid #334155', flexShrink: 0,
                  }}>
                    <img src={profilePhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
                <div>
                  <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{profileName || 'Your Name'}</h1>
                  <p style={{ color: '#94a3b8', fontSize: '14px', margin: '4px 0 0' }}>{profileHeadline || 'Add a headline'}</p>
                  {profileLocation && <p style={{ color: '#64748b', fontSize: '13px', margin: '2px 0 0' }}>{profileLocation}</p>}
                </div>
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
                  {
                    const locLabel = LOCATION_TYPES.find(l => l.value === entry.location_type)?.label
                    const entrySkills = entry.ai_skills_extracted || []
                    return (
                      <div key={`w-${entry.id}`} style={cardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '16px' }}>{entry.title}</div>
                            <div style={{ color: '#94a3b8', fontSize: '14px' }}>
                              {entry.company}
                              {entry.engagement_type && entry.engagement_type !== 'full-time' ? ` · ${entry.engagement_type.charAt(0).toUpperCase() + entry.engagement_type.slice(1)}` : ''}
                            </div>
                            <div style={{ color: '#64748b', fontSize: '13px', marginTop: '2px' }}>
                              {formatDate(entry.start_date)} – {entry.is_current ? 'Present' : formatDate(entry.end_date)}
                              {entry.location ? ` · ${entry.location}` : ''}
                              {locLabel ? ` · ${locLabel}` : ''}
                            </div>
                            {entry.description && (
                              <p style={{ color: '#cbd5e1', fontSize: '14px', marginTop: '8px', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{entry.description}</p>
                            )}
                            {entrySkills.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '10px' }}>
                                {entrySkills.map(sk => (
                                  <span key={sk} style={{
                                    padding: '2px 10px', fontSize: '11px', borderRadius: '12px',
                                    background: 'rgba(167,139,250,0.1)', color: '#c4b5fd',
                                    border: '1px solid rgba(167,139,250,0.2)',
                                  }}>{sk}</span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '6px', flexShrink: 0, marginLeft: '12px' }}>
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
                  }
                } else {
                  const entry = item.data as ChronicleResumeEntry
                  const entryCat = entry.canvas_col || entry.type
                  const isWorkType = entryCat === 'work'
                  const catLabel = isWorkType ? '' : (CAT_LABELS[entryCat] || entry.type)
                  const startYM = entry.start_date?.slice(0, 7) || ''
                  const endYM = entry.end_date?.slice(0, 7) || ''
                  return (
                    <div key={`c-${entry.id}`} style={cardStyle}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ fontWeight: 600, fontSize: '16px' }}>{entry.title}</div>
                            {catLabel && (
                              <span style={{
                                fontSize: '10px', padding: '2px 7px', borderRadius: '10px',
                                background: '#334155', color: '#94a3b8', letterSpacing: '.04em',
                              }}>{catLabel}</span>
                            )}
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
        <KeyLinksSection
          keyLinks={keyLinks}
          editingLinks={editingLinks}
          setEditingLinks={setEditingLinks}
          updateLink={updateLink}
          saveKeyLinks={saveKeyLinks}
        />

        {/* SKILLS & INTERESTS */}
        <section style={{ marginTop: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>Skills &amp; Interests</h2>
          </div>

          {/* Add new skill */}
          <div style={{ ...cardStyle, display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 180px' }}>
              <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Skill / Interest</label>
              <input
                value={newSkillName}
                onChange={e => setNewSkillName(e.target.value)}
                placeholder="e.g. Python, Sailing, Machine Learning"
                style={inputStyle}
                onKeyDown={e => { if (e.key === 'Enter') addSkill() }}
              />
            </div>
            <div style={{ flex: '0 1 140px' }}>
              <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Category</label>
              <input
                value={newSkillCategory}
                onChange={e => setNewSkillCategory(e.target.value)}
                placeholder="e.g. Tech, Hobby"
                style={inputStyle}
                onKeyDown={e => { if (e.key === 'Enter') addSkill() }}
              />
            </div>
            <div style={{ flex: '0 0 auto' }}>
              <button onClick={addSkill} style={btnPrimary}>+ Add</button>
            </div>
          </div>

          {/* Skill list */}
          {skills.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
              {skills.map(sk => (
                <div key={sk.id} style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: '#1e293b', border: '1px solid #334155', borderRadius: '20px',
                  padding: '6px 14px', fontSize: '13px', color: '#e2e8f0',
                }}>
                  <span>{sk.name}</span>
                  {sk.category && (
                    <span style={{ fontSize: '10px', color: '#64748b', background: '#0f172a', borderRadius: '8px', padding: '1px 7px' }}>
                      {sk.category}
                    </span>
                  )}
                  <button
                    onClick={() => sk.id && deleteSkill(sk.id)}
                    style={{
                      background: 'none', border: 'none', color: '#64748b', cursor: 'pointer',
                      fontSize: '14px', padding: '0 2px', lineHeight: 1,
                    }}
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {skills.length === 0 && (
            <div style={{ color: '#475569', fontSize: '14px', textAlign: 'center', marginTop: '12px' }}>
              No skills or interests added yet. These help identify synergies with your connections.
            </div>
          )}
        </section>
      </main>

      {/* WORK MODAL */}
      <WorkModal
        show={showWorkModal}
        editingWork={editingWork}
        editingWorkId={editingWorkId}
        setEditingWork={setEditingWork}
        onSave={saveWork}
        onClose={() => setShowWorkModal(false)}
      />

      {/* CHRONICLE ENTRY MODAL */}
      <ChronicleEntryModal
        show={showChronicleModal}
        editingChronicle={editingChronicle}
        setEditingChronicle={setEditingChronicle}
        onSave={saveChronicle}
        onDelete={deleteChronicle}
        onClose={() => { setShowChronicleModal(false); setEditingChronicle(null) }}
      />

      {/* EDUCATION MODAL */}
      <EducationModal
        show={showEduModal}
        editingEdu={editingEdu}
        editingEduId={editingEduId}
        setEditingEdu={setEditingEdu}
        onSave={saveEdu}
        onClose={() => setShowEduModal(false)}
      />
    </div>
  )
}
