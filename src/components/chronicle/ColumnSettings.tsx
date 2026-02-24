'use client'

import { useCallback, useRef, useState } from 'react'
import type { ColumnDef } from './types'
import {
  LOCKED_COLS, PRESET_COLS, MAX_COLUMNS,
  COLUMN_PALETTE, UNIVERSAL_COLORS, DEFAULT_COLORS,
  saveUserColumns,
} from './constants'

interface Props {
  userCols: ColumnDef[]
  onUpdate: (cols: ColumnDef[]) => void
  onClose: () => void
}

export default function ColumnSettings({ userCols, onUpdate, onClose }: Props) {
  const [editingColorId, setEditingColorId] = useState<string | null>(null)
  const [customName, setCustomName] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)
  const dragItem = useRef<number | null>(null)
  const dragOver = useRef<number | null>(null)

  const totalCols = LOCKED_COLS.length + userCols.length

  // ─── Handlers ───────────────────────────────
  const update = useCallback((next: ColumnDef[]) => {
    onUpdate(next)
    saveUserColumns(next)
  }, [onUpdate])

  const toggleVisible = useCallback((id: string) => {
    update(userCols.map(c => c.id === id ? { ...c, visible: !c.visible } : c))
  }, [userCols, update])

  const toggleWidth = useCallback((id: string) => {
    update(userCols.map(c => c.id === id ? { ...c, width: c.width === 'half' ? 'full' : 'half' } : c))
  }, [userCols, update])

  const setColor = useCallback((id: string, color: string) => {
    update(userCols.map(c => c.id === id ? { ...c, color } : c))
    setEditingColorId(null)
  }, [userCols, update])

  const removeCol = useCallback((id: string) => {
    const next = userCols.filter(c => c.id !== id)
    // Re-index sortOrder
    next.forEach((c, i) => c.sortOrder = i)
    update(next)
  }, [userCols, update])

  const addPreset = useCallback((presetId: string) => {
    if (totalCols >= MAX_COLUMNS) return
    const preset = PRESET_COLS.find(p => p.id === presetId)
    if (!preset) return
    const newCol: ColumnDef = { ...preset, visible: true, sortOrder: userCols.length }
    update([...userCols, newCol])
  }, [userCols, totalCols, update])

  const addCustom = useCallback(() => {
    const name = customName.trim()
    if (!name || totalCols >= MAX_COLUMNS) return
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
    if (!slug) return
    // Avoid ID collision
    const existingIds = new Set([...LOCKED_COLS, ...userCols].map(c => c.id))
    if (existingIds.has(slug)) return
    const newCol: ColumnDef = {
      id: slug,
      label: name,
      color: UNIVERSAL_COLORS[Math.floor(Math.random() * UNIVERSAL_COLORS.length)],
      width: 'half',
      renderType: 'bar',
      visible: true,
      sortOrder: userCols.length,
    }
    update([...userCols, newCol])
    setCustomName('')
    setShowCustomInput(false)
  }, [customName, userCols, totalCols, update])

  // ─── Drag-to-reorder ───────────────────────
  const handleDragStart = (idx: number) => { dragItem.current = idx }
  const handleDragEnter = (idx: number) => { dragOver.current = idx }
  const handleDragEnd = () => {
    if (dragItem.current === null || dragOver.current === null || dragItem.current === dragOver.current) {
      dragItem.current = null
      dragOver.current = null
      return
    }
    const sorted = [...userCols].sort((a, b) => a.sortOrder - b.sortOrder)
    const [moved] = sorted.splice(dragItem.current, 1)
    sorted.splice(dragOver.current, 0, moved)
    sorted.forEach((c, i) => c.sortOrder = i)
    update(sorted)
    dragItem.current = null
    dragOver.current = null
  }

  const sortedUser = [...userCols].sort((a, b) => a.sortOrder - b.sortOrder)
  const usedIds = new Set([...LOCKED_COLS.map(c => c.id), ...userCols.map(c => c.id)])
  const availablePresets = PRESET_COLS.filter(p => !usedIds.has(p.id))

  return (
    <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={S.panel}>
        {/* Header */}
        <div style={S.header}>
          <span style={S.headerTitle}>Column Settings</span>
          <span style={S.counter}>{totalCols} / {MAX_COLUMNS}</span>
          <button onClick={onClose} style={S.closeBtn}>&times;</button>
        </div>

        {/* Locked section */}
        <div style={S.sectionLabel}>LOCKED</div>
        {LOCKED_COLS.map(col => (
          <div key={col.id} style={S.lockedRow}>
            <span style={{ ...S.dot, background: col.color }} />
            <span style={S.colName}>{col.label}</span>
            <span style={S.lockedBadge}>always on</span>
          </div>
        ))}

        {/* Divider */}
        <div style={S.divider} />

        {/* User section */}
        <div style={S.sectionLabel}>YOUR COLUMNS</div>
        {sortedUser.map((col, idx) => (
          <div
            key={col.id}
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragEnter={() => handleDragEnter(idx)}
            onDragEnd={handleDragEnd}
            onDragOver={e => e.preventDefault()}
            style={S.userRow}
          >
            {/* Drag handle */}
            <span style={S.dragHandle} title="Drag to reorder">&#x2630;</span>

            {/* Color dot — click to open picker */}
            <span
              style={{ ...S.dot, background: col.color, cursor: 'pointer' }}
              onClick={() => setEditingColorId(editingColorId === col.id ? null : col.id)}
              title="Change color"
            />

            {/* Name */}
            <span style={{ ...S.colName, opacity: col.visible ? 1 : 0.4 }}>{col.label}</span>

            {/* Spacer */}
            <span style={{ flex: 1 }} />

            {/* Width toggle */}
            <button
              onClick={() => toggleWidth(col.id)}
              title={col.width === 'half' ? 'Switch to full width' : 'Switch to half width'}
              style={S.iconBtn}
            >
              <span style={{ fontSize: 7, letterSpacing: '.08em' }}>{col.width === 'half' ? '½' : '1'}</span>
            </button>

            {/* Visibility toggle */}
            <button
              onClick={() => toggleVisible(col.id)}
              title={col.visible ? 'Hide column' : 'Show column'}
              style={S.iconBtn}
            >
              {col.visible ? (
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
                  <path d="M1 8s3-5.5 7-5.5S15 8 15 8s-3 5.5-7 5.5S1 8 1 8Z" />
                  <circle cx="8" cy="8" r="2.5" />
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
                  <path d="M1 8s3-5.5 7-5.5S15 8 15 8s-3 5.5-7 5.5S1 8 1 8Z" />
                  <line x1="2" y1="14" x2="14" y2="2" />
                </svg>
              )}
            </button>

            {/* Remove */}
            <button onClick={() => removeCol(col.id)} title="Remove column" style={{ ...S.iconBtn, color: '#c84030' }}>
              &times;
            </button>

            {/* Inline color picker */}
            {editingColorId === col.id && (
              <div style={S.colorPicker} onClick={e => e.stopPropagation()}>
                <div style={S.swatchGrid}>
                  {(COLUMN_PALETTE[col.id] || COLUMN_PALETTE[Object.keys(COLUMN_PALETTE)[0]]).map(c => (
                    <div
                      key={c}
                      onClick={() => setColor(col.id, c)}
                      style={{
                        width: 18, height: 18, borderRadius: 3, cursor: 'pointer',
                        background: c,
                        border: c === col.color ? '2px solid #1a1812' : '2px solid transparent',
                      }}
                    />
                  ))}
                </div>
                <div style={S.universalLabel}>UNIVERSAL</div>
                <div style={S.swatchRow}>
                  {UNIVERSAL_COLORS.map(c => (
                    <div
                      key={c}
                      onClick={() => setColor(col.id, c)}
                      style={{
                        width: 18, height: 18, borderRadius: 3, cursor: 'pointer',
                        background: c,
                        border: c === col.color ? '2px solid #1a1812' : '2px solid transparent',
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Add column area */}
        {totalCols < MAX_COLUMNS && (
          <>
            <div style={S.divider} />
            <div style={S.sectionLabel}>ADD COLUMN</div>

            {/* Presets */}
            {availablePresets.length > 0 && (
              <div style={S.presetRow}>
                {availablePresets.map(p => (
                  <button
                    key={p.id}
                    onClick={() => addPreset(p.id)}
                    style={{
                      ...S.presetBtn,
                      borderColor: DEFAULT_COLORS[p.id] || p.color,
                      color: DEFAULT_COLORS[p.id] || p.color,
                    }}
                  >
                    <span style={{ ...S.dot, background: DEFAULT_COLORS[p.id] || p.color, width: 6, height: 6 }} />
                    {p.label}
                  </button>
                ))}
              </div>
            )}

            {/* Custom */}
            {showCustomInput ? (
              <div style={S.customRow}>
                <input
                  autoFocus
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') addCustom()
                    if (e.key === 'Escape') { setShowCustomInput(false); setCustomName('') }
                  }}
                  placeholder="Column name…"
                  maxLength={20}
                  style={S.customInput}
                />
                <button onClick={addCustom} style={S.addBtn}>Add</button>
                <button onClick={() => { setShowCustomInput(false); setCustomName('') }} style={S.cancelBtn}>Cancel</button>
              </div>
            ) : (
              <button onClick={() => setShowCustomInput(true)} style={S.customTrigger}>
                + Custom column…
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════
const S: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(18,16,10,.4)', zIndex: 500,
    display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
    backdropFilter: 'blur(1px)', paddingTop: 50, paddingRight: 12,
  },
  panel: {
    background: '#f6f1e6', border: '1.5px solid #1a1812', borderRadius: 6,
    padding: '14px 16px 18px', width: 310, boxShadow: '0 8px 32px rgba(0,0,0,.18)',
    fontFamily: "'DM Mono', monospace", maxHeight: 'calc(100vh - 70px)', overflowY: 'auto',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
  },
  headerTitle: {
    fontFamily: "'Libre Baskerville', serif", fontStyle: 'italic', fontSize: 13, color: '#1a1812',
  },
  counter: {
    fontSize: 8, letterSpacing: '.1em', color: '#9a8e78', marginLeft: 'auto',
  },
  closeBtn: {
    background: 'none', border: 'none', fontSize: 18, color: '#9a8e78', cursor: 'pointer',
    padding: '0 2px', lineHeight: 1,
  },
  sectionLabel: {
    fontSize: 7, letterSpacing: '.2em', textTransform: 'uppercase' as const,
    color: '#9a8e78', marginBottom: 6, marginTop: 2,
  },
  lockedRow: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', opacity: 0.55,
  },
  dot: {
    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
  },
  colName: {
    fontSize: 10, letterSpacing: '.04em', color: '#1a1812',
  },
  lockedBadge: {
    fontSize: 7, letterSpacing: '.1em', color: '#d8d0c0', marginLeft: 'auto',
  },
  divider: {
    height: 1, background: '#d8d0c0', margin: '10px 0',
  },
  userRow: {
    display: 'flex', alignItems: 'center', gap: 7, padding: '5px 0',
    flexWrap: 'wrap' as const, position: 'relative' as const,
    borderBottom: '1px solid rgba(0,0,0,.04)',
  },
  dragHandle: {
    cursor: 'grab', fontSize: 10, color: '#d8d0c0', userSelect: 'none' as const, width: 14, textAlign: 'center' as const,
  },
  iconBtn: {
    background: 'none', border: '1px solid #d8d0c0', borderRadius: 3,
    width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', color: '#5a5040', fontSize: 11, padding: 0,
  },
  colorPicker: {
    width: '100%', padding: '8px 0 4px 22px',
  },
  swatchGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(8, 18px)', gap: 3,
  },
  universalLabel: {
    fontSize: 6, letterSpacing: '.2em', color: '#9a8e78', marginTop: 6, marginBottom: 3,
  },
  swatchRow: {
    display: 'flex', gap: 3, flexWrap: 'wrap' as const,
  },
  presetRow: {
    display: 'flex', gap: 5, flexWrap: 'wrap' as const, marginBottom: 8,
  },
  presetBtn: {
    display: 'flex', alignItems: 'center', gap: 5, background: 'none',
    border: '1px solid', borderRadius: 3, padding: '3px 8px',
    fontFamily: "'DM Mono', monospace", fontSize: 8.5, letterSpacing: '.08em',
    cursor: 'pointer', textTransform: 'uppercase' as const,
  },
  customTrigger: {
    background: 'none', border: '1px dashed #d8d0c0', borderRadius: 3,
    padding: '5px 10px', fontFamily: "'DM Mono', monospace", fontSize: 9,
    color: '#9a8e78', cursor: 'pointer', width: '100%', textAlign: 'left' as const,
    letterSpacing: '.06em',
  },
  customRow: {
    display: 'flex', gap: 5, alignItems: 'center',
  },
  customInput: {
    flex: 1, background: '#f0ead8', border: '1px solid #d8d0c0', borderRadius: 3,
    padding: '5px 7px', fontFamily: "'DM Mono', monospace", fontSize: 9.5,
    color: '#1a1812', outline: 'none',
  },
  addBtn: {
    background: '#1a1812', color: '#f6f1e6', border: 'none', borderRadius: 3,
    padding: '5px 10px', fontFamily: "'DM Mono', monospace", fontSize: 8,
    letterSpacing: '.1em', cursor: 'pointer', textTransform: 'uppercase' as const,
  },
  cancelBtn: {
    background: 'none', color: '#9a8e78', border: '1px solid #d8d0c0', borderRadius: 3,
    padding: '5px 8px', fontFamily: "'DM Mono', monospace", fontSize: 8,
    letterSpacing: '.1em', cursor: 'pointer', textTransform: 'uppercase' as const,
  },
}
