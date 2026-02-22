'use client'

import { KeyLink, LINK_TYPES } from '../types'
import { inputStyle, btnPrimary, btnSecondary, cardStyle } from '../styles'

interface KeyLinksSectionProps {
  keyLinks: KeyLink[]
  editingLinks: boolean
  setEditingLinks: (editing: boolean) => void
  updateLink: (type: string, field: 'url' | 'visible', value: string | boolean) => void
  saveKeyLinks: () => void
}

export default function KeyLinksSection({ keyLinks, editingLinks, setEditingLinks, updateLink, saveKeyLinks }: KeyLinksSectionProps) {
  return (
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
  )
}
