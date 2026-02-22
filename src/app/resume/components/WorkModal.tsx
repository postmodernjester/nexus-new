'use client'

import { useState, useEffect, useRef } from 'react'
import { WorkEntry, ENGAGEMENT_TYPES, LOCATION_TYPES } from '../types'
import { inputStyle, textareaStyle, btnPrimary, btnSecondary, modalOverlay, modalBox } from '../styles'
import DatePicker from './DatePicker'

interface WorkModalProps {
  show: boolean
  editingWork: WorkEntry
  editingWorkId: string | null
  setEditingWork: (work: WorkEntry) => void
  onSave: () => void
  onClose: () => void
  onDelete?: (id: string) => void
  /** When true, shows chronicle-specific fields (color, fuzzy edges) */
  chronicleMode?: boolean
}

const CHRONICLE_COLORS = [
  '#1a3660', '#2d5080', '#4070a8', '#5890c8', '#78b0e0',
  '#3060c0', '#5080d8', '#284878',
]

export default function WorkModal({
  show, editingWork, editingWorkId, setEditingWork, onSave, onClose, onDelete, chronicleMode,
}: WorkModalProps) {
  const [skillInput, setSkillInput] = useState('')
  const skillRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (show) setSkillInput('')
  }, [show])

  if (!show) return null

  const skills = editingWork.ai_skills_extracted || []

  const addSkill = () => {
    const trimmed = skillInput.trim()
    if (trimmed && !skills.includes(trimmed)) {
      setEditingWork({ ...editingWork, ai_skills_extracted: [...skills, trimmed] })
      setSkillInput('')
      setTimeout(() => skillRef.current?.focus(), 0)
    }
  }

  const removeSkill = (skill: string) => {
    setEditingWork({
      ...editingWork,
      ai_skills_extracted: skills.filter(s => s !== skill),
    })
  }

  const labelStyle: React.CSSProperties = {
    color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px',
  }

  const sectionDivider: React.CSSProperties = {
    borderTop: '1px solid #1e293b', margin: '16px 0', paddingTop: '16px',
  }

  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={{ ...modalBox, maxWidth: '620px' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '20px' }}>
          {editingWorkId ? 'Edit Experience' : 'Add Experience'}
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Title */}
          <div>
            <label style={labelStyle}>Title *</label>
            <input
              value={editingWork.title}
              onChange={e => setEditingWork({ ...editingWork, title: e.target.value })}
              placeholder="e.g. Senior Developer"
              style={inputStyle}
              autoFocus
            />
          </div>

          {/* Company */}
          <div>
            <label style={labelStyle}>Company *</label>
            <input
              value={editingWork.company}
              onChange={e => setEditingWork({ ...editingWork, company: e.target.value })}
              placeholder="e.g. Acme Corp"
              style={inputStyle}
            />
          </div>

          {/* Employment type + Location type row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Employment type</label>
              <select
                value={editingWork.engagement_type}
                onChange={e => setEditingWork({ ...editingWork, engagement_type: e.target.value })}
                style={inputStyle}
              >
                {ENGAGEMENT_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Location type</label>
              <select
                value={editingWork.location_type || ''}
                onChange={e => setEditingWork({ ...editingWork, location_type: e.target.value })}
                style={inputStyle}
              >
                {LOCATION_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Location */}
          <div>
            <label style={labelStyle}>Location</label>
            <input
              value={editingWork.location}
              onChange={e => setEditingWork({ ...editingWork, location: e.target.value })}
              placeholder="e.g. San Francisco, CA"
              style={inputStyle}
            />
          </div>

          {/* Currently work here toggle */}
          <label style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            color: '#94a3b8', fontSize: '13px', cursor: 'pointer',
          }}>
            <input
              type="checkbox"
              checked={editingWork.is_current}
              onChange={e => setEditingWork({
                ...editingWork,
                is_current: e.target.checked,
                end_date: e.target.checked ? '' : editingWork.end_date,
              })}
              style={{ width: 16, height: 16, accentColor: '#a78bfa', cursor: 'pointer' }}
            />
            I currently work here
          </label>

          {/* Dates */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <DatePicker
                label="Start date *"
                value={editingWork.start_date}
                onChange={v => setEditingWork({ ...editingWork, start_date: v })}
              />
            </div>
            {!editingWork.is_current && (
              <div style={{ flex: 1 }}>
                <DatePicker
                  label="End date"
                  value={editingWork.end_date}
                  onChange={v => setEditingWork({ ...editingWork, end_date: v })}
                />
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>Description</label>
            <textarea
              value={editingWork.description}
              onChange={e => setEditingWork({ ...editingWork, description: e.target.value })}
              placeholder="What did you do? What impact did you make?"
              style={{ ...textareaStyle, minHeight: '100px' }}
            />
          </div>

          {/* Skills */}
          <div style={sectionDivider}>
            <label style={{ ...labelStyle, marginBottom: '8px' }}>Skills</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                ref={skillRef}
                value={skillInput}
                onChange={e => setSkillInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill() } }}
                placeholder="Type a skill and press Enter"
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                onClick={addSkill}
                style={{
                  padding: '8px 16px', background: '#334155', color: '#e2e8f0',
                  border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Add
              </button>
            </div>
            {skills.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                {skills.map(skill => (
                  <span
                    key={skill}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      padding: '4px 12px', background: 'rgba(167,139,250,0.12)',
                      color: '#c4b5fd', borderRadius: '16px', fontSize: '13px',
                    }}
                  >
                    {skill}
                    <button
                      onClick={() => removeSkill(skill)}
                      style={{
                        background: 'none', border: 'none', color: '#94a3b8',
                        cursor: 'pointer', padding: '0 2px', fontSize: '15px', lineHeight: 1,
                      }}
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p style={{ color: '#475569', fontSize: '11px', marginTop: '6px' }}>
              Skills added here also appear in your Skills &amp; Interests section and contact Synergy.
            </p>
          </div>

          {/* Show on resume toggle */}
          <label style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            color: '#94a3b8', fontSize: '13px', cursor: 'pointer',
            borderTop: '1px solid #334155', paddingTop: '12px',
          }}>
            <input
              type="checkbox"
              checked={editingWork.show_on_resume !== false}
              onChange={e => setEditingWork({ ...editingWork, show_on_resume: e.target.checked })}
              style={{ width: 16, height: 16, accentColor: '#a78bfa', cursor: 'pointer' }}
            />
            Show on resume
          </label>

          {/* Chronicle fields (only when editing from chronicle) */}
          {chronicleMode && (
            <div style={sectionDivider}>
              <label style={{ ...labelStyle, marginBottom: '8px' }}>Chronicle display</label>

              {/* Color swatches */}
              <div style={{ marginBottom: '10px' }}>
                <span style={{ color: '#64748b', fontSize: '11px' }}>Color</span>
                <div style={{ display: 'flex', gap: '5px', marginTop: '4px' }}>
                  {CHRONICLE_COLORS.map(c => (
                    <div
                      key={c}
                      onClick={() => setEditingWork({ ...editingWork, chronicle_color: c })}
                      style={{
                        width: 22, height: 22, borderRadius: 4, cursor: 'pointer',
                        background: c,
                        border: c === (editingWork.chronicle_color || '#4070a8')
                          ? '2px solid #e2e8f0' : '2px solid transparent',
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Fuzzy edges */}
              <div style={{ display: 'flex', gap: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={editingWork.chronicle_fuzzy_start || false}
                    onChange={e => setEditingWork({ ...editingWork, chronicle_fuzzy_start: e.target.checked })}
                    style={{ width: 14, height: 14, cursor: 'pointer' }}
                  />
                  Uncertain start
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={editingWork.chronicle_fuzzy_end || false}
                    onChange={e => setEditingWork({ ...editingWork, chronicle_fuzzy_end: e.target.checked })}
                    style={{ width: 14, height: 14, cursor: 'pointer' }}
                  />
                  Uncertain end
                </label>
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
            {editingWorkId && onDelete && (
              <button
                onClick={() => onDelete(editingWorkId)}
                style={{
                  padding: '8px 16px', background: 'transparent',
                  color: '#ef4444', border: '1px solid #7f1d1d',
                  borderRadius: '6px', fontSize: '13px', cursor: 'pointer',
                  marginRight: 'auto',
                }}
              >
                Delete
              </button>
            )}
            <button onClick={onClose} style={btnSecondary}>Cancel</button>
            <button onClick={onSave} style={btnPrimary}>Save</button>
          </div>
        </div>
      </div>
    </div>
  )
}
