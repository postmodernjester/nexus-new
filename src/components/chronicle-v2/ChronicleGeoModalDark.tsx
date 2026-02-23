'use client'

import { useEffect, useRef, useState } from 'react'
import { DARK_THEME as T } from '../chronicle/theme'

const GEO_COLORS = [
  '#c0b484', '#b8c8a8', '#c0a890', '#90a8c0', '#c0b890', '#a890c0', '#c09888',
  '#b8d0b8', '#d0c0a0', '#a8c0d0', '#c8b0c0', '#b0c8c0', '#d0b8a8', '#b0b8d0', '#c8d0b0',
]

export interface GeoFormData {
  id?: string
  title: string
  start: string
  end: string
  fuzzyStart: boolean
  fuzzyEnd: boolean
  color: string
}

interface Props {
  open: boolean
  editingPlace?: GeoFormData | null
  defaultYM?: string
  onSave: (data: GeoFormData) => void
  onDelete?: (id: string) => void
  onClose: () => void
}

export default function ChronicleGeoModalDark({ open, editingPlace, defaultYM, onSave, onDelete, onClose }: Props) {
  const [title, setTitle] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [fuzzyStart, setFuzzyStart] = useState(false)
  const [fuzzyEnd, setFuzzyEnd] = useState(false)
  const [color, setColor] = useState(GEO_COLORS[0])
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      if (editingPlace) {
        setTitle(editingPlace.title)
        setStart(editingPlace.start)
        setEnd(editingPlace.end)
        setFuzzyStart(editingPlace.fuzzyStart)
        setFuzzyEnd(editingPlace.fuzzyEnd)
        setColor(editingPlace.color)
      } else {
        setTitle('')
        setStart(defaultYM || '')
        setEnd('')
        setFuzzyStart(false)
        setFuzzyEnd(false)
        setColor(GEO_COLORS[0])
      }
      setTimeout(() => titleRef.current?.focus(), 80)
    }
  }, [open, editingPlace, defaultYM])

  const handleSave = () => {
    if (!title.trim() || !start.trim()) return
    onSave({
      id: editingPlace?.id,
      title: title.trim(),
      start: start.trim(),
      end: end.trim() || '',
      fuzzyStart,
      fuzzyEnd,
      color,
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave()
  }

  if (!open) return null

  return (
    <div
      style={S.overlay}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      onKeyDown={handleKeyDown}
    >
      <div style={S.box}>
        <div style={S.title}>Geography — place context</div>

        <div style={S.frow}>
          <label style={S.label}>Place name</label>
          <input
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. San Francisco Bay Area"
            style={S.input}
          />
        </div>

        <div style={S.fcols}>
          <div style={S.frow}>
            <label style={S.label}>Start (YYYY-MM)</label>
            <input value={start} onChange={(e) => setStart(e.target.value)} style={S.input} />
          </div>
          <div style={S.frow}>
            <label style={S.label}>End (YYYY-MM or blank)</label>
            <input value={end} onChange={(e) => setEnd(e.target.value)} style={S.input} />
          </div>
        </div>

        <div style={S.frow}>
          <label style={S.label}>Fuzzy edges</label>
          <div style={S.fuzzRow}>
            <label style={S.fuzzCheck}>
              <input type="checkbox" checked={fuzzyStart} onChange={(e) => setFuzzyStart(e.target.checked)} style={S.checkbox} />
              Uncertain start
            </label>
            <label style={S.fuzzCheck}>
              <input type="checkbox" checked={fuzzyEnd} onChange={(e) => setFuzzyEnd(e.target.checked)} style={S.checkbox} />
              Uncertain end
            </label>
          </div>
        </div>

        <div style={S.frow}>
          <label style={S.label}>Background color</label>
          <div style={S.swatches}>
            {GEO_COLORS.map(c => (
              <div
                key={c}
                onClick={() => setColor(c)}
                style={{
                  width: 20, height: 20, borderRadius: 3, cursor: 'pointer',
                  background: c,
                  border: c === color ? `2px solid ${T.swatchSelectedBorder}` : '2px solid transparent',
                  transition: 'border-color .1s, transform .1s',
                }}
              />
            ))}
          </div>
        </div>

        <div style={S.actions}>
          {editingPlace?.id && onDelete && (
            <button onClick={() => onDelete(editingPlace.id!)} style={S.btnDanger}>Delete</button>
          )}
          <button onClick={onClose} style={S.btn}>Cancel</button>
          <button onClick={handleSave} style={S.btnPrimary}>Save</button>
        </div>
      </div>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: T.modalOverlay, zIndex: 500,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    backdropFilter: 'blur(4px)',
  },
  box: {
    background: T.modalBg, border: `1.5px solid ${T.modalBorder}`, borderRadius: 6,
    padding: 22, width: 360, boxShadow: '0 10px 36px rgba(0,0,0,.4)',
    fontFamily: T.fontBody,
  },
  title: {
    fontFamily: T.fontHeading, fontStyle: 'italic',
    fontSize: 14, marginBottom: 16, color: T.textPrimary,
  },
  frow: { marginBottom: 11 },
  label: {
    display: 'block', fontSize: '7.5px', letterSpacing: '.17em',
    textTransform: 'uppercase' as const, color: T.textMuted, marginBottom: 4,
  },
  input: {
    width: '100%', background: T.inputBg, border: `1px solid ${T.inputBorder}`,
    borderRadius: 3, padding: '6px 8px', fontFamily: T.fontBody,
    fontSize: '10.5px', color: T.textPrimary, outline: 'none',
  },
  fcols: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 },
  fuzzRow: { display: 'flex', gap: 16, alignItems: 'center' },
  fuzzCheck: {
    display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
    fontSize: 9, color: T.textSecondary, letterSpacing: '.04em',
  },
  checkbox: { width: 13, height: 13, cursor: 'pointer', accentColor: T.checkboxAccent },
  swatches: { display: 'flex', gap: 5, flexWrap: 'wrap' as const },
  actions: { display: 'flex', gap: 7, marginTop: 16, justifyContent: 'flex-end' },
  btn: {
    padding: '6px 14px', borderRadius: 3, fontFamily: T.fontBody,
    fontSize: '8.5px', letterSpacing: '.12em', cursor: 'pointer',
    border: `1px solid ${T.btnBorder}`, background: T.btnBg, color: T.btnText,
    textTransform: 'uppercase' as const,
  },
  btnPrimary: {
    padding: '6px 14px', borderRadius: 3, fontFamily: T.fontBody,
    fontSize: '8.5px', letterSpacing: '.12em', cursor: 'pointer',
    border: `1px solid ${T.btnPrimaryBorder}`, background: T.btnPrimaryBg, color: T.btnPrimaryText,
    textTransform: 'uppercase' as const,
  },
  btnDanger: {
    padding: '6px 14px', borderRadius: 3, fontFamily: T.fontBody,
    fontSize: '8.5px', letterSpacing: '.12em', cursor: 'pointer',
    border: `1px solid ${T.dangerBorder}`, background: 'none', color: T.dangerColor,
    textTransform: 'uppercase' as const, marginRight: 'auto',
  },
}
