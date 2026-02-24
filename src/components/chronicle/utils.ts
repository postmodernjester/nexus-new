import type { YM, ColumnDef } from './types'
import {
  ZOOM_YEARS_MAX,
  ZOOM_YEARS_MIN,
  ZOOM_GAMMA,
  COL_W,
  HALF_W,
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

/** Get effective pixel width for a column (collapse-aware, half-width-aware) */
export function getColWidth(col: ColumnDef, collapsed: Set<string>): number {
  if (collapsed.has(col.id)) return COLLAPSED_W
  return col.width === 'half' ? HALF_W : COL_W
}

// Column layout (collapse-aware, half-width-aware, dynamic column list)
export function getColLeft(colId: string, collapsed: Set<string>, cols: ColumnDef[]): number {
  let x = 0
  for (const c of cols) {
    if (c.id === colId) return x
    x += getColWidth(c, collapsed)
  }
  return x
}

export function getTotalGridW(collapsed: Set<string>, cols: ColumnDef[]): number {
  return cols.reduce((sum, c) => sum + getColWidth(c, collapsed), 0)
}

export function getColAtX(x: number, collapsed: Set<string>, cols: ColumnDef[]): number {
  let acc = 0
  for (let i = 0; i < cols.length; i++) {
    const w = getColWidth(cols[i], collapsed)
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
