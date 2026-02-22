# Chronicle Page — Handoff Context

## Git State

- **Branch**: `claude/chronicle-fixes-session_01YQqECoEjSNXkUPd9bzZSMT`
- **Uncommitted changes** in 2 files (staged but commit signing server was broken):
  - `src/lib/chronicle.ts`
  - `src/components/chronicle/ChronicleCanvas.tsx`
- **Last commit on main**: `274c313 Update tsconfig.tsbuildinfo`
- **Action needed**: Commit and push these changes. The commit kept failing due to a signing server `400: source: Field required` error. Try again — if it still fails, it's an infrastructure issue.

## What Was Changed and Why

### 1. `src/lib/chronicle.ts` — Fix RLS-blocked inserts

**Problem**: Adding new chronicle entries and places silently failed. Supabase RLS policy requires `user_id = auth.uid()` on INSERT, but the `upsertEntry` and `upsertPlace` functions never set `user_id` on the payload.

**Fix**:
- Added `getUserId()` helper at top of file that calls `supabase.auth.getUser()` and returns `user.id`
- In `upsertEntry`: on INSERT path (no `entry.id`), calls `getUserId()` and spreads `user_id` into the insert payload
- In `upsertPlace`: same fix for places
- UPDATE paths are unchanged (RLS allows updates where `user_id` already matches)

### 2. `src/components/chronicle/ChronicleCanvas.tsx` — Major overhaul

#### a) Zoom scale (was linear, now exponential)
- **Old**: Linear `ZOOM_MIN=0.06` to `ZOOM_MAX=2.4` with `BASE_PXM=28`, slider mapped linearly
- **New**: Slider position `[0, 1]` maps to years visible via power curve:
  - `sliderToYears(t) = 40 * (2/40) ^ (t ^ 0.38)`
  - Slider 0 = 40 years visible (zoomed out)
  - Slider 0.5 = ~4 years visible (sweet spot)
  - Slider 1 = 2 years visible (zoomed in)
- `pxm` is derived from `viewportHeight / (yearsVisible * 12)`
- Viewport height tracked via `ResizeObserver` on the scroll container
- Zoom label shows years: "40yr", "4yr", "2yr" etc.
- Stored in localStorage as `chronicle_slider_pos` (replaces old `chronicle_zoom`)

#### b) Auto-derived timeline range (removed manual range picker)
- **Old**: `viewStart`/`viewEnd` were configurable via a modal (double-click the geography header)
- **New**: `viewStart` and `viewEnd` computed via `useMemo` from actual data:
  - Scans all entries, places, work, contacts, education for earliest `start_date`
  - `viewStart` = earliest year - 2
  - `viewEnd` = current year + 3
  - Falls back to `CURRENT_YEAR - 10` to `CURRENT_YEAR + 3` if no data
- Removed: `rangeModal` state, `rangeStartInput`/`rangeEndInput`, `saveRange`, `openRangeModal`, `LS_VIEW_START`, `LS_VIEW_END`, the range picker modal JSX

#### c) Collapsible columns
- Click the colored **dot** in any column header to collapse/expand
- Collapsed width: 24px (just the dot, centered)
- Expanded width: 148px (original `COL_W`)
- State: `collapsedCols: Set<string>` persisted to `localStorage` key `chronicle_collapsed_cols`
- Entries in collapsed columns are **hidden** (not rendered)
- Column divider lines, entry positions, hit-testing all use dynamic width helpers:
  - `getColLeft(colId, collapsed)` — returns left offset accounting for collapsed widths
  - `getTotalGridW(collapsed)` — total grid width
  - `getColAtX(x, collapsed)` — hit test for double-click
- Column headers use `transition: 'width .2s ease'` for smooth animation

#### d) Lock icons on private columns
- `COLS` array now has optional `private: true` on Personal and Residences
- `LockIcon` component renders an inline SVG padlock (8x10px, 40% opacity)
- Shown next to label when column is expanded

#### e) Gatherings and People — no add
- `NO_ADD_COLS = new Set(['gatherings', 'people'])`
- Double-clicking these columns (in grid or header) does NOT open the add modal
- People column still displays contacts with `show_on_chronicle = true`, positioned at `met_date` or `created_at`

#### f) Persistence
- `chronicle_slider_pos` — zoom slider position [0,1]
- `chronicle_center_year` / `chronicle_center_month` — scroll center (debounced on scroll)
- `chronicle_collapsed_cols` — JSON array of collapsed column IDs
- On mount: restores zoom + scrolls to saved center year

## Architecture / Key Files

```
src/
  app/chronicle/page.tsx          — Route, renders <ChronicleCanvas />
  components/chronicle/
    ChronicleCanvas.tsx            — Main canvas (this is the big file, ~900 lines)
    ChronicleModal.tsx             — Add/edit entry modal (EntryFormData type)
    ChronicleGeoModal.tsx          — Add/edit geography/place modal (GeoFormData type)
  lib/
    chronicle.ts                   — Supabase CRUD functions + types
    supabase.ts                    — Supabase client singleton
```

## Data Model

### Supabase Tables
- `chronicle_entries` — custom entries (projects, personal, tech, etc.) with `user_id`, `canvas_col`, `type`, `start_date`, `end_date`, `color`, `fuzzy_start`, `fuzzy_end`, `note`, `show_on_resume`
- `chronicle_places` — geography/residences with `user_id`, `title`, `start_date`, `end_date`, `color`, `fuzzy_start`, `fuzzy_end`
- `work_entries` — existing work table, extended with `chronicle_color`, `chronicle_fuzzy_start`, `chronicle_fuzzy_end`, `chronicle_note`
- `education` — existing education table, same chronicle extensions
- `contacts` — existing contacts table, extended with `chronicle_color`, `chronicle_fuzzy_start`, `chronicle_fuzzy_end`, `chronicle_note`, `show_on_chronicle`, `met_date`

### RLS
- All tables have RLS requiring `user_id = auth.uid()` (or `owner_id` for contacts)
- This is why `getUserId()` was added — inserts MUST include the user_id

## Columns Configuration

| Column | Source | Addable | Private | Notes |
|--------|--------|---------|---------|-------|
| Work | `work_entries` table | Yes (creates chronicle_entry) | No | Also shows work_entries rows |
| Projects | `chronicle_entries` | Yes | No | |
| Education | `education` table | Yes | No | Also shows education rows |
| Personal | `chronicle_entries` | Yes | Yes (lock icon) | |
| Residences | `chronicle_entries` | Yes | Yes (lock icon) | |
| Gatherings | — | **No** (hold off) | No | Disabled for now |
| Tech | `chronicle_entries` | Yes | No | |
| People | `contacts` table | **No** (via contacts) | No | Toggle on contact card |

## Known Issues / Future Work
- Gatherings column: user said "hold off" — will need add functionality later
- People column: entries come from contacts. The contact card has a toggle for `show_on_chronicle` and an editable `met_date` field
- The zoom preserves center date when changing — uses `requestAnimationFrame` to adjust scroll after state update
- TypeScript compiles clean (`npx tsc --noEmit` passes)
- Next.js build fails only due to Google Fonts network issues (not code-related)
