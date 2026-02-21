'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  loadChronicleData, upsertEntry, deleteEntry, upsertPlace, deletePlace,
  updateEntryDates, updateWorkEntryFromChronicle, deleteWorkEntry,
  type ChronicleEntry, type ChroniclePlace, type ChronicleWorkEntry, type ChronicleContact,
} from '@/lib/chronicle'
import ChronicleModal, { type EntryFormData } from './ChronicleModal'
import ChronicleGeoModal, { type GeoFormData } from './ChronicleGeoModal'

// ═══════════════════════════════════════════════
// CONFIG — matches HTML prototype exactly
// ═══════════════════════════════════════════════
const START_YEAR = 1975
const END_YEAR = 2032
const BIRTH_YEAR = 1963
const BASE_PXM = 28
const ZOOM_MIN = 0.08
const ZOOM_MAX = 3.0
const COL_W = 148
const AXIS_W = 72

const COLS = [
  { id: 'work', label: 'Work', color: '#4070a8' },
  { id: 'project', label: 'Projects', color: '#508038' },
  { id: 'personal', label: 'Personal', color: '#a85060' },
  { id: 'residence', label: 'Residences', color: '#806840' },
  { id: 'tech', label: 'Tech', color: '#986020' },
  { id: 'people', label: 'People', color: '#7050a8' },
]

const DEFAULT_COLORS: Record<string, string> = {
  work: '#4070a8', project: '#508038', personal: '#a85060',
  residence: '#806840', tech: '#986020', people: '#7050a8',
}

// ═══════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════
interface YM { y: number; m: number }

function parseYM(s: string | null | undefined): YM | null {
  if (!s) return null
  const p = s.split('-')
  return { y: +p[0], m: +(p[1] || 1) }
}

function toMo(ym: YM): number {
  return (ym.y - START_YEAR) * 12 + (ym.m - 1)
}

function toPx(ym: YM, pxm: number): number {
  return toMo(ym) * pxm
}

