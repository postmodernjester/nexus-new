'use client'

import { useEffect, useRef, useState } from 'react'

const COLS = [
  { id: 'work', label: 'Work / Employer' },
  { id: 'project', label: 'Project' },
  { id: 'personal', label: 'Personal / Family' },
  { id: 'residence', label: 'Residence' },
  { id: 'people', label: 'Person' },
  { id: 'tech', label: 'Tech context' },
]

const PAL: Record<string, string[]> = {
  work: ['#2d5080', '#4070a8', '#5890c8', '#386098', '#6080b0'],
  project: ['#306018', '#508038', '#70a050', '#407028', '#609040'],
  personal: ['#802838', '#a85060', '#c87080', '#903848', '#b06070'],
  residence: ['#604820', '#806840', '#a08858', '#705030', '#907848'],
  tech: ['#604018', '#986020', '#b88040', '#785030', '#a07030'],
  people: ['#482870', '#7050a8', '#9070c8', '#583888', '#806ab8'],
}

export interface EntryFormData {
  id?: string
  cat: string
  title: string
  start: string
  end: string
  fuzzyStart: boolean
  fuzzyEnd: boolean
  note: string
  color: string
  showOnResume: boolean
  source?: 'chronicle' | 'work' | 'contact'
}

interface Props {
  open: boolean
  editingEntry?: EntryFormData | null
  defaultCat?: string
  defaultYM?: string
  onSave: (data: EntryFormData) => void
  onDelete?: (id: string) => void
  onClose: () => void
}

