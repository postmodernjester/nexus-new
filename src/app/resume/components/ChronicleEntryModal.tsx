'use client'

import { ChronicleResumeEntry } from '../types'
import { inputStyle, textareaStyle, btnPrimary, btnSecondary, btnDanger, modalOverlay, modalBox } from '../styles'

interface ChronicleEntryModalProps {
  show: boolean
  editingChronicle: ChronicleResumeEntry | null
  setEditingChronicle: (entry: ChronicleResumeEntry | null) => void
  onSave: () => void
  onDelete: (id: string) => void
  onClose: () => void
}

export default function ChronicleEntryModal({ show, editingChronicle, setEditingChronicle, onSave, onDelete, onClose }: ChronicleEntryModalProps) {
  if (!show || !editingChronicle) return null

  return (
    <div style={modalOverlay} onClick={onClose}>
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
            <button onClick={() => onDelete(editingChronicle.id)} style={btnDanger}>Delete</button>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={onClose} style={btnSecondary}>Cancel</button>
              <button onClick={onSave} style={btnPrimary}>Save</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
