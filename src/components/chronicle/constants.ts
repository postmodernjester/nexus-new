// ═══════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════
export const CURRENT_YEAR = new Date().getFullYear()
export const COL_W = 148
export const COLLAPSED_W = 24
export const AXIS_W = 72

// Zoom: slider 0 → 40yr visible, 0.5 → ~4yr, 1 → 2yr
export const ZOOM_YEARS_MAX = 40
export const ZOOM_YEARS_MIN = 2
export const ZOOM_GAMMA = 0.38

// localStorage keys
export const LS_SLIDER = 'chronicle_slider_pos'
export const LS_CENTER_YEAR = 'chronicle_center_year'
export const LS_CENTER_MONTH = 'chronicle_center_month'
export const LS_COLLAPSED = 'chronicle_collapsed_cols'

export const COLS: { id: string; label: string; color: string; private?: boolean }[] = [
  { id: 'work', label: 'Work', color: '#4070a8' },
  { id: 'project', label: 'Projects', color: '#508038' },
  { id: 'education', label: 'Education', color: '#2a8a6a' },
  { id: 'personal', label: 'Personal', color: '#a85060', private: true },
  { id: 'residence', label: 'Residences', color: '#806840', private: true },
  { id: 'gatherings', label: 'Gatherings', color: '#c06848' },
  { id: 'tech', label: 'Tech', color: '#986020' },
  { id: 'people', label: 'People', color: '#7050a8' },
]

export const DEFAULT_COLORS: Record<string, string> = {
  work: '#4070a8', project: '#508038', education: '#2a8a6a', personal: '#a85060',
  residence: '#806840', gatherings: '#c06848', tech: '#986020', people: '#7050a8',
}

// Columns where double-click should NOT open add modal
export const NO_ADD_COLS = new Set(['gatherings', 'people'])
