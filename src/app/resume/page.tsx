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
import { formatDate, computeDuration } from './utils'

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
  const [isPublic, setIsPublic] = useState(true)

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

  // Account deletion
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

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
        setIsPublic(profile.is_public !== false) // default true
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
        title: w.title || '',
        company: w.company || '',
        location: w.location || '',
        location_type: w.remote_type || '',
        start_date: w.start_date || '',
        end_date: w.end_date || '',
        description: w.description || '',
        engagement_type: w.engagement_type || 'full-time',
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

  const toggleVisibility = async (checked: boolean) => {
    if (!user) return
    setIsPublic(checked)
    await supabase.from('profiles').update({ is_public: checked }).eq('id', user.id)
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
  const openAddProject = () => {
    setEditingChronicle({ id: '', type: 'project', canvas_col: 'project', title: '', start_date: '', end_date: null, note: null, description: null, image_url: null, color: null, show_on_resume: true })
    setShowChronicleModal(true)
  }

  const saveWork = async () => {
    if (!user) return
    const migratePrefix = 'migrate-chronicle:'
    const isMigration = editingWork.id?.startsWith(migratePrefix)
    const chronicleId = isMigration ? editingWork.id!.slice(migratePrefix.length) : null

    // Phase 1 payload: columns guaranteed to exist (003_resume_tables migration)
    const basePayload: Record<string, unknown> = {
      user_id: user.id,
      title: editingWork.title,
      company: editingWork.company,
      start_date: editingWork.start_date,
      end_date: editingWork.is_current ? null : (editingWork.end_date || null),
      is_current: editingWork.is_current,
      description: editingWork.description || null,
      engagement_type: editingWork.engagement_type,
    }
    // Phase 2 payload: optional columns that may not exist yet (applied silently)
    const extraCols: Record<string, unknown> = {}
    extraCols.location = editingWork.location || null
    extraCols.remote_type = editingWork.location_type || null
    if (editingWork.ai_skills_extracted !== undefined) extraCols.ai_skills_extracted = editingWork.ai_skills_extracted || []
    if (editingWork.show_on_resume !== undefined) extraCols.show_on_resume = editingWork.show_on_resume
    if (editingWork.chronicle_color) extraCols.chronicle_color = editingWork.chronicle_color
    if (editingWork.chronicle_fuzzy_start !== undefined) extraCols.chronicle_fuzzy_start = editingWork.chronicle_fuzzy_start
    if (editingWork.chronicle_fuzzy_end !== undefined) extraCols.chronicle_fuzzy_end = editingWork.chronicle_fuzzy_end
    if (editingWork.chronicle_note !== undefined) extraCols.chronicle_note = editingWork.chronicle_note || null

    const doInsert = async () => {
      const { data, error } = await supabase.from('work_entries').insert(basePayload).select().single()
      if (error) return { data: null, error }
      // Silently apply extras
      if (data && Object.keys(extraCols).length > 0) {
        await supabase.from('work_entries').update(extraCols).eq('id', data.id).then(() => {}, () => {})
      }
      return { data, error: null }
    }
    const doUpdate = async (id: string) => {
      const { user_id, ...updateFields } = basePayload
      const { data, error } = await supabase.from('work_entries').update(updateFields).eq('id', id).select().single()
      if (error) return { data: null, error }
      if (data && Object.keys(extraCols).length > 0) {
        await supabase.from('work_entries').update(extraCols).eq('id', id).then(() => {}, () => {})
      }
      return { data, error: null }
    }

    const mapWork = (data: any) => ({
      ...data,
      title: data.title || '',
      company: data.company || '',
      location: data.location || '',
      location_type: data.remote_type || '',
      start_date: data.start_date || '',
      end_date: data.end_date || '',
      description: data.description || '',
      engagement_type: data.engagement_type || 'full-time',
      ai_skills_extracted: data.ai_skills_extracted || [],
      show_on_resume: editingWork.show_on_resume !== false,
    })

    if (isMigration) {
      const { data, error } = await doInsert()
      if (error) { console.error('Migration insert failed:', error.message); alert('Failed to save: ' + error.message); return }
      if (data) {
        setWorkEntries(prev => [mapWork(data), ...prev])
        await supabase.from('chronicle_entries').delete().eq('id', chronicleId!)
        setChronicleEntries(prev => prev.filter(e => e.id !== chronicleId))
      }
    } else if (editingWorkId) {
      const { data, error } = await doUpdate(editingWorkId)
      if (error) { console.error('Update failed:', error.message); alert('Failed to save: ' + error.message); return }
      if (data) setWorkEntries(prev => prev.map(e => e.id === editingWorkId ? mapWork(data) : e))
    } else {
      const { data, error } = await doInsert()
      if (error) { console.error('Insert failed:', error.message); alert('Failed to save: ' + error.message); return }
      if (data) setWorkEntries(prev => [mapWork(data), ...prev])
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
    // Phase 1: only base columns (guaranteed to exist)
    const basePayload: Record<string, unknown> = {
      user_id: user.id,
      institution: editingEdu.institution,
      degree: editingEdu.degree || null,
      field_of_study: editingEdu.field_of_study || null,
      start_date: editingEdu.start_date || null,
      end_date: editingEdu.is_current ? null : (editingEdu.end_date || null),
      is_current: editingEdu.is_current,
      description: editingEdu.description || null,
    }
    // Phase 2: optional columns from later migrations
    const extraCols: Record<string, unknown> = {}
    if (editingEdu.show_on_resume !== undefined) extraCols.show_on_resume = editingEdu.show_on_resume

    if (editingEduId) {
      const { user_id, ...updateFields } = basePayload
      const { data, error } = await supabase.from('education').update(updateFields).eq('id', editingEduId).select().single()
      if (error) { console.error('Education update failed:', error); alert('Failed to save: ' + error.message); return }
      if (data && Object.keys(extraCols).length > 0) {
        await supabase.from('education').update(extraCols).eq('id', data.id).then(() => {}, () => {})
      }
      if (data) setEduEntries(prev => prev.map(e => e.id === editingEduId ? { ...data, show_on_resume: editingEdu.show_on_resume } : e))
    } else {
      const { data, error } = await supabase.from('education').insert(basePayload).select().single()
      if (error) { console.error('Education insert failed:', error); alert('Failed to save: ' + error.message); return }
      if (data && Object.keys(extraCols).length > 0) {
        await supabase.from('education').update(extraCols).eq('id', data.id).then(() => {}, () => {})
      }
      if (data) setEduEntries(prev => [{ ...data, show_on_resume: editingEdu.show_on_resume }, ...prev])
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
    const isNew = !editingChronicle.id
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

    if (isNew) {
      // INSERT path for new chronicle entries (e.g. adding a project)
      const insertPayload = {
        user_id: user.id,
        type: editingChronicle.type,
        canvas_col: editingChronicle.canvas_col,
        ...base,
        ...optionalFields,
      }
      if (editingChronicle.color) (insertPayload as any).color = editingChronicle.color
      const { data, error } = await supabase.from('chronicle_entries').insert(insertPayload).select().single()
      if (error) {
        console.error('Failed to insert chronicle entry:', error.message)
        alert('Failed to save: ' + error.message)
      } else if (data) {
        if (data.show_on_resume) {
          setChronicleEntries(prev => [data, ...prev])
        }
      }
    } else {
      // UPDATE path for existing entries
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

  const toggleWorkVisibility = async (entry: WorkEntry) => {
    const newVal = entry.show_on_resume === false ? true : false
    setWorkEntries(prev => prev.map(e => e.id === entry.id ? { ...e, show_on_resume: newVal } : e))
    await supabase.from('work_entries').update({ show_on_resume: newVal }).eq('id', entry.id)
  }

  const toggleEduVisibility = async (entry: EducationEntry) => {
    const newVal = (entry as any).show_on_resume === false ? true : false
    setEduEntries(prev => prev.map(e => e.id === entry.id ? { ...e, show_on_resume: newVal } : e))
    await supabase.from('education').update({ show_on_resume: newVal }).eq('id', entry.id)
  }

  const toggleChronicleVisibility = async (entry: ChronicleResumeEntry) => {
    const newVal = !entry.show_on_resume
    if (newVal) {
      // Toggling ON: update DB then add to local list
      await supabase.from('chronicle_entries').update({ show_on_resume: true }).eq('id', entry.id)
      setChronicleEntries(prev => prev.map(e => e.id === entry.id ? { ...e, show_on_resume: true } : e))
    } else {
      // Toggling OFF: update DB and mark as hidden locally
      setChronicleEntries(prev => prev.map(e => e.id === entry.id ? { ...e, show_on_resume: false } : e))
      await supabase.from('chronicle_entries').update({ show_on_resume: false }).eq('id', entry.id)
    }
  }

  const deleteAccount = async () => {
    if (!user || deleteConfirmText !== 'DELETE') return
    setDeleting(true)
    try {
      const uid = user.id

      // 1. Clear linked_profile_id on OTHER people's contacts that point to this user
      await supabase
        .from('contacts')
        .update({ linked_profile_id: null })
        .eq('linked_profile_id', uid)

      // 2. Delete contact_notes for contacts I own
      const { data: myContacts } = await supabase
        .from('contacts')
        .select('id')
        .eq('owner_id', uid)
      if (myContacts && myContacts.length > 0) {
        const contactIds = myContacts.map((c: { id: string }) => c.id)
        for (const cid of contactIds) {
          await supabase.from('contact_notes').delete().eq('contact_id', cid)
        }
      }

      // 3. Delete all user data from each table
      await supabase.from('contacts').delete().eq('owner_id', uid)
      await supabase.from('connections').delete().or(`inviter_id.eq.${uid},invitee_id.eq.${uid}`)
      await supabase.from('link_invitations').delete().or(`from_user_id.eq.${uid},to_user_id.eq.${uid}`)
      await supabase.from('work_entries').delete().eq('user_id', uid)
      await supabase.from('education').delete().eq('user_id', uid)
      await supabase.from('chronicle_entries').delete().eq('user_id', uid)
      await supabase.from('skills').delete().eq('user_id', uid)
      await supabase.from('profiles').delete().eq('id', uid)

      // 4. Sign out and redirect
      await supabase.auth.signOut()
      router.push('/login')
    } catch (err: any) {
      console.error('Account deletion error:', err)
      alert('Failed to delete account: ' + (err.message || 'Unknown error'))
      setDeleting(false)
    }
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

          {/* Visibility toggle */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            marginTop: '12px', paddingTop: '12px',
            borderTop: '1px solid #334155',
          }}>
            <input
              type="checkbox"
              id="world-visible"
              checked={isPublic}
              onChange={(e) => toggleVisibility(e.target.checked)}
              style={{ accentColor: '#a78bfa', width: '16px', height: '16px', cursor: 'pointer' }}
            />
            <label
              htmlFor="world-visible"
              style={{ fontSize: '13px', color: '#94a3b8', cursor: 'pointer', userSelect: 'none' }}
            >
              Visible in the World listing
            </label>
            <span style={{ fontSize: '11px', color: '#475569', marginLeft: '4px' }}>
              {isPublic ? '— others can see your profile' : '— your profile is hidden'}
            </span>
          </div>
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
            {(() => {
              // Group work entries by company
              const companyMap = new Map<string, WorkEntry[]>()
              for (const e of workEntries) {
                const key = e.company.toLowerCase().trim()
                if (!companyMap.has(key)) companyMap.set(key, [])
                companyMap.get(key)!.push(e)
              }
              for (const [, entries] of companyMap) {
                entries.sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''))
              }

              type DisplayItem =
                | { kind: 'company_group'; sortDate: string; entries: WorkEntry[] }
                | { kind: 'chronicle'; sortDate: string; data: ChronicleResumeEntry }

              const items: DisplayItem[] = []
              for (const [, entries] of companyMap) {
                items.push({ kind: 'company_group', sortDate: entries[0].start_date || '', entries })
              }
              for (const e of chronicleEntries.filter(e => e.canvas_col !== 'project' && e.type !== 'project' && e.canvas_col !== 'education' && e.type !== 'education')) {
                items.push({ kind: 'chronicle', sortDate: e.start_date || '', data: e })
              }
              items.sort((a, b) => b.sortDate.localeCompare(a.sortDate))

              // Shared role action buttons
              const roleActions = (entry: WorkEntry) => {
                const isHidden = entry.show_on_resume === false
                return (
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0, marginLeft: '12px' }}>
                    <button onClick={() => toggleWorkVisibility(entry)} style={{ ...iconBtn, color: isHidden ? '#475569' : '#a78bfa', borderColor: isHidden ? '#334155' : 'rgba(167,139,250,0.3)' }} title={isHidden ? 'Hidden from public resume' : 'Visible on public resume'}>
                      {isHidden ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      )}
                    </button>
                    <button onClick={() => openEditWork(entry)} style={iconBtn} title="Edit">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button onClick={() => entry.id && deleteWork(entry.id)} style={iconBtnDanger} title="Delete">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    </button>
                  </div>
                )
              }

              // Shared role detail renderer
              const roleDetail = (entry: WorkEntry, showCompany: boolean) => {
                const locLabel = LOCATION_TYPES.find(l => l.value === entry.location_type)?.label
                const entrySkills = entry.ai_skills_extracted || []
                const duration = computeDuration(entry.start_date, entry.end_date, entry.is_current)
                const engLabel = entry.engagement_type ? entry.engagement_type.charAt(0).toUpperCase() + entry.engagement_type.slice(1) : ''
                return (
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: showCompany ? '16px' : '15px' }}>{entry.title}</div>
                    {showCompany ? (
                      <div style={{ color: '#94a3b8', fontSize: '14px' }}>
                        {entry.company}
                        {engLabel && engLabel !== 'Full-time' ? ` · ${engLabel}` : ''}
                      </div>
                    ) : (
                      engLabel && <div style={{ color: '#94a3b8', fontSize: '13px' }}>{engLabel}</div>
                    )}
                    <div style={{ color: '#64748b', fontSize: '13px', marginTop: '2px' }}>
                      {formatDate(entry.start_date)} – {entry.is_current ? 'Present' : formatDate(entry.end_date)}
                      {duration ? ` · ${duration}` : ''}
                    </div>
                    {(entry.location || locLabel) && (
                      <div style={{ color: '#64748b', fontSize: '13px' }}>
                        {entry.location}{entry.location && locLabel ? ` · ${locLabel}` : locLabel || ''}
                      </div>
                    )}
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
                )
              }

              return items.map(item => {
                if (item.kind === 'company_group') {
                  const entries = item.entries

                  // ─ Single role: flat card ─
                  if (entries.length === 1) {
                    const entry = entries[0]
                    const isHidden = entry.show_on_resume === false
                    return (
                      <div key={`w-${entry.id}`} style={{ ...cardStyle, opacity: isHidden ? 0.45 : 1, transition: 'opacity 0.2s' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          {roleDetail(entry, true)}
                          {roleActions(entry)}
                        </div>
                      </div>
                    )
                  }

                  // ─ Multi-role: grouped card with timeline ─
                  const companyName = entries[0].company
                  const allHidden = entries.every(e => e.show_on_resume === false)

                  // Compute total company duration
                  let earliestStart = entries[0].start_date
                  let latestEnd = entries[0].end_date
                  let hasCurrent = false
                  for (const e of entries) {
                    if (e.start_date && (!earliestStart || e.start_date < earliestStart)) earliestStart = e.start_date
                    if (e.is_current) hasCurrent = true
                    else if (e.end_date && (!latestEnd || e.end_date > latestEnd)) latestEnd = e.end_date
                  }
                  const totalDuration = computeDuration(earliestStart, latestEnd, hasCurrent)

                  return (
                    <div key={`group-${entries[0].id}`} style={{ ...cardStyle, opacity: allHidden ? 0.45 : 1, transition: 'opacity 0.2s' }}>
                      {/* Company header */}
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '16px' }}>{companyName}</div>
                        {totalDuration && (
                          <div style={{ color: '#64748b', fontSize: '13px', marginTop: '2px' }}>{totalDuration}</div>
                        )}
                      </div>

                      {/* Roles timeline */}
                      <div style={{ marginTop: '16px' }}>
                        {entries.map((entry, idx) => {
                          const isLast = idx === entries.length - 1
                          const isHidden = entry.show_on_resume === false
                          return (
                            <div key={`w-${entry.id}`} style={{ display: 'flex', gap: '12px', opacity: isHidden ? 0.45 : 1, transition: 'opacity 0.2s' }}>
                              {/* Timeline column */}
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '16px', flexShrink: 0 }}>
                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#64748b', border: '2px solid #1e293b', flexShrink: 0, marginTop: 6 }} />
                                {!isLast && <div style={{ width: 2, flex: 1, background: '#334155' }} />}
                              </div>
                              {/* Role content */}
                              <div style={{ flex: 1, paddingBottom: isLast ? 0 : 20 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                  {roleDetail(entry, false)}
                                  {roleActions(entry)}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                } else {
                  const entry = item.data as ChronicleResumeEntry
                  const entryCat = entry.canvas_col || entry.type
                  const isWorkType = entryCat === 'work'
                  const catLabel = isWorkType ? '' : (CAT_LABELS[entryCat] || entry.type)
                  const startYM = entry.start_date?.slice(0, 7) || ''
                  const endYM = entry.end_date?.slice(0, 7) || ''
                  const isChronHidden = !entry.show_on_resume
                  return (
                    <div key={`c-${entry.id}`} style={{ ...cardStyle, opacity: isChronHidden ? 0.45 : 1, transition: 'opacity 0.2s' }}>
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
                          <button onClick={() => toggleChronicleVisibility(entry)} style={{ ...iconBtn, color: isChronHidden ? '#475569' : '#a78bfa', borderColor: isChronHidden ? '#334155' : 'rgba(167,139,250,0.3)' }} title={isChronHidden ? 'Hidden from public resume' : 'Visible on public resume'}>
                            {isChronHidden ? (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            )}
                          </button>
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
            })()}
          </div>
        </section>

        {/* PROJECTS (chronicle entries with canvas_col === 'project') */}
        {(() => {
          const projectEntries = chronicleEntries.filter(e => e.canvas_col === 'project' || e.type === 'project')
          return (
            <section style={{ marginTop: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>Projects</h2>
                <button onClick={openAddProject} style={btnPrimary}>+ Add</button>
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
                        opacity: !project.show_on_resume ? 0.45 : 1,
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
                            <button onClick={() => toggleChronicleVisibility(project)} style={{ ...iconBtn, color: !project.show_on_resume ? '#475569' : '#a78bfa', borderColor: !project.show_on_resume ? '#334155' : 'rgba(167,139,250,0.3)' }} title={!project.show_on_resume ? 'Hidden from public resume' : 'Visible on public resume'}>
                              {!project.show_on_resume ? (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                              ) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                              )}
                            </button>
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
                      const isEduHidden = (entry as any).show_on_resume === false
                      return (
                        <div key={entry.id} style={{ ...cardStyle, opacity: isEduHidden ? 0.45 : 1, transition: 'opacity 0.2s' }}>
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
                              <button onClick={() => toggleEduVisibility(entry)} style={{ ...iconBtn, color: isEduHidden ? '#475569' : '#a78bfa', borderColor: isEduHidden ? '#334155' : 'rgba(167,139,250,0.3)' }} title={isEduHidden ? 'Hidden from public resume' : 'Visible on public resume'}>
                                {isEduHidden ? (
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                                ) : (
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                )}
                              </button>
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
                      const isEduChronHidden = !entry.show_on_resume
                      const startYM = entry.start_date?.slice(0, 7) || ''
                      const endYM = entry.end_date?.slice(0, 7) || ''
                      return (
                        <div key={`c-${entry.id}`} style={{ ...cardStyle, opacity: isEduChronHidden ? 0.45 : 1, transition: 'opacity 0.2s' }}>
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
                              <button onClick={() => toggleChronicleVisibility(entry)} style={{ ...iconBtn, color: isEduChronHidden ? '#475569' : '#a78bfa', borderColor: isEduChronHidden ? '#334155' : 'rgba(167,139,250,0.3)' }} title={isEduChronHidden ? 'Hidden from public resume' : 'Visible on public resume'}>
                                {isEduChronHidden ? (
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                                ) : (
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                )}
                              </button>
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
        {/* DANGER ZONE */}
        <section style={{ marginTop: '48px', borderTop: '1px solid #7f1d1d', paddingTop: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 8px', color: '#ef4444' }}>Danger Zone</h2>
          {!showDeleteConfirm ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', ...cardStyle, borderColor: '#7f1d1d' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>Delete Account</div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  Permanently delete your account and all associated data. This cannot be undone.
                </div>
              </div>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                style={{
                  padding: '8px 18px',
                  background: 'transparent',
                  color: '#ef4444',
                  border: '1px solid #7f1d1d',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                Delete Account
              </button>
            </div>
          ) : (
            <div style={{ ...cardStyle, borderColor: '#ef4444' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#ef4444', marginBottom: '8px' }}>
                Are you absolutely sure?
              </div>
              <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '12px', lineHeight: '1.6' }}>
                This will permanently delete your profile, all work entries, education, projects, skills, contacts, notes, connections, and invitations. Other users who linked with you will have their link removed. There is no going back.
              </div>
              <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '8px' }}>
                Type <span style={{ fontWeight: 700, color: '#ef4444' }}>DELETE</span> to confirm:
              </div>
              <input
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE"
                style={{ ...inputStyle, borderColor: '#7f1d1d', marginBottom: '12px', maxWidth: '200px' }}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={deleteAccount}
                  disabled={deleteConfirmText !== 'DELETE' || deleting}
                  style={{
                    padding: '8px 18px',
                    background: deleteConfirmText === 'DELETE' ? '#ef4444' : '#334155',
                    color: deleteConfirmText === 'DELETE' ? '#fff' : '#64748b',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: deleteConfirmText === 'DELETE' ? 'pointer' : 'not-allowed',
                    opacity: deleting ? 0.5 : 1,
                  }}
                >
                  {deleting ? 'Deleting…' : 'Permanently Delete Account'}
                </button>
                <button
                  onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText('') }}
                  style={btnSecondary}
                >
                  Cancel
                </button>
              </div>
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
