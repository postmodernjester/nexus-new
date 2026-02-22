'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  loadChronicleData, upsertEntry, deleteEntry, upsertPlace, deletePlace,
  updateEntryDates, updateWorkEntryFromChronicle, deleteWorkEntry,
  updateEducationFromChronicle,
  type ChronicleEntry, type ChroniclePlace, type ChronicleWorkEntry,
  type ChronicleContact, type ChronicleEducationEntry,
} from '@/lib/chronicle'
import ChronicleModal, { type EntryFormData } from './ChronicleModal'
import ChronicleGeoModal, { type GeoFormData } from './ChronicleGeoModal'

// ═══════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════
const CURRENT_YEAR = new Date().getFullYear()
const COL_W = 148
const COLLAPSED_W = 24
const AXIS_W = 72

// Zoom: slider 0 → 40yr visible, 0.5 → ~4yr, 1 → 2yr
const ZOOM_YEARS_MAX = 40
const ZOOM_YEARS_MIN = 2
const ZOOM_GAMMA = 0.38

// localStorage keys
const LS_SLIDER = 'chronicle_slider_pos'
const LS_CENTER_YEAR = 'chronicle_center_year'
const LS_CENTER_MONTH = 'chronicle_center_month'
const LS_COLLAPSED = 'chronicle_collapsed_cols'

const COLS: { id: string; label: string; color: string; private?: boolean }[] = [
  { id: 'work', label: 'Work', color: '#4070a8' },
  { id: 'project', label: 'Projects', color: '#508038' },
  { id: 'education', label: 'Education', color: '#2a8a6a' },
  { id: 'personal', label: 'Personal', color: '#a85060', private: true },
  { id: 'residence', label: 'Residences', color: '#806840', private: true },
  { id: 'gatherings', label: 'Gatherings', color: '#c06848' },
  { id: 'tech', label: 'Tech', color: '#986020' },
  { id: 'people', label: 'People', color: '#7050a8' },
]

const DEFAULT_COLORS: Record<string, string> = {
  work: '#4070a8', project: '#508038', education: '#2a8a6a', personal: '#a85060',
  residence: '#806840', gatherings: '#c06848', tech: '#986020', people: '#7050a8',
}

// Columns where double-click should NOT open add modal
const NO_ADD_COLS = new Set(['gatherings', 'people'])

// ═══════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════
interface YM { y: number; m: number }

function parseYM(s: string | null | undefined): YM | null {
  if (!s) return null
  const p = s.split('-')
  return { y: +p[0], m: +(p[1] || 1) }
}

function toMo(ym: YM, vs: number): number {
  return (ym.y - vs) * 12 + (ym.m - 1)
}

function toPx(ym: YM, pxm: number, vs: number): number {
  return toMo(ym, vs) * pxm
}

function pxToYM(px: number, pxm: number, vs: number): YM {
  const mo = Math.round(px / pxm)
  return { y: vs + Math.floor(mo / 12), m: (mo % 12) + 1 }
}

function ymStr(ym: YM): string {
  return ym.y + '-' + String(ym.m).padStart(2, '0')
}

function fmtYM(ym: YM): string {
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][ym.m - 1] + ' ' + ym.y
}