function pxToYM(px: number, pxm: number): YM {
  const mo = Math.round(px / pxm)
  return { y: START_YEAR + Math.floor(mo / 12), m: (mo % 12) + 1 }
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

function colLeft(colId: string): number {
  return COLS.findIndex(c => c.id === colId) * COL_W
}

// Unified timeline item — entries, work_entries, and contacts all become these
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
  source: 'chronicle' | 'work' | 'contact'
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
  const [loading, setLoading] = useState(true)

  // View
  const [scale, setScale] = useState(1.0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showDelHint, setShowDelHint] = useState(false)

  // Tooltip
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null)

  // Drag
  const dragRef = useRef<{
    type: 'move' | 'top' | 'bot'
    id: string
    source: 'chronicle' | 'work' | 'contact'
    startY: number
    origTop: number
    origH: number
  } | null>(null)
  const [dragDelta, setDragDelta] = useState<{ id: string; dy: number } | null>(null)

  // Modals
  const [entryModal, setEntryModal] = useState<{
    open: boolean
    editing?: EntryFormData | null
    defaultCat?: string
    defaultYM?: string
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

  const pxm = BASE_PXM * scale
  const totalH = (END_YEAR - START_YEAR) * 12 * pxm

  // ─── Load data on mount ──────────────────────
  useEffect(() => {
    loadChronicleData()
      .then(data => {
        setEntries(data.entries)
        setPlaces(data.places)
        setWorkEntries(data.workEntries)
        setContacts(data.contacts)
      })
      .catch(err => console.error('Failed to load chronicle data:', err))
      .finally(() => setLoading(false))
  }, [])

  // ─── Scroll to ~1981 on first load ──────────
  useEffect(() => {
    if (!loading && scrollRef.current) {
      scrollRef.current.scrollTop = toPx({ y: 1981, m: 1 }, pxm) - 60
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  // ─── Build unified timeline items ────────────
  const timelineItems = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = []

    // Chronicle entries
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

    // Work entries → "work" column
    workEntries.forEach(w => {
      items.push({
        id: `work-${w.id}`,
        cat: 'work',
        title: w.company || w.title,
        start: w.start_date,
        end: w.is_current ? null : (w.end_date || null),
        color: w.chronicle_color || '#4070a8',
        fuzzyStart: w.chronicle_fuzzy_start || false,
        fuzzyEnd: w.chronicle_fuzzy_end || false,
        note: w.chronicle_note || '',
        source: 'work',
      })
    })

    // Contacts → "people" column
    contacts.forEach(c => {
      items.push({
        id: `contact-${c.id}`,
        cat: 'people',
        title: c.full_name,
        start: c.created_at?.slice(0, 7) || '2020-01',
        end: null,
        color: c.chronicle_color || '#7050a8',
        fuzzyStart: c.chronicle_fuzzy_start || false,
        fuzzyEnd: c.chronicle_fuzzy_end || false,
        note: c.chronicle_note || (c.company ? `${c.role || ''} ${c.company}`.trim() : ''),
        source: 'contact',
      })
    })

    return items
  }, [entries, workEntries, contacts])

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
    const ticks: { y: number; top: number; age: number; isDecade: boolean; isFive: boolean }[] = []
    const showEvery = pxm < 4 ? 10 : pxm < 8 ? 5 : 1
    for (let y = START_YEAR; y <= END_YEAR; y++) {
      if ((y - START_YEAR) % showEvery !== 0) continue
      ticks.push({
        y,
        top: toPx({ y, m: 1 }, pxm),
        age: y - BIRTH_YEAR,
        isDecade: y % 10 === 0,
        isFive: y % 5 === 0,
      })
    }
    return ticks
  }, [pxm])

  // ─── Year grid lines ────────────────────────
  const yearRules = useMemo(() => {
    const rules: { y: number; top: number; isDecade: boolean }[] = []
    for (let y = START_YEAR; y <= END_YEAR; y++) {
      rules.push({ y, top: toPx({ y, m: 1 }, pxm), isDecade: y % 10 === 0 })
    }
    return rules
  }, [pxm])

  // ─── Month grid lines (only when zoomed in enough) ─
  const monthRules = useMemo(() => {
    if (pxm < 10) return []
    const rules: { top: number }[] = []
    for (let y = START_YEAR; y <= END_YEAR; y++) {
      for (let m = 2; m <= 12; m++) {
        rules.push({ top: toPx({ y, m }, pxm) })
      }
    }
    return rules
  }, [pxm])

  // ─── Today line ──────────────────────────────
  const todayTop = useMemo(() => {
    const now = new Date()
    return toPx({ y: now.getFullYear(), m: now.getMonth() + 1 }, pxm)
  }, [pxm])

  // ─── Selection ───────────────────────────────
  const selectEntry = useCallback((id: string | null) => {
    setSelectedId(id)
    if (id) {
      setShowDelHint(true)
      setTimeout(() => setShowDelHint(false), 2000)
    }
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
        setSelectedId(null)
        setEntryModal({ open: false })
        setGeoModal({ open: false })
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [selectedId, timelineItems])

  // ─── Drag handlers ──────────────────────────
  const startDrag = useCallback((ev: React.MouseEvent, item: TimelineItem, type: 'move' | 'top' | 'bot') => {
    if (ev.button !== 0) return
    selectEntry(item.id)
    const s = parseYM(item.start)
    const e = item.end ? parseYM(item.end) : null
    if (!s) return
    const top = toPx(s, pxm)
    const h = e ? Math.max(Math.round(pxm), toPx(e, pxm) - top) : Math.round(pxm * 2)
    dragRef.current = { type, id: item.id, source: item.source, startY: ev.clientY, origTop: top, origH: h }
    ev.preventDefault()
    ev.stopPropagation()
  }, [pxm, selectEntry])

  useEffect(() => {
    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const dy = ev.clientY - dragRef.current.startY
      setDragDelta({ id: dragRef.current.id, dy })

      // Show tooltip
      const d = dragRef.current
      let showTop: number
      if (d.type === 'move') showTop = Math.max(0, d.origTop + dy)
      else if (d.type === 'top') showTop = Math.max(0, d.origTop + dy)
      else showTop = d.origTop + Math.max(pxm, d.origH + dy)
      setTooltip({ text: fmtYM(pxToYM(showTop, pxm)), x: ev.clientX + 14, y: ev.clientY - 8 })
    }

    const handleMouseUp = () => {
      if (!dragRef.current) return
      const d = dragRef.current
      const dy = dragDelta?.dy ?? 0

      // Snap to month
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

      const ns = pxToYM(newTop, pxm)
      const ne = pxToYM(newTop + newH, pxm)
      const newStart = ymStr(ns)
      const newEnd = ymStr(ne)

      // Update local state + persist based on source
      if (d.source === 'work') {
        const realId = d.id.replace('work-', '')
        setWorkEntries(prev => prev.map(w =>
          w.id === realId ? { ...w, start_date: newStart + '-01', end_date: newEnd + '-01', is_current: false } : w
        ))
        updateWorkEntryFromChronicle(realId, { start_date: newStart + '-01', end_date: newEnd + '-01', is_current: false }).catch(console.error)
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
  }, [pxm, dragDelta])

  // ─── Zoom ────────────────────────────────────
  const applyZoom = useCallback((newScale: number) => {
    const sw = scrollRef.current
    if (!sw) return
    const centerPx = sw.scrollTop + sw.clientHeight / 2
    const centerYM = pxToYM(centerPx, pxm)
    const clamped = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newScale))
    setScale(clamped)
    // After state update, re-center
    requestAnimationFrame(() => {
      const newPxm = BASE_PXM * clamped
      sw.scrollTop = toPx(centerYM, newPxm) - sw.clientHeight / 2
    })
  }, [pxm])

  const zoomPct = (scale - ZOOM_MIN) / (ZOOM_MAX - ZOOM_MIN)
  const zoomLabel = scale >= 1
    ? scale.toFixed(1).replace(/\.0$/, '') + '×'
    : (scale * 100).toFixed(0) + '%'

  // Zoom track interaction
  const zoomFromTrack = useCallback((clientX: number) => {
    const el = document.getElementById('chr-zoom-track')
    if (!el) return
    const rect = el.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    applyZoom(ZOOM_MIN + pct * (ZOOM_MAX - ZOOM_MIN))
  }, [applyZoom])

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

  // ─── Click on empty space deselects ──────────
  const handleBackgroundClick = useCallback((ev: React.MouseEvent) => {
    if (!(ev.target as HTMLElement).closest('[data-entry],[data-person]')) {
      setSelectedId(null)
    }
  }, [])

  // ─── Double-click grid → new entry ──────────
  const handleGridDblClick = useCallback((ev: React.MouseEvent) => {
    const gridEl = document.getElementById('chr-grid')
    if (!gridEl) return
    const rect = gridEl.getBoundingClientRect()
    const relX = ev.clientX - rect.left
    const relY = ev.clientY - rect.top + (scrollRef.current?.scrollTop || 0)
    const colIdx = Math.floor(relX / COL_W)
    if (colIdx < 0 || colIdx >= COLS.length) return
    const ym = pxToYM(relY, pxm)
    setEntryModal({
      open: true,
      editing: null,
      defaultCat: COLS[colIdx].id,
      defaultYM: ymStr(ym),
    })
  }, [pxm])

  // ─── Axis click → geo modal ──────────────────
  const handleAxisClick = useCallback((ev: React.MouseEvent) => {
    const axisEl = document.getElementById('chr-axis')
    if (!axisEl) return
    const rect = axisEl.getBoundingClientRect()
    const relY = ev.clientY - rect.top + (scrollRef.current?.scrollTop || 0)
    const ym = pxToYM(relY, pxm)

    // Check if clicking existing place
    const hit = placeItems.find(p => {
      const s = parseYM(p.start)
      const en = p.end ? parseYM(p.end) : { y: END_YEAR, m: 1 }
      if (!s || !en) return false
      return toMo(ym) >= toMo(s) && toMo(ym) < toMo(en)
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
  }, [pxm, placeItems])

  // ─── Entry modal handlers ────────────────────
  const handleEntrySave = useCallback(async (data: EntryFormData) => {
    try {
      if (data.source === 'work' && data.id) {
        // Update work_entries table
        await updateWorkEntryFromChronicle(data.id, {
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
          start_date: data.start ? data.start + '-01' : w.start_date,
          end_date: data.end ? data.end + '-01' : undefined,
          is_current: !data.end,
          chronicle_color: data.color,
          chronicle_fuzzy_start: data.fuzzyStart,
          chronicle_fuzzy_end: data.fuzzyEnd,
          chronicle_note: data.note,
        } : w))
      } else {
        // Chronicle entry
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
    }
  }, [])

  const handleEntryDelete = useCallback(async (id: string) => {
    try {
      // Check if this is a work entry
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
      // Convert YYYY-MM-DD to YYYY-MM for the modal
      const startYM = work.start_date?.slice(0, 7) || ''
      const endYM = work.is_current ? '' : (work.end_date?.slice(0, 7) || '')
      setEntryModal({
        open: true,
        editing: {
          id: realId,
          cat: 'work',
          title: work.company || work.title,
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
    }
  }, [entries, workEntries])

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
        show_on_resume: false,
      })
      setPlaces(prev => {
        if (data.id) return prev.map(p => p.id === data.id ? result : p)
        return [...prev, result]
      })
      setGeoModal({ open: false })
    } catch (err) {
      console.error('Failed to save place:', err)
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
    if (d.type === 'move') return { top: Math.max(0, d.origTop + dy), h: d.origH }
    if (d.type === 'top') return { top: Math.max(0, d.origTop + dy), h: Math.max(pxm, d.origH - dy) }
    return { top: d.origTop, h: Math.max(pxm, d.origH + dy) }
  }, [dragDelta, pxm])

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
            <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${zoomPct * 100}%`, background: '#9a8e78', borderRadius: 2, pointerEvents: 'none' }} />
            <div style={{
              position: 'absolute', top: '50%', left: `${zoomPct * 100}%`,
              transform: 'translate(-50%,-50%)', width: 12, height: 12, borderRadius: '50%',
              background: '#1a1812', cursor: 'grab', boxShadow: '0 1px 4px rgba(0,0,0,.25)',
            }} />
          </div>
          <span style={{ fontSize: 9, color: '#9a8e78', minWidth: 34 }}>{zoomLabel}</span>
        </div>

        <div style={{ padding: '0 14px', fontSize: '7.5px', color: '#d8d0c0', letterSpacing: '.06em', lineHeight: 1.5 }}>
          click year axis → add geography &nbsp;·&nbsp; dbl-click column → new entry &nbsp;·&nbsp; drag body → move &nbsp;·&nbsp; drag edge → resize &nbsp;·&nbsp; del → delete
        </div>
      </div>

      {/* ── COL HEADERS ──────────────────────── */}
      <div style={{ flexShrink: 0, display: 'flex', borderBottom: '1.5px solid #1a1812', background: '#f6f1e6', zIndex: 50 }}>
        <div style={{ width: AXIS_W, flexShrink: 0, borderRight: '2px solid #1a1812', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 7, letterSpacing: '.15em', color: '#d8d0c0', textTransform: 'uppercase' }}>geography</span>
        </div>
        <div style={{ display: 'flex' }}>
          {COLS.map(col => (
            <div
              key={col.id}
              onDoubleClick={() => setEntryModal({ open: true, editing: null, defaultCat: col.id })}
              style={{
                flexShrink: 0, width: COL_W, borderRight: '1px solid #d8d0c0',
                padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: col.color }} />
              <span style={{ fontSize: 8, letterSpacing: '.16em', textTransform: 'uppercase', color: '#9a8e78' }}>{col.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── SCROLL CONTAINER ─────────────────── */}
      <div
        ref={scrollRef}
        onClick={handleBackgroundClick}
        style={{ flex: 1, overflowY: 'scroll', overflowX: 'auto', position: 'relative' }}
      >
        <div style={{ display: 'flex', position: 'relative', minWidth: AXIS_W + COLS.length * COL_W }}>

          {/* ── AXIS ─────────────────────────── */}
          <div
            id="chr-axis"
            onClick={handleAxisClick}
            style={{
              width: AXIS_W, flexShrink: 0, borderRight: '2px solid #1a1812',
              position: 'sticky', left: 0, zIndex: 30, background: '#f6f1e6',
              height: totalH, cursor: 'crosshair',
            }}
          >
            {axisTicks.map(t => (
              <div key={t.y} style={{ position: 'absolute', right: 0, top: t.top, display: 'flex', alignItems: 'center', transform: 'translateY(-50%)', paddingRight: 7, gap: 3, pointerEvents: 'none' }}>
                <span style={{ fontSize: t.isDecade ? 13 : t.isFive ? 11 : 9.5, color: '#1a1812', letterSpacing: '-.02em', opacity: t.isDecade ? 1 : t.isFive ? 0.8 : 0.6 }}>{t.y}</span>
                {t.age > 0 && <span style={{ fontSize: 7, color: '#d8d0c0' }}>{t.age}</span>}
                <div style={{ position: 'absolute', right: -2, width: t.isFive ? 8 : 5, height: t.isFive ? 1 : 1.5, background: t.isFive ? '#9a8e78' : '#1a1812' }} />
              </div>
            ))}
          </div>

          {/* ── GRID ─────────────────────────── */}
          <div
            id="chr-grid"
            onDoubleClick={handleGridDblClick}
            style={{ flex: 1, position: 'relative', height: totalH, width: COLS.length * COL_W }}
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

            {/* Column rules */}
            {COLS.map((_, i) => i > 0 && (
              <div key={`col-${i}`} style={{
                position: 'absolute', top: 0, bottom: 0, left: i * COL_W,
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

            {/* ── PLACE BANDS ────────────────── */}
            {placeItems.map(p => {
              const s = parseYM(p.start)
              const en = p.end ? parseYM(p.end) : { y: END_YEAR, m: 1 }
              if (!s || !en) return null
              const top = toPx(s, pxm)
              const h = toPx(en, pxm) - top

              return (
                <div key={p.id}>
                  <div
                    onDoubleClick={() => setGeoModal({
                      open: true,
                      editing: { id: p.id, title: p.title, start: p.start, end: p.end || '', fuzzyStart: p.fuzzyStart, fuzzyEnd: p.fuzzyEnd, color: p.color },
                    })}
                    style={{
                      position: 'absolute', left: 0, right: 0, top, height: h,
                      background: hex2rgba(p.color, 0.2),
                      borderTop: !p.fuzzyStart ? `1.5px solid ${hex2rgba(p.color, 0.35)}` : undefined,
                      pointerEvents: 'auto', zIndex: 1, cursor: 'pointer',
                    }}
                  >
                    {p.fuzzyStart && (
                      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 20, background: `linear-gradient(to bottom, transparent, ${hex2rgba(p.color, 0.2)})`, pointerEvents: 'none' }} />
                    )}
                    {p.fuzzyEnd && (
                      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 20, background: `linear-gradient(to top, transparent, ${hex2rgba(p.color, 0.2)})`, pointerEvents: 'none' }} />
                    )}
                  </div>
                  {h > pxm * 2 && (
                    <div style={{
                      position: 'absolute', left: 6, top: top + 6,
                      fontSize: Math.max(6, Math.min(8, pxm * 0.3)), letterSpacing: '.12em',
                      textTransform: 'uppercase', fontStyle: 'italic', color: p.color,
                      pointerEvents: 'none', zIndex: 3, opacity: 0.4,
                    }}>
                      {p.title}
                    </div>
                  )}
                </div>
              )
            })}

            {/* ── PEOPLE (dots + tails) ──────── */}
            {peopleItems.map(item => {
              const s = parseYM(item.start)
              if (!s) return null
              const top = toPx(s, pxm)
              const dotH = Math.max(14, pxm * 0.9)
              const left = colLeft('people')
              const tailEnd = { y: END_YEAR, m: 1 }
              const tailH = toPx(tailEnd, pxm) - top - dotH / 2

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
                  {/* Dot */}
                  <div style={{
                    width: 9, height: 9, borderRadius: '50%', flexShrink: 0, marginLeft: 6,
                    ...(item.fuzzyStart
                      ? { background: 'transparent', border: `2px dashed ${item.color}`, boxSizing: 'border-box' as const }
                      : { background: item.color }),
                    ...(selectedId === item.id ? { outline: `2px solid #1a1812`, outlineOffset: 2 } : {}),
                  }} />
                  {/* Label */}
                  <div style={{ fontSize: 8, marginLeft: 7, whiteSpace: 'nowrap', letterSpacing: '.02em', color: item.color }}>
                    {item.title}
                  </div>
                  {/* Tail */}
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
              const s = parseYM(item.start)
              const en = item.end ? parseYM(item.end) : null
              if (!s) return null

              const dragged = getDraggedPosition(item)
              let top: number, h: number
              if (dragged) {
                top = dragged.top
                h = dragged.h
              } else {
                top = toPx(s, pxm)
                h = en ? Math.max(Math.round(pxm), toPx(en, pxm) - top) : Math.round(pxm * 2)
              }
              const left = colLeft(item.cat) + 3
              const w = COL_W - 7
              const showDate = h > Math.round(pxm * 1.2)
              const isSelected = selectedId === item.id

              return (
                <div
                  key={item.id}
                  data-entry="true"
                  style={{ position: 'absolute', top, left, width: w, height: h, borderRadius: 3, overflow: 'visible', zIndex: 10, cursor: 'default' }}
                >
                  {/* Body */}
                  <div
                    onMouseDown={(e) => startDrag(e, item, 'move')}
                    onClick={(e) => { e.stopPropagation(); selectEntry(item.id) }}
                    onDoubleClick={(e) => { e.stopPropagation(); openEditModal(item) }}
                    onMouseEnter={(e) => showTooltip(e, item)}
                    onMouseMove={moveTooltip}
                    onMouseLeave={hideTooltip}
                    style={{
                      position: 'absolute', inset: 0, borderRadius: 3, padding: '4px 7px', overflow: 'hidden',
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

                    {/* Fuzzy overlays */}
                    {item.fuzzyStart && (
                      <div style={{
                        position: 'absolute', left: 0, right: 0, top: 0, height: 12,
                        borderRadius: '3px 3px 0 0', pointerEvents: 'none', zIndex: 5,
                        background: `linear-gradient(to bottom, ${hex2rgba(item.color, 0.22)}, transparent)`,
                      }} />
                    )}
                    {item.fuzzyEnd && (
                      <div style={{
                        position: 'absolute', left: 0, right: 0, bottom: 0, height: 12,
                        borderRadius: '0 0 3px 3px', pointerEvents: 'none', zIndex: 5,
                        background: `linear-gradient(to top, ${hex2rgba(item.color, 0.22)}, transparent)`,
                      }} />
                    )}
                  </div>

                  {/* Resize handles */}
                  <div
                    onMouseDown={(e) => startDrag(e, item, 'top')}
                    style={{
                      position: 'absolute', left: 0, right: 0, height: 8, top: -4,
                      zIndex: 15, cursor: 'ns-resize', opacity: isSelected ? 1 : 0,
                      transition: 'opacity .15s',
                    }}
                  >
                    <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 24, height: 3, borderRadius: 2, background: 'rgba(0,0,0,.28)' }} />
                  </div>
                  <div
                    onMouseDown={(e) => startDrag(e, item, 'bot')}
                    style={{
                      position: 'absolute', left: 0, right: 0, height: 8, bottom: -4,
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