export default function ChronicleModal({ open, editingEntry, defaultCat, defaultYM, onSave, onDelete, onClose }: Props) {
  const [cat, setCat] = useState(defaultCat || 'work')
  const [title, setTitle] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [fuzzyStart, setFuzzyStart] = useState(false)
  const [fuzzyEnd, setFuzzyEnd] = useState(false)
  const [note, setNote] = useState('')
  const [color, setColor] = useState('#4070a8')
  const [showOnResume, setShowOnResume] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      if (editingEntry) {
        setCat(editingEntry.cat)
        setTitle(editingEntry.title)
        setStart(editingEntry.start)
        setEnd(editingEntry.end)
        setFuzzyStart(editingEntry.fuzzyStart)
        setFuzzyEnd(editingEntry.fuzzyEnd)
        setNote(editingEntry.note)
        setColor(editingEntry.color)
        setShowOnResume(editingEntry.showOnResume)
      } else {
        setCat(defaultCat || 'work')
        setTitle('')
        setStart(defaultYM || '')
        setEnd('')
        setFuzzyStart(false)
        setFuzzyEnd(false)
        setNote('')
        setShowOnResume(false)
        const pal = PAL[defaultCat || 'work'] || PAL.work
        setColor(pal[0])
      }
      setTimeout(() => titleRef.current?.focus(), 80)
    }
  }, [open, editingEntry, defaultCat, defaultYM])

  const handleCatChange = (newCat: string) => {
    setCat(newCat)
    const pal = PAL[newCat] || PAL.work
    // Only reset color for new entries (no existing color to preserve)
    if (!editingEntry && !pal.includes(color)) setColor(pal[0])
  }

  const handleSave = () => {
    if (!title.trim() || !start.trim()) return
    onSave({
      id: editingEntry?.id,
      cat,
      title: title.trim(),
      start: start.trim(),
      end: end.trim() || '',
      fuzzyStart,
      fuzzyEnd,
      note: note.trim(),
      color,
      showOnResume,
      source: editingEntry?.source,
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave()
  }

  if (!open) return null

  const basePal = PAL[cat] || PAL.work
  const swatches = color && !basePal.includes(color) ? [...basePal, color] : basePal

  return (
    <div
      style={S.overlay}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      onKeyDown={handleKeyDown}
    >
      <div style={S.box}>
        <div style={S.title}>
          {editingEntry ? 'Edit entry' : `New ${COLS.find(c => c.id === cat)?.label || 'entry'}`}
        </div>

        <div style={S.frow}>
          <label style={S.label}>Category</label>
          <select
            value={cat}
            onChange={(e) => handleCatChange(e.target.value)}
            disabled={editingEntry?.source === 'work' || editingEntry?.source === 'contact'}
            style={S.input}
          >
            {COLS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>

        <div style={S.frow}>
          <label style={S.label}>Title / Name</label>
          <input
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Lucasfilm, 136 Santa Cruz St…"
            style={S.input}
          />
        </div>

        <div style={S.fcols}>
          <div style={S.frow}>
            <label style={S.label}>Start (YYYY-MM)</label>
            <input value={start} onChange={(e) => setStart(e.target.value)} placeholder="1985-06" style={S.input} />
          </div>
          <div style={S.frow}>
            <label style={S.label}>End (YYYY-MM or blank)</label>
            <input value={end} onChange={(e) => setEnd(e.target.value)} placeholder="1987-03" style={S.input} />
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
          <label style={S.label}>Note</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Anything worth remembering…"
            style={{ ...S.input, resize: 'vertical', minHeight: 46 }}
          />
        </div>

        <div style={S.frow}>
          <label style={S.label}>Color</label>
          <div style={S.swatches}>
            {swatches.map(c => (
              <div
                key={c}
                onClick={() => setColor(c)}
                style={{
                  width: 20, height: 20, borderRadius: 3, cursor: 'pointer',
                  background: c,
                  border: c === color ? '2px solid #1a1812' : '2px solid transparent',
                  transition: 'border-color .1s, transform .1s',
                }}
              />
            ))}
          </div>
        </div>

        <div style={S.frow}>
          <label style={S.fuzzCheck}>
            <input type="checkbox" checked={showOnResume} onChange={(e) => setShowOnResume(e.target.checked)} style={S.checkbox} />
            Show on resume
          </label>
        </div>

        <div style={S.actions}>
          {editingEntry?.id && onDelete && (
            <button onClick={() => onDelete(editingEntry.id!)} style={S.btnDanger}>Delete</button>
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
    position: 'fixed', inset: 0, background: 'rgba(18,16,10,.5)', zIndex: 500,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    backdropFilter: 'blur(2px)',
  },
  box: {
    background: '#f6f1e6', border: '1.5px solid #1a1812', borderRadius: 6,
    padding: 22, width: 360, boxShadow: '0 10px 36px rgba(0,0,0,.2)',
    fontFamily: "'DM Mono', monospace",
  },
  title: {
    fontFamily: "'Libre Baskerville', serif", fontStyle: 'italic',
    fontSize: 14, marginBottom: 16, color: '#1a1812',
  },
  frow: { marginBottom: 11 },
  label: {
    display: 'block', fontSize: '7.5px', letterSpacing: '.17em',
    textTransform: 'uppercase' as const, color: '#9a8e78', marginBottom: 4,
  },
  input: {
    width: '100%', background: '#f0ead8', border: '1px solid #d8d0c0',
    borderRadius: 3, padding: '6px 8px', fontFamily: "'DM Mono', monospace",
    fontSize: '10.5px', color: '#1a1812', outline: 'none',
  },
  fcols: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 },
  fuzzRow: { display: 'flex', gap: 16, alignItems: 'center' },
  fuzzCheck: {
    display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
    fontSize: 9, color: '#5a5040', letterSpacing: '.04em',
  },
  checkbox: { width: 13, height: 13, cursor: 'pointer', accentColor: '#1a1812' },
  swatches: { display: 'flex', gap: 5, flexWrap: 'wrap' as const },
  actions: { display: 'flex', gap: 7, marginTop: 16, justifyContent: 'flex-end' },
  btn: {
    padding: '6px 14px', borderRadius: 3, fontFamily: "'DM Mono', monospace",
    fontSize: '8.5px', letterSpacing: '.12em', cursor: 'pointer',
    border: '1px solid #d8d0c0', background: 'none', color: '#5a5040',
    textTransform: 'uppercase' as const,
  },
  btnPrimary: {
    padding: '6px 14px', borderRadius: 3, fontFamily: "'DM Mono', monospace",
    fontSize: '8.5px', letterSpacing: '.12em', cursor: 'pointer',
    border: '1px solid #1a1812', background: '#1a1812', color: '#f6f1e6',
    textTransform: 'uppercase' as const,
  },
  btnDanger: {
    padding: '6px 14px', borderRadius: 3, fontFamily: "'DM Mono', monospace",
    fontSize: '8.5px', letterSpacing: '.12em', cursor: 'pointer',
    border: '1px solid rgba(200,64,48,.3)', background: 'none', color: '#c84030',
    textTransform: 'uppercase' as const, marginRight: 'auto',
  },
}
