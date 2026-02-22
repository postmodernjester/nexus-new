'use client'

import { WorkEntry } from '../types'
import { inputStyle, textareaStyle, btnPrimary, btnSecondary, modalOverlay, modalBox } from '../styles'
import DatePicker from './DatePicker'

interface WorkModalProps {
  show: boolean
  editingWork: WorkEntry
  editingWorkId: string | null
  setEditingWork: (work: WorkEntry) => void
  onSave: () => void
  onClose: () => void
}

export default function WorkModal({ show, editingWork, editingWorkId, setEditingWork, onSave, onClose }: WorkModalProps) {
  if (!show) return null

  return (
    <div style={modalOverlay} onClick={onClose}>
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
            <button onClick={onClose} style={btnSecondary}>Cancel</button>
            <button onClick={onSave} style={btnPrimary}>Save</button>
          </div>
        </div>
      </div>
    </div>
  )
}
