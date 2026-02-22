'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

interface WorkEntry {
  id?: string
  title: string
  company: string
  engagement_type: string
  start_date: string
  end_date: string
  is_current: boolean
  description: string
  location: string
  remote_type: string
  compensation_amount: string
  compensation_currency: string
  compensation_period: string
  compensation_notes: string
  is_compensation_private: boolean
}

const EMPTY_ENTRY: WorkEntry = {
  title: '',
  company: '',
  engagement_type: 'full-time',
  start_date: '',
  end_date: '',
  is_current: false,
  description: '',
  location: '',
  remote_type: 'onsite',
  compensation_amount: '',
  compensation_currency: 'USD',
  compensation_period: 'annually',
  compensation_notes: '',
  is_compensation_private: true,
}

const ENGAGEMENT_TYPES = [
  { value: 'full-time', label: 'Full-Time' },
  { value: 'part-time', label: 'Part-Time' },
  { value: 'contract', label: 'Contract' },
  { value: 'freelance', label: 'Freelance' },
  { value: 'consulting', label: 'Consulting' },
  { value: 'volunteer', label: 'Volunteer' },
  { value: 'internship', label: 'Internship' },
  { value: 'project-based', label: 'Project-Based' },
]

const REMOTE_TYPES = [
  { value: 'onsite', label: 'On-site' },
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
]

const COMP_PERIODS = [
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'annually', label: 'Annually' },
  { value: 'project', label: 'Per Project' },
  { value: 'retainer', label: 'Retainer' },
]

interface Props {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
  editEntry?: WorkEntry | null
}

