'use client'

import { createContext, useContext } from 'react'

export interface ChronicleTheme {
  // Surfaces
  bg: string
  panelBg: string
  axisBgAlpha: string      // semi-transparent for sticky axis
  loadingBg: string
  loadingText: string

  // Borders
  borderStrong: string
  borderLight: string

  // Text
  textPrimary: string
  textSecondary: string    // toolbar title, modal form text
  textMuted: string        // labels (SCALE, column headers)
  textFaint: string        // help text, geo header

  // Tooltip / hint chip
  tooltipBg: string
  tooltipText: string

  // Grid lines
  ruleDecade: string
  ruleYear: string
  ruleMonth: string
  colDivider: string

  // Selection
  selectionOutline: string

  // Today line
  todayColor: string

  // Age decade markers
  ageColor: string
  ageDash: string
  ageGridDash: string
  ageLabelBg: string

  // Axis
  tickFiveColor: string
  tickSmallColor: string

  // Resize / drag handles
  handleBar: string

  // Zoom control
  zoomTrackBg: string
  zoomTrackFill: string
  zoomThumbBg: string
  zoomThumbShadow: string

  // Modals
  modalOverlay: string
  modalBg: string
  modalBorder: string
  inputBg: string
  inputBorder: string
  checkboxAccent: string
  swatchSelectedBorder: string

  // Buttons
  btnBg: string
  btnText: string
  btnBorder: string
  btnPrimaryBg: string
  btnPrimaryText: string
  btnPrimaryBorder: string
  dangerColor: string
  dangerBorder: string

  // Fonts
  fontBody: string
  fontHeading: string
}

// ─── LIGHT THEME (current parchment look) ─────────────
export const LIGHT_THEME: ChronicleTheme = {
  bg: '#f0ead8',
  panelBg: '#f6f1e6',
  axisBgAlpha: 'rgba(246,241,230,0.88)',
  loadingBg: '#f0ead8',
  loadingText: '#9a8e78',

  borderStrong: '#1a1812',
  borderLight: '#d8d0c0',

  textPrimary: '#1a1812',
  textSecondary: '#5a5040',
  textMuted: '#9a8e78',
  textFaint: '#d8d0c0',

  tooltipBg: '#1a1812',
  tooltipText: '#f6f1e6',

  ruleDecade: 'rgba(0,0,0,0.18)',
  ruleYear: 'rgba(0,0,0,0.1)',
  ruleMonth: 'rgba(0,0,0,.04)',
  colDivider: 'rgba(0,0,0,.07)',

  selectionOutline: '#1a1812',

  todayColor: '#c84030',

  ageColor: '#a85060',
  ageDash: 'rgba(168,80,96,0.35)',
  ageGridDash: 'rgba(168,80,96,0.18)',
  ageLabelBg: 'rgba(246,241,230,0.9)',

  tickFiveColor: '#9a8e78',
  tickSmallColor: '#1a1812',

  handleBar: 'rgba(0,0,0,.28)',

  zoomTrackBg: '#d8d0c0',
  zoomTrackFill: '#9a8e78',
  zoomThumbBg: '#1a1812',
  zoomThumbShadow: '0 1px 4px rgba(0,0,0,.25)',

  modalOverlay: 'rgba(18,16,10,.5)',
  modalBg: '#f6f1e6',
  modalBorder: '#1a1812',
  inputBg: '#f0ead8',
  inputBorder: '#d8d0c0',
  checkboxAccent: '#1a1812',
  swatchSelectedBorder: '#1a1812',

  btnBg: 'none',
  btnText: '#5a5040',
  btnBorder: '#d8d0c0',
  btnPrimaryBg: '#1a1812',
  btnPrimaryText: '#f6f1e6',
  btnPrimaryBorder: '#1a1812',
  dangerColor: '#c84030',
  dangerBorder: 'rgba(200,64,48,.3)',

  fontBody: "'DM Mono', monospace",
  fontHeading: "'Libre Baskerville', serif",
}

// ─── DARK THEME (midnight – matches Nexus site mood) ──
export const DARK_THEME: ChronicleTheme = {
  bg: '#0c0e14',
  panelBg: '#151a22',
  axisBgAlpha: 'rgba(16,20,28,0.92)',
  loadingBg: '#0c0e14',
  loadingText: '#605848',

  borderStrong: '#d4af37',
  borderLight: '#252a34',

  textPrimary: '#d8d0c0',
  textSecondary: '#a09480',
  textMuted: '#706858',
  textFaint: '#383228',

  tooltipBg: '#f6f1e6',
  tooltipText: '#1a1812',

  ruleDecade: 'rgba(212,175,55,0.14)',
  ruleYear: 'rgba(255,255,255,0.05)',
  ruleMonth: 'rgba(255,255,255,0.025)',
  colDivider: 'rgba(255,255,255,0.04)',

  selectionOutline: '#d4af37',

  todayColor: '#e05040',

  ageColor: '#d07080',
  ageDash: 'rgba(208,112,128,0.3)',
  ageGridDash: 'rgba(208,112,128,0.12)',
  ageLabelBg: 'rgba(16,20,28,0.9)',

  tickFiveColor: '#605848',
  tickSmallColor: '#d8d0c0',

  handleBar: 'rgba(212,175,55,.35)',

  zoomTrackBg: '#252a34',
  zoomTrackFill: '#d4af37',
  zoomThumbBg: '#d4af37',
  zoomThumbShadow: '0 1px 6px rgba(212,175,55,.35)',

  modalOverlay: 'rgba(0,0,0,.65)',
  modalBg: '#151a22',
  modalBorder: '#d4af37',
  inputBg: '#0c0e14',
  inputBorder: '#252a34',
  checkboxAccent: '#d4af37',
  swatchSelectedBorder: '#d4af37',

  btnBg: 'none',
  btnText: '#a09480',
  btnBorder: '#252a34',
  btnPrimaryBg: '#d4af37',
  btnPrimaryText: '#0c0e14',
  btnPrimaryBorder: '#d4af37',
  dangerColor: '#e06050',
  dangerBorder: 'rgba(224,96,80,.3)',

  fontBody: "'DM Mono', monospace",
  fontHeading: "var(--font-playfair), 'Playfair Display', serif",
}

export const ChronicleThemeContext = createContext<ChronicleTheme>(LIGHT_THEME)
export const useChronicleTheme = () => useContext(ChronicleThemeContext)
