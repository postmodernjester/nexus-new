'use client'

import { EducationEntry } from '../types'
import { inputStyle, textareaStyle, btnPrimary, btnSecondary, modalOverlay, modalBox } from '../styles'
import DatePicker from './DatePicker'

interface EducationModalProps {
  show: boolean
  editingEdu: EducationEntry
  editingEduId: string | null
  setEditingEdu: (edu: EducationEntry) => void
  onSave: () => void
  onClose: () => void
}

export default function EducationModal({ show, editingEdu, editingEduId, setEditingEdu, onSave, onClose }: EducationModalProps) {
  if (!show) return null

  return (
    <div style={modalOverlay} onClick={onClose}>
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
            <button onClick={onClose} style={btnSecondary}>Cancel</button>
            <button onClick={onSave} style={btnPrimary}>Save</button>
          </div>
        </div>
      </div>
    </div>
  )
}