function hex2rgba(h: string, a: number): string {
  const r = parseInt(h.slice(1, 3), 16)
  const g = parseInt(h.slice(3, 5), 16)
  const b = parseInt(h.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

function addOneYear(ym: string): string {
  const p = ym.split('-')
  return (parseInt(p[0]) + 1) + '-' + (p[1] || '01')
}

// Zoom conversion: slider position [0,1] → years visible
function sliderToYears(t: number): number {
  const clamped = Math.max(0, Math.min(1, t))
  return ZOOM_YEARS_MAX * Math.pow(ZOOM_YEARS_MIN / ZOOM_YEARS_MAX, Math.pow(clamped, ZOOM_GAMMA))
}

// Column layout (collapse-aware)
function getColLeft(colId: string, collapsed: Set<string>): number {
  let x = 0
  for (const c of COLS) {
    if (c.id === colId) return x
    x += collapsed.has(c.id) ? COLLAPSED_W : COL_W
  }
  return x
}

function getTotalGridW(collapsed: Set<string>): number {
  return COLS.reduce((sum, c) => sum + (collapsed.has(c.id) ? COLLAPSED_W : COL_W), 0)
}

function getColAtX(x: number, collapsed: Set<string>): number {
  let acc = 0
  for (let i = 0; i < COLS.length; i++) {
    const w = collapsed.has(COLS[i].id) ? COLLAPSED_W : COL_W
    if (x < acc + w) return i
    acc += w
  }
  return -1
}

// Extract earliest year from a date string like "YYYY-MM" or "YYYY-MM-DD"
function yearFromDate(s: string | null | undefined): number | null {
  if (!s) return null
  const y = parseInt(s)
  return isNaN(y) ? null : y
}

// Lock icon SVG
function LockIcon() {
  return (
    <svg width="8" height="10" viewBox="0 0 8 10" fill="none" style={{ marginLeft: 3, opacity: 0.4, flexShrink: 0 }}>
      <rect x="0.5" y="4" width="7" height="5.5" rx="1" stroke="currentColor" strokeWidth="1" fill="none" />
      <path d="M2 4V2.5C2 1.4 2.9.5 4 .5s2 .9 2 2V4" stroke="currentColor" strokeWidth="1" fill="none" />
    </svg>
  )
}

// Unified timeline item
interface TimelineItem {
  id: string
  cat: string
  title: string
  start: string
  end: string | null
  color: string
  fuzzyStart: boolean
  fuzzyEnd: boolean
  note: string
  source: 'chronicle' | 'work' | 'contact' | 'education'
}

interface PlaceItem {
  id: string
  title: string
  start: string
  end: string | null
  color: string
  fuzzyStart: boolean
  fuzzyEnd: boolean
  note: string
}

// ═══════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════
export default function ChronicleCanvas() {
  // Data
  const [entries, setEntries] = useState<ChronicleEntry[]>([])
  const [places, setPlaces] = useState<ChroniclePlace[]>([])
  const [workEntries, setWorkEntries] = useState<ChronicleWorkEntry[]>([])
  const [contacts, setContacts] = useState<ChronicleContact[]>([])
  const [educationEntries, setEducationEntries] = useState<ChronicleEducationEntry[]>([])
  const [loading, setLoading] = useState(true)

  // Zoom slider position [0, 1] — persisted
  const [sliderPos, setSliderPos] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(LS_SLIDER)
      if (saved) {
        const parsed = parseFloat(saved)
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) return parsed
      }
    }
    return 0.5
  })

  // Collapsed columns — persisted
  const [collapsedCols, setCollapsedCols] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(LS_COLLAPSED)
        if (saved) return new Set(JSON.parse(saved))
      } catch { /* ignore */ }
    }
    return new Set()
  })

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showDelHint, setShowDelHint] = useState(false)
  const [viewportH, setViewportH] = useState(750)

  // Tooltip
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null)

  // Drag
  const dragRef = useRef<{
    type: 'move' | 'top' | 'bot' | 'fuzzy_top' | 'fuzzy_bot'
    id: string
    source: 'chronicle' | 'work' | 'contact' | 'education'
    startY: number
    origTop: number
    origH: number
    origFuzzyH?: number
  } | null>(null)
  const [dragDelta, setDragDelta] = useState<{ id: string; dy: number } | null>(null)

  // Fuzzy months per entry (local state, defaults to 6)
  const [fuzzyMonths, setFuzzyMonths] = useState<Record<string, { startMonths: number; endMonths: number }>>({})

  // Modals
  const [entryModal, setEntryModal] = useState<{
    open: boolean
    editing?: EntryFormData | null
    defaultCat?: string
    defaultYM?: string
    defaultEndYM?: string
  }>({ open: false })

  const [geoModal, setGeoModal] = useState<{
    open: boolean
    editing?: GeoFormData | null
    defaultYM?: string
  }>({ open: false })

  // Zoom drag
  const zoomDragRef = useRef(false)

  // Scroll ref
  const scrollRef = useRef<HTMLDivElement>(null)

  // ─── Compute view range from data ──────────────
  const { viewStart, viewEnd } = useMemo(() => {
    const years: number[] = []
    entries.forEach(e => { const y = yearFromDate(e.start_date); if (y) years.push(y) })
    places.forEach(p => { const y = yearFromDate(p.start_date); if (y) years.push(y) })
    workEntries.forEach(w => { const y = yearFromDate(w.start_date); if (y) years.push(y) })
    contacts.forEach(c => {
      const y = yearFromDate(c.met_date) || yearFromDate(c.created_at)
      if (y) years.push(y)
    })
    educationEntries.forEach(edu => { const y = yearFromDate(edu.start_date); if (y) years.push(y) })

    if (years.length === 0) {
      return { viewStart: CURRENT_YEAR - 10, viewEnd: CURRENT_YEAR + 3 }
    }
    const earliest = Math.min(...years)
    return { viewStart: earliest - 2, viewEnd: CURRENT_YEAR + 3 }
  }, [entries, places, workEntries, contacts, educationEntries])

  // ─── Derived zoom values ───────────────────────
  const yearsVisible = sliderToYears(sliderPos)
  const pxm = Math.max(0.5, viewportH / (yearsVisible * 12))
  const totalGridW = getTotalGridW(collapsedCols)
  const totalH = (viewEnd - viewStart) * 12 * pxm

  const zoomLabel = yearsVisible >= 10
    ? Math.round(yearsVisible) + 'yr'
    : yearsVisible >= 1
      ? yearsVisible.toFixed(1).replace(/\.0$/, '') + 'yr'
      : (yearsVisible * 12).toFixed(0) + 'mo'

  // ─── Track viewport height ─────────────────────
  useEffect(() => {
    const sw = scrollRef.current
    if (!sw) return
    setViewportH(sw.clientHeight)
    const observer = new ResizeObserver(resizeEntries => {
      if (resizeEntries[0]) setViewportH(resizeEntries[0].contentRect.height)
    })
    observer.observe(sw)
    return () => observer.disconnect()
  }, [])

  // ─── Load data on mount ──────────────────────
  useEffect(() => {
    loadChronicleData()
      .then(data => {
        setEntries(data.entries)
        setPlaces(data.places)
        setWorkEntries(data.workEntries)
        setContacts(data.contacts)
        setEducationEntries(data.education)
      })
      .catch(err => console.error('Failed to load chronicle data:', err))
      .finally(() => setLoading(false))
  }, [])

  // ─── Scroll to saved center or current year on first load ──
  const initialScrollDone = useRef(false)
  useEffect(() => {
    if (!loading && scrollRef.current && !initialScrollDone.current) {
      initialScrollDone.current = true
      let centerY = CURRENT_YEAR
      let centerM = 1
      if (typeof window !== 'undefined') {
        const savedY = localStorage.getItem(LS_CENTER_YEAR)
        const savedM = localStorage.getItem(LS_CENTER_MONTH)
        if (savedY) {
          const py = parseInt(savedY)
          if (!isNaN(py) && py >= viewStart && py <= viewEnd) centerY = py
        }
        if (savedM) {
          const pm = parseInt(savedM)
          if (!isNaN(pm) && pm >= 1 && pm <= 12) centerM = pm
        }
      }
      // Use rAF to ensure layout is complete and pxm is accurate
      requestAnimationFrame(() => {
        if (!scrollRef.current) return
        const targetPx = toPx({ y: centerY, m: centerM }, pxm, viewStart)
        scrollRef.current.scrollTop = targetPx - scrollRef.current.clientHeight / 2
      })
    }
  }, [loading, pxm, viewStart, viewEnd])

  // ─── Build unified timeline items ────────────
  const timelineItems = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = []

    entries.forEach(e => {
      items.push({
        id: e.id,
        cat: e.canvas_col || e.type,
        title: e.title,
        start: e.start_date,
        end: e.end_date,
        color: e.color || DEFAULT_COLORS[e.canvas_col || e.type] || '#4070a8',
        fuzzyStart: e.fuzzy_start,
        fuzzyEnd: e.fuzzy_end,
        note: e.note || '',
        source: 'chronicle',
      })
    })

    workEntries.forEach(w => {
      items.push({
        id: `work-${w.id}`,
        cat: 'work',
        title: w.title ? (w.company ? `${w.title} · ${w.company}` : w.title) : (w.company || 'Untitled'),
        start: w.start_date,
        end: w.is_current ? null : (w.end_date || null),
        color: w.chronicle_color || '#4070a8',
        fuzzyStart: w.chronicle_fuzzy_start || false,
        fuzzyEnd: w.chronicle_fuzzy_end || false,
        note: w.chronicle_note || '',
        source: 'work',
      })
    })

    educationEntries.forEach(edu => {
      items.push({
        id: `edu-${edu.id}`,
        cat: 'education',
        title: edu.institution + (edu.degree ? ` — ${edu.degree}` : ''),
        start: edu.start_date,
        end: edu.is_current ? null : (edu.end_date || null),
        color: edu.chronicle_color || '#2a8a6a',
        fuzzyStart: edu.chronicle_fuzzy_start || false,
        fuzzyEnd: edu.chronicle_fuzzy_end || false,
        note: edu.chronicle_note || (edu.field_of_study || ''),
        source: 'education',
      })
    })

    contacts.forEach(c => {
      const startDate = c.met_date?.slice(0, 7) || c.created_at?.slice(0, 7) || '2020-01'
      items.push({
        id: `contact-${c.id}`,
        cat: 'people',
        title: c.full_name,
        start: startDate,
        end: null,
        color: c.chronicle_color || '#7050a8',
        fuzzyStart: c.chronicle_fuzzy_start || false,
        fuzzyEnd: c.chronicle_fuzzy_end || false,
        note: c.chronicle_note || (c.company ? `${c.role || ''} ${c.company}`.trim() : ''),
        source: 'contact',
      })
    })

    return items
  }, [entries, workEntries, educationEntries, contacts])

  const placeItems = useMemo<PlaceItem[]>(() => {
    return places.map(p => ({
      id: p.id,
      title: p.title,
      start: p.start_date,
      end: p.end_date,
      color: p.color || '#c0b484',
      fuzzyStart: p.fuzzy_start,
      fuzzyEnd: p.fuzzy_end,
      note: p.note || '',
    }))
  }, [places])

  // ─── Axis ticks ──────────────────────────────
  const axisTicks = useMemo(() => {
    const ticks: { y: number; top: number; isDecade: boolean; isFive: boolean }[] = []
    const showEvery = pxm < 4 ? 10 : pxm < 8 ? 5 : 1
    for (let y = viewStart; y <= viewEnd; y++) {
      if ((y - viewStart) % showEvery !== 0) continue
      ticks.push({
        y,
        top: toPx({ y, m: 1 }, pxm, viewStart),
        isDecade: y % 10 === 0,
        isFive: y % 5 === 0,
      })
    }
    return ticks
  }, [pxm, viewStart, viewEnd])

  const yearRules = useMemo(() => {
    const rules: { y: number; top: number; isDecade: boolean }[] = []
    for (let y = viewStart; y <= viewEnd; y++) {
      rules.push({ y, top: toPx({ y, m: 1 }, pxm, viewStart), isDecade: y % 10 === 0 })
    }
    return rules
  }, [pxm, viewStart, viewEnd])

  const monthRules = useMemo(() => {
    if (pxm < 10) return []
    const rules: { top: number }[] = []
    for (let y = viewStart; y <= viewEnd; y++) {
      for (let m = 2; m <= 12; m++) {
        rules.push({ top: toPx({ y, m }, pxm, viewStart) })
      }
    }
    return rules
  }, [pxm, viewStart, viewEnd])

  const todayTop = useMemo(() => {
    const now = new Date()
    return toPx({ y: now.getFullYear(), m: now.getMonth() + 1 }, pxm, viewStart)
  }, [pxm, viewStart])

  // ─── Column divider positions (collapse-aware) ─
  const colDividers = useMemo(() => {
    const divs: { left: number }[] = []
    let x = 0
    for (let i = 0; i < COLS.length; i++) {
      const w = collapsedCols.has(COLS[i].id) ? COLLAPSED_W : COL_W
      x += w
      if (i < COLS.length - 1) divs.push({ left: x })
    }
    return divs
  }, [collapsedCols])

  // ─── Selection with click-through for overlapping items ───
  const clickCycleRef = useRef<{ itemId: string; time: number; overlapping: string[]; idx: number }>({ itemId: '', time: 0, overlapping: [], idx: 0 })

  const selectEntry = useCallback((id: string | null) => {
    if (!id) {
      setSelectedId(null)
      return
    }

    const clickedItem = timelineItems.find(i => i.id === id)
    if (clickedItem) {
      const now = Date.now()
      const prev = clickCycleRef.current

      // If clicking same item (or item in the same overlap group) within 2s, cycle
      if (now - prev.time < 2000 && prev.overlapping.includes(id)) {
        const nextIdx = (prev.idx + 1) % prev.overlapping.length
        const nextId = prev.overlapping[nextIdx]
        clickCycleRef.current = { ...prev, time: now, idx: nextIdx, itemId: nextId }
        setSelectedId(nextId)
        setShowDelHint(true)
        setTimeout(() => setShowDelHint(false), 2000)
        return
      }

      // Find all items in the same column that overlap with this one
      const s1 = parseYM(clickedItem.start)
      if (s1) {
        const top1 = toPx(s1, pxm, viewStart)
        const e1 = clickedItem.end ? parseYM(clickedItem.end) : null
        const h1 = e1 ? Math.max(Math.round(pxm), toPx(e1, pxm, viewStart) - top1) : Math.round(pxm * 2)

        const overlapping = timelineItems.filter(item => {
          if (item.cat !== clickedItem.cat) return false
          if (collapsedCols.has(item.cat)) return false
          const s2 = parseYM(item.start)
          if (!s2) return false
          const top2 = toPx(s2, pxm, viewStart)
          const e2 = item.end ? parseYM(item.end) : null
          const h2 = e2 ? Math.max(Math.round(pxm), toPx(e2, pxm, viewStart) - top2) : Math.round(pxm * 2)
          // Check if rectangles overlap vertically
          return top1 < top2 + h2 && top1 + h1 > top2
        }).map(i => i.id)

        clickCycleRef.current = { itemId: id, time: now, overlapping, idx: 0 }
      }
    }

    setSelectedId(id)
    if (id) {
      setShowDelHint(true)
      setTimeout(() => setShowDelHint(false), 2000)
    }
  }, [timelineItems, pxm, viewStart, collapsedCols])

  // ─── Toggle column collapse ──────────────────
  const toggleCollapse = useCallback((colId: string) => {
    setCollapsedCols(prev => {
      const next = new Set(prev)
      if (next.has(colId)) next.delete(colId)
      else next.add(colId)
      localStorage.setItem(LS_COLLAPSED, JSON.stringify([...next]))
      return next
    })
  }, [])

  // ─── Keyboard handler ────────────────────────
  useEffect(() => {
    const handler = (ev: KeyboardEvent) => {
      if ((ev.target as HTMLElement).matches('input,textarea,select')) return
      if ((ev.key === 'Delete' || ev.key === 'Backspace') && selectedId) {
        const item = timelineItems.find(i => i.id === selectedId)
        if (item?.source === 'chronicle') {
          deleteEntry(selectedId).catch(console.error)
          setEntries(prev => prev.filter(e => e.id !== selectedId))
          setSelectedId(null)
        } else if (item?.source === 'work') {
          const realId = selectedId.replace('work-', '')
          deleteWorkEntry(realId).catch(console.error)
          setWorkEntries(prev => prev.filter(w => w.id !== realId))
          setSelectedId(null)
        }
      }
      if (ev.key === 'Escape') {
        // Don't handle Escape if a modal is open — let the modal handle it
        if (entryModal.open || geoModal.open) return
        setSelectedId(null)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [selectedId, timelineItems, entryModal.open, geoModal.open])

  // ─── Drag handlers ──────────────────────────
  const startDrag = useCallback((ev: React.MouseEvent, item: TimelineItem, type: 'move' | 'top' | 'bot') => {
    if (ev.button !== 0) return
    // Don't call selectEntry here — onClick will handle selection.
    // This avoids double-firing which breaks the click-through cycle.
    const s = parseYM(item.start)
    const e = item.end ? parseYM(item.end) : null
    if (!s) return
    const top = toPx(s, pxm, viewStart)
    const h = e ? Math.max(Math.round(pxm), toPx(e, pxm, viewStart) - top) : Math.round(pxm * 2)
    dragRef.current = { type, id: item.id, source: item.source, startY: ev.clientY, origTop: top, origH: h }
    ev.preventDefault()
    ev.stopPropagation()
  }, [pxm, viewStart])

  // ─── Start fuzzy drag ─────────────────────────
  const startFuzzyDrag = useCallback((ev: React.MouseEvent, item: TimelineItem, type: 'fuzzy_top' | 'fuzzy_bot') => {
    if (ev.button !== 0) return
    const fm = fuzzyMonths[item.id] || { startMonths: 6, endMonths: 6 }
    const fuzzyH = (type === 'fuzzy_top' ? fm.startMonths : fm.endMonths) * pxm
    dragRef.current = { type, id: item.id, source: item.source, startY: ev.clientY, origTop: 0, origH: 0, origFuzzyH: fuzzyH }
    ev.preventDefault()
    ev.stopPropagation()
  }, [pxm, selectEntry, fuzzyMonths])

  useEffect(() => {
    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const dy = ev.clientY - dragRef.current.startY
      setDragDelta({ id: dragRef.current.id, dy })

      const d = dragRef.current
      if (d.type === 'fuzzy_top' || d.type === 'fuzzy_bot') {
        const origH = d.origFuzzyH || 6 * pxm
        const newH = d.type === 'fuzzy_top' ? origH - dy : origH + dy
        const months = Math.max(1, Math.round(newH / pxm))
        setTooltip({ text: `~${months} mo uncertainty`, x: ev.clientX + 14, y: ev.clientY - 8 })
        return
      }

      let showTop: number
      if (d.type === 'move') showTop = Math.max(0, d.origTop + dy)
      else if (d.type === 'top') showTop = Math.max(0, d.origTop + dy)
      else showTop = d.origTop + Math.max(pxm, d.origH + dy)
      setTooltip({ text: fmtYM(pxToYM(showTop, pxm, viewStart)), x: ev.clientX + 14, y: ev.clientY - 8 })
    }

    const handleMouseUp = () => {
      if (!dragRef.current) return
      const d = dragRef.current
      const dy = dragDelta?.dy ?? 0

      // Handle fuzzy drag end
      if (d.type === 'fuzzy_top' || d.type === 'fuzzy_bot') {
        const origH = d.origFuzzyH || 6 * pxm
        const newH = d.type === 'fuzzy_top' ? origH - dy : origH + dy
        const months = Math.max(1, Math.round(newH / pxm))
        setFuzzyMonths(prev => {
          const cur = prev[d.id] || { startMonths: 6, endMonths: 6 }
          return {
            ...prev,
            [d.id]: d.type === 'fuzzy_top'
              ? { ...cur, startMonths: months }
              : { ...cur, endMonths: months },
          }
        })
        dragRef.current = null
        setDragDelta(null)
        setTooltip(null)
        return
      }

      const snap = (v: number) => Math.round(v / pxm) * pxm

      let newTop: number, newH: number
      if (d.type === 'move') {
        newTop = snap(Math.max(0, d.origTop + dy))
        newH = snap(d.origH)
      } else if (d.type === 'top') {
        newTop = snap(Math.max(0, d.origTop + dy))
        newH = snap(Math.max(pxm, d.origH - dy))
      } else {
        newTop = snap(d.origTop)
        newH = snap(Math.max(pxm, d.origH + dy))
      }

      const ns = pxToYM(newTop, pxm, viewStart)
      const ne = pxToYM(newTop + newH, pxm, viewStart)
      const newStart = ymStr(ns)
      const newEnd = ymStr(ne)

      if (d.source === 'work') {
        const realId = d.id.replace('work-', '')
        setWorkEntries(prev => prev.map(w =>
          w.id === realId ? { ...w, start_date: newStart + '-01', end_date: newEnd + '-01', is_current: false } : w
        ))
        updateWorkEntryFromChronicle(realId, { start_date: newStart + '-01', end_date: newEnd + '-01', is_current: false }).catch(console.error)
      } else if (d.source === 'education') {
        const realId = d.id.replace('edu-', '')
        setEducationEntries(prev => prev.map(edu =>
          edu.id === realId ? { ...edu, start_date: newStart + '-01', end_date: newEnd + '-01', is_current: false } : edu
        ))
        updateEducationFromChronicle(realId, { start_date: newStart + '-01', end_date: newEnd + '-01', is_current: false }).catch(console.error)
      } else {
        setEntries(prev => prev.map(e =>
          e.id === d.id ? { ...e, start_date: newStart, end_date: newEnd } : e
        ))
        updateEntryDates(d.id, newStart, newEnd).catch(console.error)
      }

      dragRef.current = null
      setDragDelta(null)
      setTooltip(null)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [pxm, viewStart, dragDelta, fuzzyMonths])

  // ─── Zoom ────────────────────────────────────
  const sliderPosRef = useRef(sliderPos)
  useEffect(() => { sliderPosRef.current = sliderPos }, [sliderPos])

  const applySlider = useCallback((newPos: number) => {
    const sw = scrollRef.current
    if (!sw) return
    // Compute current pxm from the latest slider pos (avoids stale closure)
    const curYears = sliderToYears(sliderPosRef.current)
    const curPxm = Math.max(0.5, sw.clientHeight / (curYears * 12))
    const centerPx = sw.scrollTop + sw.clientHeight / 2
    const centerYM = pxToYM(centerPx, curPxm, viewStart)
    const clamped = Math.max(0, Math.min(1, newPos))
    sliderPosRef.current = clamped
    setSliderPos(clamped)
    localStorage.setItem(LS_SLIDER, String(clamped))
    requestAnimationFrame(() => {
      const newYears = sliderToYears(clamped)
      const newPxm = Math.max(0.5, sw.clientHeight / (newYears * 12))
      sw.scrollTop = toPx(centerYM, newPxm, viewStart) - sw.clientHeight / 2
    })
  }, [viewStart])

  const zoomFromTrack = useCallback((clientX: number) => {
    const el = document.getElementById('chr-zoom-track')
    if (!el) return
    const rect = el.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    applySlider(pct)
  }, [applySlider])

  useEffect(() => {
    const handleMouseMove = (ev: MouseEvent) => {
      if (zoomDragRef.current) zoomFromTrack(ev.clientX)
    }
    const handleMouseUp = () => { zoomDragRef.current = false }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [zoomFromTrack])

  // ─── Wheel zoom (Ctrl/Cmd + scroll) centered on mouse ──
  useEffect(() => {
    const sw = scrollRef.current
    if (!sw) return
    const handleWheel = (ev: WheelEvent) => {
      if (!ev.ctrlKey && !ev.metaKey) return
      ev.preventDefault()
      const rect = sw.getBoundingClientRect()
      // Compute current pxm from ref to avoid stale closure
      const curYears = sliderToYears(sliderPosRef.current)
      const curPxm = Math.max(0.5, sw.clientHeight / (curYears * 12))
      const mouseY = ev.clientY - rect.top + sw.scrollTop
      const mouseYM = pxToYM(mouseY, curPxm, viewStart)
      const mouseOffset = ev.clientY - rect.top
      const delta = ev.deltaY > 0 ? -0.03 : 0.03
      const newPos = Math.max(0, Math.min(1, sliderPosRef.current + delta))
      sliderPosRef.current = newPos
      setSliderPos(newPos)
      localStorage.setItem(LS_SLIDER, String(newPos))
      requestAnimationFrame(() => {
        const newYears = sliderToYears(newPos)
        const newPxm = Math.max(0.5, sw.clientHeight / (newYears * 12))
        sw.scrollTop = toPx(mouseYM, newPxm, viewStart) - mouseOffset
      })
    }
    sw.addEventListener('wheel', handleWheel, { passive: false })
    return () => sw.removeEventListener('wheel', handleWheel)
  }, [viewStart])

  // ─── Persist scroll center (debounced) ────────
  useEffect(() => {
    const sw = scrollRef.current
    if (!sw) return
    let timer: ReturnType<typeof setTimeout>
    const handleScroll = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        const centerPx = sw.scrollTop + sw.clientHeight / 2
        const centerYM = pxToYM(centerPx, pxm, viewStart)
        localStorage.setItem(LS_CENTER_YEAR, String(centerYM.y))
        localStorage.setItem(LS_CENTER_MONTH, String(centerYM.m))
      }, 300)
    }
    sw.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      clearTimeout(timer)
      sw.removeEventListener('scroll', handleScroll)
    }
  }, [pxm, viewStart])

  // ─── Click on empty space deselects ──────────
  const handleBackgroundClick = useCallback((ev: React.MouseEvent) => {
    if (!(ev.target as HTMLElement).closest('[data-entry],[data-person]')) {
      setSelectedId(null)
    }
  }, [])

  // ─── Double-click grid → new entry ────────────
  const handleGridDblClick = useCallback((ev: React.MouseEvent) => {
    const gridEl = document.getElementById('chr-grid')
    if (!gridEl) return
    const rect = gridEl.getBoundingClientRect()
    const relX = ev.clientX - rect.left
    const relY = ev.clientY - rect.top
    const colIdx = getColAtX(relX, collapsedCols)
    if (colIdx < 0 || colIdx >= COLS.length) return
    const col = COLS[colIdx]
    // Don't add to collapsed, gatherings, or people columns
    if (collapsedCols.has(col.id) || NO_ADD_COLS.has(col.id)) return
    const ym = pxToYM(relY, pxm, viewStart)
    const startYM = ymStr(ym)
    setEntryModal({
      open: true,
      editing: null,
      defaultCat: col.id,
      defaultYM: startYM,
      defaultEndYM: addOneYear(startYM),
    })
  }, [pxm, viewStart, collapsedCols])

  // ─── Axis double-click → geo modal ──────────────────
  const handleAxisDblClick = useCallback((ev: React.MouseEvent) => {
    const axisEl = document.getElementById('chr-axis')
    if (!axisEl) return
    const rect = axisEl.getBoundingClientRect()
    const relY = ev.clientY - rect.top
    const ym = pxToYM(relY, pxm, viewStart)

    const hit = placeItems.find(p => {
      const s = parseYM(p.start)
      const en = p.end ? parseYM(p.end) : { y: viewEnd, m: 1 }
      if (!s || !en) return false
      return toMo(ym, viewStart) >= toMo(s, viewStart) && toMo(ym, viewStart) < toMo(en, viewStart)
    })

    if (hit) {
      setGeoModal({
        open: true,
        editing: {
          id: hit.id,
          title: hit.title,
          start: hit.start,
          end: hit.end || '',
          fuzzyStart: hit.fuzzyStart,
          fuzzyEnd: hit.fuzzyEnd,
          color: hit.color,
        },
      })
    } else {
      setGeoModal({
        open: true,
        editing: null,
        defaultYM: ymStr(ym),
      })
    }
  }, [pxm, viewStart, viewEnd, placeItems])

  // ─── Entry modal handlers ────────────────────
  const handleEntrySave = useCallback(async (data: EntryFormData) => {
    try {
      if (data.source === 'work' && data.id) {
        await updateWorkEntryFromChronicle(data.id, {
          title: data.title || undefined,
          company: data.company || undefined,
          start_date: data.start ? data.start + '-01' : undefined,
          end_date: data.end ? data.end + '-01' : null,
          is_current: !data.end,
          chronicle_color: data.color,
          chronicle_fuzzy_start: data.fuzzyStart,
          chronicle_fuzzy_end: data.fuzzyEnd,
          chronicle_note: data.note,
        })
        setWorkEntries(prev => prev.map(w => w.id === data.id ? {
          ...w,
          title: data.title || w.title,
          company: data.company || w.company,
          start_date: data.start ? data.start + '-01' : w.start_date,
          end_date: data.end ? data.end + '-01' : undefined,
          is_current: !data.end,
          chronicle_color: data.color,
          chronicle_fuzzy_start: data.fuzzyStart,
          chronicle_fuzzy_end: data.fuzzyEnd,
          chronicle_note: data.note,
        } : w))
      } else if (data.source === 'education' && data.id) {
        await updateEducationFromChronicle(data.id, {
          start_date: data.start ? data.start + '-01' : undefined,
          end_date: data.end ? data.end + '-01' : null,
          is_current: !data.end,
          chronicle_color: data.color,
          chronicle_fuzzy_start: data.fuzzyStart,
          chronicle_fuzzy_end: data.fuzzyEnd,
          chronicle_note: data.note,
        })
        setEducationEntries(prev => prev.map(edu => edu.id === data.id ? {
          ...edu,
          start_date: data.start ? data.start + '-01' : edu.start_date,
          end_date: data.end ? data.end + '-01' : undefined,
          is_current: !data.end,
          chronicle_color: data.color,
          chronicle_fuzzy_start: data.fuzzyStart,
          chronicle_fuzzy_end: data.fuzzyEnd,
          chronicle_note: data.note,
        } : edu))
      } else if (data.cat === 'work' && !data.id && data.company) {
        // New work entry from chronicle — save to work_entries table
        const { supabase: sb } = await import('@/lib/supabase')
        const userId = (await sb.auth.getUser()).data.user?.id
        if (!userId) throw new Error('Not authenticated')
        const { data: newWork, error } = await sb
          .from('work_entries')
          .insert({
            user_id: userId,
            title: data.title,
            company: data.company,
            start_date: data.start + '-01',
            end_date: data.end ? data.end + '-01' : null,
            is_current: !data.end,
            chronicle_color: data.color,
            chronicle_fuzzy_start: data.fuzzyStart,
            chronicle_fuzzy_end: data.fuzzyEnd,
            chronicle_note: data.note,
          })
          .select()
          .single()
        if (error) throw error
        setWorkEntries(prev => [...prev, newWork as ChronicleWorkEntry])
      } else {
        const result = await upsertEntry({
          id: data.id || undefined,
          type: data.cat,
          title: data.title,
          start_date: data.start,
          end_date: data.end || null,
          canvas_col: data.cat,
          color: data.color,
          fuzzy_start: data.fuzzyStart,
          fuzzy_end: data.fuzzyEnd,
          note: data.note,
          show_on_resume: data.showOnResume || false,
        })
        setEntries(prev => {
          if (data.id) return prev.map(e => e.id === data.id ? result : e)
          return [...prev, result]
        })
      }
      setEntryModal({ open: false })
    } catch (err) {
      console.error('Failed to save entry:', err)
      alert('Failed to save entry. Check that all required database columns exist.')
    }
  }, [])

  const handleEntryDelete = useCallback(async (id: string) => {
    try {
      const modalSource = entryModal.editing?.source
      if (modalSource === 'work') {
        await deleteWorkEntry(id)
        setWorkEntries(prev => prev.filter(w => w.id !== id))
      } else {
        await deleteEntry(id)
        setEntries(prev => prev.filter(e => e.id !== id))
      }
      setSelectedId(null)
      setEntryModal({ open: false })
    } catch (err) {
      console.error('Failed to delete entry:', err)
    }
  }, [entryModal.editing])

  const openEditModal = useCallback((item: TimelineItem) => {
    // Cancel any active drag to prevent interference with the modal
    dragRef.current = null
    setDragDelta(null)

    if (item.source === 'chronicle') {
      const entry = entries.find(e => e.id === item.id)
      if (!entry) return
      setEntryModal({
        open: true,
        editing: {
          id: entry.id,
          cat: entry.canvas_col || entry.type,
          title: entry.title,
          start: entry.start_date,
          end: entry.end_date || '',
          fuzzyStart: entry.fuzzy_start,
          fuzzyEnd: entry.fuzzy_end,
          note: entry.note || '',
          color: entry.color || DEFAULT_COLORS[entry.canvas_col || entry.type] || '#4070a8',
          showOnResume: entry.show_on_resume || false,
          source: 'chronicle',
        },
      })
    } else if (item.source === 'work') {
      const realId = item.id.replace('work-', '')
      const work = workEntries.find(w => w.id === realId)
      if (!work) return
      const startYM = work.start_date?.slice(0, 7) || ''
      const endYM = work.is_current ? '' : (work.end_date?.slice(0, 7) || '')
      setEntryModal({
        open: true,
        editing: {
          id: realId,
          cat: 'work',
          title: work.title || '',
          company: work.company || '',
          start: startYM,
          end: endYM,
          fuzzyStart: work.chronicle_fuzzy_start || false,
          fuzzyEnd: work.chronicle_fuzzy_end || false,
          note: work.chronicle_note || '',
          color: work.chronicle_color || '#4070a8',
          showOnResume: true,
          source: 'work',
        },
      })
    } else if (item.source === 'education') {
      const realId = item.id.replace('edu-', '')
      const edu = educationEntries.find(e => e.id === realId)
      if (!edu) return
      const startYM = edu.start_date?.slice(0, 7) || ''
      const endYM = edu.is_current ? '' : (edu.end_date?.slice(0, 7) || '')
      setEntryModal({
        open: true,
        editing: {
          id: realId,
          cat: 'education',
          title: edu.institution + (edu.degree ? ` — ${edu.degree}` : ''),
          start: startYM,
          end: endYM,
          fuzzyStart: edu.chronicle_fuzzy_start || false,
          fuzzyEnd: edu.chronicle_fuzzy_end || false,
          note: edu.chronicle_note || (edu.field_of_study || ''),
          color: edu.chronicle_color || '#2a8a6a',
          showOnResume: true,
          source: 'education',
        },
      })
    }
  }, [entries, workEntries, educationEntries])

  // ─── Geo modal handlers ──────────────────────
  const handleGeoSave = useCallback(async (data: GeoFormData) => {
    try {
      const result = await upsertPlace({
        id: data.id || undefined,
        title: data.title,
        start_date: data.start,
        end_date: data.end || null,
        color: data.color,
        fuzzy_start: data.fuzzyStart,
        fuzzy_end: data.fuzzyEnd,
      })
      setPlaces(prev => {
        if (data.id) return prev.map(p => p.id === data.id ? result : p)
        return [...prev, result]
      })
      setGeoModal({ open: false })
    } catch (err) {
      console.error('Failed to save place:', err)
      alert('Failed to save geography entry. Check that the chronicle_places table exists.')
    }
  }, [])

  const handleGeoDelete = useCallback(async (id: string) => {
    try {
      await deletePlace(id)
      setPlaces(prev => prev.filter(p => p.id !== id))
      setGeoModal({ open: false })
    } catch (err) {
      console.error('Failed to delete place:', err)
    }
  }, [])

  // ─── Tooltip helpers ─────────────────────────
  const showTooltip = useCallback((ev: React.MouseEvent, item: TimelineItem | PlaceItem) => {
    if (dragRef.current) return
    const parts = ['title' in item ? item.title : '']
    if ('start' in item) parts.push(item.start + (item.end ? ' – ' + item.end : ''))
    if (item.note) parts.push(item.note)
    setTooltip({ text: parts.join(' · '), x: ev.clientX + 14, y: ev.clientY - 8 })
  }, [])

  const moveTooltip = useCallback((ev: React.MouseEvent) => {
    if (dragRef.current) return
    setTooltip(prev => prev ? { ...prev, x: ev.clientX + 14, y: ev.clientY - 8 } : null)
  }, [])

  const hideTooltip = useCallback(() => {
    if (dragRef.current) return
    setTooltip(null)
  }, [])

  // ─── Compute positions for dragged items ─────
  const getDraggedPosition = useCallback((item: TimelineItem) => {
    if (!dragDelta || dragDelta.id !== item.id || !dragRef.current) return null
    const d = dragRef.current
    const dy = dragDelta.dy
    // Fuzzy drags don't move the block itself
    if (d.type === 'fuzzy_top' || d.type === 'fuzzy_bot') return null
    if (d.type === 'move') return { top: Math.max(0, d.origTop + dy), h: d.origH }
    if (d.type === 'top') return { top: Math.max(0, d.origTop + dy), h: Math.max(pxm, d.origH - dy) }
    return { top: d.origTop, h: Math.max(pxm, d.origH + dy) }
  }, [dragDelta, pxm])

  // Get live fuzzy height during drag
  const getFuzzyH = useCallback((itemId: string, side: 'start' | 'end'): number => {
    const fm = fuzzyMonths[itemId] || { startMonths: 6, endMonths: 6 }
    const baseMonths = side === 'start' ? fm.startMonths : fm.endMonths
    let h = baseMonths * pxm
    // Apply drag delta if actively dragging this fuzzy edge
    if (dragDelta && dragDelta.id === itemId && dragRef.current) {
      const d = dragRef.current
      if (side === 'start' && d.type === 'fuzzy_top') {
        h = Math.max(pxm, (d.origFuzzyH || h) - dragDelta.dy)
      } else if (side === 'end' && d.type === 'fuzzy_bot') {
        h = Math.max(pxm, (d.origFuzzyH || h) + dragDelta.dy)
      }
    }
    return h
  }, [fuzzyMonths, pxm, dragDelta])

  // ─── RENDER ──────────────────────────────────
  if (loading) {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#f0ead8', color: '#9a8e78', fontFamily: "'DM Mono', monospace", fontSize: 12,
      }}>
        Loading chronicle…
      </div>
    )
  }

  const regularItems = timelineItems.filter(i => i.cat !== 'people')
  const peopleItems = timelineItems.filter(i => i.cat === 'people')

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f0ead8', color: '#1a1812', fontFamily: "'DM Mono', monospace", userSelect: 'none' }}>

      {/* ── TOOLBAR ───────────────────────────── */}
      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', borderBottom: '2px solid #1a1812',
        background: '#f6f1e6', zIndex: 60, height: 40,
      }}>
        <div style={{
          padding: '0 14px', borderRight: '1px solid #d8d0c0', height: '100%',
          display: 'flex', alignItems: 'center',
          fontFamily: "'Libre Baskerville', serif", fontStyle: 'italic', fontSize: 12, color: '#5a5040',
        }}>
          chronicle
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '0 14px', borderRight: '1px solid #d8d0c0', height: '100%' }}>
          <label style={{ fontSize: '7.5px', letterSpacing: '.15em', color: '#9a8e78' }}>SCALE</label>
          <div
            id="chr-zoom-track"
            onMouseDown={(e) => { zoomDragRef.current = true; zoomFromTrack(e.clientX); e.preventDefault() }}
            style={{ position: 'relative', width: 110, height: 3, background: '#d8d0c0', borderRadius: 2, cursor: 'pointer' }}
          >
            <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${sliderPos * 100}%`, background: '#9a8e78', borderRadius: 2, pointerEvents: 'none' }} />
            <div style={{
              position: 'absolute', top: '50%', left: `${sliderPos * 100}%`,
              transform: 'translate(-50%,-50%)', width: 12, height: 12, borderRadius: '50%',
              background: '#1a1812', cursor: 'grab', boxShadow: '0 1px 4px rgba(0,0,0,.25)',
            }} />
          </div>
          <span style={{ fontSize: 9, color: '#9a8e78', minWidth: 34 }}>{zoomLabel}</span>
        </div>

        <div style={{ padding: '0 14px', fontSize: '7.5px', color: '#d8d0c0', letterSpacing: '.06em', lineHeight: 1.5 }}>
          dbl-click axis → add geography &nbsp;·&nbsp; dbl-click column → new entry &nbsp;·&nbsp; drag body → move &nbsp;·&nbsp; drag edge → resize &nbsp;·&nbsp; del → delete
        </div>
      </div>

      {/* ── SCROLL CONTAINER ─────────────────── */}
      <div
        ref={scrollRef}
        onClick={handleBackgroundClick}
        style={{ flex: 1, overflowY: 'scroll', overflowX: 'auto', position: 'relative' }}
      >
        {/* ── STICKY COL HEADERS ─────────────── */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 50,
          display: 'flex', borderBottom: '1.5px solid #1a1812', background: '#f6f1e6',
          minWidth: AXIS_W + totalGridW,
        }}>
          <div
            style={{
              width: AXIS_W, flexShrink: 0, borderRight: '2px solid #1a1812',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: 7, letterSpacing: '.15em', color: '#d8d0c0', textTransform: 'uppercase' }}>geography</span>
          </div>
          <div style={{ display: 'flex' }}>
            {COLS.map(col => {
              const isCollapsed = collapsedCols.has(col.id)
              const w = isCollapsed ? COLLAPSED_W : COL_W
              const canAdd = !NO_ADD_COLS.has(col.id)
              return (
                <div
                  key={col.id}
                  onDoubleClick={() => {
                    if (!isCollapsed && canAdd) {
                      setEntryModal({ open: true, editing: null, defaultCat: col.id })
                    }
                  }}
                  style={{
                    flexShrink: 0, width: w, borderRight: '1px solid #d8d0c0',
                    padding: isCollapsed ? '7px 0' : '7px 10px',
                    display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'flex-start',
                    gap: isCollapsed ? 0 : 6, cursor: isCollapsed ? 'default' : (canAdd ? 'pointer' : 'default'),
                    transition: 'width .2s ease',
                    overflow: 'hidden',
                  }}
                >
                  {/* Dot — click to toggle collapse */}
                  <span
                    onClick={(e) => { e.stopPropagation(); toggleCollapse(col.id) }}
                    style={{
                      width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                      background: col.color, cursor: 'pointer',
                      transition: 'transform .15s',
                    }}
                    title={isCollapsed ? `Expand ${col.label}` : `Collapse ${col.label}`}
                  />
                  {!isCollapsed && (
                    <>
                      <span style={{ fontSize: 8, letterSpacing: '.16em', textTransform: 'uppercase', color: '#9a8e78', whiteSpace: 'nowrap' }}>
                        {col.label}
                      </span>
                      {col.private && <LockIcon />}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── CONTENT (axis + grid) ────────────── */}
        <div style={{ display: 'flex', position: 'relative', minWidth: AXIS_W + totalGridW }}>

          {/* ── GEO BANDS (behind everything) ──── */}
          <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
            {placeItems.map(p => {
              const s = parseYM(p.start)
              const en = p.end ? parseYM(p.end) : { y: viewEnd, m: 1 }
              if (!s || !en) return null
              const top = toPx(s, pxm, viewStart)
              const h = toPx(en, pxm, viewStart) - top
              return (
                <div key={`geo-bg-${p.id}`}>
                  <div style={{
                    position: 'absolute', left: 0, right: 0, top, height: h,
                    background: hex2rgba(p.color, 0.08),
                    pointerEvents: 'none',
                  }}>
                    {p.fuzzyStart && (
                      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 24, background: `linear-gradient(to bottom, transparent, ${hex2rgba(p.color, 0.08)})`, pointerEvents: 'none' }} />
                    )}
                    {p.fuzzyEnd && (
                      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 24, background: `linear-gradient(to top, transparent, ${hex2rgba(p.color, 0.08)})`, pointerEvents: 'none' }} />
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── AXIS ─────────────────────────── */}
          <div
            id="chr-axis"
            onDoubleClick={handleAxisDblClick}
            style={{
              width: AXIS_W, flexShrink: 0, borderRight: '2px solid #1a1812',
              position: 'sticky', left: 0, zIndex: 30, background: 'rgba(246,241,230,0.88)',
              height: totalH, cursor: 'crosshair',
            }}
          >
            {axisTicks.map(t => (
              <div key={t.y} style={{ position: 'absolute', right: 0, top: t.top, display: 'flex', alignItems: 'center', transform: 'translateY(-50%)', paddingRight: 7, gap: 3, pointerEvents: 'none' }}>
                <span style={{ fontSize: t.isDecade ? 13 : t.isFive ? 11 : 9.5, color: '#1a1812', letterSpacing: '-.02em', opacity: t.isDecade ? 1 : t.isFive ? 0.8 : 0.6 }}>{t.y}</span>
                <div style={{ position: 'absolute', right: -2, width: t.isFive ? 8 : 5, height: t.isFive ? 1 : 1.5, background: t.isFive ? '#9a8e78' : '#1a1812' }} />
              </div>
            ))}

            {/* Geo place labels in axis */}
            {placeItems.map(p => {
              const s = parseYM(p.start)
              const en = p.end ? parseYM(p.end) : { y: viewEnd, m: 1 }
              if (!s || !en) return null
              const top = toPx(s, pxm, viewStart)
              const h = toPx(en, pxm, viewStart) - top
              if (h < pxm * 2) return null
              return (
                <div key={`geo-lbl-${p.id}`} style={{
                  position: 'absolute', left: 4, top: top + 4,
                  fontSize: Math.max(5.5, Math.min(7, pxm * 0.25)), letterSpacing: '.10em',
                  textTransform: 'uppercase', fontStyle: 'italic', color: p.color,
                  pointerEvents: 'none', zIndex: 3, opacity: 0.35, maxWidth: AXIS_W - 12,
                  overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                }}>
                  {p.title}
                </div>
              )
            })}
          </div>

          {/* ── GRID ─────────────────────────── */}
          <div
            id="chr-grid"
            onDoubleClick={handleGridDblClick}
            style={{ flex: 1, position: 'relative', height: totalH, width: totalGridW }}
          >
            {/* Year rules */}
            {yearRules.map(r => (
              <div key={`yr-${r.y}`} style={{
                position: 'absolute', left: 0, right: 0, top: r.top,
                height: r.isDecade ? 2 : 1, background: `rgba(0,0,0,${r.isDecade ? 0.18 : 0.1})`,
                pointerEvents: 'none', zIndex: 2,
              }} />
            ))}

            {/* Month rules */}
            {monthRules.map((r, i) => (
              <div key={`mo-${i}`} style={{
                position: 'absolute', left: 0, right: 0, top: r.top,
                height: 1, background: 'rgba(0,0,0,.04)',
                pointerEvents: 'none', zIndex: 2,
              }} />
            ))}

            {/* Column dividers (collapse-aware) */}
            {colDividers.map((d, i) => (
              <div key={`col-${i}`} style={{
                position: 'absolute', top: 0, bottom: 0, left: d.left,
                width: 1, background: 'rgba(0,0,0,.07)',
                pointerEvents: 'none', zIndex: 2,
              }} />
            ))}

            {/* Today line */}
            <div style={{
              position: 'absolute', left: 0, right: 0, top: todayTop,
              height: 2, background: '#c84030', zIndex: 18, pointerEvents: 'none',
            }}>
              <span style={{ position: 'absolute', right: 4, top: -9, fontSize: 7, letterSpacing: '.14em', color: '#c84030' }}>TODAY</span>
            </div>

            {/* ── PLACE BANDS (interactive) ─────── */}
            {placeItems.map(p => {
              const s = parseYM(p.start)
              const en = p.end ? parseYM(p.end) : { y: viewEnd, m: 1 }
              if (!s || !en) return null
              const top = toPx(s, pxm, viewStart)
              const h = toPx(en, pxm, viewStart) - top

              return (
                <div key={p.id}>
                  <div
                    onDoubleClick={() => setGeoModal({
                      open: true,
                      editing: { id: p.id, title: p.title, start: p.start, end: p.end || '', fuzzyStart: p.fuzzyStart, fuzzyEnd: p.fuzzyEnd, color: p.color },
                    })}
                    style={{
                      position: 'absolute', left: 0, right: 0, top, height: h,
                      background: hex2rgba(p.color, 0.12),
                      borderTop: !p.fuzzyStart ? `1.5px solid ${hex2rgba(p.color, 0.25)}` : undefined,
                      borderBottom: !p.fuzzyEnd ? `1.5px solid ${hex2rgba(p.color, 0.25)}` : undefined,
                      pointerEvents: 'auto', zIndex: 1, cursor: 'pointer',
                    }}
                  >
                    {p.fuzzyStart && (
                      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 24, background: `linear-gradient(to bottom, transparent, ${hex2rgba(p.color, 0.12)})`, pointerEvents: 'none' }} />
                    )}
                    {p.fuzzyEnd && (
                      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 24, background: `linear-gradient(to top, transparent, ${hex2rgba(p.color, 0.12)})`, pointerEvents: 'none' }} />
                    )}
                  </div>
                </div>
              )
            })}

            {/* ── PEOPLE ─────────────────────────── */}
            {!collapsedCols.has('people') && peopleItems.map(item => {
              const s = parseYM(item.start)
              if (!s) return null
              const top = toPx(s, pxm, viewStart)
              const dotH = Math.max(14, pxm * 0.9)
              const left = getColLeft('people', collapsedCols)
              const tailEnd = { y: viewEnd, m: 1 }
              const tailH = toPx(tailEnd, pxm, viewStart) - top - dotH / 2

              return (
                <div
                  key={item.id}
                  data-person="true"
                  onClick={(e) => { e.stopPropagation(); selectEntry(item.id) }}
                  onDoubleClick={(e) => { e.stopPropagation(); openEditModal(item) }}
                  onMouseEnter={(e) => showTooltip(e, item)}
                  onMouseMove={moveTooltip}
                  onMouseLeave={hideTooltip}
                  style={{
                    position: 'absolute', top, left, width: COL_W, height: dotH,
                    zIndex: 12, cursor: 'default', display: 'flex', alignItems: 'center',
                  }}
                >
                  <div style={{
                    width: 8, height: 8, flexShrink: 0, marginLeft: 6, borderRadius: 2,
                    ...(item.fuzzyStart
                      ? { background: 'transparent', border: `2px dashed ${item.color}`, boxSizing: 'border-box' as const }
                      : { background: item.color }),
                    ...(selectedId === item.id ? { outline: '2px solid #1a1812', outlineOffset: 2 } : {}),
                  }} />
                  <div style={{ fontSize: 8, marginLeft: 7, whiteSpace: 'nowrap', letterSpacing: '.02em', color: item.color }}>
                    {item.title}
                  </div>
                  {!item.end && tailH > 0 && (
                    <div style={{
                      position: 'absolute', left: 10, top: dotH / 2, width: 2,
                      height: tailH, background: item.color, opacity: 0.18, pointerEvents: 'none',
                    }} />
                  )}
                </div>
              )
            })}

            {/* ── ENTRIES ────────────────────── */}
            {regularItems.map(item => {
              // Skip entries in collapsed columns
              if (collapsedCols.has(item.cat)) return null

              const s = parseYM(item.start)
              const en = item.end ? parseYM(item.end) : null
              if (!s) return null

              const dragged = getDraggedPosition(item)
              let top: number, h: number
              if (dragged) {
                top = dragged.top
                h = dragged.h
              } else {
                top = toPx(s, pxm, viewStart)
                h = en ? Math.max(Math.round(pxm), toPx(en, pxm, viewStart) - top) : Math.round(pxm * 2)
              }
              const colW = collapsedCols.has(item.cat) ? COLLAPSED_W : COL_W
              const left = getColLeft(item.cat, collapsedCols) + 3
              const w = colW - 7
              const showDate = h > Math.round(pxm * 1.2)
              const isSelected = selectedId === item.id

              // Fuzzy fade zone dimensions
              const fuzzyStartH = item.fuzzyStart ? getFuzzyH(item.id, 'start') : 0
              const fuzzyEndH = item.fuzzyEnd ? getFuzzyH(item.id, 'end') : 0

              return (
                <div
                  key={item.id}
                  data-entry="true"
                  style={{
                    position: 'absolute',
                    top: top - fuzzyStartH,
                    left,
                    width: w,
                    height: h + fuzzyStartH + fuzzyEndH,
                    overflow: 'visible',
                    zIndex: 10,
                    cursor: 'default',
                  }}
                >
                  {/* ── Fuzzy start zone (above block) ── */}
                  {item.fuzzyStart && fuzzyStartH > 0 && (
                    <div
                      style={{
                        position: 'absolute', left: 0, right: 0,
                        top: 0, height: fuzzyStartH,
                        borderRadius: '3px 3px 0 0',
                        overflow: 'hidden',
                      }}
                    >
                      <div style={{
                        position: 'absolute', inset: 0,
                        background: `linear-gradient(to bottom, transparent, ${hex2rgba(item.color, 0.17)})`,
                        borderLeft: `1px dashed ${hex2rgba(item.color, 0.35)}`,
                        borderRight: `1px dashed ${hex2rgba(item.color, 0.35)}`,
                        borderTop: `1px dashed ${hex2rgba(item.color, 0.35)}`,
                      }} />
                      {/* Drag handle at outer edge */}
                      <div
                        onMouseDown={(e) => startFuzzyDrag(e, item, 'fuzzy_top')}
                        style={{
                          position: 'absolute', left: 0, right: 0, height: 10, top: -5,
                          zIndex: 16, cursor: 'ns-resize',
                        }}
                      >
                        <div style={{
                          position: 'absolute', left: '50%', top: '50%',
                          transform: 'translate(-50%,-50%)',
                          width: 18, height: 2, borderRadius: 2,
                          background: hex2rgba(item.color, 0.5),
                        }} />
                      </div>
                    </div>
                  )}

                  {/* ── Main body ── */}
                  <div
                    onMouseDown={(e) => startDrag(e, item, 'move')}
                    onClick={(e) => { e.stopPropagation(); selectEntry(item.id) }}
                    onDoubleClick={(e) => { e.stopPropagation(); openEditModal(item) }}
                    onMouseEnter={(e) => showTooltip(e, item)}
                    onMouseMove={moveTooltip}
                    onMouseLeave={hideTooltip}
                    style={{
                      position: 'absolute', left: 0, right: 0,
                      top: fuzzyStartH, height: h,
                      borderRadius: item.fuzzyStart && item.fuzzyEnd ? 0
                        : item.fuzzyStart ? '0 0 3px 3px'
                        : item.fuzzyEnd ? '3px 3px 0 0'
                        : 3,
                      padding: '4px 7px', overflow: 'hidden',
                      background: hex2rgba(item.color, 0.17),
                      border: `1px solid ${hex2rgba(item.color, 0.48)}`,
                      ...(isSelected ? { outline: '2px solid #1a1812', outlineOffset: 1 } : {}),
                    }}
                  >
                    <div style={{
                      fontSize: Math.max(6, Math.min(8.5, pxm * 0.35)),
                      fontWeight: 500, letterSpacing: '.03em', lineHeight: 1.3,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      color: item.color,
                    }}>
                      {item.title}
                    </div>
                    {showDate && (
                      <div style={{ fontSize: '6.5px', opacity: 0.55, letterSpacing: '.05em', marginTop: 2 }}>
                        {item.start}{item.end ? ' – ' + item.end : ''}
                      </div>
                    )}
                  </div>

                  {/* ── Fuzzy end zone (below block) ── */}
                  {item.fuzzyEnd && fuzzyEndH > 0 && (
                    <div
                      style={{
                        position: 'absolute', left: 0, right: 0,
                        top: fuzzyStartH + h, height: fuzzyEndH,
                        borderRadius: '0 0 3px 3px',
                        overflow: 'hidden',
                      }}
                    >
                      <div style={{
                        position: 'absolute', inset: 0,
                        background: `linear-gradient(to top, transparent, ${hex2rgba(item.color, 0.17)})`,
                        borderLeft: `1px dashed ${hex2rgba(item.color, 0.35)}`,
                        borderRight: `1px dashed ${hex2rgba(item.color, 0.35)}`,
                        borderBottom: `1px dashed ${hex2rgba(item.color, 0.35)}`,
                      }} />
                      {/* Drag handle at outer edge */}
                      <div
                        onMouseDown={(e) => startFuzzyDrag(e, item, 'fuzzy_bot')}
                        style={{
                          position: 'absolute', left: 0, right: 0, height: 10, bottom: -5,
                          zIndex: 16, cursor: 'ns-resize',
                        }}
                      >
                        <div style={{
                          position: 'absolute', left: '50%', top: '50%',
                          transform: 'translate(-50%,-50%)',
                          width: 18, height: 2, borderRadius: 2,
                          background: hex2rgba(item.color, 0.5),
                        }} />
                      </div>
                    </div>
                  )}

                  {/* Resize handles (on the block's true edges) */}
                  <div
                    onMouseDown={(e) => startDrag(e, item, 'top')}
                    style={{
                      position: 'absolute', left: 0, right: 0, height: 8,
                      top: fuzzyStartH - 4,
                      zIndex: 15, cursor: 'ns-resize', opacity: isSelected ? 1 : 0,
                      transition: 'opacity .15s',
                    }}
                  >
                    <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 24, height: 3, borderRadius: 2, background: 'rgba(0,0,0,.28)' }} />
                  </div>
                  <div
                    onMouseDown={(e) => startDrag(e, item, 'bot')}
                    style={{
                      position: 'absolute', left: 0, right: 0, height: 8,
                      top: fuzzyStartH + h - 4,
                      zIndex: 15, cursor: 'ns-resize', opacity: isSelected ? 1 : 0,
                      transition: 'opacity .15s',
                    }}
                  >
                    <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 24, height: 3, borderRadius: 2, background: 'rgba(0,0,0,.28)' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── TOOLTIP ──────────────────────────── */}
      {tooltip && (
        <div style={{
          position: 'fixed', left: tooltip.x, top: tooltip.y,
          background: '#1a1812', color: '#f6f1e6', padding: '5px 10px',
          borderRadius: 3, fontSize: 9, letterSpacing: '.04em',
          pointerEvents: 'none', zIndex: 400, maxWidth: 280, lineHeight: 1.6,
        }}>
          {tooltip.text}
        </div>
      )}

      {/* ── DELETE HINT ──────────────────────── */}
      <div style={{
        position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
        background: '#1a1812', color: '#f6f1e6', padding: '5px 14px',
        borderRadius: 20, fontSize: 8, letterSpacing: '.1em',
        opacity: showDelHint ? 1 : 0, pointerEvents: 'none',
        transition: 'opacity .2s', zIndex: 300,
      }}>
        DEL to delete selected
      </div>

      {/* ── MODALS ───────────────────────────── */}
      <ChronicleModal
        open={entryModal.open}
        editingEntry={entryModal.editing}
        defaultCat={entryModal.defaultCat}
        defaultYM={entryModal.defaultYM}
        defaultEndYM={entryModal.defaultEndYM}
        onSave={handleEntrySave}
        onDelete={handleEntryDelete}
        onClose={() => setEntryModal({ open: false })}
      />
      <ChronicleGeoModal
        open={geoModal.open}
        editingPlace={geoModal.editing}
        defaultYM={geoModal.defaultYM}
        onSave={handleGeoSave}
        onDelete={handleGeoDelete}
        onClose={() => setGeoModal({ open: false })}
      />
    </div>
  )
}
