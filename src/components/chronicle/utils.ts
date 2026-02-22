import type { YM } from './types'
import {
  ZOOM_YEARS_MAX,
  ZOOM_YEARS_MIN,
  ZOOM_GAMMA,
  COLS,
  COL_W,
  COLLAPSED_W,
} from './constants'

export function parseYM(s: string | null | undefined): YM | null {
  if (!s) return null
  const p = s.split('-')
  return { y: +p[0], m: +(p[1] || 1) }
}

export function toMo(ym: YM, vs: number): number {
  return (ym.y - vs) * 12 + (ym.m - 1)
}

export function toPx(ym: YM, pxm: number, vs: number): number {
  return toMo(ym, vs) * pxm
}

export function pxToYM(px: number, pxm: number, vs: number): YM {
  const mo = Math.round(px / pxm)
  return { y: vs + Math.floor(mo / 12), m: (mo % 12) + 1 }
}

export function ymStr(ym: YM): string {
  return ym.y + '-' + String(ym.m).padStart(2, '0')
}

export function fmtYM(ym: YM): string {
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][ym.m - 1] + ' ' + ym.y
}

export function hex2rgba(h: string, a: number): string {
  const r = parseInt(h.slice(1, 3), 16)
  const g = parseInt(h.slice(3, 5), 16)
  const b = parseInt(h.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

export function addOneYear(ym: string): string {
  const p = ym.split('-')
  return (parseInt(p[0]) + 1) + '-' + (p[1] || '01')
}

// Zoom conversion: slider position [0,1] → years visible
export function sliderToYears(t: number): number {
  const clamped = Math.max(0, Math.min(1, t))
  return ZOOM_YEARS_MAX * Math.pow(ZOOM_YEARS_MIN / ZOOM_YEARS_MAX, Math.pow(clamped, ZOOM_GAMMA))
}

// Column layout (collapse-aware)
export function getColLeft(colId: string, collapsed: Set<string>): number {
  let x = 0
  for (const c of COLS) {
    if (c.id === colId) return x
    x += collapsed.has(c.id) ? COLLAPSED_W : COL_W
  }
  return x
}

export function getTotalGridW(collapsed: Set<string>): number {
  return COLS.reduce((sum, c) => sum + (collapsed.has(c.id) ? COLLAPSED_W : COL_W), 0)
}

export function getColAtX(x: number, collapsed: Set<string>): number {
  let acc = 0
  for (let i = 0; i < COLS.length; i++) {
    const w = collapsed.has(COLS[i].id) ? COLLAPSED_W : COL_W
    if (x < acc + w) return i
    acc += w
  }
  return -1
}

// Extract earliest year from a date string like "YYYY-MM" or "YYYY-MM-DD"
export function yearFromDate(s: string | null | undefined): number | null {
  if (!s) return null
  const y = parseInt(s)
  return isNaN(y) ? null : y
}
