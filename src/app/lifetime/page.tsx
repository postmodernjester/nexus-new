'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Nav from '@/components/Nav'
import { loadLifetimeData, saveLifetimeNotes, type LifetimeYear } from '@/lib/lifetime'

export default function LifetimePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [years, setYears] = useState<LifetimeYear[]>([])
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [editingYear, setEditingYear] = useState<number | null>(null)
  const [editText, setEditText] = useState('')
  const yearRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ─── Load data ──────────────────────────────
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      try {
        const data = await loadLifetimeData()
        setYears(data.years)
        // Auto-expand years that have notes or context
        const autoExpand = new Set<number>()
        data.years.forEach(y => {
          if (y.notes || y.work.length || y.education.length) autoExpand.add(y.year)
        })
        setExpanded(autoExpand)
      } catch (err) {
        console.error('Failed to load lifetime data:', err)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [router])

  // ─── Toggle expand/collapse ──────────────────
  const toggleYear = useCallback((year: number) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(year)) next.delete(year)
      else next.add(year)
      return next
    })
  }, [])

  // ─── Start editing notes ─────────────────────
  const startEdit = useCallback((year: number, currentNotes: string) => {
    setEditingYear(year)
    setEditText(currentNotes)
  }, [])

  // ─── Save notes (debounced) ──────────────────
  const saveNotes = useCallback((year: number, text: string) => {
    setYears(prev => prev.map(y => y.year === year ? { ...y, notes: text } : y))
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveLifetimeNotes(year, text).catch(console.error)
    }, 800)
  }, [])

  // ─── Finish editing ─────────────────────────
  const finishEdit = useCallback(() => {
    if (editingYear !== null) {
      saveLifetimeNotes(editingYear, editText).catch(console.error)
      setYears(prev => prev.map(y => y.year === editingYear ? { ...y, notes: editText } : y))
    }
    setEditingYear(null)
  }, [editingYear, editText])

  // ─── Scroll to year ─────────────────────────
  const scrollToYear = useCallback((year: number) => {
    setExpanded(prev => new Set([...prev, year]))
    setTimeout(() => {
      yearRefs.current[year]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }, [])

  // ─── Year picker years (decade markers) ─────
  const firstYear = years.length > 0 ? years[0].year : new Date().getFullYear()
  const lastYear = years.length > 0 ? years[years.length - 1].year : new Date().getFullYear()

  if (loading) {
    return (
      <>
        <Nav />
        <div style={S.loadingWrap}>
          <span style={S.loadingText}>Loading lifetime…</span>
        </div>
      </>
    )
  }

  return (
    <>
      <Nav />
      <div style={S.page}>
        {/* ── HEADER ─────────────────────── */}
        <div style={S.header}>
          <h1 style={S.title}>lifetime</h1>
          <p style={S.subtitle}>year by year</p>
        </div>

        {/* ── YEAR PICKER ────────────────── */}
        <div style={S.yearPicker}>
          <div style={S.yearPickerInner}>
            {years.map(y => {
              const hasContent = y.notes || y.work.length || y.education.length || y.gatherings.length
              const isDecade = y.year % 10 === 0
              return (
                <button
                  key={y.year}
                  onClick={() => scrollToYear(y.year)}
                  style={{
                    ...S.yearChip,
                    fontWeight: isDecade ? 700 : 400,
                    color: hasContent ? '#1a1812' : '#c0b8a8',
                    background: isDecade ? 'rgba(0,0,0,.04)' : 'none',
                  }}
                >
                  {y.year}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── YEAR CARDS ─────────────────── */}
        <div style={S.cardsWrap}>
          {years.map(y => {
            const isOpen = expanded.has(y.year)
            const isEditing = editingYear === y.year
            const hasNotes = !!y.notes.trim()
            const hasContext = y.work.length > 0 || y.education.length > 0 || y.places.length > 0 || y.gatherings.length > 0 || y.people.length > 0 || y.entries.length > 0
            const isEmpty = !hasNotes && !hasContext

            return (
              <div
                key={y.year}
                ref={el => { yearRefs.current[y.year] = el }}
                style={S.yearCard}
              >
                {/* Year header — click to toggle */}
                <div
                  onClick={() => toggleYear(y.year)}
                  style={S.yearHeader}
                >
                  <span style={S.yearNum}>{y.year}</span>
                  {y.age !== null && <span style={S.ageBadge}>(turn {y.age})</span>}

                  {/* Inline context preview when collapsed */}
                  {!isOpen && (
                    <span style={S.previewText}>
                      {[
                        ...y.work.map(w => w.company || w.title),
                        ...y.education.map(e => e.institution),
                        ...y.places,
                      ].filter(Boolean).slice(0, 3).join(' · ') || ''}
                    </span>
                  )}

                  <span style={{ flex: 1 }} />

                  {hasNotes && <span style={S.hasNotesDot} />}

                  <span style={{ ...S.chevron, transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>›</span>
                </div>

                {/* Expanded body */}
                {isOpen && (
                  <div style={S.yearBody}>
                    {/* Auto-context */}
                    {hasContext && (
                      <div style={S.contextBlock}>
                        {y.work.length > 0 && (
                          <div style={S.contextLine}>
                            <span style={S.contextLabel}>work</span>
                            <span style={S.contextValue}>{y.work.map(w => w.company ? `${w.title} · ${w.company}` : w.title).join(', ')}</span>
                          </div>
                        )}
                        {y.education.length > 0 && (
                          <div style={S.contextLine}>
                            <span style={S.contextLabel}>school</span>
                            <span style={S.contextValue}>{y.education.map(e => e.degree ? `${e.institution} (${e.degree})` : e.institution).join(', ')}</span>
                          </div>
                        )}
                        {y.places.length > 0 && (
                          <div style={S.contextLine}>
                            <span style={S.contextLabel}>living</span>
                            <span style={S.contextValue}>{y.places.join(', ')}</span>
                          </div>
                        )}
                        {y.gatherings.length > 0 && (
                          <div style={S.contextLine}>
                            <span style={S.contextLabel}>events</span>
                            <span style={S.contextValue}>{y.gatherings.join(', ')}</span>
                          </div>
                        )}
                        {y.people.length > 0 && (
                          <div style={S.contextLine}>
                            <span style={S.contextLabel}>met</span>
                            <span style={S.contextValue}>{y.people.join(', ')}</span>
                          </div>
                        )}
                        {y.entries.length > 0 && (
                          <div style={S.contextLine}>
                            <span style={S.contextLabel}>other</span>
                            <span style={S.contextValue}>{y.entries.map(e => e.title).join(', ')}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Notes area */}
                    {isEditing ? (
                      <textarea
                        autoFocus
                        value={editText}
                        onChange={e => {
                          setEditText(e.target.value)
                          saveNotes(y.year, e.target.value)
                        }}
                        onBlur={finishEdit}
                        onKeyDown={e => {
                          if (e.key === 'Escape') finishEdit()
                        }}
                        placeholder="What happened this year…"
                        style={S.notesTextarea}
                        rows={Math.max(4, (editText.match(/\n/g) || []).length + 2)}
                      />
                    ) : (
                      <div
                        onClick={() => startEdit(y.year, y.notes)}
                        style={S.notesDisplay}
                      >
                        {hasNotes ? (
                          renderNotes(y.notes)
                        ) : (
                          <span style={S.placeholder}>click to add notes for {y.year}…</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

// ─── Simple markdown-ish rendering ──────────
function renderNotes(text: string) {
  return text.split('\n').map((line, i) => {
    if (!line.trim()) return <div key={i} style={{ height: 6 }} />

    const indent = line.match(/^(\s+)/)?.[1]?.length || 0
    const indentLevel = Math.floor(indent / 2)

    let content = line.trim()

    // Bold: **text**
    const parts: (string | JSX.Element)[] = []
    let lastIdx = 0
    const boldRegex = /\*\*(.+?)\*\*/g
    let match
    while ((match = boldRegex.exec(content)) !== null) {
      if (match.index > lastIdx) parts.push(content.slice(lastIdx, match.index))
      parts.push(<strong key={`b${i}-${match.index}`}>{match[1]}</strong>)
      lastIdx = match.index + match[0].length
    }
    if (lastIdx < content.length) parts.push(content.slice(lastIdx))
    if (parts.length === 0) parts.push(content)

    // Italic: *text* (applied to remaining plain strings)
    const finalParts = parts.flatMap((part, pi) => {
      if (typeof part !== 'string') return [part]
      const italicParts: (string | JSX.Element)[] = []
      let lastJ = 0
      const italicRegex = /\*(.+?)\*/g
      let m
      while ((m = italicRegex.exec(part)) !== null) {
        if (m.index > lastJ) italicParts.push(part.slice(lastJ, m.index))
        italicParts.push(<em key={`i${i}-${pi}-${m.index}`}>{m[1]}</em>)
        lastJ = m.index + m[0].length
      }
      if (lastJ < part.length) italicParts.push(part.slice(lastJ))
      return italicParts.length > 0 ? italicParts : [part]
    })

    return (
      <div
        key={i}
        style={{
          paddingLeft: indentLevel * 14,
          lineHeight: 1.7,
          fontSize: 11.5,
          letterSpacing: '.01em',
        }}
      >
        {finalParts}
      </div>
    )
  })
}

// ═══════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════
const S: Record<string, React.CSSProperties> = {
  loadingWrap: {
    height: 'calc(100vh - 50px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#f0ead8',
  },
  loadingText: {
    fontFamily: "'DM Mono', monospace", fontSize: 12, color: '#9a8e78',
  },
  page: {
    minHeight: 'calc(100vh - 50px)', background: '#f0ead8',
    fontFamily: "'DM Mono', monospace", color: '#1a1812',
    paddingBottom: 80,
  },
  header: {
    padding: '30px 0 8px', textAlign: 'center' as const,
  },
  title: {
    fontFamily: "'Libre Baskerville', serif", fontStyle: 'italic',
    fontSize: 22, fontWeight: 400, margin: 0, color: '#1a1812', letterSpacing: '-.02em',
  },
  subtitle: {
    fontSize: 8, letterSpacing: '.3em', textTransform: 'uppercase' as const,
    color: '#9a8e78', margin: '4px 0 0',
  },
  yearPicker: {
    position: 'sticky' as const, top: 0, zIndex: 40,
    background: '#f0ead8', borderBottom: '1px solid #d8d0c0',
    padding: '8px 0',
    overflow: 'hidden',
  },
  yearPickerInner: {
    display: 'flex', gap: 2, overflowX: 'auto' as const,
    padding: '0 24px', scrollbarWidth: 'thin' as const,
    justifyContent: 'center', flexWrap: 'wrap' as const,
  },
  yearChip: {
    background: 'none', border: 'none', fontFamily: "'DM Mono', monospace",
    fontSize: 9, padding: '3px 5px', cursor: 'pointer', borderRadius: 3,
    letterSpacing: '.02em', transition: 'background .1s',
    whiteSpace: 'nowrap' as const, lineHeight: 1.4,
  },
  cardsWrap: {
    maxWidth: 640, margin: '0 auto', padding: '16px 20px',
  },
  yearCard: {
    borderBottom: '1px solid #e0d8c8',
  },
  yearHeader: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0',
    cursor: 'pointer', userSelect: 'none' as const,
  },
  yearNum: {
    fontFamily: "'Libre Baskerville', serif", fontSize: 17, fontWeight: 700,
    letterSpacing: '-.02em', color: '#1a1812', minWidth: 42,
  },
  ageBadge: {
    fontSize: 9, color: '#9a8e78', letterSpacing: '.04em',
  },
  previewText: {
    fontSize: 9, color: '#b8b0a0', letterSpacing: '.02em',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
    flex: 1, marginLeft: 8,
  },
  hasNotesDot: {
    width: 5, height: 5, borderRadius: '50%', background: '#a08868', flexShrink: 0,
  },
  chevron: {
    fontSize: 16, color: '#c0b8a8', transition: 'transform .15s', flexShrink: 0,
  },
  yearBody: {
    paddingBottom: 14,
  },
  contextBlock: {
    background: '#e8e0d0', borderRadius: 4, padding: '7px 10px',
    marginBottom: 10,
  },
  contextLine: {
    display: 'flex', gap: 8, alignItems: 'baseline', lineHeight: 1.7,
  },
  contextLabel: {
    fontSize: 7, letterSpacing: '.18em', textTransform: 'uppercase' as const,
    color: '#9a8e78', minWidth: 38, flexShrink: 0, paddingTop: 1,
  },
  contextValue: {
    fontSize: 10, color: '#5a5040', letterSpacing: '.01em',
  },
  notesDisplay: {
    cursor: 'text', minHeight: 24, padding: '4px 0',
    color: '#1a1812',
  },
  placeholder: {
    fontSize: 10, color: '#c0b8a8', fontStyle: 'italic',
  },
  notesTextarea: {
    width: '100%', background: '#f6f1e6', border: '1px solid #d8d0c0',
    borderRadius: 4, padding: '8px 10px', fontFamily: "'DM Mono', monospace",
    fontSize: 11.5, color: '#1a1812', outline: 'none', resize: 'vertical' as const,
    lineHeight: '1.7', letterSpacing: '.01em',
    minHeight: 80,
  },
}