export default function ExperienceModal({ isOpen, onClose, onSaved, editEntry }: Props) {
  const [entry, setEntry] = useState<WorkEntry>(EMPTY_ENTRY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showCompensation, setShowCompensation] = useState(false)
  const [skillInput, setSkillInput] = useState('')
  const [skills, setSkills] = useState<string[]>([])
  const supabase = createClientComponentClient()

  useEffect(() => {
    if (editEntry) {
      setEntry(editEntry)
      setShowCompensation(!!editEntry.compensation_amount)
    } else {
      setEntry(EMPTY_ENTRY)
      setShowCompensation(false)
      setSkills([])
    }
  }, [editEntry, isOpen])

  const updateField = (field: keyof WorkEntry, value: string | boolean) => {
    setEntry(prev => ({ ...prev, [field]: value }))
  }

  const addSkill = () => {
    const trimmed = skillInput.trim()
    if (trimmed && !skills.includes(trimmed)) {
      setSkills(prev => [...prev, trimmed])
      setSkillInput('')
    }
  }

  const removeSkill = (skill: string) => {
    setSkills(prev => prev.filter(s => s !== skill))
  }

  const handleSave = async () => {
    if (!entry.title.trim()) {
      setError('Title is required')
      return
    }

    setSaving(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const payload = {
        user_id: user.id,
        title: entry.title.trim(),
        company: entry.company.trim() || null,
        engagement_type: entry.engagement_type,
        start_date: entry.start_date || null,
        end_date: entry.is_current ? null : (entry.end_date || null),
        is_current: entry.is_current,
        description: entry.description.trim() || null,
        location: entry.location.trim() || null,
        remote_type: entry.remote_type,
        compensation_amount: showCompensation && entry.compensation_amount ? parseFloat(entry.compensation_amount) : null,
        compensation_currency: showCompensation ? entry.compensation_currency : 'USD',
        compensation_period: showCompensation ? entry.compensation_period : null,
        compensation_notes: showCompensation ? (entry.compensation_notes.trim() || null) : null,
        is_compensation_private: entry.is_compensation_private,
      }

      let savedId: string | undefined
      if (entry.id) {
        const { error: updateError } = await supabase
          .from('work_entries')
          .update(payload)
          .eq('id', entry.id)
        if (updateError) throw updateError
        savedId = entry.id
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from('work_entries')
          .insert(payload)
          .select('id')
          .single()
        if (insertError) throw insertError
        savedId = inserted?.id
      }

      // Phase 2: optional column (silently skip if missing)
      if (savedId && skills.length > 0) {
        await supabase.from('work_entries').update({ ai_skills_extracted: skills }).eq('id', savedId).then(() => {}, () => {})
      }

      // Upsert skills to the skills table
      if (skills.length > 0) {
        for (const skillName of skills) {
          const { data: existing } = await supabase
            .from('skills')
            .select('id')
            .eq('user_id', user.id)
            .eq('name', skillName)
            .single()

          if (!existing) {
            await supabase.from('skills').insert({
              user_id: user.id,
              name: skillName,
            })
          }
        }
      }

      onSaved()
      onClose()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800 sticky top-0 bg-zinc-900 rounded-t-2xl z-10">
          <h2 className="text-xl font-bold text-white">
            {editEntry?.id ? 'Edit Experience' : 'Add Experience'}
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition p-1"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Title & Company */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Title *</label>
              <input
                type="text"
                value={entry.title}
                onChange={e => updateField('title', e.target.value)}
                placeholder="e.g. Senior Developer"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Company / Client</label>
              <input
                type="text"
                value={entry.company}
                onChange={e => updateField('company', e.target.value)}
                placeholder="e.g. Acme Corp"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition"
              />
            </div>
          </div>

          {/* Engagement Type & Remote */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Engagement Type</label>
              <select
                value={entry.engagement_type}
                onChange={e => updateField('engagement_type', e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-amber-500 transition"
              >
                {ENGAGEMENT_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Work Location</label>
              <select
                value={entry.remote_type}
                onChange={e => updateField('remote_type', e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-amber-500 transition"
              >
                {REMOTE_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Location</label>
            <input
              type="text"
              value={entry.location}
              onChange={e => updateField('location', e.target.value)}
              placeholder="e.g. New York, NY"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Start Date</label>
              <input
                type="date"
                value={entry.start_date}
                onChange={e => updateField('start_date', e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-amber-500 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">End Date</label>
              <input
                type="date"
                value={entry.end_date}
                onChange={e => updateField('end_date', e.target.value)}
                disabled={entry.is_current}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-amber-500 transition disabled:opacity-40"
              />
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={entry.is_current}
                  onChange={e => updateField('is_current', e.target.checked)}
                  className="w-4 h-4 rounded bg-zinc-800 border-zinc-600 text-amber-500 focus:ring-amber-500"
                />
                <span className="text-sm text-zinc-400">I currently work here</span>
              </label>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Description</label>
            <textarea
              value={entry.description}
              onChange={e => updateField('description', e.target.value)}
              rows={4}
              placeholder="What did you do? What impact did you make?"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition resize-none"
            />
          </div>

          {/* Skills */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Skills Used</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={skillInput}
                onChange={e => setSkillInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                placeholder="Type a skill and press Enter"
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition"
              />
              <button
                onClick={addSkill}
                className="px-4 py-2.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition"
              >
                Add
              </button>
            </div>
            {skills.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {skills.map(skill => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-amber-500/10 text-amber-400 rounded-full text-sm"
                  >
                    {skill}
                    <button
                      onClick={() => removeSkill(skill)}
                      className="hover:text-amber-200 transition"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Compensation Toggle */}
          <div className="border-t border-zinc-800 pt-6">
            <button
              onClick={() => setShowCompensation(!showCompensation)}
              className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition"
            >
              <svg className={`w-4 h-4 transition-transform ${showCompensation ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Compensation (Private)
              <span className="ml-1 px-2 py-0.5 bg-zinc-800 rounded text-xs text-zinc-500">🔒 Only you can see this</span>
            </button>

            {showCompensation && (
              <div className="mt-4 space-y-4 pl-6 border-l-2 border-zinc-800">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1.5">Amount</label>
                    <input
                      type="number"
                      value={entry.compensation_amount}
                      onChange={e => updateField('compensation_amount', e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1.5">Currency</label>
                    <select
                      value={entry.compensation_currency}
                      onChange={e => updateField('compensation_currency', e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-amber-500 transition"
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                      <option value="CAD">CAD</option>
                      <option value="AUD">AUD</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1.5">Period</label>
                    <select
                      value={entry.compensation_period}
                      onChange={e => updateField('compensation_period', e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-amber-500 transition"
                    >
                      {COMP_PERIODS.map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">Notes</label>
                  <input
                    type="text"
                    value={entry.compensation_notes}
                    onChange={e => updateField('compensation_notes', e.target.value)}
                    placeholder="e.g. Plus equity, bonus structure, etc."
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-800 sticky bottom-0 bg-zinc-900 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-zinc-400 hover:text-white transition rounded-lg hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : (editEntry?.id ? 'Update' : 'Save')}
          </button>
        </div>
      </div>
    </div>
  )
}
