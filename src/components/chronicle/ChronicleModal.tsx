'use client'

import { useEffect, useRef, useState } from 'react'
import type { ColumnDef } from './types'
import { COLUMN_PALETTE, UNIVERSAL_COLORS, DEFAULT_COLORS } from './constants'

// Fallback column labels for the category dropdown
const FALLBACK_LABELS: Record<string, string> = {
  work: 'Work / Employer', project: 'Project', education: 'Education',
  personal: 'Personal / Family', residence: 'Residence',
  gatherings: 'Gathering / Event', tech: 'Tech context', people: 'Person',
  health: 'Health', creative: 'Creative', finance: 'Finance',
  social: 'Social', spiritual: 'Spiritual',
}

export interface EntryFormData {
  id?: string
  cat: string
  title: string
  company?: string
  description?: string
  start: string
  end: string
  fuzzyStart: boolean
  fuzzyEnd: boolean
  note: string
  color: string
  showOnResume: boolean
  source?: 'chronicle' | 'work' | 'contact' | 'education'
}

interface Props {
  open: boolean
  editingEntry?: EntryFormData | null
  defaultCat?: string
  defaultYM?: string
  defaultEndYM?: string
  onSave: (data: EntryFormData) => void
  onDelete?: (id: string) => void
  onClose: () => void
  columns?: ColumnDef[]
}

// Parse "1988,1990,1992" → Set<number>
function parseYearsAttended(desc: string | undefined): Set<number> {
  if (!desc) return new Set()
  const years = new Set<number>()
  desc.split(',').forEach(s => {
    const y = parseInt(s.trim())
    if (!isNaN(y) && y > 1900 && y < 2200) years.add(y)
  })
  return years
}

// Extract year from "YYYY-MM" or "YYYY"
function yearFromYM(ym: string): string {
  if (!ym) return ''
  return ym.split('-')[0]
}

/** Get the palette for a given column ID, falling back gracefully */
function getPalette(catId: string): string[] {
  return COLUMN_PALETTE[catId] || UNIVERSAL_COLORS
}

