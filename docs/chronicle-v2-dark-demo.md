# Chronicle v2 Dark Theme Demo — Handoff Document

## What This Is

A **dark-themed demonstration copy** of the Chronicle timeline page. The goal is a standalone `/chronicle-v2` route that renders the exact same interactive timeline canvas but with a midnight/gold color scheme instead of the original parchment/ink scheme. This is for demonstration purposes — showing the Chronicle in a different visual mode.

## Current State (Feb 23, 2026)

### What's Done

**4 files created in `src/components/chronicle-v2/`:**

| File | Status | Description |
|------|--------|-------------|
| `ToolbarDark.tsx` | Complete | Dark toolbar — gold accent slider, midnight background |
| `ChronicleModalDark.tsx` | Complete | Dark entry add/edit modal — all form fields themed |
| `ChronicleGeoModalDark.tsx` | Complete | Dark geography place modal — themed |
| `ChronicleCanvasDark.tsx` | **NOT CREATED** | The main canvas — this is the big one |

**1 shared theme file in `src/components/chronicle/theme.ts`:**
- Defines `ChronicleTheme` interface with ~50 color tokens
- Exports `LIGHT_THEME` (parchment) and `DARK_THEME` (midnight/gold)
- Exports React context (`ChronicleThemeContext`, `useChronicleTheme`)

### What's NOT Done

1. **`src/components/chronicle-v2/ChronicleCanvasDark.tsx`** — The main canvas component. This is the largest file (~1800 lines in the original). It needs to be a copy of `src/components/chronicle/ChronicleCanvas.tsx` with these changes:
   - Import `DARK_THEME as T` from `../chronicle/theme`
   - Import `ToolbarDark` instead of `Toolbar`
   - Import `ChronicleModalDark` instead of `ChronicleModal`
   - Import `ChronicleGeoModalDark` instead of `ChronicleGeoModal`
   - Replace every hardcoded color with the corresponding `T.*` token (see mapping below)
   - All logic, state management, drag handling, zoom, data loading stays identical

2. **`src/app/chronicle-v2/page.tsx`** — The route page. Simple file like the original:
   ```tsx
   'use client'
   import Nav from '@/components/Nav'
   import ChronicleCanvasDark from '@/components/chronicle-v2/ChronicleCanvasDark'
   export default function ChronicleV2Page() {
     return (
       <>
         <Nav />
         <ChronicleCanvasDark />
       </>
     )
   }
   ```

## Color Mapping Reference

When creating `ChronicleCanvasDark.tsx`, replace these hardcoded values from the original `ChronicleCanvas.tsx`:

| Original (light) | Theme Token | Dark Value |
|---|---|---|
| `'#f0ead8'` (bg) | `T.bg` | `'#0c0e14'` |
| `'#f6f1e6'` (panel) | `T.panelBg` | `'#151a22'` |
| `'rgba(246,241,230,0.88)'` (axis bg) | `T.axisBgAlpha` | `'rgba(16,20,28,0.92)'` |
| `'#1a1812'` (ink/border) | `T.borderStrong` | `'#d4af37'` (gold) |
| `'#d8d0c0'` (light border) | `T.borderLight` | `'#252a34'` |
| `'#1a1812'` (text) | `T.textPrimary` | `'#d8d0c0'` |
| `'#5a5040'` (mid text) | `T.textSecondary` | `'#a09480'` |
| `'#9a8e78'` (dim text) | `T.textMuted` | `'#706858'` |
| `'#d8d0c0'` (faint text) | `T.textFaint` | `'#383228'` |
| `'#c84030'` (today line) | `T.todayColor` | `'#e05040'` |
| `'#a85060'` (age color) | `T.ageColor` | `'#d07080'` |
| `'rgba(168,80,96,0.35)'` (age dash) | `T.ageDash` | `'rgba(208,112,128,0.3)'` |
| `'rgba(168,80,96,0.18)'` (age grid) | `T.ageGridDash` | `'rgba(208,112,128,0.12)'` |
| `'rgba(246,241,230,0.9)'` (age label bg) | `T.ageLabelBg` | `'rgba(16,20,28,0.9)'` |
| `'rgba(0,0,0,0.18)'` (decade rule) | `T.ruleDecade` | `'rgba(212,175,55,0.14)'` |
| `'rgba(0,0,0,0.1)'` (year rule) | `T.ruleYear` | `'rgba(255,255,255,0.05)'` |
| `'rgba(0,0,0,.04)'` (month rule) | `T.ruleMonth` | `'rgba(255,255,255,0.025)'` |
| `'rgba(0,0,0,.07)'` (col divider) | `T.colDivider` | `'rgba(255,255,255,0.04)'` |
| `'rgba(0,0,0,.28)'` (handle bar) | `T.handleBar` | `'rgba(212,175,55,.35)'` |
| Selection outline `'#1a1812'` | `T.selectionOutline` | `'#d4af37'` |
| Tooltip bg `'#1a1812'` | `T.tooltipBg` | `'#f6f1e6'` |
| Tooltip text `'#f6f1e6'` | `T.tooltipText` | `'#1a1812'` |
| Font body `"'DM Mono', monospace"` | `T.fontBody` | same |
| Font heading `"'Libre Baskerville', serif"` | `T.fontHeading` | `"var(--font-playfair), 'Playfair Display', serif"` |

## How the Existing Dark Components Work

All 3 completed dark components follow the same pattern:
1. `import { DARK_THEME as T } from '../chronicle/theme'`
2. Use `T.*` tokens everywhere instead of hardcoded colors
3. Same props interface as the original
4. Same logic, just different colors

## Shared Code — What Does NOT Change

The dark canvas reuses ALL of these from `src/components/chronicle/`:
- `constants.ts` — COLS, COL_W, AXIS_W, zoom config, localStorage keys
- `types.ts` — TimelineItem, PlaceItem, YM interfaces
- `utils.ts` — parseYM, toPx, pxToYM, hex2rgba, sliderToYears, getColLeft, etc.
- `LockIcon.tsx` — lock icon SVG for private columns

And from `src/lib/`:
- `chronicle.ts` — all Supabase CRUD (loadChronicleData, upsertEntry, etc.)

## File Locations

```
src/components/chronicle/           # Original light theme
  ChronicleCanvas.tsx               # Main canvas (SOURCE — copy this for dark)
  ChronicleModal.tsx                # Entry modal
  ChronicleGeoModal.tsx             # Geography modal
  Toolbar.tsx                       # Top toolbar
  constants.ts                      # Shared config
  types.ts                          # Shared types
  utils.ts                          # Shared utilities
  LockIcon.tsx                      # Lock icon
  theme.ts                          # LIGHT_THEME + DARK_THEME definitions

src/components/chronicle-v2/        # Dark theme variants
  ToolbarDark.tsx                   # Done
  ChronicleModalDark.tsx            # Done
  ChronicleGeoModalDark.tsx         # Done
  ChronicleCanvasDark.tsx           # TODO — the main one

src/app/chronicle/page.tsx          # Existing light route
src/app/chronicle-v2/page.tsx       # TODO — dark route
```

## Instructions to Complete

1. Create `src/components/chronicle-v2/ChronicleCanvasDark.tsx`:
   - Copy `src/components/chronicle/ChronicleCanvas.tsx` verbatim
   - Change imports: `ToolbarDark`, `ChronicleModalDark`, `ChronicleGeoModalDark`
   - Add `import { DARK_THEME as T } from '../chronicle/theme'`
   - Replace every hardcoded color string with the corresponding `T.*` token (use mapping above)
   - Rename the component to `ChronicleCanvasDark`
   - Keep WorkModal import as-is (it's a separate shared component)

2. Create `src/app/chronicle-v2/page.tsx`:
   - Simple wrapper importing Nav + ChronicleCanvasDark

3. The page should then be visible at `/chronicle-v2`