export default function ChronicleModal({ open, editingEntry, defaultCat, defaultYM, defaultEndYM, onSave, onDelete, onClose, columns }: Props) {
  const [cat, setCat] = useState(defaultCat || 'work')
  const [title, setTitle] = useState('')
  const [company, setCompany] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [fuzzyStart, setFuzzyStart] = useState(false)
  const [fuzzyEnd, setFuzzyEnd] = useState(false)
  const [note, setNote] = useState('')
  const [color, setColor] = useState('#4070a8')
  const [showOnResume, setShowOnResume] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)

  // Gathering-specific state
  const [firstYear, setFirstYear] = useState('')
  const [lastYear, setLastYear] = useState('')
  const [yearsAttended, setYearsAttended] = useState<Set<number>>(new Set())

  // Derive column list for the category dropdown
  const colOptions = columns || []

  useEffect(() => {
    if (open) {
      if (editingEntry) {
        setCat(editingEntry.cat)
        setTitle(editingEntry.title)
        setCompany(editingEntry.company || '')
        setStart(editingEntry.start)
        setEnd(editingEntry.end)
        setFuzzyStart(editingEntry.fuzzyStart)
        setFuzzyEnd(editingEntry.fuzzyEnd)
        setNote(editingEntry.note)
        setColor(editingEntry.color)
        setShowOnResume(editingEntry.showOnResume)

        // Gathering fields
        if (editingEntry.cat === 'gatherings') {
          const fy = yearFromYM(editingEntry.start)
          const ly = yearFromYM(editingEntry.end)
          setFirstYear(fy)
          setLastYear(ly)
          const attended = parseYearsAttended(editingEntry.description)
          // If no explicit attended years stored, default to all years in range
          if (attended.size === 0 && fy && ly) {
            const all = new Set<number>()
            for (let y = parseInt(fy); y <= parseInt(ly); y++) all.add(y)
            setYearsAttended(all)
          } else {
            setYearsAttended(attended)
          }
        }
      } else {
        setCat(defaultCat || 'work')
        setTitle('')
        setCompany('')
        setStart(defaultYM || '')
        setEnd(defaultEndYM || '')
        setFuzzyStart(false)
        setFuzzyEnd(false)
        setNote('')
        setShowOnResume(false)
        const pal = getPalette(defaultCat || 'work')
        setColor(pal[2] || pal[0] || DEFAULT_COLORS[defaultCat || 'work'] || '#4070a8')

        // Gathering defaults from click position
        if (defaultCat === 'gatherings') {
          const fy = yearFromYM(defaultYM || '')
          const ly = yearFromYM(defaultEndYM || '')
          setFirstYear(fy)
          setLastYear(ly)
          if (fy && ly) {
            const all = new Set<number>()
            for (let y = parseInt(fy); y <= parseInt(ly); y++) all.add(y)
            setYearsAttended(all)
          } else {
            setYearsAttended(new Set())
          }
        } else {
          setFirstYear('')
          setLastYear('')
          setYearsAttended(new Set())
        }
      }
      setTimeout(() => titleRef.current?.focus(), 80)
    }
  }, [open, editingEntry, defaultCat, defaultYM, defaultEndYM])

  const handleCatChange = (newCat: string) => {
    setCat(newCat)
    const pal = getPalette(newCat)
    if (!editingEntry && !pal.includes(color)) setColor(pal[2] || pal[0] || '#4070a8')
  }

  const toggleYear = (y: number) => {
    setYearsAttended(prev => {
      const next = new Set(prev)
      if (next.has(y)) next.delete(y)
      else next.add(y)
      return next
    })
  }

  const handleSave = () => {
    if (!title.trim()) return

    if (cat === 'gatherings') {
      if (!firstYear.trim()) return
      const fy = parseInt(firstYear)
      const ly = lastYear.trim() ? parseInt(lastYear) : fy
      if (isNaN(fy)) return
      const startYM = fy + '-01'
      const endYM = (isNaN(ly) ? fy : ly) + '-12'
      const attendedArr = [...yearsAttended].sort((a, b) => a - b)
      const description = attendedArr.length > 0 ? attendedArr.join(',') : ''
      onSave({
        id: editingEntry?.id,
        cat,
        title: title.trim(),
        description,
        start: startYM,
        end: endYM,
        fuzzyStart: true,
        fuzzyEnd: true,
        note: note.trim(),
        color,
        showOnResume,
        source: editingEntry?.source,
      })
    } else {
      if (!start.trim()) return
      onSave({
        id: editingEntry?.id,
        cat,
        title: title.trim(),
        company: (cat === 'work') ? company.trim() : undefined,
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
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave()
  }

  if (!open) return null

  const isGathering = cat === 'gatherings'
  const basePal = getPalette(cat)
  const allSwatches = color && !basePal.includes(color) && !UNIVERSAL_COLORS.includes(color)
    ? [...basePal, color]
    : basePal

  // Resolve label for current category
  const catLabel = colOptions.find(c => c.id === cat)?.label || FALLBACK_LABELS[cat] || 'entry'

  // Year grid for gatherings
  const fyNum = parseInt(firstYear)
  const lyNum = parseInt(lastYear)
  const yearGridStart = !isNaN(fyNum) ? fyNum : 0
  const yearGridEnd = !isNaN(lyNum) && lyNum >= yearGridStart ? lyNum : yearGridStart
  const showYearGrid = isGathering && yearGridStart > 0 && yearGridEnd >= yearGridStart

  return (
    <div
      style={S.overlay}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      onKeyDown={handleKeyDown}
    >
      <div style={S.box}>
        <div style={S.title}>
          {editingEntry ? 'Edit entry' : `New ${catLabel}`}
        </div>

        <div style={S.frow}>
          <label style={S.label}>Category</label>
          <select
            value={cat}
            onChange={(e) => handleCatChange(e.target.value)}
            disabled={editingEntry?.source === 'work' || editingEntry?.source === 'contact' || editingEntry?.source === 'education'}
            style={S.input}
          >
            {colOptions.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>

        <div style={S.frow}>
          <label style={S.label}>{isGathering ? 'Event Name' : cat === 'work' ? 'Job Title' : cat === 'education' ? 'Institution' : 'Title / Name'}</label>
          <input
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={isGathering ? 'e.g. Burning Man, SXSW, Sundance' : cat === 'work' ? 'e.g. Software Engineer' : cat === 'education' ? 'e.g. MIT' : 'e.g. 136 Santa Cruz St…'}
            style={S.input}
          />
        </div>

        {cat === 'work' && (
          <div style={S.frow}>
            <label style={S.label}>Company</label>
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g. Lucasfilm"
              style={S.input}
            />
          </div>
        )}

        {isGathering ? (
          <>
            {/* ── Gathering year inputs ── */}
            <div style={S.fcols}>
              <div style={S.frow}>
                <label style={S.label}>First Year</label>
                <input
                  value={firstYear}
                  onChange={(e) => {
                    setFirstYear(e.target.value)
                    // Auto-populate attended years when setting range
                    const fy = parseInt(e.target.value)
                    const ly = parseInt(lastYear)
                    if (!isNaN(fy) && !isNaN(ly) && ly >= fy) {
                      const all = new Set<number>()
                      for (let y = fy; y <= ly; y++) all.add(y)
                      setYearsAttended(all)
                    }
                  }}
                  placeholder="1988"
                  style={S.input}
                />
              </div>
              <div style={S.frow}>
                <label style={S.label}>Last Year (or blank)</label>
                <input
                  value={lastYear}
                  onChange={(e) => {
                    setLastYear(e.target.value)
                    const fy = parseInt(firstYear)
                    const ly = parseInt(e.target.value)
                    if (!isNaN(fy) && !isNaN(ly) && ly >= fy) {
                      const all = new Set<number>()
                      for (let y = fy; y <= ly; y++) all.add(y)
                      setYearsAttended(all)
                    }
                  }}
                  placeholder="2008"
                  style={S.input}
                />
              </div>
            </div>

            {/* ── Year grid ── */}
            {showYearGrid && (
              <div style={S.frow}>
                <label style={S.label}>Years Attended (click to toggle)</label>
                <div style={S.yearGrid}>
                  {Array.from({ length: yearGridEnd - yearGridStart + 1 }, (_, i) => {
                    const y = yearGridStart + i
                    const attended = yearsAttended.has(y)
                    return (
                      <div
                        key={y}
                        onClick={() => toggleYear(y)}
                        style={{
                          padding: '3px 0',
                          borderRadius: 3,
                          cursor: 'pointer',
                          textAlign: 'center',
                          fontSize: 9,
                          fontFamily: "'DM Mono', monospace",
                          letterSpacing: '.02em',
                          background: attended ? color : 'transparent',
                          color: attended ? '#f6f1e6' : '#9a8e78',
                          border: attended ? `1px solid ${color}` : '1px solid #d8d0c0',
                          transition: 'all .1s',
                        }}
                      >
                        {y}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* ── Standard date inputs ── */}
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
          </>
        )}

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
          <div style={S.swatchGrid}>
            {allSwatches.map(c => (
              <div
                key={c}
                onClick={() => setColor(c)}
                style={{
                  width: 18, height: 18, borderRadius: 3, cursor: 'pointer',
                  background: c,
                  border: c === color ? '2px solid #1a1812' : '2px solid transparent',
                  transition: 'border-color .1s, transform .1s',
                }}
              />
            ))}
          </div>
          {/* Universal colors */}
          <div style={{ marginTop: 4, display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            <span style={{ width: '100%', fontSize: 6, letterSpacing: '.2em', color: '#d8d0c0', marginBottom: 1 }}>UNIVERSAL</span>
            {UNIVERSAL_COLORS.map(c => (
              <div
                key={c}
                onClick={() => setColor(c)}
                style={{
                  width: 18, height: 18, borderRadius: 3, cursor: 'pointer',
                  background: c,
                  border: c === color ? '2px solid #1a1812' : '2px solid transparent',
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
    fontFamily: "'DM Mono', monospace", maxHeight: '85vh', overflowY: 'auto',
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
  swatchGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(8, 18px)', gap: 3,
  },
  yearGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(42px, 1fr))',
    gap: 4,
  },
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
